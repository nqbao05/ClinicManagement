const express = require('express');
const createBookingController = require('./booking.controller');

function createBookingRoutes(service) {
  const router = express.Router();
  const controller = createBookingController(service);

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

