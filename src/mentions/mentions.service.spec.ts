import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MentionInboxQueryDto } from './dto/mention-query.dto';
import { MentionsService } from './mentions.service';

const ME = 'bf4b456c-cc17-44d8-801a-069013bcb00e';
const OTHER = '28a2487b-ffc0-49e3-83be-e458657bc39d';
const PROJECT = '3162eef7-f109-4fac-b73b-475bf984bb52';
const MENTION = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';
const CREATED = new Date('2026-10-27T05:00:00.000Z');

function makeRow() {
  return {
    id: MENTION,
    read_at: null as Date | null,
    created_at: CREATED,
    author_id: OTHER,
    author_name: 'John',
    task_id: 'task-1',
    task_title: 'Periksa implementasi',
    epic_id: 'epic-1',
    project_id: PROJECT,
    project_name: 'Project Uji',
    description: 'Tolong cek @salman@example.com.',
    has_access: true,
    mention_names: [
      {
        user_id: ME,
        name: 'Salman',
        email: 'salman@example.com',
      },
    ],
  };
}

function makeQuery(
  overrides: Partial<MentionInboxQueryDto> = {},
): MentionInboxQueryDto {
  return Object.assign(new MentionInboxQueryDto(), overrides);
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('MentionsService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    t_task_mention: {
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const service = new MentionsService(
    prisma as unknown as PrismaService,
  );

  function lastSql(): Prisma.Sql {
    const calls = prisma.$queryRaw.mock.calls;
    return calls[calls.length - 1][0] as Prisma.Sql;
  }

  function sqlText(): string {
    return lastSql().sql.replace(/\s+/g, ' ').trim();
  }

  beforeEach(() => {
    jest.resetAllMocks();

    prisma.$queryRaw.mockResolvedValue([]);
    prisma.t_task_mention.count.mockResolvedValue(0);
    prisma.t_task_mention.updateMany.mockResolvedValue({
      count: 0,
    });
  });

  describe('findAll', () => {
    it('inbox kosong menghasilkan items kosong dan cursor null', async () => {
      const result = await service.findAll(ME, makeQuery());

      expect(result).toEqual({
        items: [],
        next_cursor: null,
      });
    });

    it('memformat item dan mengganti email mention dengan nama', async () => {
      prisma.$queryRaw.mockResolvedValue([makeRow()]);

      const result = await service.findAll(ME, makeQuery());

      expect(result).toEqual({
        items: [
          {
            id: MENTION,
            read_at: null,
            created_at: CREATED,
            mentioned_by: {
              id: OTHER,
              name: 'John',
            },
            task: {
              id: 'task-1',
              title: 'Periksa implementasi',
              epic_id: 'epic-1',
            },
            project: {
              id: PROJECT,
              name: 'Project Uji',
            },
            has_access: true,
            snippet: 'Tolong cek @Salman.',
          },
        ],
        next_cursor: null,
      });

      expect(result.items[0]).not.toHaveProperty('description');
      expect(result.items[0]).not.toHaveProperty('mention_names');
    });

    it('membatasi query ke penerima yang login dan memakai LEFT JOIN akses', async () => {
      await service.findAll(ME, makeQuery());

      expect(sqlText()).toContain('WHERE m.user_id = ?::uuid');
      expect(sqlText()).toContain(
        'LEFT JOIN t_project_member AS pm',
      );
      expect(sqlText()).toContain(
        'ORDER BY m.created_at DESC, m.id DESC',
      );
      expect(lastSql().values).toEqual([ME, 21]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('unread=true dan project_id diterapkan bersama', async () => {
      await service.findAll(
        ME,
        makeQuery({
          unread: true,
          project_id: PROJECT,
        }),
      );

      expect(sqlText()).toContain('m.read_at IS NULL');
      expect(sqlText()).toContain('p.id = ?::uuid');
      expect(lastSql().values).toEqual([ME, PROJECT, 21]);
    });

    it('unread=false tidak membatasi hanya mention belum dibaca', async () => {
      await service.findAll(
        ME,
        makeQuery({ unread: false }),
      );

      expect(sqlText()).not.toContain('m.read_at IS NULL');
    });

    it('tetap mengembalikan mention dengan has_access=false', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...makeRow(),
          has_access: false,
        },
      ]);

      const result = await service.findAll(ME, makeQuery());

      expect(result.items).toHaveLength(1);
      expect(result.items[0].has_access).toBe(false);
      expect(result.items[0].snippet).toBe('Tolong cek @Salman.');

      // Membership memberi flag akses, bukan menyaring inbox.
      expect(sqlText()).not.toContain('AND pm.id IS NOT NULL');
    });

    it('self-mention tetap dikembalikan', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...makeRow(),
          author_id: ME,
          author_name: 'Salman',
        },
      ]);

      const result = await service.findAll(ME, makeQuery());

      expect(result.items[0].mentioned_by.id).toBe(ME);
      expect(sqlText()).not.toMatch(
        /m\.mentioned_by\s*(?:!=|<>)/,
      );
    });
  });

  describe('pagination', () => {
    it('mengambil limit+1 dan membuat cursor dari item terakhir yang ditampilkan', async () => {
      prisma.$queryRaw.mockResolvedValue([
        makeRow(),
        {
          ...makeRow(),
          id: SECOND,
        },
      ]);

      const result = await service.findAll(
        ME,
        makeQuery({ limit: 1 }),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(MENTION);
      expect(lastSql().values).toEqual([ME, 2]);

      expect(result.next_cursor).not.toBeNull();

      const payload = JSON.parse(
        Buffer.from(
          result.next_cursor!,
          'base64url',
        ).toString('utf8'),
      );

      expect(payload).toEqual({
        id: MENTION,
        created_at: CREATED.toISOString(),
      });
    });

    it('halaman terakhir tidak mengembalikan cursor', async () => {
      prisma.$queryRaw.mockResolvedValue([makeRow()]);

      const result = await service.findAll(
        ME,
        makeQuery({ limit: 1 }),
      );

      expect(result.next_cursor).toBeNull();
    });

    it('cursor memakai pasangan waktu dan ID tanpa mencari ulang baris cursor', async () => {
      const cursor = encode({
        id: MENTION,
        created_at: CREATED.toISOString(),
      });

      await service.findAll(
        ME,
        makeQuery({ cursor, limit: 2 }),
      );

      expect(sqlText()).toContain(
        '(m.created_at, m.id) <',
      );
      expect(lastSql().values).toEqual([
        ME,
        CREATED,
        MENTION,
        3,
      ]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it.each([
      '***',
      'a'.repeat(513),
      Buffer.from('bukan-json').toString('base64url'),
      encode(null),
      encode([]),
      encode({}),
      encode({
        id: 'bukan-uuid',
        created_at: CREATED.toISOString(),
      }),
      encode({
        id: MENTION,
        created_at: 'bukan-tanggal',
      }),
      encode({
        id: MENTION,
        created_at: '2026-10-27',
      }),
    ])('menolak cursor tidak valid sebelum query: %j', async (cursor) => {
      await expect(
        service.findAll(ME, makeQuery({ cursor })),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('snippet', () => {
    it('deskripsi null menghasilkan snippet kosong', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...makeRow(),
          description: null,
        },
      ]);

      const result = await service.findAll(ME, makeQuery());

      expect(result.items[0].snippet).toBe('');
    });

    it('nama terbaru digunakan, kapitalisasi email diabaikan, teks biasa dipertahankan', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...makeRow(),
          description:
            'Cek\n@SALMAN@example.com dan @vendor@example.com.',
          mention_names: [
            {
              user_id: ME,
              name: 'Salman Alfaridzi',
              email: 'salman@example.com',
            },
          ],
        },
      ]);

      const result = await service.findAll(ME, makeQuery());

      expect(result.items[0].snippet).toBe(
        'Cek @Salman Alfaridzi dan @vendor@example.com.',
      );
    });

    it('memotong teks panjang di sekitar mention penerima', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          ...makeRow(),
          description:
            'awal '.repeat(60) +
            '@salman@example.com ' +
            'akhir '.repeat(60),
        },
      ]);

      const result = await service.findAll(ME, makeQuery());
      const snippet = result.items[0].snippet;

      expect(snippet).toContain('@Salman');
      expect(snippet).not.toContain('salman@example.com');
      expect(snippet.startsWith('…')).toBe(true);
      expect(snippet.endsWith('…')).toBe(true);
      expect(Array.from(snippet).length).toBeLessThanOrEqual(122);
    });
  });

  describe('unreadCount', () => {
    it('menghitung hanya mention unread milik user login', async () => {
      prisma.t_task_mention.count.mockResolvedValue(3);

      await expect(
        service.unreadCount(ME, {}),
      ).resolves.toEqual({ count: 3 });

      expect(prisma.t_task_mention.count).toHaveBeenCalledWith({
        where: {
          user_id: ME,
          read_at: null,
        },
      });
    });

    it('mendukung filter project tanpa memfilter membership atau pengirim', async () => {
      await service.unreadCount(ME, {
        project_id: PROJECT,
      });

      expect(prisma.t_task_mention.count).toHaveBeenCalledWith({
        where: {
          user_id: ME,
          read_at: null,
          task: {
            epic: {
              project_id: PROJECT,
            },
          },
        },
      });
    });
  });

  describe('markRead', () => {
    it('mengembalikan waktu baca dari database dan membatasi kepemilikan', async () => {
      const readAt = new Date('2026-10-27T06:00:00.000Z');

      prisma.$queryRaw.mockResolvedValue([
        {
          id: MENTION,
          read_at: readAt,
        },
      ]);

      await expect(
        service.markRead(ME, MENTION),
      ).resolves.toEqual({
        id: MENTION,
        read_at: readAt,
      });

      expect(sqlText()).toContain(
        'WHERE id = ?::uuid AND user_id = ?::uuid',
      );
      expect(lastSql().values).toEqual([MENTION, ME]);
    });

    it('query mempertahankan read_at pertama melalui COALESCE', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: MENTION,
          read_at: CREATED,
        },
      ]);

      await service.markRead(ME, MENTION);

      expect(sqlText()).toContain(
        "SET read_at = COALESCE( read_at, timezone('UTC', CURRENT_TIMESTAMP) )",
      );
      expect(sqlText()).not.toContain('t_project_member');
    });

    it('tidak ditemukan atau bukan pemilik menghasilkan 404 yang sama', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.markRead(ME, MENTION),
      ).rejects.toThrow(
        new NotFoundException('Mention not found'),
      );
    });
  });

  describe('readAll', () => {
    it('memperbarui hanya unread milik user login', async () => {
      prisma.t_task_mention.updateMany.mockResolvedValue({
        count: 4,
      });

      await expect(
        service.readAll(ME, {}),
      ).resolves.toEqual({ updated: 4 });

      expect(
        prisma.t_task_mention.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          user_id: ME,
          read_at: null,
        },
        data: {
          read_at: expect.any(Date),
        },
      });
    });

    it('mendukung pembatasan project', async () => {
      await service.readAll(ME, {
        project_id: PROJECT,
      });

      expect(
        prisma.t_task_mention.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          user_id: ME,
          read_at: null,
          task: {
            epic: {
              project_id: PROJECT,
            },
          },
        },
        data: {
          read_at: expect.any(Date),
        },
      });
    });

    it('mengembalikan updated=0 ketika tidak ada unread', async () => {
      await expect(
        service.readAll(ME, {}),
      ).resolves.toEqual({ updated: 0 });
    });
  });
});