const NotFoundError = require('../../common/errors/not-found.error');
const { validateClinicQuery, validateClinicId } = require('./clinic.dto');

/**
 * Service Layer: Quản lý Chi nhánh phòng khám (TV1)
 */
class ClinicService {
  /**
   * @param {Object} clinicRepository 
   */
  constructor(clinicRepository) {
    this.clinicRepository = clinicRepository;
  }

  /**
   * Lấy danh sách chi nhánh
   * @param {Object} rawQuery 
   * @returns {Promise<Array<Object>>}
   */
  async getClinics(rawQuery = {}) {
    const { clinic_id } = validateClinicQuery(rawQuery);
    if (clinic_id) {
      const clinic = await this.clinicRepository.findById(clinic_id);
      return clinic ? [clinic] : [];
    }
    return this.clinicRepository.findAll();
  }

  /**
   * Lấy chi tiết chi nhánh theo ID
   * @param {number|string} clinicId 
   * @returns {Promise<Object>}
   */
  async getClinicById(clinicId) {
    const validId = validateClinicId(clinicId);
    const clinic = await this.clinicRepository.findById(validId);
    if (!clinic) {
      throw new NotFoundError(`Không tìm thấy chi nhánh phòng khám với mã #${clinicId}`);
    }
    return clinic;
  }
}

module.exports = ClinicService;
