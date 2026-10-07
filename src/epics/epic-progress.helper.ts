import { PrismaService } from '../prisma/prisma.service';

export function calcProgress(done: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

/**
 * Daftar epic dalam satu project beserta progress-nya.
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

  const [totals, dones] = await Promise.all([
    prisma.t_task.groupBy({
      by: ['epic_id'],
      where: { epic_id: { in: epicIds } },
      _count: { _all: true },
    }),
    prisma.t_task.groupBy({
      by: ['epic_id'],
      where: { epic_id: { in: epicIds }, status: { is_done: true } },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(totals.map((t) => [t.epic_id, t._count._all]));
  const doneMap = new Map(dones.map((d) => [d.epic_id, d._count._all]));

  return epics.map((epic) => {
    const task_total = totalMap.get(epic.id) ?? 0;
    const task_done = doneMap.get(epic.id) ?? 0;
    return {
      ...epic,
      task_total,
      task_done,
      progress: calcProgress(task_done, task_total),
    };
  });
}
