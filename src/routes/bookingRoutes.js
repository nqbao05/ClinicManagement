const express = require('express');
const createBookingController = require('../controllers/bookingController');

function createBookingRoutes(service) {
  const router = express.Router();
  const controller = createBookingController(service);

  /**
   * @openapi
   * components:
   *   schemas:
   *     CreateBookingRequest:
   *       type: object
   *       required:
   *         - patientId
   *         - doctorId
   *         - appointmentDate
   *         - slotId
   *       properties:
   *         patientId:
   *           type: string
   *           example: d3b07384-d113-4a15-8e3b-5c742918e5a1
   *         doctorId:
   *           type: string
   *           example: a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d
   *         appointmentDate:
   *           type: string
   *           format: date
   *           example: '2026-11-01'
   *         slotId:
   *           type: string
   *           example: slot-0900-0930
   *     Booking:
   *       type: object
   *       properties:
   *         booking_id:
   *           type: string
   *         patient_id:
   *           type: string
   *         doctor_id:
   *           type: string
   *         appointment_date:
   *           type: string
   *           format: date
   *         slot_id:
   *           type: string
   *         status:
   *           type: string
   *           enum: [PENDING, HOLDING, CONFIRMED, CANCELLED]
   *         created_at:
   *           type: string
   *           format: date-time
   */

  /**
   * @openapi
   * /v1/bookings:
   *   post:
   *     tags:
   *       - Bookings
   *     summary: Đặt lịch khám bệnh mới (Chống trùng lịch)
   *     description: Tiếp nhận thông tin đặt lịch, kích hoạt Transaction Lock để kiểm tra xung đột slot thời gian. Ném lỗi HTTP 409 nếu slot đã bị đặt.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateBookingRequest'
   *     responses:
   *       201:
   *         description: Đặt lịch khám thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Booking'
   *       400:
   *         description: Dữ liệu đầu vào không hợp lệ
   *       409:
   *         description: Xung đột slot khám đã có người đặt trước
   *       500:
   *         description: Lỗi máy chủ nội bộ
   */
  router.post('/v1/bookings', controller.create);

  return router;
}

module.exports = createBookingRoutes;
