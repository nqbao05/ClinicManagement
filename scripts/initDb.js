/**
 * Script khởi tạo Schema CSDL & Nạp dữ liệu mẫu (Seed Data)
 * cho cả 2 Sharding Nodes: Node 1 (clinic_hanoi) & Node 2 (clinic_hcm)
 */
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// Đọc file .env nếu có
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

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS clinics (
  clinic_id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INT PRIMARY KEY AUTO_INCREMENT,
  clinic_id INT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doctors_clinic (clinic_id),
  INDEX idx_doctors_specialty (specialty)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS patients (
  patient_id INT PRIMARY KEY AUTO_INCREMENT,
  origin_clinic_id INT NOT NULL,
  identity_card VARCHAR(20) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
  date_of_birth DATE,
  address VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_identity (identity_card),
  INDEX idx_patient_phone (phone_number),
  INDEX idx_patient_clinic (origin_clinic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  clinic_id INT NOT NULL,
  slot_time DATETIME NOT NULL,
  status ENUM('Pending', 'Confirmed', 'Cancelled') DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctor_slot (doctor_id, slot_time),
  INDEX idx_appointments_clinic_date (clinic_id, slot_time),
  INDEX idx_appointments_patient (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function seedNode(connection, clinicId, dbName) {
  console.log(`\n--- Khởi tạo và nạp dữ liệu cho [${dbName}] (Node ${clinicId}) ---`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await connection.query(stmt);
  }
  console.log(`✓ Đã tạo các bảng (clinics, doctors, patients, appointments) tại ${dbName}`);

  // Seed Clinics
  if (clinicId === 1) {
    await connection.query(`
      INSERT INTO clinics (clinic_id, name, address, phone)
      VALUES (1, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 1 Hà Nội', 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội', '024-3825-5555')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), phone=VALUES(phone);
    `);
  } else {
    await connection.query(`
      INSERT INTO clinics (clinic_id, name, address, phone)
      VALUES (2, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 2 TP.HCM', 'Số 201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '028-3925-6666')
      ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), phone=VALUES(phone);
    `);
  }

  // Seed Doctors
  const [existingDoctors] = await connection.query('SELECT COUNT(*) as count FROM doctors');
  if (existingDoctors[0].count === 0) {
    if (clinicId === 1) {
      await connection.query(`
        INSERT INTO doctors (clinic_id, full_name, specialty) VALUES
        (1, 'BS. CKI Nguyễn Văn A', 'Khoa Tim Mạch'),
        (1, 'BS. CKII Lê Thị B', 'Khoa Nội'),
        (1, 'ThS.BS Hoàng Minh C', 'Khoa Nhi'),
        (1, 'BS. Đỗ Quang D', 'Khoa Mắt');
      `);
    } else {
      await connection.query(`
        INSERT INTO doctors (clinic_id, full_name, specialty) VALUES
        (2, 'TS.BS Trần Văn C', 'Khoa Tim Mạch'),
        (2, 'BS. CKI Phạm Thị D', 'Khoa Cơ Xương Khớp'),
        (2, 'ThS.BS Vũ Hải E', 'Khoa Nhi'),
        (2, 'BS. CKII Nguyễn Minh F', 'Khoa Thần Kinh');
      `);
    }
    console.log(`✓ Đã nạp danh sách bác sĩ ban đầu cho ${dbName}`);
  }

  // Seed Patients
  const [existingPatients] = await connection.query('SELECT COUNT(*) as count FROM patients');
  if (existingPatients[0].count === 0) {
    if (clinicId === 1) {
      await connection.query(`
        INSERT INTO patients (origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, address) VALUES
        (1, '001200000001', 'Nguyễn Văn An', '0912345671', 'Male', '1985-01-01', 'Quận Ba Đình, Hà Nội'),
        (1, '001200000002', 'Lê Thu Trang', '0912345672', 'Female', '1992-05-15', 'Quận Cầu Giấy, Hà Nội');
      `);
    } else {
      await connection.query(`
        INSERT INTO patients (origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, address) VALUES
        (2, '079200000001', 'Trần Đình Trọng', '0987654321', 'Male', '1988-10-10', 'Quận 1, TP.HCM'),
        (2, '079200000002', 'Võ Mai Phương', '0987654322', 'Female', '1995-12-25', 'Quận 3, TP.HCM');
      `);
    }
    console.log(`✓ Đã nạp dữ liệu hồ sơ bệnh nhân mẫu cho ${dbName}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('KHỞI TẠO CƠ SỞ DỮ LIỆU PHÂN MẢNH SHARDING (CLINIC MANAGEMENT)');
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

module.exports = { seedNode, SCHEMA_SQL };
