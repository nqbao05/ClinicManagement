-- ============================================================================
-- CLINICCARE CENTRALIZED DATABASE SCHEMA (SINGLE SOURCE OF TRUTH)
-- CSDL duy nhất: clinic_db (Mô hình 1 Cơ sở)
-- Tích hợp bảo mật PII: Mã hóa AES-256-CBC & HMAC-SHA256 Blind Index
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `clinic_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `clinic_db`;

-- Xóa bảng cũ nếu tồn tại (Đã sắp xếp theo thứ tự Khóa ngoại để không báo lỗi)
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `doctors`;
DROP TABLE IF EXISTS `clinics`;

-- Bảng 1: Cơ sở / Phòng khám trung tâm (Chỉ dùng lưu thông tin cấu hình hiển thị)
CREATE TABLE `clinics` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 2: Bác sĩ chuyên khoa & Xóa mềm
CREATE TABLE `doctors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20),
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `is_deleted` TINYINT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctors_specialty` (`specialty`),
  INDEX `idx_doctors_status` (`status`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 3: Hồ sơ bệnh nhân tập trung & Bảo mật PII
CREATE TABLE `patients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `full_name` VARCHAR(100) NOT NULL,
  `citizen_id_encrypted` VARCHAR(255) NOT NULL COMMENT 'Mã hóa AES-256-CBC',
  `citizen_id_bindex` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Blind Index băm HMAC-SHA256',
  `phone_encrypted` VARCHAR(255) NOT NULL COMMENT 'Mã hóa AES-256-CBC',
  `phone_bindex` VARCHAR(64) NOT NULL COMMENT 'Blind Index băm HMAC-SHA256',
  `date_of_birth` DATE,
  `gender` ENUM('male', 'female', 'other'),
  `address` VARCHAR(255),
  `blood_type` VARCHAR(10) NULL,
  `medical_history` TEXT NULL,
  `is_deleted` TINYINT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_patients_citizen_bindex` (`citizen_id_bindex`),
  INDEX `idx_patients_phone_bindex` (`phone_bindex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 4: Lịch hẹn khám bệnh & Khóa chống trùng slot
CREATE TABLE `appointments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patient_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `slot_time` DATETIME NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_doctor_slot` (`doctor_id`, `slot_time`),
  INDEX `idx_appointments_patient` (`patient_id`),
  INDEX `idx_appointments_date` (`slot_time`),
  CONSTRAINT `fk_app_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`),
  CONSTRAINT `fk_app_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 5: Tài khoản xác thực & Phân quyền RBAC
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff', 'doctor', 'patient') NOT NULL,
  `clinic_id` INT DEFAULT 1,
  `patient_id` INT NULL,
  `doctor_id` INT NULL,
  `reset_token_hash` VARCHAR(255) NULL,
  `reset_token_expires_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_user_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- DỮ LIỆU MẪU (MOCK DATA)
-- ============================================================================

INSERT INTO `clinics` (`id`, `name`, `address`, `phone`) VALUES
(1, 'Phòng khám Đa khoa Quốc tế ClinicCare', 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội', '1900-6868');

INSERT INTO `doctors` (`id`, `full_name`, `specialty`, `phone`, `status`, `is_deleted`) VALUES
(1, 'BS. CKI Nguyễn Văn A', 'Khoa Tim Mạch', '0901234561', 'active', 0),
(2, 'BS. CKII Lê Thị B', 'Khoa Nội', '0901234562', 'active', 0),
(3, 'ThS.BS Hoàng Minh C', 'Khoa Nhi', '0901234563', 'active', 0),
(4, 'BS. Đỗ Quang D', 'Khoa Mắt', '0901234564', 'active', 0),
(5, 'TS.BS Trần Văn C', 'Khoa Tim Mạch', '0909876541', 'active', 0),
(6, 'BS. CKI Phạm Thị D', 'Khoa Cơ Xương Khớp', '0909876542', 'active', 0),
(7, 'ThS.BS Vũ Hải E', 'Khoa Nhi', '0909876543', 'active', 0),
(8, 'BS. CKII Nguyễn Minh F', 'Khoa Thần Kinh', '0909876544', 'active', 0);