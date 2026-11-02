const { getDbPool } = require('../../config/database');
const ConflictError = require('../../common/errors/conflict.error');

/**
 * Repository tầng dữ liệu cho Bác sĩ (Doctors)
 * Kiến trúc: CSDL Tập trung (1 Node duy nhất - clinic_db)
 */
class DoctorRepository {
  constructor(options = {}) {
    // Chỉ lấy 1 Connection Pool duy nhất cho DB tập trung
    this.pool = options.pool || getDbPool();
  }

  /**
   * Tạo mới bác sĩ
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async createDoctor(data) {
    const fullName = String(data.full_name).trim();
    const specialty = String(data.specialty).trim();
    const phone = data.phone ? String(data.phone).trim() : null;
    const status = data.status || 'active';

    const [result] = await this.pool.query(
      `INSERT INTO doctors (full_name, specialty, phone, status)
       VALUES (?, ?, ?, ?)`,
      [fullName, specialty, phone, status]
    );

    return {
      id: result.insertId,
      doctor_id: result.insertId,
      full_name: fullName,
      specialty,
      phone,
      status
    };
  }

  /**
   * Cập nhật thông tin bác sĩ
   * @param {number|string} doctorId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async updateDoctor(doctorId, data) {
    const dId = Number(doctorId);
    const fields = [];
    const params = [];

    if (data.full_name !== undefined) {
      fields.push('full_name = ?');
      params.push(String(data.full_name).trim());
    }
    if (data.specialty !== undefined) {
      fields.push('specialty = ?');
      params.push(String(data.specialty).trim());
    }
    if (data.phone !== undefined) {
      fields.push('phone = ?');
      params.push(data.phone ? String(data.phone).trim() : null);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(String(data.status).trim().toLowerCase());
    }

    if (fields.length > 0) {
      params.push(dId);
      await this.pool.query(
        `UPDATE doctors SET ${fields.join(', ')} WHERE id = ?`,
        params
      );
    }

    return this.findById(dId);
  }

  /**
   * Cập nhật nhanh trạng thái bác sĩ (active / inactive)
   * @param {number|string} doctorId 
   * @param {string} status 
   * @returns {Promise<Object>}
   */
  async updateStatus(doctorId, status) {
    const dId = Number(doctorId);
    await this.pool.query(
      `UPDATE doctors SET status = ? WHERE id = ?`,
      [status, dId]
    );
    return this.findById(dId);
  }

  /**
   * Kiểm tra bác sĩ có ca khám nào đang ở trạng thái pending hoặc confirmed không
   * @param {number|string} doctorId 
   * @returns {Promise<boolean>}
   */
  async hasActiveAppointments(doctorId) {
    const dId = Number(doctorId);
    const [rows] = await this.pool.query(
      `SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND LOWER(status) IN ('pending', 'confirmed')`,
      [dId]
    );
    return rows[0] && rows[0].total > 0;
  }

  /**
   * Xóa hồ sơ bác sĩ (Xóa mềm - Soft Delete)
   * @param {number|string} doctorId 
   * @returns {Promise<boolean>}
   */
  async deleteDoctor(doctorId) {
    const dId = Number(doctorId);

    const hasActive = await this.hasActiveAppointments(dId);
    if (hasActive) {
      throw new ConflictError('Không thể xóa bác sĩ đang có lịch khám chờ tiếp nhận hoặc đã xác nhận! Vui lòng chuyển trạng thái sang ngưng hoạt động (inactive).');
    }

    const [result] = await this.pool.query(
      `UPDATE doctors SET is_deleted = 1, status = 'inactive' WHERE id = ?`,
      [dId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Tìm bác sĩ theo ID
   * @param {number|string} doctorId 
   * @returns {Promise<Object|null>}
   */
  async findById(doctorId) {
    const dId = Number(doctorId);
    const [rows] = await this.pool.query(
      `SELECT id, id AS doctor_id, full_name, specialty, phone, status, created_at 
       FROM doctors 
       WHERE id = ? LIMIT 1`,
      [dId]
    );
    return rows[0] || null;
  }

  /**
   * Lấy danh sách bác sĩ toàn hệ thống (Hỗ trợ lọc linh hoạt)
   * Thay thế cho findAll và findByClinic cũ
   * @param {Object|string} [filters] 
   * @returns {Promise<Array<Object>>}
   */
  async findAll(filters = {}) {
    let sql = `SELECT id, id AS doctor_id, full_name, specialty, phone, status, created_at FROM doctors WHERE is_deleted = 0`;
    const params = [];

    // Hỗ trợ truyền specialty dạng string hoặc object filters
    if (typeof filters === 'string') {
      sql += ` AND specialty = ?`;
      params.push(filters);
    } else if (filters && typeof filters === 'object') {
      if (filters.specialty) {
        sql += ` AND specialty = ?`;
        params.push(filters.specialty);
      }
      if (filters.status) {
        sql += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.search) {
        sql += ` AND full_name LIKE ?`;
        params.push(`%${filters.search}%`);
      }
    }

    sql += ` ORDER BY id ASC`;
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }
}

module.exports = DoctorRepository;