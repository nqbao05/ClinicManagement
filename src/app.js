const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { createDatabase } = require('./config/database');
const AppointmentRepository = require('./repositories/appointmentRepository');
const { AppointmentService } = require('./services/appointmentService');
const createAppointmentRoutes = require('./routes/appointmentRoutes');
const errorHandler = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/swagger');

function createApp(options = {}) {
  const db = options.db || createDatabase();
  const repository = new AppointmentRepository(db);
  const service = new AppointmentService(repository);
  const app = express();

  app.use(express.json());
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));
  app.use('/api', createAppointmentRoutes(service));
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = createApp;
