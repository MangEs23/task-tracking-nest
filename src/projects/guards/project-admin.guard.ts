import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

@Injectable()
export class ProjectAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User tidak terautentikasi');
    }

    const userId = user.id || user.sub;
    const projectId = request.params.projectId || request.params.id;

    if (!projectId) {
      throw new NotFoundException(
        'Project ID tidak ditemukan pada parameter URL',
      );
    }
    if (!isUUID(projectId)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }

    const member = await this.prisma.t_project_member.findFirst({
  where: { project_id: projectId, user_id: userId },
});
if (!member) throw new ForbiddenException(AUTH_MESSAGES.NOT_MEMBER);
if (member.role !== 'admin') throw new ForbiddenException(AUTH_MESSAGES.NOT_ADMIN);

request.projectMember = member;
return true;
  }
}
