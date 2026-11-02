/**
 * Custom Error đại diện cho lỗi không có quyền truy cập tài nguyên (HTTP 403 Forbidden)
 */
class ForbiddenError extends Error {
  /**
   * @param {string} [message]
   * @param {any} [details]
   */
  constructor(message = 'Bạn không có quyền thực hiện hành động này!', details = null) {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
    this.code = 'FORBIDDEN';
    if (details) {
      this.details = details;
    }
  }
}

module.exports = ForbiddenError;
