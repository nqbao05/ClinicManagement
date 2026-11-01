const NotFoundError = require('../../common/errors/not-found.error');
const { validateDoctorQuery, validateDoctorId } = require('./doctor.dto');

/**
 * Service Layer: Quản lý Bác sĩ theo cơ sở & chuyên khoa (TV1)
 */
class DoctorService {
  /**
   * @param {Object} doctorRepository 
   */
  constructor(doctorRepository) {
    this.doctorRepository = doctorRepository;
  }

  /**
   * Tra cứu danh sách bác sĩ
   * @param {Object} rawQuery 
   * @returns {Promise<Array<Object>>}
   */
  async getDoctors(rawQuery = {}) {
    const { clinic_id, specialty } = validateDoctorQuery(rawQuery);

    if (clinic_id) {
      return this.doctorRepository.findByClinic(clinic_id, specialty);
    }

    return this.doctorRepository.findAll(specialty);
  }

  /**
   * Tra cứu bác sĩ theo ID
   * @param {number|string} doctorId 
   * @param {number|string} [clinicId] 
   * @returns {Promise<Object>}
   */
  async getDoctorById(doctorId, clinicId) {
    const validDoctorId = validateDoctorId(doctorId);
    if (clinicId && [1, 2].includes(Number(clinicId))) {
      const doc = await this.doctorRepository.findById(clinicId, validDoctorId);
      if (!doc) {
        throw new NotFoundError(`Không tìm thấy bác sĩ #${validDoctorId} tại chi nhánh #${clinicId}`);
      }
      return doc;
    }

    // Nếu không truyền clinicId, tìm ở cả 2 node
    const [d1, d2] = await Promise.all([
      this.doctorRepository.findById(1, validDoctorId).catch(() => null),
      this.doctorRepository.findById(2, validDoctorId).catch(() => null)
    ]);

    const found = d1 || d2;
    if (!found) {
      throw new NotFoundError(`Không tìm thấy bác sĩ #${validDoctorId} trong toàn hệ thống`);
    }

    return found;
  }
}

module.exports = DoctorService;
