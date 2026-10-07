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
export class EpicAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException(AUTH_MESSAGES.UNAUTHENTICATED);
    }

    const epicId = request.params.id;
    if (!isUUID(epicId)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    const epic = await this.prisma.t_epic.findUnique({
      where: { id: epicId },
      select: { project_id: true },
    });
    if (!epic) {
      throw new NotFoundException('Epic not found');
    }

    const member = await this.prisma.t_project_member.findFirst({
      where: { project_id: epic.project_id, user_id: userId },
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
