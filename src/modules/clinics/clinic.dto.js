const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Validate query params cho API Clinics
 */
function validateClinicQuery(query = {}) {
  let clinicId;
  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    clinicId = Number(query.clinic_id);
    if (![1, 2].includes(clinicId)) {
      throw new BadRequestError('Mã chi nhánh (clinic_id) không hợp lệ. Chỉ chấp nhận 1 hoặc 2.');
    }
  }
  return { clinic_id: clinicId };
}

/**
 * Validate ID chi nhánh phòng khám
 */
function validateClinicId(id) {
  const num = Number(id);
  if (id === undefined || id === null || isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    throw new BadRequestError('Mã chi nhánh (id) phải là số nguyên dương hợp lệ.');
  }
  return num;
}

/**
 * Validate payload tạo chi nhánh mới
 */
function validateCreateClinic(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ.');
  }

  const name = String(data.name || '').trim();
  if (!name || name.length < 3) {
    throw new BadRequestError('Tên chi nhánh phòng khám (name) là bắt buộc và tối thiểu 3 ký tự.');
  }

  const address = String(data.address || '').trim();
  if (!address) {
    throw new BadRequestError('Địa chỉ chi nhánh (address) là bắt buộc.');
  }

  const phone = String(data.phone || '').trim();
  if (!phone) {
    throw new BadRequestError('Số điện thoại liên hệ (phone) là bắt buộc.');
  }

  return { name, address, phone };
}

module.exports = {
  validateClinicQuery,
  validateClinicId,
  validateCreateClinic
};
