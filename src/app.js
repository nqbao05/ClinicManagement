const express = require('express');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const { createDatabase } = require('./config/database');
const {
  createAppointmentRoutes,
  createAppointmentV1Routes,
  AppointmentService,
  AppointmentRepository
} = require('./modules/appointments/appointment.routes');
const {
  createPatientRoutes,
  createPatientV1Routes
} = require('./modules/patients/patient.routes');
const appointmentV1Routes = require('./modules/appointments/appointment.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const patientV1Routes = require('./modules/patients/patient.routes');
const clinicRoutes = require('./modules/clinics/clinic.routes');
const doctorRoutes = require('./modules/doctors/doctor.routes');
const authRoutes = require('./modules/auth/auth.routes');
const errorHandler = require('./common/middlewares/error.middleware');
const NotFoundError = require('./common/errors/not-found.error');
const swaggerDocument = require('./config/swagger');

/**
 * Khởi tạo ứng dụng Express chuẩn Clean Architecture & Modular Monolith
 * @param {Object} [options]
 * @returns {import('express').Express}
 */
function createApp(options = {}) {
  const db = options.db || createDatabase();
  const repository = new AppointmentRepository(db);
  const service = new AppointmentService(repository);
  const app = express();

  // 1. CORS Middleware: Cho phép Frontend gọi API và truyền Cookie
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

  // 2. Parse Body Payloads: JSON & URL-encoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. Phục vụ giao diện Frontend UI trực tiếp từ thư mục public/
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));

  // Giao diện tĩnh: Quản lý Bác sĩ & Chi nhánh (TV1)
  app.get('/doctors', (req, res) => {
    res.sendFile(path.join(publicDir, 'doctors.html'));
  });
  app.get('/doctors-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'doctors.html'));
  });

  // Giao diện tĩnh: Hồ sơ Bệnh nhân (TV2)
  app.get('/patients', (req, res) => {
    res.sendFile(path.join(publicDir, 'patients.html'));
  });
  app.get('/patients-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'patients.html'));
  });

  // Giao diện tĩnh: Đặt lịch khám (TV3)
  app.get('/appointments', (req, res) => {
    res.sendFile(path.join(publicDir, 'appointments.html'));
  });
  app.get('/appointments-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'appointments.html'));
  });

  // Giao diện tĩnh: Báo cáo Thống kê Đa Node (TV4)
  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(publicDir, 'dashboard.html'));
  });
  app.get('/dashboard-ui', (req, res) => {
    res.sendFile(path.join(publicDir, 'dashboard.html'));
  });

  // Cổng điều hướng gốc (Root Portal)
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // 4. OpenAPI / Swagger Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/openapi.json', (req, res) => res.json(swaggerDocument));

  // 5. RESTful API Routes V1
  app.use('/api/v1/auth', options.authRoutes || authRoutes);
  app.use('/api/v1/clinics', options.clinicRoutes || clinicRoutes);
  app.use('/api/v1/doctors', options.doctorRoutes || doctorRoutes);
  app.use('/api/v1/patients', options.patientV1Routes || patientV1Routes);
  app.use('/api/v1/appointments', options.appointmentV1Routes || appointmentV1Routes);
  app.use('/api/v1/admin/dashboard', options.dashboardRoutes || dashboardRoutes);

  // Tuyến tương thích ngược cho các bài test baseline
  app.use('/api', createAppointmentRoutes(service));
  app.use('/api/patients', options.patientRoutes || createPatientRoutes());

  // 6. 404 Route Handler cho các endpoint API không tồn tại
  app.use('/api', (req, res, next) => {
    next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} không tồn tại trên hệ thống`));
  });

  // 7. Error Middleware: Đặt ở cuối cùng của pipeline Express
  app.use(errorHandler);

  app.locals.db = db;
  return app;
}

module.exports = createApp;
