const crypto = require('crypto');
const Booking = require('./booking.model');

class BookingConflictError extends Error {
  constructor(message = 'Khung giờ khám này đã có bệnh nhân khác đặt thành công') {
    super(message);
    this.name = 'BookingConflictError';
    this.code = 'BOOKING_SLOT_CONFLICT';
    this.statusCode = 409;
  }
}

class BookingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BookingValidationError';
    this.code = 'INVALID_BOOKING_DATA';
    this.statusCode = 400;
  }
}

class BookingService {
  constructor(repository) {
    this.repository = repository;
  }

  createBooking({ patientId, doctorId, appointmentDate, slotId }) {
    // 1. Xác thực đầu vào
    if (!patientId || typeof patientId !== 'string') {
      throw new BookingValidationError('patientId không được để trống và phải là chuỗi hợp lệ');
    }
    if (!doctorId || typeof doctorId !== 'string') {
      throw new BookingValidationError('doctorId không được để trống và phải là chuỗi hợp lệ');
    }
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      throw new BookingValidationError('appointmentDate phải có định dạng YYYY-MM-DD hợp lệ');
    }
    if (!slotId || typeof slotId !== 'string') {
      throw new BookingValidationError('slotId không được để trống và phải là chuỗi hợp lệ');
    }

    const bookingId = crypto.randomUUID();
    const newBooking = new Booking({
      booking_id: bookingId,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_date: appointmentDate,
      slot_id: slotId,
      status: 'CONFIRMED'
    });

    try {
      // 2. Thực thi Transaction khóa
      const result = this.repository.create(newBooking);
      if (!result) {
        throw new BookingConflictError(
          `Khung giờ khám (${slotId}) ngày ${appointmentDate} của bác sĩ đã có người đặt trước đó.`
        );
      }
      return result;
    } catch (error) {
      if (error instanceof BookingConflictError) {
        throw error;
      }
      // Rào chắn tầng DB: Bắt vi phạm UNIQUE INDEX nếu 2 thread chạm cùng tích tắc
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        throw new BookingConflictError(
          'Đã xảy ra xung đột đồng thời: Khung giờ này vừa được người khác đặt thành công.'
        );
      }
      throw error;
    }
  }
}

module.exports = { BookingService, BookingConflictError, BookingValidationError };

