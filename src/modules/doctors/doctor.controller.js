const { sendSuccess } = require('../../common/responses/response.helper');

/**
 * Controller cho Module Doctors (TV1)
 * Tiếp nhận HTTP Request, ủy nhiệm xử lý cho DoctorService và trả về JSON chuẩn
 */
class DoctorController {
  constructor(doctorService) {
    this.doctorService = doctorService;
    this.getDoctors = this.getDoctors.bind(this);
    this.getDoctorById = this.getDoctorById.bind(this);
    this.createDoctor = this.createDoctor.bind(this);
    this.updateDoctor = this.updateDoctor.bind(this);
    this.updateDoctorStatus = this.updateDoctorStatus.bind(this);
    this.deleteDoctor = this.deleteDoctor.bind(this);
  }

  /**
   * GET /api/v1/doctors
   */
  async getDoctors(req, res, next) {
    try {
      const doctors = await this.doctorService.getDoctors(req.query);
      return sendSuccess(res, 200, 'Lấy danh sách bác sĩ thành công', doctors);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * GET /api/v1/doctors/:id
   */
  async getDoctorById(req, res, next) {
    try {
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const doctor = await this.doctorService.getDoctorById(req.params.id, clinicId);
      return sendSuccess(res, 200, 'Lấy thông tin bác sĩ thành công', doctor);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /api/v1/doctors
   */
  async createDoctor(req, res, next) {
    try {
      const doctor = await this.doctorService.createDoctor(req.body);
      return sendSuccess(res, 201, 'Thêm bác sĩ mới thành công', doctor);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PUT /api/v1/doctors/:id
   */
  async updateDoctor(req, res, next) {
    try {
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const doctor = await this.doctorService.updateDoctor(req.params.id, req.body, clinicId);
      return sendSuccess(res, 200, 'Cập nhật thông tin bác sĩ thành công', doctor);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * PATCH /api/v1/doctors/:id/status
   */
  async updateDoctorStatus(req, res, next) {
    try {
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const doctor = await this.doctorService.updateDoctorStatus(req.params.id, req.body.status, clinicId);
      return sendSuccess(res, 200, 'Cập nhật trạng thái bác sĩ thành công', doctor);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /api/v1/doctors/:id
   */
  async deleteDoctor(req, res, next) {
    try {
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const result = await this.doctorService.deleteDoctor(req.params.id, clinicId);
      return sendSuccess(res, 200, 'Xóa bác sĩ thành công', result);
    } catch (error) {
      return next(error);
    }
  }
}

function createDoctorController(doctorService) {
  return new DoctorController(doctorService);
}

module.exports = {
  DoctorController,
  createDoctorController
};
