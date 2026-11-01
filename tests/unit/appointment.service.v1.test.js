process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = typeof globalThis.describe !== 'undefined'
  ? globalThis
  : require('node:test');

const assert = require('node:assert/strict');
const { validateCreateAppointment, validateAppointmentQuery } = require('../../src/modules/appointments/appointment.dto');
const AppointmentService = require('../../src/modules/appointments/appointment.service');
const BadRequestError = require('../../src/common/errors/bad-request.error');
const NotFoundError = require('../../src/common/errors/not-found.error');
const ConflictError = require('../../src/common/errors/conflict.error');

describe('Appointment V1 Module - Unit Tests (Clean Architecture & Concurrency Control)', () => {
  describe('appointment.dto.js - Validation Rules', () => {
    it('nên từ chối khi thiếu các trường bắt buộc', () => {
      assert.throws(() => validateCreateAppointment({}), BadRequestError);
      assert.throws(() => validateCreateAppointment({ patient_id: 1 }), BadRequestError);
      assert.throws(() => validateCreateAppointment({ patient_id: 1, doctor_id: 1 }), BadRequestError);
    });

    it('nên từ chối khi clinic_id không phải là 1 hoặc 2', () => {
      assert.throws(() => validateCreateAppointment({
        patient_id: 1,
        doctor_id: 1,
        clinic_id: 3,
        slot_time: '2027-01-01T09:00:00'
      }), {
        message: /clinic_id là bắt buộc và chỉ chấp nhận 1.*hoặc 2/
      });
    });

    it('nên từ chối khi slot_time ở quá khứ', () => {
      assert.throws(() => validateCreateAppointment({
        patient_id: 1,
        doctor_id: 1,
        clinic_id: 1,
        slot_time: '2020-01-01T09:00:00'
      }), {
        message: /thời điểm tương lai/
      });
    });

    it('nên từ chối khi khung giờ ngoài giờ hành chính (08:00 - 11:30 và 13:30 - 17:00)', () => {
      // 12:00 trưa (giờ nghỉ)
      assert.throws(() => validateCreateAppointment({
        patient_id: 1,
        doctor_id: 1,
        clinic_id: 1,
        slot_time: '2027-01-01T12:00:00'
      }), {
        message: /giờ hành chính/
      });

      // 20:00 tối
      assert.throws(() => validateCreateAppointment({
        patient_id: 1,
        doctor_id: 1,
        clinic_id: 1,
        slot_time: '2027-01-01T20:00:00'
      }), {
        message: /giờ hành chính/
      });
    });

    it('nên từ chối khi số phút không phải bội số của 15 hoặc 30', () => {
      assert.throws(() => validateCreateAppointment({
        patient_id: 1,
        doctor_id: 1,
        clinic_id: 1,
        slot_time: '2027-01-01T09:17:00'
      }), {
        message: /bội số của 15 hoặc 30 phút/
      });
    });

    it('nên chấp nhận dữ liệu hợp lệ trong giờ làm việc với phút chuẩn (00, 15, 30, 45)', () => {
      const valid = validateCreateAppointment({
        patient_id: 101,
        doctor_id: 2,
        clinic_id: 1,
        slot_time: '2027-05-10T09:30:00'
      });
      assert.equal(valid.patient_id, 101);
      assert.equal(valid.doctor_id, 2);
      assert.equal(valid.clinic_id, 1);
      assert.equal(valid.slot_time, '2027-05-10 09:30:00');
    });

    it('validateAppointmentQuery nên lọc và kiểm tra hợp lệ các tham số phân trang', () => {
      const parsed = validateAppointmentQuery({
        status: 'Pending',
        doctor_id: '3',
        clinic_id: '2',
        date: '2027-05-10',
        page: '2',
        limit: '10'
      });
      assert.equal(parsed.status, 'Pending');
      assert.equal(parsed.doctor_id, 3);
      assert.equal(parsed.clinic_id, 2);
      assert.equal(parsed.date, '2027-05-10');
      assert.equal(parsed.page, 2);
      assert.equal(parsed.limit, 10);
      assert.equal(parsed.offset, 10);
    });
  });

  describe('appointment.service.js - Business Logic & Concurrency Protection', () => {
    let mockRepository;
    let service;

    beforeEach(() => {
      mockRepository = {
        findDoctorById: async (clinicId, doctorId) => ({
          doctor_id: doctorId,
          clinic_id: clinicId,
          full_name: 'BS. Test',
          specialty: 'Tim Mạch'
        }),
        checkPatientDoubleBooking: async () => false,
        createAppointmentWithTransaction: async (clinicId, data) => ({
          appointment_id: 999,
          patient_id: data.patient_id,
          doctor_id: data.doctor_id,
          clinic_id: clinicId,
          slot_time: data.slot_time,
          status: 'Pending'
        }),
        findAppointments: async () => ({ rows: [], total: 0 })
      };
      service = new AppointmentService(mockRepository);
    });

    it('nên ném NotFoundError (HTTP 404) nếu bác sĩ không tồn tại tại chi nhánh tiếp nhận', async () => {
      mockRepository.findDoctorById = async () => null;

      await assert.rejects(
        () => service.bookAppointment({
          patient_id: 1,
          doctor_id: 99,
          clinic_id: 1,
          slot_time: '2027-05-10 09:00:00'
        }),
        NotFoundError
      );
    });

    it('nên ném ConflictError (HTTP 409) nếu bệnh nhân bị trùng ca khám trong cùng khung giờ', async () => {
      mockRepository.checkPatientDoubleBooking = async () => true;

      await assert.rejects(
        () => service.bookAppointment({
          patient_id: 1,
          doctor_id: 2,
          clinic_id: 1,
          slot_time: '2027-05-10 09:00:00'
        }),
        ConflictError
      );
    });

    it('nên ném ConflictError (HTTP 409) khi CSDL kích hoạt ràng buộc UNIQUE_DOCTOR_SLOT (Race Condition Fallback)', async () => {
      mockRepository.createAppointmentWithTransaction = async () => {
        const dbError = new Error('Duplicate entry for key unique_doctor_slot');
        dbError.code = 'ER_DUP_ENTRY';
        dbError.errno = 1062;
        throw dbError;
      };

      await assert.rejects(
        () => service.bookAppointment({
          patient_id: 1,
          doctor_id: 2,
          clinic_id: 1,
          slot_time: '2027-05-10 09:00:00'
        }),
        {
          name: 'ConflictError',
          message: /Khung giờ này của bác sĩ vừa được một người khác hoàn tất đặt trước!/
        }
      );
    });

    it('nên đặt lịch thành công và trả về thông tin ca khám cùng bác sĩ tiếp nhận', async () => {
      const result = await service.bookAppointment({
        patient_id: 101,
        doctor_id: 1,
        clinic_id: 1,
        slot_time: '2027-05-10 09:00:00'
      });

      assert.equal(result.appointment_id, 999);
      assert.equal(result.doctor_name, 'BS. Test');
      assert.equal(result.specialty, 'Tim Mạch');
      assert.equal(result.status, 'Pending');
    });

    it('getAppointments nên tính toán metadata phân trang chính xác', async () => {
      mockRepository.findAppointments = async (clinicId, query) => ({
        rows: [{ appointment_id: 1 }],
        total: 25
      });

      const res = await service.getAppointments(1, { page: 1, limit: 10 });
      assert.equal(res.data.length, 1);
      assert.equal(res.pagination.total, 25);
      assert.equal(res.pagination.totalPages, 3);
      assert.equal(res.pagination.hasNext, true);
      assert.equal(res.pagination.hasPrev, false);
    });
  });
});
