const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Clinic Booking & Management System API',
      version: '1.0.0',
      description: 'Hệ thống Quản lý Phòng khám Đa cơ sở (Distributed MySQL Sharding) - Clean Architecture V1'
    },
    servers: [{ url: '/api' }, { url: '/' }],
    components: {
      schemas: {
        CreateAppointmentRequest: {
          type: 'object',
          required: ['patientId', 'doctorId', 'clinicId', 'slotTime'],
          properties: {
            patientId: { type: 'integer', example: 1 },
            doctorId: { type: 'integer', example: 1 },
            clinicId: { type: 'integer', example: 1 },
            slotTime: { type: 'string', format: 'date-time', example: '2026-11-01T09:00:00.000Z' }
          }
        },
        Appointment: {
          type: 'object',
          properties: {
            appointment_id: { type: 'integer' },
            patient_id: { type: 'integer' },
            doctor_id: { type: 'integer' },
            clinic_id: { type: 'integer' },
            slot_time: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['Pending', 'Confirmed', 'Cancelled'] }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/modules/**/*.js']
};

const swaggerDocument = swaggerJsdoc(options);

module.exports = swaggerDocument;
