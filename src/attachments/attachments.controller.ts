import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';
import { ProjectMemberGuard } from '../projects/guards/project-member.guard';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@ApiTags('Attachments')
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  description: 'Invalid or expired token',
})
@Controller()
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Post('projects/:projectId/attachments')
  @UseGuards(ProjectMemberGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a project attachment link',
  })
  @ApiResponse({
    status: 201,
    description: 'Attachment created',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL, title, or project UUID',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate link, attachment limit, or transaction conflict',
  })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAttachmentDto,
  ) {
    return this.attachmentsService.create(
      projectId,
      req.user.id,
      dto,
    );
  }

  @Get('projects/:projectId/attachments')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({
    summary: 'List project attachments, newest first',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachments with can_edit for the current user',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project UUID',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this project',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found',
  })
  findAll(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.attachmentsService.findAll(
      projectId,
      req.user.id,
    );
  }

  @Patch('attachments/:id')
  @ApiOperation({
    summary: 'Update attachment (creator or project admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Attachment updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input, UUID, or empty body',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member, or not the creator/project admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Attachment not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate link or transaction conflict',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateAttachmentDto,
  ) {
    return this.attachmentsService.update(
      id,
      req.user.id,
      dto,
    );
  }

  @Delete('attachments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete attachment (creator or project admin)',
  })
  @ApiResponse({
    status: 204,
    description: 'Attachment deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid attachment UUID',
  })
  @ApiResponse({
    status: 403,
    description: 'Not a member, or not the creator/project admin',
  })
  @ApiResponse({
    status: 404,
    description: 'Attachment not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Transaction conflict',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.attachmentsService.remove(id, req.user.id);
  }
}