/**
 * Custom Error đại diện cho lỗi xung đột dữ liệu hoặc trùng lặp tài nguyên (HTTP 409 Conflict)
 * Đặc biệt dùng cho kịch bản Concurrency Control / Race Condition đặt trùng slot khám
 */
class ConflictError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = 'Xung đột dữ liệu hoặc tài nguyên đã có người sử dụng') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.code = 'CONFLICT';
  }
}

module.exports = ConflictError;
