-- ============================================
-- TrustonicReporting - Database Initialization Script
-- ============================================
-- This script sets up the initial database structure for the project.
-- Run this script after creating the database.
--
-- Usage:
--   psql -U postgres -h localhost -d trustonic_reporting -f init_database.sql
-- ============================================

-- Create reporting schema if not exists
CREATE SCHEMA IF NOT EXISTS reporting;

-- Set default search path
SET search_path TO reporting, public;

-- Add database comments for documentation
COMMENT ON DATABASE trustonic_reporting IS 'Base de datos principal para el sistema de reportes de Trustonic';
COMMENT ON SCHEMA reporting IS 'Schema principal para las tablas de reportes y datos procesados';

-- Extension for UUID support (optional, but recommended)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Extension for better date/time handling
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================
-- Placeholder for future tables
-- Tables will be added here as the project evolves
-- ============================================

-- Verification query
SELECT 
    current_database() AS database_name,
    current_schema() AS current_schema,
    version() AS postgres_version;
