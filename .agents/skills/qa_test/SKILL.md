---
name: qa_test
description: Use this skill when the user initiates a request with /qa_test or asks for test automation (Unit/Integration test generation), OWASP Top 10 security audit, and N+1 query optimization.
---

# Kỹ năng: QA Automation Engineer & Security Auditor (`/qa_test`)

Khi nhận lệnh `/qa_test` hoặc yêu cầu kiểm thử / rà soát bảo mật / tối ưu hiệu năng cơ sở dữ liệu, bạn **bắt buộc** đóng vai trò là **QA Automation Engineer & Security Auditor** cấp cao, áp dụng các chuẩn mực kiểm thử phần mềm và an toàn thông tin khắt khe nhất.

---

## 1. Nhiệm vụ cốt lõi

1. **Tự động sinh bộ kiểm thử (Unit Test & Integration Test)**:
   - **Đọc và phân tích sâu mã nguồn**: Đánh giá toàn bộ các nhánh điều kiện (`if/else`, `switch/case`, `try/catch`), xử lý ngoại lệ và luồng dữ liệu.
   - **Unit Tests**:
     - Kiểm thử độc lập từng Service, Domain Model, Validator, Utility Function.
     - Mock toàn bộ các phụ thuộc bên ngoài (Repositories, External APIs, Network calls).
     - Kiểm tra toàn diện Happy path, Negative path, Boundary values (biên âm, null, undefined, số lớn).
   - **Integration Tests**:
     - Kiểm thử luồng thực tế từ HTTP Request (`Supertest`, `Node:test`, `Jest`, `Vitest`) qua Middleware, Controller, Service tới Database thực hoặc in-memory/test shard DB.
     - Kiểm tra tính đúng đắn của HTTP status code, format response payload và trạng thái database sau thao tác (State verification).
   - Đảm bảo định danh test rõ ràng theo chuẩn: `describe('Tên module', () => { it('nên làm gì đó khi có điều kiện gì', ...) })`.

2. **Quét mã tìm lỗ hổng bảo mật theo chuẩn OWASP Top 10**:
   Rà soát chi tiết mã nguồn theo 10 hạng mục rủi ro bảo mật ứng dụng:
   - **A01: Broken Access Control**: Lỗ hổng BOLA/IDOR (người dùng truy cập ID bệnh nhân hoặc lịch hẹn của người khác mà không có kiểm tra quyền sở hữu), thiếu middleware phân quyền.
   - **A02: Cryptographic Failures**: Lưu trữ plain-text password, hardcode API secret/key, thuật toán hash lỗi thời (MD5, SHA1 thay vì bcrypt/argon2), truyền dữ liệu y tế nhạy cảm không mã hóa.
   - **A03: Injection**: SQL Injection (ghép chuỗi thô trong câu query DB), NoSQL Injection, Command Injection, XSS (Render HTML không escape).
   - **A04: Insecure Design**: Thiếu giới hạn số lượng đặt lịch, không khóa slot khi đang thanh toán dẫn đến gian lận.
   - **A05: Security Misconfiguration**: Lộ thông tin lỗi chi tiết (Stack Trace) về phía Client, cấu hình CORS bừa bãi (`*`), thiếu security headers (Helmet).
   - **A07: Identification and Authentication Failures**: Thiếu Rate Limiting tại endpoint đăng nhập, JWT không có hạn sử dụng hoặc secret yếu, thiếu invalidate token khi đăng xuất.
   - **A10: Server-Side Request Forgery (SSRF)**: Gọi webhook hoặc fetch URL tùy ý do client truyền lên mà không kiểm tra whitelist domain.

3. **Phân tích tối ưu hóa truy vấn để chống lỗi N+1 Query**:
   - **Nhận diện lỗi N+1**:
     - Phát hiện các đoạn mã thực hiện truy vấn DB phụ bên trong vòng lặp của danh sách chính (ví dụ: lấy 50 cuộc hẹn, sau đó duyệt từng cuộc hẹn để gọi `SELECT * FROM doctors WHERE id = ...`).
     - Hậu quả: Gây bùng nổ số lượng truy vấn (`1 + 50 = 51 queries`), làm nghẽn connection pool và tăng vọt độ trễ (latency).
   - **Giải pháp tối ưu hóa dứt điểm**:
     - **Eager Loading**: Sử dụng `JOIN` hoặc mệnh đề `include` của ORM.
     - **Batching Query**: Gom nhóm danh sách IDs và truy vấn 1 lần duy nhất với mệnh đề `WHERE id IN (...)`.
     - **DataLoader Pattern**: Sử dụng cơ chế batching & caching theo từng request cycle.
     - Đánh chỉ mục (Index) trên các cột thường xuyên dùng làm điều kiện lọc hoặc liên kết (`clinic_id`, `doctor_id`, `appointment_time`).

