/**
 * Custom Error đại diện cho lỗi chưa xác thực hoặc token không hợp lệ (HTTP 401 Unauthorized)
 */
class UnauthorizedError extends Error {
  /**
   * @param {string} [message]
   * @param {any} [details]
   */
  constructor(message = 'Yêu cầu token xác thực hợp lệ', details = null) {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
    this.code = 'UNAUTHORIZED';
    if (details) {
      this.details = details;
    }
  }
}

module.exports = UnauthorizedError;
