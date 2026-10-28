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
        },
        CreateBookingRequest: {
          type: 'object',
          required: ['patientId', 'doctorId', 'appointmentDate', 'slotId'],
          properties: {
            patientId: { type: 'string', example: 'd3b07384-d113-4a15-8e3b-5c742918e5a1' },
            doctorId: { type: 'string', example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' },
            appointmentDate: { type: 'string', format: 'date', example: '2026-11-01' },
            slotId: { type: 'string', example: 'slot-0900-0930' }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            booking_id: { type: 'string' },
            patient_id: { type: 'string' },
            doctor_id: { type: 'string' },
            appointment_date: { type: 'string', format: 'date' },
            slot_id: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'HOLDING', 'CONFIRMED', 'CANCELLED'] },
            created_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/modules/**/*.routes.js', './src/modules/**/*.js']
};

module.exports = swaggerJsdoc(options);
