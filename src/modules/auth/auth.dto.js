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

module.exports = {
  validateLogin
};
