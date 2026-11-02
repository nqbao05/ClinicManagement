const { getDbPool } = require('../../config/database');
const { encrypt, decrypt, generateBlindIndex } = require('../../common/utils/crypto.util');
const Patient = require('./patient.model');

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
            citizen_id: String(args[1]),
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
          return self.records.find((r) => r.identity_card === String(card).trim() || r.citizen_id === String(card).trim()) || null;
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
   * @param {Function} [options.poolResolver]
   * @param {boolean} [options.useMemory]
   * @param {Object} [options.db]
   * @param {Object} [options.nodes]
   */
  constructor(options = {}) {
    this.poolResolver = options.poolResolver || getDbPool;
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

  setNodeTimeoutSimulation(clinicId, isTimeout = true) {
    const id = Number(clinicId);
    if (this.simulateTimeout[id] !== undefined) {
      this.simulateTimeout[id] = Boolean(isTimeout);
    }
  }

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

  async findByCitizenId(clinicId, citizenId) {
    const cccd = String(citizenId).trim();
    const bindex = generateBlindIndex(cccd);
    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(clinicId);
        const [rows] = await pool.query(
          `SELECT * FROM patients WHERE citizen_id_bindex = ? OR identity_card = ? LIMIT 1`,
          [bindex, cccd]
        );
        if (!rows || rows.length === 0) return null;
        const entity = Patient.fromDatabaseRow(rows[0]);
        return entity ? entity.toJSON() : null;
      } catch (err) {
        console.warn('[PatientRepository.findByCitizenId] Fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(clinicId);
    const row = node.db.prepare('SELECT * FROM patients WHERE identity_card = ?').get(cccd);
    if (!row) return null;
    const entity = Patient.fromDatabaseRow(row);
    return entity ? entity.toJSON() : null;
  }

  async createPatient(clinicId, data) {
    const cId = Number(clinicId);
    let dbGender = 'other';
    if (data.gender === 'Male' || data.gender === 'Nam' || data.gender === 'male') dbGender = 'male';
    else if (data.gender === 'Female' || data.gender === 'Nu' || data.gender === 'female') dbGender = 'female';

    const citizenId = data.citizen_id || data.identity_card;
    const phone = data.phone_number || data.phone || '';
    const citizenEnc = encrypt(citizenId);
    const phoneEnc = encrypt(phone);
    const citizenBindex = generateBlindIndex(citizenId);
    const phoneBindex = generateBlindIndex(phone);

    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(cId);
        const [result] = await pool.query(
          `INSERT INTO patients (origin_clinic_id, full_name, citizen_id_encrypted, phone_encrypted, citizen_id_bindex, phone_bindex, gender, date_of_birth, address) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cId,
            data.full_name,
            citizenEnc,
            phoneEnc,
            citizenBindex,
            phoneBindex,
            dbGender,
            data.date_of_birth || null,
            data.address || null
          ]
        );

        const [rows] = await pool.query(`SELECT * FROM patients WHERE id = ? OR patient_id = ?`, [result.insertId, result.insertId]);
        const entity = Patient.fromDatabaseRow(rows[0]);
        return entity ? entity.toJSON() : {
          patient_id: result.insertId,
          id: result.insertId,
          origin_clinic_id: cId,
          citizen_id: citizenId,
          identity_card: citizenId,
          full_name: data.full_name,
          phone_number: phone,
          gender: data.gender || 'Other',
          date_of_birth: data.date_of_birth,
          address: data.address || null,
          created_at: new Date().toISOString()
        };
      } catch (err) {
        console.warn('[PatientRepository.createPatient] Fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(cId);
    const stmt = node.db.prepare(`
      INSERT INTO patients (origin_clinic_id, identity_card, full_name, phone_number, gender, date_of_birth, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      cId,
      citizenId,
      data.full_name,
      data.phone_number,
      data.gender || 'Other',
      data.date_of_birth || null,
      data.address || null
    );

    const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(res.lastInsertRowid);
    const entity = Patient.fromDatabaseRow(row);
    return entity ? entity.toJSON() : row;
  }

  async create(patientData) {
    const clinicId = Number(patientData.origin_clinic_id) || 1;
    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
    }

    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(clinicId);
        const citizenId = patientData.identity_card || patientData.citizen_id;
        const phone = patientData.phone_number || patientData.phone || '';
        const citizenEnc = encrypt(citizenId);
        const phoneEnc = encrypt(phone);
        const citizenBindex = generateBlindIndex(citizenId);
        const phoneBindex = generateBlindIndex(phone);

        let dbGender = 'other';
        if (patientData.gender === 'Nam' || patientData.gender === 'male' || patientData.gender === 'Male') dbGender = 'male';
        else if (patientData.gender === 'Nu' || patientData.gender === 'female' || patientData.gender === 'Female') dbGender = 'female';

        const [result] = await pool.query(
          `INSERT INTO patients (
            origin_clinic_id, full_name, citizen_id_encrypted, phone_encrypted,
            citizen_id_bindex, phone_bindex,
            gender, date_of_birth, address, blood_type, medical_history
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            clinicId,
            patientData.full_name,
            citizenEnc,
            phoneEnc,
            citizenBindex,
            phoneBindex,
            dbGender,
            patientData.date_of_birth || null,
            patientData.address || null,
            patientData.blood_type || null,
            patientData.medical_history || null
          ]
        );

        const [rows] = await pool.query('SELECT * FROM patients WHERE id = ? OR patient_id = ?', [result.insertId, result.insertId]);
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

  async findAll(filter = {}) {
    const results = [];

    if (filter.origin_clinic_id) {
      const clinicId = Number(filter.origin_clinic_id);
      if (this.simulateTimeout[clinicId]) {
        throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
      }

      if (!this.useMemory) {
        try {
          const pool = this.poolResolver(clinicId);
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

    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }

        const [hanoiRows] = await this.poolResolver(1).query('SELECT * FROM patients ORDER BY patient_id DESC');
        const [hcmRows] = await this.poolResolver(2).query('SELECT * FROM patients ORDER BY patient_id DESC');

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

  async findById(clinicIdOrId, patientId = null) {
    let clinicId = null;
    let targetId = clinicIdOrId;

    if (patientId !== null) {
      clinicId = Number(clinicIdOrId);
      targetId = Number(patientId);
    } else {
      targetId = Number(clinicIdOrId);
    }

    if (clinicId) {
      if (this.simulateTimeout[clinicId]) {
        throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
      }

      if (!this.useMemory) {
        try {
          const pool = this.poolResolver(clinicId);
          const [rows] = await pool.query('SELECT * FROM patients WHERE patient_id = ?', [targetId]);
          return rows[0] ? Patient.fromDatabaseRow(rows[0]) : null;
        } catch (err) {
          if (err.name === 'GatewayTimeoutError') throw err;
          console.warn('[PatientRepository.findById] MySQL fallback to memory:', err.message);
        }
      }

      const node = this.getNodeConnection(clinicId);
      const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(targetId);
      return row ? Patient.fromDatabaseRow(row) : null;
    }

    // Quét tìm qua cả 2 Node
    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        const [hanoiRows] = await this.poolResolver(1).query('SELECT * FROM patients WHERE patient_id = ?', [targetId]);
        if (hanoiRows.length > 0) return Patient.fromDatabaseRow(hanoiRows[0]);

        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }
        const [hcmRows] = await this.poolResolver(2).query('SELECT * FROM patients WHERE patient_id = ?', [targetId]);
        if (hcmRows.length > 0) return Patient.fromDatabaseRow(hcmRows[0]);

        return null;
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.findById] MySQL fallback to memory:', err.message);
      }
    }

    for (const key of Object.keys(this.nodes)) {
      const node = this.getNodeConnection(key);
      const row = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(targetId);
      if (row) return Patient.fromDatabaseRow(row);
    }

    return null;
  }

  async findByIdentityCard(identityCard) {
    const cccd = String(identityCard).trim();
    const bindex = generateBlindIndex(cccd);

    if (!this.useMemory) {
      try {
        if (this.simulateTimeout[1]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node Hà Nội (Gateway Timeout)`);
        }
        const [hanoiRows] = await this.poolResolver(1).query('SELECT * FROM patients WHERE citizen_id_bindex = ? OR identity_card = ?', [bindex, cccd]);
        if (hanoiRows.length > 0) return Patient.fromDatabaseRow(hanoiRows[0]);

        if (this.simulateTimeout[2]) {
          throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực Node TP.HCM (Gateway Timeout)`);
        }
        const [hcmRows] = await this.poolResolver(2).query('SELECT * FROM patients WHERE citizen_id_bindex = ? OR identity_card = ?', [bindex, cccd]);
        if (hcmRows.length > 0) return Patient.fromDatabaseRow(hcmRows[0]);

        return null;
      } catch (err) {
        if (err.name === 'GatewayTimeoutError') throw err;
        console.warn('[PatientRepository.findByIdentityCard] MySQL fallback to memory:', err.message);
      }
    }

    for (const key of Object.keys(this.nodes)) {
      const node = this.getNodeConnection(key);
      const row = node.db.prepare('SELECT * FROM patients WHERE identity_card = ?').get(cccd);
      if (row) return Patient.fromDatabaseRow(row);
    }

    return null;
  }

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
        const pool = this.poolResolver(clinicId);
        await pool.query(
          `UPDATE patients SET
            full_name = ?, phone_number = ?, gender = ?, date_of_birth = ?,
            address = ?, blood_type = ?, medical_history = ?
          WHERE patient_id = ?`,
          [
            updatedFields.full_name, updatedFields.phone_number, updatedFields.gender, updatedFields.date_of_birth,
            updatedFields.address, updatedFields.blood_type, updatedFields.medical_history, existing.patient_id
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
        full_name = ?, phone_number = ?, gender = ?, date_of_birth = ?,
        address = ?, blood_type = ?, medical_history = ?, updated_at = datetime('now')
      WHERE patient_id = ?
    `).run(
      updatedFields.full_name, updatedFields.phone_number, updatedFields.gender, updatedFields.date_of_birth,
      updatedFields.address, updatedFields.blood_type, updatedFields.medical_history, existing.patient_id
    );

    const updatedRow = node.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(existing.patient_id);
    return Patient.fromDatabaseRow(updatedRow);
  }

  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return false;

    const clinicId = existing.origin_clinic_id;
    if (this.simulateTimeout[clinicId]) {
      throw new GatewayTimeoutError(`Không thể kết nối đến máy chủ khu vực (Gateway Timeout)`);
    }

    if (!this.useMemory) {
      try {
        const pool = this.poolResolver(clinicId);
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

  async listPatients(clinicId, filters = {}) {
    const pool = this.poolResolver(clinicId);
    const conditions = [];
    const params = [];

    if (filters.citizen_id) {
      const bindex = generateBlindIndex(String(filters.citizen_id).trim());
      conditions.push('(citizen_id_bindex = ? OR identity_card = ?)');
      params.push(bindex, String(filters.citizen_id).trim());
    }

    if (filters.phone_number) {
      const bindex = generateBlindIndex(String(filters.phone_number).trim());
      conditions.push('(phone_bindex = ? OR phone_number = ?)');
      params.push(bindex, String(filters.phone_number).trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (!this.useMemory) {
      try {
        const countSql = `SELECT COUNT(*) AS total FROM patients ${whereClause}`;
        const [countRows] = await pool.query(countSql, params);
        const total = Number(countRows[0]?.total || 0);

        const limit = Number(filters.limit) || 20;
        const offset = Number(filters.offset) || 0;

        const selectSql = `
          SELECT * FROM patients 
          ${whereClause} 
          ORDER BY patient_id DESC 
          LIMIT ? OFFSET ?
        `;
        const [dataRows] = await pool.query(selectSql, [...params, limit, offset]);

        const rows = dataRows.map((row) => {
          const entity = Patient.fromDatabaseRow(row);
          return entity ? entity.toJSON() : row;
        });

        return { rows, total };
      } catch (err) {
        console.warn('[PatientRepository.listPatients] Fallback to memory:', err.message);
      }
    }

    const node = this.getNodeConnection(clinicId);
    let allRecords = node.db.prepare('SELECT * FROM patients ORDER BY patient_id DESC').all();
    if (filters.citizen_id) {
      allRecords = allRecords.filter(r => r.identity_card === String(filters.citizen_id).trim());
    }
    if (filters.phone_number) {
      allRecords = allRecords.filter(r => r.phone_number === String(filters.phone_number).trim());
    }
    const limit = Number(filters.limit) || 20;
    const offset = Number(filters.offset) || 0;
    const paged = allRecords.slice(offset, offset + limit).map(r => {
      const entity = Patient.fromDatabaseRow(r);
      return entity ? entity.toJSON() : r;
    });
    return {
      rows: paged,
      total: allRecords.length
    };
  }
}

PatientRepository.PatientRepository = PatientRepository;
PatientRepository.GatewayTimeoutError = GatewayTimeoutError;
PatientRepository.MemoryShardDatabase = MemoryShardDatabase;

module.exports = PatientRepository;
module.exports.PatientRepository = PatientRepository;
module.exports.GatewayTimeoutError = GatewayTimeoutError;
module.exports.MemoryShardDatabase = MemoryShardDatabase;
