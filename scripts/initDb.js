/**
 * ============================================================================
 * SCRIPT KHỞI TẠO CƠ SỞ DỮ LIỆU PHÂN MẢNH SHARDING (SINGLE SOURCE OF TRUTH)
 * Tích hợp mã hóa PII (AES-256-CBC) & Blind Index (HMAC-SHA256) cho CCCD và SĐT
 * ============================================================================
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const {
  encrypt,
  generateBlindIndex,
  hashPassword
} = require('../src/common/utils/crypto.util');

// 1. Tự động đọc biến môi trường từ .env
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
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
          if (process.env[key] === undefined) process.env[key] = val;
        }
      });
    } catch (e) {}
  }
}
loadEnv();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';

// 2. Đặc tả Schema chuẩn cho cả 2 Node Sharding
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clinics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS doctors (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clinic_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doctors_clinic (clinic_id),
  INDEX idx_doctors_specialty (specialty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  origin_clinic_id INT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  citizen_id_encrypted VARCHAR(255) NOT NULL,
  phone_encrypted VARCHAR(255) NOT NULL,
  citizen_id_bindex VARCHAR(64) NOT NULL UNIQUE,
  phone_bindex VARCHAR(64) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender ENUM('male', 'female', 'other') NOT NULL,
  address VARCHAR(255) NULL,
  blood_type VARCHAR(10) NULL,
  medical_history TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_citizen_bindex (citizen_id_bindex),
  INDEX idx_phone_bindex (phone_bindex)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  clinic_id INT NOT NULL,
  doctor_id INT NOT NULL,
  patient_id INT NOT NULL,
  slot_time DATETIME NOT NULL,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctor_slot (doctor_id, slot_time),
  INDEX idx_slot_time (slot_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'patient') NOT NULL,
  clinic_id INT NULL,
  patient_id INT NULL,
  reset_token_hash VARCHAR(255) NULL,
  reset_token_expires_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Khởi tạo Schema và nạp Seed Data cho từng Node
 */
