/**
 * ==============================================================================
 * PATIENTS MANAGEMENT CONTROLLER & VIEW LOGIC
 * Phân hệ Quản lý Bệnh nhân ClinicCare Hospital
 * Hỗ trợ Đăng ký, Tìm kiếm, Sửa thông tin, Xóa hồ sơ
 * ==============================================================================
 */

let patientsListCache = [];

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements Reference
  const patientForm = document.getElementById('patient-form');
  const fullNameInput = document.getElementById('full_name');
  const citizenIdInput = document.getElementById('citizen_id');
  const phoneNumberInput = document.getElementById('phone_number');
  const dobInput = document.getElementById('date_of_birth');
  const genderSelect = document.getElementById('gender');
  const addressInput = document.getElementById('address');
  const submitBtn = document.getElementById('submit-btn');
  const submitSpinner = document.getElementById('submit-spinner');
  const submitBtnText = document.getElementById('submit-btn-text');

  // Error feedback elements
  const fullNameError = document.getElementById('full_name_error');
  const citizenIdError = document.getElementById('citizen_id_error');
  const phoneNumberError = document.getElementById('phone_number_error');
  const dobError = document.getElementById('date_of_birth_error');

  // Search Elements
  const searchQueryInput = document.getElementById('search-query');
  const btnSearch = document.getElementById('btn-search');
  const btnReset = document.getElementById('btn-reset');

  // Table & Pagination Elements
  const patientTbody = document.getElementById('patient-tbody');
  const patientEmptyState = document.getElementById('patient-empty-state');
  const totalBadge = document.getElementById('total-badge');
  const paginationInfo = document.getElementById('pagination-info');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');

  // Alert Banner Elements
  const alertBanner = document.getElementById('alert-banner');
  const alertTitle = document.getElementById('alert-title');
  const alertMessage = document.getElementById('alert-message');
  const alertIcon = document.getElementById('alert-icon');
  const alertCloseBtn = document.getElementById('alert-close-btn');

  // 2. State Management
  let currentPage = 1;
  const pageSize = 20;
  let totalPages = 1;
  let isSubmitting = false;
  let isFetching = false;

  // Giới hạn ngày sinh tối đa là hôm nay
  const todayStr = new Date().toISOString().split('T')[0];
  if (dobInput) dobInput.max = todayStr;

  // 3. Alert Helpers
  function showAlert(title, message, type = 'success') {
    if (!alertBanner) return;
    alertBanner.classList.remove('hidden', 'alert-success', 'alert-danger');
    
    if (type === 'success') {
      alertBanner.classList.add('alert-success');
      alertIcon.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>';
    } else {
      alertBanner.classList.add('alert-danger');
      alertIcon.innerHTML = '<i data-lucide="alert-octagon" class="w-5 h-5 text-red-600"></i>';
    }

    alertTitle.textContent = title;
    alertMessage.textContent = message;

    if (window.lucide) window.lucide.createIcons();
    alertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    if (alertBanner) alertBanner.classList.add('hidden');
  }

  if (alertCloseBtn) alertCloseBtn.addEventListener('click', hideAlert);

  // 4. Form Validation Helpers
  function clearErrors() {
    [fullNameError, citizenIdError, phoneNumberError, dobError].forEach(el => {
      if (el) {
        el.textContent = '';
        el.classList.add('hidden');
      }
    });
    [fullNameInput, citizenIdInput, phoneNumberInput, dobInput].forEach(el => {
      if (el) el.classList.remove('border-red-500', 'focus:ring-red-400');
    });
  }

  function setError(inputEl, errorEl, message) {
    if (!inputEl || !errorEl) return;
    inputEl.classList.add('border-red-500', 'focus:ring-red-400');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function validateClientForm() {
    clearErrors();
    let isValid = true;

    const fullName = fullNameInput.value.trim();
    if (!fullName || fullName.length < 2) {
      setError(fullNameInput, fullNameError, 'Họ và tên phải có ít nhất 2 ký tự.');
      isValid = false;
    }

    const citizenId = citizenIdInput.value.trim();
    if (!/^\d{12}$/.test(citizenId)) {
      setError(citizenIdInput, citizenIdError, 'CCCD phải gồm đúng 12 chữ số.');
      isValid = false;
    }

    const phone = phoneNumberInput.value.trim();
    if (!/^0\d{9}$/.test(phone)) {
      setError(phoneNumberInput, phoneNumberError, 'Số điện thoại phải có 10 chữ số và bắt đầu bằng số 0.');
      isValid = false;
    }

    const dob = dobInput.value;
    if (!dob) {
      setError(dobInput, dobError, 'Vui lòng chọn ngày sinh.');
      isValid = false;
    }

    return isValid;
  }

  // 5. Submit Form Handler
  if (patientForm) {
    patientForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      if (!validateClientForm()) return;

      isSubmitting = true;
      submitBtn.disabled = true;
      submitSpinner.classList.remove('hidden');
      submitBtnText.textContent = 'Đang lưu...';
      hideAlert();

      const payload = {
        full_name: fullNameInput.value.trim(),
        citizen_id: citizenIdInput.value.trim(),
        phone_number: phoneNumberInput.value.trim(),
        date_of_birth: dobInput.value,
        gender: genderSelect.value,
        origin_clinic_id: 1,
        address: addressInput ? addressInput.value.trim() : null
      };

      try {
        const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
        const res = await fetch('/api/v1/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
          showAlert('Đăng Ký Thành Công', `Hồ sơ bệnh nhân ${payload.full_name} đã được lưu thành công.`, 'success');
          patientForm.reset();
          fetchPatients(1);
        } else {
          showAlert('Đăng Ký Thất Bại', data.message || 'Không thể tạo hồ sơ bệnh nhân.', 'danger');
        }
      } catch (err) {
        showAlert('Lỗi Kết Nối', err.message || 'Lỗi mạng khi kết nối tới máy chủ.', 'danger');
      } finally {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitSpinner.classList.add('hidden');
        submitBtnText.textContent = 'Đăng Ký Hồ Sơ';
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // 6. Fetch Patients Handler
  async function fetchPatients(page = 1) {
    if (isFetching) return;
    isFetching = true;
    currentPage = page;

    patientTbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-500 text-xs">
          <i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto text-blue-600 mb-1"></i>
          Đang tải dữ liệu hồ sơ bệnh nhân...
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();

    const query = searchQueryInput.value.trim();
    const params = new URLSearchParams({
      page: currentPage,
      limit: pageSize
    });

    if (query) {
      if (/^\d{12}$/.test(query)) {
        params.append('citizen_id', query);
      } else if (/^0\d{9}$/.test(query)) {
        params.append('phone_number', query);
      } else {
        params.append('q', query);
      }
    }

    try {
      const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/patients?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Lỗi khi tải danh sách bệnh nhân');
      }

      const patients = (json.data && json.data.data) || json.data || [];
      const pagination = json.data && json.data.pagination ? json.data.pagination : { total: patients.length, totalPages: 1 };
      patientsListCache = patients;

      const totalRecords = pagination.total || patients.length;
      totalPages = pagination.totalPages || 1;

      totalBadge.textContent = `${formatNumber(totalRecords)} Bệnh nhân`;
      paginationInfo.textContent = `Hiển thị trang ${currentPage} / ${totalPages} (Tổng ${formatNumber(totalRecords)} hồ sơ)`;

      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= totalPages;

      if (patients.length === 0) {
        patientTbody.innerHTML = '';
        patientEmptyState.classList.remove('hidden');
        return;
      }

      patientEmptyState.classList.add('hidden');

      const rowsHtml = patients.map((p) => {
        const pId = p.id || p.patient_id;
        const codeBn = `BN-${String(pId).padStart(4, '0')}`;
        const genderLabel = p.gender === 'Male' || p.gender === 'male' ? 'Nam' : (p.gender === 'Female' || p.gender === 'female' ? 'Nữ' : 'Khác');

        return `
          <tr class="hover:bg-slate-50 transition-colors text-xs">
            <td class="font-mono font-bold text-blue-700">${codeBn}</td>
            <td class="font-bold text-slate-900">${escapeHtml(p.full_name)}</td>
            <td class="font-mono text-slate-700">${escapeHtml(p.citizen_id || p.identity_card || '—')}</td>
            <td class="font-mono text-slate-800 font-semibold">${escapeHtml(p.phone_number || '—')}</td>
            <td class="text-slate-600">${escapeHtml(p.date_of_birth ? p.date_of_birth.substring(0, 10) : '—')}</td>
            <td class="text-slate-700">${genderLabel}</td>
            <td class="text-slate-500">${escapeHtml(p.address || '—')}</td>
            <td class="text-right space-x-1.5 whitespace-nowrap">
              <button 
                onclick="openEditPatient(${pId})"
                class="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg border border-blue-200 transition-all cursor-pointer"
              >
                Sửa
              </button>
              <button 
                onclick="deletePatient(${pId}, '${escapeHtml(p.full_name)}')"
                class="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer"
              >
                Xóa
              </button>
            </td>
          </tr>
        `;
      }).join('');

      patientTbody.innerHTML = rowsHtml;

    } catch (err) {
      console.error('[Fetch Patients Error]:', err);
      patientTbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-6 text-red-600 text-xs font-semibold">
            Không thể tải dữ liệu: ${err.message}. Vui lòng thử lại!
          </td>
        </tr>
      `;
    } finally {
      isFetching = false;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // 7. Search & Pagination Listeners
  if (btnSearch) btnSearch.addEventListener('click', () => fetchPatients(1));
  if (searchQueryInput) {
    searchQueryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchPatients(1);
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      searchQueryInput.value = '';
      fetchPatients(1);
    });
  }

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) fetchPatients(currentPage - 1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < totalPages) fetchPatients(currentPage + 1);
    });
  }

  // 8. Edit & Delete Functions
  window.openEditPatient = function(patientId) {
    const patient = patientsListCache.find(p => (p.id || p.patient_id) === Number(patientId));
    if (!patient) return;

    document.getElementById('edit-patient-id').value = patientId;
    document.getElementById('edit-patient-name').value = patient.full_name || '';
    document.getElementById('edit-patient-phone').value = patient.phone_number || '';
    document.getElementById('edit-patient-dob').value = patient.date_of_birth ? patient.date_of_birth.substring(0, 10) : '';
    document.getElementById('edit-patient-gender').value = patient.gender || 'Male';
    document.getElementById('edit-patient-address').value = patient.address || '';

    const modal = document.getElementById('edit-patient-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  };

  window.closeEditModal = function() {
    const modal = document.getElementById('edit-patient-modal');
    if (modal) modal.classList.add('hidden');
  };

  const editForm = document.getElementById('edit-patient-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patientId = document.getElementById('edit-patient-id').value;
      const payload = {
        full_name: document.getElementById('edit-patient-name').value.trim(),
        phone_number: document.getElementById('edit-patient-phone').value.trim(),
        date_of_birth: document.getElementById('edit-patient-dob').value,
        gender: document.getElementById('edit-patient-gender').value,
        address: document.getElementById('edit-patient-address').value.trim()
      };

      try {
        const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
        const res = await fetch(`/api/v1/patients/${patientId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          showAlert('Thành công', 'Đã cập nhật thông tin bệnh nhân!', 'success');
          closeEditModal();
          fetchPatients(currentPage);
        } else {
          alert(data.message || 'Không thể cập nhật hồ sơ');
        }
      } catch (err) {
        alert('Lỗi kết nối: ' + err.message);
      }
    });
  }

  window.deletePatient = async function(patientId, patientName) {
    if (!confirm(`Bạn có chắc chắn muốn xóa hồ sơ bệnh nhân "${patientName}" (Mã: BN-${String(patientId).padStart(4, '0')})?`)) return;

    try {
      const token = (window.Auth && Auth.getToken()) || localStorage.getItem('access_token');
      const res = await fetch(`/api/v1/patients/${patientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Đã Xóa', `Đã xóa hồ sơ bệnh nhân #${patientId} thành công.`, 'success');
        fetchPatients(currentPage);
      } else {
        showAlert('Xóa Thất Bại', data.message || 'Không thể xóa hồ sơ này.', 'danger');
      }
    } catch (err) {
      showAlert('Lỗi', err.message, 'danger');
    }
  };

  // 9. Utility Functions
  function formatNumber(num) {
    return new Intl.NumberFormat('vi-VN').format(Number(num) || 0);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Khởi tạo icons & tải trang 1
  if (window.lucide) window.lucide.createIcons();
  fetchPatients(1);
});
