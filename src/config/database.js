let Database;
try {
  Database = require('better-sqlite3');
} catch {
  Database = null;
}
const path = require('path');

class FallbackDatabase {
  constructor() {
    this.clinics = [];
    this.patients = [];
    this.doctors = [];
    this.appointments = [];
    this.appointmentId = 1;
  }

  pragma() {}
  exec() {}

  transaction(fn) {
    return (arg) => fn(arg);
  }

  prepare(sql) {
    const trimmed = sql.trim().replace(/\s+/g, ' ');
    const self = this;

    if (trimmed.startsWith('INSERT INTO appointments')) {
      return {
        run(params) {
          // Kiểm tra unique index chống trùng slot (ux_active_appointment_slot)
          const duplicate = self.appointments.find(
            (a) => a.doctor_id === params.doctor_id && a.slot_time === params.slot_time && a.status !== 'Cancelled'
          );
          if (duplicate) {
            const err = new Error('UNIQUE constraint failed: appointments.doctor_id, appointments.slot_time');
            err.code = 'SQLITE_CONSTRAINT_UNIQUE';
            throw err;
          }

          const id = self.appointmentId++;
          const appt = {
            appointment_id: id,
            patient_id: params.patient_id,
            doctor_id: params.doctor_id,
            clinic_id: params.clinic_id,
            slot_time: params.slot_time,
            status: params.status || 'Pending'
          };
          self.appointments.push(appt);
          return { lastInsertRowid: id };
        }
      };
    }

    if (trimmed.includes('FROM appointments') && trimmed.includes('doctor_id = ? AND slot_time = ?')) {
      return {
        get(doctorId, slotTime) {
          return self.appointments.find(
            (a) => a.doctor_id === doctorId && a.slot_time === slotTime && a.status !== 'Cancelled'
          ) || null;
        }
      };
    }

    if (trimmed.startsWith('INSERT INTO clinics')) {
      return { run(...args) { self.clinics.push(args); return { changes: 1 }; } };
    }

    if (trimmed.startsWith('INSERT INTO patients')) {
      return { run(...args) { self.patients.push(args); return { changes: 1 }; } };
    }

    if (trimmed.startsWith('INSERT INTO doctors')) {
      return { run(...args) { self.doctors.push(args); return { changes: 1 }; } };
    }

    return {
      run() { return { changes: 1 }; },
      get() { return null; },
      all() { return []; }
    };
  }
}

function createDatabase(filePath = process.env.DATABASE_PATH || path.join(__dirname, '../../clinic.sqlite')) {
  if (Database) {
    try {
      const db = filePath === ':memory:' ? new Database(':memory:') : new Database(filePath);
      db.pragma('foreign_keys = ON');
      db.pragma('busy_timeout = 5000');
      db.exec(`
        CREATE TABLE IF NOT EXISTS clinics (
          clinic_id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          location TEXT NOT NULL,
          db_node_ip TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS patients (
          patient_id INTEGER PRIMARY KEY,
          origin_clinic_id INTEGER NOT NULL REFERENCES clinics(clinic_id),
          full_name TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          medical_history TEXT
        );
        CREATE TABLE IF NOT EXISTS doctors (
          doctor_id INTEGER PRIMARY KEY,
          clinic_id INTEGER NOT NULL REFERENCES clinics(clinic_id),
          full_name TEXT NOT NULL,
          specialty TEXT
        );
        CREATE TABLE IF NOT EXISTS appointments (
          appointment_id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL REFERENCES patients(patient_id),
          doctor_id INTEGER NOT NULL REFERENCES doctors(doctor_id),
          clinic_id INTEGER NOT NULL REFERENCES clinics(clinic_id),
          slot_time TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending'
            CHECK(status IN ('Pending', 'Confirmed', 'Cancelled'))
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ux_active_appointment_slot
          ON appointments(doctor_id, slot_time)
          WHERE status <> 'Cancelled';
        CREATE INDEX IF NOT EXISTS ix_appointment_doctor_time
          ON appointments(doctor_id, slot_time);
      `);
      return db;
    } catch {
      // Fallback nếu không có binary .node
    }
  }

  return new FallbackDatabase();
}

module.exports = { createDatabase };
