import { ForbiddenException } from '@nestjs/common';
import { ProjectMemberGuard } from './project-member.guard';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('ProjectMemberGuard', () => {
  const prisma = { t_project_member: { findFirst: jest.fn() } } as any;
  const guard = new ProjectMemberGuard(prisma);

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

  it('non-member akses project yang bukan miliknya → 403 NOT_MEMBER', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue(null);
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
  });

  it('member biasa → lolos (bukan admin pun tidak ditolak)', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });
});