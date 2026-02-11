-- =============================================
-- TABLA: monthly_tracking
-- Seguimiento mensual de activaciones por cliente
-- =============================================
SET search_path TO reporting, public;

CREATE TABLE IF NOT EXISTS reporting.monthly_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file_id UUID REFERENCES reporting.processed_files(id) ON DELETE SET NULL,
    country VARCHAR(100),
    customer VARCHAR(200),
    solution VARCHAR(100),
    record_date DATE,
    registered DOUBLE PRECISION DEFAULT 0,
    activated DOUBLE PRECISION DEFAULT 0,
    total_billable DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint para evitar duplicados por mes/cliente/solución/país
    CONSTRAINT unique_monthly_track UNIQUE (country, customer, solution, record_date)
);

COMMENT ON TABLE reporting.monthly_tracking IS 'Historial mensual de registros y activaciones para seguimiento de clientes';

-- Índices para mejorar rendimiento de consultas de seguimiento
CREATE INDEX IF NOT EXISTS idx_monthly_track_customer ON reporting.monthly_tracking(customer);
CREATE INDEX IF NOT EXISTS idx_monthly_track_date ON reporting.monthly_tracking(record_date);
CREATE INDEX IF NOT EXISTS idx_monthly_track_country ON reporting.monthly_tracking(country);

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_monthly_track_updated_at ON reporting.monthly_tracking;
CREATE TRIGGER update_monthly_track_updated_at
    BEFORE UPDATE ON reporting.monthly_tracking
    FOR EACH ROW
    EXECUTE FUNCTION reporting.update_updated_at_column();
