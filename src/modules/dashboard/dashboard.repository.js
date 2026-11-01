const { getDbPool } = require('../../config/database');

/**
 * Repository tầng dữ liệu cho Dashboard Thống kê
 * Thực thi các câu lệnh truy vấn tổng hợp trên từng Node Shard độc lập.
 * Tối ưu hóa hiệu năng truy vấn: Tận dụng B-Tree Index trên cột `slot_time`.
 */
class DashboardRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver] - Hàm định tuyến Connection Pool theo clinicId
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
  }

  /**
   * Lấy số liệu thống kê thô tại một Node CSDL chi nhánh cụ thể
   * @param {number|string} clinicId - 1: Hà Nội (clinic_hanoi), 2: TP.HCM (clinic_hcm)
   * @param {Object} dateRange - { fromDatetime, toDatetime }
   * @returns {Promise<Object>}
   */
  async getNodeMetrics(clinicId, dateRange) {
    const pool = this.poolResolver(clinicId);
    const { fromDatetime, toDatetime } = dateRange;

    // 1. Thống kê số lượng ca khám theo trạng thái (Pending, Confirmed, Cancelled)
    // Tối ưu hóa Index: Sử dụng khoảng giá trị (Range Scan) slot_time >= ? AND slot_time <= ?
    const [statusRows] = await pool.query(
      `SELECT status, COUNT(*) AS count 
       FROM appointments 
       WHERE slot_time >= ? AND slot_time <= ? 
       GROUP BY status`,
      [fromDatetime, toDatetime]
    );

    // 2. Thống kê tổng số lượng bệnh nhân thuộc chi nhánh quản lý
    const [patientRows] = await pool.query(
      `SELECT COUNT(*) AS total_patients 
       FROM patients`
    );

    // 3. Thống kê lượt khám theo chuyên khoa (Loại trừ các ca bị hủy - Cancelled)
    const [specialtyRows] = await pool.query(
      `SELECT d.specialty, COUNT(a.appointment_id) AS total_appointments 
       FROM appointments a 
       JOIN doctors d ON a.doctor_id = d.doctor_id 
       WHERE a.slot_time >= ? AND a.slot_time <= ? AND a.status != 'Cancelled' 
       GROUP BY d.specialty`,
      [fromDatetime, toDatetime]
    );

    return {
      clinic_id: Number(clinicId),
      node_name: Number(clinicId) === 1 ? 'Node Hà Nội (clinic_hanoi)' : 'Node TP.HCM (clinic_hcm)',
      status_counts: statusRows,
      total_patients: Number(patientRows[0]?.total_patients || 0),
      specialty_analytics: specialtyRows
    };
  }
}

module.exports = DashboardRepository;
