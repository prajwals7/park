import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { StorageService } from './storage.service.js';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '@prisma/client';

@ApiTags('Storage')
@ApiBearerAuth()
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  // 1. Upload Document
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Upload document (multipart): validates magic bytes, strips EXIF, resizes, encrypts at rest',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['AADHAAR', 'PASSPORT', 'TICKET'] },
      },
      required: ['file', 'type'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded and secured' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'AADHAAR' | 'PASSPORT' | 'TICKET',
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.storageService.uploadDocument(
      file,
      type || 'TICKET',
      user.id,
      ip,
      userAgent,
    );

    return {
      success: true,
      ...result,
    };
  }

  // 2. Get Short-Lived Signed URL for viewing
  @Get(':id/signed-url')
  @ApiOperation({ summary: 'Get short-lived presigned URL to view/download document (audited)' })
  @ApiResponse({ status: 200, description: 'Presigned URL generated' })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to view document' })
  async getSignedUrl(
    @Param('id') documentId: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.storageService.getSignedDocumentUrl(documentId, user, ip, userAgent);
  }

  // 3. Admin-only Document Replacement
  @Put(':id/replace')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Admin-only document replacement (keeps audit record of old version)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Document replaced successfully' })
  async replaceDocument(
    @Param('id') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('reason') reason: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.storageService.replaceDocument(
      documentId,
      file,
      user.id,
      reason || 'Document replaced by administrative update',
      ip,
      userAgent,
    );
  }
}
