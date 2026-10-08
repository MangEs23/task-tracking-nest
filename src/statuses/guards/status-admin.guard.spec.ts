import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatusAdminGuard } from './status-admin.guard';
import { AUTH_MESSAGES } from '../../common/constants/auth-messages';

const STATUS_ID = '550e8400-e29b-41d4-a716-446655440000';
const PROJECT_ID = '660e8400-e29b-41d4-a716-446655440000';

describe('StatusAdminGuard', () => {
  const prisma = {
    r_status: { findUnique: jest.fn() },
    t_project_member: { findFirst: jest.fn() },
  } as any;
  const guard = new StatusAdminGuard(prisma);

  const ctx = (
    id: string = STATUS_ID,
    user: any = { id: 'u1' },
    request: any = { user, params: { id } },
  ) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.r_status.findUnique.mockResolvedValue({ project_id: PROJECT_ID });
  });

  it('tanpa user → 403 UNAUTHENTICATED', async () => {
    const result = guard.canActivate(ctx(STATUS_ID, null));
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.UNAUTHENTICATED);
  });

  it('id bukan UUID → 400, tanpa query DB', async () => {
    await expect(guard.canActivate(ctx('abc'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.r_status.findUnique).not.toHaveBeenCalled();
  });

  it('status tidak ada → 404', async () => {
    prisma.r_status.findUnique.mockResolvedValue(null);
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('Status not found');
  });

  it('non-member → 403 NOT_MEMBER', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue(null);
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_MEMBER);
  });

  it('member biasa → 403 NOT_ADMIN', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'member' });
    const result = guard.canActivate(ctx());
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    await expect(result).rejects.toThrow(AUTH_MESSAGES.NOT_ADMIN);
  });

  it('admin → lolos dan membaca keanggotaan di project milik status', async () => {
    prisma.t_project_member.findFirst.mockResolvedValue({ role: 'admin' });
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    expect(prisma.t_project_member.findFirst).toHaveBeenCalledWith({
      where: { project_id: PROJECT_ID, user_id: 'u1' },
    });
  });

  it('admin → request.projectMember terisi', async () => {
    const member = { role: 'admin' };
    prisma.t_project_member.findFirst.mockResolvedValue(member);
    const request: any = { user: { id: 'u1' }, params: { id: STATUS_ID } };
    await guard.canActivate(ctx(STATUS_ID, undefined, request));
    expect(request.projectMember).toBe(member);
  });
});