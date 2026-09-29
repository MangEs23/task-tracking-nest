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

@Injectable()
export class EpicAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('User tidak terautentikasi');
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
      where: { project_id: epic.project_id, user_id: userId, role: 'admin' },
    });

    if (!member) {
      throw new ForbiddenException(
        'Only project admin can perform this action',
      );
    }

    return true;
  }
}
