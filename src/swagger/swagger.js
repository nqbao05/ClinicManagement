const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Clinic Booking API',
      version: '1.0.0',
      description: 'API quản lý đặt lịch khám đa cơ sở'
    },
    servers: [{ url: '/api' }],
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
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
