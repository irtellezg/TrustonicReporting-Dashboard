-- ============================================
-- TrustonicReporting - Database Schema
-- ============================================
-- Schema for device validation tracking system
-- Run after init_database.sql
--
-- Usage:
--   psql -U postgres -h localhost -d trustonic_reporting -f schema_devices.sql
-- ============================================

SET search_path TO reporting, public;

-- =============================================
-- TABLA: processed_files (Control de archivos)
-- Debe crearse primero por las referencias FK
-- =============================================
CREATE TABLE IF NOT EXISTS reporting.processed_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64) UNIQUE NOT NULL,
    content_hash VARCHAR(64),
    file_size BIGINT,
    sheet_count INTEGER DEFAULT 0,
    devices_count INTEGER DEFAULT 0,
    inventory_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR')),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reporting.processed_files IS 'Control de archivos Excel procesados con hash para detección de cambios';
COMMENT ON COLUMN reporting.processed_files.file_hash IS 'SHA-256 del archivo para detectar cambios';
COMMENT ON COLUMN reporting.processed_files.content_hash IS 'Hash del contenido de datos para detectar cambios internos';

-- =============================================
-- TABLA: devices (Hojas de Testing 1 y 2)
-- Almacena información de dispositivos en validación
-- =============================================
CREATE TABLE IF NOT EXISTS reporting.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_hash VARCHAR(64) UNIQUE NOT NULL,
    source_file_id UUID REFERENCES reporting.processed_files(id) ON DELETE SET NULL,
    sheet_name VARCHAR(100),
    row_index INTEGER,
    
    -- Campos principales (mapeo dinámico por nombre de columna)
    brand VARCHAR(100),              -- Market Name
    device VARCHAR(200),             -- Requerido para registro válido
    project VARCHAR(100),
    model VARCHAR(100),              -- Requerido para registro válido
    build VARCHAR(100),
    tac VARCHAR(100),
    approved_date DATE,
    dual_sim BOOLEAN,
    target_region VARCHAR(100),
    target_customer VARCHAR(200),
    android_version VARCHAR(100),
    volume_forecast VARCHAR(100),
    target_solution VARCHAR(100),
    
    -- Campos de planificación
    integration_requirement TEXT,
    initial_sw_schedule DATE,
    commercial_schedule DATE,
    sw_freeze_date DATE,
    initial_shipment_date DATE,
    initial_selling_date DATE,
    launch_date DATE,
    sample_shipped VARCHAR(100),
    priority VARCHAR(100),
    
    -- Estado y seguimiento
    status VARCHAR(50) CHECK (status IN ('Not Started', 'Testing', 'Completed', 'Issue', 'Cancelled') OR status IS NULL),
    comments TEXT,
    tester VARCHAR(100),
    contact VARCHAR(200),
    
    -- Metadatos
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraint: Registro válido debe tener device O model
    CONSTRAINT valid_device_record CHECK (device IS NOT NULL OR model IS NOT NULL)
);

COMMENT ON TABLE reporting.devices IS 'Dispositivos en proceso de validación, extraídos de hojas Testing';
COMMENT ON COLUMN reporting.devices.device_hash IS 'Hash único basado en campos clave para detección de duplicados';
COMMENT ON COLUMN reporting.devices.brand IS 'Marca del dispositivo (columna Market Name)';
COMMENT ON COLUMN reporting.devices.status IS 'Estado de validación: Not Started, Testing, Completed, Issue, Cancelled';

-- =============================================
-- TABLA: inventory (Hoja 3 - Separada)
-- Almacena información de inventario disponible
-- =============================================
CREATE TABLE IF NOT EXISTS reporting.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_file_id UUID REFERENCES reporting.processed_files(id) ON DELETE SET NULL,
    
    in_inventory BOOLEAN DEFAULT false,
    nm_flow VARCHAR(100),
    solution_type VARCHAR(100),
    model VARCHAR(100),
    tac VARCHAR(100),
    device_name VARCHAR(200),
    brand VARCHAR(100),
    marketing_name VARCHAR(200),
    serial_number VARCHAR(100),
    imei1 VARCHAR(50),
    imei2 VARCHAR(50),
    received_on VARCHAR(50),
    returned_on VARCHAR(50),
    remark TEXT,
    target_customer VARCHAR(200),
    comments TEXT,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reporting.inventory IS 'Inventario de dispositivos disponibles, separado de datos de testing';

-- =============================================
-- TABLA: automation_logs
-- Registro de operaciones de automatización
-- =============================================
CREATE TABLE IF NOT EXISTS reporting.automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID REFERENCES reporting.processed_files(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50),
    rows_inserted INTEGER DEFAULT 0,
    rows_updated INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reporting.automation_logs IS 'Logs de operaciones ETL para auditoría y debugging';

