/**
 * ========================================================
 * Appointments Management & Concurrency Control UI Logic
 * Phân hệ Đặt lịch khám bệnh - Thành viên 3
 * ========================================================
 */

// Danh sách Bác sĩ tương ứng theo từng Node Chi nhánh CSDL (Sharding)
const CLINIC_DOCTORS = {
  1: [
    { id: 1, name: 'BS. CKI Nguyễn Văn A', specialty: 'Khoa Tim Mạch' },
    { id: 2, name: 'BS. CKII Lê Thị B', specialty: 'Khoa Nhi' }
  ],
  2: [
    { id: 3, name: 'ThS.BS Trần Văn C', specialty: 'Khoa Cơ Xương Khớp' },
    { id: 4, name: 'BS. CKI Phạm Thị D', specialty: 'Khoa Nội Tổng Quát' }
  ]
};

// Khung giờ khám chuẩn giờ hành chính (Bội số 30 phút)
const MORNING_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];
const AFTERNOON_SLOTS = ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

// Trạng thái ứng dụng Frontend
let state = {
  clinicId: 1,
  doctorId: 1,
  bookingDate: '',
  selectedSlot: null,
  patientId: 101,
  bookedSlots: new Set(),
  isSubmitting: false,
  isLoadingAppointments: false
};

