import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { calcProgress, getEpicsWithProgress } from '../epics/epic-progress.helper';


const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  created_by: true,
  created_at: true,
} as const;

const USER_SELECT = { id: true, name: true, email: true } as const;

type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  my_role: string;
  member_count: bigint;
  created_at: Date;
  epic_count: bigint;
  task_total: bigint;
  task_done: bigint;
  members_preview: Array<{
    user_id: string;
    name: string;
  }>;
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async mutateMembers<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        if (attempt < 2) continue;

        throw new ConflictException(
          'Project members changed concurrently, please retry',
        );
      }

      throw error;
    }
  }
}

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
              {
                name: 'In Progress',
                order: 2,
                is_default: false,
                is_done: false,
              },
              { name: 'Done', order: 3, is_default: false, is_done: true },
            ],
          },
        },
        select: PROJECT_SELECT,
      });
    } catch (error) {
      this.logger.error('Failed to create project', (error as Error).stack);
      throw new InternalServerErrorException('Failed to create project');
    }
  }

  async findAll(userId: string) {
  const projects = await this.prisma.$queryRaw<ProjectListRow[]>`
    WITH visible_projects AS (
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_at,
        pm.role AS my_role
      FROM m_project p
      JOIN t_project_member pm
        ON pm.project_id = p.id
      WHERE pm.user_id = CAST(${userId} AS uuid)
    ),
    epic_counts AS (
      SELECT
        e.project_id,
        COUNT(*) AS epic_count
      FROM t_epic e
      JOIN visible_projects vp
        ON vp.id = e.project_id
      GROUP BY e.project_id
    ),
    task_counts AS (
      SELECT
        e.project_id,
        COUNT(*) AS task_total,
        COUNT(*) FILTER (
          WHERE s.is_done = TRUE
        ) AS task_done
      FROM t_task t
      JOIN t_epic e
        ON e.id = t.epic_id
      JOIN visible_projects vp
        ON vp.id = e.project_id
      LEFT JOIN r_status s
        ON s.id = t.status_id
      GROUP BY e.project_id
    ),
    member_counts AS (
      SELECT
        pm.project_id,
        COUNT(*) AS member_count
      FROM t_project_member pm
      JOIN visible_projects vp
        ON vp.id = pm.project_id
      GROUP BY pm.project_id
    ),
    ranked_members AS (
      SELECT
        pm.project_id,
        pm.user_id,
        u.name,
        ROW_NUMBER() OVER (
          PARTITION BY pm.project_id
          ORDER BY pm.user_id ASC
        ) AS position
      FROM t_project_member pm
      JOIN visible_projects vp
        ON vp.id = pm.project_id
      JOIN m_user u
        ON u.id = pm.user_id
    ),
    member_previews AS (
      SELECT
        project_id,
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'user_id', user_id,
            'name', name
          )
          ORDER BY position
        ) AS members_preview
      FROM ranked_members
      WHERE position <= 4
      GROUP BY project_id
    )
    SELECT
      vp.id,
      vp.name,
      vp.description,
      vp.my_role,
      vp.created_at,
      COALESCE(mc.member_count, 0::bigint) AS member_count,
      COALESCE(ec.epic_count, 0::bigint) AS epic_count,
      COALESCE(tc.task_total, 0::bigint) AS task_total,
      COALESCE(tc.task_done, 0::bigint) AS task_done,
      COALESCE(mp.members_preview, '[]'::jsonb) AS members_preview
    FROM visible_projects vp
    LEFT JOIN epic_counts ec
      ON ec.project_id = vp.id
    LEFT JOIN task_counts tc
      ON tc.project_id = vp.id
    LEFT JOIN member_counts mc
      ON mc.project_id = vp.id
    LEFT JOIN member_previews mp
      ON mp.project_id = vp.id
    ORDER BY vp.created_at DESC, vp.id ASC
  `;

  return projects.map((project) => {
    const taskTotal = Number(project.task_total);
    const taskDone = Number(project.task_done);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      my_role: project.my_role,
      member_count: Number(project.member_count),
      created_at: project.created_at,
      epic_count: Number(project.epic_count),
      task_total: taskTotal,
      task_done: taskDone,
      progress: calcProgress(taskDone, taskTotal),
      members_preview: project.members_preview,
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

    const myMember = project.members.find((m) => m.user_id === userId);

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

    const [
      statuses,
      statusGroups,
      priorityGroups,
      overdueCount,
      dueSoonCount,
      epics,
    ] = await Promise.all([
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
    if (!Object.values(dto).some((v) => v !== undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }

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

    try {
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
    } catch (e) {
      // Dua request bersamaan lolos cek findFirst, salah satunya kena unique constraint
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException(
          'User is already a member of this project',
        );
      }
      throw e;
    }
  }

  async updateMemberRole(
  projectId: string,
  targetUserId: string,
  dto: UpdateMemberRoleDto,
) {
  return this.mutateMembers(async (tx) => {
    const member = await tx.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    if (member.role === 'admin' && dto.role !== 'admin') {
      const adminCount = await tx.t_project_member.count({
        where: {
          project_id: projectId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin of the project',
        );
      }
    }

    const updated = await tx.t_project_member.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: {
        user: { select: USER_SELECT },
      },
    });

    return {
      user_id: updated.user.id,
      name: updated.user.name,
      email: updated.user.email,
      role: updated.role,
    };
  });
}

  async removeMember(
  projectId: string,
  adminUserId: string,
  targetUserId: string,
) {
  return this.mutateMembers(async (tx) => {
    const member = await tx.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: targetUserId,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this project');
    }

    if (member.role === 'admin') {
      const adminCount = await tx.t_project_member.count({
        where: {
          project_id: projectId,
          role: 'admin',
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestException(
          targetUserId === adminUserId
            ? 'Cannot remove yourself as the last admin of the project'
            : 'Cannot remove the last admin of the project',
        );
      }
    }

    await tx.t_task_assignee.deleteMany({
      where: {
        user_id: targetUserId,
        task: {
          epic: { project_id: projectId },
        },
      },
    });

    await tx.t_project_member.delete({
      where: { id: member.id },
    });

    return null;
  });
}
}
