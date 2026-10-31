const { getDbPool } = require('../config/database');
const Patient = require('../models/patient.model');

/**
 * Custom Error đại diện cho lỗi Timeout kết nối đa cơ sở (Kịch bản PRD 2.2)
 */
class GatewayTimeoutError extends Error {
  constructor(message = 'Không thể kết nối đến máy chủ khu vực chi nhánh (Gateway Timeout)') {
    super(message);
    this.name = 'GatewayTimeoutError';
    this.statusCode = 504;
    this.code = 'GATEWAY_TIMEOUT';
  }
}

/**
 * In-memory Fallback Database Driver mô phỏng SQLite Driver
 * Kích hoạt khi chạy Unit/Integration Tests hoặc khi MySQL không khả dụng
 */
class MemoryShardDatabase {
  constructor() {
    this.records = [];
    this.autoIncrement = 1;
  }

  exec(sql) {}

  prepare(sql) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    const self = this;

    if (trimmed.startsWith('INSERT INTO patients')) {
      return {
        run(...args) {
          const id = self.autoIncrement++;
          const now = new Date().toISOString();
          const record = {
            patient_id: id,
            origin_clinic_id: Number(args[0]),
            identity_card: String(args[1]),
            full_name: String(args[2]),
            phone_number: String(args[3]),
            gender: args[4] || 'Khac',
            date_of_birth: args[5] || null,
            address: args[6] || null,
            blood_type: args[7] || null,
            medical_history: args[8] || null,
            created_at: now,
            updated_at: now
          };
          self.records.push(record);
          return { lastInsertRowid: id, changes: 1 };
        }
      };
    }

    if (trimmed.includes('SELECT * FROM patients WHERE patient_id = ?')) {
      return {
        get(id) {
          return self.records.find((r) => r.patient_id === Number(id)) || null;
        }
      };
    }

    if (trimmed.includes('SELECT * FROM patients WHERE identity_card = ?')) {
      return {
        get(card) {
          return self.records.find((r) => r.identity_card === String(card).trim()) || null;
        }
      };
    }

    if (trimmed.startsWith('SELECT * FROM patients ORDER BY patient_id DESC')) {
      return {
        all() {
          return [...self.records].sort((a, b) => b.patient_id - a.patient_id);
        }
      };
    }

    if (trimmed.startsWith('UPDATE patients SET')) {
      return {
        run(fullName, phone, gender, dob, address, blood, medHist, id) {
          const rec = self.records.find((r) => r.patient_id === Number(id));
          if (!rec) return { changes: 0 };
          rec.full_name = fullName;
          rec.phone_number = phone;
          rec.gender = gender;
          rec.date_of_birth = dob;
          rec.address = address;
          rec.blood_type = blood;
          rec.medical_history = medHist;
          rec.updated_at = new Date().toISOString();
          return { changes: 1 };
        }
      };
    }

    if (trimmed.startsWith('DELETE FROM patients WHERE patient_id = ?')) {
      return {
        run(id) {
          const initialLen = self.records.length;
          self.records = self.records.filter((r) => r.patient_id !== Number(id));
          return { changes: initialLen - self.records.length };
        }
      };
    }

    return {
      run() { return { changes: 0 }; },
      get() { return null; },
      all() { return []; }
    };
  }
}

/**
 * Repository tương tác dữ liệu Bệnh nhân
 * Hiện thực kiến trúc Database Sharding đa cơ sở (Node Hà Nội: clinic_hanoi & Node TP.HCM: clinic_hcm)
 */
