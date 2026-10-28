const Booking = require('../models/booking');

class BookingRepository {
  constructor(db) {
    this.db = db;

    // Transaction SQLite với khóa IMMEDIATE (Pessimistic Write Lock)
    this.createWithLock = this.db.transaction((booking) => {
      // 1. Kiểm tra slot đã tồn tại trong phạm vi Transaction
      const existing = this.db.prepare(`
        SELECT booking_id, patient_id, doctor_id, appointment_date, slot_id, status, created_at
        FROM bookings
        WHERE doctor_id = ? AND appointment_date = ? AND slot_id = ? AND status <> 'CANCELLED'
        LIMIT 1
      `).get(booking.doctor_id, booking.appointment_date, booking.slot_id);

      if (existing) {
        return null; // Đã bị chiếm trước
      }

      // 2. Chèn bản ghi mới
      this.db.prepare(`
        INSERT INTO bookings (booking_id, patient_id, doctor_id, appointment_date, slot_id, status, created_at)
        VALUES (@booking_id, @patient_id, @doctor_id, @appointment_date, @slot_id, @status, @created_at)
      `).run({
        booking_id: booking.booking_id,
        patient_id: booking.patient_id,
        doctor_id: booking.doctor_id,
        appointment_date: booking.appointment_date,
        slot_id: booking.slot_id,
        status: booking.status,
        created_at: booking.created_at
      });

      return new Booking(booking);
    });
  }

  findBySlot(doctorId, appointmentDate, slotId) {
    const row = this.db.prepare(`
      SELECT booking_id, patient_id, doctor_id, appointment_date, slot_id, status, created_at
      FROM bookings
      WHERE doctor_id = ? AND appointment_date = ? AND slot_id = ? AND status <> 'CANCELLED'
      LIMIT 1
    `).get(doctorId, appointmentDate, slotId);
    return row ? new Booking(row) : null;
  }

  create(booking) {
    return this.createWithLock(booking);
  }
}

module.exports = BookingRepository;

