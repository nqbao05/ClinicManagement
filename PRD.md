# Tài liệu Yêu cầu Sản phẩm (Product Requirements Document - PRD)
**Dự án:** Hệ thống Đặt lịch Y tế Đa cơ sở (Distributed Clinic Management System)
**Mục tiêu:** Xây dựng hệ thống quản lý phòng khám phân tán, cho phép bệnh nhân đặt lịch và bác sĩ truy xuất hồ sơ bệnh án xuyên cơ sở một cách bảo mật, tối ưu hiệu năng.

---

## 1. Phân rã tính năng (Epic & Features)

### Epic 1: Quản lý Xác thực và Phân quyền (Auth & RBAC)
*   **Feature 1.1:** Đăng nhập và Đăng ký cho 3 role: Bệnh nhân, Bác sĩ, Lễ tân/Admin.
*   **Feature 1.2:** Phân quyền truy cập dữ liệu dựa trên Role và Chi nhánh (Ví dụ: Bác sĩ ở cơ sở A không được tự ý sửa thông tin cài đặt của cơ sở B).

### Epic 2: Quản lý Bệnh án và CSDL Phân tán (Distributed Records)
*   **Feature 2.1:** Lưu trữ phân mảnh (Sharding). Hồ sơ bệnh nhân mới tạo ở cơ sở nào sẽ được lưu trực tiếp xuống Server (Node) của cơ sở đó dựa trên khóa phân mảnh `origin_clinic_id`.
*   **Feature 2.2:** Truy vấn chéo (Cross-node Fetch). Cho phép bác sĩ lấy hồ sơ bệnh nhân từ cơ sở khác thông qua định tuyến API Gateway.

### Epic 3: Đặt lịch khám và Điều phối (Booking & Scheduling)
*   **Feature 3.1:** Hiển thị lịch làm việc thực tế của bác sĩ theo từng chi nhánh.
*   **Feature 3.2:** Khách hàng (hoặc qua Ứng dụng Android) thực hiện đặt lịch, hủy lịch hoặc dời lịch khám.

### Epic 4: Quản lý Cơ sở y tế & Thống kê
*   **Feature 4.1:** Bảng điều khiển (Dashboard) thống kê lượt khám theo từng chi nhánh.
*   **Feature 4.2:** Tối ưu hóa truy vấn báo cáo tổng (chống N+1 query) khi lấy dữ liệu gộp từ nhiều Node.

---

## 2. Phân tích Rủi ro và Trường hợp biên (Edge Cases)

**Rủi ro Nghiệp vụ (Business Risks):**
*   **Trùng lịch (Race Condition):** Hai bệnh nhân cùng click đặt lịch cho một Bác sĩ tại đúng 1 khe thời gian (slot) thì ai sẽ được chấp nhận? (Áp dụng Database Lock / Unique Index).
*   **Bác sĩ nghỉ đột xuất:** Bác sĩ bận việc gấp không thể đến phòng khám, hệ thống cần luồng xử lý tự động thông báo và hỗ trợ dời lịch cho các bệnh nhân đã đặt.
*   **Truy xuất bệnh án liên chi nhánh (Cross-clinic Records):** Bệnh nhân đăng ký ban đầu tại Cơ sở 1 (Hà Nội, dữ liệu nằm ở Node Hà Nội), nhưng đến khám tại Cơ sở 2 (TP.HCM). Hệ thống phải tự định tuyến truy vấn sang đúng Node CSDL gốc thay vì báo "Không tìm thấy bệnh nhân".

**Rủi ro Hiệu năng (Performance Risks):**
*   **Độ trễ mạng (Network Latency):** Khi đồng bộ dữ liệu hồ sơ bệnh án giữa Node A và Node B, nếu mạng chậm có thể gây treo giao diện (UI) của Bác sĩ. (Yêu cầu phải có Fallback UI / Skeleton Loading).
*   **Truy vấn báo cáo N+1:** Tải báo cáo danh sách khám kèm thông tin bệnh nhân xuyên Node dễ làm nghẽn băng thông cơ sở dữ liệu.

**Rủi ro Bảo mật (Security Risks):**
*   **Lỗ hổng OWASP (Broken Access Control):** Truy cập trái phép nếu bệnh nhân sửa ID trên URL/API parameter để xem hồ sơ của bệnh nhân khác.
*   **Hết hạn phiên đăng nhập (Token Expiration):** Bác sĩ đang gõ bệnh án rất dài thì token hết hạn, khi bấm "Lưu" bị văng ra ngoài làm mất toàn bộ dữ liệu đang gõ.

---

## 3. User Stories (Định dạng Gherkin)

### Luồng 1: Xử lý Đặt lịch khám (Chống trùng lịch - Race Condition)
*   **Story:** Là một bệnh nhân, tôi muốn chắc chắn lịch khám của mình được xác nhận để không bị trùng với người khác.
*   **Given:** Bệnh nhân A và Bệnh nhân B cùng đang xem khe thời gian trống lúc 09:00 AM của Bác sĩ X.
*   **When:** Bệnh nhân A bấm "Xác nhận đặt lịch" trước Bệnh nhân B 100 mili-giây.
*   **Then:** Hệ thống áp dụng cơ chế khóa (Database Lock) cho slot 09:00 AM.
*   **And:** Hệ thống trả về trạng thái Success cho Bệnh nhân A.
*   **And:** Hệ thống trả về trạng thái Error (hiển thị UI thông báo lỗi màu đỏ "Lịch đã được người khác đặt") cho Bệnh nhân B.

### Luồng 2: Truy xuất hồ sơ bệnh án phân tán (Cross-clinic Records)
*   **Story:** Là một bác sĩ, tôi muốn xem được hồ sơ bệnh nhân dù họ đăng ký khám ban đầu ở chi nhánh khác.

**Kịch bản 2.1 (Thành công - Định tuyến chéo Node):**
*   **Given:** Bệnh nhân Nguyễn Văn P có mã BN102, dữ liệu gốc lưu tại Node Hà Nội (`origin_clinic_id = 1`), hôm nay đến khám tại chi nhánh TP.HCM (`clinic_id = 2`).
*   **When:** Bác sĩ tại TP.HCM nhập mã định danh của bệnh nhân P để tra cứu.
*   **Then:** Giao diện chuyển sang trạng thái IsLoading (hiển thị Skeleton Table).
*   **And:** Hệ thống nhận diện `origin_clinic_id = 1`, Gateway gửi truy vấn sang máy chủ Hà Nội để lấy dữ liệu.
*   **And:** Trả về dữ liệu hồ sơ bệnh án thành công kèm cờ `is_external_record: true`.
*   **And:** Giao diện hiển thị thành công (Success state) kèm nhãn cảnh báo: "Dữ liệu được đồng bộ từ Cơ sở Hà Nội".

**Kịch bản 2.2 (Trường hợp biên - Máy chủ chi nhánh mất kết nối / Timeout):**
*   **Given:** Bệnh nhân Nguyễn Văn P có mã BN102, dữ liệu gốc lưu tại Node Hà Nội.
*   **When:** Bác sĩ tại TP.HCM tra cứu nhưng Node Hà Nội bị sự cố mạng hoặc phản hồi quá thời gian cho phép (Timeout).
*   **Then:** Hệ thống ngắt kết nối an toàn (Circuit Breaker) và trả về mã lỗi `504 Gateway Timeout`.
*   **And:** Giao diện hiển thị Fallback UI thông báo: "Không thể kết nối đến máy chủ khu vực Hà Nội, vui lòng thử lại sau" kèm nút bấm Thử lại (Retry).