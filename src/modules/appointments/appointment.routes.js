const express = require('express');
const { createAppointmentController } = require('./appointment.controller');
const AppointmentService = require('./appointment.service');
const AppointmentRepository = require('./appointment.repository');
const { authenticate, authorize } = require('../../common/middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Appointments (V1)
 *     description: 'Quản lý Đặt lịch khám bệnh & Concurrency Control (Thành viên 3)'
 *   - name: Appointments
 *     description: 'Tương thích ngược API Đặt lịch khám baseline'
 * 
 * components:
 *   schemas:
 *     CreateAppointmentRequest:
 *       type: object
 *       required:
 *         - patientId
 *         - doctorId
 *         - clinicId
 *         - slotTime
 *       properties:
 *         patientId:
 *           type: integer
 *           example: 1
 *         doctorId:
 *           type: integer
 *           example: 1
 *         clinicId:
 *           type: integer
 *           example: 1
 *         slotTime:
 *           type: string
 *           format: date-time
 *           example: '2026-11-01T09:00:00.000Z'
 * 
 *     Appointment:
 *       type: object
 *       properties:
 *         appointment_id:
 *           type: integer
 *         patient_id:
 *           type: integer
 *         doctor_id:
 *           type: integer
 *         clinic_id:
 *           type: integer
 *         slot_time:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [Pending, Confirmed, Cancelled]
 * 
 *     BookAppointmentRequest:
 *       type: object
 *       required:
 *         - patient_id
 *         - doctor_id
 *         - clinic_id
 *         - slot_time
 *       properties:
 *         patient_id:
 *           type: integer
 *           description: 'ID của bệnh nhân cần đặt lịch'
 *           example: 101
 *         doctor_id:
 *           type: integer
 *           description: 'ID của bác sĩ tiếp nhận ca khám'
 *           example: 1
 *         clinic_id:
 *           type: integer
 *           description: 'Mã chi nhánh (1: Hà Nội, 2: TP.HCM - Xác định Shard Database)'
 *           example: 1
 *         slot_time:
 *           type: string
 *           format: date-time
 *           description: 'Thời gian khám (chỉ trong giờ hành chính 08:00-11:30 và 13:30-17:00, phút chia hết cho 15 hoặc 30)'
 *           example: '2026-11-15T09:00:00'
 * 
 *     AppointmentItemResponse:
 *       type: object
 *       properties:
 *         appointment_id:
 *           type: integer
 *           example: 15
 *         patient_id:
 *           type: integer
 *           example: 101
 *         doctor_id:
 *           type: integer
 *           example: 1
 *         clinic_id:
 *           type: integer
 *           example: 1
 *         slot_time:
 *           type: string
 *           example: '2026-11-15 09:00:00'
 *         status:
 *           type: string
 *           enum: [Pending, Confirmed, Cancelled]
 *           example: 'Pending'
 *         doctor_name:
 *           type: string
 *           example: 'BS. CKI Nguyễn Văn A'
 *         specialty:
 *           type: string
 *           example: 'Khoa Tim Mạch'
 * 
 *     AppointmentPaginationResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         statusCode:
 *           type: integer
 *           example: 200
 *         message:
 *           type: string
 *           example: 'Lấy danh sách lịch hẹn thành công'
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AppointmentItemResponse'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 45
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 20
 *             totalPages:
 *               type: integer
 *               example: 3
 *             hasNext:
 *               type: boolean
 *               example: true
 *             hasPrev:
 *               type: boolean
 *               example: false
 */

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
function createAppointmentRoutes(service) {
  const router = express.Router();
  router.post('/appointments', async (req, res, next) => {
    try {
      const appointment = await Promise.resolve(service.createBooking({
        patientId: req.body.patientId,
        doctorId: req.body.doctorId,
        clinicId: req.body.clinicId,
        slotTime: req.body.slotTime
      }));
      res.status(201).json(appointment);
    } catch (error) {
      if (error.code === 'APPOINTMENT_SLOT_CONFLICT' || error.statusCode === 409) {
        return res.status(409).json({ code: error.code || 'APPOINTMENT_SLOT_CONFLICT', message: error.message });
      }
      if (error.code === 'INVALID_SLOT_TIME' || error.statusCode === 400) {
        return res.status(400).json({ code: error.code, message: error.message });
      }
      return next(error);
    }
  });
  return router;
}

/**
 * Khởi tạo Express Router cho Appointments V1
 * @param {Object} [service]
 * @returns {express.Router}
 */
function createAppointmentV1Routes(service) {
  const router = express.Router();
  const appointmentService = service || new AppointmentService(new AppointmentRepository());
  const controller = createAppointmentController(appointmentService);

  /**
   * @swagger
   * /v1/appointments:
   *   post:
   *     tags: [Appointments (V1)]
   *     summary: Đặt lịch khám bệnh mới (Concurrency Control)
   *     description: |
   *       Tiếp nhận yêu cầu đặt lịch khám bệnh.
   *       Hệ thống áp dụng cơ chế khóa bi quan (**Pessimistic Lock: SELECT ... FOR UPDATE**)
   *       kết hợp ràng buộc UNIQUE tầng CSDL để triệt tiêu hoàn toàn lỗi Race Condition (đặt trùng cùng 1 slot).
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/BookAppointmentRequest'
   *     responses:
   *       201:
   *         description: Đặt lịch khám thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 statusCode:
   *                   type: integer
   *                   example: 201
   *                 message:
   *                   type: string
   *                   example: 'Đặt lịch khám thành công'
   *                 data:
   *                   $ref: '#/components/schemas/AppointmentItemResponse'
   *       400:
   *         description: Dữ liệu không hợp lệ (ngoài giờ hành chính, phút lẻ, thời gian quá khứ)
   *       404:
   *         description: Không tìm thấy bác sĩ tại cơ sở khám bệnh đã chọn
   *       409:
   *         description: Trùng khung giờ khám của bác sĩ hoặc bệnh nhân bị trùng lịch hẹn
   *       500:
   *         description: Lỗi máy chủ nội bộ
   */
  // Đặt lịch khám mới (admin, staff, patient)
  router.post('/', authenticate, authorize('admin', 'staff', 'patient'), controller.createAppointment);

  /**
   * @swagger
   * /v1/appointments:
   *   get:
   *     tags: [Appointments (V1)]
   *     summary: Lấy danh sách lịch hẹn khám bệnh có phân trang
   *     description: Hỗ trợ truy vấn lịch hẹn theo chi nhánh (`clinic_id`), lọc theo bác sĩ, trạng thái ca khám và ngày khám.
   *     parameters:
   *       - in: query
   *         name: clinic_id
   *         schema:
   *           type: integer
   *           enum: [1, 2]
   *         required: false
   *         description: 'Chi nhánh phòng khám (1: Hà Nội, 2: TP.HCM)'
   *         example: 1
   *       - in: header
   *         name: X-Clinic-ID
   *         schema:
   *           type: integer
   *         required: false
   *         description: 'Mã chi nhánh gửi qua HTTP Header'
   *       - in: query
   *         name: doctor_id
   *         schema:
   *           type: integer
   *         required: false
   *         description: 'Lọc theo bác sĩ'
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [Pending, Confirmed, Cancelled]
   *         required: false
   *         description: 'Lọc theo trạng thái ca khám'
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *         required: false
   *         description: 'Lọc theo ngày khám (YYYY-MM-DD)'
   *         example: '2026-11-05'
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         required: false
   *         description: 'Số trang'
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         required: false
   *         description: 'Số lượng bản ghi mỗi trang'
   *     responses:
   *       200:
   *         description: Danh sách lịch hẹn kèm dữ liệu phân trang
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AppointmentPaginationResponse'
   *       400:
   *         description: Tham số query không hợp lệ
   */
  // Lấy danh sách lịch hẹn (admin, staff, patient)
  router.get('/', authenticate, authorize('admin', 'staff', 'patient'), controller.getAppointments);

  // Cập nhật trạng thái lịch hẹn (admin, staff: Confirmed/Completed/Cancelled; patient: Cancelled)
  router.patch('/:id/status', authenticate, authorize('admin', 'staff', 'patient'), controller.updateAppointmentStatus);

  return router;
}

// Router mặc định tương thích
const defaultRepository = new AppointmentRepository();
const defaultService = new AppointmentService(defaultRepository);
const defaultRouter = createAppointmentV1Routes(defaultService);

defaultRouter.createAppointmentV1Routes = createAppointmentV1Routes;
defaultRouter.createAppointmentRoutes = createAppointmentRoutes;
defaultRouter.AppointmentService = AppointmentService;
defaultRouter.AppointmentRepository = AppointmentRepository;

module.exports = defaultRouter;
module.exports.createAppointmentV1Routes = createAppointmentV1Routes;
module.exports.createAppointmentRoutes = createAppointmentRoutes;
module.exports.AppointmentService = AppointmentService;
module.exports.AppointmentRepository = AppointmentRepository;
