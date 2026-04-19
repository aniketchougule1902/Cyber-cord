-- ============================================================
-- CyberCord PostgreSQL Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns true if the currently authenticated user has role = 'admin'
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()::uuid
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Sets updated_at to now() on UPDATE
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- ----------------------------------------------------------
-- users
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        UNIQUE NOT NULL,
  role            text        NOT NULL DEFAULT 'user'
                                CHECK (role IN ('admin', 'user')),
  display_name    text,
  avatar_url      text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- investigations
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS investigations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title           text        NOT NULL,
  description     text,
  status          text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'archived', 'completed')),
  tags            text[]      NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- investigation_findings
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS investigation_findings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id  uuid        NOT NULL REFERENCES investigations (id) ON DELETE CASCADE,
  tool_name         text        NOT NULL,
  input_data        jsonb,
  result_data       jsonb,
  risk_level        text        NOT NULL DEFAULT 'low'
                                  CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- tool_usage_logs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tool_usage_logs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES users (id) ON DELETE SET NULL,
  tool_name           text        NOT NULL,
  input_hash          text,
  status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('success', 'error', 'pending')),
  execution_time_ms   integer,
  created_at          timestamptz NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- api_keys
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key_hash      text        UNIQUE NOT NULL,
  name          text        NOT NULL,
  permissions   text[]      NOT NULL DEFAULT '{}',
  rate_limit    integer     NOT NULL DEFAULT 100,
  is_active     boolean     NOT NULL DEFAULT true,
  last_used_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES users (id) ON DELETE SET NULL,
  action        text        NOT NULL,
  resource      text,
  resource_id   text,
  ip_address    inet,
  user_agent    text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- investigations
CREATE INDEX IF NOT EXISTS idx_investigations_user_id      ON investigations (user_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status       ON investigations (status);
CREATE INDEX IF NOT EXISTS idx_investigations_created_at   ON investigations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_tags         ON investigations USING GIN (tags);

-- investigation_findings
CREATE INDEX IF NOT EXISTS idx_findings_investigation_id   ON investigation_findings (investigation_id);
CREATE INDEX IF NOT EXISTS idx_findings_tool_name          ON investigation_findings (tool_name);
CREATE INDEX IF NOT EXISTS idx_findings_risk_level         ON investigation_findings (risk_level);
CREATE INDEX IF NOT EXISTS idx_findings_created_at         ON investigation_findings (created_at DESC);

-- tool_usage_logs
CREATE INDEX IF NOT EXISTS idx_tool_logs_user_id           ON tool_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_tool_logs_tool_name         ON tool_usage_logs (tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_logs_status            ON tool_usage_logs (status);
CREATE INDEX IF NOT EXISTS idx_tool_logs_created_at        ON tool_usage_logs (created_at DESC);

-- api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id            ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active          ON api_keys (is_active);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id          ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action           ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource         ON audit_logs (resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at       ON audit_logs (created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_investigations_updated_at
  BEFORE UPDATE ON investigations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_usage_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- users policies
-- ----------------------------------------------------------
CREATE POLICY users_select_own
  ON users FOR SELECT
  USING (id = auth.uid()::uuid OR is_admin());

CREATE POLICY users_update_own
  ON users FOR UPDATE
  USING (id = auth.uid()::uuid OR is_admin());

CREATE POLICY users_insert_admin
  ON users FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY users_delete_admin
  ON users FOR DELETE
  USING (is_admin());

-- ----------------------------------------------------------
-- investigations policies
-- ----------------------------------------------------------
CREATE POLICY investigations_select
  ON investigations FOR SELECT
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY investigations_insert
  ON investigations FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY investigations_update
  ON investigations FOR UPDATE
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY investigations_delete
  ON investigations FOR DELETE
  USING (user_id = auth.uid()::uuid OR is_admin());

-- ----------------------------------------------------------
-- investigation_findings policies
-- ----------------------------------------------------------
CREATE POLICY findings_select
  ON investigation_findings FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM investigations i
      WHERE i.id = investigation_id
        AND i.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY findings_insert
  ON investigation_findings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM investigations i
      WHERE i.id = investigation_id
        AND i.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY findings_update
  ON investigation_findings FOR UPDATE
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM investigations i
      WHERE i.id = investigation_id
        AND i.user_id = auth.uid()::uuid
    )
  );

CREATE POLICY findings_delete
  ON investigation_findings FOR DELETE
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM investigations i
      WHERE i.id = investigation_id
        AND i.user_id = auth.uid()::uuid
    )
  );

-- ----------------------------------------------------------
-- tool_usage_logs policies
-- ----------------------------------------------------------
CREATE POLICY tool_logs_select
  ON tool_usage_logs FOR SELECT
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY tool_logs_insert
  ON tool_usage_logs FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY tool_logs_admin_all
  ON tool_usage_logs FOR ALL
  USING (is_admin());

-- ----------------------------------------------------------
-- api_keys policies
-- ----------------------------------------------------------
CREATE POLICY api_keys_select
  ON api_keys FOR SELECT
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY api_keys_insert
  ON api_keys FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY api_keys_update
  ON api_keys FOR UPDATE
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY api_keys_delete
  ON api_keys FOR DELETE
  USING (user_id = auth.uid()::uuid OR is_admin());

-- ----------------------------------------------------------
-- audit_logs policies
-- ----------------------------------------------------------
CREATE POLICY audit_logs_select
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid()::uuid OR is_admin());

CREATE POLICY audit_logs_insert
  ON audit_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY audit_logs_admin_all
  ON audit_logs FOR ALL
  USING (is_admin());
