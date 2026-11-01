/**
 * Custom Error đại diện cho lỗi máy chủ nội bộ (HTTP 500 Internal Server Error)
 */
class InternalServerError extends Error {
  /**
   * @param {string} [message]
   * @param {any} [details]
   */
  constructor(message = 'Lỗi máy chủ nội bộ', details = null) {
    super(message);
    this.name = 'InternalServerError';
    this.statusCode = 500;
    this.code = 'INTERNAL_SERVER_ERROR';
    if (details) {
      this.details = details;
    }
  }
}

module.exports = InternalServerError;
