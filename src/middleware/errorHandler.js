function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Không thể tạo lịch khám' });
}

module.exports = errorHandler;
