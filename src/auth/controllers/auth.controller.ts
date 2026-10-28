import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { AuthResponseDto, SafeUserDto } from '../dtos/auth-response.dto';

@ApiTags('Authentication')
@ApiExtraModels(SafeUserDto, AuthResponseDto)
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập người dùng và cấp Token phiên làm việc',
    description:
      'Xác thực thông tin tài khoản qua bcrypt, kiểm tra chống Brute-force. ' +
      'Nếu thành công: trả về JWT Access Token (hiệu lực 15m) trong body và gắn Refresh Token (hiệu lực 7d) vào HttpOnly Cookie bảo mật.',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Thông tin tài khoản và mật khẩu đăng nhập',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Đăng nhập thành công. Access Token được trả về trong Response Body, Refresh Token được lưu trong Set-Cookie (HttpOnly, Secure, SameSite=Strict).',
    type: AuthResponseDto,
    headers: {
      'Set-Cookie': {
        description: 'refresh_token=...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800',
        schema: {
          type: 'string',
          example: 'refresh_token=a8b3...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ (sai định dạng hoặc thiếu trường bắt buộc)',
    schema: {
      example: {
        statusCode: 400,
        message: ['Mật khẩu phải có độ dài tối thiểu 6 ký tự'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Tài khoản hoặc mật khẩu không chính xác',
    schema: {
      example: {
        statusCode: 401,
        message: 'Tài khoản hoặc mật khẩu không chính xác. Bạn còn 4 lần thử.',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.LOCKED,
    description: 'Tài khoản đang bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần liên tiếp',
    schema: {
      example: {
        statusCode: 423,
        message: 'Tài khoản đã bị tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.',
        remainingMinutes: 15,
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Vượt ngưỡng Rate Limit IP tại Gateway (tối đa 10 request/phút)',
    schema: {
      example: {
        statusCode: 429,
        message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
        error: 'Too Many Requests',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Lỗi máy chủ nội bộ',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() clientIp: string,
    @Headers('user-agent') userAgent: string = 'Unknown',
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const { responseDto, rawRefreshToken } = await this.authService.login(
      loginDto,
      clientIp || '127.0.0.1',
      userAgent,
    );

    // Gắn Refresh Token vào Cookie bảo mật với đầy đủ cờ phòng chống tấn công XSS & CSRF
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookie('refresh_token', rawRefreshToken, {
      httpOnly: true, // Chống XSS (JavaScript không thể đọc được cookie)
      secure: isProduction, // Chỉ truyền qua kênh HTTPS ở môi trường production
      sameSite: 'strict', // Chống CSRF
      path: '/api/v1/auth', // Chỉ gửi cookie khi gọi các endpoint thuộc module auth
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    return responseDto;
  }
}

