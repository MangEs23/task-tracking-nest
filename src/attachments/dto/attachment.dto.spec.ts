import { ValidationPipe } from '@nestjs/common';
import { CreateAttachmentDto } from './create-attachment.dto';
import { UpdateAttachmentDto } from './update-attachment.dto';

describe('Attachment DTO', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    transform: true,
  });

  const create = (body: object): Promise<CreateAttachmentDto> =>
    pipe.transform(body, {
      type: 'body',
      metatype: CreateAttachmentDto,
    });

  const update = (body: object): Promise<UpdateAttachmentDto> =>
    pipe.transform(body, {
      type: 'body',
      metatype: UpdateAttachmentDto,
    });

  it.each([
    'http://example.com',
    'https://example.com/docs?id=123#section',
    'HTTPS://example.com/docs',
  ])('menerima URL valid: %s', async (url) => {
    await expect(create({ url })).resolves.toMatchObject({ url });
  });

  it('trim URL dan judul tanpa mengubah bentuk URL lainnya', async () => {
    const result = await create({
      url: '  https://example.com/docs  ',
      title: '  Referensi project  ',
    });

    expect(result.url).toBe('https://example.com/docs');
    expect(result.title).toBe('Referensi project');
  });

  it.each([
    {},
    { url: null },
    { url: 123 },
    { url: '' },
    { url: '   ' },
    { url: 'bukan-url' },
    { url: 'example.com' },
    { url: 'javascript:alert(1)' },
    { url: 'JaVaScRiPt:alert(1)' },
    { url: 'data:text/html,test' },
    { url: 'ftp://example.com/file' },
    { url: 'file:///C:/secret.txt' },
    { url: 'https://example.com/a b' },
    { url: 'https://example.com/\npath' },
    { url: 'https://example.com\\path' },
  ])('menolak URL tidak valid: %j', async (body) => {
    await expect(create(body)).rejects.toMatchObject({
      status: 400,
    });
  });

  it.each([
    'https://user:pass@example.com',
    'https://user@example.com',
    'https://:pass@example.com',
    'https://@example.com',
  ])('menolak URL dengan kredensial: %s', async (url) => {
    await expect(create({ url })).rejects.toMatchObject({
      status: 400,
      response: {
        message: expect.arrayContaining([
          'URL must not contain credentials',
        ]),
      },
    });
  });

  it('menerima URL sepanjang 2048 karakter', async () => {
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(2048 - prefix.length);

    await expect(create({ url })).resolves.toMatchObject({ url });
  });

  it('menolak URL sepanjang 2049 karakter', async () => {
    const prefix = 'https://example.com/';
    const url = prefix + 'a'.repeat(2049 - prefix.length);

    await expect(create({ url })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('menerima judul yang tidak dikirim', async () => {
    const result = await create({
      url: 'https://example.com',
    });

    expect(result.title).toBeUndefined();
  });

  it.each(['', '   '])(
    'menerima judul kosong untuk fallback di service',
    async (title) => {
      await expect(
        create({ url: 'https://example.com', title }),
      ).resolves.toMatchObject({
        title: '',
      });
    },
  );

  it('menerima judul sepanjang 150 karakter', async () => {
    const title = 'a'.repeat(150);

    await expect(
      create({ url: 'https://example.com', title }),
    ).resolves.toMatchObject({ title });
  });

  it.each([null, 123, false, 'a'.repeat(151)])(
    'menolak judul tidak valid: %j',
    async (title) => {
      await expect(
        create({ url: 'https://example.com', title }),
      ).rejects.toMatchObject({
        status: 400,
      });
    },
  );

  it('membuang field yang harus ditentukan backend', async () => {
    const result = await create({
      url: 'https://example.com',
      type: 'file',
      created_by: 'user-lain',
      project_id: 'project-lain',
    });

    expect(result).not.toHaveProperty('type');
    expect(result).not.toHaveProperty('created_by');
    expect(result).not.toHaveProperty('project_id');
  });

  it('PATCH menerima perubahan judul saja', async () => {
    await expect(
      update({ title: ' Judul baru ' }),
    ).resolves.toMatchObject({
      title: 'Judul baru',
    });
  });

  it('PATCH menerima perubahan URL saja', async () => {
    await expect(
      update({ url: ' https://example.com/baru ' }),
    ).resolves.toMatchObject({
      url: 'https://example.com/baru',
    });
  });

  it.each([
    { url: null },
    { url: '' },
    { url: 'javascript:alert(1)' },
    { url: 'https://user:pass@example.com' },
    { title: null },
    { title: 'a'.repeat(151) },
  ])('PATCH menolak input tidak valid: %j', async (body) => {
    await expect(update(body)).rejects.toMatchObject({
      status: 400,
    });
  });
});