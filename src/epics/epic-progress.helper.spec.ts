import { getEpicsWithProgress } from './epic-progress.helper';

describe('getEpicsWithProgress', () => {
  const prisma = {
    t_epic: { findMany: jest.fn() },
    r_status: { findMany: jest.fn() },
    t_task: { groupBy: jest.fn(), findMany: jest.fn() },
  };
  const epic = (id: string) => ({
    id,
    title: id,
    description: null,
    start_date: null,
    end_date: null,
  });

  beforeEach(() => jest.resetAllMocks());

  it('project tanpa epic mengembalikan array kosong tanpa agregasi', async () => {
    prisma.t_epic.findMany.mockResolvedValue([]);

    await expect(getEpicsWithProgress(prisma as any, 'p1')).resolves.toEqual(
      [],
    );
    expect(prisma.r_status.findMany).not.toHaveBeenCalled();
    expect(prisma.t_task.groupBy).not.toHaveBeenCalled();
  });

  it('menghitung status per epic dan mempertahankan urutan status serta nilai nol', async () => {
    prisma.t_epic.findMany.mockResolvedValue([
      epic('e1'),
      epic('e2'),
      epic('empty'),
    ]);
    prisma.r_status.findMany.mockResolvedValue([
      { id: 'todo', name: 'To Do', is_done: false },
      { id: 'doing', name: 'In Progress', is_done: false },
      { id: 'done', name: 'Done', is_done: true },
    ]);
    prisma.t_task.groupBy.mockResolvedValue([
      { epic_id: 'e2', status_id: 'todo', _count: { _all: 8 } },
      { epic_id: 'e1', status_id: 'done', _count: { _all: 11 } },
      { epic_id: 'e2', status_id: 'done', _count: { _all: 4 } },
    ]);

    const result = await getEpicsWithProgress(prisma as any, 'p1');

    expect(result).toEqual([
      {
        ...epic('e1'),
        task_total: 11,
        task_done: 11,
        progress: 100,
        status: [
          { name: 'To Do', total: 0 },
          { name: 'In Progress', total: 0 },
          { name: 'Done', total: 11 },
        ],
      },
      {
        ...epic('e2'),
        task_total: 12,
        task_done: 4,
        progress: 33,
        status: [
          { name: 'To Do', total: 8 },
          { name: 'In Progress', total: 0 },
          { name: 'Done', total: 4 },
        ],
      },
      {
        ...epic('empty'),
        task_total: 0,
        task_done: 0,
        progress: 0,
        status: [
          { name: 'To Do', total: 0 },
          { name: 'In Progress', total: 0 },
          { name: 'Done', total: 0 },
        ],
      },
    ]);
    expect(prisma.t_epic.findMany.mock.calls[0][0].where).toEqual({
      project_id: 'p1',
    });
    expect(prisma.r_status.findMany).toHaveBeenCalledWith({
      where: { project_id: 'p1' },
      select: { id: true, name: true, is_done: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.t_task.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.t_task.groupBy).toHaveBeenCalledWith({
      by: ['epic_id', 'status_id'],
      where: { epic_id: { in: ['e1', 'e2', 'empty'] } },
      _count: { _all: true },
    });
    expect(prisma.t_task.findMany).not.toHaveBeenCalled();
  });

  it('beberapa status done dan nama status yang sama tetap dihitung berdasarkan ID', async () => {
    prisma.t_epic.findMany.mockResolvedValue([epic('e1')]);
    prisma.r_status.findMany.mockResolvedValue([
      { id: 's1', name: 'Done', is_done: true },
      { id: 's2', name: 'Done', is_done: true },
    ]);
    prisma.t_task.groupBy.mockResolvedValue([
      { epic_id: 'e1', status_id: 's1', _count: { _all: 2 } },
      { epic_id: 'e1', status_id: 's2', _count: { _all: 3 } },
    ]);

    const result = await getEpicsWithProgress(prisma as any, 'p1');

    expect(result[0]).toMatchObject({
      task_total: 5,
      task_done: 5,
      progress: 100,
      status: [
        { name: 'Done', total: 2 },
        { name: 'Done', total: 3 },
      ],
    });
  });
});
