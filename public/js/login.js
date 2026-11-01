/**
 * Clinic Management Portal - Authentication Client Controller
 * File: public/js/login.js
 * Thành viên 1: Phân hệ Xác thực & Cổng Đăng nhập (Authentication Portal)
 */

(function () {
  'use strict';

  // ================== DOM ELEMENTS ==================
  const loginForm = document.getElementById('loginForm');
  const loginCard = document.getElementById('loginCard');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const eyeIcon = document.getElementById('eyeIcon');
  const submitBtn = document.getElementById('submitBtn');
  const btnIcon = document.getElementById('btnIcon');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const alertBanner = document.getElementById('alertBanner');
  const alertIcon = document.getElementById('alertIcon');
  const alertTitle = document.getElementById('alertTitle');
  const alertMessage = document.getElementById('alertMessage');
  const rememberMe = document.getElementById('rememberMe');

  // Khởi tạo icon Lucide ngay khi nạp trang
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // ================== 1. KIỂM TRA PHIÊN & XỬ LÝ ĐĂNG XUẤT ==================
  function checkExistingSession() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isLogout = urlParams.get('logout') === 'success';

      // Trường hợp 1: Người dùng vừa bấm "Đăng xuất" từ giao diện Bệnh án
      if (isLogout) {
        showAlert(
          'success',
          'Đã đăng xuất thành công',
          'Phiên làm việc trước đó đã được giải phóng an toàn. Vui lòng chọn hoặc nhập tài khoản khác để đăng nhập.'
        );
        return;
      }

      // Trường hợp 2: Kiểm tra token còn lưu trong LocalStorage
      const token = localStorage.getItem('accessToken');
      const userRaw = localStorage.getItem('userSession');

      if (token && userRaw && !urlParams.get('force')) {
        let user = {};
        try { user = JSON.parse(userRaw); } catch (e) {}

        let roleName = 'Bác Sĩ';
        if (user.roleId === 'ROLE_ADMIN') roleName = 'Quản Trị Viên (Admin)';
        if (user.roleId === 'ROLE_PATIENT') roleName = 'Bệnh Nhân';

        showAlert(
          'success',
          `Phiên hoạt động: ${user.username || 'Người dùng'} (${roleName})`,
          `Bạn đang có phiên đăng nhập hợp lệ. <a href="/patients-ui" class="font-bold underline text-blue-700 hover:text-blue-900 ml-1">Vào Bệnh Án</a> hoặc <button onclick="logoutFromLogin()" class="font-bold underline text-red-600 hover:text-red-800 ml-2 inline">Đăng xuất / Đổi tài khoản</button>`
        );
      }
    } catch (e) {
      console.warn('Lỗi kiểm tra session:', e);
    }
  }

  // Hàm đăng xuất ngay tại trang Login (để đổi tài khoản khác)
  window.logoutFromLogin = function () {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userSession');
    localStorage.removeItem('currentBranchId');
    localStorage.removeItem('userRole');

    fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});

    showAlert(
      'success',
      'Đã xóa phiên đăng nhập cũ',
      'Bạn có thể chọn tài khoản Bác sĩ, Admin hoặc Bệnh nhân bên dưới để đăng nhập lại.'
    );

    usernameInput.value = '';
    passwordInput.value = '';
    usernameInput.focus();
  };

  // ================== 2. BẬT / TẮT HIỂN THỊ MẬT KHẨU (EYE TOGGLE) ==================
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', function () {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

      // Đổi icon giữa eye và eye-off
      if (eyeIcon) {
        eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
        if (window.lucide) {
          window.lucide.createIcons();
        }
      }
    });
  }

  // ================== 3. CLIENT-SIDE VALIDATION ==================
  function validateField(input, errorElement, message) {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      return false;
    }
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
    errorElement.textContent = '';
    errorElement.classList.add('hidden');
    return true;
  }

  // Xóa cảnh báo đỏ khi người dùng gõ phím
  usernameInput.addEventListener('input', function () {
    if (this.value.trim()) {
      this.classList.remove('is-invalid');
      usernameError.classList.add('hidden');
    }
  });

  passwordInput.addEventListener('input', function () {
    if (this.value.trim().length >= 6) {
      this.classList.remove('is-invalid');
      passwordError.classList.add('hidden');
    }
  });

  // ================== 4. QUẢN LÝ 3 TRẠNG THÁI MẠNG (NETWORK STATES) ==================
  /**
   * Trạng thái 1: Loading State (Khi đang gửi request)
   */
  function setLoadingState(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      usernameInput.disabled = true;
      passwordInput.disabled = true;
      btnSpinner.classList.remove('hidden');
      btnIcon.classList.add('hidden');
      btnText.textContent = 'Đang xác thực thông tin...';
    } else {
      submitBtn.disabled = false;
      usernameInput.disabled = false;
      passwordInput.disabled = false;
      btnSpinner.classList.add('hidden');
      btnIcon.classList.remove('hidden');
      btnText.textContent = 'Đăng Nhập';
    }
  }

  /**
   * Trạng thái 2 & 3: Hiển thị Alert Banner (Error hoặc Success)
   */
  function showAlert(type, title, message) {
    alertBanner.className = 'alert-banner alert-visible items-start gap-3 p-3.5 rounded-xl border text-xs sm:text-sm';

    if (type === 'error') {
      // Alert Đỏ: Khi đăng nhập thất bại / sai mật khẩu / tài khoản bị khóa
      alertBanner.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
      alertIcon.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-red-600"></i>';
      alertTitle.textContent = title || 'Đăng nhập không thành công';
      alertTitle.className = 'font-bold text-red-900';
      alertMessage.innerHTML = message;

      // Hiệu ứng rung nhẹ báo lỗi trực quan
      loginCard.classList.remove('shake-animation');
      void loginCard.offsetWidth; // Trigger reflow
      loginCard.classList.add('shake-animation');
    } else if (type === 'success') {
      // Alert Xanh: Đăng nhập thành công
      alertBanner.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-800');
      alertIcon.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>';
      alertTitle.textContent = title || 'Xác thực thành công!';
      alertTitle.className = 'font-bold text-emerald-900';
      alertMessage.innerHTML = message;
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function hideAlert() {
    alertBanner.className = 'alert-banner alert-hidden';
  }

  // ================== 5. SUBMIT FORM & GỌI API BACKEND ==================
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Client-side Validation
    let isValid = true;
    if (!username) {
      validateField(usernameInput, usernameError, 'Vui lòng nhập email hoặc tên đăng nhập.');
      isValid = false;
    }
    if (!password) {
      validateField(passwordInput, passwordError, 'Vui lòng nhập mật khẩu.');
      isValid = false;
    } else if (password.length < 6) {
      validateField(passwordInput, passwordError, 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.');
      isValid = false;
    }

    if (!isValid) return;

    // 1. Kích hoạt Loading State
    setLoadingState(true);

    try {
      let targetEndpoint = '/api/v1/auth/login';

      const payload = {
        username: username,
        email: username,
        password: password,
      };

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Nhận HttpOnly Cookie refresh_token từ máy chủ
        body: JSON.stringify(payload),
      };

      let response = await fetch(targetEndpoint, requestOptions);

      // Tự động fallback sang /auth/login nếu route /api/v1/auth/login chưa map
      if (response.status === 404) {
        targetEndpoint = '/auth/login';
        response = await fetch(targetEndpoint, requestOptions);
      }

      const result = await response.json().catch(() => null);

      // ================= 2. ERROR STATE (FALLBACK UI) =================
      if (!response.ok) {
        setLoadingState(false);

        let errorMsg = 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
        let errorTitle = 'Đăng nhập thất bại';

        if (response.status === 401) {
          errorTitle = 'Sai thông tin đăng nhập';
          errorMsg = result?.message || 'Tài khoản hoặc mật khẩu không chính xác.';
        } else if (response.status === 423) {
          errorTitle = 'Tài khoản đang bị tạm khóa';
          errorMsg = result?.message || 'Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần liên tiếp.';
        } else if (response.status === 429) {
          errorTitle = 'Quá nhiều yêu cầu';
          errorMsg = 'Quá nhiều yêu cầu đăng nhập từ thiết bị của bạn. Vui lòng thử lại sau giây lát.';
        } else if (result?.message) {
          errorMsg = Array.isArray(result.message) ? result.message.join(', ') : result.message;
        }

        showAlert('error', errorTitle, errorMsg);
        return;
      }

      // ================= 3. SUCCESS STATE =================
      // Lưu Access Token và Session vào LocalStorage
      const token = result?.accessToken || 'token_' + Date.now();
      const user = result?.user || {
        username: username,
        roleId: 'ROLE_DOCTOR',
        branchId: 'Branch_HN_01',
      };

      localStorage.setItem('accessToken', token);
      localStorage.setItem('userSession', JSON.stringify(user));
      if (user.branchId) {
        localStorage.setItem('currentBranchId', user.branchId);
      }
      if (user.roleId) {
        localStorage.setItem('userRole', user.roleId);
      }

      let roleDisplay = 'Bác Sĩ';
      if (user.roleId === 'ROLE_ADMIN') roleDisplay = 'Quản Trị Viên';
      if (user.roleId === 'ROLE_PATIENT') roleDisplay = 'Bệnh Nhân';

      showAlert(
        'success',
        'Đăng nhập thành công!',
        `Xin chào <b>${user.username || 'Người dùng'}</b> (Vai trò: ${roleDisplay}). Đang chuyển hướng vào hệ thống bệnh án...`
      );

      // Chuyển hướng sau 650ms để người dùng thấy xác nhận
      setTimeout(() => {
        window.location.href = '/patients-ui';
      }, 650);

    } catch (networkError) {
      // Bắt lỗi mất kết nối Backend
      setLoadingState(false);
      showAlert(
        'error',
        'Lỗi kết nối máy chủ',
        'Không thể kết nối tới Backend API. Vui lòng kiểm tra lại dịch vụ máy chủ hoặc kết nối mạng.'
      );
    }
  });

  // ================== 6. TIỆN ÍCH ĐIỀN TÀI KHOẢN MẪU (DEMO PILLS) ==================
  window.fillCredentials = function (user, pass) {
    usernameInput.value = user;
    passwordInput.value = pass;
    usernameInput.classList.remove('is-invalid');
    passwordInput.classList.remove('is-invalid');
    usernameError.classList.add('hidden');
    passwordError.classList.add('hidden');
    hideAlert();
    usernameInput.focus();
  };

  window.handleForgotPassword = function () {
    alert('Vui lòng liên hệ Quản trị viên phòng khám (admin@clinic.vn) để được cấp lại mật khẩu.');
  };

  // Khởi động kiểm tra session hiện có
  checkExistingSession();
})();
