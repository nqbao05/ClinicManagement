/**
 * ==============================================================================
 * DASHBOARD ADMIN ANALYTICS CONTROLLER & VIEW LOGIC (TV4)
 * Xử lý tương tác, kiểm thực DTO client-side, quản lý 3 trạng thái mạng
 * và giám sát cơ chế chịu lỗi phân tán (Multi-Node Sharding Health)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. DOM Elements Reference
  const filterForm = document.getElementById('filter-form');
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  const filterBtn = document.getElementById('filter-btn');
  const filterBtnSpinner = document.getElementById('filter-btn-spinner');
  const filterBtnIcon = document.getElementById('filter-btn-icon');
  const filterBtnText = document.getElementById('filter-btn-text');
  const resetBtn = document.getElementById('reset-btn');
  const activeRangeText = document.getElementById('active-range-text');

  // KPI Elements
  const kpiContainer = document.getElementById('kpi-container');
  const kpiTotalAppointments = document.getElementById('kpi-total-appointments');
  const kpiPendingAppointments = document.getElementById('kpi-pending-appointments');
  const kpiConfirmedAppointments = document.getElementById('kpi-confirmed-appointments');
  const kpiTotalPatients = document.getElementById('kpi-total-patients');
  const kpiCompletionRate = document.getElementById('kpi-completion-rate');
  const kpiCancelledAppointments = document.getElementById('kpi-cancelled-appointments');
  const kpiCancellationRate = document.getElementById('kpi-cancellation-rate');

  // Regional Distribution Elements
  const regionalContainer = document.getElementById('regional-distribution-container');
  const hanoiStatusBadge = document.getElementById('hanoi-status-badge');
  const hanoiCountText = document.getElementById('hanoi-count-text');
  const hanoiPercentText = document.getElementById('hanoi-percent-text');
  const hanoiProgressBar = document.getElementById('hanoi-progress-bar');
  const hcmStatusBadge = document.getElementById('hcm-status-badge');
  const hcmCountText = document.getElementById('hcm-count-text');
  const hcmPercentText = document.getElementById('hcm-percent-text');
  const hcmProgressBar = document.getElementById('hcm-progress-bar');

  // Header Node Status Elements
  const headerNodeHanoi = document.getElementById('header-node-hanoi');
  const headerNodeHcm = document.getElementById('header-node-hcm');

  // Specialty Elements
  const specialtyTableBody = document.getElementById('specialty-table-body');
  const specialtyCountBadge = document.getElementById('specialty-count-badge');
  const specialtyEmptyState = document.getElementById('specialty-empty-state');

  // Alert & Warning Elements
  const clientAlertBanner = document.getElementById('client-alert-banner');
  const clientAlertTitle = document.getElementById('client-alert-title');
  const clientAlertMessage = document.getElementById('client-alert-message');
  const clientAlertIcon = document.getElementById('client-alert-icon');
  const clientAlertRetryBtn = document.getElementById('client-alert-retry-btn');
  const clientAlertCloseBtn = document.getElementById('client-alert-close-btn');

  const systemWarningBanner = document.getElementById('system-warning-banner');
  const systemWarningList = document.getElementById('system-warning-list');

  // State Management
  let isFetching = false;
  let lastQueryParams = {};

  // 2. Alert Banner Helpers
  function showAlert(title, message, type = 'danger', showRetry = false) {
    clientAlertBanner.classList.remove('hidden', 'alert-banner-danger', 'alert-banner-warning', 'alert-banner-success');
    
    if (type === 'danger') {
      clientAlertBanner.classList.add('alert-banner-danger');
      clientAlertIcon.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-red-600"></i>';
    } else if (type === 'warning') {
      clientAlertBanner.classList.add('alert-banner-warning');
      clientAlertIcon.innerHTML = '<i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600"></i>';
    } else {
      clientAlertBanner.classList.add('alert-banner-success');
      clientAlertIcon.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-600"></i>';
    }

    clientAlertTitle.textContent = title;
    clientAlertMessage.textContent = message;

    if (showRetry) {
      clientAlertRetryBtn.classList.remove('hidden');
    } else {
      clientAlertRetryBtn.classList.add('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
    clientAlertBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideAlert() {
    clientAlertBanner.classList.add('hidden');
    clientAlertRetryBtn.classList.add('hidden');
  }

  clientAlertCloseBtn.addEventListener('click', hideAlert);
  clientAlertRetryBtn.addEventListener('click', () => {
    hideAlert();
    fetchDashboardData(lastQueryParams);
  });

  // 3. Quản lý trạng thái tải (Loading State: Spinner + Skeleton Shimmer)
  function setLoadingState(loading) {
    isFetching = loading;
    filterBtn.disabled = loading;
    resetBtn.disabled = loading;

    if (loading) {
      filterBtnSpinner.classList.remove('hidden');
      filterBtnIcon.classList.add('hidden');
      filterBtnText.textContent = 'Đang tổng hợp...';
      kpiContainer.classList.add('is-loading');
      regionalContainer.classList.add('is-loading');
      specialtyTableBody.classList.add('is-loading');
    } else {
      filterBtnSpinner.classList.add('hidden');
      filterBtnIcon.classList.remove('hidden');
      filterBtnText.textContent = 'Lọc Báo Cáo';
      kpiContainer.classList.remove('is-loading');
      regionalContainer.classList.remove('is-loading');
      specialtyTableBody.classList.remove('is-loading');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // 4. Cập nhật giao diện Trạng thái Node (Node Health)
  function updateNodeHealthDisplay(nodeHealth) {
    if (!nodeHealth) return;

    // Node Hà Nội
    const hanoiOnline = nodeHealth.hanoi?.status === 'ONLINE';
    if (headerNodeHanoi) {
      const pulseDot = headerNodeHanoi.querySelector('.status-pulse');
      const statusText = headerNodeHanoi.querySelector('.node-status-text');
      if (hanoiOnline) {
        pulseDot.className = 'status-pulse online w-2 h-2 rounded-full bg-emerald-500';
        statusText.className = 'node-status-text text-xs font-bold text-emerald-600';
        statusText.textContent = 'ONLINE';
      } else {
        pulseDot.className = 'status-pulse offline w-2 h-2 rounded-full bg-red-500';
        statusText.className = 'node-status-text text-xs font-bold text-red-600';
        statusText.textContent = 'OFFLINE';
      }
    }

    // Node TP.HCM
    const hcmOnline = nodeHealth.hcm?.status === 'ONLINE';
    if (headerNodeHcm) {
      const pulseDot = headerNodeHcm.querySelector('.status-pulse');
      const statusText = headerNodeHcm.querySelector('.node-status-text');
      if (hcmOnline) {
        pulseDot.className = 'status-pulse online w-2 h-2 rounded-full bg-emerald-500';
        statusText.className = 'node-status-text text-xs font-bold text-emerald-600';
        statusText.textContent = 'ONLINE';
      } else {
        pulseDot.className = 'status-pulse offline w-2 h-2 rounded-full bg-red-500';
        statusText.className = 'node-status-text text-xs font-bold text-red-600';
        statusText.textContent = 'OFFLINE';
      }
    }
  }

  // 5. Cập nhật Banner Cảnh báo Chịu lỗi (Fault-Tolerance Warnings)
  function updateSystemWarnings(warnings = []) {
    if (warnings && warnings.length > 0) {
      systemWarningList.innerHTML = warnings
        .map((w) => `<div class="flex items-center gap-1.5"><i data-lucide="alert-octagon" class="w-3.5 h-3.5 text-amber-600"></i><span>${escapeHtml(w)}</span></div>`)
        .join('');
      systemWarningBanner.classList.remove('hidden');
    } else {
      systemWarningList.innerHTML = '';
      systemWarningBanner.classList.add('hidden');
    }
  }

  // 6. Cập nhật 4 Card KPI
  function updateKpiCards(overview) {
    if (!overview) return;

    const total = overview.total_appointments || 0;
    const pending = overview.status_breakdown?.pending || 0;
    const confirmed = overview.status_breakdown?.confirmed || 0;
    const cancelled = overview.status_breakdown?.cancelled || 0;
    const patients = overview.total_patients || 0;
    const completionRate = overview.completion_rate || '0.0%';

    kpiTotalAppointments.textContent = formatNumber(total);
    kpiPendingAppointments.textContent = formatNumber(pending);
    kpiConfirmedAppointments.textContent = formatNumber(confirmed);
    kpiTotalPatients.textContent = formatNumber(patients);
    kpiCompletionRate.textContent = completionRate;
    kpiCancelledAppointments.textContent = formatNumber(cancelled);

    const cancelRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) + '%' : '0.0%';
    kpiCancellationRate.textContent = cancelRate;
  }

  // 7. Cập nhật Phân bổ Khu vực (Regional Distribution)
  function updateRegionalDistribution(regions = []) {
    regions.forEach((region) => {
      const isHanoi = Number(region.clinic_id) === 1;
      const isOnline = region.status === 'ONLINE';

      const statusBadge = isHanoi ? hanoiStatusBadge : hcmStatusBadge;
      const countText = isHanoi ? hanoiCountText : hcmCountText;
      const percentText = isHanoi ? hanoiPercentText : hcmPercentText;
      const progressBar = isHanoi ? hanoiProgressBar : hcmProgressBar;

      if (!statusBadge || !countText || !percentText || !progressBar) return;

      if (isOnline) {
        statusBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700';
        statusBadge.textContent = 'ONLINE';
        countText.className = 'text-sm font-extrabold text-slate-900';
        countText.textContent = `${formatNumber(region.appointments)} ca`;
        percentText.className = isHanoi ? 'font-bold text-teal-700' : 'font-bold text-violet-700';
        percentText.textContent = region.percentage || '0.0%';

        progressBar.classList.remove('progress-fill-offline');
        progressBar.style.width = region.percentage || '0%';
      } else {
        // Node OFFLINE: Hiển thị nhãn [Mất kết nối] và vạch sọc đỏ cảnh báo
        statusBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700';
        statusBadge.textContent = 'OFFLINE';
        countText.className = 'text-xs font-bold text-red-600';
        countText.textContent = '[Mất kết nối]';
        percentText.className = 'font-bold text-red-600';
        percentText.textContent = 'N/A';

        progressBar.classList.add('progress-fill-offline');
        progressBar.style.width = '100%';
      }
    });
  }

  // 8. Cập nhật Bảng Chuyên khoa (Specialty Analytics)
  function updateSpecialtyAnalytics(specialties = []) {
    if (!specialties || specialties.length === 0) {
      specialtyCountBadge.textContent = '0 Chuyên khoa';
      specialtyTableBody.innerHTML = '';
      specialtyEmptyState.classList.remove('hidden');
      return;
    }

    specialtyEmptyState.classList.add('hidden');
    specialtyCountBadge.textContent = `${specialties.length} Chuyên khoa`;

    const htmlRows = specialties.map((spec, index) => {
      const rank = index + 1;
      let rankClass = 'rank-default';
      if (rank === 1) rankClass = 'rank-1';
      else if (rank === 2) rankClass = 'rank-2';
      else if (rank === 3) rankClass = 'rank-3';

      const percent = spec.percentage || '0.0%';

      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-3">
            <span class="rank-badge ${rankClass}">${rank}</span>
          </td>
          <td class="py-3 px-3 font-semibold text-slate-800">
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              <span>${escapeHtml(spec.specialty)}</span>
            </div>
          </td>
          <td class="py-3 px-3 text-right font-extrabold text-slate-900">
            ${formatNumber(spec.total_appointments)}
          </td>
          <td class="py-3 px-3 text-right font-bold text-blue-700">
            ${percent}
          </td>
          <td class="py-3 px-3">
            <div class="progress-track">
              <div class="progress-fill progress-fill-specialty" style="width: ${percent};"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    specialtyTableBody.innerHTML = htmlRows;
  }

  // 9. API Fetch Logic
  async function fetchDashboardData(params = {}) {
    setLoadingState(true);
    lastQueryParams = { ...params };

    const query = new URLSearchParams();
    if (params.from_date) query.append('from_date', params.from_date);
    if (params.to_date) query.append('to_date', params.to_date);

    const queryString = query.toString();
    const endpoint = `/api/v1/admin/dashboard/stats${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Lỗi máy chủ (${response.status})`);
      }

      hideAlert();
      const data = result.data;

      // Cập nhật khoảng thời gian hiển thị
      if (data.time_range) {
        activeRangeText.textContent = `${data.time_range.from_date} ➔ ${data.time_range.to_date}`;
        // Nếu input đang trống, điền giá trị mặc định từ backend trả về
        if (!fromDateInput.value && data.time_range.from_date) {
          fromDateInput.value = data.time_range.from_date;
        }
        if (!toDateInput.value && data.time_range.to_date) {
          toDateInput.value = data.time_range.to_date;
        }
      }

      // Render từng khối dữ liệu
      updateNodeHealthDisplay(data.node_health);
      updateSystemWarnings(data.system_warnings || []);
      updateKpiCards(data.overview);
      updateRegionalDistribution(data.regional_distribution || []);
      updateSpecialtyAnalytics(data.specialty_analytics || []);

    } catch (err) {
      console.error('[Dashboard Error]:', err);
      showAlert(
        'Không Thể Tải Báo Cáo Thống Kê',
        err.message || 'Đã xảy ra sự cố gián đoạn khi kết nối tới máy chủ phân tán. Vui lòng kiểm tra lại đường truyền.',
        'danger',
        true
      );
    } finally {
      setLoadingState(false);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // 10. Form Filter Submit Handler
  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isFetching) return;

    const fromDate = fromDateInput.value.trim();
    const toDate = toDateInput.value.trim();

    // Client-side Validation: from_date không được lớn hơn to_date
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      showAlert(
        'Khoảng Thời Gian Không Hợp Lệ',
        'Ngày bắt đầu (Từ Ngày) không được lớn hơn Ngày kết thúc (Đến Ngày). Vui lòng chọn lại!',
        'warning',
        false
      );
      fromDateInput.focus();
      return;
    }

    fetchDashboardData({
      from_date: fromDate || undefined,
      to_date: toDate || undefined
    });
  });

  // 11. Reset Button Handler (30 Ngày Gần Nhất)
  resetBtn.addEventListener('click', () => {
    if (isFetching) return;
    fromDateInput.value = '';
    toDateInput.value = '';
    hideAlert();
    fetchDashboardData({});
  });

  // 12. Utility Functions
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

  // Khởi tạo icons và tải dữ liệu mặc định 30 ngày lần đầu
  if (window.lucide) window.lucide.createIcons();
  fetchDashboardData({});
});
