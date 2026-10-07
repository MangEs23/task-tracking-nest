import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EpicsService } from './epics.service';

const P = 'project-1';
const E = 'epic-1';

describe('EpicsService', () => {
  const tx = {
    t_task: { count: jest.fn() },
    t_epic: { delete: jest.fn() },
  } as any;

  const prisma = {
    $transaction: jest.fn(),
    t_epic: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const service = new EpicsService(prisma);

  beforeEach(() => {
    jest.resetAllMocks();
    // Jalankan callback transaksi dengan tx palsu
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
  });

  describe('create', () => {
    const dto = {
      title: 'Epic',
      description: 'desc',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
    };

    it('end_date < start_date → 400, tidak ada insert', async () => {
      const result = service.create(P, {
        ...dto,
        start_date: '2026-10-31',
        end_date: '2026-10-01',
      });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('end_date must be after start_date');
      expect(prisma.t_epic.create).not.toHaveBeenCalled();
    });

    it('tanggal tidak valid → 400', async () => {
      const result = service.create(P, { ...dto, start_date: 'bukan-tanggal' });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('start_date is not a valid date');
      expect(prisma.t_epic.create).not.toHaveBeenCalled();
    });

    it('end_date sama dengan start_date → diizinkan', async () => {
      prisma.t_epic.create.mockResolvedValue({ id: E });
      await expect(
        service.create(P, {
          ...dto,
          start_date: '2026-10-15',
          end_date: '2026-10-15',
        }),
      ).resolves.toEqual({ id: E });
    });

    it('sukses: data dikirim sebagai Date', async () => {
      prisma.t_epic.create.mockResolvedValue({ id: E });
      await service.create(P, dto);

      const arg = prisma.t_epic.create.mock.calls[0][0];
      expect(arg.data.project_id).toBe(P);
      expect(arg.data.title).toBe('Epic');
      expect(arg.data.start_date).toEqual(new Date('2026-10-01'));
      expect(arg.data.end_date).toEqual(new Date('2026-10-31'));
    });
  });

  describe('findOne', () => {
    const epic = (tasks: any[]) => ({
      id: E,
      project_id: P,
      title: 'Epic',
      description: null,
      start_date: new Date('2026-10-01'),
      end_date: new Date('2026-10-31'),
      created_at: new Date(),
      tasks,
    });

    const t = (id: string, is_done: boolean) => ({
      id,
      title: `Task ${id}`,
      priority: 'Medium',
      due_date: null,
      status: { name: is_done ? 'Done' : 'Todo', is_done },
    });

    it('epic tidak ada → 404', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(null);
      const result = service.findOne(E);
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Epic not found');
    });

    it('tanpa task → progress 0', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic([]));
      const res = await service.findOne(E);
      expect(res.task_total).toBe(0);
      expect(res.task_done).toBe(0);
      expect(res.progress).toBe(0);
      expect(res.tasks).toEqual([]);
    });

    it('1 dari 3 task selesai → progress 33', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(
        epic([t('a', true), t('b', false), t('c', false)]),
      );
      const res = await service.findOne(E);
      expect(res.task_total).toBe(3);
      expect(res.task_done).toBe(1);
      expect(res.progress).toBe(33);
    });

    it('status task dikembalikan sebagai string nama', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(epic([t('a', true)]));
      const res = await service.findOne(E);
      expect(res.tasks[0].status).toBe('Done');
    });
  });

  describe('update', () => {
    const existing = {
      start_date: new Date('2026-10-10'),
      end_date: new Date('2026-10-20'),
    };

    it('body kosong → 400 tanpa query DB', async () => {
      await expect(service.update(E, {} as any)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.t_epic.findUnique).not.toHaveBeenCalled();
    });

    it('epic tidak ada → 404', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(null);
      await expect(
        service.update(E, { title: 'Baru' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('end_date baru lebih awal dari start_date lama → 400', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(existing);
      const result = service.update(E, { end_date: '2026-10-05' } as any);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('end_date must be after start_date');
      expect(prisma.t_epic.update).not.toHaveBeenCalled();
    });

    it('start_date baru lebih akhir dari end_date lama → 400', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(existing);
      await expect(
        service.update(E, { start_date: '2026-10-25' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.t_epic.update).not.toHaveBeenCalled();
    });

    it('hanya field yang dikirim yang di-update', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(existing);
      prisma.t_epic.update.mockResolvedValue({ id: E });

      await service.update(E, { title: 'Baru' } as any);

      expect(prisma.t_epic.update.mock.calls[0][0].data).toEqual({
        title: 'Baru',
      });
    });

    it('description null → menghapus deskripsi', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(existing);
      prisma.t_epic.update.mockResolvedValue({ id: E });

      await service.update(E, { description: null } as any);

      expect(prisma.t_epic.update.mock.calls[0][0].data).toEqual({
        description: null,
      });
    });

    it('rentang tanggal valid → sukses, dikirim sebagai Date', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(existing);
      prisma.t_epic.update.mockResolvedValue({ id: E });

      await service.update(E, { end_date: '2026-10-30' } as any);

      expect(prisma.t_epic.update.mock.calls[0][0].data).toEqual({
        end_date: new Date('2026-10-30'),
      });
    });
  });

  describe('remove', () => {
    it('masih ada task → 409, epic tidak dihapus', async () => {
      tx.t_task.count.mockResolvedValue(2);
      const result = service.remove(E);
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow('Epic still has tasks');
      expect(tx.t_epic.delete).not.toHaveBeenCalled();
    });

    it('tanpa task → epic dihapus', async () => {
      tx.t_task.count.mockResolvedValue(0);
      await expect(service.remove(E)).resolves.toBeUndefined();
      expect(tx.t_epic.delete).toHaveBeenCalledWith({ where: { id: E } });
    });

    it('transaksi bentrok (P2034) → 409', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('conflict', {
          code: 'P2034',
          clientVersion: 'test',
        }),
      );
      await expect(service.remove(E)).rejects.toBeInstanceOf(ConflictException);
    });

    it('epic sudah terhapus (P2025) → 404', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('missing', {
          code: 'P2025',
          clientVersion: 'test',
        }),
      );
      await expect(service.remove(E)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('error lain diteruskan apa adanya', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));
      await expect(service.remove(E)).rejects.toThrow('db down');
    });
  });
});
