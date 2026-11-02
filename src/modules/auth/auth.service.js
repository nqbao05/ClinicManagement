const { UnauthorizedError } = require('../../common/errors');
const { comparePassword } = require('../../common/utils/crypto.util');
const { signToken } = require('../../common/middlewares/auth.middleware');

/**
 * Service xử lý Business Logic Xác thực & Cấp phát JWT
 */
class AuthService {
  /**
   * @param {Object} authRepository 
   */
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  /**
   * Xác thực thông tin đăng nhập và cấp phát JWT token
   * @param {string} username 
   * @param {string} password 
   * @returns {Promise<{ token: string, user: Object }>}
   */
  async login(username, password) {
    const user = await this.authRepository.findByUsername(username);

    if (!user) {
      throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không chính xác!');
    }

    const isMatch = comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Tên đăng nhập hoặc mật khẩu không chính xác!');
    }

    const payload = {
      user_id: user.id,
      username: user.username,
      role: user.role,
      clinic_id: user.clinic_id,
      patient_id: user.patient_id
    };

    const token = signToken(payload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        clinic_id: user.clinic_id,
        patient_id: user.patient_id
      }
    };
  }

  /**
   * Lấy thông tin hồ sơ của người dùng hiện tại
   * @param {Object} userPayload Thông tin giải mã từ JWT (req.user)
   * @returns {Object}
   */
  getProfile(userPayload) {
    if (!userPayload) {
      throw new UnauthorizedError('Không tìm thấy thông tin phiên làm việc!');
    }

    return {
      id: userPayload.user_id,
      username: userPayload.username,
      role: userPayload.role,
      clinic_id: userPayload.clinic_id,
      patient_id: userPayload.patient_id
    };
  }
}

module.exports = AuthService;
