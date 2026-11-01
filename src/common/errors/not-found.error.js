/**
 * Custom Error đại diện cho lỗi không tìm thấy tài nguyên (HTTP 404 Not Found)
 */
class NotFoundError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = 'Không tìm thấy tài nguyên yêu cầu') {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.code = 'NOT_FOUND';
  }
}

module.exports = NotFoundError;
