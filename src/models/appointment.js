class Appointment {
  constructor({ appointment_id, patient_id, doctor_id, clinic_id, slot_time, status = 'Pending' }) {
    this.appointment_id = appointment_id;
    this.patient_id = patient_id;
    this.doctor_id = doctor_id;
    this.clinic_id = clinic_id;
    this.slot_time = slot_time;
    this.status = status;
  }
}

module.exports = Appointment;
