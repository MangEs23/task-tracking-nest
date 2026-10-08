import { ValidationPipe } from '@nestjs/common';
import { UpdateStatusDto } from './update-status.dto';

describe('UpdateStatusDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = (body: object) =>
    pipe.transform(body, { type: 'body', metatype: UpdateStatusDto });

  it('order dibuang (urutan hanya lewat endpoint reorder)', async () => {
    const out = await run({ name: 'Baru', order: 99 });
    expect(out).not.toHaveProperty('order');
    expect(out).toHaveProperty('name', 'Baru');
  });

  it('is_done & is_default boolean diterima', async () => {
    await expect(run({ is_done: true, is_default: false })).resolves.toBeDefined();
  });

  it('is_done bukan boolean ditolak', async () => {
    await expect(run({ is_done: 'ya' })).rejects.toThrow();
  });
});