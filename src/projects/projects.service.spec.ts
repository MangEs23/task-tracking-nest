
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { ProjectRole } from './dto/add-member.dto';

const P = 'project-1';
const ADMIN = 'user-admin';
const OTHER = 'user-other';

describe('ProjectsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    m_user: {
      findUnique: jest.fn(),
    },
    m_project: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    t_project_member: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    t_task: {
      deleteMany: jest.fn(),
    },
    t_task_assignee: {
      deleteMany: jest.fn(),
    },
  } as any;

  const service = new ProjectsService(prisma);

  beforeEach(() => {
    jest.resetAllMocks();

    // Mendukung transaksi callback dan transaksi array.
    prisma.$transaction.mockImplementation(
      (
        operation:
          | ((tx: typeof prisma) => Promise<unknown>)
          | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? operation(prisma)
          : Promise.all(operation),
    );
  });

  describe('create', () => {
    it('membuat project dengan creator sebagai admin + 3 status default', async () => {
      prisma.m_project.create.mockResolvedValue({ id: P });

      await service.create(ADMIN, { name: 'Proj' });

      const arg = prisma.m_project.create.mock.calls[0][0];

      expect(arg.data.created_by).toBe(ADMIN);
      expect(arg.data.members.create).toEqual({
        user_id: ADMIN,
        role: 'admin',
      });

      expect(arg.data.statuses.create).toHaveLength(3);

      expect(
        arg.data.statuses.create.filter((s: any) => s.is_default),
      ).toHaveLength(1);

      expect(
        arg.data.statuses.create.filter((s: any) => s.is_done),
      ).toHaveLength(1);
    });

    it('error DB → 500', async () => {
      prisma.m_project.create.mockRejectedValue(
        new Error('db down'),
      );

      await expect(
        service.create(ADMIN, { name: 'Proj' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findOne', () => {
    const project = {
      id: P,
      name: 'Proj',
      description: null,
      created_by: ADMIN,
      created_at: new Date(),
      members: [
        {
          user_id: ADMIN,
          role: 'admin',
          user: {
            name: 'A',
            email: 'a@x.com',
          },
        },
        {
          user_id: OTHER,
          role: 'member',
          user: {
            name: 'B',
            email: 'b@x.com',
          },
        },
      ],
    };

    it('mengembalikan my_role sesuai user yang request', async () => {
      prisma.m_project.findUnique.mockResolvedValue(project);

      expect((await service.findOne(P, OTHER)).my_role).toBe(
        'member',
      );

      expect((await service.findOne(P, ADMIN)).my_role).toBe(
        'admin',
      );
    });

    it('project tidak ada → 404', async () => {
      prisma.m_project.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(P, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('body kosong → 400 tanpa query DB', async () => {
      await expect(
        service.update(P, {}),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.m_project.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('hapus task lalu project dalam satu transaksi', async () => {
      await expect(service.remove(P)).resolves.toBeNull();

      expect(prisma.t_task.deleteMany).toHaveBeenCalledWith({
        where: {
          epic: { project_id: P },
        },
      });

      expect(prisma.m_project.delete).toHaveBeenCalledWith({
        where: { id: P },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('addMember', () => {
    it('user tidak ditemukan → 404', async () => {
      prisma.m_user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember(P, { email: 'x@x.com' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sudah member → 400', async () => {
      prisma.m_user.findUnique.mockResolvedValue({
        id: OTHER,
      });

      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm1',
      });

      await expect(
        service.addMember(P, { email: 'x@x.com' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        prisma.t_project_member.create,
      ).not.toHaveBeenCalled();
    });

    it('sukses, role default member', async () => {
      prisma.m_user.findUnique.mockResolvedValue({
        id: OTHER,
        name: 'B',
        email: 'b@x.com',
      });

      prisma.t_project_member.findFirst.mockResolvedValue(null);

      prisma.t_project_member.create.mockResolvedValue({
        role: 'member',
      });

      const result = await service.addMember(P, {
        email: 'b@x.com',
      } as any);

      expect(
        prisma.t_project_member.create,
      ).toHaveBeenCalledWith({
        data: {
          project_id: P,
          user_id: OTHER,
          role: 'member',
        },
      });

      expect(result).toEqual({
        user_id: OTHER,
        name: 'B',
        email: 'b@x.com',
        role: 'member',
      });
    });

    it('race condition duplikasi member (P2002) → 400', async () => {
      prisma.m_user.findUnique.mockResolvedValue({
        id: OTHER,
      });

      prisma.t_project_member.findFirst.mockResolvedValue(null);

      prisma.t_project_member.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.addMember(P, { email: 'x@x.com' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateMemberRole', () => {
    const updated = (role: string) => ({
      role,
      user: {
        id: OTHER,
        name: 'B',
        email: 'b@x.com',
      },
    });

    it('member tidak ditemukan → 404', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(P, OTHER, {
          role: ProjectRole.ADMIN,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('demote admin terakhir → 400', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm1',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole(P, ADMIN, {
          role: ProjectRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(
        prisma.t_project_member.update,
      ).not.toHaveBeenCalled();
    });

    it('demote admin saat masih ada admin lain → sukses', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm1',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(2);

      prisma.t_project_member.update.mockResolvedValue(
        updated('member'),
      );

      const result = await service.updateMemberRole(P, OTHER, {
        role: ProjectRole.MEMBER,
      });

      expect(result).toEqual({
        user_id: OTHER,
        name: 'B',
        email: 'b@x.com',
        role: 'member',
      });

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    });

    it('promote member menjadi admin tanpa cek jumlah admin', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm2',
        role: 'member',
      });

      prisma.t_project_member.update.mockResolvedValue(
        updated('admin'),
      );

      const result = await service.updateMemberRole(P, OTHER, {
        role: ProjectRole.ADMIN,
      });

      expect(result.role).toBe('admin');

      expect(
        prisma.t_project_member.count,
      ).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('remove diri sendiri sebagai admin terakhir → 400', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-admin',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(1);

      await expect(
        service.removeMember(P, ADMIN, ADMIN),
      ).rejects.toThrow(
        'Cannot remove yourself as the last admin of the project',
      );

      expect(
        prisma.t_project_member.delete,
      ).not.toHaveBeenCalled();

      expect(
        prisma.t_task_assignee.deleteMany,
      ).not.toHaveBeenCalled();
    });

    it('remove diri sendiri saat ada admin lain → sukses', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-admin',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(2);

      await expect(
        service.removeMember(P, ADMIN, ADMIN),
      ).resolves.toBeNull();

      expect(
        prisma.t_project_member.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'm-admin' },
      });
    });

    it('target bukan member → 404', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);

      await expect(
        service.removeMember(P, ADMIN, OTHER),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(
        prisma.t_project_member.delete,
      ).not.toHaveBeenCalled();
    });

    it('hapus assignment dalam project dan member dalam satu transaksi', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm2',
        role: 'member',
      });

      await expect(
        service.removeMember(P, ADMIN, OTHER),
      ).resolves.toBeNull();

      expect(
        prisma.t_task_assignee.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          user_id: OTHER,
          task: {
            epic: {
              project_id: P,
            },
          },
        },
      });

      expect(
        prisma.t_project_member.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'm2' },
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      expect(
        prisma.t_project_member.count,
      ).not.toHaveBeenCalled();
    });

    it('admin lain boleh remove creator jika masih ada admin lain', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-creator',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(2);

      await expect(
        service.removeMember(P, OTHER, ADMIN),
      ).resolves.toBeNull();
    });

    it('menolak penghapusan target admin terakhir meskipun bukan diri sendiri', async () => {
      // Menguji invariant di service; otorisasi caller ada di guard.
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-last-admin',
        role: 'admin',
      });

      prisma.t_project_member.count.mockResolvedValue(1);

      await expect(
        service.removeMember(P, ADMIN, OTHER),
      ).rejects.toThrow(
        'Cannot remove the last admin of the project',
      );

      expect(
        prisma.t_project_member.delete,
      ).not.toHaveBeenCalled();

      expect(
        prisma.t_task_assignee.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe('member transaction conflicts', () => {
    const conflict = () =>
      new Prisma.PrismaClientKnownRequestError(
        'Serialization conflict',
        {
          code: 'P2034',
          clientVersion: 'test',
        },
      );

    it('mengulang pengecekan jumlah admin setelah konflik', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-admin',
        role: 'admin',
      });

      prisma.t_project_member.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      prisma.t_project_member.update.mockRejectedValueOnce(
        conflict(),
      );

      await expect(
        service.updateMemberRole(P, ADMIN, {
          role: ProjectRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);

      expect(
        prisma.t_project_member.count,
      ).toHaveBeenCalledTimes(2);

      expect(
        prisma.t_project_member.update,
      ).toHaveBeenCalledTimes(1);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    });

    it('mengulang pengecekan sebelum menghapus admin', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({
        id: 'm-admin',
        role: 'admin',
      });

      prisma.t_project_member.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      prisma.t_project_member.delete.mockRejectedValueOnce(
        conflict(),
      );

      await expect(
        service.removeMember(P, ADMIN, ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);

      expect(
        prisma.t_project_member.count,
      ).toHaveBeenCalledTimes(2);

      expect(
        prisma.t_project_member.delete,
      ).toHaveBeenCalledTimes(1);
    });

    it('mengembalikan 409 setelah tiga transaksi berkonflik', async () => {
      prisma.$transaction.mockRejectedValue(conflict());

      await expect(
        service.updateMemberRole(P, ADMIN, {
          role: ProjectRole.MEMBER,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('tidak mengulang error database selain P2034', async () => {
      const failure = new Error('Database unavailable');

      prisma.$transaction.mockRejectedValue(failure);

      await expect(
        service.updateMemberRole(P, ADMIN, {
          role: ProjectRole.MEMBER,
        }),
      ).rejects.toBe(failure);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
