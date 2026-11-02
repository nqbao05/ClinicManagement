const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Đọc biến môi trường từ file .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      });
    } catch (e) { }
  }
}
loadEnv();

// Cấu hình Connection Pool duy nhất trỏ về clinic_db
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'clinic_db', // Nguồn sự thật duy nhất
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
  waitForConnections: true,
  queueLimit: Number(process.env.DB_QUEUE_LIMIT) || 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
});

// Giữ lại alias để không làm hỏng các file gọi hàm cũ (nếu có)
const getDbPool = () => pool;
const getDbNode = () => pool;

/**
 * Thực thi một thao tác dữ liệu nhạy cảm bên trong Database Transaction an toàn
 * Tự động BEGIN -> COMMIT / ROLLBACK và giải phóng kết nối về Pool
 * @param {Function} callback Hàm thực thi nhận connection (async (conn) => { ... })
 * @returns {Promise<any>}
 */
async function executeWithTransaction(callback) {
  // Đã bỏ tham số clinicId vì giờ chỉ có 1 DB
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Kiểm tra trạng thái sức khỏe kết nối (Healthcheck Ping) tới Database
 * @returns {Promise<Object>}
 */
async function healthCheckPools() {
  const status = { database: false, timestamp: new Date().toISOString() };
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    status.database = true;
  } catch (e) {
    status.error = e.message;
  }
  return status;
}

// Fallback in-memory SQLite driver giữ nguyên cho Unit Tests
class FallbackDatabase {
  constructor() {
    this.clinics = [];
    this.patients = [];
    this.doctors = [];
    this.appointments = [];
    this.appointmentId = 1;
  }
  pragma() { }
  exec() { }
  transaction(fn) { return (arg) => fn(arg); }
  prepare(sql) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    const self = this;
    if (trimmed.startsWith('INSERT INTO appointments')) {
      return {
        run(params) {
          const duplicate = self.appointments.find(
            (a) => a.doctor_id === params.doctor_id && a.slot_time === params.slot_time && a.status !== 'Cancelled'
          );
          if (duplicate) {
            const err = new Error('UNIQUE constraint failed: appointments.doctor_id, appointments.slot_time');
            err.code = 'SQLITE_CONSTRAINT_UNIQUE';
            throw err;
          }
          const id = self.appointmentId++;
          self.appointments.push({
            appointment_id: id,
            patient_id: params.patient_id,
            doctor_id: params.doctor_id,
            slot_time: params.slot_time,
            status: params.status || 'Pending'
          });
          return { lastInsertRowid: id };
        }
      };
    }
    if (trimmed.includes('FROM appointments') && trimmed.includes('doctor_id = ? AND slot_time = ?')) {
      return {
        get(doctorId, slotTime) {
          return self.appointments.find(
            (a) => a.doctor_id === doctorId && a.slot_time === slotTime && a.status !== 'Cancelled'
          ) || null;
        }
      };
    }
    if (trimmed.startsWith('INSERT INTO clinics')) {
      return { run(...args) { self.clinics.push(args); return { changes: 1 }; } };
    }
    if (trimmed.startsWith('INSERT INTO patients')) {
      return { run(...args) { self.patients.push(args); return { changes: 1 }; } };
    }
    if (trimmed.startsWith('INSERT INTO doctors')) {
      return { run(...args) { self.doctors.push(args); return { changes: 1 }; } };
    }
    return {
      run() { return { changes: 1 }; },
      get() { return null; },
      all() { return []; }
    };
  }
}

async function closeAllPools() {
  try {
    await pool.end();
  } catch (e) { }
}

function createDatabase() {
  return new FallbackDatabase();
}

module.exports = {
  pool,
  getDbPool,
  getDbNode,
  executeWithTransaction,
  healthCheckPools,
  closeAllPools,
  createDatabase
};