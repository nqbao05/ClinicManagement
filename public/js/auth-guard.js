/**
 * ============================================================================
 * AUTHENTICATION & NAVIGATION GUARD (FRONTEND ROUTE GUARDING)
 * Tự động gắn Bearer Token, kiểm soát điều hướng và phòng thủ vai trò người dùng
 * ============================================================================
 */
(function (window) {
  'use strict';

  const TOKEN_KEY = 'clinic_auth_token';
  const USER_KEY = 'clinic_auth_user';

  const Auth = {
    getToken() {
      try {
        return localStorage.getItem(TOKEN_KEY);
      } catch (e) {
        return null;
      }
    },

    getUser() {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setSession(token, user) {
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) {}
    },

    clearSession() {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch (e) {}
      window.location.replace('/');
    },

    /**
     * Gọi API đăng nhập hệ thống
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise<{ success: boolean, message?: string, data?: Object }>}
     */
    async login(username, password) {
      try {
        const res = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const result = await res.json();
        if (res.ok && result.success && result.data && result.data.token) {
          this.setSession(result.data.token, result.data.user);
          return { success: true, data: result.data };
        }
        return { success: false, message: result.message || 'Đăng nhập không thành công' };
      } catch (err) {
        return { success: false, message: 'Lỗi mạng: Không thể kết nối tới máy chủ!' };
      }
    },

    /**
     * Navigation Guard kiểm tra quyền truy cập trang ngay lập tức
     * @param {string[]} [allowedRoles=[]] Danh sách vai trò được phép (ví dụ: ['admin'])
     */
    requireAuth(allowedRoles = []) {
      const token = this.getToken();
      const user = this.getUser();

      if (!token || !user) {
        try {
          sessionStorage.setItem('auth_notice', 'Vui lòng đăng nhập vào hệ thống để tiếp tục!');
        } catch (e) {}
        window.location.replace('/');
        return false;
      }

      if (allowedRoles.length > 0 && (!user.role || !allowedRoles.includes(user.role))) {
        try {
          sessionStorage.setItem(
            'auth_notice',
            `Vai trò [${user.role || 'Không xác định'}] không có quyền truy cập phân hệ này!`
          );
        } catch (e) {}
        window.location.replace('/');
        return false;
      }

      return true;
    },

    /**
     * Hiển thị thanh thông tin người dùng & nút đăng xuất ở Header
     */
    renderUserBar() {
      const container = document.getElementById('auth-user-bar');
      if (!container) return;

      const user = this.getUser();
      if (!user) {
        container.innerHTML = `
          <a href="/" class="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition flex items-center gap-1.5 shadow-2xs">
            <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
            <span>Đăng Nhập</span>
          </a>
        `;
      } else {
        const roleLabels = {
          admin: '<span class="px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">Admin</span>',
          staff: `<span class="px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-700 rounded-full border border-blue-200">Staff ${user.clinic_id ? '(CS ' + user.clinic_id + ')' : ''}</span>`,
          patient: '<span class="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">Bệnh Nhân</span>'
        };

        container.innerHTML = `
          <div class="flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs shadow-2xs">
            <i data-lucide="user-check" class="w-3.5 h-3.5 text-slate-600"></i>
            <span class="font-bold text-slate-800">${user.username}</span>
            ${roleLabels[user.role] || ''}
          </div>
          <button onclick="Auth.clearSession()" class="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors flex items-center gap-1 shadow-2xs" title="Đăng xuất khỏi hệ thống">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            <span class="hidden sm:inline">Đăng Xuất</span>
          </button>
        `;
      }

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
  };

  // Intercept toàn bộ lời gọi window.fetch để tự động gắn Authorization Header
  const originalFetch = window.fetch;
  window.fetch = async function (resource, config = {}) {
    const options = { ...config };
    const token = Auth.getToken();

    if (token) {
      options.headers = options.headers || {};
      if (typeof options.headers.set === 'function') {
        if (!options.headers.has('Authorization')) {
          options.headers.set('Authorization', `Bearer ${token}`);
        }
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['Authorization', `Bearer ${token}`]);
      } else {
        if (!options.headers['Authorization'] && !options.headers['authorization']) {
          options.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    }

    const response = await originalFetch(resource, options);

    // Xử lý tự động khi Token hết hạn hoặc không hợp lệ (401)
    if (response.status === 401) {
      console.warn('[Navigation Guard] 401 Unauthorized detected - Tự động đăng xuất.');
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.setItem('auth_notice', 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại!');
      } catch (e) {}
      window.location.replace('/');
    }

    return response;
  };

  // Tự động render thanh User Bar khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', () => {
    Auth.renderUserBar();
  });

  window.Auth = Auth;
})(window);
