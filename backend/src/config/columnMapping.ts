/**
 * TrustonicReporting - Column Mapping Configuration
 * 
 * Sistema de alias para manejar variaciones en nombres de columnas
 * y diferentes ordenamientos en los archivos Excel.
 */

// Mapeo de campos DB → posibles nombres de columna en Excel
export const COLUMN_ALIASES: Record<string, string[]> = {
    // Campos principales
    brand: ['Brand', 'Marca', 'OEM'],
    device: ['Market Name', 'Device Name', 'Dispositivo', 'Nombre Comercial'],
    device_type: ['Device', 'Type', 'Tipo', 'Tipo de Dispositivo'],
    project: ['Project', 'Proyecto', 'Project Name'],
    model: ['Model', 'Modelo', 'Model Name', 'Model_Name'],
    build: ['Build', 'Build Number', 'Version'],
    tac: ['TAC', 'Type Allocation Code'],
    approved_date: ['Approved Dated', 'Approved Date', 'Fecha Aprobación', 'Approval Date'],
    dual_sim: ['Dual SIM (Y/N)', 'Dual SIM', 'DualSIM', 'Dual_SIM'],
    target_region: ['Target Region', 'Region', 'Región', 'Target_Region'],
    target_customer: ['Target Customer', 'Customer', 'Cliente', 'Target_Customer', 'Costumer', 'Costumer Name'],
    android_version: ['Android version', 'Android Version', 'Android', 'OS Version'],
    volume_forecast: ['Volume Forecast', 'Forecast', 'Volume', 'Volume_Forecast'],
    target_solution: ['Target Solution (DPC/DLC)', 'Target Solution', 'Solution', 'DPC/DLC'],

    // Campos de planificación
    integration_requirement: ['Integration Requirement', 'Integration Requirements', 'Requirements'],
    initial_sw_schedule: ['initial SW build schedule', 'Initial SW Schedule', 'SW Build Schedule'],
    commercial_schedule: ['Commercial build schedule for Massive', 'Commercial Schedule', 'Mass Production Schedule'],
    sw_freeze_date: ['SW Freeze date', 'SW Freeze Date', 'Freeze Date'],
    initial_shipment_date: ['Initial Shipment date', 'Initial Shipment Date', 'First Shipment'],
    initial_selling_date: ['Initial Selling date', 'Initial Selling Date', 'Selling Date'],
    launch_date: ['Launch date', 'Launch Date', 'Launch'],
    sample_shipped: ['Sample Shipped', 'Samples Shipped', 'Sample Status'],
    priority: ['Priority', 'Prioridad'],

    // Estado y seguimiento
    status: ['Status', 'Estado', 'Validation Status'],
    comments: ['Comments', 'Comentarios', 'Notes', 'Notas', 'Comment', 'Observaciones'],
    tester: ['Tester', 'QA', 'Test Engineer'],
    contact: ['Contact', 'Contacto', 'Contact Person'],

    // Inventario (Campos adicionales)
    in_inventory: ['In inventory', 'En Inventario', 'Inventory', 'Stock', 'In Inventory (Yes/No)'],
    nm_flow: ['NM-Flow', 'Flow', 'Network Manager Flow', 'NM Flow'],
    solution_type: ['DPC/DLC', 'DPC-DLC', 'DPC DLC', 'Solution Type', 'Tipo de Solución', 'Solution_Type', 'DPC_DLC'],
    device_name: ['Device Name Inventory', 'Device Name', 'Nombre del Dispositivo'],
    marketing_name: ['Marketing Name', 'Nombre Comercial'],
    serial_number: ['Serial Number', 'S/N', 'Número de Serie', 'Serial_Number'],
    imei1: ['IMEI 1', 'IMEI_1', 'Imei 1'],
    imei2: ['IMEI 2', 'IMEI_2', 'Imei 2'],
    received_on: ['Received On', 'Fecha de Recibido', 'Received'],
    returned_on: ['Returned On', 'Fecha de Devolución', 'Returned'],
    remark: ['Remark', 'Observación', 'Comentario Inventario', 'Remarks'],
    inventory_comments: ['Comments', 'Comentarios', 'Notes', 'Inventory Comments'],
};

// Columnas a IGNORAR completamente (no almacenar)
export const IGNORED_COLUMNS: string[] = [
    'Status Options',
    'Unnamed',
];

// Campos obligatorios para considerar un registro válido
export const REQUIRED_FIELDS = ['device', 'model'] as const;

// Estados válidos para el campo status
export const VALID_STATUS_VALUES = [
    'Not Started',
    'Testing',
    'Completed',
    'Issue',
    'Cancelled',
] as const;

export type ValidStatus = typeof VALID_STATUS_VALUES[number];

/**
 * Encuentra el nombre de campo DB para una columna de Excel
 */
export function findFieldName(excelColumn: string): string | null {
    const normalizedColumn = excelColumn.trim().toLowerCase();

    // Verificar si debe ignorarse
    for (const ignored of IGNORED_COLUMNS) {
        if (normalizedColumn.includes(ignored.toLowerCase())) {
            return null;
        }
    }

    // Buscar en los alias
    for (const [fieldName, aliases] of Object.entries(COLUMN_ALIASES)) {
        for (const alias of aliases) {
            if (alias.toLowerCase() === normalizedColumn) {
                return fieldName;
            }
        }
    }

    return null;
}

/**
 * Crea un mapa de índice de columna → nombre de campo
 */
export function createColumnMap(headerRow: string[]): Map<number, string> {
    const columnMap = new Map<number, string>();

    headerRow.forEach((header, index) => {
        if (header && typeof header === 'string') {
            const fieldName = findFieldName(header);
            if (fieldName) {
                columnMap.set(index, fieldName);
            }
        }
    });

    return columnMap;
}

/**
 * Valida si un registro tiene los campos mínimos requeridos
 */
export function isValidRecord(record: Record<string, unknown>): boolean {
    // Debe tener al menos device O model con valor no vacío
    const hasDevice = record.device && String(record.device).trim() !== '';
    const hasModel = record.model && String(record.model).trim() !== '';

    return Boolean(hasDevice || hasModel);
}

/**
 * Normaliza el valor de status a uno de los valores válidos
 */
export function normalizeStatus(value: unknown): ValidStatus | null {
    if (!value || typeof value !== 'string') return null;

    const normalized = value.trim();

    // Buscar coincidencia exacta (case-insensitive)
    const found = VALID_STATUS_VALUES.find(
        status => status.toLowerCase() === normalized.toLowerCase()
    );

    return found || null;
}
