const Appointment = require('../models/appointment');

class SlotConflictError extends Error {
  constructor() {
    super('Lịch đã được người khác đặt');
    this.code = 'APPOINTMENT_SLOT_CONFLICT';
  }
}

class AppointmentService {
  constructor(repository) {
    this.repository = repository;
  }

  createBooking({ patientId, doctorId, clinicId, slotTime }) {
    const parsedTime = new Date(slotTime);
    if (!slotTime || Number.isNaN(parsedTime.getTime())) {
      const error = new Error('slotTime không hợp lệ');
      error.code = 'INVALID_SLOT_TIME';
      throw error;
    }

    const normalizedSlot = parsedTime.toISOString();
    const existing = this.repository.findActiveByDoctorAndSlot(doctorId, normalizedSlot);
    if (existing) throw new SlotConflictError();

    try {
      return this.repository.create(new Appointment({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        slot_time: normalizedSlot
      }));
    } catch (error) {
      // The unique partial index is the final safety net for concurrent requests.
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        throw new SlotConflictError();
      }
      throw error;
    }
  }
}

module.exports = { AppointmentService, SlotConflictError };
