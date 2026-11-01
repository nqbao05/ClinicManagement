const express = require('express');
const { createPatientController } = require('./patient.controller');
const PatientService = require('./patient.service');
const PatientRepository = require('./patient.repository');

/**
 * @swagger
 * tags:
 *   - name: Patients (TV2 - Sharding & Profile Management)
 *     description: 'Quản lý hồ sơ bệnh nhân, định tuyến Sharding Key & Tra cứu Cross-Node (Thành viên 2)'
 *   - name: Patients
 *     description: 'Tương thích ngược API Bệnh nhân baseline'
 * 
 * /patients:
 *   post:
 *     tags: [Patients]
 *     summary: Tạo mới hồ sơ bệnh nhân
 *     responses:
 *       201:
 *         description: Tạo mới thành công
 *   get:
 *     tags: [Patients]
 *     summary: Lấy danh sách bệnh nhân
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 * 
 * /patients/{id}:
 *   get:
 *     tags: [Patients]
 *     summary: Lấy chi tiết hồ sơ bệnh nhân
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *   put:
 *     tags: [Patients]
 *     summary: Cập nhật hồ sơ bệnh nhân
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *   delete:
 *     tags: [Patients]
 *     summary: Xóa hồ sơ bệnh nhân
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Xóa thành công
 * 
 * /v1/patients:
 *   post:
 *     tags: [Patients (TV2 - Sharding & Profile Management)]
 *     summary: Đăng ký mới hồ sơ bệnh nhân (Write Routing theo Sharding Key)
 *     description: |
 *       Tiếp nhận thông tin bệnh nhân, xác thực định dạng CCCD/Số điện thoại Việt Nam 
 *       và ghi dữ liệu trực tiếp vào đúng Node CSDL vật lý (`clinic_hanoi` nếu origin_clinic_id = 1, `clinic_hcm` nếu origin_clinic_id = 2).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - full_name
 *               - citizen_id
 *               - phone_number
 *               - origin_clinic_id
 *               - date_of_birth
 *             properties:
 *               full_name:
 *                 type: string
 *                 example: 'Nguyễn Văn Bình'
 *                 description: 'Họ và tên bệnh nhân (tối thiểu 2 ký tự)'
 *               citizen_id:
 *                 type: string
 *                 example: '001200001234'
 *                 description: 'Căn cước công dân Việt Nam (đúng 12 chữ số)'
 *               phone_number:
 *                 type: string
 *                 example: '0912345678'
 *                 description: 'Số điện thoại di động Việt Nam (10 chữ số bắt đầu bằng 0)'
 *               origin_clinic_id:
 *                 type: integer
 *                 enum: [1, 2]
 *                 example: 1
 *                 description: 'Khóa phân mảnh (1: Cơ sở Hà Nội, 2: Cơ sở TP.HCM)'
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: '1995-08-20'
 *                 description: 'Ngày sinh định dạng YYYY-MM-DD'
 *               gender:
 *                 type: string
 *                 enum: [Male, Female, Other]
 *                 example: 'Male'
 *               address:
 *                 type: string
 *                 example: 'Số 10 Phố Tràng Thi, Hoàn Kiếm, Hà Nội'
 *     responses:
 *       201:
 *         description: Đăng ký hồ sơ bệnh nhân thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 statusCode: { type: integer, example: 201 }
 *                 message: { type: string, example: 'Đăng ký hồ sơ bệnh nhân thành công' }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patient_id: { type: integer, example: 10 }
 *                     origin_clinic_id: { type: integer, example: 1 }
 *                     citizen_id: { type: string, example: '001200001234' }
 *                     full_name: { type: string, example: 'Nguyễn Văn Bình' }
 *                     phone_number: { type: string, example: '0912345678' }
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ (sai định dạng CCCD, SĐT hoặc ngày sinh)
 *       409:
 *         description: Số CCCD đã tồn tại trong cơ sở dữ liệu của chi nhánh
 *       500:
 *         description: Lỗi máy chủ nội bộ
 * 
 *   get:
 *     tags: [Patients (TV2 - Sharding & Profile Management)]
 *     summary: Tra cứu danh sách hồ sơ bệnh nhân (Cross-Node Distributed Lookup)
 *     description: |
 *       Hỗ trợ tìm kiếm hồ sơ bệnh nhân theo số CCCD, SĐT. Nếu không truyền `clinic_id`, 
 *       hệ thống tự động kích hoạt truy vấn song song chịu lỗi (`Promise.allSettled`) trên toàn bộ các Node Shard.
 *     parameters:
 *       - in: query
 *         name: citizen_id
 *         schema: { type: string }
 *         required: false
 *         description: 'Tìm kiếm chính xác theo số CCCD 12 số'
 *       - in: query
 *         name: phone_number
 *         schema: { type: string }
 *         required: false
 *         description: 'Tìm kiếm theo số điện thoại'
 *       - in: query
 *         name: clinic_id
 *         schema: { type: integer, enum: [1, 2] }
 *         required: false
 *         description: 'Lọc cụ thể theo cơ sở (1: Hà Nội, 2: TP.HCM). Bỏ trống để quét Cross-Node.'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         required: false
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         required: false
 *     responses:
 *       200:
 *         description: Lấy danh sách bệnh nhân thành công
 *       400:
 *         description: Tham số phân trang hoặc bộ lọc không hợp lệ
 * 
 * /v1/patients/{id}:
 *   get:
 *     tags: [Patients (TV2 - Sharding & Profile Management)]
 *     summary: Lấy chi tiết hồ sơ bệnh nhân theo ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Mã định danh bệnh nhân (patient_id)
 *       - in: query
 *         name: clinic_id
 *         required: false
 *         schema: { type: integer, enum: [1, 2] }
 *         description: Cơ sở gốc của bệnh nhân (origin_clinic_id)
 *       - in: header
 *         name: x-clinic-id
 *         required: false
 *         schema: { type: integer }
 *         description: Header xác định chi nhánh khám
 *     responses:
 *       200:
 *         description: Lấy thông tin bệnh nhân thành công
 *       404:
 *         description: Không tìm thấy hồ sơ bệnh nhân
 */
