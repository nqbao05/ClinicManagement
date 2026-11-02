/**
 * ========================================================
 * Appointments Management & Booking UI Logic
 * Phân hệ Đặt lịch & Tiếp đón Bệnh nhân (ClinicCare)
 * ========================================================
 */

// Hàm định dạng giờ slot an toàn chống lệch Timezone UTC/Local
function extractSlotTimeHHMM(slotTimeStr) {
  if (!slotTimeStr) return null;
  const str = String(slotTimeStr);
  if (str.includes('Z')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
  }
  const match = str.match(/(?:T|\s)(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

// Khung giờ khám chuẩn giờ hành chính (Bội số 30 phút)
const MORNING_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00'];
const AFTERNOON_SLOTS = ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

// Trạng thái ứng dụng Frontend
let state = {
  clinicId: 1,
  doctorId: null,
  doctorsList: [],
  bookingDate: '',
  selectedSlot: null,
  patientId: null,
  citizenId: '',
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
// 1. ALERT BANNER SYSTEM
// ========================================================
function showAlert(type, title, message) {
  const banner = document.getElementById('alert-banner');
  const titleEl = document.getElementById('alert-title');
  const msgEl = document.getElementById('alert-message');
  const iconEl = document.getElementById('alert-icon');

  if (!banner || !titleEl || !msgEl || !iconEl) return;

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
}

function closeAlert() {
  const banner = document.getElementById('alert-banner');
  if (banner) banner.classList.add('hidden');
}

// ========================================================
// 2. TẢI DANH SÁCH BÁC SĨ TỪ API
// ========================================================
async function fetchDoctors() {
  const select = document.getElementById('doctor-select');
  if (!select) return;

  try {
    const res = await fetch('/api/v1/doctors?status=active', {
      headers: {
        'Accept': 'application/json',
        ...(window.Auth && Auth.getAuthHeader ? Auth.getAuthHeader() : {})
      }
    });
    const result = await res.json();
    const doctors = result.data || result || [];
    state.doctorsList = doctors;

    select.innerHTML = '';
    if (doctors.length === 0) {
      select.innerHTML = '<option value="">Không có bác sĩ khả dụng</option>';
      return;
    }

    doctors.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = d.id || d.doctor_id;
      opt.textContent = `${d.full_name} (${d.specialty})`;
      if (idx === 0) {
        opt.selected = true;
        state.doctorId = Number(opt.value);
      }
      select.appendChild(opt);
    });

    if (state.doctorId) {
      loadDoctorBookedSlots();
    }
  } catch (err) {
    console.error('Lỗi khi tải bác sĩ:', err);
    select.innerHTML = '<option value="">Lỗi nạp danh sách bác sĩ</option>';
  }
}

// ========================================================
// 3. TỰ ĐỘNG TRA CỨU HỒ SƠ QUA SỐ CCCD
// ========================================================
let cccdDebounceTimer = null;
function setupCccdLookup() {
  const cccdInput = document.getElementById('patient-cccd-input');
  const spinner = document.getElementById('cccd-lookup-spinner');
  const nameInput = document.getElementById('patient-name-input');
  const phoneInput = document.getElementById('patient-phone-input');
  const idInput = document.getElementById('patient-id-input');
  const hint = document.getElementById('cccd-status-hint');

  if (!cccdInput) return;

  cccdInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearTimeout(cccdDebounceTimer);

    if (val.length !== 12) {
      if (hint) hint.textContent = 'Vui lòng nhập đủ 12 số CCCD.';
      return;
    }

    if (spinner) spinner.classList.remove('hidden');
    if (hint) hint.textContent = 'Đang tra cứu dữ liệu bệnh nhân...';

    cccdDebounceTimer = setTimeout(async () => {
      try {
        const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
        const res = await fetch(`/api/v1/patients/by-cccd/${val}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const json = await res.json();

        if (res.ok && json.data) {
          const p = json.data;
          state.patientId = p.id || p.patient_id;
          if (idInput) idInput.value = `BN-${String(state.patientId).padStart(4, '0')}`;
          if (nameInput) nameInput.value = p.full_name || '';
          if (phoneInput) phoneInput.value = p.phone_number || '';
          if (hint) hint.innerHTML = `<span class="text-emerald-700 font-semibold">✓ Đã tìm thấy hồ sơ bệnh nhân: <strong>${p.full_name}</strong></span>`;
        } else {
          state.patientId = null;
          if (idInput) idInput.value = 'Hồ sơ mới (Sẽ tự tạo)';
          if (hint) hint.innerHTML = `<span class="text-blue-700">Hồ sơ CCCD mới. Vui lòng nhập Họ tên và SĐT để hệ thống đăng ký tiếp đón.</span>`;
        }
      } catch (err) {
        if (hint) hint.textContent = 'Không thể tra cứu CCCD trực tuyến.';
      } finally {
        if (spinner) spinner.classList.add('hidden');
      }
    }, 400);
  });
}

// ========================================================
// 4. BỘ CHỌN KHUNG GIỜ KHÁM (SLOT GRID)
// ========================================================
function renderSlotButton(slot) {
  const isBooked = state.bookedSlots.has(slot);
  const isSelected = state.selectedSlot === slot;

  let btnClass = 'slot-btn p-2.5 text-xs font-semibold rounded-xl border transition-all text-center ';
  if (isBooked) {
    btnClass += 'bg-slate-100 text-slate-400 border-slate-200 line-through cursor-not-allowed';
  } else if (isSelected) {
    btnClass += 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300';
  } else {
    btnClass += 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700';
  }

  return `
    <button
      type="button"
      ${isBooked ? 'disabled' : ''}
      onclick="selectSlot('${slot}')"
      class="${btnClass}"
    >
      ${slot}
    </button>
  `;
}

function renderSlots() {
  const morningContainer = document.getElementById('morning-slots-grid');
  const afternoonContainer = document.getElementById('afternoon-slots-grid');
  const submitBtn = document.getElementById('btn-submit-booking');
  const preview = document.getElementById('selected-slot-preview');

  if (morningContainer) {
    morningContainer.innerHTML = MORNING_SLOTS.map(renderSlotButton).join('');
  }
  if (afternoonContainer) {
    afternoonContainer.innerHTML = AFTERNOON_SLOTS.map(renderSlotButton).join('');
  }

  if (state.selectedSlot) {
    if (preview) preview.innerText = `${state.selectedSlot} ngày ${state.bookingDate}`;
    if (submitBtn) submitBtn.removeAttribute('disabled');
  } else {
    if (preview) preview.innerText = 'Chưa chọn khung giờ nào';
    if (submitBtn) submitBtn.setAttribute('disabled', 'true');
  }

  refreshIcons();
}

function selectSlot(slot) {
  state.selectedSlot = slot;
  renderSlots();
}

// Tải danh sách slot đã đặt của bác sĩ
async function loadDoctorBookedSlots() {
  state.bookedSlots.clear();
  if (!state.doctorId || !state.bookingDate) {
    renderSlots();
    return;
  }

  try {
    const res = await fetch(`/api/v1/appointments?doctor_id=${state.doctorId}&date=${state.bookingDate}&limit=100`, {
      headers: {
        'Accept': 'application/json',
        ...(window.Auth && Auth.getAuthHeader ? Auth.getAuthHeader() : {})
      }
    });
    const json = await res.json();
    const rows = (json.data && json.data.data) || json.data || [];

    rows.forEach(item => {
      if (item.status !== 'Cancelled' && item.status !== 'cancelled') {
        const hhmm = extractSlotTimeHHMM(item.slot_time);
        if (hhmm) state.bookedSlots.add(hhmm);
      }
    });

    if (state.selectedSlot && state.bookedSlots.has(state.selectedSlot)) {
      state.selectedSlot = null;
    }
  } catch (e) {
    console.warn('Lỗi lấy slot đã đặt:', e);
  }

  renderSlots();
}

// ========================================================
// 5. DANH SÁCH LỊCH HẸN & CHỨC NĂNG HỦY LỊCH
// ========================================================
async function fetchAppointmentList() {
  const tbody = document.getElementById('appointments-table-body');
  const badge = document.getElementById('total-appointments-badge');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="px-3.5 py-4 text-center text-xs text-slate-400">Đang tải danh sách lịch khám...</td></tr>`;

  try {
    const res = await fetch('/api/v1/appointments?limit=50', {
      headers: {
        'Accept': 'application/json',
        ...(window.Auth && Auth.getAuthHeader ? Auth.getAuthHeader() : {})
      }
    });
    const json = await res.json();
    const list = (json.data && json.data.data) || json.data || [];

    if (badge) badge.innerText = list.length;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-3.5 py-6 text-center text-xs text-slate-400">Chưa có lịch hẹn khám nào được ghi nhận.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const isCancelled = item.status === 'Cancelled' || item.status === 'cancelled';
      const isCompleted = item.status === 'Completed' || item.status === 'completed';
      
      let badgeHtml = '';
      if (isCancelled) {
        badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Đã Hủy</span>';
      } else if (isCompleted) {
        badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Hoàn Tất</span>';
      } else {
        badgeHtml = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Chờ Khám</span>';
      }

      const slotDisplay = extractSlotTimeHHMM(item.slot_time) || item.slot_time;
      const appId = item.id || item.appointment_id;

      return `
        <tr class="hover:bg-slate-50 transition-colors text-xs">
          <td class="px-3.5 py-2.5 font-mono font-bold text-slate-700">#${appId}</td>
          <td class="px-3.5 py-2.5">
            <div class="font-bold text-slate-900">${item.patient_name || 'Bệnh nhân #' + item.patient_id}</div>
            <div class="text-[10px] text-slate-500 font-mono">${item.phone_number || ''}</div>
          </td>
          <td class="px-3.5 py-2.5">
            <div class="font-medium text-slate-800">${item.doctor_name || 'Bác sĩ #' + item.doctor_id}</div>
            <div class="text-[10px] text-slate-400">${item.doctor_specialty || ''}</div>
          </td>
          <td class="px-3.5 py-2.5 font-mono font-semibold text-blue-700">${slotDisplay}</td>
          <td class="px-3.5 py-2.5">${badgeHtml}</td>
          <td class="px-3.5 py-2.5 text-right">
            ${!isCancelled && !isCompleted ? `
              <button
                onclick="cancelAppointment(${appId})"
                class="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-200 transition-all"
              >
                Hủy Lịch
              </button>
            ` : '<span class="text-slate-300">-</span>'}
          </td>
        </tr>
      `;
    }).join('');

    refreshIcons();
  } catch (err) {
    console.error('Lỗi khi tải lịch khám:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="px-3.5 py-4 text-center text-xs text-rose-500">Không thể kết nối đến máy chủ.</td></tr>`;
  }
}

// Xử lý Hủy lịch khám
async function cancelAppointment(appointmentId) {
  if (!confirm(`Bạn có chắc chắn muốn hủy lịch hẹn khám #${appointmentId}?`)) return;

  try {
    const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
    const res = await fetch(`/api/v1/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'Cancelled' })
    });
    const json = await res.json();

    if (res.ok) {
      showAlert('success', 'Hủy lịch thành công', `Lịch khám #${appointmentId} đã được hủy bỏ an toàn.`);
      fetchAppointmentList();
      loadDoctorBookedSlots();
    } else {
      showAlert('danger', 'Hủy lịch thất bại', json.message || 'Không thể hủy lịch này.');
    }
  } catch (e) {
    showAlert('danger', 'Lỗi kết nối', e.message);
  }
}

// ========================================================
// 6. SUBMIT ĐẶT LỊCH KHÁM BỆNH
// ========================================================
async function handleBookingSubmit(e) {
  e.preventDefault();
  if (state.isSubmitting) return;

  const cccd = document.getElementById('patient-cccd-input').value.trim();
  const fullName = document.getElementById('patient-name-input').value.trim();
  const phone = document.getElementById('patient-phone-input').value.trim();
  const docSelectEl = document.getElementById('doctor-select');
  if (docSelectEl && docSelectEl.value) {
    state.doctorId = Number(docSelectEl.value);
  }

  if (!state.selectedSlot) {
    showAlert('danger', 'Chưa chọn khung giờ', 'Vui lòng chọn 1 khung giờ khám trống để tiếp tục.');
    return;
  }
  if (!cccd || cccd.length !== 12) {
    showAlert('danger', 'CCCD không hợp lệ', 'Vui lòng nhập đúng 12 chữ số Căn cước công dân.');
    return;
  }
  if (!fullName) {
    showAlert('danger', 'Thiếu họ tên', 'Vui lòng nhập đầy đủ họ và tên bệnh nhân.');
    return;
  }
  if (!phone || !/^0\d{9}$/.test(phone)) {
    showAlert('danger', 'SĐT không hợp lệ', 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.');
    return;
  }

  state.isSubmitting = true;
  const submitBtn = document.getElementById('btn-submit-booking');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang xử lý đặt lịch...</span>`;
    refreshIcons();
  }

  try {
    const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
    
    // Nếu bệnh nhân chưa có patientId, tiến hành tạo hồ sơ bệnh nhân tự động
    let effectivePatientId = state.patientId;
    if (!effectivePatientId) {
      const regRes = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          origin_clinic_id: 1,
          full_name: fullName,
          citizen_id: cccd,
          phone_number: phone,
          gender: 'Khac',
          date_of_birth: '1995-01-01'
        })
      });
      const regJson = await regRes.json();
      if (!regRes.ok && regRes.status !== 409) {
        throw new Error(regJson.message || 'Không thể tạo mới hồ sơ bệnh nhân');
      }
      effectivePatientId = regJson.data ? (regJson.data.id || regJson.data.patient_id) : null;

      // Nếu đã tồn tại nhưng trước đó chưa load được, thử tìm lại qua API CCCD
      if (!effectivePatientId) {
        try {
          const findRes = await fetch(`/api/v1/patients/by-cccd/${cccd}`);
          const findJson = await findRes.json();
          if (findJson.data) {
            effectivePatientId = findJson.data.id || findJson.data.patient_id;
            state.patientId = effectivePatientId;
          }
        } catch (e) {
          console.warn('Fallback by-cccd error:', e);
        }
      }
    }

    if (!effectivePatientId) {
      throw new Error('Không thể xác thực mã định danh bệnh nhân. Vui lòng thử lại!');
    }

    // Tiến hành Đặt lịch khám
    const slotIso = `${state.bookingDate}T${state.selectedSlot}:00`;
    const bookRes = await fetch('/api/v1/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clinic_id: 1,
        doctor_id: Number(state.doctorId),
        patient_id: Number(effectivePatientId),
        slot_time: slotIso
      })
    });
    const bookJson = await bookRes.json();

    if (bookRes.ok) {
      showAlert('success', 'Đặt lịch thành công!', `Lịch hẹn khám đã được xác nhận vào lúc ${state.selectedSlot} ngày ${state.bookingDate}.`);
      state.selectedSlot = null;
      loadDoctorBookedSlots();
      fetchAppointmentList();
    } else {
      showAlert('danger', 'Đặt lịch thất bại', bookJson.message || 'Khung giờ này vừa bị trùng hoặc không khả dụng.');
      loadDoctorBookedSlots();
    }
  } catch (err) {
    showAlert('danger', 'Lỗi hệ thống', err.message);
  } finally {
    state.isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="calendar-plus" class="w-4 h-4"></i><span>Xác Nhận Đặt Lịch</span>`;
      refreshIcons();
    }
  }
}

// ========================================================
// 7. KHỞI CHẠY TRANG WEB
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  // Gán ngày mặc định là ngày mai
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yyyy = tomorrow.getFullYear();
  const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const dd = String(tomorrow.getDate()).padStart(2, '0');
  const defaultDateStr = `${yyyy}-${mm}-${dd}`;

  state.bookingDate = defaultDateStr;
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    dateInput.value = defaultDateStr;
    dateInput.min = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    dateInput.addEventListener('change', (e) => {
      state.bookingDate = e.target.value;
      loadDoctorBookedSlots();
    });
  }

  const docSelect = document.getElementById('doctor-select');
  if (docSelect) {
    docSelect.addEventListener('change', (e) => {
      state.doctorId = Number(e.target.value);
      loadDoctorBookedSlots();
    });
  }

  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
  }

  setupCccdLookup();
  fetchDoctors();
  fetchAppointmentList();
  refreshIcons();
});

window.selectSlot = selectSlot;
window.cancelAppointment = cancelAppointment;
window.fetchAppointmentList = fetchAppointmentList;
window.loadDoctorBookedSlots = loadDoctorBookedSlots;
window.closeAlert = closeAlert;
