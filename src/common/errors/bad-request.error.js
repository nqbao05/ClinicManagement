/**
 * Custom Error đại diện cho lỗi Client gửi dữ liệu không hợp lệ (HTTP 400 Bad Request)
 */
class BadRequestError extends Error {
  /**
   * @param {string} [message]
   * @param {any} [details]
   */
  constructor(message = 'Dữ liệu yêu cầu không hợp lệ', details = null) {
    super(message);
    this.name = 'BadRequestError';
    this.statusCode = 400;
    this.code = 'BAD_REQUEST';
    if (details) {
      this.details = details;
    }
  }
}

module.exports = BadRequestError;
