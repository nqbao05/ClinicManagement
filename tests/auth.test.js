const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');

test('GET /login - Phục vụ giao diện đăng nhập HTML của TV1', async () => {
  const app = createApp();
  const response = await request(app).get('/login');
  assert.equal(response.status, 200);
  assert.match(response.text, /Cổng Đăng Nhập Y Tế/);
  assert.match(response.text, /login\.js/);
});

test('POST /api/v1/auth/login - Đăng nhập thành công với tài khoản Bác sĩ', async () => {
  const app = createApp();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      username: 'bacsi.nguyenvana@clinic.vn',
      password: 'DoctorSecret@2026'
    });

  assert.equal(response.status, 200);
  assert.ok(response.body.accessToken);
  assert.equal(response.body.user.roleId, 'ROLE_DOCTOR');
  assert.equal(response.body.user.branchId, 'Branch_HN_01');
});

test('POST /api/v1/auth/login - Từ chối khi sai mật khẩu (401 Unauthorized)', async () => {
  const app = createApp();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      username: 'bacsi.nguyenvana@clinic.vn',
      password: 'WrongPassword'
    });

  assert.equal(response.status, 401);
  assert.match(response.body.message, /không chính xác/);
});

test('POST /api/v1/auth/login - Từ chối khi thiếu dữ liệu đầu vào (400 Bad Request)', async () => {
  const app = createApp();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: '' });

  assert.equal(response.status, 400);
});

test('POST /api/v1/auth/logout - Đăng xuất và giải phóng phiên thành công', async () => {
  const app = createApp();
  const response = await request(app).post('/api/v1/auth/logout');
  assert.equal(response.status, 200);
  assert.match(response.body.message, /Đăng xuất thành công/);
});
