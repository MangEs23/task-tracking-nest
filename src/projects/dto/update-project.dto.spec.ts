import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto';

const check = (payload: object) =>
  validate(plainToInstance(UpdateProjectDto, payload));

describe('UpdateProjectDto', () => {
  it('name: null ditolak', async () => {
    const errors = await check({ name: null });
    expect(errors.map((e) => e.property)).toContain('name');
  });

  it('description: null diterima', async () => {
    expect(await check({ description: null })).toHaveLength(0);
  });
});
