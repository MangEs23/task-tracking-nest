import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FilterTaskDto } from './filter-task.dto';

describe('FilterTaskDto mentioned', () => {
  const userId = 'bd8b723a-7f5c-4598-9583-78941429a3ca';

  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  });

  function validate(input: Record<string, unknown>) {
    return pipe.transform(input, {
      type: 'query',
      metatype: FilterTaskDto,
    }) as Promise<FilterTaskDto>;
  }

  it('mengizinkan query tanpa mentioned', async () => {
    const result = await validate({});

    expect(result.mentioned).toBeUndefined();
  });

  it('menerima mentioned=me', async () => {
    const result = await validate({ mentioned: 'me' });

    expect(result.mentioned).toBe('me');
  });

  it('menormalisasi spasi dan huruf besar', async () => {
    const result = await validate({ mentioned: ' ME ' });

    expect(result.mentioned).toBe('me');
  });

  it('menerima UUID user', async () => {
    const result = await validate({ mentioned: userId });

    expect(result.mentioned).toBe(userId);
  });

  it.each([
    null,
    '',
    '   ',
    'someone',
    '123',
    123,
    ['me', userId],
  ])('menolak mentioned tidak valid: %j', async (mentioned) => {
    await expect(validate({ mentioned })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});