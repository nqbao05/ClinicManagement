-- ============================================================================
-- CLINICCARE DISTRIBUTED DATABASE SCHEMA (SINGLE SOURCE OF TRUTH)
-- Hệ thống cơ sở dữ liệu phân mảnh (MySQL Horizontal Sharding)
-- Phân vùng 2 Node: clinic_hanoi (Cơ sở 1) & clinic_hcm (Cơ sở 2)
-- Tích hợp bảo mật PII: Mã hóa AES-256-CBC & HMAC-SHA256 Blind Index
-- ============================================================================

-- ============================================================================
-- 1. TẠO CƠ SỞ DỮ LIỆU SHARD 1: clinic_hanoi
-- ============================================================================
CREATE DATABASE IF NOT EXISTS `clinic_hanoi` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `clinic_hanoi`;

DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `doctors`;
DROP TABLE IF EXISTS `clinics`;

-- Bảng 1: Cơ sở phòng khám (Clinics)
CREATE TABLE `clinics` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 2: Bác sĩ & Nhân sự Y tế (Doctors)
CREATE TABLE `doctors` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `clinic_id` INT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctors_clinic` (`clinic_id`),
  INDEX `idx_doctors_specialty` (`specialty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 3: Hồ sơ bệnh nhân phân mảnh theo origin_clinic_id (Patients)
CREATE TABLE `patients` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `origin_clinic_id` INT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `citizen_id_encrypted` VARCHAR(255) NOT NULL COMMENT 'Mã hóa AES-256-CBC',
  `phone_encrypted` VARCHAR(255) NOT NULL COMMENT 'Mã hóa AES-256-CBC',
  `citizen_id_bindex` VARCHAR(64) NOT NULL UNIQUE COMMENT 'Blind Index băm HMAC-SHA256',
  `phone_bindex` VARCHAR(64) NOT NULL COMMENT 'Blind Index băm HMAC-SHA256',
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('male', 'female', 'other') NOT NULL,
  `address` VARCHAR(255) NULL,
  `blood_type` VARCHAR(10) NULL,
  `medical_history` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_citizen_bindex` (`citizen_id_bindex`),
  INDEX `idx_phone_bindex` (`phone_bindex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 4: Lịch hẹn khám bệnh & Khóa chống trùng slot (Appointments)
CREATE TABLE `appointments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `clinic_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `patient_id` INT NOT NULL,
  `slot_time` DATETIME NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_doctor_slot` (`doctor_id`, `slot_time`),
  INDEX `idx_slot_time` (`slot_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng 5: Tài khoản xác thực & Phân quyền RBAC (Users)
CREATE TABLE `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff', 'patient') NOT NULL,
  `clinic_id` INT NULL,
  `patient_id` INT NULL,
  `reset_token_hash` VARCHAR(255) NULL,
  `reset_token_expires_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu Shard 1 (Hà Nội)
INSERT INTO `clinics` (`id`, `name`, `address`, `phone`) VALUES
(1, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 1 Hà Nội', 'Số 1 Phố Tràng Thi, Hoàn Kiếm, Hà Nội', '024-3825-5555');

INSERT INTO `doctors` (`id`, `clinic_id`, `full_name`, `specialty`, `phone`, `status`) VALUES
(1, 1, 'BS. CKI Nguyễn Văn A', 'Khoa Tim Mạch', '0901234561', 'active'),
(2, 1, 'BS. CKII Lê Thị B', 'Khoa Nội', '0901234562', 'active'),
(3, 1, 'ThS.BS Hoàng Minh C', 'Khoa Nhi', '0901234563', 'active'),
(4, 1, 'BS. Đỗ Quang D', 'Khoa Mắt', '0901234564', 'active');


-- ============================================================================
-- 2. TẠO CƠ SỞ DỮ LIỆU SHARD 2: clinic_hcm
-- ============================================================================
CREATE DATABASE IF NOT EXISTS `clinic_hcm` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `clinic_hcm`;

DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `doctors`;
DROP TABLE IF EXISTS `clinics`;

CREATE TABLE `clinics` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctors` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `clinic_id` INT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_doctors_clinic` (`clinic_id`),
  INDEX `idx_doctors_specialty` (`specialty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patients` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `origin_clinic_id` INT NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `citizen_id_encrypted` VARCHAR(255) NOT NULL,
  `phone_encrypted` VARCHAR(255) NOT NULL,
  `citizen_id_bindex` VARCHAR(64) NOT NULL UNIQUE,
  `phone_bindex` VARCHAR(64) NOT NULL,
  `date_of_birth` DATE NOT NULL,
  `gender` ENUM('male', 'female', 'other') NOT NULL,
  `address` VARCHAR(255) NULL,
  `blood_type` VARCHAR(10) NULL,
  `medical_history` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_citizen_bindex` (`citizen_id_bindex`),
  INDEX `idx_phone_bindex` (`phone_bindex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `clinic_id` INT NOT NULL,
  `doctor_id` INT NOT NULL,
  `patient_id` INT NOT NULL,
  `slot_time` DATETIME NOT NULL,
  `status` ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_doctor_slot` (`doctor_id`, `slot_time`),
  INDEX `idx_slot_time` (`slot_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'staff', 'patient') NOT NULL,
  `clinic_id` INT NULL,
  `patient_id` INT NULL,
  `reset_token_hash` VARCHAR(255) NULL,
  `reset_token_expires_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu Shard 2 (TP.HCM)
INSERT INTO `clinics` (`id`, `name`, `address`, `phone`) VALUES
(2, 'Phòng khám Đa khoa Quốc tế ClinicCare - Cơ sở 2 TP.HCM', 'Số 201 Nguyễn Thị Minh Khai, Quận 1, TP.HCM', '028-3925-6666');

INSERT INTO `doctors` (`id`, `clinic_id`, `full_name`, `specialty`, `phone`, `status`) VALUES
(1, 2, 'TS.BS Trần Văn C', 'Khoa Tim Mạch', '0909876541', 'active'),
(2, 2, 'BS. CKI Phạm Thị D', 'Khoa Cơ Xương Khớp', '0909876542', 'active'),
(3, 2, 'ThS.BS Vũ Hải E', 'Khoa Nhi', '0909876543', 'active'),
(4, 2, 'BS. CKII Nguyễn Minh F', 'Khoa Thần Kinh', '0909876544', 'active');
