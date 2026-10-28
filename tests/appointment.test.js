const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const { createDatabase } = require('../src/config/database');

function seed(db) {
  db.prepare('INSERT INTO clinics VALUES (?, ?, ?, ?)').run(1, 'Clinic A', 'Hanoi', '127.0.0.1');
  db.prepare('INSERT INTO patients VALUES (?, ?, ?, ?, ?)').run(1, 1, 'Patient A', '0900000001', null);
  db.prepare('INSERT INTO doctors VALUES (?, ?, ?, ?)').run(1, 1, 'Doctor A', 'Cardiology');
}

const payload = {
  patientId: 1,
  doctorId: 1,
  clinicId: 1,
  slotTime: '2026-11-01T09:00:00.000Z'
};

test('creates an appointment', async () => {
  const db = createDatabase(':memory:');
  seed(db);
  const response = await request(createApp({ db })).post('/api/appointments').send(payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.slot_time, payload.slotTime);
});

test('rejects concurrent booking of the same slot', async () => {
  const db = createDatabase(':memory:');
  seed(db);
  const app = createApp({ db });
  const responses = await Promise.all([
    request(app).post('/api/appointments').send(payload),
    request(app).post('/api/appointments').send(payload)
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
});

test('rejects an invalid slot time', async () => {
  const db = createDatabase(':memory:');
  seed(db);
  const response = await request(createApp({ db }))
    .post('/api/appointments').send({ ...payload, slotTime: 'not-a-date' });
  assert.equal(response.status, 400);
});

test('serves generated OpenAPI document', async () => {
  const db = createDatabase(':memory:');
  const response = await request(createApp({ db })).get('/openapi.json');
  assert.equal(response.status, 200);
  assert.equal(response.body.openapi, '3.0.3');
  assert.ok(response.body.paths['/appointments'].post);
});
