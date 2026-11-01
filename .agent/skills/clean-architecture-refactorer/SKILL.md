---
name: clean-architecture-refactorer
description: Tự động hóa quy trình tái cấu trúc mã nguồn Backend theo Clean Architecture, xử lý sharding phân tán, triệt tiêu circular dependencies và bảo toàn 100% test suites.
---

# Clean Architecture Refactoring Skill

## 1. Nguyên tắc cốt lõi (Core Invariants)
- **Zero Circular Dependencies:** Luồng phụ thuộc bắt buộc 1 chiều tuyệt đối:
  `Routes -> Controllers -> Services -> Repositories -> Config/Database`.
- **Pure CommonJS & Clean Separation:** Không để lộ cú pháp SQL, query params hoặc `res.status` ra ngoài đúng tầng phụ trách.
- **Contract Freezing:** Trước và sau mỗi bước refactor, chạy `npm test` và script kiểm tra phụ thuộc. Nếu có bất kỳ test nào fail, lập tức dừng lại và sửa lỗi trước khi chuyển file tiếp theo.

## 2. Quy trình thực thi (Step-by-Step Workflow)

### Bước 1: Khảo sát & Đóng băng trạng thái (Audit & Freeze)
1. Chạy bộ kiểm thử hiện tại: `npm test`.
2. Quét kiểm tra circular dependency hiện tại: `node scripts/check-circular.js` (hoặc `npm run check:circular`).
3. Xác nhận các module hiện diện: `clinics`, `doctors`, `patients`, `appointments`, `dashboard`.

### Bước 2: Chuẩn hóa lớp dùng chung (Consolidate Shared Layer)
1. Đảm bảo thư mục `src/common/` chứa đầy đủ:
   - `errors/`: `BadRequestError` (400), `NotFoundError` (404), `ConflictError` (409), `InternalServerError` (500).
   - `responses/`: `response.helper.js` (`sendSuccess`).
   - `middlewares/`: `error.middleware.js` (bắt toàn bộ lỗi qua `next(error)`).
2. Kiểm tra `src/config/database.js`: Hàm `getDbPool(clinicId)` phải đảm bảo phân định đúng Node `clinic_hanoi` (1) và `clinic_hcm` (2).

### Bước 3: Đồng bộ từng Module (Per-Module Harmonization)
Áp dụng cấu trúc chuẩn cho từng thư mục trong `src/modules/<name>/`:
- `<name>.dto.js`: Chịu trách nhiệm validate & sanitize input.
- `<name>.repository.js`: Thao tác trực tiếp với MySQL qua pool, quản lý transaction an toàn (`conn.release()` luôn nằm trong `finally`).
- `<name>.service.js`: Chứa pure business logic, xử lý logic liên Node (`Promise.allSettled`), khóa bi quan / lạc quan.
- `<name>.controller.js`: Tiếp nhận HTTP Request, gọi Service, trả response qua `sendSuccess`.
- `<name>.routes.js`: Định tuyến Express Router và gắn chú thích Swagger OpenAPI 3.0.

### Bước 4: Tích hợp tại Application Root (`src/app.js`)
1. Import các routes theo chuẩn RESTful V1:
   - `/api/v1/clinics` & `/api/v1/doctors`
   - `/api/v1/patients`
   - `/api/v1/appointments`
   - `/api/v1/admin/dashboard`
2. Đăng ký middleware xử lý lỗi tập trung `errorHandler` ở cuối cùng của pipeline Express.

### Bước 5: Kiểm toán nghiệm thu (Final Audit)
1. Chạy lại kiểm tra phụ thuộc vòng tròn: `npm run check:circular`.
2. Chạy toàn bộ test suites: `npm test` (kết quả bắt buộc 100% Pass).
3. Xác minh Swagger UI khởi động bình thường tại `/api-docs`.
