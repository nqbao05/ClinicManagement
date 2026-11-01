const express = require('express');
const { createClinicController } = require('./clinic.controller');
const ClinicService = require('./clinic.service');
const ClinicRepository = require('./clinic.repository');

/**
 * @swagger
 * tags:
 *   - name: Clinics (TV1 - Branch Management)
 *     description: 'Quản lý thông tin chi nhánh phòng khám đa cơ sở (Thành viên 1)'
 * 
 * /v1/clinics:
 *   get:
 *     tags: [Clinics (TV1 - Branch Management)]
 *     summary: Lấy danh sách các cơ sở phòng khám
 *     parameters:
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *         description: 'Lọc theo mã chi nhánh cụ thể (1: Hà Nội, 2: TP.HCM)'
 *     responses:
 *       200:
 *         description: Lấy danh sách chi nhánh thành công
 * 
 * /v1/clinics/{id}:
 *   get:
 *     tags: [Clinics (TV1 - Branch Management)]
 *     summary: Lấy chi tiết thông tin chi nhánh theo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Mã định danh chi nhánh (1 hoặc 2)
 *     responses:
 *       200:
 *         description: Lấy thông tin chi nhánh thành công
 *       404:
 *         description: Không tìm thấy chi nhánh
 */
function createClinicRoutes(service) {
  const router = express.Router();
  const clinicService = service || new ClinicService(new ClinicRepository());
  const controller = createClinicController(clinicService);

  router.get('/', controller.getClinics);
  router.get('/:id', controller.getClinicById);

  return router;
}

const defaultRepository = new ClinicRepository();
const defaultService = new ClinicService(defaultRepository);
const defaultRouter = createClinicRoutes(defaultService);

defaultRouter.createClinicRoutes = createClinicRoutes;
defaultRouter.ClinicService = ClinicService;
defaultRouter.ClinicRepository = ClinicRepository;

module.exports = defaultRouter;
