import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
    // Mendukung penamaan parameter :projectId maupun :id
    const projectId = request.params.projectId || request.params.id;

    if (!projectId) {
      throw new NotFoundException('Project ID tidak ditemukan pada parameter URL');
    }

    const member = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: userId,
        role: 'admin',
      },
    });

    if (!member) {
      throw new ForbiddenException('Aksi ini hanya dapat dilakukan oleh Admin proyek');
    }

    request.projectMember = member;

    return true;
  }
}