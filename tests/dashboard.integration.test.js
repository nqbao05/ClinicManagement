process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const DashboardService = require('../src/modules/dashboard/dashboard.service');
const { createDashboardRoutes } = require('../src/modules/dashboard/dashboard.routes');

async function withTestServer(testFn) {
  const mockRepo = {
    async getNodeMetrics(clinicId, dateRange) {
      if (clinicId === 1) {
        return {
          clinic_id: 1,
          node_name: 'Node Hà Nội (clinic_hanoi)',
          status_counts: [
            { status: 'Confirmed', count: 40 },
            { status: 'Pending', count: 10 }
          ],
          total_patients: 75,
          specialty_analytics: [
            { specialty: 'Khoa Tim Mạch', total_appointments: 25 },
            { specialty: 'Khoa Nhi', total_appointments: 15 }
          ]
        };
      }
      return {
        clinic_id: 2,
        node_name: 'Node TP.HCM (clinic_hcm)',
        status_counts: [
          { status: 'Confirmed', count: 30 },
          { status: 'Cancelled', count: 5 }
        ],
        total_patients: 50,
        specialty_analytics: [
          { specialty: 'Khoa Tim Mạch', total_appointments: 15 },
          { specialty: 'Khoa Cơ Xương Khớp', total_appointments: 15 }
        ]
      };
    }
  };

  const dashboardService = new DashboardService(mockRepo);
  const dashboardRoutes = createDashboardRoutes(dashboardService);
  const app = createApp({ dashboardRoutes });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const client = {
    async get(path) {
      const res = await fetch(`${baseUrl}${path}`);
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, body };
    }
  };

  try {
    await testFn(client);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('GET /api/v1/admin/dashboard/stats - Lấy báo cáo thống kê đa Node CSDL thành công (200 OK)', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/admin/dashboard/stats?from_date=2026-10-01&to_date=2026-11-01');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.statusCode, 200);
    assert.strictEqual(res.body.message, 'Lấy dữ liệu thống kê tổng hợp thành công');

    const data = res.body.data;
    assert.ok(data.time_range);
    assert.strictEqual(data.time_range.from_date, '2026-10-01');
    assert.strictEqual(data.time_range.to_date, '2026-11-01');

    // Tổng hợp appointments = 50 (HN) + 35 (HCM) = 85
    assert.strictEqual(data.overview.total_appointments, 85);
    // Tổng patients = 75 + 50 = 125
    assert.strictEqual(data.overview.total_patients, 125);
    assert.strictEqual(data.overview.status_breakdown.confirmed, 70);
    assert.strictEqual(data.overview.status_breakdown.pending, 10);
    assert.strictEqual(data.overview.status_breakdown.cancelled, 5);

    // Phân bổ khu vực
    assert.strictEqual(data.regional_distribution.length, 2);
    assert.strictEqual(data.regional_distribution[0].database_node, 'clinic_hanoi');
    assert.strictEqual(data.regional_distribution[1].database_node, 'clinic_hcm');

    // Chuyên khoa Tim Mạch = 25 + 15 = 40 (đứng đầu)
    assert.strictEqual(data.specialty_analytics[0].specialty, 'Khoa Tim Mạch');
    assert.strictEqual(data.specialty_analytics[0].total_appointments, 40);

    // Sức khỏe Node
    assert.strictEqual(data.node_health.hanoi.status, 'ONLINE');
    assert.strictEqual(data.node_health.hcm.status, 'ONLINE');
  });
});

test('GET /api/v1/admin/dashboard/stats - Mặc định an toàn khi không truyền query (200 OK)', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/admin/dashboard/stats');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(dataTimeRange => res.body.data.time_range.from_date);
    assert.ok(res.body.data.overview.total_appointments > 0);
  });
});

test('GET /api/v1/admin/dashboard/stats - Trả về 400 Bad Request khi sai định dạng ngày', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/admin/dashboard/stats?from_date=01/10/2026');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('YYYY-MM-DD'));
  });
});

test('GET /api/v1/admin/dashboard/stats - Trả về 400 Bad Request khi from_date > to_date', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/admin/dashboard/stats?from_date=2026-12-01&to_date=2026-11-01');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });
});
