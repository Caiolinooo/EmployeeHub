-- Soft-delete for KPI boards (hygiene: owner can remove stuck/experimental boards)
ALTER TABLE ia_kpi_boards
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_ia_kpi_boards_user_alive
  ON ia_kpi_boards (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN ia_kpi_boards.deleted_at IS 'Soft-delete timestamp; list/get/open ignore rows with deleted_at set';
