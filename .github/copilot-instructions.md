# Cấu trúc Kiến trúc (Clean Architecture)
Hệ thống Backend phải tuân thủ nghiêm ngặt mô hình phân tầng: Models -> Repositories -> Services -> Controllers.
Tuyệt đối tuân thủ chiều luồng dependency: Giao diện (UI) hoặc Controller chỉ được gọi Service; Service chỉ được gọi Repository; Repository giao tiếp với Database. Không bao giờ có hiện tượng import vòng tròn (circular dependencies).

# Quy định sinh mã (Code Generation Rules)
1. Mỗi khi tạo mới một RESTful API, bắt buộc phải tự động sinh tài liệu Swagger/OpenAPI tương ứng[cite: 1].
2. Dữ liệu bệnh nhân phải chứa trường `origin_clinic_id` để phục vụ việc phân mảnh cơ sở dữ liệu (Sharding) giữa các chi nhánh.
3. Khi viết code cho Frontend, bắt buộc áp dụng Atomic Design Pattern (tách nhỏ thành atoms, molecules, organisms)[cite: 1].
4. Giao diện Frontend phải sử dụng các thư viện UI chuẩn thay vì viết CSS ngẫu nhiên[cite: 1].
5. Các module gọi API ở Frontend phải luôn xử lý triệt để 3 trạng thái mạng: Loading, Error (với Fallback UI), Success (bao gồm Empty state)[cite: 1].

# Quy tắc Kiểm thử (Testing)
Khi được yêu cầu viết test, hãy viết Unit Test hoặc Integration Test bao phủ các trường hợp biên (edge cases) và kiểm tra lỗ hổng bảo mật, đặc biệt tối ưu hóa câu lệnh truy vấn để chống lỗi N+1 query[cite: 1].