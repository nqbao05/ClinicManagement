# Clinic Booking Backend

Backend mẫu tuân thủ Clean Architecture cho API đặt lịch khám.

## Cấu trúc

- `src/models`: thực thể dữ liệu
- `src/repositories`: truy cập và transaction CSDL
- `src/services`: quy tắc nghiệp vụ, gồm chống đặt trùng lịch
- `src/controllers`: HTTP adapter
- `src/routes`: định tuyến và chú thích OpenAPI
- `src/config`, `src/middleware`, `src/swagger`: cấu hình hệ thống

## Chạy

```powershell
npm install
npm start
```

- API: `POST http://localhost:3000/api/appointments`
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Chống race condition

Hai cơ chế bảo vệ được kết hợp:

1. Kiểm tra slot active trước insert để phản hồi nhanh.
2. Unique partial index trên `(doctor_id, slot_time)` cho các lịch không bị huỷ là rào chắn cuối cùng trong cơ sở dữ liệu. Insert đồng thời vì vậy chỉ có một yêu cầu thành công; yêu cầu còn lại được repository/database chuyển thành `409 Conflict`.

## Ví dụ

```json
{
  "patientId": 1,
  "doctorId": 1,
  "clinicId": 1,
  "slotTime": "2026-11-01T09:00:00.000Z"
}
```
