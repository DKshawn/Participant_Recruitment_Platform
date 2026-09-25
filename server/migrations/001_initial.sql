CREATE TABLE users (
  id uuid PRIMARY KEY,
  issuer text NOT NULL,
  subject text NOT NULL,
  email text,
  name jsonb NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student','researcher')),
  reputation integer NOT NULL DEFAULT 100 CHECK (reputation BETWEEN 0 AND 100),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_reward integer NOT NULL DEFAULT 0 CHECK (total_reward >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, subject)
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE oauth_transactions (
  state_hash text PRIMARY KEY,
  provider text NOT NULL,
  audience text NOT NULL,
  verifier text NOT NULL,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE experiments (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  code text NOT NULL UNIQUE,
  title jsonb NOT NULL,
  description jsonb NOT NULL,
  required_items jsonb NOT NULL DEFAULT '{}',
  tags jsonb NOT NULL DEFAULT '[]',
  tags_locales jsonb NOT NULL DEFAULT '{}',
  location_type text NOT NULL CHECK (location_type IN ('online','offline')),
  location_detail text NOT NULL,
  reward_points integer NOT NULL CHECK (reward_points BETWEEN 0 AND 1000000),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 10080),
  min_reputation_required integer NOT NULL CHECK (min_reputation_required BETWEEN 0 AND 100),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE enrollments (
  id uuid PRIMARY KEY,
  experiment_id uuid NOT NULL REFERENCES experiments(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','completed')),
  reward_points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (experiment_id, user_id)
);
CREATE INDEX enrollments_user ON enrollments(user_id);
CREATE INDEX experiments_owner ON experiments(owner_id);
CREATE TABLE reputation_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  operator_id uuid NOT NULL REFERENCES users(id),
  request_key uuid NOT NULL,
  requested_delta integer NOT NULL,
  delta integer NOT NULL,
  before_score integer NOT NULL,
  after_score integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, request_key)
);
CREATE TABLE redemptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  request_key uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 1000 AND amount % 100 = 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);
CREATE TABLE wallet_ledger (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  amount integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('experiment_reward','redemption_reserve','opening_balance')),
  reference_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, reference_id)
);
CREATE INDEX wallet_ledger_user ON wallet_ledger(user_id);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  target_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
