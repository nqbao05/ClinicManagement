/**
 * Helper chuẩn hóa phản hồi HTTP Success Response cho toàn hệ thống
 * @param {import('express').Response} res 
 * @param {number} [statusCode=200]
 * @param {string} [message='Thành công']
 * @param {any} [payload=null]
 */
function sendSuccess(res, statusCode = 200, message = 'Thành công', payload = null) {
  const response = {
    success: true,
    statusCode,
    message
  };

  if (payload && typeof payload === 'object' && payload.pagination !== undefined && payload.data !== undefined) {
    response.data = payload.data;
    response.pagination = payload.pagination;
  } else if (payload !== null && payload !== undefined) {
    response.data = payload;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  sendSuccess
};
