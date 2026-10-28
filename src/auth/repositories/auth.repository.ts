import { Injectable } from '@nestjs/common';
import {
  IAuthRepository,
  RefreshTokenRecord,
  LoginAuditRecord,
} from './auth.repository.interface';
import { UserModel, UserRole } from '../models/user.model';

@Injectable()
export class AuthRepository implements IAuthRepository {
  // In-memory Store phục vụ môi trường chạy thử và unit test độc lập
  private readonly users: Map<string, UserModel> = new Map();
  private readonly refreshTokens: Map<string, RefreshTokenRecord> = new Map();
  private readonly auditLogs: LoginAuditRecord[] = [];

  constructor() {
    // Khởi tạo tài khoản mẫu ban đầu để kiểm thử
    // Mật khẩu mặc định: 'DoctorSecret@2026' (băm bcrypt với cost 10: '$2a$10$wE99J5k0FvF.hOiq88pLwefH3qK3Q4c0a5rE9xLd2Xv6o3w9E.mSe')
    const sampleDoctor = new UserModel({
      userId: 'usr_89f07a21-9e77-4c4f-9e77-628b3a0a3821',
      branchId: 'branch_hn_01',
      roleId: UserRole.DOCTOR,
      username: 'bacsi.nguyenvana',
      passwordHash: '$2a$10$wE99J5k0FvF.hOiq88pLwefH3qK3Q4c0a5rE9xLd2Xv6o3w9E.mSe',
      failedLoginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    });
    this.users.set(sampleDoctor.username, sampleDoctor);
  }

  async findByUsername(username: string): Promise<UserModel | null> {
    const user = this.users.get(username);
    if (!user) return null;
    // Trả về bản sao thực thể mới
    return new UserModel({ ...user });
  }

  async findById(userId: string): Promise<UserModel | null> {
    for (const user of this.users.values()) {
      if (user.userId === userId) {
        return new UserModel({ ...user });
      }
    }
    return null;
  }

  async save(user: UserModel): Promise<void> {
    this.users.set(user.username, user);
  }

  async saveRefreshToken(tokenRecord: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(tokenRecord.tokenHash, tokenRecord);
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const token = this.refreshTokens.get(tokenHash);
    return token ? { ...token } : null;
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    for (const [hash, record] of this.refreshTokens.entries()) {
      if (record.familyId === familyId) {
        this.refreshTokens.set(hash, { ...record, isRevoked: true });
      }
    }
  }

  async recordLoginAudit(auditRecord: LoginAuditRecord): Promise<void> {
    this.auditLogs.push(auditRecord);
  }
}

