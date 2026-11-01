/**
 * Middleware xử lý và chuẩn hóa lỗi tập trung cho toàn bộ ứng dụng Express
 * Chuẩn hóa cấu trúc JSON: { success: false, statusCode, code, message, ...(details && { details }) }
 */
function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.statusCode || error.status || 500;
  const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const message = error.message || (status === 500 ? 'Không thể xử lý yêu cầu' : 'Lỗi xử lý yêu cầu');

  if (process.env.NODE_ENV !== 'test' && status === 500) {
    console.error('[Error Middleware]:', error);
  }

  res.status(status).json({
    success: false,
    statusCode: status,
    code,
    message,
    ...(error.details ? { details: error.details } : {})
  });
}

module.exports = errorMiddleware;
