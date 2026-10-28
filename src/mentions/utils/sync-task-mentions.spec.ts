import type { Prisma } from '@prisma/client';
import { syncTaskMentions } from './sync-task-mentions';

const TASK = 'task-1';
const PROJECT = 'project-1';
const ACTOR = 'user-editor';
const ANGGA = 'user-angga';

describe('syncTaskMentions', () => {
  const tx = {
    t_task_mention: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    t_project_member: {
      findMany: jest.fn(),
    },
  };

  const run = (description: string | null) =>
    syncTaskMentions(
      tx as unknown as Prisma.TransactionClient,
      {
        taskId: TASK,
        projectId: PROJECT,
        actorId: ACTOR,
        description,
      },
    );

  beforeEach(() => {
    jest.resetAllMocks();

    tx.t_task_mention.findMany.mockResolvedValue([]);
    tx.t_task_mention.deleteMany.mockResolvedValue({
      count: 0,
    });
    tx.t_task_mention.createMany.mockResolvedValue({
      count: 0,
    });
    tx.t_project_member.findMany.mockResolvedValue([]);
  });

  it('membuat mention baru hanya untuk member project', async () => {
    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: ANGGA },
    ]);

    await run('Tolong cek @ANGGA@Example.COM.');

    expect(tx.t_project_member.findMany).toHaveBeenCalledWith({
      where: {
        project_id: PROJECT,
        user: {
          email: {
            in: ['angga@example.com'],
          },
        },
      },
      select: {
        user_id: true,
      },
    });

    expect(tx.t_task_mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          task_id: TASK,
          user_id: ANGGA,
          mentioned_by: ACTOR,
          read_at: null,
        },
      ],
    });
  });

  it('email non-member diabaikan tanpa error', async () => {
    await expect(
      run('Tolong cek @vendor@example.com'),
    ).resolves.toBeUndefined();

    expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
  });

  it('mention berulang hanya menghasilkan satu relasi', async () => {
    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: ANGGA },
    ]);

    await run(
      '@angga@example.com dan @ANGGA@EXAMPLE.COM',
    );

    expect(tx.t_task_mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          task_id: TASK,
          user_id: ANGGA,
          mentioned_by: ACTOR,
          read_at: null,
        },
      ],
    });
  });

  it('mention ke diri sendiri tetap dibuat sebagai unread', async () => {
    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: ACTOR },
    ]);

    await run('Catatan untuk @editor@example.com');

    expect(tx.t_task_mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          task_id: TASK,
          user_id: ACTOR,
          mentioned_by: ACTOR,
          read_at: null,
        },
      ],
    });
  });

  it('mention lama tidak dihapus, dibuat ulang, atau di-update', async () => {
    const oldMention = {
      id: 'mention-old',
      user_id: ANGGA,
      user: { email: 'angga@example.com' },
      mentioned_by: 'original-author',
      read_at: new Date('2026-10-27T01:00:00Z'),
      created_at: new Date('2026-10-27T00:00:00Z'),
    };

    tx.t_task_mention.findMany.mockResolvedValue([
      oldMention,
    ]);

    await run('Deskripsi baru untuk @ANGGA@example.com.');

    expect(tx.t_task_mention.deleteMany).not.toHaveBeenCalled();
    expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
    expect(tx.t_task_mention.update).not.toHaveBeenCalled();
    expect(tx.t_task_mention.updateMany).not.toHaveBeenCalled();

    expect(tx.t_project_member.findMany).not.toHaveBeenCalled();
  });

  it('mention mantan member tetap ada selama token masih ada', async () => {
    tx.t_task_mention.findMany.mockResolvedValue([
      {
        id: 'mention-former-member',
        user_id: ANGGA,
        user: { email: 'angga@example.com' },
      },
    ]);

    // Tidak ada membership saat ini.
    tx.t_project_member.findMany.mockResolvedValue([]);

    await run('Tetap meminta masukan @angga@example.com');

    expect(tx.t_project_member.findMany).not.toHaveBeenCalled();
    expect(tx.t_task_mention.deleteMany).not.toHaveBeenCalled();
    expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
  });

  it('diff mempertahankan yang masih ada, menghapus yang hilang, dan menambah yang baru', async () => {
    tx.t_task_mention.findMany.mockResolvedValue([
      {
        id: 'mention-keep',
        user_id: ANGGA,
        user: { email: 'angga@example.com' },
      },
      {
        id: 'mention-remove',
        user_id: 'user-lama',
        user: { email: 'lama@example.com' },
      },
    ]);

    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: 'user-baru' },
    ]);

    await run(
      '@angga@example.com diskusi dengan @baru@example.com',
    );

    expect(tx.t_project_member.findMany).toHaveBeenCalledWith({
      where: {
        project_id: PROJECT,
        user: {
          email: {
            in: ['baru@example.com'],
          },
        },
      },
      select: {
        user_id: true,
      },
    });

    expect(tx.t_task_mention.deleteMany).toHaveBeenCalledWith({
      where: {
        task_id: TASK,
        id: {
          in: ['mention-remove'],
        },
      },
    });

    expect(tx.t_task_mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          task_id: TASK,
          user_id: 'user-baru',
          mentioned_by: ACTOR,
          read_at: null,
        },
      ],
    });

    expect(tx.t_task_mention.updateMany).not.toHaveBeenCalled();
  });

  it.each([null, '', 'Deskripsi tanpa mention'])(
    'menghapus mention lama ketika tidak ada token: %j',
    async (description) => {
      tx.t_task_mention.findMany.mockResolvedValue([
        {
          id: 'mention-old',
          user_id: ANGGA,
          user: { email: 'angga@example.com' },
        },
      ]);

      await run(description);

      expect(tx.t_task_mention.deleteMany).toHaveBeenCalledWith({
        where: {
          task_id: TASK,
          id: {
            in: ['mention-old'],
          },
        },
      });

      expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
      expect(tx.t_project_member.findMany).not.toHaveBeenCalled();
    },
  );

  it('mention yang ditambahkan kembali dibuat sebagai unread', async () => {
    // Baris lama sudah tidak ada, misalnya karena dihapus
    // dari deskripsi pada penyimpanan sebelumnya.
    tx.t_task_mention.findMany.mockResolvedValue([]);
    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: ANGGA },
    ]);

    await run('Ditambahkan kembali @angga@example.com');

    expect(tx.t_task_mention.createMany).toHaveBeenCalledWith({
      data: [
        {
          task_id: TASK,
          user_id: ANGGA,
          mentioned_by: ACTOR,
          read_at: null,
        },
      ],
    });
  });

  it('mantan member tidak bisa menerima mention baru', async () => {
    tx.t_task_mention.findMany.mockResolvedValue([]);
    tx.t_project_member.findMany.mockResolvedValue([]);

    await run('Mention baru @angga@example.com');

    expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
  });

  it('task tanpa mention tidak melakukan penulisan', async () => {
    await run(null);

    expect(tx.t_task_mention.findMany).toHaveBeenCalledWith({
      where: { task_id: TASK },
      select: {
        id: true,
        user_id: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    expect(tx.t_task_mention.deleteMany).not.toHaveBeenCalled();
    expect(tx.t_task_mention.createMany).not.toHaveBeenCalled();
  });

  it('error database diteruskan agar transaksi pemanggil dibatalkan', async () => {
    const failure = new Error('Insert mention failed');

    tx.t_project_member.findMany.mockResolvedValue([
      { user_id: ANGGA },
    ]);
    tx.t_task_mention.createMany.mockRejectedValue(failure);

    await expect(
      run('@angga@example.com'),
    ).rejects.toBe(failure);
  });
});