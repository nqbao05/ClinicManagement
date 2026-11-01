const test = require('node:test');
const assert = require('node:assert/strict');

const { validateClinicQuery, validateClinicId } = require('../../src/modules/clinics/clinic.dto');
const { validateDoctorQuery, validateDoctorId } = require('../../src/modules/doctors/doctor.dto');
const ClinicService = require('../../src/modules/clinics/clinic.service');
const DoctorService = require('../../src/modules/doctors/doctor.service');
const { BadRequestError, NotFoundError } = require('../../src/common/errors');

test('TV1 DTO Validation - Clinic & Doctor', async (t) => {
  await t.test('validateClinicQuery validates clinic_id correctly', () => {
    assert.deepEqual(validateClinicQuery({}), { clinic_id: undefined });
    assert.deepEqual(validateClinicQuery({ clinic_id: '1' }), { clinic_id: 1 });
    assert.throws(() => validateClinicQuery({ clinic_id: '99' }), BadRequestError);
  });

  await t.test('validateClinicId parses positive integer ID', () => {
    assert.equal(validateClinicId('1'), 1);
    assert.equal(validateClinicId(2), 2);
    assert.throws(() => validateClinicId('abc'), BadRequestError);
    assert.throws(() => validateClinicId('-5'), BadRequestError);
  });

  await t.test('validateDoctorQuery sanitizes search parameters', () => {
    assert.deepEqual(validateDoctorQuery({ clinic_id: '2', specialty: '  Nhi  ' }), {
      clinic_id: 2,
      specialty: 'Nhi'
    });
    assert.throws(() => validateDoctorQuery({ clinic_id: 'invalid' }), BadRequestError);
  });

  await t.test('validateDoctorId parses positive doctor ID', () => {
    assert.equal(validateDoctorId('10'), 10);
    assert.throws(() => validateDoctorId('xyz'), BadRequestError);
  });
});

test('TV1 Service - ClinicService Unit Tests', async (t) => {
  const mockRepo = {
    async findAll() {
      return [
        { clinic_id: 1, name: 'Phòng khám Đa khoa Quốc tế Hà Nội', code: 'HN-01' },
        { clinic_id: 2, name: 'Phòng khám Đa khoa Quốc tế TP.HCM', code: 'HCM-01' }
      ];
    },
    async findById(id) {
      if (id === 1) return { clinic_id: 1, name: 'Phòng khám Đa khoa Quốc tế Hà Nội' };
      if (id === 2) return { clinic_id: 2, name: 'Phòng khám Đa khoa Quốc tế TP.HCM' };
      return null;
    }
  };

  const service = new ClinicService(mockRepo);

  await t.test('getClinics returns all clinics across nodes', async () => {
    const clinics = await service.getClinics();
    assert.equal(clinics.length, 2);
  });

  await t.test('getClinics filters by clinic_id', async () => {
    const clinics = await service.getClinics({ clinic_id: '1' });
    assert.equal(clinics.length, 1);
    assert.equal(clinics[0].clinic_id, 1);
  });

  await t.test('getClinicById returns clinic when exists', async () => {
    const clinic = await service.getClinicById(1);
    assert.equal(clinic.clinic_id, 1);
  });

  await t.test('getClinicById throws NotFoundError when not found', async () => {
    await assert.rejects(
      async () => await service.getClinicById(99),
      NotFoundError
    );
  });
});

test('TV1 Service - DoctorService Unit Tests', async (t) => {
  const mockRepo = {
    async findAll(specialty) {
      const all = [
        { doctor_id: 1, clinic_id: 1, full_name: 'Dr. Nguyễn Văn A', specialty: 'Tim Mạch' },
        { doctor_id: 2, clinic_id: 2, full_name: 'Dr. Trần Thị B', specialty: 'Nhi Khoa' }
      ];
      if (specialty) {
        return all.filter((d) => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
      }
      return all;
    },
    async findByClinic(clinicId, specialty) {
      const all = await this.findAll(specialty);
      return all.filter((d) => d.clinic_id === clinicId);
    },
    async findById(clinicId, doctorId) {
      if (doctorId === 1) return { doctor_id: 1, clinic_id: clinicId, full_name: 'Dr. Nguyễn Văn A', specialty: 'Tim Mạch' };
      return null;
    }
  };

  const service = new DoctorService(mockRepo);

  await t.test('getDoctors filters by clinic_id', async () => {
    const doctors = await service.getDoctors({ clinic_id: 1 });
    assert.equal(doctors.length, 1);
    assert.equal(doctors[0].doctor_id, 1);
  });

  await t.test('getDoctors filters by specialty across nodes', async () => {
    const doctors = await service.getDoctors({ specialty: 'Nhi' });
    assert.equal(doctors.length, 1);
    assert.equal(doctors[0].specialty, 'Nhi Khoa');
  });

  await t.test('getDoctorById returns doctor detail', async () => {
    const doctor = await service.getDoctorById(1, 1);
    assert.equal(doctor.full_name, 'Dr. Nguyễn Văn A');
  });

  await t.test('getDoctorById throws NotFoundError when doctor does not exist', async () => {
    await assert.rejects(
      async () => await service.getDoctorById(999),
      NotFoundError
    );
  });
});