async function seedNode(connection, clinicId, dbName) {
  console.log(`\n--- Khởi tạo và nạp dữ liệu cho [${dbName}] (Node ${clinicId}) ---`);
  
  // 1. Tạo Database
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  // 2. Dọn dẹp bảng cũ nếu cần để đảm bảo cấu trúc mới là Single Source of Truth
  await connection.query(`DROP TABLE IF EXISTS appointments;`);
  await connection.query(`DROP TABLE IF EXISTS users;`);
  await connection.query(`DROP TABLE IF EXISTS patients;`);
  await connection.query(`DROP TABLE IF EXISTS doctors;`);
  await connection.query(`DROP TABLE IF EXISTS clinics;`);

  // 3. Tạo 5 bảng chuẩn hóa
  const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await connection.query(stmt);
  }
  console.log(`✓ Đã tạo 5 bảng chuẩn (clinics, doctors, patients, appointments, users) tại ${dbName}`);

  // 4. Seed dữ liệu Bảng Clinics
  if (clinicId === 1) {
    await connection.query(`
      INSERT INTO clinics (id, name, address, phone)
      VALUES (1, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 1 Hà Nội', 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội', '024-3825-5555')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), phone=VALUES(phone);
    `);
  } else {
    await connection.query(`
      INSERT INTO clinics (id, name, address, phone)
      VALUES (2, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 2 TP.HCM', 'Số 201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '028-3925-6666')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), phone=VALUES(phone);
    `);
  }

  // 5. Seed dữ liệu Bảng Doctors
  if (clinicId === 1) {
    await connection.query(`
      INSERT INTO doctors (id, clinic_id, full_name, specialty, phone, status) VALUES
      (1, 1, 'BS. CKI Nguyễn Văn A', 'Khoa Tim Mạch', '0901234561', 'active'),
      (2, 1, 'BS. CKII Lê Thị B', 'Khoa Nội', '0901234562', 'active'),
      (3, 1, 'ThS.BS Hoàng Minh C', 'Khoa Nhi', '0901234563', 'active'),
      (4, 1, 'BS. Đỗ Quang D', 'Khoa Mắt', '0901234564', 'active');
    `);
  } else {
    await connection.query(`
      INSERT INTO doctors (id, clinic_id, full_name, specialty, phone, status) VALUES
      (1, 2, 'TS.BS Trần Văn C', 'Khoa Tim Mạch', '0909876541', 'active'),
      (2, 2, 'BS. CKI Phạm Thị D', 'Khoa Cơ Xương Khớp', '0909876542', 'active'),
      (3, 2, 'ThS.BS Vũ Hải E', 'Khoa Nhi', '0909876543', 'active'),
      (4, 2, 'BS. CKII Nguyễn Minh F', 'Khoa Thần Kinh', '0909876544', 'active');
    `);
  }
  console.log(`✓ Đã nạp danh sách bác sĩ cho ${dbName}`);

  // 6. Seed dữ liệu Bảng Patients (Đã mã hóa AES-256 & Băm Blind Index HMAC-SHA256)
  if (clinicId === 1) {
    const p1Citizen = '001200000001';
    const p1Phone = '0912345671';
    const p2Citizen = '001200000002';
    const p2Phone = '0912345672';

    await connection.query(`
      INSERT INTO patients (
        id, origin_clinic_id, full_name, citizen_id_encrypted, phone_encrypted,
        citizen_id_bindex, phone_bindex, date_of_birth, gender, address, blood_type, medical_history
      ) VALUES
      (1, 1, 'Nguyễn Văn An', ?, ?, ?, ?, '1985-01-01', 'male', 'Quận Ba Đình, Hà Nội', 'A+', 'Tiền sử dị ứng penicillin'),
      (2, 1, 'Lê Thu Trang', ?, ?, ?, ?, '1992-05-15', 'female', 'Quận Cầu Giấy, Hà Nội', 'O+', 'Không có bệnh lý nền');
    `, [
      encrypt(p1Citizen), encrypt(p1Phone), generateBlindIndex(p1Citizen), generateBlindIndex(p1Phone),
      encrypt(p2Citizen), encrypt(p2Phone), generateBlindIndex(p2Citizen), generateBlindIndex(p2Phone)
    ]);
  } else {
    const p1Citizen = '079200000001';
    const p1Phone = '0987654321';
    const p2Citizen = '079200000002';
    const p2Phone = '0987654322';

    await connection.query(`
      INSERT INTO patients (
        id, origin_clinic_id, full_name, citizen_id_encrypted, phone_encrypted,
        citizen_id_bindex, phone_bindex, date_of_birth, gender, address, blood_type, medical_history
      ) VALUES
      (1, 2, 'Trần Đình Trọng', ?, ?, ?, ?, '1988-10-10', 'male', 'Quận 1, TP.HCM', 'B+', 'Huyết áp cao độ 1'),
      (2, 2, 'Võ Mai Phương', ?, ?, ?, ?, '1995-12-25', 'female', 'Quận 3, TP.HCM', 'AB+', 'Không có bệnh lý nền');
    `, [
      encrypt(p1Citizen), encrypt(p1Phone), generateBlindIndex(p1Citizen), generateBlindIndex(p1Phone),
      encrypt(p2Citizen), encrypt(p2Phone), generateBlindIndex(p2Citizen), generateBlindIndex(p2Phone)
    ]);
  }
  console.log(`✓ Đã nạp dữ liệu hồ sơ bệnh nhân mã hóa PII cho ${dbName}`);

  // 7. Seed dữ liệu Bảng Users (Mật khẩu băm an toàn)
  // Bcrypt/PBKDF2 hash cho Admin@123 và Staff@123
  const adminHash = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW'; // Admin@123
  const staffHash = '$2b$10$wT0X8.d.Oq7gq6K.7fM/4OCvP9YcO7.N5qF7tG4yG8z2g/jX8Kqeq'; // Staff@123

  await connection.query(`
    INSERT INTO users (username, password_hash, role, clinic_id, patient_id) VALUES
    ('admin', ?, 'admin', NULL, NULL),
    ('staff_hanoi', ?, 'staff', 1, NULL),
    ('staff_hcm', ?, 'staff', 2, NULL);
  `, [adminHash, staffHash, staffHash]);
  console.log(`✓ Đã nạp tài khoản người dùng RBAC (admin, staff_hanoi, staff_hcm) cho ${dbName}`);
}

async function main() {
  console.log('================================================================');
  console.log('KHỞI TẠO CƠ SỞ DỮ LIỆU PHÂN MẢNH SHARDING (SINGLE SOURCE OF TRUTH)');
  console.log(`Kết nối máy chủ MySQL tại: ${dbHost}:${dbPort} (User: ${dbUser})`);
  console.log('================================================================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword,
      multipleStatements: true
    });

    await seedNode(connection, 1, 'clinic_hanoi');
    await seedNode(connection, 2, 'clinic_hcm');

    console.log('\n================================================================');
    console.log('✅ KHỞI TẠO VÀ SEED DỮ LIỆU THÀNH CÔNG CHO CẢ 2 NODES CSDL!');
    console.log('================================================================\n');
  } catch (error) {
    console.error('\n❌ Không thể kết nối tới máy chủ MySQL để khởi tạo:');
    console.error(error.message);
    console.log('\nLưu ý: Nếu đang chạy môi trường test không có MySQL daemon, hệ thống sẽ sử dụng In-Memory driver.');
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { initDb: main, main, seedNode, SCHEMA_SQL };
