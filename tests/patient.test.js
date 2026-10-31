const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const { PatientRepository } = require('../src/repositories/patient.repository');
const { PatientService } = require('../src/services/patient.service');
const { createPatientRoutes } = require('../src/routes/patient.routes');

async function withTestServer(testFn) {
  const repository = new PatientRepository();
  const service = new PatientService(repository, { currentClinicId: 1 });
  const patientRoutes = createPatientRoutes(service);
  const app = createApp({ patientRoutes });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const client = {
    async get(path, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, { headers });
      const text = await res.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      return { status: res.status, body };
    },
    async post(path, body, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      let resBody;
      try { resBody = JSON.parse(text); } catch { resBody = text; }
      return { status: res.status, body: resBody };
    },
    async put(path, body, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      let resBody;
      try { resBody = JSON.parse(text); } catch { resBody = text; }
      return { status: res.status, body: resBody };
    },
    async delete(path, headers = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        headers
      });
      const text = await res.text();
      let resBody;
      try { resBody = JSON.parse(text); } catch { resBody = text; }
      return { status: res.status, body: resBody };
    }
  };

  try {
    await testFn({ client, repository, service, app });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('POST /api/patients - Tạo hồ sơ bệnh nhân thành công (201 Created)', async () => {
  await withTestServer(async ({ client }) => {
    const payload = {
      origin_clinic_id: 1,
      identity_card: '001201012345',
      full_name: 'Nguyễn Văn P',
      phone_number: '0901234567',
      gender: 'Nam',
      date_of_birth: '1990-05-15',
      address: 'Hoàn Kiếm, Hà Nội',
      blood_type: 'O+',
      medical_history: 'Tiền sử dị ứng penicillin'
    };

    const res = await client.post('/api/patients', payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.full_name, payload.full_name);
    assert.equal(res.body.identity_card, payload.identity_card);
    assert.equal(res.body.origin_clinic_id, 1);
    assert.ok(res.body.patient_id);
  });
});

test('POST /api/patients - Trả về 400 Bad Request khi thiếu trường hoặc sai định dạng', async () => {
  await withTestServer(async ({ client }) => {
    const res = await client.post('/api/patients', {
      identity_card: 'invalid_cccd',
      phone_number: '123'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.body.details));
  });
});

test('POST /api/patients - Ngăn chặn trùng lặp số CCCD (409 Conflict)', async () => {
  await withTestServer(async ({ client }) => {
    const payload = {
      origin_clinic_id: 1,
      identity_card: '001201999999',
      full_name: 'Bệnh nhân Thử Nghiệm',
      phone_number: '0901234567'
    };

    const res1 = await client.post('/api/patients', payload);
    assert.equal(res1.status, 201);

    const res2 = await client.post('/api/patients', payload);
    assert.equal(res2.status, 409);
    assert.equal(res2.body.code, 'PATIENT_DUPLICATE_IDENTITY_CARD');
  });
});

test('GET /api/patients - Lấy danh sách bệnh nhân và lọc theo origin_clinic_id', async () => {
  await withTestServer(async ({ client }) => {
    // Tạo bệnh nhân ở Node 1 (Hà Nội)
    await client.post('/api/patients', {
      origin_clinic_id: 1,
      identity_card: '001000000001',
      full_name: 'Bệnh nhân Hà Nội',
      phone_number: '0901111111'
    });

    // Tạo bệnh nhân ở Node 2 (TP.HCM)
    await client.post('/api/patients', {
      origin_clinic_id: 2,
      identity_card: '079000000002',
      full_name: 'Bệnh nhân Sài Gòn',
      phone_number: '0902222222'
    });

    // Lấy tất cả
    const resAll = await client.get('/api/patients');
    assert.equal(resAll.status, 200);
    assert.equal(resAll.body.length, 2);

    // Lọc chỉ Node 2 (TP.HCM)
    const resHcm = await client.get('/api/patients?origin_clinic_id=2');
    assert.equal(resHcm.status, 200);
    assert.equal(resHcm.body.length, 1);
    assert.equal(resHcm.body[0].origin_clinic_id, 2);
    assert.equal(resHcm.body[0].full_name, 'Bệnh nhân Sài Gòn');
  });
});

test('GET /api/patients/:id - PRD Kịch bản 2.1: Truy xuất liên chi nhánh trả về is_external_record: true', async () => {
  await withTestServer(async ({ client }) => {
    // Tạo bệnh nhân ở Node 1 (Hà Nội)
    const createRes = await client.post('/api/patients', {
      origin_clinic_id: 1,
      identity_card: '001201010200',
      full_name: 'Nguyễn Văn P (BN102)',
      phone_number: '0909999888'
    });
    const patientId = createRes.body.patient_id;

    // Bác sĩ tại TP.HCM (clinic_id = 2) tra cứu bệnh nhân này
    const res = await client.get(`/api/patients/${patientId}`, { 'X-Clinic-ID': '2' });

    assert.equal(res.status, 200);
    assert.equal(res.body.origin_clinic_id, 1);
    assert.equal(res.body.is_external_record, true);
    assert.equal(res.body.source_node, 'Node Hà Nội');
    assert.ok(res.body.sync_notice.includes('Cơ sở Hà Nội'));

    // Bác sĩ tại Hà Nội (clinic_id = 1) tra cứu cùng hồ sơ
    const resSameClinic = await client.get(`/api/patients/${patientId}`, { 'X-Clinic-ID': '1' });
    assert.equal(resSameClinic.status, 200);
    assert.equal(resSameClinic.body.is_external_record, false);
  });
});

test('GET /api/patients/:id - Trả về 404 Not Found khi không tìm thấy', async () => {
  await withTestServer(async ({ client }) => {
    const res = await client.get('/api/patients/999999');
    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'PATIENT_NOT_FOUND');
  });
});

