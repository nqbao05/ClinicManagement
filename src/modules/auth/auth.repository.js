/**
 * Repository quản lý dữ liệu tài khoản định danh người dùng (TV1)
 * Hỗ trợ phân quyền RBAC và kiểm soát khóa tài khoản (Brute Force Protection)
 */
class AuthRepository {
  constructor(initialUsers = null) {
    this.users = initialUsers || [
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
  }

  /**
   * Tìm người dùng theo email hoặc tên tài khoản
   * @param {string} identifier 
   */
  async findByIdentifier(identifier) {
    const target = identifier.trim().toLowerCase();
    return (
      this.users.find(
        (u) =>
          u.username.toLowerCase() === target ||
          u.username.split('@')[0].toLowerCase() === target
      ) || null
    );
  }

  /**
   * Tìm người dùng theo ID
   * @param {string} userId 
   */
  async findById(userId) {
    return this.users.find((u) => u.userId === userId) || null;
  }

  /**
   * Tăng số lần thử đăng nhập thất bại
   * @param {string} userId 
   */
  async recordFailedAttempt(userId) {
    const user = await this.findById(userId);
    if (user) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      return user.failedLoginAttempts;
    }
    return 0;
  }

  /**
   * Khóa tạm thời tài khoản
   * @param {string} userId 
   * @param {number} lockDurationMs 
   */
  async lockAccount(userId, lockDurationMs) {
    const user = await this.findById(userId);
    if (user) {
      user.lockedUntil = new Date(Date.now() + lockDurationMs);
      return user.lockedUntil;
    }
    return null;
  }

  /**
   * Đặt lại trạng thái đăng nhập sau khi thành công
   * @param {string} userId 
   */
  async resetLoginAttempts(userId) {
    const user = await this.findById(userId);
    if (user) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }
  }
}

module.exports = AuthRepository;

