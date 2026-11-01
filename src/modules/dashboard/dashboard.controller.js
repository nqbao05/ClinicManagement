const { sendSuccess } = require('../../common/responses/response.helper');

/**
 * Controller tiếp nhận HTTP Request / Response cho Module Dashboard Analytics
 * Tuân thủ Clean Architecture: Tiếp nhận input, gọi Service, chuẩn hóa Response JSON.
 */
class DashboardController {
  /**
   * @param {Object} dashboardService - Instance của DashboardService
   */
  constructor(dashboardService) {
    this.dashboardService = dashboardService;
    this.getAggregatedStats = this.getAggregatedStats.bind(this);
  }

  /**
   * Lấy dữ liệu báo cáo thống kê phân tích tổng hợp đa Node CSDL
   * GET /api/v1/admin/dashboard/stats
   */
  async getAggregatedStats(req, res, next) {
    try {
      const data = await this.dashboardService.getAggregatedStats(req.query);
      return sendSuccess(res, 200, 'Lấy dữ liệu thống kê tổng hợp thành công', data);
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Factory function tạo Controller instance
 * @param {Object} dashboardService 
 * @returns {DashboardController}
 */
function createDashboardController(dashboardService) {
  return new DashboardController(dashboardService);
}

module.exports = {
  DashboardController,
  createDashboardController
};
