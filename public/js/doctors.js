/**
 * Frontend Logic cho Phân hệ Quản lý Bác sĩ & Cơ Sở (TV1 Medical Staff)
 * Quản lý trạng thái 3 tầng: Loading Skeleton, Error Fallback, Success Render.
 */

let allDoctors = [];
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Khởi tạo các event listeners
  const filterClinic = document.getElementById('filter-clinic');
  const filterSpecialty = document.getElementById('filter-specialty');
  const filterStatus = document.getElementById('filter-status');
  const filterSearch = document.getElementById('filter-search');
  const btnOpenModal = document.getElementById('btn-open-create-modal');

  if (filterClinic) filterClinic.addEventListener('change', loadDoctors);
  if (filterSpecialty) filterSpecialty.addEventListener('change', loadDoctors);
  if (filterStatus) filterStatus.addEventListener('change', loadDoctors);
  if (filterSearch) {
    filterSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadDoctors, 300);
    });
  }

  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', openCreateModal);
  }

  // Tải danh sách bác sĩ ban đầu
  loadDoctors();
});

/**
 * Trích xuất JWT Token từ localStorage
 */
function getAuthToken() {
  return localStorage.getItem('access_token') || '';
}

/**
 * Tải danh sách bác sĩ từ Backend API
 */
async function loadDoctors() {
  const loadingEl = document.getElementById('state-loading');
  const errorEl = document.getElementById('state-error');
  const successEl = document.getElementById('state-success');
  const emptyEl = document.getElementById('state-empty');
  const tbodyEl = document.getElementById('doctors-tbody');
  const errorMsgEl = document.getElementById('error-message');

  // Chuyển sang Loading State
  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  try {
    const clinicId = document.getElementById('filter-clinic')?.value || '';
    const specialty = document.getElementById('filter-specialty')?.value || '';
    const status = document.getElementById('filter-status')?.value || '';
    const search = document.getElementById('filter-search')?.value.trim() || '';

    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId);
    if (specialty) params.append('specialty', specialty);
    if (status && status !== 'all') params.append('status', status);
    if (search) params.append('search', search);

    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/v1/doctors?${params.toString()}`, { headers });
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.message || `Lỗi tải danh sách (${res.status})`);
    }

    allDoctors = json.data || [];

    // Cập nhật thống kê nhanh
    updateStats(allDoctors);

    // Render danh sách
    tbodyEl.innerHTML = '';
    if (allDoctors.length === 0) {
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      allDoctors.forEach((doc) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

        const cId = Number(doc.clinic_id);
        const clinicBadge = cId === 1
          ? '<span class="badge-clinic badge-hanoi"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>Hà Nội (CS1)</span>'
          : '<span class="badge-clinic badge-hcm"><span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>TP.HCM (CS2)</span>';

        const isActive = doc.status === 'active';
        const statusBadge = isActive
          ? '<span class="badge-status badge-active"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Hoạt động</span>'
          : '<span class="badge-status badge-inactive"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Tạm ngưng</span>';

        const doctorId = doc.id || doc.doctor_id;

        tr.innerHTML = `
          <td class="py-3 px-4 font-mono font-bold text-slate-500">#${doctorId}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-slate-900">${escapeHtml(doc.full_name)}</div>
            <div class="text-[11px] text-slate-400">Cơ sở ${cId}</div>
          </td>
          <td class="py-3 px-4">
            <span class="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-lg">
              ${escapeHtml(doc.specialty)}
            </span>
          </td>
          <td class="py-3 px-4">${clinicBadge}</td>
          <td class="py-3 px-4 font-mono text-slate-600">${doc.phone ? escapeHtml(doc.phone) : '<span class="text-slate-300">Chưa có</span>'}</td>
          <td class="py-3 px-4">${statusBadge}</td>
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="toggleStatus(${doctorId}, '${doc.status}', ${cId})" title="${isActive ? 'Tạm ngưng tiếp nhận' : 'Kích hoạt bác sĩ'}" 
                      class="p-1.5 text-slate-500 hover:text-${isActive ? 'amber' : 'emerald'}-600 hover:bg-slate-100 rounded-lg transition">
                <i data-lucide="${isActive ? 'pause-circle' : 'play-circle'}" class="w-4 h-4"></i>
              </button>
              <button onclick="openEditModal(${JSON.stringify(doc).replace(/"/g, '&quot;')})" title="Sửa thông tin"
                      class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="deleteDoctor(${doctorId}, ${cId}, '${escapeHtml(doc.full_name)}')" title="Xóa bác sĩ"
                      class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        `;
        tbodyEl.appendChild(tr);
      });
    }

    // Chuyển sang Success State
    loadingEl.classList.add('hidden');
    successEl.classList.remove('hidden');

    // Khởi tạo lại Lucide icons cho các nút vừa render
    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.error('[loadDoctors] Error:', err);
    if (errorMsgEl) errorMsgEl.textContent = err.message;
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

/**
 * Cập nhật số liệu thống kê nhanh trên đầu trang
 */
function updateStats(doctors) {
  const total = doctors.length;
  const active = doctors.filter(d => d.status === 'active').length;
  const hanoi = doctors.filter(d => Number(d.clinic_id) === 1).length;
  const hcm = doctors.filter(d => Number(d.clinic_id) === 2).length;

  const totalEl = document.getElementById('stat-total-doctors');
  const activeEl = document.getElementById('stat-active-doctors');
  const hanoiEl = document.getElementById('stat-hanoi-doctors');
  const hcmEl = document.getElementById('stat-hcm-doctors');

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (hanoiEl) hanoiEl.textContent = hanoi;
  if (hcmEl) hcmEl.textContent = hcm;
}

/**
 * Mở modal Thêm Bác Sĩ Mới
 */
function openCreateModal() {
  const modal = document.getElementById('doctor-modal');
  const form = document.getElementById('doctor-form');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const errorBox = document.getElementById('modal-error');

  form.reset();
  document.getElementById('form-doctor-id').value = '';
  document.getElementById('form-clinic-id').disabled = false;
  title.textContent = 'Thêm Bác Sĩ Mới';
  desc.textContent = 'Đăng ký thông tin bác sĩ công tác tại chi nhánh';
  errorBox.classList.add('hidden');

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Mở modal Sửa Thông Tin Bác Sĩ
 */
function openEditModal(doc) {
  const modal = document.getElementById('doctor-modal');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const errorBox = document.getElementById('modal-error');

  const doctorId = doc.id || doc.doctor_id;
  document.getElementById('form-doctor-id').value = doctorId;
  document.getElementById('form-clinic-id').value = doc.clinic_id;
  document.getElementById('form-clinic-id').disabled = true; // Không cho đổi chi nhánh shard khi sửa
  document.getElementById('form-full-name').value = doc.full_name || '';
  document.getElementById('form-specialty').value = doc.specialty || '';
  document.getElementById('form-phone').value = doc.phone || '';
  document.getElementById('form-status').value = doc.status || 'active';

  title.textContent = `Chỉnh Sửa Bác Sĩ #${doctorId}`;
  desc.textContent = `Cập nhật thông tin bác sĩ [${doc.full_name}]`;
  errorBox.classList.add('hidden');

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Đóng modal
 */
