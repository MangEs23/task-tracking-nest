import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEpicDto } from './dto/create-epic.dto';
import { UpdateEpicDto } from './dto/update-epic.dto';

const EPIC_SELECT = {
  id: true,
  project_id: true,
  title: true,
  description: true,
  start_date: true,
  end_date: true,
  created_at: true,
} satisfies Prisma.t_epicSelect;

@Injectable()
export class EpicsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${field} is not a valid date`);
    }
    return date;
  }

  private assertDateRange(start: Date | null, end: Date | null) {
    if (start && end && end < start) {
      throw new BadRequestException('end_date must be after start_date');
    }
  }

  private calcProgress(done: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  async create(projectId: string, dto: CreateEpicDto) {
    const start = this.parseDate(dto.start_date, 'start_date');
    const end = this.parseDate(dto.end_date, 'end_date');
    this.assertDateRange(start, end);

    return this.prisma.t_epic.create({
      data: {
        project_id: projectId,
        title: dto.title,
        description: dto.description,
        start_date: start,
        end_date: end,
      },
      select: EPIC_SELECT,
    });
  }

  async findAllByProject(projectId: string) {
    const epics = await this.prisma.t_epic.findMany({
      where: { project_id: projectId },
      select: { id: true, title: true, description: true, start_date: true, end_date: true },
      orderBy: { start_date: 'asc' },
    });

    if (epics.length === 0) return [];

    const epicIds = epics.map((e) => e.id);

    const [totals, dones] = await Promise.all([
      this.prisma.t_task.groupBy({
        by: ['epic_id'],
        where: { epic_id: { in: epicIds } },
        _count: { _all: true },
      }),
      this.prisma.t_task.groupBy({
        by: ['epic_id'],
        where: { epic_id: { in: epicIds }, status: { is_done: true } },
        _count: { _all: true },
      }),
    ]);

    const totalMap = new Map(totals.map((t) => [t.epic_id, t._count._all]));
    const doneMap = new Map(dones.map((d) => [d.epic_id, d._count._all]));

    return epics.map((epic) => {
      const task_total = totalMap.get(epic.id) ?? 0;
      const task_done = doneMap.get(epic.id) ?? 0;
      return {
        ...epic,
        task_total,
        task_done,
        progress: this.calcProgress(task_done, task_total),
      };
    });
  }

  async findOne(id: string) {
    const epic = await this.prisma.t_epic.findUnique({
      where: { id },
      select: {
        ...EPIC_SELECT,
        tasks: {
          select: {
            id: true,
            title: true,
            priority: true,
            due_date: true,
            status: { select: { name: true, is_done: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!epic) {
      throw new NotFoundException('Epic not found');
    }

    const task_total = epic.tasks.length;
    const task_done = epic.tasks.filter((t) => t.status.is_done).length;

    return {
      id: epic.id,
      project_id: epic.project_id,
      title: epic.title,
      description: epic.description,
      start_date: epic.start_date,
      end_date: epic.end_date,
      task_total,
      task_done,
      progress: this.calcProgress(task_done, task_total),
      tasks: epic.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status.name,
        priority: t.priority,
        due_date: t.due_date,
      })),
    };
  }

  async update(id: string, dto: UpdateEpicDto) {
    const hasAnyField = Object.values(dto).some((v) => v !== undefined);
    if (!hasAnyField) {
      throw new BadRequestException('At least one field must be provided');
    }

    const existing = await this.prisma.t_epic.findUnique({
      where: { id },
      select: { start_date: true, end_date: true },
    });

    if (!existing) {
      throw new NotFoundException('Epic not found');
    }

    const start =
      dto.start_date !== undefined
        ? this.parseDate(dto.start_date, 'start_date')
        : existing.start_date;
    const end =
      dto.end_date !== undefined
        ? this.parseDate(dto.end_date, 'end_date')
        : existing.end_date;

    this.assertDateRange(start, end);

    return this.prisma.t_epic.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.start_date !== undefined && { start_date: start }),
        ...(dto.end_date !== undefined && { end_date: end }),
      },
      select: EPIC_SELECT,
    });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const taskCount = await tx.t_task.count({ where: { epic_id: id } });
          if (taskCount > 0) {
            throw new ConflictException(
              'Epic still has tasks, move or delete them first',
            );
          }
          await tx.t_epic.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') {
          throw new ConflictException(
            'Epic is being modified concurrently, please retry',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Epic not found');
        }
      }
      throw error;
    }
  }
}
