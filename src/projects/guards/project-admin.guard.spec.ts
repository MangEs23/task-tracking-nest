import { ForbiddenException } from '@nestjs/common';
import { ProjectAdminGuard } from './project-admin.guard';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('ProjectAdminGuard', () => {
  const prisma = { t_project_member: { findFirst: jest.fn() } } as any;
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

  it('non-member → 403 NOT_MEMBER', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue(null);
    await expect(guard.canActivate(ctx())).rejects.toThrow(
      AUTH_MESSAGES.NOT_MEMBER,
    );
  });

  it('admin → lolos', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });
});