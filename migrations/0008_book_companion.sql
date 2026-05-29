-- Task #22 — Context Craft Book Companion
-- Idempotent: re-runs cleanly on environments that already have the tables.

-- 1. Named chapter badges — auto-awarded off flywheel events. One row per
--    (user, node); the unique index makes awards idempotent.
CREATE TABLE IF NOT EXISTS book_journey_badges (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     varchar NOT NULL,
  node_id     text NOT NULL,
  badge       text NOT NULL,
  pillar      text,
  cc_level    text,
  earned_via  text NOT NULL,
  ref_id      varchar,
  earned_at   timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS book_journey_user_node_uniq
  ON book_journey_badges (user_id, node_id);

-- 2. Digital Ledger snapshots — baseline (immutable, captured at Prologue
--    assessment) and final (captured at Epilogue). One row per (user, kind).
CREATE TABLE IF NOT EXISTS book_ledger_snapshots (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       varchar NOT NULL,
  kind          text NOT NULL,
  jst_index     integer NOT NULL,
  ccmi          integer NOT NULL,
  ark_score     integer NOT NULL,
  badges_earned integer NOT NULL DEFAULT 0,
  spc_published integer NOT NULL DEFAULT 0,
  captured_at   timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS book_ledger_user_kind_uniq
  ON book_ledger_snapshots (user_id, kind);