function createPatientV1Routes(service) {
  const router = express.Router();
  const patientService = service || new PatientService(new PatientRepository());
  const controller = createPatientController(patientService);

  router.post('/', (req, res, next) => controller.createPatientV1(req, res, next));
  router.get('/', (req, res, next) => controller.getPatientsV1(req, res, next));
  router.get('/:id', (req, res, next) => controller.getPatientDetail(req, res, next));

  return router;
}

const { validateCreatePatient, validateUpdatePatient } = require('./patient.dto');

function createPatientRoutes(service) {
  const router = express.Router();
  const patientService = service || new PatientService(new PatientRepository());
  const controller = createPatientController(patientService);

  router.post('/', validateCreatePatient, controller.createPatient);
  router.get('/', controller.getPatients);
  router.get('/search/distributed', controller.getPatients);
  router.get('/:id', controller.getPatientById);
  router.put('/:id', validateUpdatePatient, controller.updatePatient);
  router.delete('/:id', controller.deletePatient);

  return router;
}

const defaultRepository = new PatientRepository();
const defaultService = new PatientService(defaultRepository);
const defaultRouter = createPatientV1Routes(defaultService);

defaultRouter.createPatientV1Routes = createPatientV1Routes;
defaultRouter.createPatientRoutes = createPatientRoutes;
defaultRouter.PatientService = PatientService;
defaultRouter.PatientRepository = PatientRepository;

module.exports = defaultRouter;
module.exports.createPatientV1Routes = createPatientV1Routes;
module.exports.createPatientRoutes = createPatientRoutes;
module.exports.PatientService = PatientService;
module.exports.PatientRepository = PatientRepository;
