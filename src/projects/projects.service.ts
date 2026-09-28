import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper internal: Pengecekan otorisasi admin di proyek tertentu.
   */
  private async checkAdminAccess(projectId: string, userId: string) {
    const project = await this.prisma.m_project.findFirst({
      where: {
        id: projectId,
        members: {
          some: { user_id: userId },
        },
      },
      include: {
        members: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan atau Anda tidak memiliki akses');
    }

    const userRole = (project as any).members?.[0]?.role;
    if (userRole !== 'admin') {
      throw new ForbiddenException('Aksi ini hanya dapat dilakukan oleh Admin proyek');
    }

    return project;
  }

  async create(userId: string, createProjectDto: CreateProjectDto) {
    try {
      const newProject = await this.prisma.m_project.create({
        data: {
          name: createProjectDto.name,
          description: createProjectDto.description,
          created_by: userId,
          members: {
            create: {
              user_id: userId,
              role: 'admin',
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          created_by: true,
          created_at: true,
        },
      });

      return {
        statusCode: 201,
        message: 'Project created successfully',
        data: {
          ...newProject,
          my_role: 'admin',
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Gagal membuat proyek: ${(error as Error).message || 'Internal server error'}`,
      );
    }
  }

  async findAll(userId: string) {
    const projects = await this.prisma.m_project.findMany({
      where: {
        members: {
          some: { user_id: userId },
        },
      },
      include: {
        members: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return {
      statusCode: 200,
      data: projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        created_by: project.created_by,
        created_at: project.created_at,
        my_role: project.members?.[0]?.role || 'member',
      })),
    };
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.m_project.findFirst({
      where: {
        id,
        members: {
          some: { user_id: userId },
        },
      },
      include: {
        members: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project tidak ditemukan atau Anda tidak memiliki akses');
    }

    return {
      statusCode: 200,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        created_by: project.created_by,
        created_at: project.created_at,
        my_role: (project as any).members?.[0]?.role || 'member',
      },
    };
  }

  async update(id: string, userId: string, updateProjectDto: UpdateProjectDto) {
    await this.checkAdminAccess(id, userId);

    const updatedProject = await this.prisma.m_project.update({
      where: { id },
      data: {
        ...(updateProjectDto.name && { name: updateProjectDto.name }),
        ...(updateProjectDto.description !== undefined && { description: updateProjectDto.description }),
      },
    });

    return {
      statusCode: 200,
      message: 'Project updated successfully',
      data: {
        ...updatedProject,
        my_role: 'admin',
      },
    };
  }

  async remove(id: string, userId: string) {
    await this.checkAdminAccess(id, userId);

    await this.prisma.m_project.delete({
      where: { id },
    });

    return {
      statusCode: 200,
      message: 'Project deleted successfully',
    };
  }

  // ==========================================
  // MANAJEMEN MEMBER PROYEK
  // ==========================================

  async addMember(projectId: string, adminUserId: string, dto: AddMemberDto) {
    await this.checkAdminAccess(projectId, adminUserId);

    const targetUser = await this.prisma.m_user.findUnique({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException(`User dengan email '${dto.email}' tidak ditemukan`);
    }

    const existingMember = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUser.id,
      },
    });

    if (existingMember) {
      throw new ConflictException('User tersebut sudah menjadi anggota di proyek ini');
    }

    const newMember = await this.prisma.t_project_member.create({
      data: {
        project_id: projectId,
        user_id: targetUser.id,
        role: dto.role || 'member',
      },
    });

    return {
      statusCode: 201,
      message: 'Member berhasil ditambahkan ke proyek',
      data: newMember,
    };
  }

  async updateMemberRole(
    projectId: string,
    adminUserId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.checkAdminAccess(projectId, adminUserId);

    const targetMember = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Member tidak ditemukan di proyek ini');
    }

    if (targetMember.role === 'admin' && dto.role === 'member') {
      const adminCount = await this.prisma.t_project_member.count({
        where: {
          project_id: projectId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Tidak dapat mengubah role admin terakhir. Proyek harus memiliki minimal 1 admin.');
      }
    }

    const updatedMember = await this.prisma.t_project_member.update({
      where: { id: targetMember.id },
      data: { role: dto.role },
    });

    return {
      statusCode: 200,
      message: 'Role member berhasil diperbarui',
      data: updatedMember,
    };
  }

  async removeMember(projectId: string, adminUserId: string, targetUserId: string) {
    await this.checkAdminAccess(projectId, adminUserId);

    const targetMember = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
    });

    if (!targetMember) {
      throw new NotFoundException('Member tidak ditemukan di proyek ini');
    }

    if (targetMember.role === 'admin') {
      const adminCount = await this.prisma.t_project_member.count({
        where: {
          project_id: projectId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Admin terakhir tidak dapat dikeluarkan dari proyek.');
      }
    }

    await this.prisma.t_project_member.delete({
      where: { id: targetMember.id },
    });

    return {
      statusCode: 200,
      message: 'Member berhasil dikeluarkan dari proyek',
    };
  }
}