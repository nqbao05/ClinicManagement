const test = require('node:test');
const assert = require('node:assert/strict');
const Booking = require('../src/models/booking');
const BookingRepository = require('../src/repositories/bookingRepository');
const { BookingService, BookingConflictError, BookingValidationError } = require('../src/services/bookingService');
const createBookingController = require('../src/controllers/bookingController');
const { createDatabase } = require('../src/config/database');

test('BookingService creates booking successfully', () => {
  const db = createDatabase(':memory:');
  const repo = new BookingRepository(db);
  const service = new BookingService(repo);

  const result = service.createBooking({
    patientId: 'patient-uuid-1',
    doctorId: 'doctor-uuid-1',
    appointmentDate: '2026-11-01',
    slotId: 'slot-0900'
  });

  assert.ok(result.booking_id);
  assert.equal(result.patient_id, 'patient-uuid-1');
  assert.equal(result.doctor_id, 'doctor-uuid-1');
  assert.equal(result.appointment_date, '2026-11-01');
  assert.equal(result.slot_id, 'slot-0900');
  assert.equal(result.status, 'CONFIRMED');
});

test('BookingService rejects duplicate booking of same doctor, date and slot with 409 Conflict', () => {
  const db = createDatabase(':memory:');
  const repo = new BookingRepository(db);
  const service = new BookingService(repo);

  service.createBooking({
    patientId: 'patient-uuid-1',
    doctorId: 'doctor-uuid-1',
    appointmentDate: '2026-11-01',
    slotId: 'slot-0900'
  });

  assert.throws(
    () => {
      service.createBooking({
        patientId: 'patient-uuid-2',
        doctorId: 'doctor-uuid-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-0900'
      });
    },
    (err) => err instanceof BookingConflictError && err.statusCode === 409
  );
});

test('BookingService rejects invalid date format with 400 Validation Error', () => {
  const db = createDatabase(':memory:');
  const repo = new BookingRepository(db);
  const service = new BookingService(repo);

  assert.throws(
    () => {
      service.createBooking({
        patientId: 'patient-uuid-1',
        doctorId: 'doctor-uuid-1',
        appointmentDate: '01-11-2026', // Sai định dạng
        slotId: 'slot-0900'
      });
    },
    (err) => err instanceof BookingValidationError && err.statusCode === 400
  );
});

test('BookingController handles create and error codes properly', async () => {
  const db = createDatabase(':memory:');
  const repo = new BookingRepository(db);
  const service = new BookingService(repo);
  const controller = createBookingController(service);

  // Mock res & req
  let resStatus = 0;
  let resJson = null;
  const mockRes = {
    status(code) {
      resStatus = code;
      return this;
    },
    json(data) {
      resJson = data;
      return this;
    }
  };

  await controller.create(
    {
      body: {
        patientId: 'p-1',
        doctorId: 'd-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-1'
      }
    },
    mockRes,
    () => {}
  );
  assert.equal(resStatus, 201);
  assert.equal(resJson.status, 'CONFIRMED');

  // Request trùng
  await controller.create(
    {
      body: {
        patientId: 'p-2',
        doctorId: 'd-1',
        appointmentDate: '2026-11-01',
        slotId: 'slot-1'
      }
    },
    mockRes,
    () => {}
  );
  assert.equal(resStatus, 409);
  assert.equal(resJson.code, 'BOOKING_SLOT_CONFLICT');
});
