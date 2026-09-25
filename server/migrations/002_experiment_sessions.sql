CREATE TABLE experiment_sessions (
  id uuid PRIMARY KEY,
  experiment_id uuid NOT NULL REFERENCES experiments(id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100000),
  CHECK (ends_at > starts_at),
  UNIQUE (experiment_id, starts_at),
  UNIQUE (id, experiment_id)
);
ALTER TABLE enrollments ADD COLUMN session_id uuid;
ALTER TABLE enrollments ADD CONSTRAINT enrollment_session_experiment
  FOREIGN KEY (session_id, experiment_id) REFERENCES experiment_sessions(id, experiment_id);
CREATE INDEX enrollments_session ON enrollments(session_id);
