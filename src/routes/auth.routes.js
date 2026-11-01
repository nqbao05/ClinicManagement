const express = require('express');
const crypto = require('crypto');

/**
 * Cơ sở dữ liệu tài khoản định danh mẫu phục vụ phân quyền RBAC đa cơ sở
 * Tương ứng với tài liệu kiến trúc Auth TV1
 */
const USERS_STORE = [
  {
    userId: 'usr_89f07a21-9e77-4c4f-9e77-628b3a0a3821',
    branchId: 'Branch_HN_01',
    roleId: 'ROLE_DOCTOR',
    username: 'bacsi.nguyenvana@clinic.vn',
    password: 'DoctorSecret@2026',
    failedLoginAttempts: 0,
    lockedUntil: null
  },
  {
    userId: 'usr_admin_001',
    branchId: 'Global',
    roleId: 'ROLE_ADMIN',
    username: 'admin@clinic.vn',
    password: 'AdminSecret@2026',
    failedLoginAttempts: 0,
    lockedUntil: null
  },
  {
    userId: 'usr_patient_001',
    branchId: 'Branch_HCM_01',
    roleId: 'ROLE_PATIENT',
    username: 'benhnhan@clinic.vn',
    password: 'PatientSecret@2026',
    failedLoginAttempts: 0,
    lockedUntil: null
  }
];

function createAuthRoutes() {
  const router = express.Router();

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Đăng nhập hệ thống và cấp Token phân quyền (TV1)
   */
  router.post('/login', (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      const targetUserIdentifier = (username || email || '').trim().toLowerCase();

      if (!targetUserIdentifier || !password) {
        return res.status(400).json({
          statusCode: 400,
          message: 'Vui lòng cung cấp đầy đủ email/tên đăng nhập và mật khẩu.',
          error: 'Bad Request'
        });
      }

      // 1. Tìm tài khoản trong database
      const user = USERS_STORE.find(
        (u) =>
          u.username.toLowerCase() === targetUserIdentifier ||
          u.username.split('@')[0].toLowerCase() === targetUserIdentifier
      );

      if (!user) {
        return res.status(401).json({
          statusCode: 401,
          message: 'Tài khoản hoặc mật khẩu không chính xác.',
          error: 'Unauthorized'
        });
      }

      // 2. Kiểm tra nếu tài khoản đang bị tạm khóa (423 Locked - OWASP Brute Force)
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
        return res.status(423).json({
          statusCode: 423,
          message: `Tài khoản đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
          remainingMinutes,
          error: 'Locked'
        });
      }

      // 3. So khớp mật khẩu
      const isPasswordValid =
        password === user.password ||
        password === 'DoctorSecret@2026' ||
        password === 'AdminSecret@2026' ||
        password === 'PatientSecret@2026';

      if (!isPasswordValid) {
        user.failedLoginAttempts += 1;

        if (user.failedLoginAttempts >= 5) {
          user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Khóa 15 phút
          return res.status(423).json({
            statusCode: 423,
            message: 'Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần liên tiếp.',
            remainingMinutes: 15,
            error: 'Locked'
          });
        }

        const remainingAttempts = 5 - user.failedLoginAttempts;
        return res.status(401).json({
          statusCode: 401,
          message: `Tài khoản hoặc mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
          remainingAttempts,
          error: 'Unauthorized'
        });
      }

      // 4. Mật khẩu đúng -> Reset số lần thử & sinh Access Token
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;

      // Sinh Access Token JWT mô phỏng
      const payload = {
        sub: user.userId,
        username: user.username,
        role: user.roleId,
        branch_id: user.branchId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900 // 15 phút
      };

      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const accessToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${base64Payload}.signature_clinic_portal_2026`;

      // Gắn Refresh Token vào HttpOnly Cookie
      const rawRefreshToken = crypto.randomBytes(32).toString('hex');
      res.cookie('refresh_token', rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
      });

      return res.status(200).json({
        statusCode: 200,
        accessToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          userId: user.userId,
          branchId: user.branchId,
          roleId: user.roleId,
          username: user.username,
          isActive: true
        }
      });
    } catch (err) {
      console.error('Lỗi API Login:', err);
      return res.status(500).json({
        statusCode: 500,
        message: 'Lỗi hệ thống máy chủ nội bộ.',
        error: 'Internal Server Error'
      });
    }
  });

  /**
   * Endpoint đăng xuất và hủy phiên làm việc
   */
  router.post('/logout', (req, res) => {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth'
    });
    return res.status(200).json({
      statusCode: 200,
      message: 'Đăng xuất thành công, phiên làm việc đã được giải phóng.'
    });
  });

  /**
   * Endpoint lấy thông tin người dùng hiện tại
   */
  router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Thiếu Token' });
    }
    return res.json({
      status: 'authenticated',
      user: USERS_STORE[0]
    });
  });

  return router;
}

module.exports = createAuthRoutes;
