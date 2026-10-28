import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'bacsi.nguyenvana',
    description: 'Tên đăng nhập hoặc địa chỉ email của người dùng',
  })
  @IsNotEmpty({ message: 'Tên đăng nhập không được để trống' })
  @IsString({ message: 'Tên đăng nhập phải là chuỗi ký tự' })
  username: string;

  @ApiProperty({
    example: 'DoctorSecret@2026',
    description: 'Mật khẩu người dùng (tối thiểu 6 ký tự)',
  })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(6, { message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự' })
  password: string;
}

