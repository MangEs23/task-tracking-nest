import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectAdminGuard } from './project-admin.guard';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('ProjectAdminGuard', () => {
  const prisma = {
    t_project_member: { findFirst: jest.fn() },
    m_project: { findUnique: jest.fn() },
  } as any;
  const guard = new ProjectAdminGuard(prisma);

  const ctx = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1' },
          params: { projectId: PROJECT_ID },
        }),
      }),
    }) as any;

  beforeEach(() => jest.resetAllMocks());

  it('member biasa akses endpoint admin-only → 403 NOT_ADMIN', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
  });

  it('non-member (project ada) → 403 NOT_MEMBER', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue(null);
    prisma.m_project.findUnique.mockResolvedValue({ id: PROJECT_ID });
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
  });

  it('project tidak ada → 404 Project not found', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue(null);
    prisma.m_project.findUnique.mockResolvedValue(null);
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('Project not found');
  });

  it('admin → lolos', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });
});