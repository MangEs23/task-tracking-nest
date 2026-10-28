import type { Prisma } from '@prisma/client';
import { parseMentionEmails } from './parse-mention-emails';

type SyncTaskMentionsInput = {
  taskId: string;
  projectId: string;
  actorId: string;
  description: string | null;
};

/**
 * Wajib dipanggil menggunakan transaction client yang sama
 * dengan operasi create/update task.
 *
 * Pemeriksaan izin actor dilakukan oleh TasksService.
 */
export async function syncTaskMentions(
  tx: Prisma.TransactionClient,
  input: SyncTaskMentionsInput,
): Promise<void> {
  const {
    taskId,
    projectId,
    actorId,
    description,
  } = input;

  const emails = parseMentionEmails(description);
  const emailSet = new Set(emails);

  const existing = await tx.t_task_mention.findMany({
    where: { task_id: taskId },
    select: {
      id: true,
      user_id: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  // Mention lama dipertahankan selama emailnya masih ada
  // dalam deskripsi, termasuk milik mantan member.
  const retained = existing.filter((mention) =>
    emailSet.has(mention.user.email.trim().toLowerCase()),
  );

  const retainedIds = new Set(
    retained.map((mention) => mention.id),
  );

  const retainedEmails = new Set(
    retained.map((mention) =>
      mention.user.email.trim().toLowerCase(),
    ),
  );

  const removedIds = existing
    .filter((mention) => !retainedIds.has(mention.id))
    .map((mention) => mention.id);

  // Hanya kandidat mention baru yang diperiksa membership-nya.
  const newEmails = emails.filter(
    (email) => !retainedEmails.has(email),
  );

  const members =
    newEmails.length > 0
      ? await tx.t_project_member.findMany({
          where: {
            project_id: projectId,
            user: {
              email: {
                in: newEmails,
              },
            },
          },
          select: {
            user_id: true,
          },
        })
      : [];

  if (removedIds.length > 0) {
    await tx.t_task_mention.deleteMany({
      where: {
        task_id: taskId,
        id: {
          in: removedIds,
        },
      },
    });
  }

  const newUserIds = [
    ...new Set(members.map((member) => member.user_id)),
  ];

  if (newUserIds.length > 0) {
    await tx.t_task_mention.createMany({
      data: newUserIds.map((userId) => ({
        task_id: taskId,
        user_id: userId,
        mentioned_by: actorId,
        read_at: null,
      })),
    });
  }
}