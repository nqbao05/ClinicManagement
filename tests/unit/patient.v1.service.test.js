const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateCreatePatient, validatePatientSearchQuery } = require('../../src/modules/patients/patient.dto');
const PatientService = require('../../src/modules/patients/patient.service');
const BadRequestError = require('../../src/common/errors/bad-request.error');
const ConflictError = require('../../src/common/errors/conflict.error');
const NotFoundError = require('../../src/common/errors/not-found.error');

describe('Patient V1 Module - Unit Tests (Clean Architecture & Horizontal Sharding)', () => {
  describe('patient.dto.js - Validation Rules', () => {
    it('từ chối khi thiếu họ và tên hoặc ít hơn 2 ký tự', () => {
      assert.throws(
        () => validateCreatePatient({ full_name: ' ' }),
        (err) => err instanceof BadRequestError && err.statusCode === 400
      );
    });

    it('từ chối khi citizen_id không đúng 12 chữ số', () => {
      assert.throws(
        () => validateCreatePatient({ full_name: 'Nguyễn Văn A', citizen_id: '123456789' }),
        (err) => err instanceof BadRequestError && err.message.includes('12 chữ số')
      );
      assert.throws(
        () => validateCreatePatient({ full_name: 'Nguyễn Văn A', citizen_id: '12345678901a' }),
        (err) => err instanceof BadRequestError
      );
    });

    it('từ chối khi phone_number không phải số di động Việt Nam (10 số, bắt đầu bằng 0)', () => {
      assert.throws(
        () => validateCreatePatient({
          full_name: 'Nguyễn Văn A',
          citizen_id: '001200001234',
          phone_number: '1234567890' // không bắt đầu bằng 0
        }),
        (err) => err instanceof BadRequestError && err.message.includes('phone_number')
      );
      assert.throws(
        () => validateCreatePatient({
          full_name: 'Nguyễn Văn A',
          citizen_id: '001200001234',
          phone_number: '091234567' // 9 số
        }),
        (err) => err instanceof BadRequestError
      );
    });

    it('từ chối khi origin_clinic_id không phải 1 hoặc 2', () => {
      assert.throws(
        () => validateCreatePatient({
          full_name: 'Nguyễn Văn A',
          citizen_id: '001200001234',
          phone_number: '0912345678',
          origin_clinic_id: 3
        }),
        (err) => err instanceof BadRequestError && err.message.includes('origin_clinic_id')
      );
    });

    it('từ chối khi date_of_birth ở tương lai hoặc sai định dạng', () => {
      assert.throws(
        () => validateCreatePatient({
          full_name: 'Nguyễn Văn A',
          citizen_id: '001200001234',
          phone_number: '0912345678',
          origin_clinic_id: 1,
          date_of_birth: '2099-01-01'
        }),
        (err) => err instanceof BadRequestError && err.message.includes('nhỏ hơn ngày hiện tại')
      );
    });

    it('chuẩn hóa thành công dữ liệu hợp lệ', () => {
      const valid = validateCreatePatient({
        full_name: '  Trần Thị B  ',
        citizen_id: '079200009876',
        phone_number: '0987654321',
        origin_clinic_id: 2,
        date_of_birth: '1998-10-12',
        gender: 'Female',
        address: 'Quận 1, TP.HCM'
      });

      assert.strictEqual(valid.full_name, 'Trần Thị B');
      assert.strictEqual(valid.citizen_id, '079200009876');
      assert.strictEqual(valid.phone_number, '0987654321');
      assert.strictEqual(valid.origin_clinic_id, 2);
      assert.strictEqual(valid.gender, 'Female');
      assert.strictEqual(valid.address, 'Quận 1, TP.HCM');
    });

    it('validatePatientSearchQuery tính toán phân trang mặc định chính xác', () => {
      const q = validatePatientSearchQuery({});
      assert.strictEqual(q.page, 1);
      assert.strictEqual(q.limit, 20);
      assert.strictEqual(q.offset, 0);
    });
  });

  describe('patient.service.js - Business Logic & Cross-Node Routing', () => {
    it('đăng ký bệnh nhân thành công và định tuyến vào đúng Sharding Node', async () => {
      let createdClinicId = null;
      const mockRepo = {
        async findByCitizenId(clinicId, citizenId) {
          return null;
        },
        async createPatient(clinicId, data) {
          createdClinicId = clinicId;
          return { patient_id: 101, ...data };
        }
      };

      const service = new PatientService(mockRepo);
      const result = await service.registerPatient({
        full_name: 'Lê Văn C',
        citizen_id: '001200005555',
        phone_number: '0901234567',
        origin_clinic_id: 1,
        date_of_birth: '1992-04-15'
      });

      assert.strictEqual(result.patient_id, 101);
      assert.strictEqual(createdClinicId, 1);
      assert.strictEqual(result.full_name, 'Lê Văn C');
    });

    it('chặn đăng ký trùng CCCD tại cơ sở và ném ConflictError (409)', async () => {
      const mockRepo = {
        async findByCitizenId(clinicId, citizenId) {
          return { patient_id: 1, citizen_id: citizenId };
        }
      };

      const service = new PatientService(mockRepo);
      await assert.rejects(
        () => service.registerPatient({
          full_name: 'Lê Văn C',
          citizen_id: '001200005555',
          phone_number: '0901234567',
          origin_clinic_id: 1,
          date_of_birth: '1992-04-15'
        }),
        (err) => err instanceof ConflictError && err.statusCode === 409
      );
    });

    it('tìm kiếm Cross-Node quét song song cả 2 cơ sở khi không truyền clinic_id', async () => {
      const mockRepo = {
        async listPatients(clinicId, filters) {
          if (clinicId === 1) {
            return {
              rows: [{ patient_id: 1, full_name: 'Bệnh nhân Hà Nội', origin_clinic_id: 1 }],
              total: 1
            };
          }
          return {
            rows: [{ patient_id: 2, full_name: 'Bệnh nhân TP.HCM', origin_clinic_id: 2 }],
            total: 1
          };
        }
      };

      const service = new PatientService(mockRepo);
      const res = await service.searchPatients({});

      assert.strictEqual(res.data.length, 2);
      assert.strictEqual(res.pagination.total, 2);
      assert.strictEqual(res.pagination.totalPages, 1);
    });

    it('ném NotFoundError khi tra cứu ID không tồn tại', async () => {
      const mockRepo = {
        async findById(clinicId, id) {
          return null;
        }
      };

      const service = new PatientService(mockRepo);
      await assert.rejects(
        () => service.getPatientByIdAndOrigin(999, 1),
        (err) => err instanceof NotFoundError && err.statusCode === 404
      );
    });
  });
});
