import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRepository } from './repositories/auth.repository';
import { AUTH_REPOSITORY_TOKEN } from './repositories/auth.repository.interface';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'clinic_super_secret_jwt_key_2026',
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: AUTH_REPOSITORY_TOKEN,
      useClass: AuthRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}

