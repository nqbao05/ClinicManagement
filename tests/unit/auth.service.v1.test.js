const test = require('node:test');
const assert = require('node:assert/strict');
const AuthService = require('../../src/modules/auth/auth.service');
const AuthRepository = require('../../src/modules/auth/auth.repository');
const AuthDto = require('../../src/modules/auth/auth.dto');

test('Auth V1 Module - Unit Tests (Clean Architecture & Security Policies)', async (t) => {
  await t.test('AuthDto.validateLogin - Validation Rules', () => {
    // Trường hợp thiếu username/email hoặc password
    assert.throws(
      () => AuthDto.validateLogin({}),
      (err) => err.statusCode === 400 && err.name === 'BadRequestError'
    );

    assert.throws(
      () => AuthDto.validateLogin({ username: 'bacsi@clinic.vn' }),
      (err) => err.statusCode === 400
    );

    assert.throws(
      () => AuthDto.validateLogin({ password: 'SecretPassword' }),
      (err) => err.statusCode === 400
    );

    // Chuẩn hóa thành công
    const result = AuthDto.validateLogin({
      email: '  BACSI@clinic.vn  ',
      password: 'DoctorSecret@2026'
    });
    assert.equal(result.identifier, 'bacsi@clinic.vn');
    assert.equal(result.password, 'DoctorSecret@2026');
  });

  await t.test('AuthService.login - Authentication & Brute-force Lockout', async () => {
    const repository = new AuthRepository();
    const service = new AuthService(repository);

    // 1. Đăng nhập thành công với Bác sĩ
    const loginResult = await service.login({
      username: 'bacsi.nguyenvana@clinic.vn',
      password: 'DoctorSecret@2026'
    });

    assert.ok(loginResult.accessToken);
    assert.equal(loginResult.user.roleId, 'ROLE_DOCTOR');
    assert.equal(loginResult.user.branchId, 'Branch_HN_01');

    // 2. Báo lỗi 401 khi sai mật khẩu
    await assert.rejects(
      async () => {
        await service.login({
          username: 'bacsi.nguyenvana@clinic.vn',
          password: 'IncorrectPassword'
        });
      },
      (err) => err.statusCode === 401 && /không chính xác/.test(err.message)
    );

    // 3. Khóa tài khoản sau 5 lần nhập sai liên tiếp (OWASP Top 10)
    for (let i = 0; i < 4; i++) {
      try {
        await service.login({
          username: 'bacsi.nguyenvana@clinic.vn',
          password: 'WrongPassword'
        });
      } catch (_) {}
    }

    // Lần thử thứ 5 ném mã lỗi 423 Locked
    await assert.rejects(
      async () => {
        await service.login({
          username: 'bacsi.nguyenvana@clinic.vn',
          password: 'WrongPassword'
        });
      },
      (err) => err.statusCode === 423 && err.code === 'LOCKED'
    );
  });
});

