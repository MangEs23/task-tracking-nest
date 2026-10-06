import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';

const P = 'project-1';
const ADMIN = 'user-admin';
const OTHER = 'user-other';

describe('ProjectsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    m_user: { findUnique: jest.fn() },
    m_project: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    t_project_member: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    t_task: { deleteMany: jest.fn() },
    t_task_assignee: { deleteMany: jest.fn() },
  } as any;

  const service = new ProjectsService(prisma);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockResolvedValue([]);
  });

  describe('create', () => {
    it('membuat project dengan creator sebagai admin + 3 status default', async () => {
      prisma.m_project.create.mockResolvedValue({ id: P });
      await service.create(ADMIN, { name: 'Proj' });

      const arg = prisma.m_project.create.mock.calls[0][0];
      expect(arg.data.created_by).toBe(ADMIN);
      expect(arg.data.members.create).toEqual({ user_id: ADMIN, role: 'admin' });
      expect(arg.data.statuses.create).toHaveLength(3);
      expect(arg.data.statuses.create.filter((s: any) => s.is_default)).toHaveLength(1);
      expect(arg.data.statuses.create.filter((s: any) => s.is_done)).toHaveLength(1);
    });

    it('error DB → 500', async () => {
      prisma.m_project.create.mockRejectedValue(new Error('db down'));
      await expect(service.create(ADMIN, { name: 'Proj' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
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
        { user_id: ADMIN, role: 'admin', user: { name: 'A', email: 'a@x.com' } },
        { user_id: OTHER, role: 'member', user: { name: 'B', email: 'b@x.com' } },
      ],
    };

    it('mengembalikan my_role sesuai user yang request', async () => {
      prisma.m_project.findUnique.mockResolvedValue(project);
      expect((await service.findOne(P, OTHER)).my_role).toBe('member');
      expect((await service.findOne(P, ADMIN)).my_role).toBe('admin');
    });

    it('project tidak ada → 404', async () => {
      prisma.m_project.findUnique.mockResolvedValue(null);
      await expect(service.findOne(P, ADMIN)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hapus task lalu project dalam satu transaksi', async () => {
      await expect(service.remove(P)).resolves.toBeNull();
      expect(prisma.t_task.deleteMany).toHaveBeenCalledWith({
        where: { epic: { project_id: P } },
      });
      expect(prisma.m_project.delete).toHaveBeenCalledWith({ where: { id: P } });
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
      prisma.m_user.findUnique.mockResolvedValue({ id: OTHER });
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm1' });
      await expect(
        service.addMember(P, { email: 'x@x.com' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.t_project_member.create).not.toHaveBeenCalled();
    });

    it('sukses, role default member', async () => {
      prisma.m_user.findUnique.mockResolvedValue({
        id: OTHER,
        name: 'B',
        email: 'b@x.com',
      });
      prisma.t_project_member.findFirst.mockResolvedValue(null);
      prisma.t_project_member.create.mockResolvedValue({ role: 'member' });

      const res = await service.addMember(P, { email: 'b@x.com' } as any);
      expect(prisma.t_project_member.create).toHaveBeenCalledWith({
        data: { project_id: P, user_id: OTHER, role: 'member' },
      });
      expect(res).toEqual({
        user_id: OTHER,
        name: 'B',
        email: 'b@x.com',
        role: 'member',
      });
    });
  });

  describe('updateMemberRole', () => {
    const updated = (role: string) => ({
      role,
      user: { id: OTHER, name: 'B', email: 'b@x.com' },
    });

    it('member tidak ditemukan → 404', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);
      await expect(
        service.updateMemberRole(P, OTHER, { role: 'admin' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('demote admin terakhir → 400', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm1', role: 'admin' });
      prisma.t_project_member.count.mockResolvedValue(1);
      await expect(
        service.updateMemberRole(P, ADMIN, { role: 'member' } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.t_project_member.update).not.toHaveBeenCalled();
    });

    it('demote admin saat masih ada admin lain → sukses', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm1', role: 'admin' });
      prisma.t_project_member.count.mockResolvedValue(2);
      prisma.t_project_member.update.mockResolvedValue(updated('member'));
      const res = await service.updateMemberRole(P, OTHER, { role: 'member' } as any);
      expect(res.role).toBe('member');
    });

    it('promote member jadi admin → sukses tanpa cek jumlah admin', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm2', role: 'member' });
      prisma.t_project_member.update.mockResolvedValue(updated('admin'));
      const res = await service.updateMemberRole(P, OTHER, { role: 'admin' } as any);
      expect(res.role).toBe('admin');
      expect(prisma.t_project_member.count).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('remove diri sendiri sebagai admin terakhir → 400', async () => {
      prisma.t_project_member.count.mockResolvedValue(1);
      await expect(service.removeMember(P, ADMIN, ADMIN)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('remove diri sendiri saat ada admin lain → sukses', async () => {
      prisma.t_project_member.count.mockResolvedValue(2);
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm1' });
      await expect(service.removeMember(P, ADMIN, ADMIN)).resolves.toBeNull();
    });

    it('target bukan member → 404', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);
      await expect(service.removeMember(P, ADMIN, OTHER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sukses: hapus assignee di project ini + hapus member, satu transaksi', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm2' });
      await expect(service.removeMember(P, ADMIN, OTHER)).resolves.toBeNull();

      expect(prisma.t_task_assignee.deleteMany).toHaveBeenCalledWith({
        where: { user_id: OTHER, task: { epic: { project_id: P } } },
      });
      expect(prisma.t_project_member.delete).toHaveBeenCalledWith({
        where: { id: 'm2' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('[perilaku saat ini] admin lain boleh remove creator', async () => {
      // ADMIN = creator, OTHER = admin yang diangkat; OTHER me-remove ADMIN
      prisma.t_project_member.findFirst.mockResolvedValue({ id: 'm-creator' });
      await expect(service.removeMember(P, OTHER, ADMIN)).resolves.toBeNull();
    });
  });
});