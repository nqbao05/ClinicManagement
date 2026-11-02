process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');

test('Auth Module V1 - Integration & Security Tests', async (t) => {
  const app = createApp();

  await t.test('POST /api/v1/auth/login - Từ chối khi thiếu username hoặc password (400 Bad Request)', async () => {
    const res1 = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    assert.strictEqual(res1.status, 400);
    assert.strictEqual(res1.body.success, false);

    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin' });
    assert.strictEqual(res2.status, 400);
  });

  await t.test('POST /api/v1/auth/login - Từ chối khi mật khẩu không đúng (401 Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'WrongPassword@999' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('không chính xác'));
  });

  await t.test('POST /api/v1/auth/login - Chống SQL Injection trên trường username (401 Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: "' OR '1'='1' --", password: 'password123' });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  await t.test('POST /api/v1/auth/login - Đăng nhập Admin thành công (200 OK)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'Admin@123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.username, 'admin');
    assert.strictEqual(res.body.data.user.role, 'admin');
  });

  await t.test('POST /api/v1/auth/login - Đăng nhập Staff Hà Nội thành công (200 OK, clinic_id = 1)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'staff_hanoi', password: 'Staff@123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.username, 'staff_hanoi');
    assert.strictEqual(res.body.data.user.role, 'staff');
    assert.strictEqual(res.body.data.user.clinic_id, 1);
  });

  await t.test('POST /api/v1/auth/login - Đăng nhập Staff TP.HCM thành công (200 OK, clinic_id = 2)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'staff_hcm', password: 'Staff@123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.role, 'staff');
    assert.strictEqual(res.body.data.user.clinic_id, 2);
  });

  await t.test('POST /api/v1/auth/login - Đăng nhập Patient thành công (200 OK, role = patient)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient', password: 'Patient@123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.role, 'patient');
    assert.strictEqual(res.body.data.user.patient_id, 101);
  });

  await t.test('GET /api/v1/auth/me - Lấy thông tin người dùng hiện hành với JWT hợp lệ', async () => {
    // Đăng nhập lấy token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'staff_hanoi', password: 'Staff@123' });
    const token = loginRes.body.data.token;

    // Gọi /api/v1/auth/me
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.success, true);
    assert.strictEqual(meRes.body.data.username, 'staff_hanoi');
    assert.strictEqual(meRes.body.data.role, 'staff');
    assert.strictEqual(meRes.body.data.clinic_id, 1);
  });

  await t.test('POST /api/v1/auth/register - Đăng ký tài khoản mới thành công (201 Created)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'new_patient_user',
        password: 'Password@123',
        confirm_password: 'Password@123',
        role: 'patient',
        full_name: 'Nguyễn Văn Mới'
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.token);
    assert.strictEqual(res.body.data.user.username, 'new_patient_user');
    assert.strictEqual(res.body.data.user.role, 'patient');
  });

  await t.test('POST /api/v1/auth/register - Chặn đăng ký trùng tên đăng nhập (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'admin',
        password: 'Password@123',
        confirm_password: 'Password@123'
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
  });

  await t.test('POST /api/v1/auth/register - Từ chối khi mật khẩu xác nhận không khớp (400 Bad Request)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        username: 'user_mismatch',
        password: 'Password@123',
        confirm_password: 'DifferentPassword@123'
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  await t.test('GET /api/v1/auth/me - Từ chối khi không có token (chế độ x-enforce-auth)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('x-enforce-auth', 'true');

    assert.strictEqual(res.status, 401);
  });
});
