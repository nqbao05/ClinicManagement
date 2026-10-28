const { SlotConflictError } = require('../services/appointmentService');

function createAppointmentController(service) {
  return {
    async create(req, res, next) {
      try {
        const appointment = await Promise.resolve(service.createBooking({
          patientId: req.body.patientId,
          doctorId: req.body.doctorId,
          clinicId: req.body.clinicId,
          slotTime: req.body.slotTime
        }));
        res.status(201).json(appointment);
      } catch (error) {
        if (error instanceof SlotConflictError) {
          return res.status(409).json({ code: error.code, message: error.message });
        }
        if (error.code === 'INVALID_SLOT_TIME') {
          return res.status(400).json({ code: error.code, message: error.message });
        }
        return next(error);
      }
    }
  };
}

module.exports = createAppointmentController;
