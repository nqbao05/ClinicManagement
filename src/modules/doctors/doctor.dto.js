const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Validate query params cho API Bác sĩ
 */
function validateDoctorQuery(query = {}) {
  let clinicId;
  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    clinicId = Number(query.clinic_id);
    if (![1, 2].includes(clinicId)) {
      throw new BadRequestError('Mã chi nhánh (clinic_id) không hợp lệ. Chỉ chấp nhận 1 hoặc 2.');
    }
  }

  const specialty = query.specialty ? String(query.specialty).trim() : undefined;

  return {
    clinic_id: clinicId,
    specialty
  };
}

/**
 * Validate mã bác sĩ (doctor_id)
 */
function validateDoctorId(id) {
  const num = Number(id);
  if (id === undefined || id === null || isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    throw new BadRequestError('Mã bác sĩ (id) phải là số nguyên dương hợp lệ.');
  }
  return num;
}

/**
 * Validate payload tạo bác sĩ mới
 */
function validateCreateDoctor(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.');
  }

  const clinicId = Number(data.clinic_id);
  if (![1, 2].includes(clinicId)) {
    throw new BadRequestError('Mã chi nhánh (clinic_id) là bắt buộc và phải là 1 hoặc 2.');
  }

  const fullName = String(data.full_name || '').trim();
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError('Họ và tên bác sĩ (full_name) là bắt buộc và phải có ít nhất 2 ký tự.');
  }

  const specialty = String(data.specialty || '').trim();
  if (!specialty) {
    throw new BadRequestError('Chuyên khoa bác sĩ (specialty) là bắt buộc.');
  }

  return {
    clinic_id: clinicId,
    full_name: fullName,
    specialty
  };
}

module.exports = {
  validateDoctorQuery,
  validateDoctorId,
  validateCreateDoctor
};
