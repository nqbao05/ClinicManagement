class Booking {
  constructor({
    booking_id,
    patient_id,
    doctor_id,
    appointment_date,
    slot_id,
    status = 'CONFIRMED',
    created_at = new Date().toISOString()
  }) {
    this.booking_id = booking_id;
    this.patient_id = patient_id;
    this.doctor_id = doctor_id;
    this.appointment_date = appointment_date;
    this.slot_id = slot_id;
    this.status = status;
    this.created_at = created_at;
  }
}

module.exports = Booking;

