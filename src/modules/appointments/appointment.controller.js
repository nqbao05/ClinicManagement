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
    this.updateAppointmentStatus = this.updateAppointmentStatus.bind(this);
  }

  /**
   * Đặt lịch khám mới
   * POST /api/v1/appointments
   */
  async createAppointment(req, res, next) {
    try {
      // Server-side Filter Enforcement
      if (req.user) {
        if (req.user.role === 'patient' && req.user.patient_id) {
          req.body.patient_id = req.user.patient_id;
        } else if (req.user.role === 'staff' && req.user.clinic_id) {
          req.body.clinic_id = req.user.clinic_id;
        }
      }

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
      let clinicId = Number(req.query.clinic_id || req.headers['x-clinic-id'] || 1);

      // Server-side Filter Enforcement
      if (req.user) {
        if (req.user.role === 'staff' && req.user.clinic_id) {
          clinicId = req.user.clinic_id;
          req.query.clinic_id = req.user.clinic_id;
        } else if (req.user.role === 'patient' && req.user.patient_id) {
          req.query.patient_id = req.user.patient_id;
        }
      }

      // Gọi service xử lý truy vấn phân trang kèm quyền người dùng
      const { data, pagination } = await this.appointmentService.getAppointments(clinicId, req.query, req.user);

      // Trả về phản hồi thành công (200 OK)
      return sendSuccess(res, 200, 'Lấy danh sách lịch hẹn thành công', { data, pagination });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cập nhật trạng thái lịch hẹn khám (PATCH /api/v1/appointments/:id/status)
   */
  async updateAppointmentStatus(req, res, next) {
    try {
      const appointmentId = Number(req.params.id);
      const { status } = req.body;
      const clinicId = Number(req.query.clinic_id || req.headers['x-clinic-id'] || (req.user && req.user.clinic_id) || 1);

      const result = await this.appointmentService.updateStatus(appointmentId, status, clinicId, req.user);
      return sendSuccess(res, 200, 'Cập nhật trạng thái lịch hẹn thành công', result);
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
