/**
 * Controller xử lý HTTP Request / Response cho Module Bệnh nhân (Patient)
 * Tuân thủ Clean Architecture: Tiếp nhận request, gọi Service, trả kết quả chuẩn hóa
 */
class PatientController {
  /**
   * @param {Object} patientService - Instance của PatientService
   */
  constructor(patientService) {
    this.patientService = patientService;

    // Bind this cho các methods để sử dụng làm Express route handlers
    this.createPatient = this.createPatient.bind(this);
    this.getPatients = this.getPatients.bind(this);
    this.getPatientById = this.getPatientById.bind(this);
    this.updatePatient = this.updatePatient.bind(this);
    this.deletePatient = this.deletePatient.bind(this);
  }

  /**
   * Tạo hồ sơ bệnh nhân mới
   * POST /api/patients
   */
  async createPatient(req, res, next) {
    try {
      const patient = await this.patientService.create(req.body);
      return res.status(201).json(patient);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lấy danh sách bệnh nhân (hỗ trợ lọc theo query origin_clinic_id)
   * GET /api/patients
   */
  async getPatients(req, res, next) {
    try {
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

  /**
   * Lấy chi tiết hồ sơ bệnh nhân theo ID
   * GET /api/patients/:id
   */
  async getPatientById(req, res, next) {
    try {
      const activeClinicId = req.headers['x-clinic-id'] || req.query.current_clinic_id;
      const patient = await this.patientService.findById(req.params.id, activeClinicId);
      return res.status(200).json(patient);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Cập nhật thông tin bệnh nhân
   * PUT /api/patients/:id
   */
  async updatePatient(req, res, next) {
    try {
      const updatedPatient = await this.patientService.update(req.params.id, req.body);
      return res.status(200).json(updatedPatient);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Xóa hồ sơ bệnh nhân
   * DELETE /api/patients/:id
   */
  async deletePatient(req, res, next) {
    try {
      const result = await this.patientService.remove(req.params.id);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Factory function khởi tạo PatientController
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
