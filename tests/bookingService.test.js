const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const {
  BookingService,
  BookingConflictError,
  BookingValidationError
} = require('../src/services/bookingService');
const createBookingController = require('../src/controllers/bookingController');

// Jest-compatible expect helper sử dụng node:assert
const expect = (actual) => ({
  toBeDefined: () => assert.ok(actual !== undefined && actual !== null),
  toBe: (expected) => assert.strictEqual(actual, expected),
  toEqual: (expected) => assert.deepStrictEqual(actual, expected),
  toContain: (substring) => assert.ok(String(actual).includes(substring)),
  toBeInstanceOf: (cls) => assert.ok(actual instanceof cls),
  toHaveBeenCalled: () => assert.ok(actual.mock.callCount() > 0),
  toHaveBeenCalledTimes: (n) => assert.strictEqual(actual.mock.callCount(), n),
  toHaveBeenCalledWith: (...args) => {
    assert.ok(actual.mock.callCount() > 0, 'Expected function to have been called');
    const lastCall = actual.mock.calls[actual.mock.calls.length - 1];
    assert.deepStrictEqual(lastCall.arguments[0], args[0]);
  },
  not: {
    toHaveBeenCalled: () => assert.strictEqual(actual.mock.callCount(), 0)
  }
});

// Jest-like mock function helper
const fn = (implementation) => {
  return mock.fn(implementation);
};

