const express = require('express');
const AuthController = require('./auth.controller');
const AuthService = require('./auth.service');
const AuthRepository = require('./auth.repository');

/**
 * @swagger
 * tags:
 *   - name: Authentication (TV1 - Portal & RBAC)
 *     description: 'Cổng đăng nhập, cấp JWT Access Token và phân quyền vai trò Bác sĩ/Admin/Bệnh nhân (Thành viên 1)'
 * 
 * /v1/auth/login:
 *   post:
 *     tags: [Authentication (TV1 - Portal & RBAC)]
 *     summary: Đăng nhập hệ thống và cấp Access Token phân quyền
 *     description: Tiếp nhận thông tin định danh và mật khẩu, kiểm tra Brute-Force lockout sau 5 lần nhập sai và cấp Token JWT 15 phút.
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
 *                 example: 'bacsi.nguyenvana@clinic.vn'
 *               password:
 *                 type: string
 *                 example: 'DoctorSecret@2026'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công và cấp Access Token
 *       400:
 *         description: Thiếu thông tin đăng nhập
 *       401:
 *         description: Sai thông tin tài khoản hoặc mật khẩu
 *       423:
 *         description: Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần
 * 
 * /v1/auth/logout:
 *   post:
 *     tags: [Authentication (TV1 - Portal & RBAC)]
 *     summary: Đăng xuất và xóa phiên làm việc
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
function createAuthV1Routes(options = {}) {
  const repository = options.repository || new AuthRepository();
  const service = options.service || new AuthService(repository);
  const controller = options.controller || new AuthController(service);

  const router = express.Router();

  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', controller.getMe);

  return router;
}

module.exports = {
  createAuthV1Routes
};

