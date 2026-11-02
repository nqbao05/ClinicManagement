const { getDbPool } = require('../../config/database');

/**
 * Repository tầng dữ liệu cho Bác sĩ (Doctors)
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
   * Tìm bác sĩ theo ID tại Node chi nhánh
   * @param {number|string} clinicId 
   * @param {number|string} doctorId 
   * @returns {Promise<Object|null>}
   */
  async findById(clinicId, doctorId) {
    const pool = this.poolResolver(clinicId);
    const dId = Number(doctorId);
    const [rows] = await pool.query(
      `SELECT id, id AS doctor_id, clinic_id, full_name, specialty, created_at 
       FROM doctors 
       WHERE id = ? AND clinic_id = ? LIMIT 1`,
      [dId, dId, Number(clinicId)]
    );
    return rows[0] || null;
  }

  /**
   * Lấy danh sách bác sĩ tại một Node chi nhánh
   * @param {number|string} clinicId 
   * @param {string} [specialty] 
   * @returns {Promise<Array<Object>>}
   */
  async findByClinic(clinicId, specialty) {
    const pool = this.poolResolver(clinicId);
    let sql = `SELECT id, id AS doctor_id, clinic_id, full_name, specialty, created_at FROM doctors WHERE clinic_id = ?`;
    const params = [Number(clinicId)];

    if (specialty) {
      sql += ` AND specialty = ?`;
      params.push(specialty);
    }

    sql += ` ORDER BY id ASC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  /**
   * Lấy danh sách bác sĩ toàn hệ thống (Cross-Node Scan)
   * @param {string} [specialty] 
   * @returns {Promise<Array<Object>>}
   */
  async findAll(specialty) {
    const [d1, d2] = await Promise.allSettled([
      this.findByClinic(1, specialty),
      this.findByClinic(2, specialty)
    ]);

    let list = [];
    if (d1.status === 'fulfilled') list = list.concat(d1.value || []);
    if (d2.status === 'fulfilled') list = list.concat(d2.value || []);

    return list;
  }
}

module.exports = DoctorRepository;
