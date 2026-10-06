import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EpicAdminGuard } from './epic-admin.guard';
import { EpicMemberGuard } from './epic-member.guard';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

const EPIC_ID = '550e8400-e29b-41d4-a716-446655440000';
const PROJECT_ID = '660e8400-e29b-41d4-a716-446655440000';

describe('Epic guards', () => {
  const prisma = {
    t_epic: { findUnique: jest.fn() },
    t_project_member: { findFirst: jest.fn() },
  } as any;

  const ctx = (id: string = EPIC_ID, user: any = { id: 'u1' }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params: { id } }),
      }),
    }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.t_epic.findUnique.mockResolvedValue({ project_id: PROJECT_ID });
  });

  describe('EpicMemberGuard', () => {
    const guard = new EpicMemberGuard(prisma);

    it('member biasa → lolos (read-only endpoint)', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
      await expect(guard.canActivate(ctx())).resolves.toBe(true);
    });

    it('admin → lolos', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
      await expect(guard.canActivate(ctx())).resolves.toBe(true);
    });

    it('non-member → 403 NOT_MEMBER', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);
      const result = guard.canActivate(ctx());
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
    });

    it('epic tidak ada → 404', async () => {
      prisma.t_epic.findUnique.mockResolvedValue(null);
      await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('id bukan UUID → 400', async () => {
      await expect(guard.canActivate(ctx('abc'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('tanpa user → 403 UNAUTHENTICATED', async () => {
      const result = guard.canActivate(ctx(EPIC_ID, null));
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.UNAUTHENTICATED);
    });
  });

  describe('EpicAdminGuard', () => {
    const guard = new EpicAdminGuard(prisma);

    it('member biasa → 403 NOT_ADMIN', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
      const result = guard.canActivate(ctx());
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
    });

    it('non-member → 403 NOT_MEMBER', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue(null);
      await expect(guard.canActivate(ctx())).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
    });

    it('admin → lolos', async () => {
      prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
      await expect(guard.canActivate(ctx())).resolves.toBe(true);
    });

    it('tanpa user → 403 UNAUTHENTICATED', async () => {
      const result = guard.canActivate(ctx(EPIC_ID, null));
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
      await expect(result).rejects.toThrow(AUTH_MESSAGES.UNAUTHENTICATED);
    });
  });
});