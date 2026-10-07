import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEpicDto } from './update-epic.dto';

const check = (payload: object) =>
  validate(plainToInstance(UpdateEpicDto, payload));

describe('UpdateEpicDto', () => {
  it.each(['title', 'start_date', 'end_date'])(
    '%s: null ditolak',
    async (field) => {
      const errors = await check({ [field]: null });
      expect(errors.map((e) => e.property)).toContain(field);
    },
  );

  it('description: null diterima', async () => {
    expect(await check({ description: null })).toHaveLength(0);
  });

  it('field valid diterima', async () => {
    expect(
      await check({ title: 'Epic Baru', start_date: '2026-10-01' }),
    ).toHaveLength(0);
  });
});
