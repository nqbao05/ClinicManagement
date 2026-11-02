const { decrypt } = require('../../common/utils/crypto.util');

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
    blood_type = null,
    medical_history = null,
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
    this.blood_type = blood_type || null;
    this.medical_history = medical_history || null;
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
      blood_type: this.blood_type,
      medical_history: this.medical_history,
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

    let dob = null;
    if (row.date_of_birth) {
      if (row.date_of_birth instanceof Date) {
        dob = row.date_of_birth.toISOString().split('T')[0];
      } else {
        dob = String(row.date_of_birth).split('T')[0];
      }
    }

    let citizenId = row.citizen_id || row.identity_card || '';
    if (row.citizen_id_encrypted) {
      citizenId = decrypt(row.citizen_id_encrypted);
    }

    let phoneNumber = row.phone_number || '';
    if (row.phone_encrypted) {
      phoneNumber = decrypt(row.phone_encrypted);
    }

    return new Patient({
      patient_id: row.id || row.patient_id,
      origin_clinic_id: row.origin_clinic_id,
      citizen_id: citizenId,
      identity_card: citizenId,
      full_name: row.full_name,
      phone_number: phoneNumber,
      gender: row.gender,
      date_of_birth: dob,
      address: row.address,
      blood_type: row.blood_type,
      medical_history: row.medical_history,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
    });
  }
}

module.exports = Patient;
