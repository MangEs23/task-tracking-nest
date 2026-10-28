import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MentionInboxQueryDto,
  MentionProjectFilterDto,
  ReadAllMentionsDto,
} from './dto/mention-query.dto';

type MentionName = {
  user_id: string;
  name: string;
  email: string;
};

type InboxRow = {
  id: string;
  read_at: Date | null;
  created_at: Date;
  author_id: string;
  author_name: string;
  task_id: string;
  task_title: string;
  epic_id: string;
  project_id: string;
  project_name: string;
  description: string | null;
  has_access: boolean;
  mention_names: MentionName[];
};

type MentionCursor = {
  created_at: string;
  id: string;
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MentionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: MentionInboxQueryDto) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor
      ? this.decodeCursor(query.cursor)
      : undefined;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`m.user_id = ${userId}::uuid`,
    ];

    if (query.unread === true) {
      conditions.push(Prisma.sql`m.read_at IS NULL`);
    }

    if (query.project_id) {
      conditions.push(
        Prisma.sql`p.id = ${query.project_id}::uuid`,
      );
    }

    if (cursor) {
      conditions.push(Prisma.sql`
        (m.created_at, m.id) <
        (
          ${new Date(cursor.created_at)}::timestamp,
          ${cursor.id}::uuid
        )
      `);
    }

    const rows = await this.prisma.$queryRaw<InboxRow[]>(
      Prisma.sql`
        SELECT
          m.id,
          m.read_at,
          m.created_at,
          author.id AS author_id,
          author.name AS author_name,
          t.id AS task_id,
          t.title AS task_title,
          t.epic_id,
          p.id AS project_id,
          p.name AS project_name,
          t.description,
          (pm.id IS NOT NULL) AS has_access,
          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'user_id', recipient.id,
                  'name', recipient.name,
                  'email', recipient.email
                )
              )
              FROM t_task_mention AS tm
              JOIN m_user AS recipient
                ON recipient.id = tm.user_id
              WHERE tm.task_id = t.id
            ),
            '[]'::jsonb
          ) AS mention_names
        FROM t_task_mention AS m
        JOIN t_task AS t
          ON t.id = m.task_id
        JOIN t_epic AS e
          ON e.id = t.epic_id
        JOIN m_project AS p
          ON p.id = e.project_id
        JOIN m_user AS author
          ON author.id = m.mentioned_by
        LEFT JOIN t_project_member AS pm
          ON pm.project_id = p.id
          AND pm.user_id = m.user_id
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ${limit + 1}
      `,
    );

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => ({
        id: row.id,
        read_at: row.read_at,
        created_at: row.created_at,
        mentioned_by: {
          id: row.author_id,
          name: row.author_name,
        },
        task: {
          id: row.task_id,
          title: row.task_title,
          epic_id: row.epic_id,
        },
        project: {
          id: row.project_id,
          name: row.project_name,
        },
        has_access: row.has_access,
        snippet: this.buildSnippet(
          row.description,
          row.mention_names,
          userId,
        ),
      })),
      next_cursor:
        hasMore && last
          ? this.encodeCursor(last)
          : null,
    };
  }

  async unreadCount(
    userId: string,
    query: MentionProjectFilterDto,
  ) {
    const count = await this.prisma.t_task_mention.count({
      where: this.unreadWhere(userId, query.project_id),
    });

    return { count };
  }

  async markRead(userId: string, mentionId: string) {
    // COALESCE mempertahankan waktu baca pertama.
    // Kepemilikan diperiksa dalam UPDATE yang sama.
    const rows = await this.prisma.$queryRaw<
      { id: string; read_at: Date }[]
    >(Prisma.sql`
      UPDATE t_task_mention
      SET read_at = COALESCE(
        read_at,
        timezone('UTC', CURRENT_TIMESTAMP)
      )
      WHERE id = ${mentionId}::uuid
        AND user_id = ${userId}::uuid
      RETURNING id, read_at
    `);

    if (rows.length === 0) {
      throw new NotFoundException('Mention not found');
    }

    return rows[0];
  }

  async readAll(userId: string, dto: ReadAllMentionsDto) {
    const result = await this.prisma.t_task_mention.updateMany({
      where: this.unreadWhere(userId, dto.project_id),
      data: {
        read_at: new Date(),
      },
    });

    return { updated: result.count };
  }

  private unreadWhere(
    userId: string,
    projectId?: string,
  ): Prisma.t_task_mentionWhereInput {
    return {
      user_id: userId,
      read_at: null,
      ...(projectId
        ? {
            task: {
              epic: {
                project_id: projectId,
              },
            },
          }
        : {}),
    };
  }

  private encodeCursor(row: {
    id: string;
    created_at: Date;
  }): string {
    const payload: MentionCursor = {
      created_at: row.created_at.toISOString(),
      id: row.id,
    };

    return Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(value: string): MentionCursor {
    try {
      if (
        value.length > 512 ||
        !/^[A-Za-z0-9_-]+$/.test(value)
      ) {
        throw new Error('Invalid encoding');
      }

      const buffer = Buffer.from(value, 'base64url');

      if (buffer.toString('base64url') !== value) {
        throw new Error('Invalid encoding');
      }

      const parsed: unknown = JSON.parse(
        buffer.toString('utf8'),
      );

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error('Invalid payload');
      }

      const payload = parsed as Record<string, unknown>;

      if (
        typeof payload.id !== 'string' ||
        !UUID_V4.test(payload.id) ||
        typeof payload.created_at !== 'string'
      ) {
        throw new Error('Invalid cursor fields');
      }

      const date = new Date(payload.created_at);

      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString() !== payload.created_at
      ) {
        throw new Error('Invalid cursor date');
      }

      return {
        id: payload.id,
        created_at: payload.created_at,
      };
    } catch {
      throw new BadRequestException('Invalid mention cursor');
    }
  }

  private buildSnippet(
    description: string | null,
    mentions: MentionName[],
    recipientId: string,
  ): string {
    if (!description) return '';

    const source = description.replace(/\s+/g, ' ').trim();

    const byEmail = new Map(
      mentions.map((mention) => [
        mention.email.trim().toLowerCase(),
        mention,
      ]),
    );

    const pattern =
      /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

    let rendered = '';
    let previousEnd = 0;
    let focus = -1;

    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;

      rendered += source.slice(previousEnd, index);

      const mention = byEmail.get(
        match[1].trim().toLowerCase(),
      );

      if (
        mention?.user_id === recipientId &&
        focus === -1
      ) {
        focus = rendered.length;
      }

      rendered += mention
        ? `@${mention.name}`
        : match[0];

      previousEnd = index + match[0].length;
    }

    rendered += source.slice(previousEnd);

    // Array.from menghindari pemotongan di tengah pasangan
    // surrogate, misalnya pada banyak karakter emoji.
    const characters = Array.from(rendered);
    const size = 120;

    if (characters.length <= size) {
      return rendered;
    }

    const focusIndex =
      focus < 0
        ? 0
        : Array.from(rendered.slice(0, focus)).length;

    const start = Math.min(
      Math.max(0, focusIndex - 40),
      characters.length - size,
    );
    const end = start + size;

    return [
      start > 0 ? '…' : '',
      characters.slice(start, end).join(''),
      end < characters.length ? '…' : '',
    ].join('');
  }
}