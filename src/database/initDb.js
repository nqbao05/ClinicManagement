const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ANSI Color Codes cho giao diện dòng lệnh đẹp mắt
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

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
    } catch (e) {}
  }
}
loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : ''
};

/**
 * Migration & DDL Schema Script chuẩn Enterprise (Production-Ready)
 */
async function initDb() {
  console.log(`\n${colors.cyan}┌────────────────────────────────────────────────────────────────────────┐${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} ${colors.bright}🚀 PRINCIPAL DATABASE ARCHITECT - HORIZONTAL SHARDING MIGRATION       ${colors.cyan}│${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} ${colors.gray}Database Engine: MySQL 8.x / MariaDB (InnoDB, utf8mb4_unicode_ci)        ${colors.cyan}│${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} Target: ${colors.green}${dbConfig.user}@${dbConfig.host}:${dbConfig.port}${colors.reset} | Auth: ${dbConfig.password ? 'Password Protected' : 'Blank (XAMPP default)'}   ${colors.cyan}│${colors.reset}`);
  console.log(`${colors.cyan}└────────────────────────────────────────────────────────────────────────┘${colors.reset}\n`);

  let rootConnection;

  try {
    // =========================================================================
    // GIAI ĐOẠN 1: PING & KẾT NỐI MÁY CHỦ MYSQL CẤP ROOT
    // =========================================================================
    process.stdout.write(`⏳ [1/4] Đang thiết lập kết nối tới MySQL Server... `);
    rootConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    console.log(`${colors.green}✔ THÀNH CÔNG${colors.reset}`);

    // =========================================================================
    // GIAI ĐOẠN 2: TẠO 2 SCHEMA PHÂN TÁN (HORIZONTAL SHARDING)
    // =========================================================================
    console.log(`⏳ [2/4] Kiểm tra & Tạo Schema phân tán theo chi nhánh:`);
    const nodes = [
      { name: 'clinic_hanoi', id: 1, location: 'Hà Nội', ip: '10.0.1.10' },
      { name: 'clinic_hcm', id: 2, location: 'TP.HCM', ip: '10.0.2.10' }
    ];

    for (const node of nodes) {
      await rootConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${node.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
      );
      console.log(`   ${colors.green}✔${colors.reset} Database ${colors.bright}\`${node.name}\`${colors.reset} (Node ${node.id} - ${node.location})`);
    }

    // =========================================================================
    // GIAI ĐOẠN 3: TẠO CẤU TRÚC 4 BẢNG ĐỒNG BỘ VỚI RÀNG BUỘC TOÀN VẸN
    // =========================================================================
    console.log(`\n⏳ [3/4] Đồng bộ DDL Tables & Indexes theo lược đồ erd.mermaid:`);

    for (const node of nodes) {
      console.log(`\n   ${colors.blue}▶ Cấu hình Node: \`${node.name}\`${colors.reset}`);
      await rootConnection.query(`USE \`${node.name}\`;`);

      // Bảng 1: clinics
      await rootConnection.query(`
        CREATE TABLE IF NOT EXISTS clinics (
          clinic_id INT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          db_node_ip VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`     ${colors.green}✔${colors.reset} Table [clinics]`);

      // Bảng 2: doctors
      await rootConnection.query(`
        CREATE TABLE IF NOT EXISTS doctors (
          doctor_id INT AUTO_INCREMENT PRIMARY KEY,
          clinic_id INT NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          specialty VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_doctors_clinic (clinic_id),
          CONSTRAINT fk_doctors_clinic_${node.name} FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`     ${colors.green}✔${colors.reset} Table [doctors] + FK (clinic_id)`);

      // Bảng 3: patients (Khóa Sharding: origin_clinic_id)
      await rootConnection.query(`
        CREATE TABLE IF NOT EXISTS patients (
          patient_id INT AUTO_INCREMENT PRIMARY KEY,
          origin_clinic_id INT NOT NULL,
          identity_card VARCHAR(20) NOT NULL UNIQUE,
          full_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(15) NOT NULL,
          gender ENUM('Nam', 'Nu', 'Khac') NOT NULL,
          date_of_birth DATE DEFAULT NULL,
          address TEXT DEFAULT NULL,
          blood_type VARCHAR(5) DEFAULT NULL,
          medical_history TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_patients_identity (identity_card),
          INDEX idx_patients_phone (phone_number),
          INDEX idx_patients_origin (origin_clinic_id),
          CONSTRAINT fk_patients_clinic_${node.name} FOREIGN KEY (origin_clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`     ${colors.green}✔${colors.reset} Table [patients] + Sharding Key + Unique (identity_card)`);

      // Bảng 4: appointments (Ràng buộc chống Race Condition)
      await rootConnection.query(`
        CREATE TABLE IF NOT EXISTS appointments (
          appointment_id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          doctor_id INT NOT NULL,
          clinic_id INT NOT NULL,
          slot_time DATETIME NOT NULL,
          status ENUM('Pending', 'Confirmed', 'Cancelled') NOT NULL DEFAULT 'Pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_doctor_slot UNIQUE (doctor_id, slot_time),
          INDEX idx_appointments_slot (slot_time),
          INDEX idx_appointments_status (status),
          CONSTRAINT fk_appt_patient_${node.name} FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
          CONSTRAINT fk_appt_doctor_${node.name} FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
          CONSTRAINT fk_appt_clinic_${node.name} FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log(`     ${colors.green}✔${colors.reset} Table [appointments] + Unique (doctor_id, slot_time)`);

      // =========================================================================
      // GIAI ĐOẠN 4: SEEDING DỮ LIỆU MẪU CHUẨN NGHIỆP VỤ Y TẾ
      // =========================================================================
      // 4.1 Seed Clinics
      const [cCount] = await rootConnection.query('SELECT COUNT(*) as count FROM clinics;');
      if (cCount[0].count === 0) {
        await rootConnection.query(`
          INSERT INTO clinics (clinic_id, name, location, db_node_ip) VALUES
          (1, 'Phòng khám Đa khoa Hà Nội', 'Hoàn Kiếm, Hà Nội', '10.0.1.10'),
          (2, 'Phòng khám Đa khoa TP.HCM', 'Quận 1, TP.HCM', '10.0.2.10');
        `);
      }

      // 4.2 Seed Doctors
      const [dCount] = await rootConnection.query('SELECT COUNT(*) as count FROM doctors;');
      if (dCount[0].count === 0) {
        if (node.id === 1) {
          await rootConnection.query(`
            INSERT INTO doctors (doctor_id, clinic_id, full_name, specialty) VALUES
            (1, 1, 'BS. CKI Nguyễn Văn A', 'Khoa Tim Mạch'),
            (2, 1, 'BS. CKII Lê Thị B', 'Khoa Nhi');
          `);
        } else {
          await rootConnection.query(`
            INSERT INTO doctors (doctor_id, clinic_id, full_name, specialty) VALUES
            (3, 2, 'ThS.BS Trần Văn C', 'Khoa Cơ Xương Khớp'),
            (4, 2, 'BS. CKI Phạm Thị D', 'Khoa Nội Tổng Quát');
          `);
        }
      }

      // 4.3 Seed Patients (Phân bổ chuẩn theo Sharding Key origin_clinic_id)
      const [pCount] = await rootConnection.query('SELECT COUNT(*) as count FROM patients;');
      if (pCount[0].count === 0) {
        if (node.id === 1) {
          await rootConnection.query(`
            INSERT INTO patients (patient_id, origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, address, blood_type, medical_history) VALUES
            (101, 1, '001201012345', 'Nguyễn Văn P (BN101 - Hà Nội)', '0901234567', 'Nam', '1990-05-15', 'Hoàn Kiếm, Hà Nội', 'O+', 'Tiền sử dị ứng penicillin (PRD Luồng 2)'),
            (102, 1, '001201088888', 'Lê Hoàng Nam (Hà Nội)', '0987654321', 'Nam', '1988-08-20', 'Cầu Giấy, Hà Nội', 'B+', 'Tiểu sử huyết áp cao');
          `);
        } else {
          await rootConnection.query(`
            INSERT INTO patients (patient_id, origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, address, blood_type, medical_history) VALUES
            (201, 2, '079201019999', 'Trần Thị Mai (TP.HCM)', '0988888888', 'Nu', '1995-10-24', 'Quận 1, TP.HCM', 'A+', 'Khám định kỳ sức khỏe tổng quát'),
            (202, 2, '079201026666', 'Võ Quốc Huy (TP.HCM)', '0912345678', 'Nam', '1992-03-10', 'Bình Thạnh, TP.HCM', 'O+', 'Tiền sử đau dạ dày tá tràng');
          `);
        }
      }

      // 4.4 Seed Appointments (Đa dạng trạng thái phục vụ TV3 & TV4 Dashboard)
      const [aCount] = await rootConnection.query('SELECT COUNT(*) as count FROM appointments;');
      if (aCount[0].count === 0) {
        if (node.id === 1) {
          await rootConnection.query(`
            INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status) VALUES
            (101, 1, 1, '2026-11-05 09:00:00', 'Confirmed'),
            (102, 2, 1, '2026-11-05 10:30:00', 'Pending');
          `);
        } else {
          await rootConnection.query(`
            INSERT INTO appointments (patient_id, doctor_id, clinic_id, slot_time, status) VALUES
            (201, 3, 2, '2026-11-05 14:00:00', 'Confirmed'),
            (202, 4, 2, '2026-11-05 15:30:00', 'Cancelled');
          `);
        }
      }
      console.log(`     ${colors.green}✔${colors.reset} Seeding Data hoàn tất.`);
    }

    console.log(`\n${colors.green}┌────────────────────────────────────────────────────────────────────────┐${colors.reset}`);
    console.log(`${colors.green}│${colors.reset} ${colors.bright}🎉 TOÀN BỘ CƠ SỞ DỮ LIỆU ĐÃ SẴN SÀNG VẬN HÀNH (PRODUCTION-READY)!       ${colors.green}│${colors.reset}`);
    console.log(`${colors.green}│${colors.reset}  • Node 1 (Hà Nội): ${colors.cyan}clinic_hanoi${colors.reset} (Đã nạp Bác sĩ & BN Hà Nội)            ${colors.green}│${colors.reset}`);
    console.log(`${colors.green}│${colors.reset}  • Node 2 (TP.HCM): ${colors.cyan}clinic_hcm${colors.reset}   (Đã nạp Bác sĩ & BN TP.HCM)            ${colors.green}│${colors.reset}`);
    console.log(`${colors.green}│${colors.reset}  • Quản lý trực quan: Mở MySQL Workbench hoặc phpMyAdmin (XAMPP).      ${colors.green}│${colors.reset}`);
    console.log(`${colors.green}└────────────────────────────────────────────────────────────────────────┘${colors.reset}\n`);
    return true;

  } catch (error) {
    console.error(`\n${colors.red}❌ LỖI KHỞI TẠO CƠ SỞ DỮ LIỆU MYSQL:${colors.reset}`);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(`${colors.yellow}👉 LỖI ĐĂNG NHẬP:${colors.reset} Sai thông tin tài khoản root hoặc mật khẩu MySQL.`);
      console.error(`   • Người dùng XAMPP: Để trống mật khẩu trong file .env (${colors.bright}DB_PASSWORD=${colors.reset}).`);
      console.error(`   • Người dùng MySQL Workbench: Điền đúng mật khẩu root vào file .env (${colors.bright}DB_PASSWORD=mat_khau_cua_ban${colors.reset}).`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`${colors.yellow}👉 LỖI KẾT NỐI:${colors.reset} Không tìm thấy dịch vụ MySQL Server chạy tại ${dbConfig.host}:${dbConfig.port}.`);
      console.error(`   • Vui lòng bật nút Start MySQL trên XAMPP hoặc kiểm tra Windows Services (MySQL).`);
    } else {
      console.error(`👉 Chi tiết lỗi:`, error.message);
    }
    return false;

  } finally {
    if (rootConnection) {
      await rootConnection.end();
    }
  }
}

// Chạy trực tiếp từ CLI: node src/database/initDb.js
if (require.main === module) {
  initDb().then((success) => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { initDb, loadEnv };
