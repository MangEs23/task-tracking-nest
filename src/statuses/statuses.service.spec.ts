import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StatusesService } from './statuses.service';
import { AUTH_MESSAGES } from '../common/constants/auth-messages';

const P = 'project-1';
const S = 'status-1';
const ADMIN = 'user-admin';

describe('StatusesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    r_status: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    t_task: { count: jest.fn() },
    t_project_member: { findFirst: jest.fn() },
  } as any;

  const service = new StatusesService(prisma);

  const status = (over: Record<string, unknown> = {}) => ({
    id: S,
    project_id: P,
    name: 'Todo',
    order: 1,
    is_default: false,
    is_done: false,
    ...over,
  });

  const asAdmin = () =>
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
  const asMember = () =>
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
  const asNonMember = () =>
    prisma.t_project_member.findFirst.mockResolvedValue(null);

  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('err', {
      code,
      clientVersion: 'test',
    });

  beforeEach(() => {
    jest.resetAllMocks();
    // Jalankan callback transaksi dengan client yang sama
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  });

  describe('create', () => {
    it('non-member → 403 NOT_MEMBER, tidak ada insert', async () => {
      asNonMember();
      const result = service.create(P, ADMIN, { name: 'Review' });
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
      expect(prisma.r_status.create).not.toHaveBeenCalled();
    });

    it('member biasa → 403 NOT_ADMIN', async () => {
      asMember();
      const result = service.create(P, ADMIN, { name: 'Review' });
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
      expect(prisma.r_status.create).not.toHaveBeenCalled();
    });

    it('status terakhir order 3 → status baru order 4, bukan default', async () => {
      asAdmin();
      prisma.r_status.findFirst.mockResolvedValue(status({ order: 3 }));
      prisma.r_status.create.mockResolvedValue({ id: 'new' });

      await service.create(P, ADMIN, { name: 'Review' });

      expect(prisma.r_status.findFirst).toHaveBeenCalledWith({
        where: { project_id: P },
        orderBy: { order: 'desc' },
      });
      expect(prisma.r_status.create).toHaveBeenCalledWith({
        data: { project_id: P, name: 'Review', order: 4, is_default: false },
      });
    });

    it('project belum punya status → order 1 dan jadi default', async () => {
      asAdmin();
      prisma.r_status.findFirst.mockResolvedValue(null);
      prisma.r_status.create.mockResolvedValue({ id: 'new' });

      await service.create(P, ADMIN, { name: 'Todo' });

      expect(prisma.r_status.create).toHaveBeenCalledWith({
        data: { project_id: P, name: 'Todo', order: 1, is_default: true },
      });
    });

    it('transaksi bentrok sekali (P2034) → diulang lalu sukses', async () => {
      prisma.$transaction.mockRejectedValueOnce(prismaError('P2034'));
      asAdmin();
      prisma.r_status.findFirst.mockResolvedValue(status());
      prisma.r_status.create.mockResolvedValue({ id: 'new' });

      await expect(
        service.create(P, ADMIN, { name: 'Review' }),
      ).resolves.toEqual({ id: 'new' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('bentrok terus-menerus (P2034) → 409 setelah 3 percobaan', async () => {
      prisma.$transaction.mockRejectedValue(prismaError('P2034'));
      await expect(
        service.create(P, ADMIN, { name: 'Review' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('error lain diteruskan apa adanya, tanpa retry', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));
      await expect(
        service.create(P, ADMIN, { name: 'Review' }),
      ).rejects.toThrow('db down');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAllByProject', () => {
    it('non-member → 403', async () => {
      asNonMember();
      await expect(
        service.findAllByProject(P, ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.r_status.findMany).not.toHaveBeenCalled();
    });

    it('member biasa boleh melihat, terurut berdasarkan order', async () => {
      asMember();
      prisma.r_status.findMany.mockResolvedValue([status()]);

      const res = await service.findAllByProject(P, ADMIN);

      expect(res).toHaveLength(1);
      expect(prisma.r_status.findMany).toHaveBeenCalledWith({
        where: { project_id: P },
        orderBy: { order: 'asc' },
      });
    });
  });

  describe('update', () => {
    it('body kosong → 400 tanpa membuka transaksi', async () => {
      await expect(service.update(S, ADMIN, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('status tidak ada → 404', async () => {
      prisma.r_status.findUnique.mockResolvedValue(null);
      const result = service.update(S, ADMIN, { name: 'Baru' });
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      await expect(result).rejects.toThrow('Status not found');
    });

    it('member biasa → 403 NOT_ADMIN, tidak ada update', async () => {
      prisma.r_status.findUnique.mockResolvedValue(status());
      asMember();
      await expect(
        service.update(S, ADMIN, { name: 'Baru' }),
      ).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
      expect(prisma.r_status.update).not.toHaveBeenCalled();
    });

    it('unset default pada status default → 400', async () => {
      prisma.r_status.findUnique.mockResolvedValue(
        status({ is_default: true }),
      );
      asAdmin();
      const result = service.update(S, ADMIN, { is_default: false });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('Set another status as default first');
      expect(prisma.r_status.update).not.toHaveBeenCalled();
    });

    it('is_default=true → default lama di-unset (kecuali dirinya) lalu update', async () => {
      prisma.r_status.findUnique.mockResolvedValue(status());
      asAdmin();
      prisma.r_status.update.mockResolvedValue(status({ is_default: true }));

      await service.update(S, ADMIN, { is_default: true });

      expect(prisma.r_status.updateMany).toHaveBeenCalledWith({
        where: { project_id: P, is_default: true, NOT: { id: S } },
        data: { is_default: false },
      });
      expect(prisma.r_status.update.mock.calls[0][0].data).toEqual({
        is_default: true,
      });
    });

    it('hanya field yang dikirim yang di-update', async () => {
      prisma.r_status.findUnique.mockResolvedValue(status());
      asAdmin();
      prisma.r_status.update.mockResolvedValue(status({ name: 'Baru' }));

      await service.update(S, ADMIN, { name: 'Baru' });

      expect(prisma.r_status.updateMany).not.toHaveBeenCalled();
      expect(prisma.r_status.update).toHaveBeenCalledWith({
        where: { id: S },
        data: { name: 'Baru' },
      });
    });

    it('is_done diteruskan ke update', async () => {
      prisma.r_status.findUnique.mockResolvedValue(status());
      asAdmin();
      prisma.r_status.update.mockResolvedValue(status({ is_done: true }));

      await service.update(S, ADMIN, { is_done: true });

      expect(prisma.r_status.update.mock.calls[0][0].data).toEqual({
        is_done: true,
      });
    });
  });

  describe('remove', () => {
    const setup = (over: Record<string, unknown> = {}) => {
      prisma.r_status.findUnique.mockResolvedValue(status(over));
      asAdmin();
    };

    it('status tidak ada → 404', async () => {
      prisma.r_status.findUnique.mockResolvedValue(null);
      await expect(service.remove(S, ADMIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('member biasa → 403 NOT_ADMIN', async () => {
      prisma.r_status.findUnique.mockResolvedValue(status());
      asMember();
      await expect(service.remove(S, ADMIN)).rejects.toThrow(
        AUTH_MESSAGES.NOT_ADMIN,
      );
      expect(prisma.r_status.delete).not.toHaveBeenCalled();
    });

    it('masih dipakai task → 409, tidak dihapus', async () => {
      setup();
      prisma.t_task.count.mockResolvedValue(2);
      const result = service.remove(S, ADMIN);
      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow('Status still has tasks');
      expect(prisma.r_status.delete).not.toHaveBeenCalled();
    });

    it('status terakhir di project → 400', async () => {
      setup();
      prisma.t_task.count.mockResolvedValue(0);
      prisma.r_status.count.mockResolvedValue(1);
      const result = service.remove(S, ADMIN);
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(
        'Project must have at least one status',
      );
      expect(prisma.r_status.delete).not.toHaveBeenCalled();
    });

    it('status biasa → dihapus, default tidak diubah', async () => {
      setup({ is_default: false });
      prisma.t_task.count.mockResolvedValue(0);
      prisma.r_status.count.mockResolvedValue(3);

      await expect(service.remove(S, ADMIN)).resolves.toBeNull();

      expect(prisma.r_status.delete).toHaveBeenCalledWith({ where: { id: S } });
      expect(prisma.r_status.update).not.toHaveBeenCalled();
    });

    it('status default dihapus → status berikutnya jadi default', async () => {
      setup({ is_default: true });
      prisma.t_task.count.mockResolvedValue(0);
      prisma.r_status.count.mockResolvedValue(3);
      prisma.r_status.findFirst.mockResolvedValue({ id: 'next' });

      await expect(service.remove(S, ADMIN)).resolves.toBeNull();

      expect(prisma.r_status.findFirst).toHaveBeenCalledWith({
        where: { project_id: P },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });
      expect(prisma.r_status.update).toHaveBeenCalledWith({
        where: { id: 'next' },
        data: { is_default: true },
      });
    });

    it('FK violation (P2003) saat delete → 409', async () => {
      setup();
      prisma.t_task.count.mockResolvedValue(0);
      prisma.r_status.count.mockResolvedValue(3);
      prisma.r_status.delete.mockRejectedValue(prismaError('P2003'));
      await expect(service.remove(S, ADMIN)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('error lain diteruskan apa adanya', async () => {
      setup();
      prisma.t_task.count.mockRejectedValue(new Error('db down'));
      await expect(service.remove(S, ADMIN)).rejects.toThrow('db down');
    });
  });

  describe('reorder', () => {
    const existing = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    it('member biasa → 403 NOT_ADMIN', async () => {
      asMember();
      await expect(
        service.reorder(P, ADMIN, { order: ['a', 'b', 'c'] }),
      ).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
      expect(prisma.r_status.update).not.toHaveBeenCalled();
    });

    it.each([
      ['ada status yang tidak disebut', ['a', 'b']],
      ['berisi id asing', ['a', 'b', 'x']],
      ['berisi id duplikat', ['a', 'a', 'b']],
      ['array kosong', []],
    ])('order %s → 400, tidak ada update', async (_label, order) => {
      asAdmin();
      prisma.r_status.findMany.mockResolvedValue(existing);
      const result = service.reorder(P, ADMIN, { order });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow('every project status exactly once');
      expect(prisma.r_status.update).not.toHaveBeenCalled();
    });

    it('sukses: order di-set 1..n sesuai urutan baru', async () => {
      asAdmin();
      prisma.r_status.findMany
        .mockResolvedValueOnce(existing) // validasi
        .mockResolvedValueOnce([{ id: 'c' }, { id: 'a' }, { id: 'b' }]); // hasil

      const res = await service.reorder(P, ADMIN, { order: ['c', 'a', 'b'] });

      expect(prisma.r_status.update.mock.calls.map((c: any) => c[0])).toEqual([
        { where: { id: 'c' }, data: { order: 1 } },
        { where: { id: 'a' }, data: { order: 2 } },
        { where: { id: 'b' }, data: { order: 3 } },
      ]);
      expect(res).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
      expect(prisma.r_status.findMany).toHaveBeenLastCalledWith({
        where: { project_id: P },
        orderBy: { order: 'asc' },
      });
    });
  });
});