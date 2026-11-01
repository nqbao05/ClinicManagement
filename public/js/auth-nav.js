/**
 * Shared Auth Navigation & Session Management Widget
 * Đảm bảo đồng nhất hiển thị phiên làm việc & nút Đăng Xuất trên toàn bộ giao diện:
 * - public/patients.html (TV2)
 * - public/appointments.html (TV3)
 * - public/dashboard.html (TV4)
 */
(function () {
  'use strict';

  function renderAuthNavigation() {
    const container = document.getElementById('auth-session-widget');
    if (!container) return;

    let user = null;
    try {
      const rawSession = localStorage.getItem('userSession');
      if (rawSession) {
        user = JSON.parse(rawSession);
      }
    } catch (e) {
      console.warn('[AuthNav] Lỗi đọc session:', e);
    }

    const token = localStorage.getItem('accessToken');

    if (user && token) {
      let roleLabel = 'Bác Sĩ';
      let roleClass = 'bg-blue-100 text-blue-700 border-blue-200';
      if (user.roleId === 'ROLE_ADMIN') {
        roleLabel = 'Admin';
        roleClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
      } else if (user.roleId === 'ROLE_PATIENT') {
        roleLabel = 'Bệnh Nhân';
        roleClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
      }

      const branchLabel = user.branchId === 'Branch_HN_01'
        ? 'Cơ sở Hà Nội'
        : user.branchId === 'Branch_HCM_01'
          ? 'Cơ sở TP.HCM'
          : 'Hệ thống';

      const displayName = user.username ? user.username.split('@')[0] : 'Người dùng';

      container.innerHTML = `
        <div class="flex items-center gap-2 pl-2">
          <!-- User Profile Capsule -->
          <div class="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/90 py-1 px-2.5 rounded-xl shadow-2xs">
            <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
              <i data-lucide="user" class="w-3.5 h-3.5"></i>
            </div>
            <div class="flex flex-col text-left">
              <div class="flex items-center gap-1.5 leading-none">
                <span class="text-xs font-bold text-slate-800">${displayName}</span>
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${roleClass}">${roleLabel}</span>
              </div>
              <span class="text-[10px] text-slate-500 mt-0.5 leading-none">${branchLabel}</span>
            </div>
          </div>

          <!-- Nút Đăng Xuất (Logout Button) -->
          <button
            type="button"
            id="navLogoutBtn"
            onclick="handleAppLogout()"
            title="Đăng xuất khỏi phiên làm việc hiện tại"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition-all duration-150 shadow-2xs cursor-pointer"
          >
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span class="hidden md:inline">Đăng Xuất</span>
          </button>
        </div>
      `;
    } else {
      // Khi chưa đăng nhập -> Hiển thị nút Cổng Đăng Nhập
      container.innerHTML = `
        <div class="flex items-center pl-2">
          <a
            href="/login"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
            <span>Đăng Nhập</span>
          </a>
        </div>
      `;
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Hàm xử lý đăng xuất tập trung cho toàn ứng dụng
  window.handleAppLogout = async function () {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(() => {});
    } catch (_) {}

    // Xóa toàn bộ token và phiên cục bộ
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userSession');
    localStorage.removeItem('currentBranchId');
    localStorage.removeItem('userRole');

    // Chuyển hướng ngay về cổng đăng nhập
    window.location.href = '/login';
  };

  // Tự động kích hoạt khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderAuthNavigation);
  } else {
    renderAuthNavigation();
  }
})();

