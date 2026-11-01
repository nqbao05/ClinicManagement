const BadRequestError = require('../../common/errors/bad-request.error');

/**
 * Xác thực dữ liệu tạo lịch hẹn khám bệnh mới
 * @param {Object} data - Payload gửi lên từ client
 * @returns {Object} Dữ liệu đã chuẩn hóa và xác thực
 */
function validateCreateAppointment(data) {
  if (!data || typeof data !== 'object') {
    throw new BadRequestError('Dữ liệu yêu cầu không hợp lệ hoặc rỗng');
  }

  // 1. Validate patient_id
  const patientId = Number(data.patient_id);
  if (!data.patient_id || !Number.isInteger(patientId) || patientId <= 0) {
    throw new BadRequestError('patient_id là bắt buộc và phải là số nguyên dương');
  }

  // 2. Validate doctor_id
  const doctorId = Number(data.doctor_id);
  if (!data.doctor_id || !Number.isInteger(doctorId) || doctorId <= 0) {
    throw new BadRequestError('doctor_id là bắt buộc và phải là số nguyên dương');
  }

  // 3. Validate clinic_id (Khóa Sharding node CSDL: 1 - Hà Nội, 2 - TP.HCM)
  const clinicId = Number(data.clinic_id);
  if (!data.clinic_id || !Number.isInteger(clinicId) || ![1, 2].includes(clinicId)) {
    throw new BadRequestError('clinic_id là bắt buộc và chỉ chấp nhận 1 (Node Hà Nội) hoặc 2 (Node TP.HCM)');
  }

  // 4. Validate slot_time
  if (!data.slot_time || typeof data.slot_time !== 'string') {
    throw new BadRequestError('slot_time là bắt buộc và phải là chuỗi thời gian hợp lệ');
  }

  const slotDate = new Date(data.slot_time);
  if (isNaN(slotDate.getTime())) {
    throw new BadRequestError('slot_time không đúng định dạng Datetime hợp lệ');
  }

  // Kiểm tra thời gian phải ở tương lai
  if (slotDate.getTime() <= Date.now()) {
    throw new BadRequestError('Thời gian hẹn khám (slot_time) phải ở thời điểm tương lai');
  }

  // Trích xuất giờ và phút (hỗ trợ cả định dạng ISO có T hoặc khoảng trắng)
  const timeMatch = data.slot_time.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : slotDate.getHours();
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : slotDate.getMinutes();

  // Kiểm tra khung giờ làm việc: 08:00 - 11:30 và 13:30 - 17:00
  const isMorning = (hour >= 8 && hour < 11) || (hour === 11 && minute <= 30);
  const isAfternoon = (hour === 13 && minute >= 30) || (hour >= 14 && hour < 17) || (hour === 17 && minute === 0);

  if (!isMorning && !isAfternoon) {
    throw new BadRequestError(
      'Chỉ cho phép đặt lịch trong giờ hành chính: Buổi sáng (08:00 - 11:30) hoặc Buổi chiều (13:30 - 17:00)'
    );
  }

  // Chuẩn hóa phút: Phút phải là bội số của 15 hoặc 30 (00, 15, 30, 45)
  if (minute % 15 !== 0) {
    throw new BadRequestError(
      'Phút của khung giờ hẹn khám phải là bội số của 15 hoặc 30 phút (VD: 08:00, 08:15, 08:30, 08:45)'
    );
  }

  // Chuẩn hóa format MySQL Datetime: YYYY-MM-DD HH:mm:ss
  const pad = (n) => String(n).padStart(2, '0');
  const dateMatch = data.slot_time.match(/^(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch
    ? dateMatch[1]
    : `${slotDate.getFullYear()}-${pad(slotDate.getMonth() + 1)}-${pad(slotDate.getDate())}`;
  const formattedSlotTime = `${dateStr} ${pad(hour)}:${pad(minute)}:00`;

  return {
    patient_id: patientId,
    doctor_id: doctorId,
    clinic_id: clinicId,
    slot_time: formattedSlotTime
  };
}

/**
 * Xác thực query parameters cho danh sách lịch hẹn
 * @param {Object} query 
 * @returns {Object}
 */
function validateAppointmentQuery(query = {}) {
  const result = {
    status: null,
    doctor_id: null,
    clinic_id: null,
    date: null,
    page: 1,
    limit: 20,
    offset: 0
  };

  if (query.status) {
    const validStatuses = ['Pending', 'Confirmed', 'Cancelled'];
    if (!validStatuses.includes(query.status)) {
      throw new BadRequestError(`Trạng thái status không hợp lệ. Chỉ chấp nhận: ${validStatuses.join(', ')}`);
    }
    result.status = query.status;
  }

  if (query.doctor_id !== undefined && query.doctor_id !== '') {
    const doctorId = Number(query.doctor_id);
    if (!Number.isInteger(doctorId) || doctorId <= 0) {
      throw new BadRequestError('doctor_id tìm kiếm phải là số nguyên dương');
    }
    result.doctor_id = doctorId;
  }

  if (query.clinic_id !== undefined && query.clinic_id !== '') {
    const clinicId = Number(query.clinic_id);
    if (!Number.isInteger(clinicId) || ![1, 2].includes(clinicId)) {
      throw new BadRequestError('clinic_id chỉ chấp nhận giá trị 1 hoặc 2');
    }
    result.clinic_id = clinicId;
  }

  if (query.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
      throw new BadRequestError('Định dạng date phải theo chuẩn YYYY-MM-DD (Ví dụ: 2026-11-05)');
    }
    result.date = query.date;
  }

  // Pagination
  if (query.page !== undefined && query.page !== '') {
    const page = Number(query.page);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestError('page phải là số nguyên dương lớn hơn hoặc bằng 1');
    }
    result.page = page;
  }

  if (query.limit !== undefined && query.limit !== '') {
    const limit = Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestError('limit phải là số nguyên từ 1 đến 100');
    }
    result.limit = limit;
  }

  result.offset = (result.page - 1) * result.limit;
  return result;
}

module.exports = {
  validateCreateAppointment,
  validateAppointmentQuery
};
