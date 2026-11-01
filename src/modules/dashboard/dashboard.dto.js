const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Xác thực và chuẩn hóa query parameters cho Dashboard Thống kê
 * @param {Object} query - Query parameters từ client { from_date, to_date }
 * @returns {Object} { fromDate, toDate, fromDatetime, toDatetime }
 */
function validateDashboardQuery(query = {}) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // 1. Kiểm tra định dạng nếu client có truyền tham số
  if (query.from_date && !dateRegex.test(query.from_date)) {
    throw new BadRequestError('Định dạng from_date không hợp lệ. Phải theo chuẩn YYYY-MM-DD (Ví dụ: 2026-10-01)');
  }

  if (query.to_date && !dateRegex.test(query.to_date)) {
    throw new BadRequestError('Định dạng to_date không hợp lệ. Phải theo chuẩn YYYY-MM-DD (Ví dụ: 2026-11-01)');
  }

  // 2. Mặc định an toàn (Default Time Window): 30 ngày gần nhất nếu để trống
  const toDate = query.to_date || formatYmd(now);
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate = query.from_date || formatYmd(defaultFrom);

  // 3. Chuẩn hóa Datetime tối ưu hóa Index CSDL (Tránh dùng hàm DATE(slot_time) làm mất index B-Tree)
  const fromDatetime = `${fromDate} 00:00:00`;
  const toDatetime = `${toDate} 23:59:59`;

  // 4. Kiểm tra logic khoảng thời gian: fromDate <= toDate
  if (new Date(fromDatetime).getTime() > new Date(toDatetime).getTime()) {
    throw new BadRequestError('Khoảng thời gian không hợp lệ: from_date không được lớn hơn to_date');
  }

  return {
    fromDate,
    toDate,
    fromDatetime,
    toDatetime
  };
}

module.exports = {
  validateDashboardQuery
};
