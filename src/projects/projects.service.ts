import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  created_by: true,
  created_at: true,
} as const;

const USER_SELECT = { id: true, name: true, email: true } as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProjectDto) {
    try {
      return await this.prisma.m_project.create({
        data: {
          name: dto.name,
          description: dto.description,
          created_by: userId,
          members: { create: { user_id: userId, role: 'admin' } },
          statuses: {
            create: [
              { name: 'Todo', order: 1, is_default: true, is_done: false },
              { name: 'In Progress', order: 2, is_default: false, is_done: false },
              { name: 'Done', order: 3, is_default: false, is_done: true },
            ],
          },
        },
        select: PROJECT_SELECT,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Gagal membuat proyek: ${(error as Error).message || 'Internal server error'}`,
      );
    }
  }

  async findAll(userId: string) {
    const projects = await this.prisma.m_project.findMany({
      where: { members: { some: { user_id: userId } } },
      include: { members: { select: { user_id: true, role: true } } },
      orderBy: { created_at: 'desc' },
    });

    return projects.map((project) => {
      const myMember = project.members.find((m) => m.user_id === userId);
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        my_role: myMember?.role || 'member',
        member_count: project.members.length,
        created_at: project.created_at,
      };
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.m_project.findUnique({
      where: { id },
      include: { members: { include: { user: { select: USER_SELECT } } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      created_by: project.created_by,
      created_at: project.created_at,
      members: project.members.map((m) => ({
        user_id: m.user_id,
        name: m.user?.name || '',
        email: m.user?.email || '',
        role: m.role,
      })),
    };
  }

  async update(id: string, dto: UpdateProjectDto) {
    return this.prisma.m_project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      select: PROJECT_SELECT,
    });
  }

  async remove(id: string) {
    await this.prisma.m_project.delete({ where: { id } });
    return null;
  }

  async addMember(projectId: string, dto: AddMemberDto) {
    const targetUser = await this.prisma.m_user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.t_project_member.findFirst({
      where: { project_id: projectId, user_id: targetUser.id },
    });
    if (existing) {
      throw new BadRequestException('User is already a member of this project');
    }

    const newMember = await this.prisma.t_project_member.create({
      data: {
        project_id: projectId,
        user_id: targetUser.id,
        role: dto.role || 'member',
      },
    });

    return {
      user_id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: newMember.role,
    };
  }

  async updateMemberRole(
    projectId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const member = await this.prisma.t_project_member.findFirst({
      where: { project_id: projectId, user_id: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    if (member.role === 'admin' && dto.role !== 'admin') {
      const adminCount = await this.prisma.t_project_member.count({
        where: { project_id: projectId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin of the project');
      }
    }

    const updated = await this.prisma.t_project_member.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: { user: { select: USER_SELECT } },
    });

    return {
      user_id: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
    };
  }

  async removeMember(projectId: string, adminUserId: string, targetUserId: string) {
    if (targetUserId === adminUserId) {
      const adminCount = await this.prisma.t_project_member.count({
        where: { project_id: projectId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove yourself as the last admin of the project',
        );
      }
    }

    const member = await this.prisma.t_project_member.findFirst({
      where: { project_id: projectId, user_id: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    await this.prisma.t_project_member.delete({ where: { id: member.id } });
    return null;
  }
}