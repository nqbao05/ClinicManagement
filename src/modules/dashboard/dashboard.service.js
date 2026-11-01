const { validateDashboardQuery } = require('./dashboard.dto');

/**
 * Service Layer: Xử lý nghiệp vụ gom nhóm và phân tích số liệu đa Node CSDL (Data Aggregation)
 * Tích hợp cơ chế chịu lỗi phân tán (Fault-Tolerant Parallel Querying via Promise.allSettled).
 * Đảm bảo Dashboard không bao giờ bị sập nếu 1 trong các Node khu vực gặp sự cố gián đoạn mạng.
 */
class DashboardService {
  /**
   * @param {Object} dashboardRepository - Instance của DashboardRepository
   */
  constructor(dashboardRepository) {
    this.dashboardRepository = dashboardRepository;
  }

  /**
   * Lấy số liệu thống kê phân tích tổng hợp từ toàn bộ hệ thống CSDL phân tán
   * @param {Object} rawQuery - { from_date, to_date }
   * @returns {Promise<Object>}
   */
  async getAggregatedStats(rawQuery = {}) {
    // 1. Xác thực và chuẩn hóa khoảng thời gian
    const dateRange = validateDashboardQuery(rawQuery);

    // 2. Map Phase: Gọi song song truy vấn tới cả 2 Node Shard CSDL với Promise.allSettled
    const [hanoiSettled, hcmSettled] = await Promise.allSettled([
      this.dashboardRepository.getNodeMetrics(1, dateRange),
      this.dashboardRepository.getNodeMetrics(2, dateRange)
    ]);

    // 3. Giám sát sức khỏe Node (Node Health Check) & Ghi nhận cảnh báo chịu lỗi
    const nodeHealth = {
      hanoi: {
        node_id: 1,
        name: 'clinic_hanoi (Node Hà Nội)',
        status: hanoiSettled.status === 'fulfilled' ? 'ONLINE' : 'OFFLINE',
        error: hanoiSettled.status === 'rejected' ? hanoiSettled.reason?.message : null
      },
      hcm: {
        node_id: 2,
        name: 'clinic_hcm (Node TP.HCM)',
        status: hcmSettled.status === 'fulfilled' ? 'ONLINE' : 'OFFLINE',
        error: hcmSettled.status === 'rejected' ? hcmSettled.reason?.message : null
      }
    };

    const systemWarnings = [];
    if (nodeHealth.hanoi.status === 'OFFLINE') {
      systemWarnings.push(
        'Node 1 (Hà Nội) tạm thời mất kết nối. Số liệu đang được tổng hợp an toàn từ các Node khả dụng còn lại.'
      );
    }
    if (nodeHealth.hcm.status === 'OFFLINE') {
      systemWarnings.push(
        'Node 2 (TP.HCM) tạm thời mất kết nối. Số liệu đang được tổng hợp an toàn từ các Node khả dụng còn lại.'
      );
    }

    // 4. Reduce Phase: Gom nhóm và tính toán các chỉ số kinh doanh cốt lõi
    let totalAppointments = 0;
    let totalPatients = 0;
    const statusCounts = { Pending: 0, Confirmed: 0, Cancelled: 0 };
    let hanoiAppointments = 0;
    let hcmAppointments = 0;
    const specialtyMap = new Map();

    // Gom dữ liệu Node Hà Nội (nếu online)
    if (hanoiSettled.status === 'fulfilled') {
      const data = hanoiSettled.value;
      totalPatients += data.total_patients;

      data.status_counts.forEach((row) => {
        const count = Number(row.count) || 0;
        statusCounts[row.status] = (statusCounts[row.status] || 0) + count;
        totalAppointments += count;
        hanoiAppointments += count;
      });

      data.specialty_analytics.forEach((row) => {
        const count = Number(row.total_appointments) || 0;
        specialtyMap.set(row.specialty, (specialtyMap.get(row.specialty) || 0) + count);
      });
    }

    // Gom dữ liệu Node TP.HCM (nếu online)
    if (hcmSettled.status === 'fulfilled') {
      const data = hcmSettled.value;
      totalPatients += data.total_patients;

      data.status_counts.forEach((row) => {
        const count = Number(row.count) || 0;
        statusCounts[row.status] = (statusCounts[row.status] || 0) + count;
        totalAppointments += count;
        hcmAppointments += count;
      });

      data.specialty_analytics.forEach((row) => {
        const count = Number(row.total_appointments) || 0;
        specialtyMap.set(row.specialty, (specialtyMap.get(row.specialty) || 0) + count);
      });
    }

    // Tính tỷ lệ phân bổ khu vực
    const calcPercent = (val, total) => (total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0.0%');

    // Chuyển đổi và sắp xếp thống kê chuyên khoa giảm dần theo số ca khám
    const specialtyAnalytics = Array.from(specialtyMap.entries())
      .map(([specialty, count]) => ({
        specialty,
        total_appointments: count,
        percentage: calcPercent(count, totalAppointments - (statusCounts.Cancelled || 0))
      }))
      .sort((a, b) => b.total_appointments - a.total_appointments);

    // 5. Chuẩn hóa cấu trúc JSON phản hồi cấp độ Production
    return {
      time_range: {
        from_date: dateRange.fromDate,
        to_date: dateRange.toDate,
        from_datetime: dateRange.fromDatetime,
        to_datetime: dateRange.toDatetime
      },
      overview: {
        total_appointments: totalAppointments,
        total_patients: totalPatients,
        status_breakdown: {
          pending: statusCounts.Pending || 0,
          confirmed: statusCounts.Confirmed || 0,
          cancelled: statusCounts.Cancelled || 0
        },
        completion_rate: calcPercent(statusCounts.Confirmed || 0, totalAppointments)
      },
      regional_distribution: [
        {
          clinic_id: 1,
          name: 'Cơ sở Hà Nội',
          database_node: 'clinic_hanoi',
          appointments: hanoiAppointments,
          percentage: calcPercent(hanoiAppointments, totalAppointments),
          status: nodeHealth.hanoi.status
        },
        {
          clinic_id: 2,
          name: 'Cơ sở TP.HCM',
          database_node: 'clinic_hcm',
          appointments: hcmAppointments,
          percentage: calcPercent(hcmAppointments, totalAppointments),
          status: nodeHealth.hcm.status
        }
      ],
      specialty_analytics: specialtyAnalytics,
      node_health: nodeHealth,
      ...(systemWarnings.length > 0 ? { system_warnings: systemWarnings } : {})
    };
  }
}

module.exports = DashboardService;
