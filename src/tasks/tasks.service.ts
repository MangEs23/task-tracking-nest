import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_MESSAGES } from '../common/constants/auth-messages';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { FilterTaskDto } from './dto/filter-task.dto';

const TASK_INCLUDE = {
  epic: { select: { id: true, title: true, project_id: true } },
  status: {
    select: {
      id: true,
      name: true,
      order: true,
      is_default: true,
      is_done: true,
    },
  },
  assignees: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
} satisfies Prisma.t_taskInclude;

type TaskWithRelations = Prisma.t_taskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bentuk output seragam: assignees = [{ id, name, email }] */
  private format(task: TaskWithRelations) {
    const { assignees, ...rest } = task;
    return {
      ...rest,
      assignees: assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      })),
    };
  }

  private async assertMember(projectId: string, userId: string) {
    const member = await this.prisma.t_project_member.findFirst({
      where: { project_id: projectId, user_id: userId },
    });
    if (!member) throw new ForbiddenException(AUTH_MESSAGES.NOT_MEMBER);
    return member;
  }

  private async getEpicAndAssertMember(epicId: string, userId: string) {
    const epic = await this.prisma.t_epic.findUnique({ where: { id: epicId } });
    if (!epic) throw new NotFoundException('Epic not found');
    await this.assertMember(epic.project_id, userId);
    return epic;
  }

  private async getTaskAndAssertMember(taskId: string, userId: string) {
    const task = await this.prisma.t_task.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertMember(task.epic.project_id, userId);
    return task;
  }

  private async assertStatusInProject(statusId: string, projectId: string) {
    const status = await this.prisma.r_status.findFirst({
      where: { id: statusId, project_id: projectId },
      select: { id: true },
    });
    if (!status)
      throw new BadRequestException('Invalid status for this project');
  }

  async create(epicId: string, userId: string, dto: CreateTaskDto) {
    const epic = await this.getEpicAndAssertMember(epicId, userId);

    let statusId = dto.status_id;
    if (statusId) {
      await this.assertStatusInProject(statusId, epic.project_id);
    } else {
      const def = await this.prisma.r_status.findFirst({
        where: { project_id: epic.project_id, is_default: true },
        select: { id: true },
      });
      if (!def) {
        throw new BadRequestException('Project has no default status');
      }
      statusId = def.id;
    }

    const task = await this.prisma.t_task.create({
      data: {
        epic_id: epicId,
        status_id: statusId,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
      },
      include: TASK_INCLUDE,
    });
    return this.format(task);
  }

  async findAllByEpic(epicId: string, userId: string) {
    await this.getEpicAndAssertMember(epicId, userId);
    const tasks = await this.prisma.t_task.findMany({
      where: { epic_id: epicId },
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return tasks.map((t) => this.format(t));
  }

  async findOne(id: string, userId: string) {
    return this.format(await this.getTaskAndAssertMember(id, userId));
  }

  async update(id: string, userId: string, dto: UpdateTaskDto) {
    if (!Object.values(dto).some((v) => v !== undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }

    const task = await this.getTaskAndAssertMember(id, userId);

    if (dto.status_id) {
      await this.assertStatusInProject(dto.status_id, task.epic.project_id);
    }

    const updated = await this.prisma.t_task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.due_date !== undefined && {
          due_date: dto.due_date ? new Date(dto.due_date) : null,
        }),
        ...(dto.status_id !== undefined && { status_id: dto.status_id }),
      },
      include: TASK_INCLUDE,
    });
    return this.format(updated);
  }

  async remove(id: string, userId: string) {
    await this.getTaskAndAssertMember(id, userId);
    // t_task_assignee ikut terhapus via onDelete: Cascade
    await this.prisma.t_task.delete({ where: { id } });
    return null;
  }

  async assignUser(
  taskId: string,
  callerId: string,
  dto: AssignUserDto,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const task = await tx.t_task.findUnique({
            where: { id: taskId },
            select: {
              epic: {
                select: { project_id: true },
              },
            },
          });

          if (!task) {
            throw new NotFoundException('Task not found');
          }

          const projectId = task.epic.project_id;

          const caller = await tx.t_project_member.findFirst({
            where: {
              project_id: projectId,
              user_id: callerId,
            },
          });

          if (!caller) {
            throw new ForbiddenException(AUTH_MESSAGES.NOT_MEMBER);
          }

          const target = await tx.t_project_member.findFirst({
            where: {
              project_id: projectId,
              user_id: dto.user_id,
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

          if (!target) {
            throw new BadRequestException(
              'User is not a member of this project',
            );
          }

          await tx.t_task_assignee.create({
            data: {
              task_id: taskId,
              user_id: dto.user_id,
            },
          });

          return {
            task_id: taskId,
            id: target.user.id,
            name: target.user.name,
            email: target.user.email,
          };
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'User is already assigned to this task',
          );
        }

        if (error.code === 'P2034') {
          if (attempt < 2) continue;

          throw new ConflictException(
            'Task or project members changed concurrently, please retry',
          );
        }
      }

      throw error;
    }
  }
}

  async unassignUser(taskId: string, callerId: string, targetUserId: string) {
    await this.getTaskAndAssertMember(taskId, callerId);

    const assignee = await this.prisma.t_task_assignee.findFirst({
      where: { task_id: taskId, user_id: targetUserId },
      select: { id: true },
    });
    if (!assignee) {
      throw new NotFoundException('Assignee not found on this task');
    }

    await this.prisma.t_task_assignee.delete({ where: { id: assignee.id } });
    return null;
  }

  async findAllByProject(projectId: string, userId: string, f: FilterTaskDto) {
    // Keanggotaan sudah dicek oleh ProjectMemberGuard di controller
    const where: Prisma.t_taskWhereInput = { epic: { project_id: projectId } };

    if (f.status) where.status_id = f.status;
    if (f.priority) where.priority = f.priority;

    if (f.assignee) {
      const assigneeId = f.assignee === 'me' ? userId : f.assignee;
      where.assignees = { some: { user_id: assigneeId } };
    }

    if (f.due_before) {
      const limit = new Date(f.due_before);
      // Format tanggal saja (YYYY-MM-DD): sertakan seluruh hari tsb
      if (/^\d{4}-\d{2}-\d{2}$/.test(f.due_before)) {
        limit.setUTCHours(23, 59, 59, 999);
      }
      where.due_date = { lte: limit };
    }

    const tasks = await this.prisma.t_task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return tasks.map((t) => this.format(t));
  }
}
