import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTaskDto } from './update-task.dto';

const check = (payload: object) =>
  validate(plainToInstance(UpdateTaskDto, payload));

describe('UpdateTaskDto', () => {
  it.each(['title', 'priority', 'status_id'])(
    '%s: null ditolak',
    async (field) => {
      const errors = await check({ [field]: null });
      expect(errors.map((e) => e.property)).toContain(field);
    },
  );

  it('description & due_date: null diterima (menghapus nilai)', async () => {
    expect(await check({ description: null })).toHaveLength(0);
    expect(await check({ due_date: null })).toHaveLength(0);
  });

  it('body kosong lolos DTO (ditolak di service)', async () => {
    expect(await check({})).toHaveLength(0);
  });
});
