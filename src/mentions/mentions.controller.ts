import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  MentionInboxQueryDto,
  MentionProjectFilterDto,
  ReadAllMentionsDto,
} from './dto/mention-query.dto';
import { MentionsService } from './mentions.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@ApiTags('Mentions')
@ApiBearerAuth()
@ApiResponse({
  status: 401,
  description: 'Invalid or expired token',
})
@Controller('mentions')
export class MentionsController {
  constructor(
    private readonly mentionsService: MentionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List mentions received by the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Inbox items and next_cursor',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query or cursor',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: MentionInboxQueryDto,
  ) {
    return this.mentionsService.findAll(req.user.id, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Count unread mentions for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project UUID',
  })
  unreadCount(
    @Req() req: AuthenticatedRequest,
    @Query() query: MentionProjectFilterDto,
  ) {
    return this.mentionsService.unreadCount(req.user.id, query);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark an owned mention as read',
  })
  @ApiResponse({
    status: 200,
    description: 'Mention ID and original read timestamp',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid mention UUID',
  })
  @ApiResponse({
    status: 404,
    description: 'Mention not found or belongs to another user',
  })
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    id: string,
  ) {
    return this.mentionsService.markRead(req.user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all owned unread mentions as read',
  })
  @ApiBody({
    type: ReadAllMentionsDto,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Number of mentions updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid project UUID',
  })
  readAll(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReadAllMentionsDto,
  ) {
    return this.mentionsService.readAll(req.user.id, dto ?? {});
  }
}