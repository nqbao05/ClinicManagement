const { sendSuccess } = require('../../common/responses/response.helper');
const { validateLogin, validateRegister } = require('./auth.dto');

/**
 * Controller tiếp nhận HTTP Request / Response cho Module Auth
 */
class AuthController {
  /**
   * @param {Object} authService - Instance của AuthService
   */
  constructor(authService) {
    this.authService = authService;
    this.login = this.login.bind(this);
    this.register = this.register.bind(this);
    this.me = this.me.bind(this);
  }

  /**
   * Đăng nhập hệ thống & cấp JWT Token
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const sanitized = validateLogin(req.body);
      const result = await this.authService.login(sanitized.username, sanitized.password);
      return sendSuccess(res, 200, 'Đăng nhập thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Đăng ký tài khoản mới & tự động cấp JWT Token
   * POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const sanitized = validateRegister(req.body);
      const result = await this.authService.register(sanitized);
      return sendSuccess(res, 201, 'Đăng ký tài khoản thành công', result);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lấy thông tin tài khoản hiện hành từ JWT Token
   * GET /api/v1/auth/me
   */
  async me(req, res, next) {
    try {
      const profile = this.authService.getProfile(req.user);
      return sendSuccess(res, 200, 'Lấy thông tin người dùng thành công', profile);
    } catch (error) {
      return next(error);
    }
  }
}

function createAuthController(authService) {
  return new AuthController(authService);
}

module.exports = {
  AuthController,
  createAuthController
};
