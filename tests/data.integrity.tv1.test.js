process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const AppointmentService = require('../src/modules/appointments/appointment.service');
const { createAppointmentV1Routes } = require('../src/modules/appointments/appointment.routes');
const PatientService = require('../src/modules/patients/patient.service');
const { createPatientV1Routes } = require('../src/modules/patients/patient.routes');
const DoctorService = require('../src/modules/doctors/doctor.service');
const { createDoctorRoutes } = require('../src/modules/doctors/doctor.routes');
const { ConflictError, NotFoundError, BadRequestError } = require('../src/common/errors');

test('Data Integrity Enforcement & TV1 Upgrades', async (t) => {

  await t.test('1. Chặn đặt lịch với Bác sĩ không hoạt động (status !== "active")', async () => {
    const mockRepo = {
      async findDoctorById(clinicId, doctorId) {
        return {
          id: doctorId,
          doctor_id: doctorId,
          clinic_id: clinicId,
          full_name: 'BS. Nghỉ Phép',
          status: 'inactive'
        };
      },
      async checkPatientDoubleBooking() { return false; },
      async createAppointmentWithTransaction() { return {}; }
    };

    const service = new AppointmentService(mockRepo);
    await assert.rejects(
      () => service.bookAppointment({
        clinic_id: 1,
        doctor_id: 10,
        patient_id: 1,
        slot_time: '2026-11-15T09:00:00'
      }),
      (err) => err instanceof BadRequestError && err.message.includes('tạm ngưng tiếp nhận')
    );
  });

  await t.test('2. Chặn đặt lịch cho Bệnh nhân không tồn tại (patient_id ảo)', async () => {
    const mockRepo = {
      async findDoctorById(clinicId, doctorId) {
        return {
          id: doctorId,
          doctor_id: doctorId,
          clinic_id: clinicId,
          full_name: 'BS. Đang Làm Việc',
          status: 'active'
        };
      },
      async findPatientById() { return null; },
      async checkPatientDoubleBooking() { return false; },
      async createAppointmentWithTransaction() { return {}; }
    };

    const service = new AppointmentService(mockRepo);
    await assert.rejects(
      () => service.bookAppointment({
        clinic_id: 1,
        doctor_id: 10,
        patient_id: 9999,
        slot_time: '2026-11-15T09:00:00'
      }),
      (err) => err instanceof NotFoundError && err.message.includes('Hồ sơ bệnh nhân không tồn tại')
    );
  });

  await t.test('3. Chặn xóa Bệnh nhân nếu đang có lịch khám pending hoặc confirmed (409 Conflict)', async () => {
    const mockPatientRepo = {
      async findById(id) {
        return { patient_id: id, origin_clinic_id: 1 };
      },
      async hasActiveAppointments(clinicId, patientId) {
        return true; // Đang có ca khám pending/confirmed
      },
      async delete() { return true; }
    };

    const service = new PatientService(mockPatientRepo);
    await assert.rejects(
      () => service.remove(101),
      (err) => err instanceof ConflictError && err.statusCode === 409 && err.message.includes('Không thể xóa hồ sơ bệnh nhân khi đang có lịch khám')
    );
  });

  await t.test('4. Chặn đăng ký trùng CCCD xuyên cơ sở (Cross-Node Conflict)', async () => {
    const mockPatientRepo = {
      async findByIdentityCard(cccd) {
        return { patient_id: 201, origin_clinic_id: 2, citizen_id: cccd }; // Đã tồn tại ở Node 2 (TP.HCM)
      },
      async createPatient() { return {}; }
    };

    const service = new PatientService(mockPatientRepo);
    await assert.rejects(
      () => service.registerPatient({
        full_name: 'Bệnh Nhân Mới',
        citizen_id: '001200009999',
        phone_number: '0901234567',
        origin_clinic_id: 1,
        date_of_birth: '1995-01-01'
      }),
      (err) => err instanceof ConflictError && err.statusCode === 409 && err.message.includes('Số CCCD này đã được đăng ký')
    );
  });

  await t.test('5. API GET /api/v1/appointments/:id trả về chi tiết lịch hẹn', async () => {
    const mockApptRepo = {
      async findById(clinicId, id) {
        if (Number(id) === 15) {
          return { appointment_id: 15, patient_id: 101, doctor_id: 1, clinic_id: clinicId, status: 'Confirmed' };
        }
        return null;
      }
    };
    const apptService = new AppointmentService(mockApptRepo);
    const app = createApp({ appointmentV1Routes: createAppointmentV1Routes(apptService) });

    const res = await request(app).get('/api/v1/appointments/15?clinic_id=1');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.appointment_id, 15);
  });

  await t.test('6. TV1 Doctor CRUD: Thêm, Sửa, Đổi trạng thái, Xóa bác sĩ', async () => {
    const doctors = [
      { id: 1, doctor_id: 1, clinic_id: 1, full_name: 'BS. Cũ', specialty: 'Nội', phone: '0901111111', status: 'active' }
    ];

    const mockDocRepo = {
      async findById(clinicId, doctorId) {
        return doctors.find((d) => d.id === Number(doctorId)) || null;
      },
      async createDoctor(clinicId, data) {
        const newDoc = { id: 2, doctor_id: 2, clinic_id: Number(clinicId), ...data };
        doctors.push(newDoc);
        return newDoc;
      },
      async updateDoctor(clinicId, doctorId, data) {
        const doc = doctors.find((d) => d.id === Number(doctorId));
        if (!doc) return null;
        Object.assign(doc, data);
        return doc;
      },
      async updateStatus(clinicId, doctorId, status) {
        const doc = doctors.find((d) => d.id === Number(doctorId));
        if (!doc) return null;
        doc.status = status;
        return doc;
      },
      async hasActiveAppointments(clinicId, doctorId) {
        return Number(doctorId) === 1; // Bác sĩ 1 có lịch hẹn active
      },
      async deleteDoctor(clinicId, doctorId) {
        if (Number(doctorId) === 1) {
          throw new ConflictError('Không thể xóa bác sĩ đang có lịch khám!');
        }
        const idx = doctors.findIndex((d) => d.id === Number(doctorId));
        if (idx !== -1) doctors.splice(idx, 1);
        return true;
      }
    };

    const docService = new DoctorService(mockDocRepo);
    const app = createApp({ doctorRoutes: createDoctorRoutes(docService) });

    // Tạo bác sĩ mới
    const postRes = await request(app)
      .post('/api/v1/doctors')
      .send({
        clinic_id: 1,
        full_name: 'BS. Mới Tuyển',
        specialty: 'Khoa Ngoại',
        phone: '0902222222',
        status: 'active'
      });
    assert.equal(postRes.status, 201);
    assert.equal(postRes.body.data.full_name, 'BS. Mới Tuyển');

    // Sửa bác sĩ
    const putRes = await request(app)
      .put('/api/v1/doctors/2?clinic_id=1')
      .send({ full_name: 'BS. Mới Đổi Tên' });
    assert.equal(putRes.status, 200);
    assert.equal(putRes.body.data.full_name, 'BS. Mới Đổi Tên');

    // Đổi trạng thái
    const patchRes = await request(app)
      .patch('/api/v1/doctors/2/status?clinic_id=1')
      .send({ status: 'inactive' });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.status, 'inactive');

    // Chặn xóa bác sĩ đang có lịch hẹn (409 Conflict)
    const delConflictRes = await request(app)
      .delete('/api/v1/doctors/1?clinic_id=1');
    assert.equal(delConflictRes.status, 409);

    // Xóa bác sĩ không có lịch hẹn thành công
    const delRes = await request(app)
      .delete('/api/v1/doctors/2?clinic_id=1');
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.data.deleted_doctor_id, 2);
  });

});
