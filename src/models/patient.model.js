/**
 * Model đại diện cho thực thể Bệnh nhân (PATIENT)
 * Ánh xạ theo lược đồ ERD (erd.mermaid) & kiến trúc Clean Architecture
 */
class Patient {
  /**
   * @param {Object} data
   * @param {number|null} [data.patient_id]
   * @param {number} data.origin_clinic_id - Khóa phân mảnh (Sharding Key xác định node CSDL gốc)
   * @param {string} data.identity_card - Số CCCD/CMND định danh duy nhất của bệnh nhân
   * @param {string} data.full_name - Họ và tên bệnh nhân
   * @param {string} data.phone_number - Số điện thoại liên lạc
   * @param {string} [data.gender] - Giới tính: 'Nam', 'Nu', 'Khac'
   * @param {string} [data.date_of_birth] - Ngày sinh (YYYY-MM-DD)
   * @param {string} [data.address] - Địa chỉ thường trú
   * @param {string} [data.blood_type] - Nhóm máu: 'A', 'B', 'AB', 'O' (+/-)
   * @param {string} [data.medical_history] - Tiền sử bệnh án
   * @param {string} [data.created_at] - Thời điểm tạo bản ghi
   * @param {string} [data.updated_at] - Thời điểm cập nhật bản ghi
   */
  constructor({
    patient_id = null,
    origin_clinic_id,
    identity_card,
    full_name,
    phone_number,
    gender = 'Khac',
    date_of_birth = null,
    address = null,
    blood_type = null,
    medical_history = null,
    created_at = null,
    updated_at = null
  } = {}) {
    this.patient_id = patient_id !== null && patient_id !== undefined ? Number(patient_id) : null;
    this.origin_clinic_id = origin_clinic_id !== undefined ? Number(origin_clinic_id) : null;
    this.identity_card = identity_card ? String(identity_card).trim() : '';
    this.full_name = full_name ? String(full_name).trim() : '';
    this.phone_number = phone_number ? String(phone_number).trim() : '';
    this.gender = gender || 'Khac';
    this.date_of_birth = date_of_birth || null;
    this.address = address || null;
    this.blood_type = blood_type || null;
    this.medical_history = medical_history || null;
    this.created_at = created_at || new Date().toISOString();
    this.updated_at = updated_at || new Date().toISOString();
  }

  /**
   * Chuyển đổi Model sang đối tượng JSON thuần
   * @returns {Object}
   */
  toJSON() {
    return {
      patient_id: this.patient_id,
      origin_clinic_id: this.origin_clinic_id,
      identity_card: this.identity_card,
      full_name: this.full_name,
      phone_number: this.phone_number,
      gender: this.gender,
      date_of_birth: this.date_of_birth,
      address: this.address,
      blood_type: this.blood_type,
      medical_history: this.medical_history,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Khởi tạo Model từ kết quả truy vấn cơ sở dữ liệu
   * @param {Object} row 
   * @returns {Patient|null}
   */
  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Patient(row);
  }
}

module.exports = Patient;
