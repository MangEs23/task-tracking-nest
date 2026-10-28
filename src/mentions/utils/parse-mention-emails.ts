/**
 * Mengekstrak email dari token @email dalam deskripsi task.
 *
 * Contoh:
 * "Tolong cek @angga@example.com."
 * menghasilkan ["angga@example.com"].
 *
 * Parser hanya mengekstrak kandidat email.
 * Validasi membership dilakukan oleh service.
 */
export function parseMentionEmails(
  description: string | null | undefined,
): string[] {
  if (!description) {
    return [];
  }

  const pattern =
    /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

  const emails = new Set<string>();

  for (const match of description.matchAll(pattern)) {
    const email = match[1].trim().toLowerCase();
    emails.add(email);
  }

  return [...emails];
}