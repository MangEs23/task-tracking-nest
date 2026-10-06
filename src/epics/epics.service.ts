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
import { calcProgress, getEpicsWithProgress } from './epic-progress.helper';

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
    return getEpicsWithProgress(this.prisma, projectId);
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
      progress: calcProgress(task_done, task_total),
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
