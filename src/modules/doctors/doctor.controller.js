const { sendSuccess } = require('../../common/responses/response.helper');

/**
 * Controller cho Module Doctors (TV1)
 */
class DoctorController {
  constructor(doctorService) {
    this.doctorService = doctorService;
    this.getDoctors = this.getDoctors.bind(this);
    this.getDoctorById = this.getDoctorById.bind(this);
  }

  async getDoctors(req, res, next) {
    try {
      const doctors = await this.doctorService.getDoctors(req.query);
      return sendSuccess(res, 200, 'Lấy danh sách bác sĩ thành công', doctors);
    } catch (error) {
      return next(error);
    }
  }

  async getDoctorById(req, res, next) {
    try {
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const doctor = await this.doctorService.getDoctorById(req.params.id, clinicId);
      return sendSuccess(res, 200, 'Lấy thông tin bác sĩ thành công', doctor);
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
