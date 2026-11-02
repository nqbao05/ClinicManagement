process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const {
  signToken,
  authenticate,
  authorize,
  authorizePatientSelf
} = require('../src/common/middlewares/auth.middleware');
const { UnauthorizedError, ForbiddenError } = require('../src/common/errors');

test('RBAC Middleware - Unit Tests', async (t) => {
  await t.test('authenticate: từ chối khi không có token (chế độ bắt buộc x-enforce-auth)', () => {
    const req = { headers: { 'x-enforce-auth': 'true' } };
    const res = {};
    let errorPassed = null;
    authenticate(req, res, (err) => { errorPassed = err; });

    assert.ok(errorPassed instanceof UnauthorizedError);
    assert.strictEqual(errorPassed.statusCode, 401);
  });

  await t.test('authenticate: từ chối khi token sai định dạng hoặc không hợp lệ', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.payload' } };
    const res = {};
    let errorPassed = null;
    authenticate(req, res, (err) => { errorPassed = err; });

    assert.ok(errorPassed instanceof UnauthorizedError);
    assert.strictEqual(errorPassed.statusCode, 401);
  });

  await t.test('authenticate: giải mã JWT thành công và gán vào req.user', () => {
    const token = signToken({ user_id: 10, role: 'staff', clinic_id: 1, patient_id: null });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let errorPassed = null;
    authenticate(req, res, (err) => { errorPassed = err; });

    assert.strictEqual(errorPassed, undefined);
    assert.strictEqual(req.user.user_id, 10);
    assert.strictEqual(req.user.role, 'staff');
    assert.strictEqual(req.user.clinic_id, 1);
  });

  await t.test('authorize: chặn người dùng không đủ quyền với HTTP 403 Forbidden', () => {
    const req = { user: { role: 'patient' } };
    const res = {};
    let errorPassed = null;
    const middleware = authorize('admin', 'staff');
    middleware(req, res, (err) => { errorPassed = err; });

    assert.ok(errorPassed instanceof ForbiddenError);
    assert.strictEqual(errorPassed.statusCode, 403);
  });

  await t.test('authorizePatientSelf: cho phép admin và staff truy cập hồ sơ bất kỳ', () => {
    const reqAdmin = { user: { role: 'admin' }, params: { id: '99' } };
    let errAdmin = null;
    authorizePatientSelf(reqAdmin, {}, (err) => { errAdmin = err; });
    assert.strictEqual(errAdmin, undefined);

    const reqStaff = { user: { role: 'staff' }, params: { id: '99' } };
    let errStaff = null;
    authorizePatientSelf(reqStaff, {}, (err) => { errStaff = err; });
    assert.strictEqual(errStaff, undefined);
  });

  await t.test('authorizePatientSelf: cho phép patient truy cập đúng ID của mình', () => {
    const req = { user: { role: 'patient', patient_id: 5 }, params: { id: '5' } };
    let errorPassed = null;
    authorizePatientSelf(req, {}, (err) => { errorPassed = err; });
    assert.strictEqual(errorPassed, undefined);
  });

  await t.test('authorizePatientSelf: chặn patient cố truy cập hồ sơ của người khác (403 Forbidden)', () => {
    const req = { user: { role: 'patient', patient_id: 5 }, params: { id: '99' } };
    let errorPassed = null;
    authorizePatientSelf(req, {}, (err) => { errorPassed = err; });

    assert.ok(errorPassed instanceof ForbiddenError);
    assert.strictEqual(errorPassed.statusCode, 403);
    assert.strictEqual(errorPassed.message, 'Không thể truy cập hồ sơ bệnh nhân khác!');
  });
});

test('RBAC HTTP Endpoints - Integration Tests', async (t) => {
  const app = createApp();

  const adminToken = signToken({ user_id: 1, role: 'admin', clinic_id: 1 });
  const staffToken = signToken({ user_id: 2, role: 'staff', clinic_id: 1 });
  const patientToken = signToken({ user_id: 3, role: 'patient', clinic_id: 1, patient_id: 101 });

  await t.test('TV1: POST /api/v1/clinics - Chặn staff và patient (403), chỉ cho phép admin', async () => {
    const resStaff = await request(app)
      .post('/api/v1/clinics')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Chi nhánh mới' });
    assert.strictEqual(resStaff.status, 403);

    const resAdmin = await request(app)
      .post('/api/v1/clinics')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Chi nhánh mới' });
    assert.strictEqual(resAdmin.status, 201);
  });

  await t.test('TV2: GET /api/v1/patients - Chặn patient xem danh sách tổng (403 Forbidden)', async () => {
    const resPatient = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.strictEqual(resPatient.status, 403);
  });

  await t.test('TV4: GET /api/v1/admin/dashboard/stats - Chặn staff và patient (403), chỉ admin được xem', async () => {
    const resStaff = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${staffToken}`);
    assert.strictEqual(resStaff.status, 403);

    const resPatient = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.strictEqual(resPatient.status, 403);

    const resAdmin = await request(app)
      .get('/api/v1/admin/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resAdmin.status, 200);
  });
});