// Khởi tạo icons Lucide
function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ========================================================
// 1. ALERT BANNER SYSTEM (Thông báo trạng thái động)
// ========================================================
function showAlert(type, title, message) {
  const banner = document.getElementById('alert-banner');
  const titleEl = document.getElementById('alert-title');
  const msgEl = document.getElementById('alert-message');
  const iconEl = document.getElementById('alert-icon');

  banner.className = `alert-banner mb-6 ${type === 'success' ? 'alert-success' : 'alert-danger'}`;
  titleEl.innerText = title;
  msgEl.innerText = message;

  if (type === 'success') {
    iconEl.innerHTML = `<i data-lucide="check-circle-2" class="w-6 h-6 text-emerald-600 shrink-0"></i>`;
  } else {
    iconEl.innerHTML = `<i data-lucide="alert-octagon" class="w-6 h-6 text-red-600 shrink-0"></i>`;
  }

  banner.classList.remove('hidden');
  refreshIcons();

  // Tự cuộn nhẹ lên thông báo
  banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeAlert() {
  const banner = document.getElementById('alert-banner');
  banner.classList.add('hidden');
}

// ========================================================
// 2. KHỞI TẠO BỘ CHỌN NGÀY VÀ BÁC SĨ THEO CƠ SỞ
// ========================================================
function initDateInput() {
  const dateInput = document.getElementById('booking-date');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Định dạng YYYY-MM-DD
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const defaultDate = `${yyyy}-${mm}-${dd}`;

  dateInput.min = defaultDate;
  dateInput.value = defaultDate;
  state.bookingDate = defaultDate;
}

function updateDoctorOptions() {
  const doctorSelect = document.getElementById('doctor-select');
  const doctors = CLINIC_DOCTORS[state.clinicId] || [];

  doctorSelect.innerHTML = doctors
    .map((doc) => `<option value="${doc.id}">${doc.name} - ${doc.specialty}</option>`)
    .join('');

  if (doctors.length > 0) {
    state.doctorId = doctors[0].id;
    doctorSelect.value = state.doctorId;
  }
}

// ========================================================
// 3. TẠO LƯỚI KHUNG GIỜ KHÁM (INTERACTIVE TIME SLOTS GRID)
// ========================================================
function renderTimeSlots() {
  const morningContainer = document.getElementById('morning-slots-grid');
  const afternoonContainer = document.getElementById('afternoon-slots-grid');

  morningContainer.innerHTML = MORNING_SLOTS.map((time) => createSlotButtonHtml(time)).join('');
  afternoonContainer.innerHTML = AFTERNOON_SLOTS.map((time) => createSlotButtonHtml(time)).join('');
}

function createSlotButtonHtml(time) {
  const isBooked = state.bookedSlots.has(time);
  const isSelected = state.selectedSlot === time;
  const classes = ['slot-btn'];

  if (isSelected) classes.push('selected');
  if (isBooked) classes.push('booked');

  return `
    <button
      type="button"
      data-slot="${time}"
      class="${classes.join(' ')}"
      ${isBooked ? 'disabled' : ''}
      onclick="handleSlotSelect('${time}')"
    >
      <i data-lucide="clock" class="w-3.5 h-3.5 opacity-70"></i>
      <span>${time}</span>
    </button>
  `;
}

function handleSlotSelect(time) {
  if (state.bookedSlots.has(time) || state.isSubmitting) return;

  state.selectedSlot = time;

  // Cập nhật giao diện nút slot
  document.querySelectorAll('.slot-btn').forEach((btn) => {
    const slotTime = btn.getAttribute('data-slot');
    if (slotTime === time) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });

  // Cập nhật preview và mở khóa nút Submit
  const preview = document.getElementById('selected-slot-preview');
  const submitBtn = document.getElementById('btn-submit-booking');

  preview.innerHTML = `
    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
      <i data-lucide="calendar-check" class="w-3.5 h-3.5"></i>
      ${state.bookingDate} vào lúc ${time}
    </span>
  `;
  submitBtn.disabled = false;
  refreshIcons();
}

// ========================================================
// 4. GỌI API TRA CỨU SLOT ĐÃ ĐẶT VÀ CẬP NHẬT TRẠNG THÁI
// ========================================================
async function loadDoctorBookedSlots() {
  state.bookedSlots.clear();

  try {
    const url = `/api/v1/appointments?clinic_id=${state.clinicId}&date=${state.bookingDate}&doctor_id=${state.doctorId}&limit=50`;
    const res = await fetch(url);
    const data = await res.json();

    if (res.ok && data.data) {
      data.data.forEach((apt) => {
        if (apt.status !== 'Cancelled' && apt.slot_time) {
          // Trích xuất HH:mm từ slot_time
          const match = apt.slot_time.match(/(?:T|\s)(\d{2}:\d{2})/);
          if (match) {
            state.bookedSlots.add(match[1]);
          }
        }
      });
    }
  } catch (err) {
    console.warn('Lỗi khi tải danh sách slot đã đặt:', err);
  }

  // Nếu slot đang chọn đã bị người khác đặt -> Bỏ chọn
  if (state.selectedSlot && state.bookedSlots.has(state.selectedSlot)) {
    state.selectedSlot = null;
    document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
    document.getElementById('btn-submit-booking').disabled = true;
  }

  renderTimeSlots();
  refreshIcons();
}

// ========================================================
// 5. GỬI REQUEST ĐẶT LỊCH (XỬ LÝ ĐẶC TRỊ RACE CONDITION)
// ========================================================
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!state.selectedSlot) {
    showAlert('danger', 'Chưa chọn giờ', 'Vui lòng chọn một khung giờ khám còn trống trong danh sách!');
    return;
  }

  const patientIdInput = document.getElementById('patient-id-input');
  const patientId = Number(patientIdInput.value);

  if (!patientId || patientId <= 0) {
    showAlert('danger', 'Mã bệnh nhân không hợp lệ', 'Vui lòng nhập mã ID bệnh nhân hợp lệ (số nguyên dương)!');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-booking');
  state.isSubmitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <i data-lucide="loader" class="w-4 h-4 animate-spin"></i>
    <span>Đang khóa slot & ghi vào CSDL...</span>
  `;
  refreshIcons();

  const payload = {
    patient_id: patientId,
    doctor_id: Number(state.doctorId),
    clinic_id: Number(state.clinicId),
    slot_time: `${state.bookingDate}T${state.selectedSlot}:00`
  };

  try {
    const res = await fetch('/api/v1/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    // ----------------------------------------------------
    // TRƯỜNG HỢP 1: THÀNH CÔNG (201 CREATED)
    // ----------------------------------------------------
    if (res.status === 201) {
      const apt = result.data;
      showAlert(
        'success',
        'Đặt Lịch Khám Thành Công!',
        `Mã lịch hẹn: #${apt.appointment_id} | Bác sĩ: ${apt.doctor_name || state.doctorId} | Thời gian: ${apt.slot_time}`
      );

      // Đánh dấu slot vừa đặt thành booked
      state.bookedSlots.add(state.selectedSlot);
      state.selectedSlot = null;
      document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
      submitBtn.disabled = true;

      renderTimeSlots();
      fetchAppointmentList();
      return;
    }

    // ----------------------------------------------------
    // TRƯỜNG HỢP 2: XUNG ĐỘT RACE CONDITION (409 CONFLICT)
    // ----------------------------------------------------
    if (res.status === 409) {
      showAlert(
        'danger',
        'Xung Đột Đặt Lịch (409 Conflict)',
        result.message || 'Khung giờ này của bác sĩ vừa được một người khác hoàn tất đặt trước! Vui lòng chọn giờ khác.'
      );

      // Kích hoạt Fallback UI: Chuyển nút slot sang trạng thái conflict
      const conflictBtn = document.querySelector(`.slot-btn[data-slot="${state.selectedSlot}"]`);
      if (conflictBtn) {
        conflictBtn.classList.remove('selected');
        conflictBtn.classList.add('conflict');
        conflictBtn.disabled = true;
      }

      state.bookedSlots.add(state.selectedSlot);
      state.selectedSlot = null;
      document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
      submitBtn.disabled = true;

      // Tự động đồng bộ lại toàn bộ trạng thái CSDL
      setTimeout(() => {
        loadDoctorBookedSlots();
        fetchAppointmentList();
      }, 800);
      return;
    }

    // ----------------------------------------------------
    // TRƯỜNG HỢP 3: CÁC LỖI KHÁC (400, 404, 500)
    // ----------------------------------------------------
    throw new Error(result.message || `Lỗi máy chủ: HTTP ${res.status}`);

  } catch (err) {
    showAlert('danger', 'Không thể hoàn tất đặt lịch', err.message);
  } finally {
    state.isSubmitting = false;
    submitBtn.innerHTML = `
      <i data-lucide="calendar-plus" class="w-4 h-4"></i>
      <span>Xác Nhận Đặt Lịch</span>
    `;
    if (!state.selectedSlot) {
      submitBtn.disabled = true;
    }
    refreshIcons();
  }
}

