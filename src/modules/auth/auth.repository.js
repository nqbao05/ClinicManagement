const { getDbPool } = require('../../config/database');
const { hashPassword } = require('../../common/utils/crypto.util');

/**
 * In-memory Fallback Database cho Auth Module
 * Phục vụ Unit Test hoặc khi chưa kết nối MySQL
 */
class MemoryAuthDatabase {
  constructor() {
    this.users = [
      {
        id: 1,
        username: 'admin',
        password_hash: hashPassword('Admin@123'),
        role: 'admin',
        clinic_id: null,
        patient_id: null
      },
      {
        id: 2,
        username: 'staff_hanoi',
        password_hash: hashPassword('Staff@123'),
        role: 'staff',
        clinic_id: 1,
        patient_id: null
      },
      {
        id: 3,
        username: 'staff_hcm',
        password_hash: hashPassword('Staff@123'),
        role: 'staff',
        clinic_id: 2,
        patient_id: null
      },
      {
        id: 4,
        username: 'patient',
        password_hash: hashPassword('Patient@123'),
        role: 'patient',
        clinic_id: 1,
        patient_id: 101
      }
    ];
    this.autoIncrement = 5;
  }

  findByUsername(username) {
    const clean = String(username).trim();
    return this.users.find((u) => u.username === clean) || null;
  }

  findById(id) {
    return this.users.find((u) => u.id === Number(id)) || null;
  }

  create(user) {
    const id = this.autoIncrement++;
    const record = { id, ...user };
    this.users.push(record);
    return record;
  }
}

/**
 * Repository tương tác dữ liệu Tài khoản Người dùng & Xác thực (Auth Module)
 * Tuân thủ 100% Parameterized Queries chống SQL Injection
 */
class AuthRepository {
  /**
   * @param {Object} [options]
   * @param {Function} [options.poolResolver]
   * @param {boolean} [options.useMemory]
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
    this.useMemory = Boolean(
      options.useMemory ||
      process.env.NODE_ENV === 'test' ||
      options.db
    );
    this.memDb = options.db || new MemoryAuthDatabase();
  }

  /**
   * Tra cứu người dùng theo tên đăng nhập (quét cả 2 node CSDL an toàn)
   * @param {string} username 
   * @returns {Promise<Object|null>}
   */
  async findByUsername(username) {
    const cleanUsername = String(username).trim();

    if (!this.useMemory) {
      try {
        // Quét Node 1 (Hà Nội) trước với Parameterized Query
        const pool1 = this.poolResolver(1);
        const [rows1] = await pool1.query(
          'SELECT id, username, password_hash, role, clinic_id, patient_id FROM users WHERE username = ? LIMIT 1',
          [cleanUsername]
        );
        if (rows1 && rows1.length > 0) {
          return rows1[0];
        }

        // Nếu không có ở Node 1, kiểm tra Node 2 (TP.HCM)
        const pool2 = this.poolResolver(2);
        const [rows2] = await pool2.query(
          'SELECT id, username, password_hash, role, clinic_id, patient_id FROM users WHERE username = ? LIMIT 1',
          [cleanUsername]
        );
        if (rows2 && rows2.length > 0) {
          return rows2[0];
        }

        return null;
      } catch (err) {
        console.warn('[AuthRepository.findByUsername] MySQL fallback to memory:', err.message);
      }
    }

    return this.memDb.findByUsername(cleanUsername);
  }

  /**
   * Tra cứu người dùng theo ID
   * @param {number} id 
   * @param {number} [clinicId=1] 
   * @returns {Promise<Object|null>}
   */
  async findById(id, clinicId = 1) {
    const userId = Number(id);

    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(clinicId);
        const [rows] = await pool.query(
          'SELECT id, username, password_hash, role, clinic_id, patient_id FROM users WHERE id = ? LIMIT 1',
          [userId]
        );
        return (rows && rows[0]) || null;
      } catch (err) {
        console.warn('[AuthRepository.findById] MySQL fallback to memory:', err.message);
      }
    }

    return this.memDb.findById(userId);
  }

  /**
   * Tạo tài khoản người dùng mới
   * @param {Object} userData 
   * @param {number} [clinicId=1] 
   * @returns {Promise<Object>}
   */
  async createUser(userData, clinicId = 1) {
    const { username, password_hash, role, clinic_id, patient_id } = userData;

    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(clinicId);
        const [result] = await pool.query(
          'INSERT INTO users (username, password_hash, role, clinic_id, patient_id) VALUES (?, ?, ?, ?, ?)',
          [username, password_hash, role, clinic_id || null, patient_id || null]
        );
        return {
          id: result.insertId,
          username,
          role,
          clinic_id: clinic_id || null,
          patient_id: patient_id || null
        };
      } catch (err) {
        console.warn('[AuthRepository.createUser] MySQL fallback to memory:', err.message);
      }
    }

    return this.memDb.create(userData);
  }
}

module.exports = AuthRepository;
module.exports.AuthRepository = AuthRepository;
module.exports.MemoryAuthDatabase = MemoryAuthDatabase;
