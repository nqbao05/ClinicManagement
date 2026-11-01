const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { createDatabase } = require('./config/database');
const AppointmentRepository = require('./repositories/appointmentRepository');
const { AppointmentService } = require('./services/appointmentService');
const createAppointmentRoutes = require('./routes/appointmentRoutes');
const patientRoutes = require('./routes/patient.routes');
const createAuthRoutes = require('./routes/auth.routes');
const errorHandler = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/swagger');

function createApp(options = {}) {
  const db = options.db || createDatabase();
  const repository = new AppointmentRepository(db);
  const service = new AppointmentService(repository);
  const app = express();

  // CORS Middleware: Cho phép Frontend gọi API và truyền Cookie
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

  // Phục vụ giao diện Frontend UI trực tiếp từ thư mục public/
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));

  // 1. Cổng đăng nhập phân hệ Xác thực (TV1)
  app.get('/login', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
  });

  // 2. Cổng quản lý hồ sơ bệnh án đa cơ sở (TV2, TV3, TV4)
  app.get('/patients-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // Trang chủ mặc định điều hướng tới cổng đăng nhập /login
  app.get('/', (req, res) => {
    res.redirect('/login');
  });

  // Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));

  // REST API Routes
  const authRoutes = createAuthRoutes();
  app.use('/api/v1/auth', authRoutes);
  app.use('/auth', authRoutes);
  app.use('/api', createAppointmentRoutes(service));
  app.use('/api/patients', options.patientRoutes || patientRoutes);

  // Global Error Handler
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = createApp;
