const express = require('express');
const createAppointmentController = require('./appointment.controller');

function createAppointmentRoutes(service) {
  const router = express.Router();
  const controller = createAppointmentController(service);

  /**
   * @openapi
   * /appointments:
   *   post:
   *     tags: [Appointments]
   *     summary: Tạo lịch khám
   *     description: Tạo lịch khám với bảo vệ chống đặt trùng slot giữa các bác sĩ và thời điểm.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateAppointmentRequest'
   *     responses:
   *       201:
   *         description: Đặt lịch thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Appointment'
   *       400:
   *         description: Dữ liệu không hợp lệ
   *       409:
   *         description: Khung giờ đã được đặt
   *       500:
   *         description: Lỗi máy chủ
   */
  router.post('/appointments', controller.create);
  return router;
}

module.exports = createAppointmentRoutes;

