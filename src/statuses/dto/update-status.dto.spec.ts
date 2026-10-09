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

  it.each([
  { name: null },
  { name: '' },
  { name: '   ' },
  { is_default: null },
  { is_done: null },
])('menolak input tidak valid: %j', async (body) => {
  await expect(run(body)).rejects.toMatchObject({
    status: 400,
  });
});

it('menghapus spasi di awal dan akhir nama', async () => {
  const result = await run({ name: ' In Review ' });

  expect(result.name).toBe('In Review');
});

it('menerima false sebagai nilai boolean yang valid', async () => {
  const result = await run({
    is_default: false,
    is_done: false,
  });

  expect(result.is_default).toBe(false);
  expect(result.is_done).toBe(false);
});

it('mengizinkan field opsional tidak dikirim', async () => {
  await expect(run({ name: 'Review' })).resolves.toMatchObject({
    name: 'Review',
  });
});
});