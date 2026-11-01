/**
 * Controller tiếp nhận HTTP Request / Response cho Phân hệ Xác thực & Phân quyền (TV1)
 * Tuân thủ Clean Architecture: Không chứa Business Logic, chuẩn hóa HTTP Response.
 */
class AuthController {
  /**
   * @param {import('./auth.service')} authService 
   */
  constructor(authService) {
    this.authService = authService;
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.getMe = this.getMe.bind(this);
  }

  /**
   * Đăng nhập hệ thống và cấp Token phân quyền
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const result = await this.authService.login(req.body);

      // Gắn Refresh Token vào HttpOnly Cookie an toàn
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
      });

      return res.status(200).json({
        statusCode: 200,
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        user: result.user
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Đăng xuất và giải phóng phiên làm việc
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
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
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Lấy thông tin tài khoản hiện tại
   * GET /api/v1/auth/me
   */
  async getMe(req, res, next) {
    try {
      const result = await this.authService.getCurrentUser(req.headers.authorization);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AuthController;

