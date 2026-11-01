/**
 * Model đại diện cho thực thể Lịch hẹn khám (Appointment Entity)
 */
class Appointment {
  constructor({
    appointment_id = null,
    patient_id,
    doctor_id,
    clinic_id,
    slot_time,
    status = 'Pending',
    created_at = null,
    doctor_name = null,
    specialty = null
  }) {
    this.appointment_id = appointment_id;
    this.patient_id = patient_id;
    this.doctor_id = doctor_id;
    this.clinic_id = clinic_id;
    this.slot_time = slot_time;
    this.status = status;
    this.created_at = created_at;
    this.doctor_name = doctor_name;
    this.specialty = specialty;
  }
}

module.exports = Appointment;
