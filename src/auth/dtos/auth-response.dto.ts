import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../models/user.model';

export class SafeUserDto {
  @ApiProperty({ example: 'usr_89f07a21-9e77-4c4f-9e77-628b3a0a3821', description: 'UUID định danh duy nhất của người dùng' })
  userId: string;

  @ApiProperty({ example: 'branch_hn_01', description: 'Mã chi nhánh cơ sở y tế gốc của người dùng' })
  branchId: string;

  @ApiProperty({ example: UserRole.DOCTOR, enum: UserRole, description: 'Vai trò của người dùng trong hệ thống' })
  roleId: UserRole;

  @ApiProperty({ example: 'bacsi.nguyenvana', description: 'Tên đăng nhập' })
  username: string;

  @ApiProperty({ example: true, description: 'Trạng thái hoạt động của tài khoản' })
  isActive: boolean;
}

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfODlmMDdhMjEtOWU3Ny00YzRmLTllNzctNjI4YjNhMGEzODIxIiwicm9sZSI6IlJPTEVfRE9DVE9SIiwiYnJhbmNoX2lkIjoiYnJhbmNoX2huXzAxIiwiaWF0IjoxNzMwMTYwMDAwLCJleHAiOjE3MzAxNjA5MDB9...',
    description: 'JWT Access Token có thời hạn 15 phút, dùng để xác thực API',
  })
  accessToken: string;

  @ApiProperty({
    example: 'Bearer',
    description: 'Loại Token xác thực',
  })
  tokenType: string;

  @ApiProperty({
    example: 900,
    description: 'Thời gian sống của Access Token tính bằng giây (15 phút = 900s)',
  })
  expiresIn: number;

  @ApiProperty({
    type: SafeUserDto,
    description: 'Thông tin hồ sơ người dùng đã đăng nhập (đã loại bỏ mật khẩu băm)',
  })
  user: SafeUserDto;
}

