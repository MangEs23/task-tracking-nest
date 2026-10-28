import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import {
  MentionInboxQueryDto,
  MentionProjectFilterDto,
  ReadAllMentionsDto,
} from './mention-query.dto';

describe('Mention DTO', () => {
  const projectId = '3162eef7-f109-4fac-b73b-475bf984bb52';

  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  });

  function inbox(input: Record<string, unknown>) {
    return pipe.transform(input, {
      type: 'query',
      metatype: MentionInboxQueryDto,
    }) as Promise<MentionInboxQueryDto>;
  }

  function projectFilter(input: Record<string, unknown>) {
    return pipe.transform(input, {
      type: 'query',
      metatype: MentionProjectFilterDto,
    }) as Promise<MentionProjectFilterDto>;
  }

  function readAll(input: Record<string, unknown>) {
    return pipe.transform(input, {
      type: 'body',
      metatype: ReadAllMentionsDto,
    }) as Promise<ReadAllMentionsDto>;
  }

  it('inbox memakai default unread=false dan limit=20', async () => {
    const result = await inbox({});

    expect(result.unread).toBe(false);
    expect(result.limit).toBe(20);
    expect(result.project_id).toBeUndefined();
    expect(result.cursor).toBeUndefined();
  });

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('mengonversi unread %j menjadi %j', async (input, expected) => {
    const result = await inbox({ unread: input });

    expect(result.unread).toBe(expected);
  });

  it.each([
    null,
    '',
    'yes',
    '1',
    'FALSE',
    1,
    ['true'],
  ])('menolak unread tidak valid: %j', async (unread) => {
    await expect(inbox({ unread })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    ['1', 1],
    ['20', 20],
    ['50', 50],
    [10, 10],
  ])('menerima limit %j sebagai %j', async (input, expected) => {
    const result = await inbox({ limit: input });

    expect(result.limit).toBe(expected);
  });

  it.each([
    null,
    '',
    ' ',
    '0',
    '51',
    '-1',
    '1.5',
    'abc',
    true,
    ['20'],
  ])('menolak limit tidak valid: %j', async (limit) => {
    await expect(inbox({ limit })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('menerima project_id pada query inbox', async () => {
    const result = await inbox({ project_id: projectId });

    expect(result.project_id).toBe(projectId);
  });

  it('menerima project_id pada query unread-count', async () => {
    const result = await projectFilter({ project_id: projectId });

    expect(result.project_id).toBe(projectId);
  });

  it.each([null, '', 'bukan-uuid', 123])(
    'menolak project_id tidak valid: %j',
    async (project_id) => {
      await expect(inbox({ project_id })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      await expect(
        projectFilter({ project_id }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(readAll({ project_id })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('meneruskan cursor untuk diperiksa service', async () => {
    const result = await inbox({ cursor: 'opaque-cursor' });

    expect(result.cursor).toBe('opaque-cursor');
  });

  it.each([null, '', 123, ['cursor'], 'a'.repeat(513)])(
    'menolak cursor tidak valid: %j',
    async (cursor) => {
      await expect(inbox({ cursor })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('read-all menerima body kosong untuk seluruh project', async () => {
    const result = await readAll({});

    expect(result.project_id).toBeUndefined();
  });

  it('read-all menerima pembatasan project', async () => {
    const result = await readAll({ project_id: projectId });

    expect(result.project_id).toBe(projectId);
  });

  it('membuang user_id yang dikirim client', async () => {
    const result = await readAll({
      project_id: projectId,
      user_id: 'user-lain',
    });

    expect(result.project_id).toBe(projectId);
    expect(result).not.toHaveProperty('user_id');
  });
});