const { validateCreatePatient, validatePatientSearchQuery } = require('./patient.dto');
const ConflictError = require('../../common/errors/conflict.error');
const NotFoundError = require('../../common/errors/not-found.error');

class PatientNotFoundError extends NotFoundError {
  constructor(message = 'Không tìm thấy hồ sơ bệnh nhân') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'PATIENT_NOT_FOUND';
  }
}

class DuplicatePatientError extends ConflictError {
  constructor(message = 'Hồ sơ bệnh nhân với số CCCD này đã tồn tại trong hệ thống') {
    super(message);
    this.name = 'DuplicatePatientError';
    this.code = 'PATIENT_DUPLICATE_IDENTITY_CARD';
  }
}

/**
 * Service Layer: Xử lý nghiệp vụ quản lý bệnh nhân, định tuyến ghi theo Sharding Key
 * và thực thi tìm kiếm phân tán chịu lỗi (Cross-Node Distributed Lookup).
 */
class PatientService {
  /**
   * @param {Object} patientRepository - Instance của PatientRepository
   * @param {Object} [options]
   */
  constructor(patientRepository, options = {}) {
    this.patientRepository = patientRepository;
    this.currentClinicId = Number(options.currentClinicId || process.env.CURRENT_CLINIC_ID || 1);
  }

  // --- Các phương thức chuẩn baseline & PRD (tests/patient.test.js & tests/unit/patient.service.test.js) ---

  async create(patientData) {
    const existing = await this.patientRepository.findByIdentityCard(patientData.identity_card);
    if (existing) {
      throw new DuplicatePatientError(
        `Bệnh nhân có số CCCD/CMND ${patientData.identity_card} đã tồn tại ở chi nhánh ${existing.origin_clinic_id}`
      );
    }

    const createdPatient = await this.patientRepository.create(patientData);
    return typeof createdPatient.toJSON === 'function' ? createdPatient.toJSON() : createdPatient;
  }

  async findAll(filter = {}, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patients = await this.patientRepository.findAll(filter);

    return patients.map((patient) => {
      const data = typeof patient.toJSON === 'function' ? patient.toJSON() : patient;
      const isExternal = data.origin_clinic_id !== effectiveClinicId;
      return {
        ...data,
        is_external_record: isExternal
      };
    });
  }

  async findById(id, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patient = await this.patientRepository.findById(id);

    if (!patient) {
      throw new PatientNotFoundError(`Không tìm thấy hồ sơ bệnh nhân với mã ID: ${id}`);
    }

    const data = typeof patient.toJSON === 'function' ? patient.toJSON() : patient;
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

  async findByIdentityCard(identityCard, activeClinicId = null) {
    const effectiveClinicId = Number(activeClinicId || this.currentClinicId);
    const patient = await this.patientRepository.findByIdentityCard(identityCard);

    if (!patient) {
      throw new PatientNotFoundError(`Không tìm thấy hồ sơ bệnh nhân có số CCCD/CMND: ${identityCard}`);
    }

    const data = typeof patient.toJSON === 'function' ? patient.toJSON() : patient;
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

  async update(id, updateData) {
    const existing = await this.patientRepository.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(`Không tìm thấy hồ sơ bệnh nhân để cập nhật với ID: ${id}`);
    }

    if (updateData.identity_card && updateData.identity_card !== existing.identity_card) {
      const duplicate = await this.patientRepository.findByIdentityCard(updateData.identity_card);
      if (duplicate && duplicate.patient_id !== existing.patient_id) {
        throw new DuplicatePatientError(`Số CCCD/CMND ${updateData.identity_card} đã được sử dụng bởi bệnh nhân khác`);
      }
    }

    const updated = await this.patientRepository.update(id, updateData);
    return typeof updated.toJSON === 'function' ? updated.toJSON() : updated;
  }

  async remove(id) {
    const existing = await this.patientRepository.findById(id);
    if (!existing) {
      throw new PatientNotFoundError(`Không tìm thấy hồ sơ bệnh nhân để xóa với ID: ${id}`);
    }

    await this.patientRepository.delete(id);
    return {
      success: true,
      deleted_patient_id: Number(id),
      message: 'Đã xóa hồ sơ bệnh nhân thành công'
    };
  }

  // --- Các phương thức RESTful V1 ---

  async registerPatient(rawData) {
    const data = validateCreatePatient(rawData);
    const clinicId = data.origin_clinic_id;

    const existing = await this.patientRepository.findByCitizenId(clinicId, data.citizen_id);
    if (existing) {
      throw new ConflictError('Số CCCD này đã được đăng ký hồ sơ tại cơ sở!');
    }

    try {
      const createdPatient = await this.patientRepository.createPatient(clinicId, data);
      return createdPatient;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictError('Số CCCD này đã được đăng ký hồ sơ tại cơ sở!');
      }
      throw error;
    }
  }

  async getPatientByIdAndOrigin(patientId, originClinicId) {
    if (originClinicId && [1, 2].includes(Number(originClinicId))) {
      const patient = await this.patientRepository.findById(Number(originClinicId), patientId);
      if (!patient) {
        throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân với mã ${patientId} tại cơ sở ${originClinicId}`);
      }
      return patient;
    }

    const [p1, p2] = await Promise.all([
      this.patientRepository.findById(1, patientId).catch(() => null),
      this.patientRepository.findById(2, patientId).catch(() => null)
    ]);

    const found = p1 || p2;
    if (!found) {
      throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân với mã ${patientId} trong toàn hệ thống`);
    }

    return found;
  }

  async searchPatients(rawQuery = {}) {
    const validatedQuery = validatePatientSearchQuery(rawQuery);
    const { clinic_id, page, limit } = validatedQuery;

    if (clinic_id) {
      const { rows, total } = await this.patientRepository.listPatients(clinic_id, validatedQuery);
      return {
        data: rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      };
    }

    const [hanoiResult, hcmResult] = await Promise.allSettled([
      this.patientRepository.listPatients(1, validatedQuery),
      this.patientRepository.listPatients(2, validatedQuery)
    ]);

    let combinedRows = [];
    let combinedTotal = 0;

    if (hanoiResult.status === 'fulfilled') {
      combinedRows = combinedRows.concat(hanoiResult.value.rows || []);
      combinedTotal += hanoiResult.value.total || 0;
    }

    if (hcmResult.status === 'fulfilled') {
      combinedRows = combinedRows.concat(hcmResult.value.rows || []);
      combinedTotal += hcmResult.value.total || 0;
    }

    combinedRows.sort((a, b) => (b.patient_id || 0) - (a.patient_id || 0));

    return {
      data: combinedRows.slice(0, limit),
      pagination: {
        total: combinedTotal,
        page,
        limit,
        totalPages: Math.ceil(combinedTotal / limit) || 1
      }
    };
  }

  async getPatientDetail(patientId, clinicId = null) {
    return this.getPatientByIdAndOrigin(patientId, clinicId);
  }
}

PatientService.PatientService = PatientService;
PatientService.NotFoundError = PatientNotFoundError;
PatientService.DuplicatePatientError = DuplicatePatientError;

module.exports = PatientService;
module.exports.PatientService = PatientService;
module.exports.NotFoundError = PatientNotFoundError;
module.exports.DuplicatePatientError = DuplicatePatientError;
