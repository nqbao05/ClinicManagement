const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { createDatabase } = require('./config/database');
const AppointmentRepository = require('./repositories/appointmentRepository');
const { AppointmentService } = require('./services/appointmentService');
const createAppointmentRoutes = require('./routes/appointmentRoutes');
const patientRoutes = require('./routes/patient.routes');
const errorHandler = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/swagger');

function createApp(options = {}) {
  const db = options.db || createDatabase();
  const repository = new AppointmentRepository(db);
  const service = new AppointmentService(repository);
  const app = express();

  // CORS Middleware: Cho phép Frontend (http://localhost:3000) gọi API và truyền Cookie
  app.use((req, res, next) => {
    const origin = req.headers.origin || 'http://localhost:3000';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Phục vụ giao diện Frontend UI trực tiếp trên trình duyệt
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('/patients-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
  app.get('/', (req, res) => {
    res.redirect('/patients-ui');
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));
  app.use('/api', createAppointmentRoutes(service));
  app.use('/api/patients', options.patientRoutes || patientRoutes);
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = createApp;
