const { BookingConflictError, BookingValidationError } = require('./booking.service');

function createBookingController(service) {
  return {
    async create(req, res, next) {
      try {
        const { patientId, doctorId, appointmentDate, slotId } = req.body || {};
        const booking = await Promise.resolve(service.createBooking({
          patientId,
          doctorId,
          appointmentDate,
          slotId
        }));
        return res.status(201).json(booking);
      } catch (error) {
        if (error instanceof BookingConflictError) {
          return res.status(409).json({
            statusCode: 409,
            code: error.code,
            message: error.message,
            error: 'Conflict'
          });
        }
        if (error instanceof BookingValidationError) {
          return res.status(400).json({
            statusCode: 400,
            code: error.code,
            message: error.message,
            error: 'Bad Request'
          });
        }
        return next(error);
      }
    }
  };
}

module.exports = createBookingController;

