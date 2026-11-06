-- Local migration artifact only; do not run against production without separate approval.
-- Verify existing index definition before applying; IF NOT EXISTS does not validate an existing namesake.
ALTER TABLE member_folder ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE member_folder ALTER COLUMN is_pinned SET DEFAULT false;
UPDATE member_folder SET is_pinned = false WHERE is_pinned IS NULL;
ALTER TABLE member_folder ALTER COLUMN is_pinned SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_member_folder_owner_pinned ON member_folder (owner_member_id, is_pinned);
-- Rollback: revert application only, retain column and saved true values; never DROP COLUMN as default recovery.
