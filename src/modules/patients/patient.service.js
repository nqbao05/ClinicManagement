const { validateCreatePatient, validatePatientSearchQuery } = require('./patient.dto');
const ConflictError = require('../../common/errors/conflict.error');
const NotFoundError = require('../../common/errors/not-found.error');

/**
 * Service Layer: Xử lý nghiệp vụ quản lý bệnh nhân, định tuyến ghi theo Sharding Key
 * và thực thi tìm kiếm phân tán chịu lỗi (Cross-Node Distributed Lookup).
 */
class PatientService {
  /**
   * @param {Object} patientRepository - Instance của PatientRepository
   */
  constructor(patientRepository) {
    this.patientRepository = patientRepository;
  }

  /**
   * Đăng ký mới hồ sơ bệnh nhân và lưu vào đúng Node CSDL theo Sharding Key
   * @param {Object} rawData - Dữ liệu client gửi lên
   * @returns {Promise<Object>} Hồ sơ bệnh nhân đã tạo
   */
  async registerPatient(rawData) {
    // 1. Xác thực và chuẩn hóa dữ liệu đầu vào theo DTO
    const data = validateCreatePatient(rawData);
    const clinicId = data.origin_clinic_id;

    // 2. Kiểm tra số CCCD đã tồn tại tại cơ sở đó chưa
    const existing = await this.patientRepository.findByCitizenId(clinicId, data.citizen_id);
    if (existing) {
      throw new ConflictError('Số CCCD này đã được đăng ký hồ sơ tại cơ sở!');
    }

    // 3. Thực thi ghi dữ liệu vào Node CSDL tương ứng
    try {
      const createdPatient = await this.patientRepository.createPatient(clinicId, data);
      return createdPatient;
    } catch (error) {
      // Bắt lỗi Unique Constraint từ MySQL (ER_DUP_ENTRY / 1062)
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictError('Số CCCD này đã được đăng ký hồ sơ tại cơ sở!');
      }
      throw error;
    }
  }

  /**
   * Tra cứu chi tiết bệnh nhân theo ID và chi nhánh gốc (Dùng cho nội bộ & TV3)
   * @param {number|string} patientId - Mã bệnh nhân
   * @param {number|string} [originClinicId] - Mã cơ sở gốc (1 hoặc 2)
   * @returns {Promise<Object>}
   */
  async getPatientByIdAndOrigin(patientId, originClinicId) {
    if (originClinicId && [1, 2].includes(Number(originClinicId))) {
      const patient = await this.patientRepository.findById(Number(originClinicId), patientId);
      if (!patient) {
        throw new NotFoundError(`Không tìm thấy hồ sơ bệnh nhân với mã ${patientId} tại cơ sở ${originClinicId}`);
      }
      return patient;
    }

    // Nếu không truyền originClinicId, quét tuần tự hoặc song song trên cả 2 node
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

  /**
   * Tra cứu danh sách bệnh nhân phân tán chịu lỗi (Cross-Node Lookup)
   * @param {Object} rawQuery - { citizen_id, phone_number, clinic_id, page, limit }
   * @returns {Promise<{ data: Array, pagination: Object }>}
   */
  async searchPatients(rawQuery = {}) {
    const validatedQuery = validatePatientSearchQuery(rawQuery);
    const { clinic_id, page, limit } = validatedQuery;

    // Kịch bản 1: Client chỉ định cụ thể chi nhánh cần truy vấn
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

    // Kịch bản 2: Client không chỉ định chi nhánh -> Quét phân tán song song đa Node (Fault-Tolerant Parallel Scan)
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

    // Sắp xếp tổng hợp giảm dần theo thời gian tạo / ID
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
}

module.exports = PatientService;
