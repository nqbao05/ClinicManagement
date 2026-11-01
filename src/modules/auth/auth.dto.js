const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Data Transfer Object (DTO) & Validation cho Phân hệ Xác thực (TV1)
 */
class AuthDto {
  /**
   * Xác thực và chuẩn hóa thông tin đăng nhập
   * @param {Object} body
   * @returns {{ identifier: string, password: string }}
   */
  static validateLogin(body = {}) {
    const { username, email, password } = body || {};
    const identifier = (username || email || '').trim().toLowerCase();

    if (!identifier || !password) {
      throw new BadRequestError('Vui lòng cung cấp đầy đủ email/tên đăng nhập và mật khẩu.');
    }

    return {
      identifier,
      password: String(password)
    };
  }
}

module.exports = AuthDto;

