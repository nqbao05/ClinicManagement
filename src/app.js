const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createDatabase } = require('./config/database');
const AppointmentRepository = require('./modules/appointment/appointment.repository');
const { AppointmentService } = require('./modules/appointment/appointment.service');
const createAppointmentRoutes = require('./modules/appointment/appointment.routes');
const BookingRepository = require('./modules/booking/booking.repository');
const { BookingService } = require('./modules/booking/booking.service');
const createBookingRoutes = require('./modules/booking/booking.routes');
const errorHandler = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/swagger');

function createApp(options = {}) {
  const db = options.db || createDatabase();

  // Khởi tạo Module Appointment
  const appointmentRepository = new AppointmentRepository(db);
  const appointmentService = new AppointmentService(appointmentRepository);

  // Khởi tạo Module Booking
  const bookingRepository = new BookingRepository(db);
  const bookingService = new BookingService(bookingRepository);

  const app = express();

  app.use(express.json());
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));

  // Định tuyến các Module
  app.use('/api', createAppointmentRoutes(appointmentService));
  app.use('/api', createBookingRoutes(bookingService));

  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = createApp;
