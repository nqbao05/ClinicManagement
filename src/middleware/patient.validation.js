/**
 * Middleware xác thực dữ liệu đầu vào cho Module Bệnh nhân (Patient)
 * Đảm bảo tính toàn vẹn dữ liệu trước khi đi vào tầng Service/Repository
 */

const VALID_GENDERS = ['Nam', 'Nu', 'Khac'];
const VALID_BLOOD_TYPES = ['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CCCD_REGEX = /^[0-9]{9,12}$/;
const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate dữ liệu tạo mới hồ sơ bệnh nhân (POST /patients)
 */
function validateCreatePatient(req, res, next) {
  const { origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, blood_type } = req.body || {};
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

  next();
}

/**
 * Validate dữ liệu cập nhật hồ sơ bệnh nhân (PUT /patients/:id)
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

module.exports = {
  validateCreatePatient,
  validateUpdatePatient
};
