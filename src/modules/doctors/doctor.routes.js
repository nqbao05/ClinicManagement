const express = require('express');
const { createDoctorController } = require('./doctor.controller');
const DoctorService = require('./doctor.service');
const DoctorRepository = require('./doctor.repository');
const { authenticate, authorize } = require('../../common/middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Doctors (TV1 - Medical Staff)
 *     description: 'Quản lý thông tin bác sĩ theo cơ sở & chuyên khoa (Thành viên 1)'
 * 
 * /v1/doctors:
 *   get:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Lấy danh sách bác sĩ theo cơ sở và chuyên khoa
 *     parameters:
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *         description: 'Lọc theo cơ sở công tác (1: Hà Nội, 2: TP.HCM). Bỏ trống để quét Cross-Node toàn hệ thống.'
 *       - in: query
 *         name: specialty
 *         schema: { type: string }
 *         description: Lọc theo chuyên khoa y tế
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive, all] }
 *         description: 'Lọc theo trạng thái hoạt động'
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Từ khóa tìm kiếm theo tên bác sĩ
 *     responses:
 *       200:
 *         description: Lấy danh sách bác sĩ thành công
 * 
 *   post:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Thêm bác sĩ mới vào chi nhánh (Admin Only)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clinic_id
 *               - full_name
 *               - specialty
 *             properties:
 *               clinic_id:
 *                 type: integer
 *                 enum: [1, 2]
 *                 description: 'Cơ sở công tác (1: Hà Nội, 2: TP.HCM)'
 *                 example: 1
 *               full_name:
 *                 type: string
 *                 example: 'BS. CKI Trần Thị Mai'
 *               specialty:
 *                 type: string
 *                 example: 'Khoa Tai Mũi Họng'
 *               phone:
 *                 type: string
 *                 example: '0901234568'
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 default: active
 *     responses:
 *       201:
 *         description: Thêm bác sĩ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực token
 *       403:
 *         description: Không có quyền quản trị
 * 
 * /v1/doctors/{id}:
 *   get:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Lấy chi tiết thông tin bác sĩ theo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Mã định danh bác sĩ
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *         description: Mã cơ sở công tác
 *     responses:
 *       200:
 *         description: Lấy thông tin bác sĩ thành công
 *       404:
 *         description: Không tìm thấy bác sĩ
 * 
 *   put:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Cập nhật thông tin bác sĩ (Admin Only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               specialty: { type: string }
 *               phone: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Cập nhật bác sĩ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy bác sĩ
 * 
 *   delete:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Xóa bác sĩ khỏi cơ sở (Admin Only - Chặn xóa nếu có lịch hẹn)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *     responses:
 *       200:
 *         description: Xóa bác sĩ thành công
 *       404:
 *         description: Không tìm thấy bác sĩ
 *       409:
 *         description: Không thể xóa bác sĩ đang có lịch khám pending/confirmed
 * 
 * /v1/doctors/{id}/status:
 *   patch:
 *     tags: [Doctors (TV1 - Medical Staff)]
 *     summary: Cập nhật nhanh trạng thái bác sĩ (Admin Only)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: 'inactive'
 *     responses:
 *       200:
 *         description: Đổi trạng thái bác sĩ thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       404:
 *         description: Không tìm thấy bác sĩ
 */
function createDoctorRoutes(service) {
  const router = express.Router();
  const doctorService = service || new DoctorService(new DoctorRepository());
  const controller = createDoctorController(doctorService);

  // Tuyến công khai (Public)
  router.get('/', controller.getDoctors);
  router.get('/:id', controller.getDoctorById);

  // Tuyến quản trị (Admin Only)
  router.post('/', authenticate, authorize('admin'), controller.createDoctor);
  router.put('/:id', authenticate, authorize('admin'), controller.updateDoctor);
  router.patch('/:id/status', authenticate, authorize('admin'), controller.updateDoctorStatus);
  router.delete('/:id', authenticate, authorize('admin'), controller.deleteDoctor);

  return router;
}

const defaultRepository = new DoctorRepository();
const defaultService = new DoctorService(defaultRepository);
const defaultRouter = createDoctorRoutes(defaultService);

defaultRouter.createDoctorRoutes = createDoctorRoutes;
defaultRouter.DoctorService = DoctorService;
defaultRouter.DoctorRepository = DoctorRepository;

module.exports = defaultRouter;
