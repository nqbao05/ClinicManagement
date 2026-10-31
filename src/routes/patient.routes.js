const express = require('express');
const { createPatientController } = require('../controllers/patient.controller');
const { PatientService } = require('../services/patient.service');
const { PatientRepository } = require('../repositories/patient.repository');
const { validateCreatePatient, validateUpdatePatient } = require('../middleware/patient.validation');

/**
 * @swagger
 * components:
 *   schemas:
 *     CreatePatientRequest:
 *       type: object
 *       required:
 *         - origin_clinic_id
 *         - identity_card
 *         - full_name
 *         - phone_number
 *       properties:
 *         origin_clinic_id:
 *           type: integer
 *           description: 'Mã chi nhánh đăng ký ban đầu (Sharding Key xác định node CSDL)'
 *           example: 1
 *         identity_card:
 *           type: string
 *           description: 'Số CCCD/CMND định danh bệnh nhân (duy nhất)'
 *           example: "001201012345"
 *         full_name:
 *           type: string
 *           description: 'Họ và tên bệnh nhân'
 *           example: "Nguyễn Văn P"
 *         phone_number:
 *           type: string
 *           description: 'Số điện thoại liên lạc'
 *           example: "0901234567"
 *         gender:
 *           type: string
 *           enum: [Nam, Nu, Khac]
 *           example: "Nam"
 *         date_of_birth:
 *           type: string
 *           format: date
 *           example: "1990-05-15"
 *         address:
 *           type: string
 *           example: "Hoàn Kiếm, Hà Nội"
 *         blood_type:
 *           type: string
 *           example: "O+"
 *         medical_history:
 *           type: string
 *           example: "Tiền sử dị ứng penicillin"
 * 
 *     UpdatePatientRequest:
 *       type: object
 *       properties:
 *         full_name:
 *           type: string
 *           example: "Nguyễn Văn P (Cập nhật)"
 *         phone_number:
 *           type: string
 *           example: "0912345678"
 *         gender:
 *           type: string
 *           enum: [Nam, Nu, Khac]
 *           example: "Nam"
 *         date_of_birth:
 *           type: string
 *           format: date
 *           example: "1990-05-15"
 *         address:
 *           type: string
 *           example: "Quận 1, TP.HCM"
 *         blood_type:
 *           type: string
 *           example: "O+"
 *         medical_history:
 *           type: string
 *           example: "Viêm loét dạ dày nhẹ"
 * 
 *     PatientResponse:
 *       type: object
 *       properties:
 *         patient_id:
 *           type: integer
 *           example: 102
 *         origin_clinic_id:
 *           type: integer
 *           example: 1
 *         identity_card:
 *           type: string
 *           example: "001201012345"
 *         full_name:
 *           type: string
 *           example: "Nguyễn Văn P"
 *         phone_number:
 *           type: string
 *           example: "0901234567"
 *         gender:
 *           type: string
 *           example: "Nam"
 *         date_of_birth:
 *           type: string
 *           example: "1990-05-15"
 *         address:
 *           type: string
 *           example: "Hoàn Kiếm, Hà Nội"
 *         blood_type:
 *           type: string
 *           example: "O+"
 *         medical_history:
 *           type: string
 *           example: "Tiền sử dị ứng penicillin"
 *         is_external_record:
 *           type: boolean
 *           description: 'Cờ đánh dấu hồ sơ thuộc chi nhánh khác (Cross-node sync)'
 *           example: true
 *         source_node:
 *           type: string
 *           description: 'Tên Node CSDL gốc lưu trữ dữ liệu'
 *           example: "Node Hà Nội"
 *         sync_notice:
 *           type: string
 *           example: "Dữ liệu được đồng bộ từ Cơ sở Hà Nội"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2026-10-31T20:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2026-10-31T20:00:00.000Z"
 * 
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         code:
 *           type: string
 *           example: "PATIENT_NOT_FOUND"
 *         message:
 *           type: string
 *           example: "Không tìm thấy hồ sơ bệnh nhân"
 *         details:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * Khởi tạo Router cho module Patient
 * @param {Object} [service]
 * @returns {express.Router}
 */
