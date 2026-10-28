# Tài liệu Phân tích Nghiệp vụ Chuyên sâu: Kiểm soát Đồng thời & Chống Trùng lịch (Race Condition) trong Đặt lịch Khám bệnh

> **Dự án:** Hệ thống Quản lý Phòng khám Đa cơ sở (Distributed Clinic Management System)  
> **Căn cứ tài liệu:** `PRD.md` (Epic 3: Đặt lịch khám và Điều phối & Phần 2: Rủi ro Trùng lịch)  
> **Người thực hiện:** Senior Business Analyst & Edge-Case Finder (`/ba_pm`)  
> **Ngày khởi tạo:** 2026-10-29  
> **Tài liệu tham chiếu:** [auth-requirements.md](file:///c:/xampp1/htdocs/ClinicManagement/docs/auth/auth-requirements.md), [sequence.mermaid](file:///c:/xampp1/htdocs/ClinicManagement/sequence.mermaid), [erd.mermaid](file:///c:/xampp1/htdocs/ClinicManagement/erd.mermaid)

---

## 1. ĐÁNH GIÁ & CÂU HỎI PHẢN BIỆN (CRITICAL QUESTIONS)

### 1.1. Tóm tắt hiểu biết nghiệp vụ
Chức năng **Đặt lịch khám bệnh (Doctor Appointment Booking)** là một trong những nghiệp vụ cốt lõi, tác động trực tiếp đến doanh thu phòng khám và trải nghiệm khách hàng. Trong các khung giờ cao điểm (sáng sớm mở cổng đặt lịch, bác sĩ chuyên gia đầu ngành có số lượng slot giới hạn), hiện tượng **hàng trăm bệnh nhân cùng nhắm vào một khung giờ (Slot)** xảy ra thường xuyên. 

Nếu hệ thống áp dụng cơ chế xác thực đơn giản "Kiểm tra thấy trống thì cho phép ghi" (*Read-then-Write*), hai hoặc nhiều yêu cầu gửi tới trong cùng một mili-giây sẽ đều thấy slot trống và cùng ghi thành công vào cơ sở dữ liệu (*Double Booking*). Điều này dẫn đến sự cố nghiêm trọng: hai bệnh nhân cùng mang mã xác nhận đến phòng khám tại một thời điểm, làm vỡ lịch làm việc của bác sĩ và gây khủng hoảng truyền thông/khiếu nại dịch vụ.

### 1.2. Các giả định cần xác thực (Assumptions)
1. **Quy cách Slot khám:** Mỗi slot khám của Bác sĩ là cố định (ví dụ: 15 phút hoặc 30 phút/ca). Tại một thời điểm xác định $(T)$, một Bác sĩ tại một Chi nhánh chỉ có thể tiếp đón duy nhất **1 Bệnh nhân**.
2. **Kênh đặt lịch:** Khách hàng có thể đặt qua nhiều kênh song song: Web Portal, Ứng dụng di động (Android/iOS), hoặc Lễ tân nhập trực tiếp tại quầy tiếp đón (POS/Desk).
3. **Mô hình xác nhận:** Đặt lịch có thể kèm theo thanh toán/đặt cọc trực tuyến (Online Payment) hoặc chỉ cần xác thực qua mã OTP số điện thoại.

### 1.3. Danh sách câu hỏi phản biện trọng yếu (Challenging Assumptions & 5 Whys)
1. **Cơ chế Giữ chỗ tạm thời (Temporary Hold) kéo dài bao lâu là tối ưu cho nghiệp vụ y tế?**  
   *Nếu đặt TTL (Time to Live) quá ngắn (ví dụ: 2 phút), bệnh nhân lớn tuổi không kịp nhập tiền sử bệnh hoặc thẻ ngân hàng sẽ bị văng ra. Nếu đặt TTL quá dài (ví dụ: 15 phút), slot bị giam giữ ảo ("Slot Hoarding"), khiến phòng khám bị mất khách hàng tiềm năng khác. Vậy thời gian giữ chỗ chuẩn nên là bao nhiêu và có cơ chế tự động gia hạn khi đã sang bước nhập thẻ ngân hàng hay không?*
2. **Xử lý "Bất công vi mô" (Micro-fairness) khi 2 bệnh nhân tranh chấp cùng 1 mili-giây?**  
   *Hệ thống dựa trên thời điểm Timestamp chạm Web Server để quyết định người thắng. Nhưng nếu Bệnh nhân A ở vùng mạng 3G chậm hơn Bệnh nhân B ở cáp quang 1Gbps dù A bấm nút trước ở máy cá nhân, hệ thống có cần cơ chế bảo vệ trải nghiệm (Smart Fallback Recommender) để bù đắp sự ức chế của người thua hay không?*
3. **Phòng chống hành vi đầu cơ slot ảo (Anti-Hoarding & Bot Scraping)?**  
   *Làm thế nào để ngăn chặn một cá nhân hoặc phòng khám đối thủ mở nhiều tài khoản ảo/nhiều tab trình duyệt để chiếm giữ hàng loạt slot giờ vàng của bác sĩ giỏi trong 5 phút rồi nhả ra liên tục mà không bao giờ chốt khám?*
4. **Trạng thái lịch khi Bác sĩ có việc đột xuất / Ca cấp cứu khẩn cấp?**  
   *Nếu một slot đã chốt thành công (`CONFIRMED`) nhưng bác sĩ phải vào phòng cấp cứu, luồng nghiệp vụ điều phối chuyển viện, đổi bác sĩ tương đương hoặc bồi hoàn phiếu khám miễn phí cho bệnh nhân được thiết kế như thế nào?*
5. **Đồng bộ trạng thái thời gian thực giữa Web - Mobile - Quầy lễ tân?**  
   *Khi Bệnh nhân A trên Mobile App đang giữ chỗ slot 09:00 AM, màn hình của Lễ tân tại quầy có đổi màu ngay lập tức (qua WebSocket / Server-Sent Events) để lễ tân không tư vấn slot này cho bệnh nhân vãng lai đang đứng trước mặt không?*

---

## 2. BẢNG PHÂN TÍCH RỦI RO CHUYÊN SÂU & EDGE CASES

### 2.1. Bản chất Kịch bản Xung đột 1 Millisecond (The Millisecond Collision Scenario)

Giả sử Bác sĩ Trần Văn Y có slot khám trống lúc **09:00 AM ngày 02/11/2026** tại Chi nhánh Hà Nội.
* **Thời điểm $T = 09:00:00.125$:** Cả Bệnh nhân A (đặt qua Web) và Bệnh nhân B (đặt qua App) đều thấy slot trống và nhấn nút *"Xác nhận đặt khám"*.
* **Tầng Mạng & Gateway:** Hai request HTTP `POST /api/appointments` được chuyển tiếp đồng thời qua Load Balancer đến 2 tiến trình xử lý khác nhau của Backend.
* **Diễn biến lỗi nếu không có Concurrency Lock:**
  1. *Thread 1 (của A):* Chạy `SELECT count(*) FROM appointments WHERE doctor_id=2 AND slot_time='2026-11-02 09:00:00' AND status != 'Cancelled'`. Kết quả trả về `0`.
  2. *Thread 2 (của B):* Đồng thời chạy cùng câu lệnh `SELECT`. Lúc này Thread 1 chưa kịp `INSERT`, kết quả của Thread 2 cũng là `0`.
  3. Cả 2 Thread cùng kết luận: *"Slot còn trống, cho phép tạo lịch!"*.
  4. Cả Thread 1 và Thread 2 cùng thực thi lệnh `INSERT INTO appointments ...`.
  5. **Hậu quả:** 2 bản ghi hợp lệ cùng tồn tại cho 1 bác sĩ tại đúng 1 khung giờ (*Double Booking*).

```
   Bệnh nhân A ──► [HTTP POST] ──► Thread 1 ──► Check: Trống (0) ──────► INSERT (A) ──┐ (CÙNG TỒN TẠI)
                                                                                       ├──► TRÙNG LỊCH (DOUBLE BOOKING)
   Bệnh nhân B ──► [HTTP POST] ──► Thread 2 ──► Check: Trống (0) ──────► INSERT (B) ──┘
                   (Cùng 1 mili-giây)
```

---

### 2.2. Ma trận Phân tích Tác động Đa chiều

| Nhóm tác động | Chi tiết tác động | Mức độ nghiêm trọng |
| :--- | :--- | :---: |
| **Tính toàn vẹn Dữ liệu (Data Integrity)** | - Tạo ra 2 bản ghi mâu thuẫn nghiệp vụ trong cùng một CSDL.<br>- Làm sai lệch báo cáo thống kê lượt khám, sai lệch công suất làm việc của bác sĩ.<br>- Gây lỗi khi đồng bộ phân mảnh CSDL (Sharding) giữa các Node chi nhánh. | 🔴 **Nghiêm trọng (Critical)** |
| **Trải nghiệm Bệnh nhân & Thương hiệu** | - 2 người cùng cầm tin nhắn xác nhận đến phòng khám lúc 09:00 AM.<br>- Một người bị buộc dời sang 10:30 hoặc phải về.<br>- Gây cãi vã, khiếu nại tại sảnh tiếp đón, đánh giá tiêu cực trên mạng xã hội, sụt giảm chỉ số tín nhiệm (CSAT/NPS). | 🔴 **Nghiêm trọng (Critical)** |
| **Vận hành & Y tế (Clinical Operations)** | - Bác sĩ bị ép khám gấp gáp để xử lý cả 2 ca, làm giảm chất lượng chẩn đoán y khoa.<br>- Thời gian chờ đợi của toàn bộ các ca khám sau trong ngày bị trễ dây chuyền (Snowball effect). | 🟡 **Cao (High)** |
| **Tài chính & Đối soát (Financial & Refund)** | - Nếu có thu tiền trước qua cổng thanh toán (Payment Gateway), cả 2 tài khoản đều bị trừ tiền.<br>- Phòng khám phải kích hoạt quy trình hoàn tiền (Refund), chịu phí giao dịch cổng thanh toán và tốn nhân sự chăm sóc khách hàng giải quyết khiếu nại. | 🟡 **Cao (High)** |

---

### 2.3. Bảng phân loại Rủi ro & Edge Cases mở rộng

| Nhóm rủi ro | Kịch bản Edge Case | Hậu quả tiềm ẩn | Đề xuất giải pháp nghiệp vụ & kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Hiệu năng (Concurrency)** | 2 hoặc nhiều bệnh nhân cùng bấm đặt slot trong cùng 1 millisecond. | Trùng lịch khám (Double Booking), xung đột dữ liệu. | **Cơ chế 2 lớp:** Distributed Lock (Redis `SET NX EX`) chặn ở cửa vào + `UNIQUE INDEX` ở CSDL làm rào chắn cuối cùng. |
| **Nghiệp vụ (Slot Hoarding)** | 1 người dùng mở nhiều trình duyệt/dùng tool tự động chọn giữ chỗ 10 slot của 5 bác sĩ khác nhau rồi bỏ rơi. | Slot bị "đóng băng", bệnh nhân thực sự không đặt được; phòng khám rỗng lịch ảo. | **Anti-Hoarding Policy:** 1 số điện thoại/tài khoản chỉ được phép giữ chỗ tối đa **1 slot** tại một thời điểm; Giới hạn tối đa **3 lần hủy/hết hạn giữ chỗ** trong vòng 24 giờ. |
| **Nghiệp vụ (Hold Session Timeout)** | Bệnh nhân đang giữ chỗ (5 phút) nhưng đến phút thứ 4 mới bắt đầu thanh toán; quá trình xác thực OTP ngân hàng mất 90 giây làm quá hạn 5 phút. | Phiên giữ chỗ bị hệ thống hủy, slot bị nhả cho người khác trong khi tiền của bệnh nhân vẫn bị ngân hàng trừ. | **Cơ chế Gia hạn Động (Dynamic Hold Extension):** Khi bệnh nhân click "Chuyển sang Cổng thanh toán", hệ thống tự động gia hạn thêm **3 phút** để hoàn tất giao dịch. |
| **Bảo mật (OWASP A01 - IDOR/Tampering)** | Bệnh nhân sửa `doctor_id` hoặc `slot_time` trong payload gửi lên API để đặt vào khung giờ không nằm trong lịch làm việc của bác sĩ. | Lịch khám lọt vào giờ nghỉ hoặc giờ bác sĩ không trực tại phòng khám. | **Server-side Whitelist Validation:** Bắt buộc kiểm tra slot gửi lên có nằm trong danh sách `available_working_schedules` hợp lệ của bác sĩ đó không. |
| **Bảo mật (OWASP A04 - Denial of Inventory)** | Kẻ xấu liên tục gửi request đặt giữ chỗ rồi không thanh toán để làm tê liệt hệ thống đặt lịch của phòng khám. | Phòng khám mất toàn bộ khách hàng trực tuyến trong ngày cao điểm. | Triển khai **Rate Limiting theo IP & Thiết bị** kết hợp xác thực mã captcha vô hình (Cloudflare Turnstile / reCAPTCHA v3) trước khi cấp Token giữ chỗ. |
| **Nghiệp vụ (Network Dropout)** | Bệnh nhân bấm đặt lịch thành công nhưng mạng điện thoại rớt, không nhận được thông báo xác nhận. | Bệnh nhân tưởng chưa được, bấm đặt lại slot khác hoặc bỏ không đến khám (No-show). | Tự động gửi **SMS / Zalo ZNS xác nhận ngay lập tức**; Lưu lịch sử tra cứu trên tài khoản để người dùng xem lại offline. |

---

### 2.4. Đề xuất 4 Trụ cột Giải pháp Nghiệp vụ Toàn diện

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          BỘ 4 TRỤ CỘT GIẢI PHÁP NGHIỆP VỤ                             │
├─────────────────────────┬──────────────────────────┬───────────────────────────────────┤
│ 1. Giữ chỗ Tạm thời     │ 2. Thông báo Hết chỗ     │ 3. Hàng đợi Chờ                   │
│    (Temporary Hold)     │    & Gợi ý Thông minh    │    (Waitlist Queue)               │
│ - Cấp vé giữ chỗ 5 phút │ - Báo lỗi 409 nhân văn   │ - Tự động ghi danh hàng chờ       │
│ - Slot đổi màu xám/vàng │ - Gợi ý ngay 2 slot gần  │ - Ưu tiên nhận thông báo SMS      │
│ - Tự nhả nếu quá hạn    │ - Chuyển slot 1-chạm     │   khi slot trước bị hủy/quá hạn   │
├─────────────────────────┴──────────────────────────┴───────────────────────────────────┤
│ 4. Kiểm soát Lạm dụng (Anti-Hoarding & Rate Limiting)                                  │
│ - Tối đa 1 slot giữ chỗ / tài khoản                                                    │
│ - Giới hạn 3 lần bỏ rơi phiên giữ chỗ / ngày                                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 💡 Trụ cột 1: Cơ chế Khóa Giữ chỗ Tạm thời (Temporary Slot Hold - Soft Reservation)
1. **Quy trình hoạt động:**
   * Khi bệnh nhân chạm vào một slot trống trên giao diện, hệ thống chưa tạo lịch hẹn chính thức mà cấp một **Phiên giữ chỗ (Hold Session)** có thời hạn đếm ngược **5 phút** ($TTL = 300$ giây).
   * Trạng thái slot chuyển từ `AVAILABLE` sang `HOLDING`.
   * Đối với tất cả người dùng khác trên toàn hệ thống, slot này lập tức chuyển sang trạng thái Disabled kèm nhãn: *"Đang có người giữ chỗ"*.
   * Giao diện bệnh nhân hiển thị đồng hồ đếm ngược: `Thời gian giữ chỗ còn lại: 04:59`.
2. **Quy tắc giải phóng tự động (Automatic Release):**
   * Nếu bệnh nhân hoàn tất form thông tin và xác nhận trong 5 phút ➔ Chuyển trạng thái sang `CONFIRMED`.
   * Nếu đồng hồ đếm ngược về `00:00` mà bệnh nhân không hoàn tất ➔ Hệ thống tự động hủy Hold Session, giải phóng slot về trạng thái `AVAILABLE` cho cộng đồng.

#### 💡 Trụ cột 2: Thông báo Hết chỗ Tức thì & Gợi ý Slot Thay thế Thông minh (Smart Fallback UI)
1. **Phản hồi nhân văn:** Người thua cuộc trong tích tắc $1$ mili-giây không phải nhận một màn hình crash vô cảm, mà nhận thông báo rõ ràng (HTTP 409 Conflict):  
   > *"Rất tiếc! Khung giờ 09:00 AM của Bác sĩ Y vừa được một bệnh nhân khác giữ chỗ trước vài tích tắc."*
2. **UX Bù đắp (UX Recovery - Gợi ý 1 chạm):** Hệ thống lập tức kích hoạt bộ gợi ý thông minh:
   * **Gợi ý A:** Khung giờ trống kế tiếp của chính Bác sĩ Y (ví dụ: *09:30 AM* hoặc *10:00 AM* cùng ngày).
   * **Gợi ý B:** Khung giờ 09:00 AM của một Bác sĩ khác có cùng chuyên khoa và chi phí khám tương đương tại phòng khám.
   * Bệnh nhân chỉ cần nhấn **"Chọn khung giờ này"**, toàn bộ thông tin bệnh nhân đã điền được chuyển thẳng sang slot mới mà **không cần nhập lại form**.

#### 💡 Trụ cột 3: Danh sách Chờ Dự phòng (Waitlist Booking)
* Trong trường hợp bệnh nhân chỉ muốn khám duy nhất Bác sĩ Y vào đúng khung giờ đó, cung cấp tùy chọn: *"Tham gia Danh sách Chờ (Waitlist)"*.
* Nếu người giữ chỗ ở Trụ cột 1 không thanh toán hoặc hủy hẹn, người đứng đầu danh sách Waitlist sẽ nhận được thông báo Zalo/SMS kèm đường dẫn kích hoạt quyền ưu tiên đặt lịch trong vòng **3 phút**.

#### 💡 Trụ cột 4: Cơ chế Kiểm soát Lạm dụng (Anti-Hoarding & Fair-Use Policy)
* **Giới hạn số lượng giữ chỗ:** Mỗi số điện thoại/CCCD chỉ được phép có duy nhất **1 phiên giữ chỗ đang hoạt động (Active Hold)** trên toàn hệ thống.
* **Hình phạt vi phạm (Penalty):** Nếu một tài khoản để hết hạn phiên giữ chỗ quá 3 lần liên tiếp trong vòng 24 giờ mà không đặt, hệ thống sẽ tạm khóa quyền đặt lịch trực tuyến của tài khoản đó trong 6 giờ để chống spam.

---

## 3. BỘ USER STORIES THEO ĐỊNH DẠNG GHERKIN

```gherkin
Feature: Quản lý Đặt lịch Khám bệnh và Kiểm soát Đồng thời Chống Trùng lịch
  Là một Bệnh nhân có nhu cầu khám chữa bệnh,
  Tôi muốn chọn giờ khám chính xác và được đảm bảo slot không bị người khác tranh chấp trong lúc điền thông tin,
  Để tôi có thể an tâm hoàn tất quy trình đặt khám mà không gặp sự cố trùng lịch.
```

### Scenario 1: Giữ chỗ thành công và xác nhận lịch hẹn (Happy Path)
```gherkin
Scenario: Bệnh nhân chọn slot trống, giữ chỗ thành công và xác nhận đặt lịch
  Given Slot khám "09:00 AM ngày 02/11/2026" của Bác sĩ "Trần Văn Y" đang ở trạng thái "AVAILABLE"
  When Bệnh nhân "Nguyễn Văn A" nhấn chọn slot "09:00 AM"
  Then Hệ thống kích hoạt phiên giữ chỗ "HOLDING" có thời hạn 300 giây cho Bệnh nhân "Nguyễn Văn A"
  And Giao diện của Bệnh nhân "Nguyễn Văn A" hiển thị đồng hồ đếm ngược từ 05:00
  And Giao diện của các bệnh nhân khác hiển thị slot này ở trạng thái "Đang có người giữ chỗ" và không thể click
  When Bệnh nhân "Nguyễn Văn A" điền đầy đủ thông tin bệnh án và nhấn "Xác nhận đặt lịch" trong vòng 180 giây
  Then Hệ thống chuyển trạng thái lịch hẹn thành "CONFIRMED"
  And Hệ thống gửi tin nhắn SMS và Email xác nhận mã lịch hẹn thành công cho Bệnh nhân "Nguyễn Văn A"
```

### Scenario 2: Tranh chấp cùng 1 mili-giây giữa 2 bệnh nhân (Race Condition Edge Case)
```gherkin
Scenario: Hai bệnh nhân cùng gửi yêu cầu giữ chỗ cho 1 slot vào cùng 1 mili-giây
  Given Slot khám "09:00 AM ngày 02/11/2026" của Bác sĩ "Trần Văn Y" đang ở trạng thái "AVAILABLE"
  When Bệnh nhân "A" và Bệnh nhân "B" cùng gửi yêu cầu giữ chỗ tại thời điểm "09:00:00.125"
  Then Cơ chế Khóa Phân tán (Distributed Lock) chỉ chấp thuận yêu cầu đầu tiên chạm tới hệ thống của Bệnh nhân "A"
  And Phiên giữ chỗ slot "09:00 AM" được cấp thành công cho Bệnh nhân "A" với trạng thái "HOLDING"
  And Yêu cầu của Bệnh nhân "B" bị từ chối với mã phản hồi HTTP 409 Conflict
  And Giao diện Bệnh nhân "B" hiển thị cảnh báo: "Khung giờ 09:00 AM vừa có người giữ chỗ trước bạn vài tích tắc"
  And Giao diện Bệnh nhân "B" hiển thị ngay danh sách 2 khung giờ trống gợi ý gần nhất
```

### Scenario 3: Quá hạn giữ chỗ và tự động giải phóng slot (Hold Timeout Edge Case)
```gherkin
Scenario: Bệnh nhân giữ chỗ nhưng không hoàn tất thao tác trước khi hết thời gian TTL
  Given Bệnh nhân "A" đang giữ chỗ slot "09:00 AM" với thời gian còn lại là "00:01" giây
  When Đồng hồ đếm ngược chạm mốc "00:00" mà Bệnh nhân "A" chưa nhấn nút xác nhận
  Then Hệ thống tự động hủy phiên giữ chỗ của Bệnh nhân "A"
  And Hệ thống cập nhật trạng thái slot "09:00 AM" trở về "AVAILABLE" trên toàn hệ thống
  And Giao diện Bệnh nhân "A" hiển thị thông báo: "Phiên giữ chỗ của bạn đã hết hạn, vui lòng chọn lại khung giờ"
  And Các bệnh nhân khác trên hệ thống lập tức nhìn thấy slot "09:00 AM" sáng lại và có thể đặt bình thường
```

### Scenario Outline: Xử lý các tình huống biên ngoại lệ khi đặt lịch
```gherkin
Scenario Outline: Hệ thống xử lý các trường hợp biên đặc biệt khi gửi yêu cầu đặt lịch
  Given Bệnh nhân gửi yêu cầu đặt lịch với thông tin <scenario_condition>
  When Tầng nghiệp vụ BookingService tiếp nhận và xác thực dữ liệu
  Then Hệ thống từ chối yêu cầu với mã trạng thái HTTP <http_status>
  And Giao diện hiển thị thông báo lỗi <error_message>

  Examples:
    | scenario_condition                                    | http_status | error_message                                                         |
    | Slot khám thuộc về ngày trong quá khứ                 | 400         | "Không thể đặt lịch khám cho thời gian trong quá khứ"                 |
    | Bác sĩ có lịch nghỉ phép đột xuất đã duyệt            | 409         | "Bác sĩ có lịch bận đột xuất, vui lòng chọn bác sĩ hoặc ngày khám khác"|
    | Tài khoản đang có 1 phiên giữ chỗ chưa hoàn tất       | 429         | "Bạn đang có 1 phiên giữ chỗ khác. Vui lòng hoàn tất hoặc hủy trước"   |
    | Bệnh nhân cố tình gửi trùng request (Double Click)    | 409         | "Yêu cầu của bạn đang được xử lý, vui lòng không nhấn liên tục"       |
    | Slot khám vừa bị Admin khóa để bảo trì phòng khám    | 423         | "Khung giờ này đang tạm ngưng tiếp nhận để bảo trì thiết bị"          |
```

---

## 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA - AC) & DEFINITION OF DONE

### 4.1. Tiêu chí Nghiệm thu Chức năng (Functional AC)
* [ ] **AC-01 (Lock Granularity):** Khóa giữ chỗ phải được thiết lập theo bộ ba định danh duy nhất: `{clinic_id}:{doctor_id}:{slot_time}`. Việc khóa slot của Bác sĩ Y không bao giờ được gây ảnh hưởng đến slot cùng giờ của Bác sĩ khác.
* [ ] **AC-02 (Atomic Operation):** Thao tác kiểm tra trạng thái và cấp lock phải là thao tác nguyên tử (Atomic operation). Tỷ lệ trùng lịch khám (*Double Booking Rate*) trong mọi bài kiểm thử tải đồng thời phải bằng tuyệt đối **$0\%$**.
* [ ] **AC-03 (Accurate TTL):** Thời gian giữ chỗ mặc định là $300$ giây ($\pm 1$ giây). Hệ thống phải tự động thu hồi lock chính xác ngay khi hết TTL mà không cần can thiệp thủ công.
* [ ] **AC-04 (Fallback Recommendation):** Khi nhận mã lỗi 409 Conflict, giao diện client bắt buộc phải hiển thị ít nhất 1 slot gợi ý trống gần nhất của bác sĩ đó hoặc bác sĩ cùng khoa.
* [ ] **AC-05 (Fair-Use Enforcement):** Mỗi bệnh nhân chỉ được giữ tối đa 1 slot đang chờ thanh toán; chặn thao tác giữ chỗ thứ 2 và thông báo hướng dẫn rõ ràng.

### 4.2. Tiêu chí Phi chức năng (Non-Functional Requirements - NFR)
* [ ] **NFR-01 (Performance & Latency):** Thời gian phản hồi API giữ chỗ (`POST /api/appointments/hold`) phải đạt $P95 < 150\text{ ms}$ và $P99 < 300\text{ ms}$ dưới tải 500 yêu cầu đồng thời/giây.
* [ ] **NFR-02 (High Availability):** Nếu Redis/Distributed Lock gặp sự cố gián đoạn kết nối, hệ thống phải tự động fallback về cơ chế khóa Database Transaction (`SELECT ... FOR UPDATE` hoặc `UNIQUE INDEX constraint`), đảm bảo không có bất kỳ bản ghi trùng lịch nào lọt vào CSDL.
* [ ] **NFR-03 (Real-time Broadcast):** Trạng thái thay đổi của slot (từ `AVAILABLE` sang `HOLDING` hoặc ngược lại) phải được phát quảng bá tới các Client đang xem lịch trong vòng không quá **$500\text{ ms}$** (qua SSE hoặc WebSocket).

### 4.3. Định nghĩa Hoàn thành (Definition of Done - DoD cho Đội ngũ Phát triển)
1. Tài liệu phân tích nghiệp vụ này được PO/BA và Software Architect phê duyệt.
2. Sơ đồ tuần tự [sequence.mermaid](file:///c:/xampp1/htdocs/ClinicManagement/sequence.mermaid) và mô hình CSDL [erd.mermaid](file:///c:/xampp1/htdocs/ClinicManagement/erd.mermaid) được cập nhật đồng bộ.
3. Bộ Unit Test và Integration Test kiểm thử tranh chấp đồng thời (Concurrency Test bằng k*100 requests đồng thời) được viết và vượt qua $100\%$.
4. API có đầy đủ tài liệu đặc tả OpenAPI/Swagger bao gồm mã lỗi `201 Created`, `400 Bad Request`, `409 Conflict`, `429 Too Many Requests`.
5. Frontend triển khai đầy đủ 3 trạng thái giao diện: *Loading (Skeleton), Error (Smart Fallback UI với Toast thông báo), Success (Thẻ khám xác nhận)*.

