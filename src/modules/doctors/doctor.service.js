const NotFoundError = require('../../common/errors/not-found.error');
const {
  validateDoctorQuery,
  validateDoctorId,
  validateCreateDoctor,
  validateUpdateDoctor,
  validateDoctorStatus
} = require('./doctor.dto');

/**
 * Service Layer: Quản lý Bác sĩ theo cơ sở & chuyên khoa (TV1)
 * Điều phối dữ liệu phân mảnh giữa 2 Node CSDL:
 * - Cơ sở 1: Hà Nội
 * - Cơ sở 2: TP.HCM
 */
class DoctorService {
  /**
   * @param {Object} doctorRepository 
   */
  constructor(doctorRepository) {
    this.doctorRepository = doctorRepository;
  }

  /**
   * Tra cứu danh sách bác sĩ (theo cơ sở hoặc Cross-Node)
   * @param {Object} rawQuery 
   * @returns {Promise<Array<Object>>}
   */
  async getDoctors(rawQuery = {}) {
    const filters = validateDoctorQuery(rawQuery);
    const filterArg = (filters.status || filters.search) ? filters : (filters.specialty || undefined);

    if (filters.clinic_id) {
      return this.doctorRepository.findByClinic(filters.clinic_id, filterArg);
    }

    return this.doctorRepository.findAll(filterArg);
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

  /**
   * Thêm mới bác sĩ vào chi nhánh
   * @param {Object} rawData 
   * @returns {Promise<Object>}
   */
  async createDoctor(rawData) {
    const validData = validateCreateDoctor(rawData);
    return this.doctorRepository.createDoctor(validData.clinic_id, validData);
  }

  /**
   * Cập nhật thông tin bác sĩ
   * @param {number|string} doctorId 
   * @param {Object} rawData 
   * @param {number|string} [clinicId] 
   * @returns {Promise<Object>}
   */
  async updateDoctor(doctorId, rawData, clinicId) {
    const validDoctorId = validateDoctorId(doctorId);
    const validUpdates = validateUpdateDoctor(rawData);

    // Xác định clinicId: từ param hoặc tìm bác sĩ hiện có
    let effectiveClinicId = clinicId ? Number(clinicId) : null;
    if (!effectiveClinicId) {
      const existing = await this.getDoctorById(validDoctorId);
      effectiveClinicId = existing.clinic_id;
    }

    const updated = await this.doctorRepository.updateDoctor(effectiveClinicId, validDoctorId, validUpdates);
    if (!updated) {
      throw new NotFoundError(`Không tìm thấy bác sĩ #${validDoctorId} để cập nhật`);
    }
    return updated;
  }

  /**
   * Cập nhật nhanh trạng thái bác sĩ (active / inactive)
   * @param {number|string} doctorId 
   * @param {string} rawStatus 
   * @param {number|string} [clinicId] 
   * @returns {Promise<Object>}
   */
  async updateDoctorStatus(doctorId, rawStatus, clinicId) {
    const validDoctorId = validateDoctorId(doctorId);
    const validStatus = validateDoctorStatus(rawStatus);

    let effectiveClinicId = clinicId ? Number(clinicId) : null;
    if (!effectiveClinicId) {
      const existing = await this.getDoctorById(validDoctorId);
      effectiveClinicId = existing.clinic_id;
    }

    const updated = await this.doctorRepository.updateStatus(effectiveClinicId, validDoctorId, validStatus);
    if (!updated) {
      throw new NotFoundError(`Không tìm thấy bác sĩ #${validDoctorId} để đổi trạng thái`);
    }
    return updated;
  }

  /**
   * Xóa hồ sơ bác sĩ khỏi chi nhánh
   * @param {number|string} doctorId 
   * @param {number|string} [clinicId] 
   * @returns {Promise<Object>}
   */
  async deleteDoctor(doctorId, clinicId) {
    const validDoctorId = validateDoctorId(doctorId);

    let effectiveClinicId = clinicId ? Number(clinicId) : null;
    if (!effectiveClinicId) {
      const existing = await this.getDoctorById(validDoctorId);
      effectiveClinicId = existing.clinic_id;
    }

    await this.doctorRepository.deleteDoctor(effectiveClinicId, validDoctorId);
    return {
      success: true,
      deleted_doctor_id: validDoctorId,
      clinic_id: effectiveClinicId,
      message: 'Đã xóa bác sĩ thành công'
    };
  }
}

module.exports = DoctorService;
