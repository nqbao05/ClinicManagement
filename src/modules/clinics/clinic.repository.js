const { getDbPool } = require('../../config/database');

/**
 * Repository tầng dữ liệu cho Chi nhánh phòng khám (Clinics)
 */
class ClinicRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver]
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
  }

  /**
   * Lấy thông tin chi nhánh theo ID tại Node tương ứng
   * @param {number|string} clinicId 
   * @returns {Promise<Object|null>}
   */
  async findById(clinicId) {
    const id = Number(clinicId);
    if (![1, 2].includes(id)) return null;

    try {
      const pool = this.poolResolver(id);
      const [rows] = await pool.query(
        `SELECT id, id AS clinic_id, name, address, phone, created_at 
         FROM clinics 
         WHERE id = ? OR clinic_id = ? LIMIT 1`,
        [id, id]
      );
      return rows[0] || null;
    } catch (error) {
      // Fallback tĩnh nếu Node CSDL tạm thời chưa sẵn sàng
      return {
        clinic_id: id,
        name: id === 1 ? 'Cơ sở 1 - Hà Nội' : 'Cơ sở 2 - TP.HCM',
        address: id === 1 ? 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội' : 'Số 201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
        phone: id === 1 ? '024-3825-5555' : '028-3925-6666'
      };
    }
  }

  /**
   * Lấy danh sách tất cả các chi nhánh từ cả 2 Node CSDL
   * @returns {Promise<Array<Object>>}
   */
  async findAll() {
    const [c1, c2] = await Promise.all([
      this.findById(1),
      this.findById(2)
    ]);
    return [c1, c2].filter(Boolean);
  }
}

module.exports = ClinicRepository;