describe('BookingService (Unit Tests)', () => {
  let mockRepository;
  let bookingService;

  beforeEach(() => {
    // Mock Repository Layer
    mockRepository = {
      create: fn()
    };
    bookingService = new BookingService(mockRepository);
  });

  afterEach(() => {
    mock.reset();
  });

  describe('1. Thành công (Happy Path)', () => {
    it('đặt lịch thành công khi khung giờ còn trống và trả về thông tin booking', () => {
      const validBookingInput = {
        patientId: 'patient-uuid-123',
        doctorId: 'doctor-uuid-456',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900-1000'
      };

      // Giả lập Repository lưu thành công
      mockRepository.create = fn((booking) => ({
        booking_id: booking.booking_id,
        patient_id: booking.patient_id,
        doctor_id: booking.doctor_id,
        appointment_date: booking.appointment_date,
        slot_id: booking.slot_id,
        status: 'CONFIRMED',
        created_at: new Date().toISOString()
      }));
      bookingService.repository = mockRepository;

      const result = bookingService.createBooking(validBookingInput);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.booking_id).toBeDefined();
      expect(result.patient_id).toBe(validBookingInput.patientId);
      expect(result.doctor_id).toBe(validBookingInput.doctorId);
      expect(result.appointment_date).toBe(validBookingInput.appointmentDate);
      expect(result.slot_id).toBe(validBookingInput.slotId);
      expect(result.status).toBe('CONFIRMED');
    });
  });

  describe('2. Trùng lịch (409 Conflict)', () => {
    it('ném lỗi BookingConflictError (409) khi repository trả về false (đã có người đặt)', () => {
      const bookingInput = {
        patientId: 'patient-uuid-2',
        doctorId: 'doctor-uuid-456',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900-1000'
      };

      mockRepository.create = fn(() => false);
      bookingService.repository = mockRepository;

      assert.throws(
        () => bookingService.createBooking(bookingInput),
        (error) => {
          expect(error).toBeInstanceOf(BookingConflictError);
          expect(error.statusCode).toBe(409);
          expect(error.code).toBe('BOOKING_SLOT_CONFLICT');
          return true;
        }
      );
    });

    it('ném lỗi BookingConflictError (409) khi xảy ra SQLITE_CONSTRAINT_UNIQUE đồng thời', () => {
      const bookingInput = {
        patientId: 'patient-uuid-3',
        doctorId: 'doctor-uuid-456',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900-1000'
      };

      const dbConstraintError = new Error('UNIQUE constraint failed');
      dbConstraintError.code = 'SQLITE_CONSTRAINT_UNIQUE';
      mockRepository.create = fn(() => {
        throw dbConstraintError;
      });
      bookingService.repository = mockRepository;

      assert.throws(
        () => bookingService.createBooking(bookingInput),
        (error) => {
          expect(error.statusCode).toBe(409);
          expect(error.message).toContain('xung đột đồng thời');
          return true;
        }
      );
    });
  });

  describe('3. Dữ liệu không hợp lệ (400 Bad Request)', () => {
    it('ném lỗi BookingValidationError (400) khi thiếu doctorId', () => {
      const invalidInput = {
        patientId: 'patient-uuid-123',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900-1000'
      };

      assert.throws(
        () => bookingService.createBooking(invalidInput),
        (error) => {
          expect(error).toBeInstanceOf(BookingValidationError);
          expect(error.statusCode).toBe(400);
          expect(error.code).toBe('INVALID_BOOKING_DATA');
          expect(error.message).toContain('doctorId');
          return true;
        }
      );

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('ném lỗi BookingValidationError (400) khi thiếu appointmentDate', () => {
      const invalidInput = {
        patientId: 'patient-uuid-123',
        doctorId: 'doctor-uuid-456',
        slotId: 'slot-0900-1000'
      };

      assert.throws(
        () => bookingService.createBooking(invalidInput),
        (error) => {
          expect(error.statusCode).toBe(400);
          expect(error.message).toContain('appointmentDate');
          return true;
        }
      );
    });

    it('ném lỗi BookingValidationError (400) khi appointmentDate sai định dạng', () => {
      const invalidDateInput = {
        patientId: 'patient-uuid-123',
        doctorId: 'doctor-uuid-456',
        appointmentDate: '01/11/2026',
        slotId: 'slot-0900-1000'
      };

      assert.throws(
        () => bookingService.createBooking(invalidDateInput),
        BookingValidationError
      );
    });
  });
});

describe('bookingController (Unit Tests with Mocked Service)', () => {
  let mockService;
  let controller;
  let resStatus;
  let resJson;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockService = {
      createBooking: fn()
    };
    controller = createBookingController(mockService);

    resStatus = null;
    resJson = null;
    mockRes = {
      status: fn(function (code) {
        resStatus = code;
        return this;
      }),
      json: fn(function (data) {
        resJson = data;
        return this;
      })
    };
    mockNext = fn();
  });

  afterEach(() => {
    mock.reset();
  });

  it('trả về HTTP 201 Created khi đặt lịch thành công', async () => {
    const bookingResult = {
      booking_id: 'bk-uuid-999',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      appointment_date: '2026-11-01',
      slot_id: 'slot-0900',
      status: 'CONFIRMED'
    };

    mockService.createBooking = fn(() => bookingResult);
    controller = createBookingController(mockService);

    const mockReq = {
      body: {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900'
      }
    };

    await controller.create(mockReq, mockRes, mockNext);

    expect(resStatus).toBe(201);
    expect(resJson).toEqual(bookingResult);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('trả về HTTP 409 Conflict khi bị trùng khung giờ khám', async () => {
    mockService.createBooking = fn(() => {
      throw new BookingConflictError('Khung giờ khám này đã có người đặt trước đó.');
    });
    controller = createBookingController(mockService);

    const mockReq = {
      body: {
        patientId: 'patient-2',
        doctorId: 'doctor-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900'
      }
    };

    await controller.create(mockReq, mockRes, mockNext);

    expect(resStatus).toBe(409);
    expect(resJson.statusCode).toBe(409);
    expect(resJson.code).toBe('BOOKING_SLOT_CONFLICT');
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('trả về HTTP 400 Bad Request khi thiếu thông tin hoặc sai format', async () => {
    mockService.createBooking = fn(() => {
      throw new BookingValidationError('doctorId không được để trống và phải là chuỗi hợp lệ');
    });
    controller = createBookingController(mockService);

    const mockReq = {
      body: {
        patientId: 'patient-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900'
      }
    };

    await controller.create(mockReq, mockRes, mockNext);

    expect(resStatus).toBe(400);
    expect(resJson.statusCode).toBe(400);
    expect(resJson.code).toBe('INVALID_BOOKING_DATA');
    expect(mockNext).not.toHaveBeenCalled();
  });
});
