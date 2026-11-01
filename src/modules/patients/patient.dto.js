const BadRequestError = require('../../common/errors/bad-request.error');

const VALID_GENDERS = ['Nam', 'Nu', 'Khac', 'Male', 'Female', 'Other'];
const VALID_BLOOD_TYPES = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CCCD_REGEX = /^[0-9]{9,12}$/;
const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Xác thực dữ liệu tạo mới hồ sơ bệnh nhân
 * Hỗ trợ cả 2 dạng: DTO validator pure function hoặc Express Middleware
 */
function validateCreatePatient(reqOrData = {}, res, next) {
  // 1. Dạng Express Middleware: (req, res, next)
  if (res && typeof next === 'function') {
    const { origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, blood_type } = reqOrData.body || {};
    const errors = [];

    if (origin_clinic_id === undefined || origin_clinic_id === null || isNaN(Number(origin_clinic_id)) || Number(origin_clinic_id) <= 0) {
      errors.push('origin_clinic_id bắt buộc và phải là số nguyên dương (Mã chi nhánh)');
    }

    if (!identity_card || typeof identity_card !== 'string' || !CCCD_REGEX.test(identity_card.trim())) {
      errors.push('identity_card bắt buộc và phải gồm 9 đến 12 chữ số (CCCD/CMND)');
    }

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length === 0) {
      errors.push('full_name bắt buộc và không được để trống');
    }

    if (!phone_number || typeof phone_number !== 'string' || !PHONE_REGEX.test(phone_number.trim())) {
      errors.push('phone_number không đúng định dạng số điện thoại hợp lệ (VD: 0901234567)');
    }

    if (gender && !VALID_GENDERS.includes(gender)) {
      errors.push(`gender không hợp lệ, chỉ chấp nhận: ${VALID_GENDERS.join(', ')}`);
    }

    if (date_of_birth && (!DATE_REGEX.test(date_of_birth) || isNaN(Date.parse(date_of_birth)))) {
      errors.push('date_of_birth không đúng định dạng YYYY-MM-DD');
    }

    if (blood_type && !VALID_BLOOD_TYPES.includes(blood_type.toUpperCase())) {
      errors.push(`blood_type không hợp lệ, chấp nhận: ${VALID_BLOOD_TYPES.join(', ')}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu đầu vào không hợp lệ',
        details: errors
      });
    }

    return next();
  }

  // 2. Dạng DTO Validator Function: validateCreatePatient(data)
  const data = reqOrData;
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ. Payload phải là một JSON object.');
  }

  const fullName = String(data.full_name || '').trim();
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError('Họ và tên bệnh nhân (full_name) là bắt buộc và phải có ít nhất 2 ký tự.');
  }

  const rawCitizenId = data.citizen_id || data.identity_card;
  const citizenId = String(rawCitizenId || '').trim();
  const citizenIdRegex = /^\d{12}$/;
  if (!citizenId || !citizenIdRegex.test(citizenId)) {
    throw new BadRequestError('Số Căn cước công dân (citizen_id) là bắt buộc và phải gồm đúng 12 chữ số.');
  }

  const phoneNumber = String(data.phone_number || '').trim();
  const phoneRegex = /^0\d{9}$/;
  if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
    throw new BadRequestError('Số điện thoại (phone_number) là bắt buộc và phải đúng chuẩn di động Việt Nam (10 chữ số bắt đầu bằng 0).');
  }

  const originClinicId = Number(data.origin_clinic_id);
  if (![1, 2].includes(originClinicId)) {
    throw new BadRequestError('Mã cơ sở gốc (origin_clinic_id) không hợp lệ. Chỉ chấp nhận 1 (Hà Nội) hoặc 2 (TP.HCM).');
  }

  const dobStr = String(data.date_of_birth || '').trim();
  if (!dobStr || !DATE_REGEX.test(dobStr)) {
    throw new BadRequestError('Ngày sinh (date_of_birth) là bắt buộc và phải đúng định dạng YYYY-MM-DD (Ví dụ: 1990-05-15).');
  }
  const dobDate = new Date(`${dobStr}T00:00:00Z`);
  if (isNaN(dobDate.getTime())) {
    throw new BadRequestError('Ngày sinh không phải là ngày hợp lệ.');
  }
  const now = new Date();
  if (dobDate >= now) {
    throw new BadRequestError('Ngày sinh phải nhỏ hơn ngày hiện tại.');
  }

  let gender = String(data.gender || 'Other').trim();
  const genderMap = {
    'Male': 'Male',
    'Female': 'Female',
    'Other': 'Other',
    'Nam': 'Male',
    'Nu': 'Female',
    'Nữ': 'Female',
    'Khac': 'Other',
    'Khác': 'Other'
  };
  gender = genderMap[gender] || 'Other';

  const address = data.address ? String(data.address).trim() : null;

  return {
    origin_clinic_id: originClinicId,
    citizen_id: citizenId,
    identity_card: citizenId,
    full_name: fullName,
    phone_number: phoneNumber,
    gender,
    date_of_birth: dobStr,
    address
  };
}

/**
 * Middleware xác thực dữ liệu cập nhật hồ sơ bệnh nhân (PUT /patients/:id)
 */
function validateUpdatePatient(req, res, next) {
  const { identity_card, phone_number, gender, date_of_birth, blood_type } = req.body || {};
  const errors = [];

  if (identity_card !== undefined && (typeof identity_card !== 'string' || !CCCD_REGEX.test(identity_card.trim()))) {
    errors.push('identity_card phải gồm 9 đến 12 chữ số (CCCD/CMND)');
  }

  if (phone_number !== undefined && (typeof phone_number !== 'string' || !PHONE_REGEX.test(phone_number.trim()))) {
    errors.push('phone_number không đúng định dạng số điện thoại hợp lệ');
  }

  if (gender !== undefined && !VALID_GENDERS.includes(gender)) {
    errors.push(`gender không hợp lệ, chỉ chấp nhận: ${VALID_GENDERS.join(', ')}`);
  }

  if (date_of_birth !== undefined && (!DATE_REGEX.test(date_of_birth) || isNaN(Date.parse(date_of_birth)))) {
    errors.push('date_of_birth không đúng định dạng YYYY-MM-DD');
  }

  if (blood_type !== undefined && !VALID_BLOOD_TYPES.includes(blood_type.toUpperCase())) {
    errors.push(`blood_type không hợp lệ, chấp nhận: ${VALID_BLOOD_TYPES.join(', ')}`);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu cập nhật không hợp lệ',
      details: errors
    });
  }

  next();
}

/**
 * Validate query params cho API tìm kiếm bệnh nhân
 */
function validatePatientSearchQuery(query = {}) {
  let clinicId;
  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    clinicId = Number(query.clinic_id);
    if (![1, 2].includes(clinicId)) {
      throw new BadRequestError('Tham số clinic_id không hợp lệ. Chỉ chấp nhận 1 hoặc 2.');
    }
  }

  let page = Number(query.page) || 1;
  if (page < 1) page = 1;

  let limit = Number(query.limit) || 20;
  if (limit < 1 || limit > 100) limit = 20;

  const offset = (page - 1) * limit;

  return {
    clinic_id: clinicId,
    q: query.q ? String(query.q).trim() : undefined,
    citizen_id: query.citizen_id ? String(query.citizen_id).trim() : undefined,
    phone_number: query.phone_number ? String(query.phone_number).trim() : undefined,
    page,
    limit,
    offset
  };
}

module.exports = {
  validateCreatePatient,
  validateUpdatePatient,
  validatePatientSearchQuery
};
