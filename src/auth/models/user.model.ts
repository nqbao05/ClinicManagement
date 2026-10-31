export enum UserRole {
  PATIENT = 'ROLE_PATIENT',
  DOCTOR = 'ROLE_DOCTOR',
  RECEPTIONIST = 'ROLE_RECEPTIONIST',
  ADMIN = 'ROLE_ADMIN',
}

export interface UserAttributes {
  userId: string;
  branchId: string;
  roleId: UserRole;
  username: string;
  passwordHash: string;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserModel {
  public readonly userId: string;
  public readonly branchId: string;
  public readonly roleId: UserRole;
  public readonly username: string;
  public readonly passwordHash: string;
  public failedLoginAttempts: number;
  public lockedUntil: Date | null;
  public isActive: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(attributes: UserAttributes) {
    this.userId = attributes.userId;
    this.branchId = attributes.branchId;
    this.roleId = attributes.roleId;
    this.username = attributes.username;
    this.passwordHash = attributes.passwordHash;
    this.failedLoginAttempts = attributes.failedLoginAttempts ?? 0;
    this.lockedUntil = attributes.lockedUntil ?? null;
    this.isActive = attributes.isActive ?? true;
    this.createdAt = attributes.createdAt ?? new Date();
    this.updatedAt = attributes.updatedAt ?? new Date();
  }

  /**
   * Kiểm tra xem tài khoản có đang bị tạm khóa (do brute-force) hay không
   */
  public isAccountLocked(): boolean {
    if (!this.lockedUntil) {
      return false;
    }
    return new Date() < this.lockedUntil;
  }

  /**
   * Tính số phút còn lại trước khi tài khoản được mở khóa
   */
  public getRemainingLockoutMinutes(): number {
    if (!this.isAccountLocked() || !this.lockedUntil) {
      return 0;
    }
    const diffMs = this.lockedUntil.getTime() - Date.now();
    return Math.ceil(diffMs / (60 * 1000));
  }

  /**
   * Ghi nhận đăng nhập sai và tự động khóa 15 phút nếu sai liên tiếp >= 5 lần
   */
  public recordFailedLogin(): void {
    this.failedLoginAttempts += 1;
    this.updatedAt = new Date();

    if (this.failedLoginAttempts >= 5) {
      // Khóa tài khoản trong 15 phút
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  /**
   * Khôi phục số lần thử sau khi đăng nhập thành công
   */
  public resetFailedLogins(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.updatedAt = new Date();
  }

  /**
   * Chuyển đổi sang đối tượng an toàn để trả về client (loại bỏ password_hash)
   */
  public toSafeObject(): Omit<UserAttributes, 'passwordHash'> {
    return {
      userId: this.userId,
      branchId: this.branchId,
      roleId: this.roleId,
      username: this.username,
      failedLoginAttempts: this.failedLoginAttempts,
      lockedUntil: this.lockedUntil,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

