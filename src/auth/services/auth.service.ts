import {
  Injectable,
  Inject,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import {
  IAuthRepository,
  AUTH_REPOSITORY_TOKEN,
} from '../repositories/auth.repository.interface';
import { LoginDto } from '../dtos/login.dto';
import { AuthResponseDto } from '../dtos/auth-response.dto';

// Hash giả lập dùng để chống Timing Attack khi username không tồn tại
const DUMMY_HASH = '$2a$10$e7d9J5k0FvF.hOiq88pLwefH3qK3Q4c0a5rE9xLd2Xv6o3w9E.mSe';

export interface LoginExecutionResult {
  responseDto: AuthResponseDto;
  rawRefreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_REPOSITORY_TOKEN)
    private readonly authRepository: IAuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Xử lý xác thực đăng nhập người dùng an toàn theo tài liệu kiến trúc:
   * 1. Timing attack protection (chống đoán tài khoản qua độ trễ).
   * 2. Kiểm tra tài khoản bị tạm khóa (423 Locked).
   * 3. Băm & so khớp mật khẩu bcrypt.
   * 4. Chống Brute-force: khóa tài khoản 15 phút nếu sai 5 lần.
   * 5. Sinh cặp JWT Access Token (15m) và Refresh Token (7d).
   */
  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<LoginExecutionResult> {
    const { username, password } = loginDto;

    // 1. Tìm tài khoản trong database
    const user = await this.authRepository.findByUsername(username);

    // Kịch bản: Tài khoản không tồn tại trong hệ thống
    if (!user) {
      // Chạy dummy hash với độ trễ tương đương để kẻ gian không đoán được tài khoản qua thời gian phản hồi
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }

    // 2. Kiểm tra nếu tài khoản đang bị tạm khóa do brute-force
    if (user.isAccountLocked()) {
      const remainingMinutes = user.getRemainingLockoutMinutes();
      this.logger.warn(`Tài khoản [${username}] bị tạm khóa. Còn lại ${remainingMinutes} phút.`);
      throw new HttpException(
        {
          statusCode: HttpStatus.LOCKED,
          message: `Tài khoản đang bị tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
          remainingMinutes,
        },
        HttpStatus.LOCKED,
      );
    }

    // 3. So khớp mật khẩu đã mã hóa bằng bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    // NHÁNH THẤT BẠI: Sai mật khẩu
    if (!isPasswordValid) {
      user.recordFailedLogin();
      await this.authRepository.save(user);

      // Ghi nhật ký kiểm toán thất bại
      await this.authRepository.recordLoginAudit({
        auditId: crypto.randomUUID(),
        userId: user.userId,
        ipAddress,
        status: user.isAccountLocked() ? 'LOCKED' : 'FAILED',
        failureReason: 'WRONG_PASSWORD',
        createdAt: new Date(),
      });

      if (user.isAccountLocked()) {
        throw new HttpException(
          {
            statusCode: HttpStatus.LOCKED,
            message: 'Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.',
            remainingMinutes: 15,
          },
          HttpStatus.LOCKED,
        );
      }

      const remainingAttempts = 5 - user.failedLoginAttempts;
      throw new UnauthorizedException(
        `Tài khoản hoặc mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
      );
    }

    // NHÁNH THÀNH CÔNG: Mật khẩu chính xác
    user.resetFailedLogins();
    await this.authRepository.save(user);

    // Ghi nhận nhật ký thành công
    await this.authRepository.recordLoginAudit({
      auditId: crypto.randomUUID(),
      userId: user.userId,
      ipAddress,
      status: 'SUCCESS',
      createdAt: new Date(),
    });

    // 4. Sinh JWT Access Token (TTL 15 phút, chứa user_id, role, branch_id)
    const jwtPayload = {
      sub: user.userId,
      username: user.username,
      role: user.roleId,
      branch_id: user.branchId,
      jti: crypto.randomUUID(),
    };

    const accessToken = await this.jwtService.signAsync(jwtPayload, {
      expiresIn: '15m',
    });

    // 5. Sinh Refresh Token ngẫu nhiên bảo mật cao (Opaque Token với Family ID)
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');
    const familyId = crypto.randomUUID();

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

    await this.authRepository.saveRefreshToken({
      tokenId: crypto.randomUUID(),
      userId: user.userId,
      tokenHash,
      familyId,
      isRevoked: false,
      expiresAt,
      createdAt: new Date(),
      userAgent,
      ipAddress,
    });

    const safeUser = user.toSafeObject();

    const responseDto: AuthResponseDto = {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 phút
      user: {
        userId: safeUser.userId,
        branchId: safeUser.branchId,
        roleId: safeUser.roleId,
        username: safeUser.username,
        isActive: safeUser.isActive,
      },
    };

    return { responseDto, rawRefreshToken };
  }
}

