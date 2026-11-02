const { UnauthorizedError, ConflictError } = require('../../common/errors');
const { comparePassword, hashPassword } = require('../../common/utils/crypto.util');
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
   * Đăng ký tài khoản người dùng mới
   * @param {Object} registerData 
   * @returns {Promise<{ token: string, user: Object }>}
   */
  async register(registerData) {
    const { username, password, role, clinic_id } = registerData;

    const existing = await this.authRepository.findByUsername(username);
    if (existing) {
      throw new ConflictError('Tên đăng nhập đã tồn tại, vui lòng chọn tên khác!');
    }

    const passwordHash = hashPassword(password);
    const assignedPatientId = (role === 'patient' && registerData.patient_id) ? Number(registerData.patient_id) : null;
    const assignedClinicId = clinic_id || (role === 'staff' ? 1 : null);

    const newUser = await this.authRepository.createUser({
      username,
      password_hash: passwordHash,
      role: role || 'patient',
      clinic_id: assignedClinicId,
      patient_id: assignedPatientId
    }, assignedClinicId || 1);

    const payload = {
      user_id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      clinic_id: newUser.clinic_id,
      patient_id: newUser.patient_id
    };

    const token = signToken(payload);

    return {
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        clinic_id: newUser.clinic_id,
        patient_id: newUser.patient_id
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
