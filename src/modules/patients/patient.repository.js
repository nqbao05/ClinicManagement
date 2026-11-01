const { getDbPool } = require('../../config/database');
const Patient = require('./patient.model');

/**
 * Repository tầng dữ liệu cho Module Bệnh nhân (Patients)
 * Định tuyến truy vấn trực tiếp vào đúng Node CSDL phân tán dựa vào Sharding Key.
 */
class PatientRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver] - Hàm định tuyến Connection Pool theo clinicId
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
  }

  /**
   * Tìm kiếm hồ sơ bệnh nhân theo số CCCD tại một Node CSDL chỉ định
   * @param {number|string} clinicId - 1: Hà Nội, 2: TP.HCM
   * @param {string} citizenId - Số CCCD 12 số
   * @returns {Promise<Object|null>}
   */
  async findByCitizenId(clinicId, citizenId) {
    const pool = this.poolResolver(clinicId);
    const [rows] = await pool.query(
      `SELECT * FROM patients WHERE identity_card = ? LIMIT 1`,
      [String(citizenId).trim()]
    );

    if (!rows || rows.length === 0) return null;
    const entity = Patient.fromDatabaseRow(rows[0]);
    return entity ? entity.toJSON() : null;
  }

  /**
   * Tìm kiếm hồ sơ bệnh nhân theo ID tại một Node CSDL chỉ định
   * @param {number|string} clinicId - 1: Hà Nội, 2: TP.HCM
   * @param {number|string} patientId - Mã bệnh nhân
   * @returns {Promise<Object|null>}
   */
  async findById(clinicId, patientId) {
    const pool = this.poolResolver(clinicId);
    const [rows] = await pool.query(
      `SELECT * FROM patients WHERE patient_id = ? LIMIT 1`,
      [Number(patientId)]
    );

    if (!rows || rows.length === 0) return null;
    const entity = Patient.fromDatabaseRow(rows[0]);
    return entity ? entity.toJSON() : null;
  }

  /**
   * Tạo mới hồ sơ bệnh nhân vào đúng Node CSDL theo Sharding Key
   * @param {number|string} clinicId - 1: Hà Nội, 2: TP.HCM (Khóa Sharding gốc)
   * @param {Object} data - Dữ liệu bệnh nhân đã validate
   * @returns {Promise<Object>}
   */
  async createPatient(clinicId, data) {
    const pool = this.poolResolver(clinicId);

    // Ánh xạ giới tính sang ENUM MySQL ('Nam', 'Nu', 'Khac')
    let dbGender = 'Khac';
    if (data.gender === 'Male' || data.gender === 'Nam') dbGender = 'Nam';
    else if (data.gender === 'Female' || data.gender === 'Nu') dbGender = 'Nu';

    const citizenId = data.citizen_id || data.identity_card;

    const [result] = await pool.query(
      `INSERT INTO patients (
        origin_clinic_id,
        identity_card,
        full_name,
        phone_number,
        gender,
        date_of_birth,
        address
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(clinicId),
        citizenId,
        data.full_name,
        data.phone_number,
        dbGender,
        data.date_of_birth,
        data.address || null
      ]
    );

    const insertedId = result.insertId;
    return {
      patient_id: insertedId,
      origin_clinic_id: Number(clinicId),
      citizen_id: citizenId,
      identity_card: citizenId,
      full_name: data.full_name,
      phone_number: data.phone_number,
      gender: data.gender || 'Other',
      date_of_birth: data.date_of_birth,
      address: data.address || null,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Tra cứu danh sách bệnh nhân có phân trang và lọc theo điều kiện tại một Node
   * @param {number|string} clinicId - 1: Hà Nội, 2: TP.HCM
   * @param {Object} filters - { citizen_id, phone_number, limit, offset }
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async listPatients(clinicId, filters = {}) {
    const pool = this.poolResolver(clinicId);
    const conditions = [];
    const params = [];

    if (filters.citizen_id) {
      conditions.push('identity_card = ?');
      params.push(String(filters.citizen_id).trim());
    }

    if (filters.phone_number) {
      conditions.push('phone_number = ?');
      params.push(String(filters.phone_number).trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Đếm tổng số bản ghi
    const countSql = `SELECT COUNT(*) AS total FROM patients ${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    // 2. Truy vấn danh sách bản ghi phân trang
    const limit = Number(filters.limit) || 20;
    const offset = Number(filters.offset) || 0;

    const selectSql = `
      SELECT * FROM patients 
      ${whereClause} 
      ORDER BY patient_id DESC 
      LIMIT ? OFFSET ?
    `;
    const [dataRows] = await pool.query(selectSql, [...params, limit, offset]);

    const rows = dataRows.map((row) => {
      const entity = Patient.fromDatabaseRow(row);
      return entity ? entity.toJSON() : row;
    });

    return {
      rows,
      total
    };
  }
}

module.exports = PatientRepository;
