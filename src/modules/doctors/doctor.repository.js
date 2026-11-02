const { getDbPool } = require('../../config/database');
const ConflictError = require('../../common/errors/conflict.error');

/**
 * Repository tầng dữ liệu cho Bác sĩ (Doctors) - TV1
 * Hỗ trợ lưu trữ phân mảnh MySQL Sharding trên 2 Node:
 * - Shard 1: Cơ sở Hà Nội (clinic_hanoi)
 * - Shard 2: Cơ sở TP.HCM (clinic_hcm)
 */
class DoctorRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver]
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
  }

  /**
   * Tạo mới bác sĩ tại chi nhánh chỉ định
   * @param {number|string} clinicId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async createDoctor(clinicId, data) {
    const pool = this.poolResolver(clinicId);
    const cId = Number(clinicId);
    const fullName = String(data.full_name).trim();
    const specialty = String(data.specialty).trim();
    const phone = data.phone ? String(data.phone).trim() : null;
    const status = data.status || 'active';

    const [result] = await pool.query(
      `INSERT INTO doctors (clinic_id, full_name, specialty, phone, status)
       VALUES (?, ?, ?, ?, ?)`,
      [cId, fullName, specialty, phone, status]
    );

    return {
      id: result.insertId,
      doctor_id: result.insertId,
      clinic_id: cId,
      full_name: fullName,
      specialty,
      phone,
      status
    };
  }

  /**
   * Cập nhật thông tin bác sĩ
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @param {Object} data 
   * @returns {Promise<Object>}
   */
  async updateDoctor(clinicId, doctorId, data) {
    const pool = this.poolResolver(clinicId);
    const dId = Number(doctorId);
    const cId = Number(clinicId);

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
      params.push(dId, cId);
      await pool.query(
        `UPDATE doctors SET ${fields.join(', ')} WHERE id = ? AND clinic_id = ?`,
        params
      );
    }

    return this.findById(cId, dId);
  }

  /**
   * Cập nhật nhanh trạng thái bác sĩ (active / inactive)
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @param {string} status 
   * @returns {Promise<Object>}
   */
  async updateStatus(clinicId, doctorId, status) {
    const pool = this.poolResolver(clinicId);
    const dId = Number(doctorId);
    const cId = Number(clinicId);

    await pool.query(
      `UPDATE doctors SET status = ? WHERE id = ? AND clinic_id = ?`,
      [status, dId, cId]
    );

    return this.findById(cId, dId);
  }

  /**
   * Kiểm tra bác sĩ có ca khám nào đang ở trạng thái pending hoặc confirmed không
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @returns {Promise<boolean>}
   */
  async hasActiveAppointments(clinicId, doctorId) {
    const pool = this.poolResolver(clinicId);
    const dId = Number(doctorId);
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM appointments WHERE doctor_id = ? AND LOWER(status) IN ('pending', 'confirmed')`,
      [dId]
    );
    return rows[0] && rows[0].total > 0;
  }

  /**
   * Xóa hồ sơ bác sĩ khỏi chi nhánh (Chặn xóa nếu đang có lịch hẹn)
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @returns {Promise<boolean>}
   */
  async deleteDoctor(clinicId, doctorId) {
    const dId = Number(doctorId);
    const cId = Number(clinicId);

    const hasActive = await this.hasActiveAppointments(cId, dId);
    if (hasActive) {
      throw new ConflictError('Không thể xóa bác sĩ đang có lịch khám chờ tiếp nhận hoặc đã xác nhận! Vui lòng chuyển trạng thái sang ngưng hoạt động (inactive).');
    }

    const pool = this.poolResolver(cId);
    const [result] = await pool.query(
      `DELETE FROM doctors WHERE id = ? AND clinic_id = ?`,
      [dId, cId]
    );

    return result.affectedRows > 0;
  }

  /**
   * Tìm bác sĩ theo ID tại Node chi nhánh
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @returns {Promise<Object|null>}
   */
  async findById(clinicId, doctorId) {
    const pool = this.poolResolver(clinicId);
    const dId = Number(doctorId);
    const cId = Number(clinicId);
    const [rows] = await pool.query(
      `SELECT id, id AS doctor_id, clinic_id, full_name, specialty, phone, status, created_at 
       FROM doctors 
       WHERE id = ? AND clinic_id = ? LIMIT 1`,
      [dId, cId]
    );
    return rows[0] || null;
  }

  /**
   * Lấy danh sách bác sĩ tại một Node chi nhánh (hỗ trợ lọc linh hoạt)
   * @param {number|string} clinicId 
   * @param {Object|string} [filters] 
   * @returns {Promise<Array<Object>>}
   */
  async findByClinic(clinicId, filters = {}) {
    const pool = this.poolResolver(clinicId);
    let sql = `SELECT id, id AS doctor_id, clinic_id, full_name, specialty, phone, status, created_at FROM doctors WHERE clinic_id = ?`;
    const params = [Number(clinicId)];

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
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  /**
   * Lấy danh sách bác sĩ toàn hệ thống (Cross-Node Scan)
   * @param {Object|string} [filters] 
   * @returns {Promise<Array<Object>>}
   */
  async findAll(filters) {
    const [d1, d2] = await Promise.allSettled([
      this.findByClinic(1, filters),
      this.findByClinic(2, filters)
    ]);

    let list = [];
    if (d1.status === 'fulfilled') list = list.concat(d1.value || []);
    if (d2.status === 'fulfilled') list = list.concat(d2.value || []);

    return list;
  }
}

module.exports = DoctorRepository;
