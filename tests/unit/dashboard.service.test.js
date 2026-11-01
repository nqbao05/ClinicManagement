const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateDashboardQuery } = require('../../src/modules/dashboard/dashboard.dto');
const DashboardService = require('../../src/modules/dashboard/dashboard.service');
const BadRequestError = require('../../src/common/errors/bad-request.error');

describe('Dashboard Module - Unit Tests (Clean Architecture & Fault Tolerance)', () => {
  describe('dashboard.dto.js - validateDashboardQuery', () => {
    it('mặc định an toàn 30 ngày gần nhất khi query rỗng', () => {
      const result = validateDashboardQuery({});
      assert.ok(result.fromDate);
      assert.ok(result.toDate);
      assert.match(result.fromDatetime, /^\d{4}-\d{2}-\d{2} 00:00:00$/);
      assert.match(result.toDatetime, /^\d{4}-\d{2}-\d{2} 23:59:59$/);
      assert.ok(new Date(result.fromDatetime) <= new Date(result.toDatetime));
    });

    it('chuẩn hóa chính xác khi truyền from_date và to_date hợp lệ', () => {
      const result = validateDashboardQuery({
        from_date: '2026-10-01',
        to_date: '2026-10-31'
      });
      assert.strictEqual(result.fromDate, '2026-10-01');
      assert.strictEqual(result.toDate, '2026-10-31');
      assert.strictEqual(result.fromDatetime, '2026-10-01 00:00:00');
      assert.strictEqual(result.toDatetime, '2026-10-31 23:59:59');
    });

    it('từ chối và ném BadRequestError khi from_date sai định dạng', () => {
      assert.throws(
        () => validateDashboardQuery({ from_date: '01-10-2026' }),
        (err) => err instanceof BadRequestError && err.statusCode === 400
      );
    });

    it('từ chối và ném BadRequestError khi to_date sai định dạng', () => {
      assert.throws(
        () => validateDashboardQuery({ to_date: 'invalid-date' }),
        (err) => err instanceof BadRequestError && err.statusCode === 400
      );
    });

    it('từ chối khi from_date lớn hơn to_date', () => {
      assert.throws(
        () => validateDashboardQuery({ from_date: '2026-11-05', to_date: '2026-11-01' }),
        (err) => err instanceof BadRequestError && err.statusCode === 400
      );
    });
  });

  describe('dashboard.service.js - Fault-Tolerant Aggregation', () => {
    it('tổng hợp số liệu hoàn hảo khi cả 2 Node đều ONLINE', async () => {
      const mockRepo = {
        getNodeMetrics: async (clinicId, dateRange) => {
          if (clinicId === 1) {
            return {
              clinic_id: 1,
              node_name: 'Node Hà Nội',
              status_counts: [
                { status: 'Confirmed', count: 60 },
                { status: 'Pending', count: 30 },
                { status: 'Cancelled', count: 10 }
              ],
              total_patients: 120,
              specialty_analytics: [
                { specialty: 'Khoa Tim Mạch', total_appointments: 40 },
                { specialty: 'Khoa Nhi', total_appointments: 50 }
              ]
            };
          }
          return {
            clinic_id: 2,
            node_name: 'Node TP.HCM',
            status_counts: [
              { status: 'Confirmed', count: 40 },
              { status: 'Pending', count: 20 },
              { status: 'Cancelled', count: 5 }
            ],
            total_patients: 80,
            specialty_analytics: [
              { specialty: 'Khoa Tim Mạch', total_appointments: 25 },
              { specialty: 'Khoa Răng Hàm Mặt', total_appointments: 35 }
            ]
          };
        }
      };

      const service = new DashboardService(mockRepo);
      const stats = await service.getAggregatedStats({
        from_date: '2026-10-01',
        to_date: '2026-10-31'
      });

      // Kiểm tra Overview
      assert.strictEqual(stats.overview.total_appointments, 165); // 100 HN + 65 HCM
      assert.strictEqual(stats.overview.total_patients, 200); // 120 + 80
      assert.strictEqual(stats.overview.status_breakdown.confirmed, 100);
      assert.strictEqual(stats.overview.status_breakdown.pending, 50);
      assert.strictEqual(stats.overview.status_breakdown.cancelled, 15);
      assert.strictEqual(stats.overview.completion_rate, '60.6%'); // 100 / 165

      // Kiểm tra Phân bổ khu vực
      assert.strictEqual(stats.regional_distribution[0].appointments, 100);
      assert.strictEqual(stats.regional_distribution[0].percentage, '60.6%');
      assert.strictEqual(stats.regional_distribution[0].status, 'ONLINE');
      assert.strictEqual(stats.regional_distribution[1].appointments, 65);
      assert.strictEqual(stats.regional_distribution[1].percentage, '39.4%');
      assert.strictEqual(stats.regional_distribution[1].status, 'ONLINE');

      // Kiểm tra Phân tích chuyên khoa (Gộp Tim Mạch = 40 + 25 = 65, sorted descending)
      assert.strictEqual(stats.specialty_analytics[0].specialty, 'Khoa Tim Mạch');
      assert.strictEqual(stats.specialty_analytics[0].total_appointments, 65);
      assert.strictEqual(stats.specialty_analytics[1].specialty, 'Khoa Nhi');
      assert.strictEqual(stats.specialty_analytics[1].total_appointments, 50);
      assert.strictEqual(stats.specialty_analytics[2].specialty, 'Khoa Răng Hàm Mặt');
      assert.strictEqual(stats.specialty_analytics[2].total_appointments, 35);

      // Node health
      assert.strictEqual(stats.node_health.hanoi.status, 'ONLINE');
      assert.strictEqual(stats.node_health.hcm.status, 'ONLINE');
      assert.strictEqual(stats.system_warnings, undefined);
    });

    it('cơ chế chịu lỗi (Fault Tolerance): Vẫn tổng hợp thành công và cảnh báo khi 1 Node bị sập (OFFLINE)', async () => {
      const mockRepo = {
        getNodeMetrics: async (clinicId, dateRange) => {
          if (clinicId === 1) {
            return {
              clinic_id: 1,
              node_name: 'Node Hà Nội',
              status_counts: [{ status: 'Confirmed', count: 50 }],
              total_patients: 100,
              specialty_analytics: [{ specialty: 'Khoa Ngoại', total_appointments: 50 }]
            };
          }
          // Giả lập Node TP.HCM bị sập kết nối mạng hoặc database server down
          throw new Error('ETIMEDOUT: Connection to MySQL Node clinic_hcm failed');
        }
      };

      const service = new DashboardService(mockRepo);
      const stats = await service.getAggregatedStats({});

      // Hệ thống KHÔNG sập, trả về số liệu của Node còn sống
      assert.strictEqual(stats.overview.total_appointments, 50);
      assert.strictEqual(stats.overview.total_patients, 100);
      assert.strictEqual(stats.overview.status_breakdown.confirmed, 50);

      // Node Health phản ánh chính xác
      assert.strictEqual(stats.node_health.hanoi.status, 'ONLINE');
      assert.strictEqual(stats.node_health.hcm.status, 'OFFLINE');
      assert.ok(stats.node_health.hcm.error.includes('ETIMEDOUT'));

      // Phải có cảnh báo suy giảm dịch vụ (Graceful Degradation Warning)
      assert.ok(Array.isArray(stats.system_warnings));
      assert.strictEqual(stats.system_warnings.length, 1);
      assert.ok(stats.system_warnings[0].includes('Node 2 (TP.HCM) tạm thời mất kết nối'));
    });

    it('chịu lỗi khi cả 2 Node đều OFFLINE: Không văng lỗi 500, trả về 0 cùng cảnh báo an toàn', async () => {
      const mockRepo = {
        getNodeMetrics: async () => {
          throw new Error('ECONNREFUSED: Server unreachable');
        }
      };

      const service = new DashboardService(mockRepo);
      const stats = await service.getAggregatedStats({});

      assert.strictEqual(stats.overview.total_appointments, 0);
      assert.strictEqual(stats.overview.total_patients, 0);
      assert.strictEqual(stats.node_health.hanoi.status, 'OFFLINE');
      assert.strictEqual(stats.node_health.hcm.status, 'OFFLINE');
      assert.strictEqual(stats.system_warnings.length, 2);
    });
  });
});
