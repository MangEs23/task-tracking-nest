import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { FilterTaskDto } from './dto/filter-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper Getters untuk Delegate Prisma dengan Fallback Aman
  private get epicModel() {
    const model =
      (this.prisma as any).t_epic ||
      (this.prisma as any).m_epic ||
      (this.prisma as any).epic;
    if (!model) {
      throw new InternalServerErrorException('Model Epic (t_epic) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  private get taskModel() {
    const model =
      (this.prisma as any).t_task ||
      (this.prisma as any).task;
    if (!model) {
      throw new InternalServerErrorException('Model Task (t_task) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  private get statusModel() {
    const model =
      (this.prisma as any).r_status ||
      (this.prisma as any).m_status ||
      (this.prisma as any).status;
    if (!model) {
      throw new InternalServerErrorException('Model Status (r_status) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  private get taskAssigneeModel() {
    const model =
      (this.prisma as any).t_task_assignee ||
      (this.prisma as any).task_assignee;
    if (!model) {
      throw new InternalServerErrorException('Model Task Assignee (t_task_assignee) tidak ditemukan pada Prisma Service');
    }
    return model;
  }

  /**
   * Helper internal: Memastikan user adalah member proyek
   */
  private async verifyProjectMember(projectId: string, userId: string) {
    const member = await this.prisma.t_project_member.findFirst({
      where: {
        project_id: projectId,
        user_id: userId,
      },
    });

    if (!member) {
      throw new ForbiddenException('Anda bukan anggota dari proyek ini');
    }

    return member;
  }

  /**
   * Helper internal: Ambil task beserta validasi keanggotaan proyek
   */
  private async getTaskAndVerifyMember(taskId: string, userId: string) {
    const task = await this.taskModel.findUnique({
      where: { id: taskId },
      include: {
        epic: {
          select: { id: true, project_id: true, title: true },
        },
        status: {
          select: { id: true, name: true, is_default: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task tidak ditemukan');
    }

    await this.verifyProjectMember(task.epic.project_id, userId);

    return task;
  }

  /**
   * POST /epics/:epicId/tasks
   * Membuat task baru (nested under Epic)
   */
  async create(epicId: string, userId: string, dto: CreateTaskDto) {
    // 1. Cek keberadaan Epic di tabel t_epic
    const epic = await this.epicModel.findUnique({
      where: { id: epicId },
    });

    if (!epic) {
      throw new NotFoundException('Epic tidak ditemukan');
    }

    // 2. Verifikasi caller adalah member proyek
    await this.verifyProjectMember(epic.project_id, userId);

    // 3. Tentukan status_id menggunakan r_status
    let targetStatusId = dto.status_id;

    if (targetStatusId) {
      const status = await this.statusModel.findFirst({
        where: { id: targetStatusId, project_id: epic.project_id },
      });
      if (!status) {
        throw new BadRequestException('status_id tidak valid atau tidak terdaftar di proyek ini');
      }
    } else {
      const defaultStatus = await this.statusModel.findFirst({
        where: { project_id: epic.project_id, is_default: true },
      });

      if (!defaultStatus) {
        throw new BadRequestException('Status default belum diatur di tabel r_status untuk proyek ini');
      }
      targetStatusId = defaultStatus.id;
    }

    // 4. Buat Task baru di tabel t_task
    const newTask = await this.taskModel.create({
      data: {
        epic_id: epicId,
        status_id: targetStatusId,
        title: dto.title,
        description: dto.description || null,
        priority: dto.priority || 'Medium',
        due_date: dto.due_date ? new Date(dto.due_date) : null,
      },
      include: {
        status: {
          select: { id: true, name: true, is_default: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return {
      ...newTask,
      assignees: (newTask.assignees || []).map((a: any) => ({
        user_id: a.user.id,
        name: a.user?.name || '',
        email: a.user?.email || '',
      })),
    };
  }

  /**
   * GET /epics/:epicId/tasks
   */
  async findAllByEpic(epicId: string, userId: string) {
    const epic = await this.epicModel.findUnique({
      where: { id: epicId },
    });

    if (!epic) {
      throw new NotFoundException('Epic tidak ditemukan');
    }

    await this.verifyProjectMember(epic.project_id, userId);

    const tasks = await this.taskModel.findMany({
      where: { epic_id: epicId },
      include: {
        status: {
          select: { id: true, name: true, is_default: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return tasks.map((task: any) => ({
      ...task,
      assignees: (task.assignees || []).map((a: any) => ({
        user_id: a.user.id,
        name: a.user?.name || '',
        email: a.user?.email || '',
      })),
    }));
  }

  /**
   * GET /tasks/:id
   */
  async findOne(id: string, userId: string) {
    const task = await this.getTaskAndVerifyMember(id, userId);

    return {
      ...task,
      assignees: (task.assignees || []).map((a: any) => ({
        user_id: a.user.id,
        name: a.user?.name || '',
        email: a.user?.email || '',
      })),
    };
  }

  /**
   * PATCH /tasks/:id
   */
  async update(id: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.getTaskAndVerifyMember(id, userId);

    if (dto.status_id) {
      const validStatus = await this.statusModel.findFirst({
        where: {
          id: dto.status_id,
          project_id: task.epic.project_id,
        },
      });

      if (!validStatus) {
        throw new BadRequestException('Status tidak ditemukan atau tidak milik proyek ini');
      }
    }

    const updatedTask = await this.taskModel.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
        ...(dto.status_id !== undefined && { status_id: dto.status_id }),
      },
      include: {
        epic: { select: { id: true, title: true, project_id: true } },
        status: { select: { id: true, name: true, is_default: true } },
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return {
      ...updatedTask,
      assignees: (updatedTask.assignees || []).map((a: any) => ({
        user_id: a.user.id,
        name: a.user?.name || '',
        email: a.user?.email || '',
      })),
    };
  }

  /**
   * DELETE /tasks/:id
   */
  async remove(id: string, userId: string) {
    await this.getTaskAndVerifyMember(id, userId);

    await this.taskAssigneeModel.deleteMany({
      where: { task_id: id },
    });

    await this.taskModel.delete({
      where: { id },
    });

    return null;
  }

  /**
   * POST /tasks/:id/assignees
   */
  async assignUser(taskId: string, callerUserId: string, dto: AssignUserDto) {
    const task = await this.getTaskAndVerifyMember(taskId, callerUserId);
    const projectId = task.epic.project_id;

    const targetMember = await this.prisma.t_project_member.findFirst({
      where: { project_id: projectId, user_id: dto.user_id },
    });

    if (!targetMember) {
      throw new BadRequestException('User tersebut bukan anggota dari proyek ini');
    }

    const existingAssignee = await this.taskAssigneeModel.findFirst({
      where: { task_id: taskId, user_id: dto.user_id },
    });

    if (existingAssignee) {
      throw new BadRequestException('User sudah di-assign pada task ini');
    }

    await this.taskAssigneeModel.create({
      data: {
        task_id: taskId,
        user_id: dto.user_id,
      },
    });

    return {
      message: 'User berhasil di-assign ke task',
      task_id: taskId,
      user_id: dto.user_id,
    };
  }

  /**
   * DELETE /tasks/:id/assignees/:userId
   */
  async unassignUser(taskId: string, callerUserId: string, targetUserId: string) {
    await this.getTaskAndVerifyMember(taskId, callerUserId);

    const assignee = await this.taskAssigneeModel.findFirst({
      where: { task_id: taskId, user_id: targetUserId },
    });

    if (!assignee) {
      throw new NotFoundException('User tidak terdaftar sebagai assignee pada task ini');
    }

    await this.taskAssigneeModel.delete({
      where: { id: assignee.id },
    });

    return null;
  }

  /**
   * GET /projects/:projectId/tasks
   */
  async findAllByProject(projectId: string, userId: string, filters: FilterTaskDto) {
    await this.verifyProjectMember(projectId, userId);

    const whereClause: any = {
      epic: {
        project_id: projectId,
      },
    };

    if (filters.status) {
      whereClause.status_id = filters.status;
    }

    if (filters.priority) {
      whereClause.priority = filters.priority;
    }

    if (filters.due_before) {
      whereClause.due_date = {
        lte: new Date(filters.due_before),
      };
    }

    if (filters.assignee) {
      whereClause.assignees = {
        some: {
          user_id: filters.assignee,
        },
      };
    }

    const tasks = await this.taskModel.findMany({
      where: whereClause,
      include: {
        epic: {
          select: { id: true, title: true },
        },
        status: {
          select: { id: true, name: true, is_default: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return tasks.map((task: any) => ({
      ...task,
      assignees: (task.assignees || []).map((a: any) => ({
        user_id: a.user.id,
        name: a.user?.name || '',
        email: a.user?.email || '',
      })),
    }));
  }
}