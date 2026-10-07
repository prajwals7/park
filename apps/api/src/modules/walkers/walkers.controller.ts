import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { WalkersService } from './walkers.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import {
  listWalkersQuerySchema,
  ListWalkersQueryInput,
  createWalkerSchema,
  CreateWalkerInput,
  updateWalkerSchema,
  UpdateWalkerInput,
  softDeleteWalkerSchema,
  SoftDeleteWalkerInput,
  renewWalkerPassSchema,
  RenewWalkerPassInput,
} from '@wpd/shared';

@ApiTags('Walkers')
@ApiBearerAuth()
@Controller('walkers')
export class WalkersController {
  constructor(private walkersService: WalkersService) {}

  // 1. List / Search Walkers
  @Get()
  @ApiOperation({ summary: 'List walkers with search, status filters, and pagination' })
  @ApiResponse({ status: 200, description: 'List of walkers retrieved' })
  async listWalkers(
    @Query(new ZodValidationPipe(listWalkersQuerySchema)) query: ListWalkersQueryInput,
  ) {
    return this.walkersService.listWalkers(query);
  }

  // 2. Register Walker + First Payment
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a walker with initial 30-day pass and payment in one transaction',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description: 'Optional unique key to prevent double charging on retry',
  })
  @ApiResponse({ status: 201, description: 'Walker registered and payment recorded' })
  @ApiResponse({ status: 409, description: 'Duplicate passNo or phone number conflict' })
  async createWalker(
    @Body(new ZodValidationPipe(createWalkerSchema)) input: CreateWalkerInput,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    const ip = req?.ip || req?.socket.remoteAddress;
    const userAgent = req?.headers['user-agent'];

    return this.walkersService.createWalker(
      input,
      user.id,
      user.role,
      idempotencyKey,
      ip,
      userAgent,
    );
  }

  // 3. Get Walker Details
  @Get(':id')
  @ApiOperation({ summary: 'Get walker profile, active pass status, pass history, and payments' })
  @ApiResponse({ status: 200, description: 'Walker profile found' })
  @ApiResponse({ status: 404, description: 'Walker not found or deleted' })
  async getWalker(@Param('id') id: string) {
    return this.walkersService.getWalker(id);
  }

  // 4. Update Walker Details (Admin Only)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update walker details (Admin only, audited)' })
  @ApiResponse({ status: 200, description: 'Walker updated' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires Admin role' })
  async updateWalker(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWalkerSchema)) input: UpdateWalkerInput,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.walkersService.updateWalker(id, input, user.id, ip, userAgent);
  }

  // 5. Soft Delete Walker (Admin Only)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Soft delete walker record with mandatory reason (Admin only)' })
  @ApiResponse({ status: 200, description: 'Walker soft-deleted' })
  async softDeleteWalker(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(softDeleteWalkerSchema)) input: SoftDeleteWalkerInput,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.walkersService.softDeleteWalker(id, input, user.id, ip, userAgent);
  }

  // 6. Restore Soft-Deleted Walker (Admin Only)
  @Post(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore soft-deleted walker (Admin only)' })
  @ApiResponse({ status: 200, description: 'Walker restored' })
  async restoreWalker(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.walkersService.restoreWalker(id, user.id, ip, userAgent);
  }

  // 7. Renew Walker Pass + Payment
  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renew walker pass extending max(today, current expiry) by 30 days in one transaction',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description: 'Optional key to prevent double charging on retry',
  })
  @ApiResponse({ status: 200, description: 'Pass renewed successfully' })
  async renewWalkerPass(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(renewWalkerPassSchema)) input: RenewWalkerPassInput,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    const ip = req?.ip || req?.socket.remoteAddress;
    const userAgent = req?.headers['user-agent'];

    return this.walkersService.renewWalkerPass(id, input, user.id, idempotencyKey, ip, userAgent);
  }
}