function createPatientRoutes(service) {
  const router = express.Router();
  const patientService = service || new PatientService(new PatientRepository());
  const controller = createPatientController(patientService);

  /**
   * @swagger
   * /patients:
   *   post:
   *     tags: [Patients]
   *     summary: Tạo hồ sơ bệnh nhân mới
   *     description: Đăng ký hồ sơ bệnh nhân và lưu trữ trực tiếp vào Shard Node CSDL tương ứng với origin_clinic_id.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePatientRequest'
   *     responses:
   *       201:
   *         description: Tạo hồ sơ bệnh nhân thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PatientResponse'
   *       400:
   *         description: Dữ liệu đầu vào không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Trùng lặp số CCCD/CMND đã tồn tại trên hệ thống
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Lỗi máy chủ nội bộ
   */
  router.post('/', validateCreatePatient, controller.createPatient);

  /**
   * @swagger
   * /patients:
   *   get:
   *     tags: [Patients]
   *     summary: Lấy danh sách bệnh nhân
   *     description: Hỗ trợ truy vấn danh sách bệnh nhân từ một node cụ thể hoặc quét gộp dữ liệu từ toàn bộ các node phân tán.
   *     parameters:
   *       - in: query
   *         name: origin_clinic_id
   *         schema:
   *           type: integer
   *         required: false
   *         description: 'Lọc theo mã chi nhánh gốc (1: Hà Nội, 2: TP.HCM)'
   *         example: 1
   *       - in: header
   *         name: X-Clinic-ID
   *         schema:
   *           type: integer
   *         required: false
   *         description: 'Mã chi nhánh hiện tại của bác sĩ để hệ thống xác định cờ is_external_record'
   *         example: 2
   *     responses:
   *       200:
   *         description: Danh sách bệnh nhân
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/PatientResponse'
   *       504:
   *         description: Không thể kết nối đến máy chủ khu vực (Gateway Timeout)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/', controller.getPatients);

  /**
   * @swagger
   * /patients/{id}:
   *   get:
   *     tags: [Patients]
   *     summary: Xem chi tiết hồ sơ bệnh nhân (Cross-node Fetch)
   *     description: Truy xuất thông tin bệnh nhân từ Shard CSDL gốc. Nếu truy vấn từ chi nhánh khác, hệ thống tự động gán cờ is_external_record = true theo kịch bản PRD 2.1.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID của bệnh nhân
   *         example: 102
   *       - in: header
   *         name: X-Clinic-ID
   *         schema:
   *           type: integer
   *         required: false
   *         description: Mã chi nhánh hiện tại của người dùng (Ví dụ Bác sĩ ở TP.HCM là 2)
   *         example: 2
   *     responses:
   *       200:
   *         description: Thông tin hồ sơ bệnh nhân chi tiết
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PatientResponse'
   *       404:
   *         description: Không tìm thấy hồ sơ bệnh nhân
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       504:
   *         description: Mất kết nối hoặc quá thời gian phản hồi từ máy chủ chi nhánh gốc (Gateway Timeout theo PRD 2.2)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/:id', controller.getPatientById);

  /**
   * @swagger
   * /patients/{id}:
   *   put:
   *     tags: [Patients]
   *     summary: Cập nhật thông tin bệnh nhân
   *     description: Cập nhật hồ sơ bệnh nhân tại đúng node cơ sở dữ liệu gốc của bệnh nhân.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID của bệnh nhân cần cập nhật
   *         example: 102
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdatePatientRequest'
   *     responses:
   *       200:
   *         description: Cập nhật thông tin bệnh nhân thành công
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PatientResponse'
   *       400:
   *         description: Dữ liệu cập nhật không hợp lệ
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Không tìm thấy hồ sơ bệnh nhân
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Số CCCD trùng lặp với bệnh nhân khác
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       504:
   *         description: Timeout khi ghi dữ liệu sang máy chủ khu vực
   */
  router.put('/:id', validateUpdatePatient, controller.updatePatient);

  /**
   * @swagger
   * /patients/{id}:
   *   delete:
   *     tags: [Patients]
   *     summary: Xóa hồ sơ bệnh nhân
   *     description: Xóa hồ sơ bệnh nhân khỏi cơ sở dữ liệu tương ứng.
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID của bệnh nhân cần xóa
   *         example: 102
   *     responses:
   *       200:
   *         description: Xóa thành công
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 deleted_patient_id:
   *                   type: integer
   *                   example: 102
   *                 message:
   *                   type: string
   *                   example: "Đã xóa hồ sơ bệnh nhân thành công"
   *       404:
   *         description: Không tìm thấy hồ sơ bệnh nhân
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       504:
   *         description: Timeout khi kết nối sang node chi nhánh
   */
  router.delete('/:id', controller.deletePatient);

  return router;
}

// Khởi tạo instance router mặc định tương thích dùng trực tiếp
const defaultRepository = new PatientRepository();
const defaultService = new PatientService(defaultRepository);
const defaultRouter = createPatientRoutes(defaultService);

defaultRouter.createPatientRoutes = createPatientRoutes;
defaultRouter.PatientService = PatientService;
defaultRouter.PatientRepository = PatientRepository;

module.exports = defaultRouter;
