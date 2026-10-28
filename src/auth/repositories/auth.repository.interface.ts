import { UserModel } from '../models/user.model';

export interface RefreshTokenRecord {
  tokenId: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginAuditRecord {
  auditId: string;
  userId: string;
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED' | 'LOCKED';
  failureReason?: string;
  createdAt: Date;
}

export const AUTH_REPOSITORY_TOKEN = Symbol('IAuthRepository');

export interface IAuthRepository {
  findByUsername(username: string): Promise<UserModel | null>;
  findById(userId: string): Promise<UserModel | null>;
  save(user: UserModel): Promise<void>;
  saveRefreshToken(tokenRecord: RefreshTokenRecord): Promise<void>;
  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeTokenFamily(familyId: string): Promise<void>;
  recordLoginAudit(auditRecord: LoginAuditRecord): Promise<void>;
}

