import { calcProgress, getEpicsWithProgress } from './epic-progress.helper';

describe('calcProgress', () => {
  it('0 task → 0', () => {
    expect(calcProgress(0, 0)).toBe(0);
  });

  it.each([
    [1, 3, 33],
    [2, 3, 67],
    [3, 3, 100],
    [0, 5, 0],
  ])('%i dari %i → %i', (done, total, expected) => {
    expect(calcProgress(done, total)).toBe(expected);
  });
});

describe('getEpicsWithProgress', () => {
  const prisma = {
    t_epic: { findMany: jest.fn() },
    t_task: { groupBy: jest.fn() },
  } as any;

  beforeEach(() => jest.resetAllMocks());

  it('project tanpa epic → [] tanpa query task', async () => {
    prisma.t_epic.findMany.mockResolvedValue([]);
    await expect(getEpicsWithProgress(prisma, 'p1')).resolves.toEqual([]);
    expect(prisma.t_task.groupBy).not.toHaveBeenCalled();
  });

  it('menghitung total, done, dan progress per epic', async () => {
    prisma.t_epic.findMany.mockResolvedValue([
      { id: 'e1', title: 'A' },
      { id: 'e2', title: 'B' },
      { id: 'e3', title: 'C' },
    ]);
    // Panggilan 1 = total, panggilan 2 = done (urutan sesuai Promise.all di helper)
    prisma.t_task.groupBy
      .mockResolvedValueOnce([
        { epic_id: 'e1', _count: { _all: 4 } },
        { epic_id: 'e2', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([{ epic_id: 'e1', _count: { _all: 1 } }]);

    const res = await getEpicsWithProgress(prisma, 'p1');

    expect(res).toEqual([
      { id: 'e1', title: 'A', task_total: 4, task_done: 1, progress: 25 },
      { id: 'e2', title: 'B', task_total: 3, task_done: 0, progress: 0 },
      { id: 'e3', title: 'C', task_total: 0, task_done: 0, progress: 0 },
    ]);
  });

  it('query epic difilter per project dan diurutkan start_date', async () => {
    prisma.t_epic.findMany.mockResolvedValue([]);
    await getEpicsWithProgress(prisma, 'p1');
    const arg = prisma.t_epic.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ project_id: 'p1' });
    expect(arg.orderBy).toEqual({ start_date: 'asc' });
  });
});
