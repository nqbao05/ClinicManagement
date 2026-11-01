/**
 * Domain Entity đại diện cho Bệnh nhân (Patient Entity)
 * Tuân thủ Clean Architecture: Độc lập với HTTP Framework & CSDL
 */
class Patient {
  /**
   * @param {Object} data
   */
  constructor({
    patient_id = null,
    origin_clinic_id,
    citizen_id,
    identity_card,
    full_name,
    phone_number,
    gender = 'Other',
    date_of_birth = null,
    address = null,
    created_at = null,
    updated_at = null
  } = {}) {
    this.patient_id = patient_id !== null && patient_id !== undefined ? Number(patient_id) : null;
    this.origin_clinic_id = Number(origin_clinic_id);
    this.citizen_id = citizen_id ? String(citizen_id).trim() : (identity_card ? String(identity_card).trim() : '');
    this.identity_card = this.citizen_id;
    this.full_name = String(full_name || '').trim();
    this.phone_number = String(phone_number || '').trim();
    this.gender = gender || 'Other';
    this.date_of_birth = date_of_birth || null;
    this.address = address || null;
    this.created_at = created_at || new Date().toISOString();
    this.updated_at = updated_at || new Date().toISOString();
  }

  /**
   * Chuyển đổi Model sang JSON Object thuần
   */
  toJSON() {
    return {
      patient_id: this.patient_id,
      origin_clinic_id: this.origin_clinic_id,
      citizen_id: this.citizen_id,
      identity_card: this.identity_card,
      full_name: this.full_name,
      phone_number: this.phone_number,
      gender: this.gender,
      date_of_birth: this.date_of_birth,
      address: this.address,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Khởi tạo Entity từ bản ghi truy vấn CSDL
   * @param {Object} row 
   * @returns {Patient|null}
   */
  static fromDatabaseRow(row) {
    if (!row) return null;

    // Ánh xạ Enum tiếng Việt từ MySQL (Nam/Nu/Khac) sang English DTO (Male/Female/Other)
    let gender = 'Other';
    if (row.gender === 'Nam' || row.gender === 'Male') gender = 'Male';
    else if (row.gender === 'Nu' || row.gender === 'Female') gender = 'Female';

    let dob = row.date_of_birth;
    if (dob instanceof Date) {
      const y = dob.getFullYear();
      const m = String(dob.getMonth() + 1).padStart(2, '0');
      const d = String(dob.getDate()).padStart(2, '0');
      dob = `${y}-${m}-${d}`;
    }

    return new Patient({
      patient_id: row.patient_id,
      origin_clinic_id: row.origin_clinic_id,
      citizen_id: row.identity_card || row.citizen_id,
      identity_card: row.identity_card || row.citizen_id,
      full_name: row.full_name,
      phone_number: row.phone_number,
      gender,
      date_of_birth: dob,
      address: row.address,
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  }
}

module.exports = Patient;
