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
import { getEpicsWithProgress } from '../epics/epic-progress.helper';

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

  async findOne(id: string, userId: string) {
  const project = await this.prisma.m_project.findUnique({
    where: { id },
    include: { members: { include: { user: { select: USER_SELECT } } } },
  });

  if (!project) {
    throw new NotFoundException('Project not found');
  }

  const myMember = project.members.find(
    (m) => m.user_id === userId,
  );

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    created_by: project.created_by,
    created_at: project.created_at,
    my_role: myMember?.role ?? null,
    members: project.members.map((m) => ({
      user_id: m.user_id,
      name: m.user?.name || '',
      email: m.user?.email || '',
      role: m.role,
    })),
  };
}

    async getDashboard(projectId: string, dueWithin = 3) {
    // Batas "hari ini" (00:00 UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Akhir rentang due soon: seluruh hari ke-N ikut dihitung
    const dueSoonEnd = new Date(todayStart);
    dueSoonEnd.setUTCDate(dueSoonEnd.getUTCDate() + dueWithin + 1);

    const projectScope = { epic: { project_id: projectId } };

    const [statuses, statusGroups, priorityGroups, overdueCount, dueSoonCount, epics] =
      await Promise.all([
        // Semua status project (agar status dengan 0 task tetap muncul)
        this.prisma.r_status.findMany({
          where: { project_id: projectId },
          select: { id: true, name: true },
          orderBy: { order: 'asc' },
        }),
        // COUNT ... GROUP BY status_id
        this.prisma.t_task.groupBy({
          by: ['status_id'],
          where: projectScope,
          _count: { _all: true },
        }),
        // COUNT ... GROUP BY priority
        this.prisma.t_task.groupBy({
          by: ['priority'],
          where: projectScope,
          _count: { _all: true },
        }),
        // Overdue: due_date < hari ini dan status belum done
        this.prisma.t_task.count({
          where: {
            ...projectScope,
            due_date: { lt: todayStart },
            status: { is_done: false },
          },
        }),
        // Due soon: hari ini s/d hari ke-N dan status belum done
        this.prisma.t_task.count({
          where: {
            ...projectScope,
            due_date: { gte: todayStart, lt: dueSoonEnd },
            status: { is_done: false },
          },
        }),
        getEpicsWithProgress(this.prisma, projectId),
      ]);

    const statusCountMap = new Map(
      statusGroups.map((g) => [g.status_id, g._count._all]),
    );
    const priorityCountMap = new Map(
      priorityGroups.map((g) => [g.priority, g._count._all]),
    );

    const by_status = statuses.map((s) => ({
      status_id: s.id,
      status_name: s.name,
      count: statusCountMap.get(s.id) ?? 0,
    }));

    const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
    const by_priority = PRIORITIES.map((priority) => ({
      priority,
      count: priorityCountMap.get(priority) ?? 0,
    }));

    return {
      total_tasks: by_status.reduce((sum, s) => sum + s.count, 0),
      by_status,
      by_priority,
      overdue_count: overdueCount,
      due_soon_count: dueSoonCount,
      epics: epics.map((e) => ({
        id: e.id,
        title: e.title,
        progress: e.progress,
        task_total: e.task_total,
        task_done: e.task_done,
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
  await this.prisma.$transaction([
    this.prisma.t_task.deleteMany({ where: { epic: { project_id: id } } }),
    this.prisma.m_project.delete({ where: { id } }),
  ]);
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

  await this.prisma.$transaction([
    this.prisma.t_task_assignee.deleteMany({
      where: {
        user_id: targetUserId,
        task: { epic: { project_id: projectId } },
      },
    }),
    this.prisma.t_project_member.delete({ where: { id: member.id } }),
  ]);

  return null;
}
}