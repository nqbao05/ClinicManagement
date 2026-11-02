const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Validate and sanitize login request payload
 * @param {Object} body 
 * @returns {{ username: string, password: string }}
 */
function validateLogin(body) {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu đăng nhập không hợp lệ');
  }

  const { username, password } = body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new BadRequestError('Vui lòng cung cấp tên đăng nhập (username)!');
  }

  if (!password || (typeof password !== 'string' && typeof password !== 'number')) {
    throw new BadRequestError('Vui lòng cung cấp mật khẩu (password)!');
  }

  const cleanUsername = String(username).trim();
  const cleanPassword = String(password);

  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    throw new BadRequestError('Tên đăng nhập phải có độ dài từ 3 đến 50 ký tự!');
  }

  if (cleanPassword.length < 4 || cleanPassword.length > 100) {
    throw new BadRequestError('Mật khẩu phải có độ dài từ 4 đến 100 ký tự!');
  }

  return {
    username: cleanUsername,
    password: cleanPassword
  };
}

/**
 * Validate and sanitize registration request payload
 * @param {Object} body 
 * @returns {{ username: string, password: string, role: string, clinic_id: number|null, full_name?: string, phone?: string }}
 */
function validateRegister(body) {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu đăng ký không hợp lệ');
  }

  const { username, password, confirm_password, role, clinic_id, full_name, phone } = body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    throw new BadRequestError('Vui lòng cung cấp tên đăng nhập (username)!');
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 50) {
    throw new BadRequestError('Tên đăng nhập phải có độ dài từ 3 đến 50 ký tự!');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
    throw new BadRequestError('Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới hoặc gạch ngang!');
  }

  if (!password || typeof password !== 'string') {
    throw new BadRequestError('Vui lòng cung cấp mật khẩu!');
  }
  if (password.length < 4 || password.length > 100) {
    throw new BadRequestError('Mật khẩu phải có độ dài từ 4 đến 100 ký tự!');
  }

  if (confirm_password !== undefined && confirm_password !== password) {
    throw new BadRequestError('Mật khẩu xác nhận không khớp!');
  }

  let userRole = 'patient';
  if (role) {
    const cleanRole = String(role).trim().toLowerCase();
    if (['admin', 'staff', 'patient'].includes(cleanRole)) {
      userRole = cleanRole;
    }
  }

  let clinicId = null;
  if (clinic_id) {
    const parsed = Number(clinic_id);
    if (parsed === 1 || parsed === 2) clinicId = parsed;
  } else if (userRole === 'staff') {
    clinicId = 1;
  }

  return {
    username: cleanUsername,
    password,
    role: userRole,
    clinic_id: clinicId,
    full_name: full_name ? String(full_name).trim() : cleanUsername,
    phone: phone ? String(phone).trim() : null
  };
}

module.exports = {
  validateLogin,
  validateRegister
};
