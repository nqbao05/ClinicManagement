const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Xác thực dữ liệu đầu vào khi đăng ký hồ sơ bệnh nhân mới
 * @param {Object} data - Payload từ client
 * @returns {Object} Dữ liệu bệnh nhân đã chuẩn hóa
 */
function validateCreatePatient(data = {}) {
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ. Payload phải là một JSON object.');
  }

  // 1. full_name: Bắt buộc, chuỗi từ 2 ký tự trở lên sau khi trim
  const fullName = String(data.full_name || '').trim();
  if (!fullName || fullName.length < 2) {
    throw new BadRequestError('Họ và tên bệnh nhân (full_name) là bắt buộc và phải có ít nhất 2 ký tự.');
  }

  // 2. citizen_id: Bắt buộc, đúng chuẩn CCCD Việt Nam gồm 12 chữ số
  // Hỗ trợ cả trường identity_card nếu client truyền vào
  const rawCitizenId = data.citizen_id || data.identity_card;
  const citizenId = String(rawCitizenId || '').trim();
  const citizenIdRegex = /^\d{12}$/;
  if (!citizenId || !citizenIdRegex.test(citizenId)) {
    throw new BadRequestError('Số Căn cước công dân (citizen_id) là bắt buộc và phải gồm đúng 12 chữ số.');
  }

  // 3. phone_number: Bắt buộc, chuẩn di động Việt Nam (10 chữ số bắt đầu bằng 0)
  const phoneNumber = String(data.phone_number || '').trim();
  const phoneRegex = /^0\d{9}$/;
  if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
    throw new BadRequestError('Số điện thoại (phone_number) là bắt buộc và phải đúng chuẩn di động Việt Nam (10 chữ số bắt đầu bằng 0).');
  }

  // 4. origin_clinic_id: Bắt buộc, khóa phân mảnh Sharding Key (1: Hà Nội, 2: TP.HCM)
  const originClinicId = Number(data.origin_clinic_id);
  if (![1, 2].includes(originClinicId)) {
    throw new BadRequestError('Mã cơ sở gốc (origin_clinic_id) không hợp lệ. Chỉ chấp nhận 1 (Hà Nội) hoặc 2 (TP.HCM).');
  }

  // 5. date_of_birth: Bắt buộc, định dạng YYYY-MM-DD và phải ở quá khứ
  const dobStr = String(data.date_of_birth || '').trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobStr || !dateRegex.test(dobStr)) {
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

  // 6. gender: Tùy chọn, chuẩn hóa về 'Male', 'Female', 'Other' (hoặc 'Nam', 'Nu', 'Khac')
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
  const normalizedGender = genderMap[gender];
  if (!normalizedGender) {
    throw new BadRequestError('Giới tính (gender) không hợp lệ. Chỉ chấp nhận Male, Female hoặc Other.');
  }

  // 7. address: Chuỗi tùy chọn
  const address = data.address !== undefined && data.address !== null ? String(data.address).trim() : null;

  return {
    full_name: fullName,
    citizen_id: citizenId,
    identity_card: citizenId, // Alias cho tầng CSDL MySQL
    phone_number: phoneNumber,
    origin_clinic_id: originClinicId,
    date_of_birth: dobStr,
    gender: normalizedGender,
    address
  };
}

/**
 * Xác thực và chuẩn hóa query parameters khi tìm kiếm / phân trang hồ sơ bệnh nhân
 * @param {Object} query - Query params từ client
 * @returns {Object} Query params đã chuẩn hóa kèm offset phân trang
 */
function validatePatientSearchQuery(query = {}) {
  const citizenId = query.citizen_id ? String(query.citizen_id).trim() : undefined;
  const phoneNumber = query.phone_number ? String(query.phone_number).trim() : undefined;

  let clinicId;
  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    const parsedClinicId = Number(query.clinic_id);
    if (![1, 2].includes(parsedClinicId)) {
      throw new BadRequestError('Mã chi nhánh (clinic_id) tìm kiếm không hợp lệ. Chỉ chấp nhận 1 hoặc 2.');
    }
    clinicId = parsedClinicId;
  }

  // Phân trang
  let page = 1;
  if (query.page !== undefined) {
    page = parseInt(query.page, 10);
    if (isNaN(page) || page < 1) {
      throw new BadRequestError('Tham số trang (page) phải là số nguyên dương lớn hơn hoặc bằng 1.');
    }
  }

  let limit = 20;
  if (query.limit !== undefined) {
    limit = parseInt(query.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new BadRequestError('Tham số giới hạn (limit) phải là số nguyên từ 1 đến 100.');
    }
  }

  const offset = (page - 1) * limit;

  return {
    citizen_id: citizenId,
    phone_number: phoneNumber,
    clinic_id: clinicId,
    page,
    limit,
    offset
  };
}

module.exports = {
  validateCreatePatient,
  validatePatientSearchQuery
};
