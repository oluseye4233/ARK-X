-- Task #80 — Nudge at-risk staff toward upskilling from the workforce drill-down.
-- Records when an institution admin nudges an assessed-but-at-risk staff member,
-- mirroring the existing invited_at column so the drill-down row can reflect the
-- new status after the action.
ALTER TABLE staff_records ADD COLUMN IF NOT EXISTS nudged_at timestamp;
