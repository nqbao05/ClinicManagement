const { sendSuccess } = require('../../common/responses/response.helper');

/**
 * Controller tiếp nhận HTTP Request / Response cho Module Quản lý Bệnh nhân (TV2)
 * Tuân thủ Clean Architecture: Không chứa Business Logic, chuẩn hóa HTTP Response.
 */
class PatientController {
  /**
   * @param {Object} patientService - Instance của PatientService
   */
  constructor(patientService) {
    this.patientService = patientService;
    this.createPatient = this.createPatient.bind(this);
    this.getPatients = this.getPatients.bind(this);
    this.getPatientDetail = this.getPatientDetail.bind(this);
  }

  /**
   * Đăng ký mới hồ sơ bệnh nhân
   * POST /api/v1/patients
   */
  async createPatient(req, res, next) {
    try {
      const result = await this.patientService.registerPatient(req.body);
      return sendSuccess(res, 201, 'Đăng ký hồ sơ bệnh nhân thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Tra cứu danh sách hồ sơ bệnh nhân (Hỗ trợ Cross-Node search)
   * GET /api/v1/patients
   */
  async getPatients(req, res, next) {
    try {
      const result = await this.patientService.searchPatients(req.query);
      return sendSuccess(res, 200, 'Lấy danh sách bệnh nhân thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lấy chi tiết hồ sơ bệnh nhân theo ID
   * GET /api/v1/patients/:id
   */
  async getPatientDetail(req, res, next) {
    try {
      const patientId = req.params.id;
      const clinicId = req.query.clinic_id || req.headers['x-clinic-id'];
      const patient = await this.patientService.getPatientByIdAndOrigin(patientId, clinicId);
      return sendSuccess(res, 200, 'Lấy thông tin bệnh nhân thành công', patient);
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Factory function tạo Controller instance
 * @param {Object} patientService 
 * @returns {PatientController}
 */
function createPatientController(patientService) {
  return new PatientController(patientService);
}

module.exports = {
  PatientController,
  createPatientController
};