class PatientRepository {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.useMemory]
   * @param {Object} [options.db]
   * @param {Object} [options.nodes]
   */
  constructor(options = {}) {
    this.useMemory = Boolean(
      options.useMemory ||
      process.env.NODE_ENV === 'test' ||
      options.nodes ||
      options.db
    );

    this.simulateTimeout = {
      1: false,
      2: false
    };

    const self = this;
    const memDb1 = (options.nodes && options.nodes[1]) || (options.db ? options.db : new MemoryShardDatabase());
    const memDb2 = (options.nodes && options.nodes[2]) || new MemoryShardDatabase();

    this.nodes = {
      1: {
        nodeId: 1,
        name: 'Node Hà Nội',
        location: 'Hà Nội',
        ip: '10.0.1.10',
        db: memDb1,
        get simulateTimeout() { return self.simulateTimeout[1]; },
        set simulateTimeout(val) { self.simulateTimeout[1] = Boolean(val); }
      },
      2: {
        nodeId: 2,
        name: 'Node TP.HCM',
        location: 'TP.HCM',
        ip: '10.0.2.10',
        db: memDb2,
        get simulateTimeout() { return self.simulateTimeout[2]; },
        set simulateTimeout(val) { self.simulateTimeout[2] = Boolean(val); }
      }
    };
  }

  /**
   * Bật/tắt cờ giả lập sự cố kết nối / timeout sang một node cụ thể (Dùng cho test & demo PRD 2.2)
   * @param {number|string} clinicId 
   * @param {boolean} isTimeout 
   */
  setNodeTimeoutSimulation(clinicId, isTimeout = true) {
    const id = Number(clinicId);
    if (this.simulateTimeout[id] !== undefined) {
      this.simulateTimeout[id] = Boolean(isTimeout);
    }
  }

  /**
   * Định tuyến kết nối node bộ nhớ
   * @param {number|string} originClinicId
   * @returns {Object}
   */
  getNodeConnection(originClinicId) {
    const clinicId = Number(originClinicId);
    const node = this.nodes[clinicId] || this.nodes[1];

    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(
        `Không thể kết nối đến máy chủ khu vực ${node.name} (${node.ip}), vui lòng thử lại sau`
      );
    }

    return node;
  }

  /**
   * Tạo mới hồ sơ bệnh nhân trên đúng Shard Node tương ứng với origin_clinic_id
   * @param {Object} patientData 
   * @returns {Promise<Patient>}
   */
  async create(patientData) {
    const clinicId = Number(patientData.origin_clinic_id) || 1;
    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
    }

    if (!this.useMemory) {
      try {
        const pool = getDbPool(clinicId);
        const [result] = await pool.query(
          `INSERT INTO patients (
            origin_clinic_id, identity_card, full_name, phone_number,
            gender, date_of_birth, address, blood_type, medical_history
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clinicId,
            patientData.identity_card,
            patientData.full_name,
            patientData.phone_number,
            patientData.gender || 'Khac',
            patientData.date_of_birth || null,
            patientData.address || null,
            patientData.blood_type || null,
            patientData.medical_history || null
          ]
        );

        const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [result.insertId]);
        return Patient.fromDatabaseRow(rows[0]);
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.create] MySQL fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(clinicId);
    const stmt = node.db.prepare(`
      INSERT INTO patients (
        origin_clinic_id, identity_card, full_name, phone_number,
        gender, date_of_birth, address, blood_type, medical_history,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const res = stmt.run(
      clinicId,
      patientData.identity_card,
      patientData.full_name,
      patientData.phone_number,
      patientData.gender || 'Khac',
      patientData.date_of_birth || null,
      patientData.address || null,
      patientData.blood_type || null,
      patientData.medical_history || null
    );

    const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(res.lastInsertRowid);
    return Patient.fromDatabaseRow(row);
  }

  /**
   * Lấy danh sách bệnh nhân có hỗ trợ lọc theo origin_clinic_id
   * @param {Object} [filter]
   * @param {number} [filter.origin_clinic_id]
   * @returns {Promise<Array<Patient>>}
   */
  async findAll(filter = {}) {
    const results = [];

    if (filter.origin_clinic_id) {
      const clinicId = Number(filter.origin_clinic_id);
      if (this.simulateTimeout[clinicId]) {
        throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
      }

      if (!this.useMemory) {
        try {
          const pool = getDbPool(clinicId);
          const [rows] = await pool.query('SELECT * FROM patients ORDER BY patient_id DESC');
          return rows.map((r) => Patient.fromDatabaseRow(r));
        } catch (err) {
          if (err.name === 'GatewayTimeoutError') throw err;
          console.warn('[PatientRepository.findAll] MySQL fallback to memory:', err.message);
        }
      }

      const node = this.getNodeConnection(clinicId);
      const rows = node.db.prepare('SELECT * FROM patients ORDER BY patient_id DESC').all();
      return rows.map((r) => Patient.fromDatabaseRow(r));
    }

    // Quét toàn bộ 2 Shard Node
    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }

        const [hanoiRows] = await getDbPool(1).query('SELECT * FROM patients ORDER BY patient_id DESC');
        const [hcmRows] = await getDbPool(2).query('SELECT * FROM patients ORDER BY patient_id DESC');

        const allRows = [...hanoiRows, ...hcmRows].sort((a, b) => b.patient_id - a.patient_id);
        return allRows.map((r) => Patient.fromDatabaseRow(r));
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.findAll] MySQL fallback to memory:', err.message);
      }
    }

    for (const key of Object.keys(this.nodes)) {
      const node = this.getNodeConnection(key);
      const rows = node.db.prepare('SELECT * FROM patients ORDER BY patient_id DESC').all();
      results.push(...rows.map((r) => Patient.fromDatabaseRow(r)));
    }

    return results;
  }

  /**
   * Tìm bệnh nhân theo ID
   * @param {number|string} id 
   * @param {number|string} [originClinicId]
   * @returns {Promise<Patient|null>}
   */
  async findById(id, originClinicId = null) {
    const patientId = Number(id);

    if (originClinicId) {
      const clinicId = Number(originClinicId);
      if (this.simulateTimeout[clinicId]) {
        throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
      }

      if (!this.useMemory) {
        try {
          const pool = getDbPool(clinicId);
          const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
          return rows[0] ? Patient.fromDatabaseRow(rows[0]) : null;
        } catch (err) {
          if (err.name === 'GatewayTimeoutError') throw err;
          console.warn('[PatientRepository.findById] MySQL fallback to memory:', err.message);
        }
      }

      const node = this.getNodeConnection(clinicId);
      const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(patientId);
      return Patient.fromDatabaseRow(row);
    }

    // Quét tìm qua cả 2 Node
    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        const [hanoiRows] = await getDbPool(1).query('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
        if (hanoiRows.length > 0) {
          return Patient.fromDatabaseRow(hanoiRows[0]);
        }

        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }
        const [hcmRows] = await getDbPool(2).query('SELECT * FROM patients WHERE patient_id = ?', [patientId]);
        if (hcmRows.length > 0) {
          return Patient.fromDatabaseRow(hcmRows[0]);
        }

        return null;
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.findById] MySQL fallback to memory:', err.message);
      }
    }

    for (const key of Object.keys(this.nodes)) {
      const node = this.getNodeConnection(key);
      const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(patientId);
      if (row) {
        return Patient.fromDatabaseRow(row);
      }
    }

    return null;
  }

  /**
   * Tìm bệnh nhân theo số CCCD/CMND (Định danh duy nhất)
   * @param {string} identityCard 
   * @returns {Promise<Patient|null>}
   */
  async findByIdentityCard(identityCard) {
    const cccd = String(identityCard).trim();

    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        const [hanoiRows] = await getDbPool(1).query('SELECT * FROM patients WHERE identity_card = ?', [cccd]);
        if (hanoiRows.length > 0) {
          return Patient.fromDatabaseRow(hanoiRows[0]);
        }

        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }
        const [hcmRows] = await getDbPool(2).query('SELECT * FROM patients WHERE identity_card = ?', [cccd]);
        if (hcmRows.length > 0) {
          return Patient.fromDatabaseRow(hcmRows[0]);
        }

        return null;
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.findByIdentityCard] MySQL fallback to memory:', err.message);
      }
    }

    for (const key of Object.keys(this.nodes)) {
      const node = this.getNodeConnection(key);
      const row = node.db.prepare('SELECT * FROM patients WHERE identity_card = ?').get(cccd);
      if (row) {
        return Patient.fromDatabaseRow(row);
      }
    }

    return null;
  }

  /**
   * Cập nhật thông tin bệnh nhân
   * @param {number|string} id 
   * @param {Object} updateData 
   * @returns {Promise<Patient|null>}
   */
  async update(id, updateData) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const clinicId = existing.origin_clinic_id;
    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
    }

    const updatedFields = {
      full_name: updateData.full_name !== undefined ? updateData.full_name : existing.full_name,
      phone_number: updateData.phone_number !== undefined ? updateData.phone_number : existing.phone_number,
      gender: updateData.gender !== undefined ? updateData.gender : existing.gender,
      date_of_birth: updateData.date_of_birth !== undefined ? updateData.date_of_birth : existing.date_of_birth,
      address: updateData.address !== undefined ? updateData.address : existing.address,
      blood_type: updateData.blood_type !== undefined ? updateData.blood_type : existing.blood_type,
      medical_history: updateData.medical_history !== undefined ? updateData.medical_history : existing.medical_history
    };

    if (!this.useMemory) {
      try {
        const pool = getDbPool(clinicId);
        await pool.query(
          `UPDATE patients SET
            full_name = ?,
            phone_number = ?,
            gender = ?,
            date_of_birth = ?,
            address = ?,
            blood_type = ?,
            medical_history = ?
          WHERE patient_id = ?`,
          [
            updatedFields.full_name,
            updatedFields.phone_number,
            updatedFields.gender,
            updatedFields.date_of_birth,
            updatedFields.address,
            updatedFields.blood_type,
            updatedFields.medical_history,
            existing.patient_id
          ]
        );

        const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [existing.patient_id]);
        return Patient.fromDatabaseRow(rows[0]);
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.update] MySQL fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(clinicId);
    node.db.prepare(`
      UPDATE patients SET
        full_name = ?,
        phone_number = ?,
        gender = ?,
        date_of_birth = ?,
        address = ?,
        blood_type = ?,
        medical_history = ?,
        updated_at = datetime('now')
      WHERE patient_id = ?
    `).run(
      updatedFields.full_name,
      updatedFields.phone_number,
      updatedFields.gender,
      updatedFields.date_of_birth,
      updatedFields.address,
      updatedFields.blood_type,
      updatedFields.medical_history,
      existing.patient_id
    );

    const updatedRow = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(existing.patient_id);
    return Patient.fromDatabaseRow(updatedRow);
  }

  /**
   * Xóa hồ sơ bệnh nhân
   * @param {number|string} id 
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return false;

    const clinicId = existing.origin_clinic_id;
    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
    }

    if (!this.useMemory) {
      try {
        const pool = getDbPool(clinicId);
        const [result] = await pool.query('DELETE FROM patients WHERE patient_id = ?', [existing.patient_id]);
        return result.affectedRows > 0;
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.delete] MySQL fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(clinicId);
    const result = node.db.prepare('DELETE FROM patients WHERE patient_id = ?').run(existing.patient_id);
    return result.changes > 0;
  }
}

module.exports = {
  PatientRepository,
  GatewayTimeoutError
};
