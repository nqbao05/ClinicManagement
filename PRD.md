# Tài liệu Yêu cầu Sản phẩm (Product Requirements Document - PRD)
**Dự án:** Hệ thống Đặt lịch Y tế Đa cơ sở (Distributed Clinic Management System)
**Mục tiêu:** Xây dựng hệ thống quản lý phòng khám phân tán, cho phép bệnh nhân đặt lịch và bác sĩ truy xuất hồ sơ bệnh án xuyên cơ sở một cách bảo mật, tối ưu hiệu năng.

---

## 1. Phân rã tính năng (Epic & Features)

### Epic 1: Quản lý Xác thực và Phân quyền (Auth & RBAC)
*   **Feature 1.1:** Đăng nhập và Đăng ký cho 3 role: Bệnh nhân, Bác sĩ, Lễ tân/Admin.
*   **Feature 1.2:** Phân quyền truy cập dữ liệu dựa trên Role và Chi nhánh (Ví dụ: Bác sĩ ở cơ sở A không được tự ý sửa thông tin cài đặt của cơ sở B).

### Epic 2: Quản lý Bệnh án và CSDL Phân tán (Distributed Records)
*   **Feature 2.1:** Lưu trữ phân mảnh (Sharding). Hồ sơ bệnh nhân mới tạo ở cơ sở nào sẽ được lưu trực tiếp xuống Server (Node) của cơ sở đó.
*   **Feature 2.2:** Truy vấn chéo (Cross-node Fetch). Cho phép bác sĩ lấy hồ sơ bệnh nhân từ cơ sở khác thông qua định tuyến API.

### Epic 3: Đặt lịch khám và Điều phối (Booking & Scheduling)
*   **Feature 3.1:** Hiển thị lịch làm việc thực tế của bác sĩ theo từng chi nhánh.
*   **Feature 3.2:** Khách hàng (hoặc qua Ứng dụng Android) thực hiện đặt lịch, hủy lịch hoặc dời lịch khám.

### Epic 4: Quản lý Cơ sở y tế & Thống kê
*   **Feature 4.1:** Bảng điều khiển (Dashboard) thống kê lượt khám theo từng chi nhánh.
*   **Feature 4.2:** Tối ưu hóa truy vấn báo cáo tổng (chống N+1 query) khi lấy dữ liệu gộp từ nhiều Node.

---

## 2. Phân tích Rủi ro và Trường hợp biên (Edge Cases)

**Rủi ro Nghiệp vụ (Business Risks):**
*   *Trùng lịch (Race Condition):* Hai bệnh nhân cùng click đặt lịch cho một Bác sĩ tại đúng 1 khe thời gian (slot) thì ai sẽ được chấp nhận?
*   *Bác sĩ nghỉ đột xuất:* Bác sĩ bận việc gấp không thể đến phòng khám, hệ thống cần luồng xử lý tự động thông báo và hỗ trợ dời lịch cho các bệnh nhân đã đặt.
*   *Bệnh nhân sai cơ sở:* Bệnh nhân đặt lịch ở Cơ sở 1 nhưng lại đến Cơ sở 2 để khám.

**Rủi ro Hiệu năng (Performance Risks):**
*   *Độ trễ mạng (Network Latency):* Khi đồng bộ dữ liệu hồ sơ bệnh án giữa Node A và Node B, nếu mạng chậm có thể gây treo giao diện (UI) của Bác sĩ. (Yêu cầu phải có Fallback UI / Skeleton Loading).

**Rủi ro Bảo mật (Security Risks):**
*   *Lỗ hổng OWASP:* Truy cập trái phép (Broken Access Control) nếu bệnh nhân sửa ID trên URL để xem hồ sơ của bệnh nhân khác. 
*   *Hết hạn phiên đăng nhập (Token Expiration):* Bác sĩ đang gõ bệnh án rất dài thì token hết hạn, khi bấm "Lưu" bị văng ra ngoài làm mất toàn bộ dữ liệu đang gõ.

---

## 3. User Stories (Định dạng Gherkin)

### Luồng 1: Xử lý Đặt lịch khám (Chống trùng lịch - Race Condition)
*   **Story:** Là một bệnh nhân, tôi muốn chắc chắn lịch khám của mình được xác nhận để không bị trùng với người khác.
*   **Given** (Trong bối cảnh): Bệnh nhân A và Bệnh nhân B cùng đang xem khe thời gian trống lúc 09:00 AM của Bác sĩ X.
*   **When** (Khi): Bệnh nhân A bấm "Xác nhận đặt lịch" trước Bệnh nhân B 100 mili-giây.
*   **Then** (Thì): Hệ thống áp dụng cơ chế khóa (Database Lock) cho slot 09:00 AM. 
*   **And** (Và): Hệ thống trả về trạng thái Success cho Bệnh nhân A.
*   **And** (Và): Hệ thống trả về trạng thái Error (hiển thị UI thông báo lỗi màu đỏ "Lịch đã được người khác đặt") cho Bệnh nhân B.

### Luồng 2: Truy xuất hồ sơ bệnh án phân tán
*   **Story:** Là một bác sĩ, tôi muốn xem được hồ sơ bệnh nhân dù họ đăng ký khám ban đầu ở chi nhánh khác.
*   **Given** (Trong bối cảnh): Bệnh nhân Nguyễn Văn P có dữ liệu gốc ở Node cơ sở dữ liệu Hà Nội, nhưng hôm nay đến khám tại chi nhánh TP.HCM.
*   **When** (Khi): Bác sĩ tại TP.HCM nhập mã ID của bệnh nhân P để tìm kiếm.
*   **Then** (Thì): Giao diện chuyển sang trạng thái IsLoading (hiển thị Skeleton).
*   **And** (Và): Server TP.HCM gọi API định tuyến sang Server Hà Nội để lấy dữ liệu.
*   **And** (Và): Khi có dữ liệu, giao diện hiển thị thành công (Success state). Nếu Server Hà Nội mất kết nối, giao diện hiển thị Fallback UI "Không thể kết nối đến máy chủ khu vực, vui lòng thử lại".