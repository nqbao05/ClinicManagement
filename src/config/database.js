const Database = require('better-sqlite3');
const path = require('path');

function createDatabase(filePath = process.env.DATABASE_PATH || path.join(__dirname, '../../clinic.sqlite')) {
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

    CREATE TABLE IF NOT EXISTS bookings (
      booking_id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      doctor_id TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED'
        CHECK(status IN ('PENDING', 'HOLDING', 'CONFIRMED', 'CANCELLED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ux_active_booking_slot
      ON bookings(doctor_id, appointment_date, slot_id)
      WHERE status <> 'CANCELLED';
  `);
  return db;
}

module.exports = { createDatabase };
