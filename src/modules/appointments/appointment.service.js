const NotFoundError = require('../../common/errors/not-found.error');
const ConflictError = require('../../common/errors/conflict.error');
const BadRequestError = require('../../common/errors/bad-request.error');
const ForbiddenError = require('../../common/errors/forbidden.error');
const { validateAppointmentQuery } = require('./appointment.dto');
const Appointment = require('./appointment.model');

class SlotConflictError extends Error {
  constructor(message = 'Lịch đã được người khác đặt') {
    super(message);
    this.name = 'SlotConflictError';
    this.code = 'APPOINTMENT_SLOT_CONFLICT';
    this.statusCode = 409;
  }
}

/**
 * Service Layer: Xử lý toàn bộ logic nghiệp vụ cốt lõi của Đặt lịch khám (Appointments)
 * Áp dụng mô hình phòng thủ 2 lớp (Two-Phase Concurrency Control):
 * - Lớp 1 (Pessimistic Lock): SELECT ... FOR UPDATE trong Transaction ở tầng Repository.
 * - Lớp 2 (Optimistic Fallback): Bắt lỗi ràng buộc UNIQUE (ER_DUP_ENTRY / 1062) ở tầng CSDL.
 */
class AppointmentService {
  /**
   * @param {Object} appointmentRepository - Instance của AppointmentRepository
   */
  constructor(appointmentRepository) {
    this.appointmentRepository = appointmentRepository;
    this.repository = appointmentRepository;
  }

  /**
   * Đặt lịch khám chuẩn baseline (tương thích tests/appointment.test.js)
   */
  createBooking({ patientId, doctorId, clinicId, slotTime }) {
    const parsedTime = new Date(slotTime);
    if (!slotTime || Number.isNaN(parsedTime.getTime())) {
      const error = new Error('slotTime không hợp lệ');
      error.code = 'INVALID_SLOT_TIME';
      error.statusCode = 400;
      throw error;
    }

    const normalizedSlot = parsedTime.toISOString();
    const existing = this.appointmentRepository.findActiveByDoctorAndSlot(doctorId, normalizedSlot);
    if (existing) throw new SlotConflictError();

    try {
      return this.appointmentRepository.create(new Appointment({
        patient_id: patientId,
        doctor_id: doctorId,
        clinic_id: clinicId,
        slot_time: normalizedSlot,
        status: 'Pending'
      }));
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === 'SQLITE_CONSTRAINT') {
        throw new SlotConflictError();
      }
      throw error;
    }
  }

  /**
   * Đặt lịch khám bệnh mới V1
   */
  async bookAppointment(payload) {
    const { clinic_id, doctor_id, patient_id, slot_time } = payload;

    // 1. Kiểm tra bác sĩ có công tác tại đúng chi nhánh tiếp nhận không
    const doctor = await this.appointmentRepository.findDoctorById(clinic_id, doctor_id);
    if (!doctor) {
      throw new NotFoundError(
        `Bác sĩ với mã #${doctor_id} không tồn tại hoặc không làm việc tại Cơ sở ${clinic_id === 1 ? 'Hà Nội' : 'TP.HCM'}`
      );
    }

    // 2. Ngăn chặn một bệnh nhân đặt trùng 2 ca khám cùng lúc
    const isDoubleBooked = await this.appointmentRepository.checkPatientDoubleBooking(
      clinic_id,
      patient_id,
      slot_time
    );
    if (isDoubleBooked) {
      throw new ConflictError('Bệnh nhân đã có một lịch hẹn khám khác trong cùng khung giờ này!');
    }

    // 3. Thực thi Transaction đặt lịch và phòng thủ Race Condition 2 lớp
    try {
      const newAppointment = await this.appointmentRepository.createAppointmentWithTransaction(
        clinic_id,
        payload
      );
      return {
        ...newAppointment,
        doctor_name: doctor.full_name,
        specialty: doctor.specialty
      };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictError('Khung giờ này của bác sĩ vừa được một người khác hoàn tất đặt trước!');
      }
      throw error;
    }
  }

  /**
   * Lấy danh sách lịch hẹn khám kèm phân trang (kèm logic phân quyền RBAC)
   * - admin: Xem toàn bộ
   * - staff: Giới hạn theo clinic_id của nhân viên
   * - patient: Tự động lọc chỉ xem lịch hẹn của chính mình
   */
  async getAppointments(clinicId, rawQuery = {}, user = null) {
    const query = { ...rawQuery };
    if (user) {
      if (user.role === 'patient') {
        query.patient_id = user.patient_id;
      } else if (user.role === 'staff' && user.clinic_id) {
        clinicId = user.clinic_id;
      }
    }

    const validatedQuery = validateAppointmentQuery(query);
    const effectiveClinicId = Number(validatedQuery.clinic_id || clinicId || 1);

    const { rows, total } = await this.appointmentRepository.findAppointments(
      effectiveClinicId,
      { ...validatedQuery, ...(query.patient_id ? { patient_id: query.patient_id } : {}) }
    );

    const totalPages = Math.ceil(total / validatedQuery.limit) || 1;

    return {
      data: rows,
      pagination: {
        total,
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalPages,
        hasNext: validatedQuery.page < totalPages,
        hasPrev: validatedQuery.page > 1
      }
    };
  }

  /**
   * Cập nhật trạng thái lịch hẹn khám (RBAC & State Machine)
   * - admin, staff: Được phép cập nhật 'Confirmed', 'Completed', 'Cancelled'
   * - patient: Chỉ được hủy ('Cancelled') lịch hẹn của chính mình khi trạng thái là 'Pending'
   */
  async updateStatus(appointmentId, newStatus, clinicId = 1, user = null) {
    const validStatuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestError(`Trạng thái không hợp lệ. Cho phép: ${validStatuses.join(', ')}`);
    }

    const appointment = await this.appointmentRepository.findById(clinicId, appointmentId);
    if (!appointment) {
      throw new NotFoundError(`Không tìm thấy lịch hẹn #${appointmentId}`);
    }

    if (user && user.role === 'patient') {
      if (appointment.patient_id !== user.patient_id) {
        throw new ForbiddenError('Không thể thao tác trên lịch hẹn của bệnh nhân khác!');
      }
      if (newStatus !== 'Cancelled') {
        throw new ForbiddenError('Bệnh nhân chỉ có quyền hủy lịch hẹn!');
      }
      if (appointment.status !== 'Pending') {
        throw new ConflictError('Chỉ có thể hủy lịch hẹn đang ở trạng thái Chờ xác nhận (Pending)!');
      }
    }

    return await this.appointmentRepository.updateStatus(clinicId, appointmentId, newStatus);
  }
}

AppointmentService.SlotConflictError = SlotConflictError;
AppointmentService.AppointmentService = AppointmentService;

module.exports = AppointmentService;
module.exports.AppointmentService = AppointmentService;
module.exports.SlotConflictError = SlotConflictError;
