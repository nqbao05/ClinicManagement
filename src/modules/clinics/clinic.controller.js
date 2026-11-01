const { sendSuccess } = require('../../common/responses/response.helper');

/**
 * Controller cho Module Clinics (TV1)
 */
class ClinicController {
  constructor(clinicService) {
    this.clinicService = clinicService;
    this.getClinics = this.getClinics.bind(this);
    this.getClinicById = this.getClinicById.bind(this);
  }

  async getClinics(req, res, next) {
    try {
      const clinics = await this.clinicService.getClinics(req.query);
      return sendSuccess(res, 200, 'Lấy danh sách chi nhánh thành công', clinics);
    } catch (error) {
      return next(error);
    }
  }

  async getClinicById(req, res, next) {
    try {
      const clinic = await this.clinicService.getClinicById(req.params.id);
      return sendSuccess(res, 200, 'Lấy thông tin chi nhánh thành công', clinic);
    } catch (error) {
      return next(error);
    }
  }
}

function createClinicController(clinicService) {
  return new ClinicController(clinicService);
}

module.exports = {
  ClinicController,
  createClinicController
};
