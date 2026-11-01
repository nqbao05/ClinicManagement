process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const PatientService = require('../src/modules/patients/patient.service');
const { createPatientV1Routes } = require('../src/modules/patients/patient.routes');

async function withTestServer(testFn) {
  const mockRepo = {
    patients: [
      {
        patient_id: 1,
        origin_clinic_id: 1,
        identity_card: '001200000001',
        citizen_id: '001200000001',
        full_name: 'Nguyễn Văn An',
        phone_number: '0912345671',
        gender: 'Male',
        date_of_birth: '1985-01-01',
        address: 'Hà Nội',
        created_at: new Date().toISOString()
      },
      {
        patient_id: 2,
        origin_clinic_id: 2,
        identity_card: '079200000002',
        citizen_id: '079200000002',
        full_name: 'Trần Thị Bình',
        phone_number: '0987654322',
        gender: 'Female',
        date_of_birth: '1990-02-02',
        address: 'TP.HCM',
        created_at: new Date().toISOString()
      }
    ],
    autoIncrement: 3,

    async findByCitizenId(clinicId, citizenId) {
      return this.patients.find(
        (p) => p.origin_clinic_id === Number(clinicId) && (p.citizen_id === citizenId || p.identity_card === citizenId)
      ) || null;
    },

    async findById(clinicId, patientId) {
      return this.patients.find(
        (p) => p.origin_clinic_id === Number(clinicId) && p.patient_id === Number(patientId)
      ) || null;
    },

    async createPatient(clinicId, data) {
      const citizenId = data.citizen_id || data.identity_card;
      const existing = await this.findByCitizenId(clinicId, citizenId);
      if (existing) {
        const ConflictError = require('../src/common/errors/conflict.error');
        throw new ConflictError('Số CCCD này đã được đăng ký hồ sơ tại cơ sở!');
      }

      const id = this.autoIncrement++;
      const record = {
        patient_id: id,
        origin_clinic_id: Number(clinicId),
        citizen_id: citizenId,
        identity_card: citizenId,
        full_name: data.full_name,
        phone_number: data.phone_number,
        gender: data.gender || 'Other',
        date_of_birth: data.date_of_birth,
        address: data.address || null,
        created_at: new Date().toISOString()
      };
      this.patients.push(record);
      return record;
    },

    async listPatients(clinicId, filters = {}) {
      let filtered = this.patients.filter((p) => p.origin_clinic_id === Number(clinicId));
      if (filters.citizen_id) {
        filtered = filtered.filter((p) => p.citizen_id === filters.citizen_id || p.identity_card === filters.citizen_id);
      }
      if (filters.phone_number) {
        filtered = filtered.filter((p) => p.phone_number === filters.phone_number);
      }

      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      return {
        rows: filtered.slice(offset, offset + limit),
        total: filtered.length
      };
    }
  };

  const service = new PatientService(mockRepo);
  const patientV1Routes = createPatientV1Routes(service);
  const app = createApp({ patientV1Routes });

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
    }
  };

  try {
    await testFn(client);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('POST /api/v1/patients - Đăng ký hồ sơ bệnh nhân thành công (201 Created)', async () => {
  await withTestServer(async (client) => {
    const res = await client.post('/api/v1/patients', {
      full_name: 'Hoàng Minh Đức',
      citizen_id: '001200009999',
      phone_number: '0934567890',
      origin_clinic_id: 1,
      date_of_birth: '1993-06-25',
      gender: 'Male',
      address: 'Cầu Giấy, Hà Nội'
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.statusCode, 201);
    assert.strictEqual(res.body.message, 'Đăng ký hồ sơ bệnh nhân thành công');
    assert.strictEqual(res.body.data.full_name, 'Hoàng Minh Đức');
    assert.strictEqual(res.body.data.citizen_id, '001200009999');
    assert.strictEqual(res.body.data.origin_clinic_id, 1);
  });
});

test('POST /api/v1/patients - Từ chối khi sai định dạng CCCD (400 Bad Request)', async () => {
  await withTestServer(async (client) => {
    const res = await client.post('/api/v1/patients', {
      full_name: 'Hoàng Minh Đức',
      citizen_id: '123456', // Thiếu chữ số
      phone_number: '0934567890',
      origin_clinic_id: 1,
      date_of_birth: '1993-06-25'
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('12 chữ số'));
  });
});

test('POST /api/v1/patients - Chặn trùng lặp số CCCD tại cùng cơ sở (409 Conflict)', async () => {
  await withTestServer(async (client) => {
    const res = await client.post('/api/v1/patients', {
      full_name: 'Trùng CCCD',
      citizen_id: '001200000001', // Đã có ở mockRepo (Node 1)
      phone_number: '0912345679',
      origin_clinic_id: 1,
      date_of_birth: '1990-01-01'
    });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes('Số CCCD này đã được đăng ký'));
  });
});

test('GET /api/v1/patients - Quét phân tán Cross-Node khi không truyền clinic_id (200 OK)', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/patients');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.strictEqual(res.body.data.length, 2);
    assert.strictEqual(res.body.pagination.total, 2);
  });
});

test('GET /api/v1/patients/:id - Lấy chi tiết bệnh nhân thành công (200 OK)', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/patients/1?clinic_id=1');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.patient_id, 1);
    assert.strictEqual(res.body.data.full_name, 'Nguyễn Văn An');
  });
});

test('GET /api/v1/patients/:id - Trả về 404 Not Found khi bệnh nhân không tồn tại', async () => {
  await withTestServer(async (client) => {
    const res = await client.get('/api/v1/patients/9999?clinic_id=1');

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });
});
