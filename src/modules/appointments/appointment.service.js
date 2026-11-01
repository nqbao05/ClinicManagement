const NotFoundError = require('../../common/errors/not-found.error');
const ConflictError = require('../../common/errors/conflict.error');
const { validateAppointmentQuery } = require('./appointment.dto');

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
  }

  /**
   * Đặt lịch khám bệnh mới
   * @param {Object} payload - { patient_id, doctor_id, clinic_id, slot_time }
   * @returns {Promise<Object>}
   */
  async bookAppointment(payload) {
    const { clinic_id, doctor_id, patient_id, slot_time } = payload;

    // 1. Nghiệp vụ: Kiểm tra bác sĩ có công tác tại đúng chi nhánh tiếp nhận không
    const doctor = await this.appointmentRepository.findDoctorById(clinic_id, doctor_id);
    if (!doctor) {
      throw new NotFoundError(
        `Bác sĩ với mã #${doctor_id} không tồn tại hoặc không làm việc tại Cơ sở ${clinic_id === 1 ? 'Hà Nội' : 'TP.HCM'}`
      );
    }

    // 2. Nghiệp vụ: Ngăn chặn một bệnh nhân đặt trùng 2 ca khám cùng lúc
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
      // XỬ LÝ DỰ PHÒNG RACE CONDITION TẦNG CSDL (Optimistic Fallback):
      // Nếu 2 transaction cùng lọt qua lock hoặc xảy ra va chạm index unique_doctor_slot (doctor_id, slot_time)
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictError('Khung giờ này của bác sĩ vừa được một người khác hoàn tất đặt trước!');
      }

      // Ném lại các lỗi khác (ConflictError từ Pessimistic lock, lỗi kết nối, v.v.)
      throw error;
    }
  }

  /**
   * Lấy danh sách lịch hẹn khám kèm phân trang
   * @param {number|string} clinicId 
   * @param {Object} rawQuery 
   * @returns {Promise<{ data: Array<Object>, pagination: Object }>}
   */
  async getAppointments(clinicId, rawQuery = {}) {
    const validatedQuery = validateAppointmentQuery(rawQuery);
    const effectiveClinicId = Number(validatedQuery.clinic_id || clinicId || 1);

    const { rows, total } = await this.appointmentRepository.findAppointments(
      effectiveClinicId,
      validatedQuery
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
}

module.exports = AppointmentService;
