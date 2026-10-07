-- Backfill: status "Done" milik project lama harus ditandai is_done = true.
-- Kolom is_done ditambahkan dengan DEFAULT false, jadi semua project yang
-- dibuat sebelum migration 20260929043352 punya status Done dengan is_done = false.
UPDATE "r_status"
SET "is_done" = true
WHERE lower(trim("name")) = 'done';