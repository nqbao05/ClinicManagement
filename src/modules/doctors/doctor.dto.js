const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Validate query params cho API Bác sĩ
 */
function validateDoctorQuery(query = {}) {
  const result = {};

  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    const clinicId = Number(query.clinic_id);
    if (![1, 2].includes(clinicId)) {
      throw new BadRequestError('Mã chi nhánh (clinic_id) không hợp lệ. Chỉ chấp nhận 1 hoặc 2.');
    }
    result.clinic_id = clinicId;
  }

  if (query.specialty !== undefined && query.specialty !== '') {
    result.specialty = String(query.specialty).trim();
  }

  if (query.status !== undefined && query.status !== '') {
    const status = String(query.status).trim().toLowerCase();
    if (!['active', 'inactive', 'all'].includes(status)) {
      throw new BadRequestError('Trạng thái bác sĩ (status) chỉ chấp nhận active, inactive hoặc all.');
    }
    if (status !== 'all') {
      result.status = status;
    }
  }

  if (query.search !== undefined && query.search !== '') {
    result.search = String(query.search).trim();
  }

  return result;
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

  let clinicId = 1;
  if (data.clinic_id !== undefined && data.clinic_id !== '') {
    clinicId = Number(data.clinic_id);
    if (isNaN(clinicId)) clinicId = 1;
  }

  const fullName = String(data.full_name || '').trim();
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError('Họ và tên bác sĩ (full_name) là bắt buộc và phải có ít nhất 2 ký tự.');
  }

  const specialty = String(data.specialty || '').trim();
  if (!specialty) {
    throw new BadRequestError('Chuyên khoa bác sĩ (specialty) là bắt buộc.');
  }

  let phone = data.phone ? String(data.phone).trim() : null;
  if (phone && !/^0\d{9}$/.test(phone)) {
    throw new BadRequestError('Số điện thoại liên hệ phải gồm 10 chữ số bắt đầu bằng số 0.');
  }

  let status = data.status ? String(data.status).trim().toLowerCase() : 'active';
  if (!['active', 'inactive'].includes(status)) {
    throw new BadRequestError('Trạng thái bác sĩ chỉ chấp nhận active hoặc inactive.');
  }

  return {
    clinic_id: clinicId,
    full_name: fullName,
    specialty,
    phone,
    status
  };
}

/**
 * Validate payload cập nhật bác sĩ
 */
function validateUpdateDoctor(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu cập nhật không hợp lệ.');
  }

  const updates = {};

  if (data.full_name !== undefined) {
    const fullName = String(data.full_name).trim();
    if (!fullName || fullName.length < 2) {
      throw new BadRequestError('Họ và tên bác sĩ phải có ít nhất 2 ký tự.');
    }
    updates.full_name = fullName;
  }

  if (data.specialty !== undefined) {
    const specialty = String(data.specialty).trim();
    if (!specialty) {
      throw new BadRequestError('Chuyên khoa không được để trống.');
    }
    updates.specialty = specialty;
  }

  if (data.phone !== undefined) {
    const phone = String(data.phone).trim();
    if (phone && !/^0\d{9}$/.test(phone)) {
      throw new BadRequestError('Số điện thoại liên hệ phải gồm 10 chữ số bắt đầu bằng số 0.');
    }
    updates.phone = phone || null;
  }

  if (data.status !== undefined) {
    const status = String(data.status).trim().toLowerCase();
    if (!['active', 'inactive'].includes(status)) {
      throw new BadRequestError('Trạng thái chỉ chấp nhận active hoặc inactive.');
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    throw new BadRequestError('Vui lòng cung cấp ít nhất một trường thông tin cần cập nhật.');
  }

  return updates;
}

/**
 * Validate cập nhật trạng thái bác sĩ
 */
function validateDoctorStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (!['active', 'inactive'].includes(normalized)) {
    throw new BadRequestError('Trạng thái (status) không hợp lệ. Chỉ chấp nhận active hoặc inactive.');
  }
  return normalized;
}

module.exports = {
  validateDoctorQuery,
  validateDoctorId,
  validateCreateDoctor,
  validateUpdateDoctor,
  validateDoctorStatus
};
