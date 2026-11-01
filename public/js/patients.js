/**
 * ==============================================================================
 * PATIENTS MANAGEMENT CONTROLLER & VIEW LOGIC (TV2)
 * Xử lý tương tác đăng ký bệnh nhân, kiểm thực DTO client-side,
 * định tuyến ghi theo Sharding Key và tra cứu Cross-Node song song
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements Reference
  const patientForm = document.getElementById('patient-form');
  const fullNameInput = document.getElementById('full_name');
  const citizenIdInput = document.getElementById('citizen_id');
  const phoneNumberInput = document.getElementById('phone_number');
  const dobInput = document.getElementById('date_of_birth');
  const genderSelect = document.getElementById('gender');
  const originClinicSelect = document.getElementById('origin_clinic_id');
  const addressInput = document.getElementById('address');
  const submitBtn = document.getElementById('submit-btn');
  const submitSpinner = document.getElementById('submit-spinner');
  const submitBtnText = document.getElementById('submit-btn-text');

  // Error feedback elements
  const fullNameError = document.getElementById('full_name_error');
  const citizenIdError = document.getElementById('citizen_id_error');
  const phoneNumberError = document.getElementById('phone_number_error');
  const dobError = document.getElementById('date_of_birth_error');

  // Search & Filter Elements
  const searchQueryInput = document.getElementById('search-query');
  const filterClinicSelect = document.getElementById('filter-clinic-id');
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
  dobInput.max = todayStr;

  // 3. Alert Helpers
  function showAlert(title, message, type = 'success') {
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
    alertBanner.classList.add('hidden');
  }

  alertCloseBtn.addEventListener('click', hideAlert);

  // 4. Client-side Form Validation
  function clearFieldError(input, errorElement) {
    input.classList.remove('input-error');
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
  }

  function setFieldError(input, errorElement, message) {
    input.classList.add('input-error');
    errorElement.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i><span>${message}</span>`;
    errorElement.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function validateForm() {
    let isValid = true;

    // Validate Họ tên
    const name = fullNameInput.value.trim();
    if (!name || name.length < 2) {
      setFieldError(fullNameInput, fullNameError, 'Họ và tên bắt buộc và phải có ít nhất 2 ký tự.');
      isValid = false;
    } else {
      clearFieldError(fullNameInput, fullNameError);
    }

    // Validate Số CCCD (12 chữ số)
    const citizenId = citizenIdInput.value.trim();
    if (!/^\d{12}$/.test(citizenId)) {
      setFieldError(citizenIdInput, citizenIdError, 'Số CCCD phải gồm đúng 12 chữ số.');
      isValid = false;
    } else {
      clearFieldError(citizenIdInput, citizenIdError);
    }

    // Validate Số điện thoại (10 chữ số bắt đầu bằng 0)
    const phone = phoneNumberInput.value.trim();
    if (!/^0\d{9}$/.test(phone)) {
      setFieldError(phoneNumberInput, phoneNumberError, 'Số ĐT phải đúng 10 chữ số và bắt đầu bằng số 0.');
      isValid = false;
    } else {
      clearFieldError(phoneNumberInput, phoneNumberError);
    }

    // Validate Ngày sinh
    const dob = dobInput.value.trim();
    if (!dob) {
      setFieldError(dobInput, dobError, 'Ngày sinh là bắt buộc.');
      isValid = false;
    } else if (new Date(dob) >= new Date()) {
      setFieldError(dobInput, dobError, 'Ngày sinh phải nhỏ hơn ngày hiện tại.');
      isValid = false;
    } else {
      clearFieldError(dobInput, dobError);
    }

    return isValid;
  }

  // Clear errors on input
  fullNameInput.addEventListener('input', () => clearFieldError(fullNameInput, fullNameError));
  citizenIdInput.addEventListener('input', () => clearFieldError(citizenIdInput, citizenIdError));
  phoneNumberInput.addEventListener('input', () => clearFieldError(phoneNumberInput, phoneNumberError));
  dobInput.addEventListener('change', () => clearFieldError(dobInput, dobError));

  // 5. Submit Form Handler (Đăng ký mới hồ sơ)
  patientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    isSubmitting = true;
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');
    submitBtnText.textContent = 'Đang lưu vào Node...';
    hideAlert();

    const payload = {
      full_name: fullNameInput.value.trim(),
      citizen_id: citizenIdInput.value.trim(),
      phone_number: phoneNumberInput.value.trim(),
      date_of_birth: dobInput.value.trim(),
      gender: genderSelect.value,
      origin_clinic_id: Number(originClinicSelect.value),
      address: addressInput.value.trim() || undefined
    };

    try {
      const response = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.status === 201) {
        const clinicName = payload.origin_clinic_id === 1 ? 'Cơ sở 1 (Hà Nội)' : 'Cơ sở 2 (TP.HCM)';
        showAlert(
          'Đăng Ký Thành Công!',
          `Hồ sơ bệnh nhân ${payload.full_name} đã được định tuyến và lưu an toàn vào Node CSDL ${clinicName}.`,
          'success'
        );
        patientForm.reset();
        dobInput.max = todayStr;
        // Tải lại danh sách bệnh nhân
        fetchPatients(1);
      } else if (response.status === 409) {
        showAlert(
          'Trùng Lặp Hồ Sơ (409 Conflict)',
          result.message || 'Số CCCD này đã tồn tại trong cơ sở dữ liệu của chi nhánh!',
          'danger'
        );
        setFieldError(citizenIdInput, citizenIdError, 'Số CCCD này đã được đăng ký trước đó.');
      } else {
        showAlert(
          'Đăng Ký Thất Bại',
          result.message || `Lỗi yêu cầu (${response.status})`,
          'danger'
        );
      }
    } catch (err) {
      console.error('[Patient Register Error]:', err);
      showAlert(
        'Lỗi Kết Nối Máy Chủ',
        'Không thể gửi yêu cầu tới Backend. Vui lòng kiểm tra lại dịch vụ!',
        'danger'
      );
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitSpinner.classList.remove('hidden');
      submitSpinner.classList.add('hidden');
      submitBtnText.textContent = 'Đăng Ký Hồ Sơ';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // 6. Fetch Patients Handler (Tra cứu phân tán Cross-Node)
  async function fetchPatients(page = 1) {
    isFetching = true;
    currentPage = page;
    patientEmptyState.classList.add('hidden');
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;

    // Loading skeleton rows
    patientTbody.innerHTML = `
      <tr class="skeleton-row">
        <td colspan="8" class="text-center py-8 text-slate-400">
          <div class="flex items-center justify-center gap-2">
            <i data-lucide="loader-2" class="w-5 h-5 animate-spin text-blue-600"></i>
            <span class="text-sm font-semibold text-slate-600">Đang thực thi tra cứu phân tán song song đa Node CSDL...</span>
          </div>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();

    const queryParams = new URLSearchParams();
    queryParams.append('page', page);
    queryParams.append('limit', pageSize);

    const clinicId = filterClinicSelect.value;
    if (clinicId) {
      queryParams.append('clinic_id', clinicId);
    }

    const search = searchQueryInput.value.trim();
    if (search) {
      if (/^\d{12}$/.test(search)) {
        queryParams.append('citizen_id', search);
      } else {
        queryParams.append('phone_number', search);
      }
    }

    try {
      const response = await fetch(`/api/v1/patients?${queryParams.toString()}`, {
        headers: { 'Accept': 'application/json' }
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Lỗi khi tải danh sách bệnh nhân');
      }

      const patients = result.data || [];
      const pagination = result.pagination || { total: patients.length, page: 1, limit: pageSize, totalPages: 1 };

      totalPages = pagination.totalPages || 1;
      totalBadge.textContent = `${formatNumber(pagination.total)} Hồ Sơ`;
      paginationInfo.textContent = `Trang ${pagination.page} / ${totalPages} — Tổng cộng ${formatNumber(pagination.total)} bệnh nhân`;

      prevPageBtn.disabled = pagination.page <= 1;
      nextPageBtn.disabled = pagination.page >= totalPages;

      if (patients.length === 0) {
        patientTbody.innerHTML = '';
        patientEmptyState.classList.remove('hidden');
        return;
      }

      // Render danh sách bệnh nhân
      const rowsHtml = patients.map((p) => {
        const isHanoi = Number(p.origin_clinic_id) === 1;
        const clinicBadgeClass = isHanoi ? 'badge-hanoi' : 'badge-hcm';
        const clinicLabel = isHanoi ? 'Hà Nội (Node 1)' : 'TP.HCM (Node 2)';
        const genderLabel = p.gender === 'Male' ? 'Nam' : (p.gender === 'Female' ? 'Nữ' : 'Khác');
        const formattedDate = p.created_at ? new Date(p.created_at).toLocaleDateString('vi-VN') : '—';

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="font-mono text-xs font-bold text-slate-500">#${p.patient_id}</td>
            <td class="font-bold text-slate-900">${escapeHtml(p.full_name)}</td>
            <td class="font-mono text-xs text-slate-700">${escapeHtml(p.citizen_id || p.identity_card || '—')}</td>
            <td class="font-mono text-xs text-blue-700">${escapeHtml(p.phone_number || '—')}</td>
            <td class="text-xs text-slate-600">${escapeHtml(p.date_of_birth || '—')}</td>
            <td class="text-xs text-slate-700">${genderLabel}</td>
            <td>
              <span class="badge-clinic ${clinicBadgeClass}">
                <span class="w-1.5 h-1.5 rounded-full ${isHanoi ? 'bg-blue-600' : 'bg-purple-600'}"></span>
                <span>${clinicLabel}</span>
              </span>
            </td>
            <td class="text-xs text-slate-500">${formattedDate}</td>
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
  btnSearch.addEventListener('click', () => fetchPatients(1));
  searchQueryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchPatients(1);
    }
  });

  filterClinicSelect.addEventListener('change', () => fetchPatients(1));

  btnReset.addEventListener('click', () => {
    searchQueryInput.value = '';
    filterClinicSelect.value = '';
    fetchPatients(1);
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) fetchPatients(currentPage - 1);
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) fetchPatients(currentPage + 1);
  });

  // 8. Utility Functions
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

  // Khởi tạo icons & tải trang 1 lần đầu
  if (window.lucide) window.lucide.createIcons();
  fetchPatients(1);
});
