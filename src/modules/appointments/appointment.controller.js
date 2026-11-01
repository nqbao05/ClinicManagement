const { sendSuccess } = require('../../common/responses/response.helper');
const { validateCreateAppointment } = require('./appointment.dto');

/**
 * Controller tiếp nhận HTTP Request / Response cho Module Appointments
 * Tuân thủ Clean Architecture: Tiếp nhận input, gọi Service, chuẩn hóa Response JSON.
 */
class AppointmentController {
  /**
   * @param {Object} appointmentService - Instance của AppointmentService
   */
  constructor(appointmentService) {
    this.appointmentService = appointmentService;

    // Bind this cho các methods để sử dụng làm Express route handlers
    this.createAppointment = this.createAppointment.bind(this);
    this.getAppointments = this.getAppointments.bind(this);
  }

  /**
   * Đặt lịch khám mới
   * POST /api/v1/appointments
   */
  async createAppointment(req, res, next) {
    try {
      // 1. Xác thực và chuẩn hóa dữ liệu đầu vào qua DTO
      const validatedData = validateCreateAppointment(req.body);

      // 2. Chuyển tiếp nghiệp vụ sang Service
      const result = await this.appointmentService.bookAppointment(validatedData);

      // 3. Trả về phản hồi thành công chuẩn RESTful (201 Created)
      return sendSuccess(res, 201, 'Đặt lịch khám thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lấy danh sách lịch hẹn (hỗ trợ lọc theo doctor_id, status, date và phân trang)
   * GET /api/v1/appointments
   */
  async getAppointments(req, res, next) {
    try {
      // Trích xuất mã chi nhánh ưu tiên: Query param -> Header X-Clinic-ID -> Mặc định: 1
      const clinicId = Number(req.query.clinic_id || req.headers['x-clinic-id'] || 1);

      // Gọi service xử lý truy vấn phân trang
      const { data, pagination } = await this.appointmentService.getAppointments(clinicId, req.query);

      // Trả về phản hồi thành công (200 OK)
      return sendSuccess(res, 200, 'Lấy danh sách lịch hẹn thành công', { data, pagination });
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Factory function tạo Controller instance
 * @param {Object} appointmentService 
 * @returns {AppointmentController}
 */
function createAppointmentController(appointmentService) {
  return new AppointmentController(appointmentService);
}

module.exports = {
  AppointmentController,
  createAppointmentController
};
