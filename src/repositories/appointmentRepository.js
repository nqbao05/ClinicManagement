const Appointment = require('../models/appointment');

class AppointmentRepository {
  constructor(db) {
    this.db = db;
    this.createInTransaction = db.transaction((appointment) => {
      const result = this.db.prepare(`
        INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status)
        VALUES (@patient_id, @doctor_id, @clinic_id, @slot_time, @status)
      `).run({
        patient_id: appointment.patient_id,
        doctor_id: appointment.doctor_id,
        clinic_id: appointment.clinic_id,
        slot_time: appointment.slot_time,
        status: appointment.status
      });
      return new Appointment({ ...appointment, appointment_id: result.lastInsertRowid });
    });
  }

  create(appointment) {
    return this.createInTransaction(appointment);
  }

  findActiveByDoctorAndSlot(doctorId, slotTime) {
    const row = this.db.prepare(`
      SELECT appointment_id, patient_id, doctor_id, clinic_id, slot_time, status
      FROM appointments
      WHERE doctor_id = ? AND slot_time = ? AND status <> 'Cancelled'
      LIMIT 1
    `).get(doctorId, slotTime);
    return row ? new Appointment(row) : null;
  }
}

module.exports = AppointmentRepository;
