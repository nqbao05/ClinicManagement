function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = error.statusCode || error.status || 500;
  const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const message = error.message || (status === 500 ? 'Không thể tạo lịch khám' : 'Lỗi xử lý yêu cầu');

  if (process.env.NODE_ENV !== 'test' && status === 500) {
    console.error(error);
  }

  res.status(status).json({
    code,
    message,
    ...(error.details ? { details: error.details } : {})
  });
}

module.exports = errorHandler;
