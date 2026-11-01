process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const ClinicService = require('../src/modules/clinics/clinic.service');
const DoctorService = require('../src/modules/doctors/doctor.service');
const { createClinicRoutes } = require('../src/modules/clinics/clinic.routes');
const { createDoctorRoutes } = require('../src/modules/doctors/doctor.routes');

function setupTestApp() {
  const mockClinicRepo = {
    clinics: [
      { clinic_id: 1, name: 'Cơ sở 1 - Hà Nội', address: 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội', phone: '024-3825-5555' },
      { clinic_id: 2, name: 'Cơ sở 2 - TP.HCM', address: 'Số 201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', phone: '028-3925-6666' }
    ],
    async findAll() {
      return this.clinics;
    },
    async findById(id) {
      return this.clinics.find((c) => c.clinic_id === Number(id)) || null;
    }
  };

  const mockDoctorRepo = {
    doctors: [
      { doctor_id: 1, clinic_id: 1, full_name: 'BS. CKI Nguyễn Văn A', specialty: 'Khoa Tim Mạch' },
      { doctor_id: 2, clinic_id: 1, full_name: 'BS. CKII Lê Thị B', specialty: 'Khoa Nội' },
      { doctor_id: 3, clinic_id: 2, full_name: 'ThS.BS Trần Văn C', specialty: 'Khoa Cơ Xương Khớp' }
    ],
    async findAll(specialty) {
      if (!specialty) return this.doctors;
      return this.doctors.filter((d) => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
    },
    async findByClinic(clinicId, specialty) {
      return this.doctors.filter((d) => {
        if (d.clinic_id !== Number(clinicId)) return false;
        if (specialty && !d.specialty.toLowerCase().includes(specialty.toLowerCase())) return false;
        return true;
      });
    },
    async findById(clinicId, doctorId) {
      return this.doctors.find(
        (d) => d.doctor_id === Number(doctorId) && d.clinic_id === Number(clinicId)
      ) || null;
    }
  };

  const clinicService = new ClinicService(mockClinicRepo);
  const doctorService = new DoctorService(mockDoctorRepo);

  const clinicRoutes = createClinicRoutes(clinicService);
  const doctorRoutes = createDoctorRoutes(doctorService);

  return createApp({ clinicRoutes, doctorRoutes });
}

test('TV1 Integration - Clinics & Doctors Endpoints', async (t) => {
  const app = setupTestApp();

  await t.test('GET /api/v1/clinics - Lấy danh sách các cơ sở phòng khám', async () => {
    const res = await request(app).get('/api/v1/clinics');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 2);
    assert.ok(res.body.data.some((c) => c.name.includes('Hà Nội')));
    assert.ok(res.body.data.some((c) => c.name.includes('TP.HCM')));
  });

  await t.test('GET /api/v1/clinics/1 - Lấy thông tin cơ sở Hà Nội', async () => {
    const res = await request(app).get('/api/v1/clinics/1');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.clinic_id, 1);
  });

  await t.test('GET /api/v1/clinics/999 - Trả về 404 Not Found khi mã cơ sở không tồn tại', async () => {
    const res = await request(app).get('/api/v1/clinics/999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'NOT_FOUND');
  });

  await t.test('GET /api/v1/clinics/abc - Trả về 400 Bad Request khi mã cơ sở sai định dạng', async () => {
    const res = await request(app).get('/api/v1/clinics/abc');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  await t.test('GET /api/v1/doctors - Lấy danh sách bác sĩ trên toàn hệ thống', async () => {
    const res = await request(app).get('/api/v1/doctors');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 3);
  });

  await t.test('GET /api/v1/doctors?clinic_id=1 - Lọc bác sĩ thuộc cơ sở Hà Nội', async () => {
    const res = await request(app).get('/api/v1/doctors?clinic_id=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 2);
    res.body.data.forEach((doctor) => {
      assert.equal(doctor.clinic_id, 1);
    });
  });

  await t.test('GET /api/v1/doctors?clinic_id=99 - Trả về 400 Bad Request do clinic_id không hợp lệ', async () => {
    const res = await request(app).get('/api/v1/doctors?clinic_id=99');
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  await t.test('GET /api/v1/doctors/1?clinic_id=1 - Lấy chi tiết thông tin bác sĩ theo ID', async () => {
    const res = await request(app).get('/api/v1/doctors/1?clinic_id=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.doctor_id, 1);
    assert.ok(res.body.data.full_name);
  });

  await t.test('GET /api/v1/doctors/99999 - Trả về 404 khi không tìm thấy bác sĩ', async () => {
    const res = await request(app).get('/api/v1/doctors/99999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'NOT_FOUND');
  });
});
