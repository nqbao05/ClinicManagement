/**
 * Unit Test Suite cho PatientService
 * Chuẩn Jest / Node Test Runner tương thích CommonJS
 * Kiểm thử chi tiết các kịch bản Gherkin từ PRD.md và quy tắc nghiệp vụ Clean Architecture
 */

const { describe, it, beforeEach } = typeof globalThis.describe !== 'undefined'
  ? globalThis
  : require('node:test');

const assert = require('node:assert/strict');

// Jest-compatible mock and assertion bridge
const jestMock = typeof globalThis.jest !== 'undefined' ? globalThis.jest : {
  fn: (impl) => {
    const fn = (...args) => {
      fn.mock.calls.push(args);
      return impl ? impl(...args) : undefined;
    };
    fn.mock = { calls: [] };
    return fn;
  }
};

const expect = typeof globalThis.expect !== 'undefined' ? globalThis.expect : (actual) => ({
  toBe: (expected) => assert.strictEqual(actual, expected),
  toEqual: (expected) => assert.deepStrictEqual(actual, expected),
  toBeDefined: () => assert.ok(actual !== undefined),
  toBeNull: () => assert.strictEqual(actual, null),
  toBeTruthy: () => assert.ok(Boolean(actual)),
  toBeFalsy: () => assert.ok(!Boolean(actual)),
  toContain: (item) => assert.ok(actual.includes(item)),
  rejects: {
    toThrow: async (expected) => {
      if (typeof actual === 'function') {
        await assert.rejects(actual, expected);
      } else {
        await assert.rejects(async () => await actual, expected);
      }
    }
  }
});

const { PatientService, NotFoundError, DuplicatePatientError } = require('../../src/services/patient.service');
const { GatewayTimeoutError } = require('../../src/repositories/patient.repository');
const Patient = require('../../src/models/patient.model');

