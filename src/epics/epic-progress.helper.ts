import { PrismaService } from '../prisma/prisma.service';

export function calcProgress(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Daftar epic dalam satu project beserta progress dan total task per status.
 * Dipakai bersama oleh EpicsService & ProjectsService (dashboard).
 */
export async function getEpicsWithProgress(
  prisma: PrismaService,
  projectId: string,
) {
  const epics = await prisma.t_epic.findMany({
    where: { project_id: projectId },
    select: {
      id: true,
      title: true,
      description: true,
      start_date: true,
      end_date: true,
    },
    orderBy: { start_date: 'asc' },
  });

  if (epics.length === 0) return [];

  const epicIds = epics.map((e) => e.id);

  const [statuses, counts] = await Promise.all([
    prisma.r_status.findMany({
      where: { project_id: projectId },
      select: { id: true, name: true, is_done: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    }),
    prisma.t_task.groupBy({
      by: ['epic_id', 'status_id'],
      where: { epic_id: { in: epicIds } },
      _count: { _all: true },
    }),
  ]);

  const doneStatusIds = new Set(
    statuses.filter((status) => status.is_done).map((status) => status.id),
  );
  const summaryMap = new Map<
    string,
    { total: number; done: number; byStatus: Map<string, number> }
  >();
  for (const row of counts) {
    const summary = summaryMap.get(row.epic_id) ?? {
      total: 0,
      done: 0,
      byStatus: new Map<string, number>(),
    };
    summary.total += row._count._all;
    if (doneStatusIds.has(row.status_id)) summary.done += row._count._all;
    summary.byStatus.set(row.status_id, row._count._all);
    summaryMap.set(row.epic_id, summary);
  }

  return epics.map((epic) => {
    const summary = summaryMap.get(epic.id);
    const task_total = summary?.total ?? 0;
    const task_done = summary?.done ?? 0;
    return {
      ...epic,
      task_total,
      task_done,
      progress: calcProgress(task_done, task_total),
      statuses: statuses.map((status) => ({
        id: status.id,
        name: status.name,
        total: summary?.byStatus.get(status.id) ?? 0,
      })),
    };
  });
}