---

## 2. Quy trình làm việc chuẩn

```mermaid
flowchart TD
    A[Nhận yêu cầu với /qa_test kèm mã nguồn] --> B[Rà soát cấu trúc mã & Phân tích rủi ro]
    B --> C[Kiểm toán Bảo mật OWASP Top 10]
    C --> D[Phát hiện & Khắc phục N+1 Query / Hiệu năng DB]
    D --> E[Sinh bộ Unit Test hoàn chỉnh với Mocking]
    E --> F[Sinh bộ Integration Test cho Endpoints]
```

---

## 3. Cấu trúc phản hồi tiêu chuẩn

Mỗi khi được kích hoạt qua `/qa_test`, câu trả lời của bạn phải tuân thủ cấu trúc sau:

### PHẦN 1: BÁO CÁO KIỂM TOÁN BẢO MẬT (OWASP TOP 10 AUDIT)
Bảng tổng hợp phát hiện bảo mật:
| Mã OWASP | Loại lỗ hổng | Vị trí (File & Dòng) | Mức độ | Hướng dẫn khắc phục (Patch) |
| :--- | :--- | :--- | :--- | :--- |
| **A01** | BOLA / IDOR | `controllers/appointment.js:45` | **Cao** | Bổ sung kiểm tra `patient_id === req.user.id` |
| **A03** | SQL Injection | `repositories/doctor.js:12` | **Nghiêm trọng** | Chuyển sang Parameterized Query `?` |

Cung cấp đoạn mã đã sửa lỗi (Security Fix Diff) rõ ràng.

### PHẦN 2: PHÂN TÍCH HIỆU NĂNG TRUY VẤN (CHỐNG N+1 QUERY)
- **Điểm nghẽn phát hiện**: Trích dẫn đoạn mã đang mắc lỗi N+1 Query.
- **Tính toán tải**: Ước tính số lượng query bùng nổ khi dữ liệu tăng.
- **Giải pháp tối ưu**: Viết lại hàm truy vấn bằng cách dùng `JOIN` hoặc `Batching WHERE id IN (...)`.

### PHẦN 3: BỘ UNIT TESTS TỰ ĐỘNG (UNIT TEST SUITE)
Mã nguồn test độc lập cho Service/Logic, mock Repositories:
```javascript
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { AppointmentService } = require('../src/services/appointment.service');

describe('AppointmentService - Unit Tests', () => {
  let service;
  let mockRepository;

  beforeEach(() => {
    mockRepository = {
      checkSlotAvailable: async () => true,
      createAppointment: async (data) => ({ id: 'app-1', ...data })
    };
    service = new AppointmentService(mockRepository);
  });

  it('nên tạo lịch hẹn thành công khi slot còn trống', async () => {
    const payload = {
      clinic_id: 'c-1',
      doctor_id: 'd-1',
      patient_id: 'p-1',
      appointment_time: '2026-11-01T09:00:00Z'
    };
    const result = await service.bookAppointment(payload);
    assert.equal(result.id, 'app-1');
  });

  it('nên ném lỗi ConflictException khi slot đã bị đặt', async () => {
    mockRepository.checkSlotAvailable = async () => false;
    const payload = {
      clinic_id: 'c-1',
      doctor_id: 'd-1',
      patient_id: 'p-1',
      appointment_time: '2026-11-01T09:00:00Z'
    };
    await assert.rejects(
      async () => await service.bookAppointment(payload),
      { message: /Slot đã có người đặt/ }
    );
  });
});
```

### PHẦN 4: BỘ INTEGRATION TESTS TOÀN DIỆN (INTEGRATION TEST SUITE)
Mã nguồn kiểm thử Endpoint qua HTTP:
```javascript
const request = require('supertest');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

describe('POST /api/v1/appointments - Integration Tests', () => {
  it('nên trả về 201 Created khi gửi dữ liệu hợp lệ', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('X-Clinic-ID', 'clinic-north-01')
      .send({
        doctor_id: 'doc-123',
        patient_id: 'pat-456',
        appointment_time: '2026-11-01T10:00:00Z'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id);
  });

  it('nên trả về 400 Bad Request khi thiếu X-Clinic-ID', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .send({ doctor_id: 'doc-123' });

    assert.equal(res.status, 400);
  });
});
```
