import {
  BadRequestException,
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

  private async verifyProjectAdmin(projectId: string, userId: string) {
    const membership = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found');
    }

    if (membership.role !== 'admin') {
      throw new ForbiddenException('Only project admin can perform this action');
    }

    return membership;
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

      return newProject;
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
          select: {
            user_id: true,
            role: true,
          },
        },
      },
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

  async findOne(id: string, userId: string) {
    const membership = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: id,
        user_id: userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prisma.m_project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
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

  async update(id: string, userId: string, updateProjectDto: UpdateProjectDto) {
    await this.verifyProjectAdmin(id, userId);

    const updatedProject = await this.prisma.m_project.update({
      where: { id },
      data: {
        ...(updateProjectDto.name !== undefined && { name: updateProjectDto.name }),
        ...(updateProjectDto.description !== undefined && { description: updateProjectDto.description }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        created_by: true,
        created_at: true,
      },
    });

    return updatedProject;
  }


  async remove(id: string, userId: string) {
    await this.verifyProjectAdmin(id, userId);

    await this.prisma.t_project_member.deleteMany({
      where: { project_id: id },
    });

    await this.prisma.m_project.delete({
      where: { id },
    });

    return null;
  }

  
  async addMember(projectId: string, adminUserId: string, dto: AddMemberDto) {
    await this.verifyProjectAdmin(projectId, adminUserId);

    const targetUser = await this.prisma.m_user.findUnique({
      where: { email: dto.email },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const existingMember = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUser.id,
      },
    });

    if (existingMember) {
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
    adminUserId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.verifyProjectAdmin(projectId, adminUserId);

    const member = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    const updatedMember = await this.prisma.t_project_member.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      user_id: updatedMember.user.id,
      name: updatedMember.user.name,
      email: updatedMember.user.email,
      role: updatedMember.role,
    };
  }

  async removeMember(projectId: string, adminUserId: string, targetUserId: string) {
    await this.verifyProjectAdmin(projectId, adminUserId);

    if (targetUserId === adminUserId) {
      const adminCount = await this.prisma.t_project_member.count({
        where: {
          project_id: projectId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove yourself as the last admin of the project');
      }
    }

    const member = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    await this.prisma.t_project_member.delete({
      where: { id: member.id },
    });

    return null;
  }
}