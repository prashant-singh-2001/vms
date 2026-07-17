-- Hand-written, idempotent schema bootstrap (applied on api startup).
-- Mirrors src/db/schema.ts exactly. gen_random_uuid() is built into Postgres 13+.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rtsp_url TEXT NOT NULL,
  location TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'stopped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'person_detected',
  confidence REAL NOT NULL,
  detections JSONB NOT NULL,
  frame_width INTEGER NOT NULL,
  frame_height INTEGER NOT NULL,
  annotated_image_id TEXT,
  ts TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent add so databases created before annotated_image_id existed get the column.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS annotated_image_id TEXT;

CREATE INDEX IF NOT EXISTS alerts_camera_ts_idx ON alerts (camera_id, ts DESC);
