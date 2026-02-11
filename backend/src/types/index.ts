/**
 * TrustonicReporting - Type Definitions
 */

export interface Device {
    id?: string;
    device_hash: string;
    source_file_id?: string;
    sheet_name?: string;
    row_index?: number;

    // Campos principales
    brand?: string;
    device?: string;
    device_type?: string;
    project?: string;
    model?: string;
    build?: string;
    tac?: string;
    approved_date?: string | null;
    dual_sim?: boolean;
    target_region?: string;
    target_customer?: string;
    android_version?: string;
    volume_forecast?: string;
    target_solution?: string;

    // Campos de planificación
    integration_requirement?: string;
    initial_sw_schedule?: string | null;
    commercial_schedule?: string | null;
    sw_freeze_date?: string | null;
    initial_shipment_date?: string | null;
    initial_selling_date?: string | null;
    launch_date?: string | null;
    sample_shipped?: string;
    priority?: string;

    // Estado y seguimiento
    status?: 'Not Started' | 'Testing' | 'Completed' | 'Issue' | 'Cancelled';
    comments?: string;
    tester?: string;
    contact?: string;

    // Metadatos
    created_at?: Date;
    updated_at?: Date;
}

export interface InventoryItem {
    id?: string;
    inventory_hash?: string;
    source_file_id?: string;

    // Campos del archivo de inventario
    brand?: string;
    marketing_name?: string;
    model?: string;
    serial_number?: string;
    imei1?: string;
    imei2?: string;
    received_on?: string;
    returned_on?: string;
    remark?: string;
    solution_type?: string;
    target_customer?: string;
    comments?: string;

    // Otros campos
    in_inventory?: boolean;
    nm_flow?: string;
    tac?: string;
    device_name?: string;

    metadata?: Record<string, unknown>;

    created_at?: Date;
    updated_at?: Date;
}

export interface ProcessedFile {
    id?: string;
    file_name: string;
    file_path: string;
    file_hash: string;
    content_hash?: string;
    file_size?: number;
    sheet_count?: number;
    devices_count?: number;
    inventory_count?: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
    processed_at?: Date;
    error_message?: string;
    created_at?: Date;
}

export interface AutomationLog {
    id?: string;
    file_id?: string;
    action: string;
    table_name?: string;
    rows_inserted?: number;
    rows_updated?: number;
    rows_skipped?: number;
    errors?: unknown[];
    duration_ms?: number;
    created_at?: Date;
}

export interface MonthlyTrack {
    id?: string;
    source_file_id?: string;
    country: string;
    customer: string;
    solution: string;
    record_date: string;
    registered: number;
    activated: number;
    total_billable: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface ExcelParseResult {
    devices: Device[];
    inventory: InventoryItem[];
    monthlyTracks: MonthlyTrack[];
    sheetCount: number;
    errors: ParseError[];
}

export interface ParseError {
    sheet: string;
    row: number;
    column?: string;
    message: string;
}

export interface ETLResult {
    success: boolean;
    devicesInserted: number;
    devicesUpdated: number;
    devicesSkipped: number;
    inventoryInserted: number;
    inventoryUpdated: number;
    monthlyTracksInserted: number;
    errors: ParseError[];
    durationMs: number;
}

// Dashboard types
export interface DashboardKPIs {
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
    not_started: number;
    cancelled: number;
    total_regions: number;
    total_brands: number;
    inventory_count: number;
}

export interface StatusSummary {
    status: string;
    device_count: number;
    regions_count: number;
    brands_count: number;
}

export interface RegionSummary {
    target_region: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
    not_started: number;
    cancelled: number;
}

export interface SolutionSummary {
    target_solution: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
}

export interface FilterOptions {
    regions: string[];
    customers: string[];
    brands: string[];
    solutions: string[];
    statuses: string[];
}