// ========================================================
// 6. RENDER BẢNG DANH SÁCH LỊCH HẸN (3 TRẠNG THÁI MẠNG)
// ========================================================
async function fetchAppointmentList() {
  const tbody = document.getElementById('appointments-table-body');
  const countBadge = document.getElementById('total-appointments-badge');

  // TRẠNG THÁI 1: LOADING SKELETON
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="p-6">
        <div class="space-y-3 animate-pulse">
          <div class="h-4 bg-slate-200 rounded w-full"></div>
          <div class="h-4 bg-slate-100 rounded w-5/6"></div>
          <div class="h-4 bg-slate-200 rounded w-4/6"></div>
        </div>
      </td>
    </tr>
  `;

  try {
    const url = `/api/v1/appointments?clinic_id=${state.clinicId}&date=${state.bookingDate}&limit=50`;
    const res = await fetch(url);
    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.message || `Lỗi HTTP ${res.status}`);
    }

    const appointments = result.data || [];
    countBadge.innerText = appointments.length;

    // TRẠNG THÁI 2: SUCCESS EMPTY STATE
    if (appointments.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400">
            <div class="flex flex-col items-center justify-center space-y-2">
              <i data-lucide="calendar-x-2" class="w-8 h-8 text-slate-300"></i>
              <p class="font-medium text-slate-600 text-sm">Chưa có lịch hẹn nào</p>
              <p class="text-xs text-slate-400">Chưa có ca khám nào được đặt vào ngày ${state.bookingDate} tại cơ sở này.</p>
            </div>
          </td>
        </tr>
      `;
      refreshIcons();
      return;
    }

    // TRẠNG THÁI 3: SUCCESS DATA RENDER
    tbody.innerHTML = appointments
      .map((item) => {
        const timeStr = item.slot_time ? item.slot_time.replace('T', ' ').slice(11, 16) : '--:--';
        const isConfirmed = item.status === 'Confirmed';
        return `
          <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="px-3.5 py-3 font-mono font-bold text-xs text-slate-500">#${item.appointment_id}</td>
            <td class="px-3.5 py-3">
              <div class="font-semibold text-slate-800 text-xs">${item.patient_name || `Mã BN #${item.patient_id}`}</div>
              ${item.patient_phone ? `<div class="text-[11px] text-slate-400 font-mono">${item.patient_phone}</div>` : ''}
            </td>
            <td class="px-3.5 py-3">
              <div class="font-medium text-slate-700 text-xs">${item.doctor_name || `Bác sĩ #${item.doctor_id}`}</div>
              <div class="text-[11px] text-blue-600">${item.doctor_specialty || ''}</div>
            </td>
            <td class="px-3.5 py-3 font-mono font-bold text-xs text-slate-700">${timeStr}</td>
            <td class="px-3.5 py-3 text-right">
              <span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                isConfirmed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }">
                ${item.status}
              </span>
            </td>
          </tr>
        `;
      })
      .join('');

    refreshIcons();
  } catch (err) {
    // TRẠNG THÁI 4: ERROR FALLBACK UI
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center text-red-600 bg-red-50/50">
          <div class="flex flex-col items-center justify-center space-y-2">
            <i data-lucide="alert-triangle" class="w-7 h-7 text-red-500"></i>
            <p class="font-bold text-xs">Không thể tải danh sách lịch khám</p>
            <p class="text-[11px] text-red-500 max-w-xs">${err.message}</p>
            <button onclick="fetchAppointmentList()" class="mt-2 px-3 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-700 rounded-md text-xs font-semibold shadow-sm">
              Thử lại ngay
            </button>
          </div>
        </td>
      </tr>
    `;
    refreshIcons();
  }
}

