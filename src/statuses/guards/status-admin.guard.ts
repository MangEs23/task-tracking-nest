import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

@Injectable()
export class StatusAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException(AUTH_MESSAGES.UNAUTHENTICATED);
    }

    const statusId = request.params.id;
    if (!isUUID(statusId)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    const status = await this.prisma.r_status.findUnique({
      where: { id: statusId },
      select: { project_id: true },
    });

    if (!status) {
      throw new NotFoundException('Status not found');
    }

    const member = await this.prisma.t_project_member.findFirst({
      where: { project_id: status.project_id, user_id: userId },
    });

    if (!member) {
      throw new ForbiddenException(AUTH_MESSAGES.NOT_MEMBER);
    }
    if (member.role !== 'admin') {
      throw new ForbiddenException(AUTH_MESSAGES.NOT_ADMIN);
    }

    request.projectMember = member;
    return true;
  }
}