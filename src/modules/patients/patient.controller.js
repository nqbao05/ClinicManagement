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
    this.getPatientById = this.getPatientById.bind(this);
    this.updatePatient = this.updatePatient.bind(this);
    this.deletePatient = this.deletePatient.bind(this);
  }

  // --- V1 RESTful Handlers ---

  async createPatientV1(req, res, next) {
    try {
      // Server-side Filter Enforcement
      if (req.user && req.user.role === 'staff' && req.user.clinic_id) {
        req.body.origin_clinic_id = req.user.clinic_id;
      }
      const result = await this.patientService.registerPatient(req.body);
      return sendSuccess(res, 201, 'Đăng ký hồ sơ bệnh nhân thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  async getPatientsV1(req, res, next) {
    try {
      // Server-side Filter Enforcement
      if (req.user && req.user.role === 'staff' && req.user.clinic_id) {
        req.query.clinic_id = req.user.clinic_id;
      }
      const result = await this.patientService.searchPatients(req.query);
      return sendSuccess(res, 200, 'Lấy danh sách bệnh nhân thành công', result);
    } catch (error) {
      return next(error);
    }
  }

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

  // --- Baseline Handlers (tests/patient.test.js compatibility) ---

  async createPatient(req, res, next) {
    try {
      if (req.baseUrl && req.baseUrl.includes('/v1/')) {
        return this.createPatientV1(req, res, next);
      }
      const patient = await this.patientService.create(req.body);
      return res.status(201).json(patient);
    } catch (error) {
      return next(error);
    }
  }

  async getPatients(req, res, next) {
    try {
      if (req.baseUrl && req.baseUrl.includes('/v1/')) {
        return this.getPatientsV1(req, res, next);
      }
      const filter = {};
      if (req.query.origin_clinic_id) {
        filter.origin_clinic_id = Number(req.query.origin_clinic_id);
      }

      const activeClinicId = req.headers['x-clinic-id'] || req.query.current_clinic_id;
      const patients = await this.patientService.findAll(filter, activeClinicId);
      return res.status(200).json(patients);
    } catch (error) {
      return next(error);
    }
  }

  async getPatientById(req, res, next) {
    try {
      const activeClinicId = req.headers['x-clinic-id'] || req.query.current_clinic_id;
      const patient = await this.patientService.findById(req.params.id, activeClinicId);
      return res.status(200).json(patient);
    } catch (error) {
      return next(error);
    }
  }

  async updatePatient(req, res, next) {
    try {
      const updatedPatient = await this.patientService.update(req.params.id, req.body);
      if (req.baseUrl && req.baseUrl.includes('/v1')) {
        return sendSuccess(res, 200, 'Cập nhật hồ sơ bệnh nhân thành công', updatedPatient);
      }
      return res.status(200).json(updatedPatient);
    } catch (error) {
      return next(error);
    }
  }

  async deletePatient(req, res, next) {
    try {
      const result = await this.patientService.remove(req.params.id);
      if (req.baseUrl && req.baseUrl.includes('/v1')) {
        return sendSuccess(res, 200, 'Xóa hồ sơ bệnh nhân thành công', result);
      }
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

function createPatientController(patientService) {
  return new PatientController(patientService);
}

module.exports = {
  PatientController,
  createPatientController
};
