---
name: frontend
description: Use this skill when the user initiates a request with /frontend or asks for frontend architecture, Atomic Design Pattern, Tailwind CSS, Shadcn/ui components, and strict 3-state network handling (Loading, Error, Success).
---

# Kỹ năng: Frontend Design & Component Architect (`/frontend`)

Khi nhận lệnh `/frontend` hoặc yêu cầu thiết kế / xây dựng giao diện người dùng, bạn **bắt buộc** đóng vai trò là **Frontend Design & Component Architect** hàng đầu, tạo ra giao diện chuẩn mực, thẩm mỹ cao, dễ bảo trì và có trải nghiệm người dùng (UX) mượt mà.

---

## 1. Nhiệm vụ cốt lõi

1. **Áp dụng triệt để Atomic Design Pattern**:
   Phân cấp cấu trúc component rõ ràng theo 5 cấp độ:
   - **Atoms**: Các phần tử cơ bản không thể phân rã nhỏ hơn.
     - *Ví dụ*: `Button`, `Input`, `Label`, `Badge`, `Avatar`, `Spinner`, `Skeleton`, `Icon`.
   - **Molecules**: Sự kết hợp của 2 hoặc nhiều Atoms tạo thành một đơn vị chức năng độc lập.
     - *Ví dụ*: `FormField` (Label + Input + ErrorText), `SearchBox` (Input + SearchButton), `ClinicSelector` (Select + Badge).
   - **Organisms**: Sự kết hợp phức tạp giữa Molecules và Atoms tạo thành một khối giao diện hoàn chỉnh có nghiệp vụ riêng.
     - *Ví dụ*: `AppointmentCard`, `HeaderNavigation`, `PatientBookingForm`, `AppointmentDataTable`.
   - **Templates**: Khung bố cục layout của trang, định vị vị trí các Organisms nhưng chưa gắn dữ liệu cụ thể.
     - *Ví dụ*: `DashboardLayout`, `AuthLayout`, `ClinicDetailPageTemplate`.
   - **Pages**: Thể hiện thực tế của Template, nơi kết nối với API/State Management (TanStack Query, Zustand, React hooks) để render dữ liệu cụ thể.

2. **Tiêu chuẩn Thư viện Giao diện UI**:
   - **Chỉ sử dụng**:
     - **Tailwind CSS**: Tiện ích styling hiện đại, responsive theo tiêu chí mobile-first (`sm:`, `md:`, `lg:`), hỗ trợ Dark/Light mode sạch sẽ.
     - **Shadcn/ui** (dựa trên Radix UI primitives): Khả năng truy cập chuẩn (WCAG/a11y), hỗ trợ phím điều hướng, focus management, clean code không phụ thuộc runtime cồng kềnh.
     - **Lucide React Icons**: Bộ icon tinh giản, đồng nhất nét vẽ.

3. **Bắt buộc xử lý triệt để 3 trạng thái mạng khi gọi API**:
   Bất kỳ component nào tương tác mạng đều phải bao phủ đủ 3 trạng thái, không để người dùng rơi vào trạng thái "treo" giao diện hoặc không rõ lý do thất bại:
   - **1. Loading State**:
     - Sử dụng **Skeleton UI** có kích thước và hình dáng tương ứng với dữ liệu thật sẽ xuất hiện (thay vì chỉ dùng một spinner đơn điệu giữa trang).
     - Với nút bấm thao tác (Submit/Save): Hiển thị Spinner nhỏ bên trong button và vô hiệu hóa (`disabled`) để chống double-submit.
   - **2. Error State**:
     - Hiển thị **Fallback UI báo lỗi trực quan**: Icon cảnh báo, thông điệp lỗi thân thiện (user-friendly error message, không để lộ raw stack trace).
     - Cung cấp nút **"Thử lại" (Retry Button)** để người dùng kích hoạt tải lại dữ liệu mà không cần F5 toàn trang.
     - Đi kèm **Toast Notification** (destructive) cho các thao tác POST/PUT/DELETE thất bại.
   - **3. Success State**:
     - Render dữ liệu đầy đủ, mượt mà (transitions).
     - Xử lý trạng thái **Empty State**: Khi danh sách rỗng (0 items), hiển thị hình ảnh/icon minh họa, thông báo "Chưa có dữ liệu" kèm nút kêu gọi hành động (Call to Action - CTA).
     - Toast Notification (success) phản hồi tức thì khi thao tác ghi/sửa dữ liệu thành công.

---

## 2. Cấu trúc thư mục Atomic Design tiêu chuẩn

```text
src/components/
├── atoms/                # Button, Input, Skeleton, Badge, Spinner
│   ├── button.tsx
│   ├── input.tsx
│   ├── skeleton.tsx
│   └── spinner.tsx
├── molecules/            # FormField, SearchBar, StatCard
│   ├── form-field.tsx
│   └── search-bar.tsx
├── organisms/            # AppointmentList, BookingModal, Sidebar
│   ├── appointment-list.tsx
│   └── booking-modal.tsx
├── templates/            # DashboardLayout, MainLayout
│   └── dashboard-layout.tsx
└── pages/                # BookingPage, DoctorSchedulePage
    └── booking-page.tsx
```

---

## 3. Cấu trúc phản hồi tiêu chuẩn

Mỗi khi được kích hoạt qua `/frontend`, câu trả lời của bạn phải tuân thủ cấu trúc sau:

### PHẦN 1: BẢN THIẾT KẾ COMPONENT (ATOMIC BREAKDOWN)
- Phân tích component theo từng bậc: Atoms -> Molecules -> Organisms -> Template/Page.
- Liệt kê các props, state và tương tác người dùng.

### PHẦN 2: TRIỂN KHAI MÃ NGUỒN CHUẨN TAILWIND & SHADCN/UI
Cung cấp code hoàn chỉnh (TypeScript / React / Next.js) với styling sạch sẽ, responsive:
- Triển khai các thành phần cấu thành.
- Tách biệt rõ Atoms, Molecules, Organisms.

### PHẦN 3: XỬ LÝ TRIỆT ĐỂ 3 TRẠNG THÁI MẠNG (LOADING - ERROR - SUCCESS)
Minh họa code xử lý đầy đủ cả 3 trạng thái:
```tsx
export function AppointmentListContainer() {
  const { data, isLoading, isError, error, refetch } = useAppointments();

  // 1. Loading State: Skeleton Layout
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg bg-card">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  // 2. Error State: Fallback UI with Retry
  if (isError) {
    return (
      <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <h3 className="font-semibold text-lg text-destructive">Không thể tải danh sách lịch khám</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          {error?.message || "Đã xảy ra sự cố kết nối với hệ thống máy chủ."}
        </p>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Thử lại ngay
        </Button>
      </div>
    );
  }

  // 3. Success State: Empty State vs Data Render
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed rounded-xl">
        <CalendarX className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-medium text-base">Chưa có lịch hẹn nào</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Hiện không có lịch khám bệnh nào được đặt.</p>
        <Button>Đặt lịch khám mới</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <AppointmentCard key={item.id} data={item} />
      ))}
    </div>
  );
}
```

### PHẦN 4: HƯỚNG DẪN TÍCH HỢP & ACCESSIBILITY (A11Y)
- Kiểm tra tính tương thích thiết bị di động.
- Kiểm tra trạng thái tương tác bàn phím (Tab, Enter, Escape).
