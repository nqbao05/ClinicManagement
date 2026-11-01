const express = require('express');
const { createDoctorController } = require('./doctor.controller');
const DoctorService = require('./doctor.service');
const DoctorRepository = require('./doctor.repository');

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
 *         description: 'Lọc theo cơ sở công tác (1: Hà Nội, 2: TP.HCM)'
 *       - in: query
 *         name: specialty
 *         schema: { type: string }
 *         description: Lọc theo chuyên khoa
 *     responses:
 *       200:
 *         description: Lấy danh sách bác sĩ thành công
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
 */
function createDoctorRoutes(service) {
  const router = express.Router();
  const doctorService = service || new DoctorService(new DoctorRepository());
  const controller = createDoctorController(doctorService);

  router.get('/', controller.getDoctors);
  router.get('/:id', controller.getDoctorById);

  return router;
}

const defaultRepository = new DoctorRepository();
const defaultService = new DoctorService(defaultRepository);
const defaultRouter = createDoctorRoutes(defaultService);

defaultRouter.createDoctorRoutes = createDoctorRoutes;
defaultRouter.DoctorService = DoctorService;
defaultRouter.DoctorRepository = DoctorRepository;

module.exports = defaultRouter;
