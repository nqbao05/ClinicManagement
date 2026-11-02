const express = require('express');
const { createAuthController } = require('./auth.controller');
const AuthService = require('./auth.service');
const AuthRepository = require('./auth.repository');
const { authenticate } = require('../../common/middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Authentication & RBAC
 *     description: 'Xác thực người dùng, cấp phát JWT & Kiểm soát truy cập'
 * 
 * /v1/auth/login:
 *   post:
 *     tags: [Authentication & RBAC]
 *     summary: Đăng nhập hệ thống & nhận JWT Bearer Token
 *     description: 'Hỗ trợ các tài khoản mặc định: admin (Admin@123), staff_hanoi (Staff@123), staff_hcm (Staff@123), patient (Patient@123)'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: 'admin'
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 'Admin@123'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về token và vai trò người dùng
 *       400:
 *         description: Thiếu tên đăng nhập hoặc mật khẩu
 *       401:
 *         description: Tên đăng nhập hoặc mật khẩu không chính xác
 * 
 * /v1/auth/register:
 *   post:
 *     tags: [Authentication & RBAC]
 *     summary: Đăng ký tài khoản người dùng mới (Patient / Staff)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: 'nguyenvana'
 *               password:
 *                 type: string
 *                 format: password
 *                 example: 'Matkhau@123'
 *               role:
 *                 type: string
 *                 enum: [patient, staff]
 *                 default: patient
 *               clinic_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Đăng ký thành công và cấp JWT token
 *       400:
 *         description: Dữ liệu đăng ký không hợp lệ
 *       409:
 *         description: Tên đăng nhập đã tồn tại
 * 
 * /v1/auth/me:
 *   get:
 *     tags: [Authentication & RBAC]
 *     summary: Lấy thông tin tài khoản hiện tại từ JWT Bearer Token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin người dùng từ token
 *       401:
 *         description: Yêu cầu token hợp lệ hoặc token đã hết hạn
 */
function createAuthRoutes(service) {
  const router = express.Router();
  const authService = service || new AuthService(new AuthRepository());
  const controller = createAuthController(authService);

  // Tuyến công khai: Đăng nhập & Đăng ký
  router.post('/login', controller.login);
  router.post('/register', controller.register);

  // Tuyến bảo vệ: Lấy thông tin cá nhân hiện hành
  router.get('/me', authenticate, controller.me);

  return router;
}

const defaultRepository = new AuthRepository();
const defaultService = new AuthService(defaultRepository);
const defaultRouter = createAuthRoutes(defaultService);

defaultRouter.createAuthRoutes = createAuthRoutes;
defaultRouter.AuthService = AuthService;
defaultRouter.AuthRepository = AuthRepository;

module.exports = defaultRouter;