describe('PatientService - Unit Tests (Clean Architecture & PRD Scenarios)', () => {
  let service;
  let mockRepository;

  // Dữ liệu bệnh nhân mẫu
  const samplePatientHanoi = new Patient({
    patient_id: 101,
    origin_clinic_id: 1, // Node Hà Nội
    identity_card: '001201012345',
    full_name: 'Nguyễn Văn P',
    phone_number: '0901234567',
    gender: 'Nam',
    date_of_birth: '1990-05-15',
    address: 'Hoàn Kiếm, Hà Nội',
    blood_type: 'O+',
    medical_history: 'Tiền sử dị ứng penicillin'
  });

  const samplePatientHcm = new Patient({
    patient_id: 102,
    origin_clinic_id: 2, // Node TP.HCM
    identity_card: '079201019999',
    full_name: 'Trần Thị Mai',
    phone_number: '0912345678',
    gender: 'Nu',
    date_of_birth: '1995-10-20',
    address: 'Quận 1, TP.HCM',
    blood_type: 'A+',
    medical_history: 'Không có'
  });

  beforeEach(() => {
    // Khởi tạo mock repository độc lập trước mỗi ca kiểm thử
    mockRepository = {
      findByIdentityCard: jestMock.fn(() => null),
      findById: jestMock.fn(() => null),
      findAll: jestMock.fn(() => []),
      create: jestMock.fn((data) => new Patient({ ...data, patient_id: 999 })),
      update: jestMock.fn((id, data) => new Patient({ ...samplePatientHanoi.toJSON(), ...data, patient_id: id })),
      delete: jestMock.fn(() => true)
    };

    // Khởi tạo service với chi nhánh mặc định là Node 1 (Hà Nội)
    service = new PatientService(mockRepository, { currentClinicId: 1 });
  });

  // =========================================================================
  // NHÓM 1: KIỂM THỬ TẠO MỚI BỆNH NHÂN (CREATE PATIENT)
  // =========================================================================
  describe('create()', () => {
    it('nên tạo mới hồ sơ bệnh nhân thành công và gọi repository với đúng dữ liệu', async () => {
      const newPatientData = {
        origin_clinic_id: 1,
        identity_card: '001201088888',
        full_name: 'Lê Hoàng Nam',
        phone_number: '0987654321',
        gender: 'Nam',
        blood_type: 'B+'
      };

      mockRepository.findByIdentityCard = jestMock.fn(() => null);
      mockRepository.create = jestMock.fn((data) => new Patient({ ...data, patient_id: 888 }));

      const result = await service.create(newPatientData);

      expect(result.patient_id).toBe(888);
      expect(result.full_name).toBe(newPatientData.full_name);
      expect(result.identity_card).toBe(newPatientData.identity_card);
      expect(mockRepository.create.mock.calls.length).toBe(1);
      expect(mockRepository.create.mock.calls[0][0].identity_card).toBe('001201088888');
    });

    it('nên ném lỗi DuplicatePatientError (HTTP 409) khi số CCCD đã tồn tại trong hệ thống', async () => {
      const duplicateData = {
        origin_clinic_id: 2,
        identity_card: '001201012345',
        full_name: 'Người Trùng CCCD',
        phone_number: '0900000000'
      };

      // Mock repository tìm thấy CCCD đã tồn tại ở chi nhánh 1
      mockRepository.findByIdentityCard = jestMock.fn(() => samplePatientHanoi);

      await expect(service.create(duplicateData)).rejects.toThrow(DuplicatePatientError);
      expect(mockRepository.create.mock.calls.length).toBe(0); // Đảm bảo không gọi lệnh lưu
    });
  });

  // =========================================================================
  // NHÓM 2: KIỂM THỬ SHARDING & CROSS-NODE FETCH (PRD LUỒNG 2)
  // =========================================================================
  describe('findById() - Sharding & Phân tán dữ liệu', () => {
    it('Case cùng chi nhánh (Local Record): trả về is_external_record = false khi bệnh nhân thuộc cùng node', async () => {
      mockRepository.findById = jestMock.fn(() => samplePatientHanoi); // origin_clinic_id: 1

      // Bác sĩ đang ngồi tại Node Hà Nội (clinic_id = 1)
      const result = await service.findById(101, 1);

      expect(result.patient_id).toBe(101);
      expect(result.origin_clinic_id).toBe(1);
      expect(result.is_external_record).toBe(false);
      expect(result.source_node).toBe(undefined);
    });

    it('Case liên chi nhánh (Cross-clinic Record - PRD Kịch bản 2.1): tự động gán is_external_record = true khi khác node', async () => {
      // Bệnh nhân BN101 gốc tại Hà Nội (origin_clinic_id: 1)
      mockRepository.findById = jestMock.fn(() => samplePatientHanoi);

      // Bác sĩ tại TP.HCM (clinic_id = 2) tra cứu hồ sơ này
      const result = await service.findById(101, 2);

      expect(result.patient_id).toBe(101);
      expect(result.origin_clinic_id).toBe(1);
      expect(result.is_external_record).toBe(true);
      expect(result.source_node).toBe('Node Hà Nội');
      expect(result.sync_notice).toBe('Dữ liệu được đồng bộ từ Cơ sở Hà Nội');
    });

    it('Case máy chủ chi nhánh Timeout (PRD Kịch bản 2.2): ném GatewayTimeoutError (HTTP 504) an toàn', async () => {
      // Mock repository ném lỗi Timeout kết nối mạng
      mockRepository.findById = jestMock.fn(() => {
        throw new GatewayTimeoutError('Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)');
      });

      await expect(service.findById(101, 2)).rejects.toThrow(GatewayTimeoutError);
    });
  });

  // =========================================================================
  // NHÓM 3: KIỂM THỬ TÌM KIẾM THEO CCCD & NGOẠI LỆ 404
  // =========================================================================
  describe('findByIdentityCard()', () => {
    it('nên tìm thấy bệnh nhân theo CCCD và gán cờ is_external_record chính xác', async () => {
      mockRepository.findByIdentityCard = jestMock.fn(() => samplePatientHcm); // origin_clinic_id: 2

      // Bác sĩ tại Hà Nội (clinic_id = 1) tra cứu bệnh nhân ở TP.HCM
      const result = await service.findByIdentityCard('079201019999', 1);

      expect(result.patient_id).toBe(102);
      expect(result.is_external_record).toBe(true);
      expect(result.source_node).toBe('Node TP.HCM');
    });

    it('nên ném NotFoundError (HTTP 404) khi tìm CCCD không tồn tại', async () => {
      mockRepository.findByIdentityCard = jestMock.fn(() => null);

      await expect(service.findByIdentityCard('999999999999')).rejects.toThrow(NotFoundError);
    });

    it('nên ném NotFoundError (HTTP 404) khi tìm ID không tồn tại', async () => {
      mockRepository.findById = jestMock.fn(() => null);

      await expect(service.findById(999999)).rejects.toThrow(NotFoundError);
    });
  });

  // =========================================================================
  // NHÓM 4: KIỂM THỬ DANH SÁCH, CẬP NHẬT & XÓA (FINDALL, UPDATE, REMOVE)
  // =========================================================================
  describe('findAll(), update(), remove()', () => {
    it('findAll() nên trả về danh sách bệnh nhân và gán cờ phân tán cho từng bản ghi', async () => {
      mockRepository.findAll = jestMock.fn(() => [samplePatientHanoi, samplePatientHcm]);

      // Giả sử bác sĩ đang ở TP.HCM (clinic_id = 2)
      const list = await service.findAll({}, 2);

      expect(list.length).toBe(2);
      expect(list[0].is_external_record).toBe(true);
      expect(list[1].is_external_record).toBe(false);
    });

    it('update() nên cập nhật thành công thông tin bệnh nhân', async () => {
      mockRepository.findById = jestMock.fn(() => samplePatientHanoi);
      mockRepository.update = jestMock.fn((id, data) => new Patient({ ...samplePatientHanoi.toJSON(), ...data }));

      const updated = await service.update(101, { full_name: 'Nguyễn Văn P (Cập nhật)', phone_number: '0988888888' });

      expect(updated.full_name).toBe('Nguyễn Văn P (Cập nhật)');
      expect(updated.phone_number).toBe('0988888888');
    });

    it('update() nên ném DuplicatePatientError nếu sửa CCCD trùng với người khác', async () => {
      mockRepository.findById = jestMock.fn(() => samplePatientHanoi);
      mockRepository.findByIdentityCard = jestMock.fn(() => samplePatientHcm);

      await expect(service.update(101, { identity_card: '079201019999' })).rejects.toThrow(DuplicatePatientError);
    });

    it('remove() nên xóa thành công bệnh nhân tồn tại', async () => {
      mockRepository.findById = jestMock.fn(() => samplePatientHanoi);
      mockRepository.delete = jestMock.fn(() => true);

      const result = await service.remove(101);

      expect(result.success).toBe(true);
      expect(result.deleted_patient_id).toBe(101);
      expect(mockRepository.delete.mock.calls.length).toBe(1);
    });

    it('remove() nên ném NotFoundError nếu ID không tồn tại', async () => {
      mockRepository.findById = jestMock.fn(() => null);

      await expect(service.remove(999999)).rejects.toThrow(NotFoundError);
    });
  });
});
