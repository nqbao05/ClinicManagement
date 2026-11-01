const express = require('express');
const { createDashboardController } = require('./dashboard.controller');
const DashboardService = require('./dashboard.service');
const DashboardRepository = require('./dashboard.repository');

/**
 * @swagger
 * tags:
 *   - name: Dashboard Analytics (Admin - TV4)
 *     description: 'Thống kê & Phân tích tổng hợp đa Node CSDL phân tán (Thành viên 4)'
 * 
 * /v1/admin/dashboard/stats:
 *   get:
 *     tags: [Dashboard Analytics (Admin - TV4)]
 *     summary: Lấy dữ liệu báo cáo thống kê tổng hợp đa Node CSDL (Fault-Tolerant Analytics)
 *     description: |
 *       Gom nhóm số liệu thời gian thực từ 2 Node CSDL phân tán (`clinic_hanoi` & `clinic_hcm`) bằng cơ chế xử lý song song chịu lỗi (`Promise.allSettled`).
 *       Nếu 1 Node gặp sự cố gián đoạn, hệ thống tự động ghi nhận cảnh báo và trả về số liệu của các Node đang hoạt động mà không làm sập dashboard.
 *     parameters:
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: 'Ngày bắt đầu thống kê (YYYY-MM-DD). Mặc định: 30 ngày trước.'
 *         example: '2026-10-01'
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: 'Ngày kết thúc thống kê (YYYY-MM-DD). Mặc định: hôm nay.'
 *         example: '2026-11-01'
 *     responses:
 *       200:
 *         description: Lấy dữ liệu báo cáo thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 message:
 *                   type: string
 *                   example: 'Lấy dữ liệu thống kê tổng hợp thành công'
 *                 data:
 *                   type: object
 *                   properties:
 *                     time_range:
 *                       type: object
 *                       properties:
 *                         from_date: { type: string, example: '2026-10-01' }
 *                         to_date: { type: string, example: '2026-11-01' }
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_appointments: { type: integer, example: 120 }
 *                         total_patients: { type: integer, example: 85 }
 *                         status_breakdown:
 *                           type: object
 *                           properties:
 *                             pending: { type: integer, example: 45 }
 *                             confirmed: { type: integer, example: 65 }
 *                             cancelled: { type: integer, example: 10 }
 *                         completion_rate: { type: string, example: '54.2%' }
 *                     regional_distribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           clinic_id: { type: integer, example: 1 }
 *                           name: { type: string, example: 'Cơ sở Hà Nội' }
 *                           appointments: { type: integer, example: 70 }
 *                           percentage: { type: string, example: '58.3%' }
 *                           status: { type: string, example: 'ONLINE' }
 *                     specialty_analytics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           specialty: { type: string, example: 'Khoa Tim Mạch' }
 *                           total_appointments: { type: integer, example: 40 }
 *                           percentage: { type: string, example: '36.4%' }
 *                     node_health:
 *                       type: object
 *                       properties:
 *                         hanoi:
 *                           type: object
 *                           properties:
 *                             status: { type: string, example: 'ONLINE' }
 *                         hcm:
 *                           type: object
 *                           properties:
 *                             status: { type: string, example: 'ONLINE' }
 *       400:
 *         description: Khoảng thời gian hoặc định dạng ngày không hợp lệ
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
function createDashboardRoutes(service) {
  const router = express.Router();
  const dashboardService = service || new DashboardService(new DashboardRepository());
  const controller = createDashboardController(dashboardService);

  router.get('/stats', controller.getAggregatedStats);

  return router;
}

const defaultRepository = new DashboardRepository();
const defaultService = new DashboardService(defaultRepository);
const defaultRouter = createDashboardRoutes(defaultService);

defaultRouter.createDashboardRoutes = createDashboardRoutes;
defaultRouter.DashboardService = DashboardService;
defaultRouter.DashboardRepository = DashboardRepository;

module.exports = defaultRouter;
