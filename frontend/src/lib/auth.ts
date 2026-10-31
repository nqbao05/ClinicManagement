export interface UserSession {
  userId: string;
  branchId?: string;
  roleId?: string;
  username: string;
  isActive?: boolean;
}

export interface AuthResponseData {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  user?: UserSession;
  message?: string | string[];
}

/**
 * Lưu trữ phiên xác thực vào LocalStorage và cập nhật trạng thái Client
 */
export const saveAuthSession = (data: AuthResponseData) => {
  if (typeof window === "undefined") return;

  if (data.accessToken) {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("tokenType", data.tokenType || "Bearer");
  }

  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.user.branchId) {
      localStorage.setItem("currentBranchId", data.user.branchId);
    }
  }

  // Phát event toàn cục để các component khác (như Header/Sidebar) lập tức nhận diện trạng thái đã đăng nhập
  window.dispatchEvent(new Event("auth-state-changed"));
};

/**
 * Lấy Access Token hiện tại
 */
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
};

/**
 * Lấy thông tin người dùng hiện tại
 */
export const getCurrentUser = (): UserSession | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Đăng xuất và dọn sạch phiên làm việc
 */
export const clearAuthSession = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("tokenType");
  localStorage.removeItem("user");
  localStorage.removeItem("currentBranchId");
  window.dispatchEvent(new Event("auth-state-changed"));
};

