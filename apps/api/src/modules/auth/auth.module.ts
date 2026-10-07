import { Module } from '@nestjs/common';
import { AuthMaintenanceService } from './auth-maintenance.service.js';
import { AuthController } from './auth.controller.js';
import { AuthCookies } from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { SessionsService } from './sessions.service.js';
import { TokenService } from './token.service.js';
import { VerificationService } from './verification.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookies,
    AuthMaintenanceService,
    SessionsService,
    TokenService,
    VerificationService,
    AuthGuard,
    CsrfGuard,
    RolesGuard,
  ],
  exports: [
    AuthCookies,
    AuthGuard,
    CsrfGuard,
    RolesGuard,
    SessionsService,
    TokenService,
    VerificationService,
  ],
})
export class AuthModule {}