test('GET /api/patients/:id - PRD Kịch bản 2.2: Máy chủ chi nhánh Timeout trả về mã lỗi 504 Gateway Timeout', async () => {
  await withTestServer(async ({ client, repository }) => {
    // Tạo bệnh nhân ở Node 1 (Hà Nội)
    const createRes = await client.post('/api/patients', {
      origin_clinic_id: 1,
      identity_card: '001201050400',
      full_name: 'Bệnh nhân Timeout PRD',
      phone_number: '0909999777'
    });
    const patientId = createRes.body.patient_id;

    // Kích hoạt mô phỏng đứt kết nối / timeout sang Node 1 (Hà Nội)
    repository.setNodeTimeoutSimulation(1, true);

    // Bác sĩ từ cơ sở khác gọi tra cứu bệnh nhân
    const res = await client.get(`/api/patients/${patientId}`);
    assert.equal(res.status, 504);
    assert.equal(res.body.code, 'GATEWAY_TIMEOUT');
    assert.ok(res.body.message.includes('Gateway Timeout') || res.body.message.includes('máy chủ khu vực'));

    // Tắt cờ mô phỏng, hệ thống hồi phục bình thường
    repository.setNodeTimeoutSimulation(1, false);
    const resRecovered = await client.get(`/api/patients/${patientId}`);
    assert.equal(resRecovered.status, 200);
  });
});

test('PUT /api/patients/:id - Cập nhật thông tin bệnh nhân thành công (200 OK)', async () => {
  await withTestServer(async ({ client }) => {
    const createRes = await client.post('/api/patients', {
      origin_clinic_id: 1,
      identity_card: '001201019988',
      full_name: 'Tên Ban Đầu',
      phone_number: '0901234567'
    });
    const patientId = createRes.body.patient_id;

    const updateRes = await client.put(`/api/patients/${patientId}`, {
      full_name: 'Tên Đã Đổi',
      phone_number: '0988888888',
      blood_type: 'AB+'
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.full_name, 'Tên Đã Đổi');
    assert.equal(updateRes.body.phone_number, '0988888888');
    assert.equal(updateRes.body.blood_type, 'AB+');
  });
});

test('DELETE /api/patients/:id - Xóa hồ sơ bệnh nhân thành công (200 OK)', async () => {
  await withTestServer(async ({ client }) => {
    const createRes = await client.post('/api/patients', {
      origin_clinic_id: 2,
      identity_card: '079201019999',
      full_name: 'Bệnh nhân Cần Xóa',
      phone_number: '0901234567'
    });
    const patientId = createRes.body.patient_id;

    const deleteRes = await client.delete(`/api/patients/${patientId}`);
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);

    const getRes = await client.get(`/api/patients/${patientId}`);
    assert.equal(getRes.status, 404);
  });
});

test('OpenAPI Document chứa các Endpoint của Patients', async () => {
  await withTestServer(async ({ client }) => {
    const res = await client.get('/openapi.json');
    assert.equal(res.status, 200);
    assert.ok(res.body.paths['/patients'], 'Đường dẫn /patients phải tồn tại trong OpenAPI');
    assert.ok(res.body.paths['/patients'].post, 'POST /patients phải được định nghĩa');
    assert.ok(res.body.paths['/patients'].get, 'GET /patients phải được định nghĩa');
    assert.ok(res.body.paths['/patients/{id}'], 'Đường dẫn /patients/{id} phải tồn tại trong OpenAPI');
  });
});