function closeModal() {
  document.getElementById('doctor-modal').classList.add('hidden');
}

/**
 * Xử lý Submit Form Tạo / Sửa Bác sĩ
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  const errorBox = document.getElementById('modal-error');
  const btnSave = document.getElementById('btn-save-doctor');

  errorBox.classList.add('hidden');
  btnSave.disabled = true;
  btnSave.innerHTML = '<span class="inline-block animate-spin mr-1">⌛</span> Đang lưu...';

  try {
    const doctorId = document.getElementById('form-doctor-id').value;
    const clinicId = Number(document.getElementById('form-clinic-id').value);
    const fullName = document.getElementById('form-full-name').value.trim();
    const specialty = document.getElementById('form-specialty').value.trim();
    const phone = document.getElementById('form-phone').value.trim();
    const status = document.getElementById('form-status').value;

    const payload = {
      clinic_id: clinicId,
      full_name: fullName,
      specialty,
      phone: phone || null,
      status
    };

    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    let url = '/api/v1/doctors';
    let method = 'POST';

    if (doctorId) {
      url = `/api/v1/doctors/${doctorId}?clinic_id=${clinicId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Lỗi thao tác');
    }

    closeModal();
    await loadDoctors();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove('hidden');
  } finally {
    btnSave.disabled = false;
    btnSave.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Lưu Thông Tin</span>';
    if (window.lucide) window.lucide.createIcons();
  }
}

/**
 * Chuyển đổi nhanh trạng thái bác sĩ (active <-> inactive)
 */
async function toggleStatus(doctorId, currentStatus, clinicId) {
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const label = nextStatus === 'active' ? 'Kích hoạt' : 'Tạm ngưng tiếp nhận';

  if (!confirm(`Bạn có chắc chắn muốn chuyển trạng thái bác sĩ #${doctorId} sang "${label}"?`)) {
    return;
  }

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/v1/doctors/${doctorId}/status?clinic_id=${clinicId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: nextStatus })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Không thể đổi trạng thái');
    }

    await loadDoctors();
  } catch (err) {
    alert(`Lỗi: ${err.message}`);
  }
}

/**
 * Xóa bác sĩ
 */
async function deleteDoctor(doctorId, clinicId, name) {
  if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa hồ sơ bác sĩ [${name}] (#${doctorId}) tại Cơ sở ${clinicId}?\nThao tác này không thể hoàn tác.`)) {
    return;
  }

  try {
    const token = getAuthToken();
    const res = await fetch(`/api/v1/doctors/${doctorId}?clinic_id=${clinicId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Không thể xóa bác sĩ');
    }

    alert('Đã xóa bác sĩ thành công!');
    await loadDoctors();
  } catch (err) {
    alert(`Không thể xóa bác sĩ:\n${err.message}`);
  }
}

/**
 * Xóa bộ lọc về mặc định
 */
function resetFilters() {
  document.getElementById('filter-clinic').value = '';
  document.getElementById('filter-specialty').value = '';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-search').value = '';
  loadDoctors();
}

/**
 * Escape HTML để ngăn ngừa XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
