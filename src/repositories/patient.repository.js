let DatabaseModule;
try {
  DatabaseModule = require('better-sqlite3');
} catch (e) {
  DatabaseModule = null;
}

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
 * Kích hoạt khi better-sqlite3 native addon không biên dịch được trên môi trường máy chủ
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

function createNodeDatabase(customDb) {
  if (customDb) return customDb;
  if (DatabaseModule) {
    try {
      return new DatabaseModule(':memory:');
    } catch {
      // Fallback nếu native module bị lỗi tải
    }
  }
  return new MemoryShardDatabase();
}

/**
 * Repository tương tác dữ liệu Bệnh nhân
 * Hiện thực kiến trúc Database Sharding đa cơ sở (Node Hà Nội & Node TP.HCM)
 */
class PatientRepository {
  /**
   * @param {Object} [options]
   * @param {Object} [options.db] - DB kết nối mặc định (nếu có)
   * @param {Object} [options.nodes] - Cấu hình các node phân mảnh
   */
  constructor(options = {}) {
    // Khởi tạo các Node CSDL phân mảnh (Sharding Nodes)
    this.nodes = {
      1: {
        nodeId: 1,
        name: 'Node Hà Nội',
        location: 'Hà Nội',
        ip: '10.0.1.10',
        db: (options.nodes && options.nodes[1]) || (options.db ? options.db : createNodeDatabase()),
        simulateTimeout: false
      },
      2: {
        nodeId: 2,
        name: 'Node TP.HCM',
        location: 'TP.HCM',
        ip: '10.0.2.10',
        db: (options.nodes && options.nodes[2]) || createNodeDatabase(),
        simulateTimeout: false
      }
    };

    // Tự động khởi tạo cấu trúc bảng trên toàn bộ các Shard DB Nodes
    this._initializeTables();
  }

  /**
   * Khởi tạo schema bảng patients theo đúng lược đồ erd.mermaid trên từng Node
   * @private
   */
  _initializeTables() {
    for (const nodeKey of Object.keys(this.nodes)) {
      const nodeDb = this.nodes[nodeKey].db;
      try {
        nodeDb.exec(`
          CREATE TABLE IF NOT EXISTS patients (
            patient_id INTEGER PRIMARY KEY AUTOINCREMENT,
            origin_clinic_id INTEGER NOT NULL,
            identity_card TEXT NOT NULL UNIQUE,
            full_name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            gender TEXT DEFAULT 'Khac',
            date_of_birth TEXT,
            address TEXT,
            blood_type TEXT,
            medical_history TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_patients_identity_card ON patients(identity_card);
          CREATE INDEX IF NOT EXISTS idx_patients_origin_clinic ON patients(origin_clinic_id);
        `);
      } catch (err) {
        // Đã có bảng hoặc driver memory
      }
    }
  }

  /**
   * Định tuyến kết nối cơ sở dữ liệu dựa trên khóa phân mảnh origin_clinic_id
   * @param {number|string} originClinicId
   * @returns {Object} Đối tượng Node Shard chứa db connection và metadata
   */
  getNodeConnection(originClinicId) {
    const clinicId = Number(originClinicId);
    const node = this.nodes[clinicId];

    if (!node) {
      return this.nodes[1];
    }

    // Giả lập xử lý timeout / đứt kết nối mạng theo kịch bản PRD 2.2
    if (node.simulateTimeout) {
      throw new GatewayTimeoutError(
        `Không thể kết nối đến máy chủ khu vực ${node.name} (${node.ip}), vui lòng thử lại sau`
      );
    }

    return node;
  }

  /**
   * Bật/tắt cờ giả lập sự cố kết nối / timeout sang một node cụ thể (Dùng cho test & demo PRD 2.2)
   * @param {number} clinicId 
   * @param {boolean} isTimeout 
   */
  setNodeTimeoutSimulation(clinicId, isTimeout = true) {
    if (this.nodes[clinicId]) {
      this.nodes[clinicId].simulateTimeout = Boolean(isTimeout);
    }
  }

  /**
   * Tạo mới hồ sơ bệnh nhân trên đúng Shard Node tương ứng với origin_clinic_id
   * @param {Object} patientData 
   * @returns {Patient}
   */
  create(patientData) {
    const targetNode = this.getNodeConnection(patientData.origin_clinic_id);
    const stmt = targetNode.db.prepare(`
      INSERT INTO patients (
        origin_clinic_id, identity_card, full_name, phone_number,
        gender, date_of_birth, address, blood_type, medical_history,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      patientData.origin_clinic_id,
      patientData.identity_card,
      patientData.full_name,
      patientData.phone_number,
      patientData.gender || 'Khac',
      patientData.date_of_birth || null,
      patientData.address || null,
      patientData.blood_type || null,
      patientData.medical_history || null
    );

    const insertedRow = targetNode.db
      .prepare('SELECT * FROM patients WHERE patient_id = ?')
      .get(result.lastInsertRowid);

    return Patient.fromDatabaseRow(insertedRow);
  }

  /**
   * Lấy danh sách bệnh nhân có hỗ trợ lọc theo origin_clinic_id
   * @param {Object} [filter]
   * @param {number} [filter.origin_clinic_id]
   * @returns {Array<Patient>}
   */
  findAll(filter = {}) {
    const results = [];

    if (filter.origin_clinic_id) {
      const targetNode = this.getNodeConnection(filter.origin_clinic_id);
      const rows = targetNode.db.prepare('SELECT * FROM patients ORDER BY patient_id DESC').all();
      return rows.map((r) => Patient.fromDatabaseRow(r));
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
   * @returns {Patient|null}
   */
  findById(id, originClinicId = null) {
    const patientId = Number(id);

    if (originClinicId) {
      const targetNode = this.getNodeConnection(originClinicId);
      const row = targetNode.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(patientId);
      return Patient.fromDatabaseRow(row);
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
   * @returns {Patient|null}
   */
  findByIdentityCard(identityCard) {
    const cccd = String(identityCard).trim();

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
   * @returns {Patient|null}
   */
  update(id, updateData) {
    const existing = this.findById(id);
    if (!existing) return null;

    const targetNode = this.getNodeConnection(existing.origin_clinic_id);

    const updatedFields = {
      full_name: updateData.full_name !== undefined ? updateData.full_name : existing.full_name,
      phone_number: updateData.phone_number !== undefined ? updateData.phone_number : existing.phone_number,
      gender: updateData.gender !== undefined ? updateData.gender : existing.gender,
      date_of_birth: updateData.date_of_birth !== undefined ? updateData.date_of_birth : existing.date_of_birth,
      address: updateData.address !== undefined ? updateData.address : existing.address,
      blood_type: updateData.blood_type !== undefined ? updateData.blood_type : existing.blood_type,
      medical_history: updateData.medical_history !== undefined ? updateData.medical_history : existing.medical_history
    };

    targetNode.db.prepare(`
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

    const updatedRow = targetNode.db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(existing.patient_id);
    return Patient.fromDatabaseRow(updatedRow);
  }

  /**
   * Xóa hồ sơ bệnh nhân
   * @param {number|string} id 
   * @returns {boolean}
   */
  delete(id) {
    const existing = this.findById(id);
    if (!existing) return false;

    const targetNode = this.getNodeConnection(existing.origin_clinic_id);
    const result = targetNode.db.prepare('DELETE FROM patients WHERE patient_id = ?').run(existing.patient_id);
    return result.changes > 0;
  }
}

module.exports = {
  PatientRepository,
  GatewayTimeoutError
};
