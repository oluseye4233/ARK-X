-- Suggested Training Providers (freemium · Explorer tier). Idempotent.
CREATE TABLE IF NOT EXISTS training_providers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug varchar NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  website text,
  logo_url text,
  regions text[],
  delivery_modes text[],
  accreditations text[],
  owner_user_id varchar,
  status text NOT NULL DEFAULT 'pending',
  sponsored boolean NOT NULL DEFAULT false,
  sponsored_weight integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS training_providers_slug_uniq ON training_providers (slug);

CREATE TABLE IF NOT EXISTS training_courses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id varchar NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'technical',
  skills text[],
  level text,
  duration_label text,
  price_label text,
  certification text,
  url text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_courses_provider_idx ON training_courses (provider_id);

CREATE TABLE IF NOT EXISTS training_clicks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id varchar NOT NULL,
  course_id varchar,
  user_id varchar,
  kind text NOT NULL DEFAULT 'click',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_clicks_provider_idx ON training_clicks (provider_id);
