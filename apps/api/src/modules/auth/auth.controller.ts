import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Res,
  Patch,
  Param,
  UsePipes,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public, Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import {
  loginSchema,
  LoginInput,
  verifyTotpSchema,
  VerifyTotpInput,
  changePasswordSchema,
  ChangePasswordInput,
  forgotPasswordSchema,
  ForgotPasswordInput,
  resetPasswordSchema,
  ResetPasswordInput,
  changeUserRoleSchema,
  ChangeUserRoleInput,
} from '@wpd/shared';

const REFRESH_COOKIE_NAME = 'wpd_refresh_token';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 1. Login (Public, Rate Limited strictly: max 5 attempts / min)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(input, ip, userAgent);

    if (result.requiresTotp) {
      return {
        success: true,
        requiresTotp: true,
        challengeToken: result.challengeToken,
      };
    }

    if (result.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
    }

    return {
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // 2. Verify TOTP 2FA (Public)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(verifyTotpSchema))
  async verifyTotp(
    @Body() input: VerifyTotpInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.verifyTotp(input, ip, userAgent);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      success: true,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // 3. Rotate Refresh Token (Public, reads httpOnly cookie)
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.rotateRefreshToken(rawRefreshToken, ip, userAgent);
    this.setRefreshCookie(res, result.refreshToken);

    return {
      success: true,
      accessToken: result.accessToken,
    };
  }

  // 4. Logout Single Session
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.logout(rawRefreshToken, user.id, ip, userAgent);
    this.clearRefreshCookie(res);

    return { success: true, message: 'Logged out successfully' };
  }

  // 5. Logout All Devices
  @Post('logout-all-devices')
  @HttpCode(HttpStatus.OK)
  async logoutAllDevices(
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.logoutAllDevices(user.id, ip, userAgent);
    this.clearRefreshCookie(res);

    return { success: true, message: 'Terminated all active sessions' };
  }

  // 6. Current User Profile
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserData) {
    return { success: true, user };
  }

  // 7. Change Password
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() input: ChangePasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.changePassword(user.id, input, ip, userAgent);
    this.clearRefreshCookie(res);

    return { success: true, message: 'Password updated. Please log in again.' };
  }

  // 8. Forgot Password (Public)
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() input: ForgotPasswordInput, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.forgotPassword(input, ip, userAgent);
  }

  // 9. Reset Password (Public)
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(
    @Body() input: ResetPasswordInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.resetPassword(input, ip, userAgent);
    this.clearRefreshCookie(res);

    return { success: true, message: 'Password reset successfully' };
  }

  // 10. Generate 2FA Provisioning Secret & Backup Codes
  @Post('setup-2fa')
  async setup2fa(@CurrentUser() user: CurrentUserData) {
    return {
      success: true,
      ...(await this.authService.generateTotpSecret(user.id)),
    };
  }

  // 11. Role Change (Admin/SuperAdmin Only)
  @Patch('users/:id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UsePipes(new ZodValidationPipe(changeUserRoleSchema))
  async changeUserRole(
    @CurrentUser() user: CurrentUserData,
    @Param('id') targetUserId: string,
    @Body() input: ChangeUserRoleInput,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await this.authService.changeRole(user.id, targetUserId, input.role as Role, ip, userAgent);

    return { success: true, message: `User role updated to ${input.role}` };
  }

  // Helper: Secure httpOnly, SameSite=strict cookie
  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: '/api/v1/auth',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
  }
}
