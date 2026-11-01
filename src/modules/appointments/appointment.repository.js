const { getDbPool } = require('../../config/database');
const ConflictError = require('../../common/errors/conflict.error');

/**
 * Repository tương tác dữ liệu Lịch hẹn khám bệnh (Appointments)
 * Tích hợp Concurrency Control với cơ chế Khóa bi quan (Pessimistic Lock: SELECT ... FOR UPDATE)
 * Đảm bảo cô lập giao dịch tuyệt đối, chống Race Condition khi đặt trùng slot khám.
 */
class AppointmentRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver] - Hàm định tuyến Connection Pool theo clinicId
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
  }

  /**
   * Lấy connection pool cho chi nhánh tương ứng
   * @private
   */
  _getPool(clinicId) {
    return this.poolResolver(clinicId);
  }

  /**
   * Kiểm tra bác sĩ có tồn tại và đang làm việc tại chi nhánh chỉ định không
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @returns {Promise<Object|null>}
   */
  async findDoctorById(clinicId, doctorId) {
    const pool = this._getPool(clinicId);
    const [rows] = await pool.query(
      `SELECT doctor_id, clinic_id, full_name, specialty, created_at 
       FROM doctors 
       WHERE doctor_id = ? AND clinic_id = ? LIMIT 1`,
      [Number(doctorId), Number(clinicId)]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Kiểm tra xem bệnh nhân đã có ca khám nào trùng khung giờ tại chi nhánh đó chưa
   * @param {number|string} clinicId 
   * @param {number|string} patientId 
   * @param {string} slotTime 
   * @returns {Promise<boolean>}
   */
  async checkPatientDoubleBooking(clinicId, patientId, slotTime) {
    const pool = this._getPool(clinicId);
    const [rows] = await pool.query(
      `SELECT appointment_id 
       FROM appointments 
       WHERE patient_id = ? AND slot_time = ? AND status != 'Cancelled' 
       LIMIT 1`,
      [Number(patientId), slotTime]
    );
    return rows.length > 0;
  }

  /**
   * Tạo lịch hẹn khám bệnh bọc trong Database Transaction với cơ chế Pessimistic Lock
   * Luồng thực thi:
   * 1. conn.beginTransaction()
   * 2. SELECT ... FOR UPDATE (Khóa dòng chống xung đột đồng thời)
   * 3. INSERT INTO appointments
   * 4. conn.commit()
   * 5. conn.release() (Đảm bảo luôn giải phóng kết nối về pool)
   * 
   * @param {number|string} clinicId 
   * @param {Object} data - { patient_id, doctor_id, clinic_id, slot_time }
   * @returns {Promise<Object>}
   */
  async createAppointmentWithTransaction(clinicId, data) {
    const pool = this._getPool(clinicId);
    const conn = await pool.getConnection();

    try {
      // 1. Mở Transaction
      await conn.beginTransaction();

      // 2. Pessimistic Lock / Slot Check: Khóa dòng kiểm tra trước
      // Sử dụng FOR UPDATE để chặn bất kỳ transaction nào khác đọc hoặc sửa cùng khung giờ của bác sĩ
      const [existingSlots] = await conn.query(
        `SELECT appointment_id 
         FROM appointments 
         WHERE doctor_id = ? AND slot_time = ? AND status != 'Cancelled' 
         FOR UPDATE`,
        [Number(data.doctor_id), data.slot_time]
      );

      if (existingSlots.length > 0) {
        throw new ConflictError('Khung giờ này của bác sĩ vừa có người đặt trước!');
      }

      // 3. Thực thi chèn lịch hẹn mới
      const [insertResult] = await conn.query(
        `INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status) 
         VALUES (?, ?, ?, ?, 'Pending')`,
        [Number(data.patient_id), Number(data.doctor_id), Number(clinicId), data.slot_time]
      );

      // 4. Commit Transaction an toàn
      await conn.commit();

      return {
        appointment_id: insertResult.insertId,
        patient_id: Number(data.patient_id),
        doctor_id: Number(data.doctor_id),
        clinic_id: Number(clinicId),
        slot_time: data.slot_time,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      // Rollback hoàn tác mọi thay đổi nếu xảy ra lỗi
      await conn.rollback();
      throw error;
    } finally {
      // Bắt buộc giải phóng kết nối về Pool để tránh connection leak
      conn.release();
    }
  }

  /**
   * Lấy danh sách lịch hẹn có phân trang và bộ lọc linh hoạt
   * @param {number|string} clinicId 
   * @param {Object} filters 
   * @returns {Promise<{ rows: Array<Object>, total: number }>}
   */
  async findAppointments(clinicId, filters = {}) {
    const pool = this._getPool(clinicId);

    let whereClause = 'WHERE a.clinic_id = ?';
    const params = [Number(clinicId)];

    if (filters.doctor_id) {
      whereClause += ' AND a.doctor_id = ?';
      params.push(Number(filters.doctor_id));
    }

    if (filters.status) {
      whereClause += ' AND a.status = ?';
      params.push(filters.status);
    }

    if (filters.date) {
      whereClause += ' AND DATE(a.slot_time) = ?';
      params.push(filters.date);
    }

    // 1. Đếm tổng số bản ghi
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM appointments a ${whereClause}`,
      params
    );
    const total = Number(countRows[0].total) || 0;

    // 2. Truy vấn dữ liệu phân trang kèm thông tin bác sĩ & bệnh nhân
    const limit = Number(filters.limit) || 20;
    const offset = Number(filters.offset) || 0;
    const queryParams = [...params, limit, offset];

    const [rows] = await pool.query(
      `SELECT a.appointment_id, a.patient_id, a.doctor_id, a.clinic_id, 
              a.slot_time, a.status, a.created_at,
              d.full_name AS doctor_name, d.specialty AS doctor_specialty,
              p.full_name AS patient_name, p.phone_number AS patient_phone
       FROM appointments a
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       LEFT JOIN patients p ON a.patient_id = p.patient_id
       ${whereClause}
       ORDER BY a.slot_time DESC
       LIMIT ? OFFSET ?`,
      queryParams
     );

    return { rows, total };
  }
}

module.exports = AppointmentRepository;