-- =============================================
-- ÍNDICES para consultas frecuentes
-- =============================================

-- Índices para filtros principales en dashboard
CREATE INDEX IF NOT EXISTS idx_devices_region ON reporting.devices(target_region);
CREATE INDEX IF NOT EXISTS idx_devices_status ON reporting.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_solution ON reporting.devices(target_solution);
CREATE INDEX IF NOT EXISTS idx_devices_customer ON reporting.devices(target_customer);
CREATE INDEX IF NOT EXISTS idx_devices_brand ON reporting.devices(brand);

-- Índice compuesto para filtros combinados
CREATE INDEX IF NOT EXISTS idx_devices_region_status ON reporting.devices(target_region, status);

-- Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_devices_device_name ON reporting.devices(device);
CREATE INDEX IF NOT EXISTS idx_devices_model ON reporting.devices(model);

-- Índices para control de archivos
CREATE INDEX IF NOT EXISTS idx_files_status ON reporting.processed_files(status);
CREATE INDEX IF NOT EXISTS idx_files_created ON reporting.processed_files(created_at);

-- Índice para logs
CREATE INDEX IF NOT EXISTS idx_logs_file ON reporting.automation_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON reporting.automation_logs(created_at);

-- =============================================
-- VISTAS para reportes y dashboard
-- =============================================

-- Vista: Resumen por estado
CREATE OR REPLACE VIEW reporting.v_status_summary AS
SELECT 
    status,
    COUNT(*) as device_count,
    COUNT(DISTINCT target_region) as regions_count,
    COUNT(DISTINCT brand) as brands_count
FROM reporting.devices
WHERE status IS NOT NULL
GROUP BY status
ORDER BY 
    CASE status 
        WHEN 'Completed' THEN 1
        WHEN 'Testing' THEN 2
        WHEN 'Issue' THEN 3
        WHEN 'Not Started' THEN 4
        WHEN 'Cancelled' THEN 5
    END;

-- Vista: Resumen por región
CREATE OR REPLACE VIEW reporting.v_region_summary AS
SELECT 
    target_region,
    COUNT(*) as total_devices,
    COUNT(*) FILTER (WHERE status = 'Completed') as completed,
    COUNT(*) FILTER (WHERE status = 'Testing') as testing,
    COUNT(*) FILTER (WHERE status = 'Issue') as with_issues,
    COUNT(*) FILTER (WHERE status = 'Not Started') as not_started,
    COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled
FROM reporting.devices
WHERE target_region IS NOT NULL
GROUP BY target_region
ORDER BY total_devices DESC;

-- Vista: Resumen por solución (DPC/DLC)
CREATE OR REPLACE VIEW reporting.v_solution_summary AS
SELECT 
    target_solution,
    COUNT(*) as total_devices,
    COUNT(*) FILTER (WHERE status = 'Completed') as completed,
    COUNT(*) FILTER (WHERE status = 'Testing') as testing,
    COUNT(*) FILTER (WHERE status = 'Issue') as with_issues
FROM reporting.devices
WHERE target_solution IS NOT NULL
GROUP BY target_solution
ORDER BY total_devices DESC;

-- Vista: Dashboard KPIs
CREATE OR REPLACE VIEW reporting.v_dashboard_kpis AS
SELECT 
    (SELECT COUNT(*) FROM reporting.devices) as total_devices,
    (SELECT COUNT(*) FROM reporting.devices WHERE status = 'Completed') as completed,
    (SELECT COUNT(*) FROM reporting.devices WHERE status = 'Testing') as testing,
    (SELECT COUNT(*) FROM reporting.devices WHERE status = 'Issue') as with_issues,
    (SELECT COUNT(*) FROM reporting.devices WHERE status = 'Not Started') as not_started,
    (SELECT COUNT(*) FROM reporting.devices WHERE status = 'Cancelled') as cancelled,
    (SELECT COUNT(DISTINCT target_region) FROM reporting.devices) as total_regions,
    (SELECT COUNT(DISTINCT brand) FROM reporting.devices) as total_brands,
    (SELECT COUNT(*) FROM reporting.inventory) as inventory_count;

-- =============================================
-- FUNCIONES de utilidad
-- =============================================

-- Función: Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION reporting.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para devices
DROP TRIGGER IF EXISTS update_devices_updated_at ON reporting.devices;
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON reporting.devices
    FOR EACH ROW
    EXECUTE FUNCTION reporting.update_updated_at_column();

-- Trigger para inventory
DROP TRIGGER IF EXISTS update_inventory_updated_at ON reporting.inventory;
CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON reporting.inventory
    FOR EACH ROW
    EXECUTE FUNCTION reporting.update_updated_at_column();

-- ============================================
-- Verificación
-- ============================================
SELECT 
    'Tables created' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'reporting') as table_count,
    (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'reporting') as view_count;
