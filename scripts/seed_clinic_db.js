const { getDbPool } = require('../src/config/database');
const { hashPassword, encrypt, generateBlindIndex } = require('../src/common/utils/crypto.util');

async function seedClinicDb() {
  const pool = getDbPool();
  console.log('Connecting to clinic_db...');

  // 1. Seed Patients trước
  const [patients] = await pool.query('SELECT COUNT(*) AS c FROM patients');
  if (patients[0].c === 0) {
    const p1Cccd = '001201012345';
    const p1Phone = '0901234567';
    await pool.query(
      `INSERT INTO patients (id, full_name, citizen_id_encrypted, citizen_id_bindex, phone_encrypted, phone_bindex, date_of_birth, gender, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        1,
        'Nguyễn Văn An',
        encrypt(p1Cccd),
        generateBlindIndex(p1Cccd),
        encrypt(p1Phone),
        generateBlindIndex(p1Phone),
        '1990-05-15',
        'male',
        'Số 10 Phố Tràng Thi, Hoàn Kiếm, Hà Nội'
      ]
    );
    console.log('Seeded patient 1: Nguyễn Văn An (CCCD: 001201012345)');

    const p2Cccd = '079201098765';
    const p2Phone = '0987654321';
    await pool.query(
      `INSERT INTO patients (id, full_name, citizen_id_encrypted, citizen_id_bindex, phone_encrypted, phone_bindex, date_of_birth, gender, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        2,
        'Lê Thu Trang',
        encrypt(p2Cccd),
        generateBlindIndex(p2Cccd),
        encrypt(p2Phone),
        generateBlindIndex(p2Phone),
        '1995-08-20',
        'female',
        'Số 45 Cầu Giấy, Hà Nội'
      ]
    );
    console.log('Seeded patient 2: Lê Thu Trang (CCCD: 079201098765)');
  }

  // 2. Seed Users sau
  const [existingUsers] = await pool.query('SELECT username FROM users');
  const existingUsernames = new Set(existingUsers.map(u => u.username));

  const defaultUsers = [
    { username: 'admin', password: 'Admin@123', role: 'admin' },
    { username: 'staff', password: 'Staff@123', role: 'staff' },
    { username: 'staff_hanoi', password: 'Staff@123', role: 'staff' },
    { username: 'staff_hcm', password: 'Staff@123', role: 'staff' },
    { username: 'patient', password: 'Patient@123', role: 'patient', patient_id: 1 }
  ];

  for (const u of defaultUsers) {
    if (!existingUsernames.has(u.username)) {
      const hash = hashPassword(u.password);
      await pool.query(
        'INSERT INTO users (username, password_hash, role, patient_id) VALUES (?, ?, ?, ?)',
        [u.username, hash, u.role, u.patient_id || null]
      );
      console.log('Seeded user:', u.username);
    }
  }

  // 3. Seed Appointments (để Dashboard có số liệu trực quan)
  const [appointments] = await pool.query('SELECT COUNT(*) AS c FROM appointments');
  if (appointments[0].c === 0) {
    await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, slot_time, status, notes) VALUES
       (1, 1, '2026-11-10 09:00:00', 'completed', 'Khám định kỳ tim mạch'),
       (1, 2, '2026-11-12 10:30:00', 'confirmed', 'Tái khám nội khoa'),
       (2, 3, '2026-11-15 14:00:00', 'pending', 'Tư vấn dinh dưỡng nhi khoa'),
       (2, 4, '2026-11-05 08:30:00', 'cancelled', 'Bệnh nhân bận công tác hủy hẹn')`
    );
    console.log('Seeded 4 sample appointments for dashboard statistics');
  }

  console.log('All seed data inserted successfully!');
}

seedClinicDb()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
