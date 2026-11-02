const { getDbPool } = require('../../config/database');
const ConflictError = require('../../common/errors/conflict.error');
const Appointment = require('./appointment.model');

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
    if (options && typeof options.prepare === 'function') {
      this.db = options;
    } else if (options && options.db) {
      this.db = options.db;
    }
    this.poolResolver = (options && options.poolResolver) || getDbPool;

    if (this.db) {
      this.createInTransaction = this.db.transaction((appointment) => {
        const result = this.db.prepare(`
          INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status)
          VALUES (@patient_id, @doctor_id, @clinic_id, @slot_time, @status)
        `).run({
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          clinic_id: appointment.clinic_id,
          slot_time: appointment.slot_time,
          status: appointment.status
        });
        return new Appointment({ ...appointment, appointment_id: result.lastInsertRowid });
      });
    }
  }

  create(appointment) {
    if (this.createInTransaction) {
      return this.createInTransaction(appointment);
    }
    throw new Error('create() chỉ dùng với memory database instance');
  }

  findActiveByDoctorAndSlot(doctorId, slotTime) {
    if (!this.db) return null;
    const row = this.db.prepare(`
      SELECT appointment_id, patient_id, doctor_id, clinic_id, slot_time, status
      FROM appointments
      WHERE doctor_id = ? AND slot_time = ? AND status <> 'Cancelled'
      LIMIT 1
    `).get(doctorId, slotTime);
    return row ? new Appointment(row) : null;
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
   */
  async createAppointmentWithTransaction(clinicId, data) {
    const pool = this._getPool(clinicId);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

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

      const [insertResult] = await conn.query(
        `INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status) 
         VALUES (?, ?, ?, ?, 'Pending')`,
        [Number(data.patient_id), Number(data.doctor_id), Number(clinicId), data.slot_time]
      );

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
      await conn.rollback();
      if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        throw new ConflictError('Khung giờ này của bác sĩ vừa có người đặt trước!');
      }
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Lấy danh sách lịch hẹn có phân trang và bộ lọc linh hoạt
   */
  async findAppointments(clinicId, filters = {}) {
    const pool = this._getPool(clinicId);

    let whereClause = 'WHERE a.clinic_id = ?';
    const params = [Number(clinicId)];

    if (filters.patient_id) {
      whereClause += ' AND a.patient_id = ?';
      params.push(Number(filters.patient_id));
    }

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

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM appointments a ${whereClause}`,
      params
    );
    const total = Number(countRows[0].total) || 0;

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

  /**
   * Tìm thông tin lịch hẹn theo ID
   * @param {number} clinicId 
   * @param {number} appointmentId 
   */
  async findById(clinicId, appointmentId) {
    const pool = this.getPool(clinicId);
    const [rows] = await pool.query(
      `SELECT appointment_id, patient_id, doctor_id, clinic_id, slot_time, status, created_at
       FROM appointments
       WHERE appointment_id = ? LIMIT 1`,
      [Number(appointmentId)]
    );
    return rows[0] || null;
  }

  /**
   * Cập nhật trạng thái lịch hẹn
   * @param {number} clinicId 
   * @param {number} appointmentId 
   * @param {string} status 
   */
  async updateStatus(clinicId, appointmentId, status) {
    const pool = this.getPool(clinicId);
    await pool.query(
      `UPDATE appointments SET status = ? WHERE appointment_id = ?`,
      [status, Number(appointmentId)]
    );
    return this.findById(clinicId, appointmentId);
  }
}

module.exports = AppointmentRepository;
