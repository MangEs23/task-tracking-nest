import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TasksService } from './tasks.service';
import { AUTH_MESSAGES } from '../common/constants/auth-messages';

const P = 'project-1';
const E = 'epic-1';
const T = 'task-1';
const S = 'status-1';
const ME = 'user-me';
const OTHER = 'user-other';

describe('TasksService', () => {
  const prisma = {
    t_epic: { findUnique: jest.fn() },
    t_task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    t_project_member: { findFirst: jest.fn() },
    r_status: { findFirst: jest.fn() },
    t_task_assignee: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  const service = new TasksService(prisma);

  const epic = { id: E, project_id: P, title: 'Epic' };

  const task = (over: Record<string, unknown> = {}) => ({
    id: T,
    epic_id: E,
    status_id: S,
    title: 'Task',
    description: null,
    priority: 'Medium',
    due_date: null,
    created_at: new Date(),
    epic: { id: E, title: 'Epic', project_id: P },
    status: { id: S, name: 'Todo', order: 1, is_default: true, is_done: false },
    assignees: [
      { user: { id: OTHER, name: 'B', email: 'b@x.com' } },
    ],
    ...over,
  });

  const asMember = () =>
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
  const asNonMember = () =>
    prisma.t_project_member.findFirst.mockResolvedValue(null);

  beforeEach(() => jest.resetAllMocks());

  describe('create', () => {
    const dto = { title: 'Task', priority: 'High' } as any;

    it('epic tidak ditemukan → 404', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(null);
      await expect(service.create(E, ME, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('bukan member project → 403 NOT_MEMBER', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asNonMember();
      const result = service.create(E, ME, dto);
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
      expect(prisma.t_task.create).not.toHaveBeenCalled();
    });

    it('status_id bukan milik project → 400', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asMember();
      prisma.r_status.findFirst.mockResolvedValue(null);
      const result = service.create(E, ME, { ...dto, status_id: 'other' });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('Invalid status for this project');
      expect(prisma.t_task.create).not.toHaveBeenCalled();
    });

    it('status_id kosong → pakai status default project', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asMember();
      prisma.r_status.findFirst.mockResolvedValue({ id: 'default-status' });
      prisma.t_task.create.mockResolvedValue(task());

      await service.create(E, ME, dto);

      expect(prisma.r_status.findFirst).toHaveBeenCalledWith({
        where: { project_id: P, is_default: true },
        select: { id: true },
      });
      const arg = prisma.t_task.create.mock.calls[0][0];
      expect(arg.data.status_id).toBe('default-status');
      expect(arg.data.epic_id).toBe(E);
      expect(arg.data.priority).toBe('High');
    });

    it('project tidak punya status default → 400', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asMember();
      prisma.r_status.findFirst.mockResolvedValue(null);
      await expect(service.create(E, ME, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sukses: assignees diformat menjadi { id, name, email }', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asMember();
      prisma.r_status.findFirst.mockResolvedValue({ id: S });
      prisma.t_task.create.mockResolvedValue(task());

      const res = await service.create(E, ME, {
        ...dto,
        due_date: '2026-10-15T23:59:59.000Z',
      });

      expect(res.assignees).toEqual([
        { id: OTHER, name: 'B', email: 'b@x.com' },
      ]);
      const arg = prisma.t_task.create.mock.calls[0][0];
      expect(arg.data.due_date).toEqual(new Date('2026-10-15T23:59:59.000Z'));
    });
  });

  describe('findAllByEpic', () => {
    it('epic tidak ditemukan → 404', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(null);
      await expect(service.findAllByEpic(E, ME)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('bukan member → 403', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asNonMember();
      await expect(service.findAllByEpic(E, ME)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('sukses: list task diformat', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic);
      asMember();
      prisma.t_task.findMany.mockResolvedValue([task(), task({ id: 't2' })]);

      const res = await service.findAllByEpic(E, ME);

      expect(res).toHaveLength(2);
      expect(res[0].assignees[0]).toEqual({
        id: OTHER,
        name: 'B',
        email: 'b@x.com',
      });
      expect(prisma.t_task.findMany.mock.calls[0][0].where).toEqual({
        epic_id: E,
      });
    });
  });

  describe('findOne', () => {
    it('task tidak ada → 404', async () => {
      prisma.t_task.findUnique.mockResolvedValue(null);
      const result = service.findOne(T, ME);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Task not found');
    });

    it('bukan member → 403', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asNonMember();
      await expect(service.findOne(T, ME)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('sukses', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      const res = await service.findOne(T, ME);
      expect(res.id).toBe(T);
      expect(res.status.order).toBe(1);
    });
  });

  describe('update', () => {
    it('body kosong → 400 tanpa query DB', async () => {
      await expect(service.update(T, ME, {} as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.t_task.findUnique).not.toHaveBeenCalled();
    });

    it('status_id dari project lain → 400', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.r_status.findFirst.mockResolvedValue(null);
      const result = service.update(T, ME, { status_id: 'foreign' } as any);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('Invalid status for this project');
      expect(prisma.t_task.update).not.toHaveBeenCalled();
    });

    it('hanya field yang dikirim yang di-update', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.t_task.update.mockResolvedValue(task({ title: 'Baru' }));

      await service.update(T, ME, { title: 'Baru' } as any);

      expect(prisma.t_task.update.mock.calls[0][0].data).toEqual({
        title: 'Baru',
      });
    });

    it('due_date null → menghapus due_date', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.t_task.update.mockResolvedValue(task());

      await service.update(T, ME, { due_date: null } as any);

      expect(prisma.t_task.update.mock.calls[0][0].data).toEqual({
        due_date: null,
      });
    });

    it('status_id valid → sukses', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.r_status.findFirst.mockResolvedValue({ id: 'done' });
      prisma.t_task.update.mockResolvedValue(task({ status_id: 'done' }));

      const res = await service.update(T, ME, { status_id: 'done' } as any);

      expect(res.status_id).toBe('done');
      expect(prisma.r_status.findFirst).toHaveBeenCalledWith({
        where: { id: 'done', project_id: P },
        select: { id: true },
      });
    });
  });

  describe('remove', () => {
    it('bukan member → 403, tidak ada yang dihapus', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asNonMember();
      await expect(service.remove(T, ME)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.t_task.delete).not.toHaveBeenCalled();
    });

    it('sukses: satu delete (assignee ikut via cascade)', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      await expect(service.remove(T, ME)).resolves.toBeNull();
      expect(prisma.t_task.delete).toHaveBeenCalledWith({ where: { id: T } });
    });
  });

  describe('assignUser', () => {
    const dto = { user_id: OTHER } as any;
    const targetMember = {
      user: { id: OTHER, name: 'B', email: 'b@x.com' },
    };

    it('target bukan member project → 400', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      prisma.t_project_member.findFirst
        .mockResolvedValueOnce({ role: 'member' }) // caller
        .mockResolvedValueOnce(null); // target
      const result = service.assignUser(T, ME, dto);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(
        'User is not a member of this project',
      );
      expect(prisma.t_task_assignee.create).not.toHaveBeenCalled();
    });

    it('sudah di-assign (unique violation P2002) → 400', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      prisma.t_project_member.findFirst
        .mockResolvedValueOnce({ role: 'member' })
        .mockResolvedValueOnce(targetMember);
      prisma.t_task_assignee.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      const result = service.assignUser(T, ME, dto);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('already assigned');
    });

    it('error DB lain diteruskan apa adanya', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      prisma.t_project_member.findFirst
        .mockResolvedValueOnce({ role: 'member' })
        .mockResolvedValueOnce(targetMember);
      prisma.t_task_assignee.create.mockRejectedValue(new Error('db down'));
      await expect(service.assignUser(T, ME, dto)).rejects.toThrow('db down');
    });

    it('sukses: mengembalikan objek assignee', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      prisma.t_project_member.findFirst
        .mockResolvedValueOnce({ role: 'member' })
        .mockResolvedValueOnce(targetMember);
      prisma.t_task_assignee.create.mockResolvedValue({});

      const res = await service.assignUser(T, ME, dto);

      expect(prisma.t_task_assignee.create).toHaveBeenCalledWith({
        data: { task_id: T, user_id: OTHER },
      });
      expect(res).toEqual({
        task_id: T,
        id: OTHER,
        name: 'B',
        email: 'b@x.com',
      });
    });
  });

  describe('unassignUser', () => {
    it('assignee tidak ada → 404', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.t_task_assignee.findFirst.mockResolvedValue(null);
      await expect(service.unassignUser(T, ME, OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.t_task_assignee.delete).not.toHaveBeenCalled();
    });

    it('sukses', async () => {
      prisma.t_task.findUnique.mockResolvedValue(task());
      asMember();
      prisma.t_task_assignee.findFirst.mockResolvedValue({ id: 'a1' });
      await expect(service.unassignUser(T, ME, OTHER)).resolves.toBeNull();
      expect(prisma.t_task_assignee.delete).toHaveBeenCalledWith({
        where: { id: 'a1' },
      });
    });
  });

  describe('findAllByProject', () => {
    const run = async (filters: any) => {
      prisma.t_task.findMany.mockResolvedValue([]);
      await service.findAllByProject(P, ME, filters);
      return prisma.t_task.findMany.mock.calls[0][0].where;
    };

    it('tanpa filter → hanya scope project', async () => {
      expect(await run({})).toEqual({ epic: { project_id: P } });
    });

    it('filter status & priority', async () => {
      const where = await run({ status: S, priority: 'High' });
      expect(where.status_id).toBe(S);
      expect(where.priority).toBe('High');
    });

    it('assignee=me → dipetakan ke user yang request', async () => {
      const where = await run({ assignee: 'me' });
      expect(where.assignees).toEqual({ some: { user_id: ME } });
    });

    it('assignee=uuid → dipakai langsung', async () => {
      const where = await run({ assignee: OTHER });
      expect(where.assignees).toEqual({ some: { user_id: OTHER } });
    });

    it('due_before tanggal saja → sampai akhir hari (inklusif)', async () => {
      const where = await run({ due_before: '2026-10-15' });
      expect(where.due_date.lte).toEqual(new Date('2026-10-15T23:59:59.999Z'));
    });

    it('due_before ISO datetime → dipakai apa adanya', async () => {
      const where = await run({ due_before: '2026-10-15T10:00:00.000Z' });
      expect(where.due_date.lte).toEqual(new Date('2026-10-15T10:00:00.000Z'));
    });
  });
});