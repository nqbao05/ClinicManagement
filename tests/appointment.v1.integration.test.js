process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../src/app');
const AppointmentService = require('../src/modules/appointments/appointment.service');
const { createAppointmentV1Routes } = require('../src/modules/appointments/appointment.routes');

async function withTestServer(testFn) {
  const mockRepo = {
    doctors: [
      { doctor_id: 1, clinic_id: 1, full_name: 'BS. CKI Nguyễn Văn A', specialty: 'Khoa Tim Mạch' },
      { doctor_id: 3, clinic_id: 2, full_name: 'ThS.BS Trần Văn C', specialty: 'Khoa Cơ Xương Khớp' }
    ],
    appointments: [],
    autoIncrement: 1,

    async findDoctorById(clinicId, doctorId) {
      return this.doctors.find((d) => d.doctor_id === Number(doctorId) && d.clinic_id === Number(clinicId)) || null;
    },

    async checkPatientDoubleBooking(clinicId, patientId, slotTime) {
      return this.appointments.some(
        (a) => a.patient_id === Number(patientId) && a.slot_time === slotTime && a.status !== 'Cancelled'
      );
    },

    async createAppointmentWithTransaction(clinicId, data) {
      const existing = this.appointments.find(
        (a) => a.doctor_id === Number(data.doctor_id) && a.slot_time === data.slot_time && a.status !== 'Cancelled'
      );
      if (existing) {
        const ConflictError = require('../src/common/errors/conflict.error');
        throw new ConflictError('Khung giờ này của bác sĩ vừa có người đặt trước!');
      }

      const id = this.autoIncrement++;
      const record = {
        appointment_id: id,
        patient_id: Number(data.patient_id),
        doctor_id: Number(data.doctor_id),
        clinic_id: Number(clinicId),
        slot_time: data.slot_time,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      this.appointments.push(record);
      return record;
    },

    async findAppointments(clinicId, filters = {}) {
      let filtered = this.appointments.filter((a) => a.clinic_id === Number(clinicId));
      if (filters.doctor_id) {
        filtered = filtered.filter((a) => a.doctor_id === Number(filters.doctor_id));
      }
      return {
        rows: filtered.slice(filters.offset, filters.offset + filters.limit),
        total: filtered.length
      };
    }
  };

  const service = new AppointmentService(mockRepo);
  const appointmentV1Routes = createAppointmentV1Routes(service);
  const app = createApp({ appointmentV1Routes });

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
    await testFn({ client, mockRepo });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('POST /api/v1/appointments - Đặt lịch khám thành công (201 Created)', async () => {
  await withTestServer(async ({ client }) => {
    const payload = {
      patient_id: 101,
      doctor_id: 1,
      clinic_id: 1,
      slot_time: '2027-05-15T09:00:00'
    };

    const res = await client.post('/api/v1/appointments', payload);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.statusCode, 201);
    assert.equal(res.body.message, 'Đặt lịch khám thành công');
    assert.ok(res.body.data.appointment_id);
    assert.equal(res.body.data.doctor_name, 'BS. CKI Nguyễn Văn A');
  });
});

test('POST /api/v1/appointments - Chặn trùng slot khám của bác sĩ (409 Conflict)', async () => {
  await withTestServer(async ({ client }) => {
    const payload = {
      patient_id: 101,
      doctor_id: 1,
      clinic_id: 1,
      slot_time: '2027-05-15T09:30:00'
    };

    const res1 = await client.post('/api/v1/appointments', payload);
    assert.equal(res1.status, 201);

    // Người thứ hai cố tình đặt cùng khung giờ của cùng bác sĩ
    const res2 = await client.post('/api/v1/appointments', {
      ...payload,
      patient_id: 102
    });

    assert.equal(res2.status, 409);
    assert.equal(res2.body.code, 'CONFLICT');
    assert.ok(res2.body.message.includes('người đặt trước'));
  });
});

test('POST /api/v1/appointments - Trả về 400 Bad Request khi gửi phút lẻ hoặc ngoài giờ hành chính', async () => {
  await withTestServer(async ({ client }) => {
    // Phút lẻ 09:12
    const res = await client.post('/api/v1/appointments', {
      patient_id: 101,
      doctor_id: 1,
      clinic_id: 1,
      slot_time: '2027-05-15T09:12:00'
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
    assert.ok(res.body.message.includes('bội số của 15 hoặc 30'));
  });
});

test('POST /api/v1/appointments - Trả về 404 Not Found khi bác sĩ không thuộc chi nhánh', async () => {
  await withTestServer(async ({ client }) => {
    // Doctor 1 thuộc Clinic 1, gửi yêu cầu đặt khám tại Clinic 2
    const res = await client.post('/api/v1/appointments', {
      patient_id: 101,
      doctor_id: 1,
      clinic_id: 2,
      slot_time: '2027-05-15T14:00:00'
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });
});

test('GET /api/v1/appointments - Lấy danh sách lịch hẹn có phân trang (200 OK)', async () => {
  await withTestServer(async ({ client }) => {
    // Tạo 2 lịch hẹn
    await client.post('/api/v1/appointments', {
      patient_id: 101,
      doctor_id: 1,
      clinic_id: 1,
      slot_time: '2027-05-15T09:00:00'
    });
    await client.post('/api/v1/appointments', {
      patient_id: 102,
      doctor_id: 1,
      clinic_id: 1,
      slot_time: '2027-05-15T10:00:00'
    });

    const res = await client.get('/api/v1/appointments?clinic_id=1&page=1&limit=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.pagination.total, 2);
    assert.equal(res.body.pagination.page, 1);
  });
});
