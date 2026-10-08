import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import {
  dashboardOverviewQuerySchema,
  DashboardOverviewQueryInput,
  listUsersQuerySchema,
  ListUsersQueryInput,
  createUserSchema,
  CreateUserInput,
  updateUserStatusSchema,
  UpdateUserStatusInput,
  adminResetPasswordSchema,
  AdminResetPasswordInput,
  force2faSchema,
  Force2faInput,
  createGateSchema,
  CreateGateInput,
  updateGateSchema,
  UpdateGateInput,
  updateSettingsSchema,
  UpdateSettingsInput,
} from '@wpd/shared';

@ApiTags('Admin Operations')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 1. Dashboard Overview Analytics (KPI Cards + 4 Charts Series)
  @Get('dashboard')
  @ApiOperation({ summary: 'Get unified KPI cards and chart analytics for Admin Dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics and chart series retrieved' })
  async getDashboard(
    @Query(new ZodValidationPipe(dashboardOverviewQuerySchema))
    query: DashboardOverviewQueryInput,
  ) {
    return this.adminService.getDashboard(query);
  }

  // 2. Staff Management: List Users
  @Get('users')
  @ApiOperation({ summary: 'List system users (Collectors, Admins) with status and search' })
  @ApiResponse({ status: 200, description: 'Users list retrieved' })
  async listUsers(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQueryInput,
  ) {
    return this.adminService.listUsers(query);
  }

  // 3. Staff Management: Create User
  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new Collector or Admin staff user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(
    @Body(new ZodValidationPipe(createUserSchema)) input: CreateUserInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.createUser(input, admin.id, ip, userAgent);
  }

  // 4. Staff Management: Update Status (Active / Disabled)
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Enable or disable a staff user account' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) input: UpdateUserStatusInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.updateUserStatus(id, input, admin.id, ip, userAgent);
  }

  // 5. Staff Management: Admin Reset Password
  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin reset password for a staff user and terminate active sessions' })
  @ApiResponse({ status: 200, description: 'Password reset and sessions invalidated' })
  async resetUserPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adminResetPasswordSchema)) input: AdminResetPasswordInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.resetUserPassword(id, input, admin.id, ip, userAgent);
  }

  // 6. Staff Management: Force 2FA or Reset 2FA
  @Patch('users/:id/force-2fa')
  @ApiOperation({ summary: 'Force or reset 2FA configuration for a staff user' })
  @ApiResponse({ status: 200, description: '2FA state updated' })
  async force2fa(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(force2faSchema)) input: Force2faInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.force2fa(id, input, admin.id, ip, userAgent);
  }

  // 7. Gates: List Gates
  @Get('gates')
  @ApiOperation({ summary: 'List entry gates with activity statistics' })
  @ApiResponse({ status: 200, description: 'Gates retrieved' })
  async listGates() {
    return this.adminService.listGates();
  }

  // 8. Gates: Create Gate (SUPER_ADMIN only)
  @Post('gates')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new entry gate' })
  @ApiResponse({ status: 201, description: 'Gate created' })
  async createGate(
    @Body(new ZodValidationPipe(createGateSchema)) input: CreateGateInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.createGate(input, admin.id, ip, userAgent);
  }

  // 9. Gates: Update Gate (SUPER_ADMIN only)
  @Patch('gates/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update gate details and active status' })
  @ApiResponse({ status: 200, description: 'Gate updated' })
  async updateGate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGateSchema)) input: UpdateGateInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.updateGate(id, input, admin.id, ip, userAgent);
  }

  // 10. Settings: Get Settings
  @Get('settings')
  @ApiOperation({ summary: 'Get system settings (tariff, validity, alert threshold)' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  // 11. Settings: Update Settings (SUPER_ADMIN only)
  @Patch('settings')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update system settings (tariff, validity, threshold)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(
    @Body(new ZodValidationPipe(updateSettingsSchema)) input: UpdateSettingsInput,
    @CurrentUser() admin: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.adminService.updateSettings(input, admin.id, ip, userAgent);
  }
}