// ========================================================
// 7. EVENT LISTENERS & KHỞI TẠO
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  initDateInput();
  updateDoctorOptions();
  renderTimeSlots();
  loadDoctorBookedSlots();
  fetchAppointmentList();
  refreshIcons();

  // Khi đổi cơ sở khám bệnh
  document.getElementById('clinic-select').addEventListener('change', (e) => {
    state.clinicId = Number(e.target.value);
    state.selectedSlot = null;
    document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
    document.getElementById('btn-submit-booking').disabled = true;

    updateDoctorOptions();
    loadDoctorBookedSlots();
    fetchAppointmentList();
  });

  // Khi đổi bác sĩ
  document.getElementById('doctor-select').addEventListener('change', (e) => {
    state.doctorId = Number(e.target.value);
    state.selectedSlot = null;
    document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
    document.getElementById('btn-submit-booking').disabled = true;

    loadDoctorBookedSlots();
  });

  // Khi đổi ngày khám
  document.getElementById('booking-date').addEventListener('change', (e) => {
    state.bookingDate = e.target.value;
    state.selectedSlot = null;
    document.getElementById('selected-slot-preview').innerText = 'Chưa chọn khung giờ nào';
    document.getElementById('btn-submit-booking').disabled = true;

    loadDoctorBookedSlots();
    fetchAppointmentList();
  });

  // Form Submit
  document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
});
