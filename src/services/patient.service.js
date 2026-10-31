/**
 * Custom Errors cho Service Layer
 */
class NotFoundError extends Error {
  constructor(message = 'Không tìm thấy hồ sơ bệnh nhân') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'PATIENT_NOT_FOUND';
  }
}

class DuplicatePatientError extends Error {
  constructor(message = 'Hồ sơ bệnh nhân với số CCCD này đã tồn tại trong hệ thống') {
    super(message);
    this.name = 'DuplicatePatientError';
    this.statusCode = 409;
    this.code = 'PATIENT_DUPLICATE_IDENTITY_CARD';
  }
}

/**
 * Service xử lý nghiệp vụ Bệnh nhân (Clean Business Logic)
 * Quản lý quy tắc nghiệp vụ và logic đồng bộ dữ liệu phân mảnh đa cơ sở
 */
class PatientService {
  /**
   * @param {Object} patientRepository - Instance của PatientRepository
   * @param {Object} [options]
   * @param {number} [options.currentClinicId] - Mã cơ sở hiện tại của node API Gateway (Mặc định: 1 - Hà Nội)
   */
  constructor(patientRepository, options = {}) {
    this.patientRepository = patientRepository;
    this.currentClinicId = Number(options.currentClinicId || process.env.CURRENT_CLINIC_ID || 1);
  }

  /**
   * Tạo mới hồ sơ bệnh nhân
   * Quy tắc nghiệp vụ: Kiểm tra trùng lặp số CCCD/CMND trước khi lưu
   * @param {Object} patientData 
   * @returns {Object} Dữ liệu bệnh nhân vừa tạo
   */
  async create(patientData) {
    const existing = await this.patientRepository.findByIdentityCard(patientData.identity_card);
    if (existing) {
      throw new DuplicatePatientError(
        `Bệnh nhân có số CCCD/CMND ${patientData.identity_card} đã tồn tại ở chi nhánh ${existing.origin_clinic_id}`
      );
    }

    const createdPatient = await this.patientRepository.create(patientData);
    return createdPatient.toJSON();
  }

  /**
   * Lấy danh sách bệnh nhân
   * @param {Object} [filter]
   * @param {number} [filter.origin_clinic_id]
   * @param {number} [activeClinicId] - Chi nhánh đang thực hiện truy vấn
   * @returns {Array<Object>}
   */
  async findAll(filter = {}, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patients = await this.patientRepository.findAll(filter);

    return patients.map((patient) => {
      const data = patient.toJSON();
      const isExternal = data.origin_clinic_id !== effectiveClinicId;
      return {
        ...data,
        is_external_record: isExternal
      };
    });
  }

  /**
   * Lấy chi tiết hồ sơ bệnh nhân theo ID
   * Kịch bản PRD 2.1: Bổ sung cờ is_external_record: true nếu bệnh nhân thuộc node khác
   * @param {number|string} id 
   * @param {number} [activeClinicId] - Chi nhánh nơi bác sĩ đang ngồi khám
   * @returns {Object}
   */
  async findById(id, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patient = await this.patientRepository.findById(id);

    if (!patient) {
      throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân với mã ID: ${id}`);
    }

    const data = patient.toJSON();
    const isExternal = data.origin_clinic_id !== effectiveClinicId;

    return {
      ...data,
      is_external_record: isExternal,
      ...(isExternal
        ? {
            source_node: data.origin_clinic_id === 1 ? 'Node Hà Nội' : 'Node TP.HCM',
            sync_notice: `Dữ liệu được đồng bộ từ Cơ sở ${data.origin_clinic_id === 1 ? 'Hà Nội' : 'TP.HCM'}`
          }
        : {})
    };
  }

  /**
   * Tra cứu bệnh nhân theo CCCD/CMND
   * @param {string} identityCard 
   * @param {number} [activeClinicId] 
   * @returns {Object}
   */
  async findByIdentityCard(identityCard, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patient = await this.patientRepository.findByIdentityCard(identityCard);

    if (!patient) {
      throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân có số CCCD/CMND: ${identityCard}`);
    }

    const data = patient.toJSON();
    const isExternal = data.origin_clinic_id !== effectiveClinicId;

    return {
      ...data,
      is_external_record: isExternal,
      ...(isExternal
        ? {
            source_node: data.origin_clinic_id === 1 ? 'Node Hà Nội' : 'Node TP.HCM',
            sync_notice: `Dữ liệu được đồng bộ từ Cơ sở ${data.origin_clinic_id === 1 ? 'Hà Nội' : 'TP.HCM'}`
          }
        : {})
    };
  }

  /**
   * Cập nhật thông tin bệnh nhân
   * @param {number|string} id 
   * @param {Object} updateData 
   * @returns {Object}
   */
  async update(id, updateData) {
    const existing = await this.patientRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân để cập nhật với ID: ${id}`);
    }

    if (updateData.identity_card && updateData.identity_card !== existing.identity_card) {
      const duplicate = await this.patientRepository.findByIdentityCard(updateData.identity_card);
      if (duplicate && duplicate.patient_id !== existing.patient_id) {
        throw new DuplicatePatientError(`Số CCCD/CMND ${updateData.identity_card} đã được sử dụng bởi bệnh nhân khác`);
      }
    }

    const updated = await this.patientRepository.update(id, updateData);
    return updated.toJSON();
  }

  /**
   * Xóa hồ sơ bệnh nhân
   * @param {number|string} id 
   * @returns {Object}
   */
  async remove(id) {
    const existing = await this.patientRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân để xóa với ID: ${id}`);
    }

    await this.patientRepository.delete(id);
    return {
      success: true,
      deleted_patient_id: Number(id),
      message: 'Đã xóa hồ sơ bệnh nhân thành công'
    };
  }
}

module.exports = {
  PatientService,
  NotFoundError,
  DuplicatePatientError
};
