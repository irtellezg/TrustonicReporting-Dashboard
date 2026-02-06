/**
 * TrustonicReporting - Excel Parser Service
 * 
 * Parsea archivos Excel con mapeo dinámico de columnas,
 * separando datos de Testing e Inventory.
 */
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import * as path from 'path';
import {
    createColumnMap,
    isValidRecord,
    normalizeStatus,
    IGNORED_COLUMNS
} from '../config/columnMapping';
import { Device, InventoryItem, ExcelParseResult, ParseError } from '../types';

/**
 * Parsea un archivo Excel y extrae dispositivos e inventario
 */
export async function parseExcelFile(filePath: string, defaultBrand?: string): Promise<ExcelParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const devices: Device[] = [];
    const inventory: InventoryItem[] = [];
    const errors: ParseError[] = [];

    workbook.eachSheet((worksheet, sheetId) => {
        const sheetName = worksheet.name.toLowerCase();

        // Detectar si es hoja de Inventory
        if (sheetName.includes('inventory') || sheetName.includes('inventario')) {
            const result = parseInventorySheet(worksheet);
            inventory.push(...result.items);
            errors.push(...result.errors);
        } else {
            // Asumir que es hoja de Testing
            const result = parseDevicesSheet(worksheet, defaultBrand);
            devices.push(...result.devices);
            errors.push(...result.errors);
        }
    });

    return {
        devices,
        inventory,
        sheetCount: workbook.worksheets.length,
        errors,
    };
}

/**
 * Parsea una hoja de dispositivos (Testing)
 */
function parseDevicesSheet(worksheet: ExcelJS.Worksheet, defaultBrand?: string): {
    devices: Device[];
    errors: ParseError[]
} {
    const devices: Device[] = [];
    const errors: ParseError[] = [];
    const sheetName = worksheet.name;

    // Encontrar la fila de encabezados (buscar en las primeras 5 filas)
    let headerRowIndex = 1;
    let columnMap: Map<number, string> | null = null;

    for (let i = 1; i <= 5; i++) {
        const row = worksheet.getRow(i);
        const headers = getRowValues(row);
        const testMap = createColumnMap(headers);

        // Considerar válido si encontramos al menos 3 campos mapeados
        if (testMap.size >= 3) {
            headerRowIndex = i;
            columnMap = testMap;
            break;
        }
    }

    if (!columnMap || columnMap.size === 0) {
        errors.push({
            sheet: sheetName,
            row: 0,
            message: 'No se encontraron encabezados válidos en la hoja',
        });
        return { devices, errors };
    }

    // Procesar filas de datos (después del encabezado)
    for (let rowIndex = headerRowIndex + 1; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        const values = getRowValues(row);

        // Verificar si la fila está vacía
        if (values.every(v => !v || String(v).trim() === '')) {
            continue;
        }

        try {
            const record = mapRowToRecord(values, columnMap);

            // Validar que el registro tenga campos mínimos
            if (!isValidRecord(record)) {
                // No es un error, simplemente lo ignoramos (registros con solo Status)
                continue;
            }

            // Normalizar status
            if (record.status) {
                record.status = normalizeStatus(record.status) || undefined;
            }

            // PRIORIDAD: Aplicar Marca del nombre del archivo si se proporciona
            if (defaultBrand) {
                // Solo si el registro no tiene marca o si la marca parece ser un nombre de modelo/dispositivo
                // (Por seguridad, si viene marca del archivo, la usamos como base)
                record.brand = defaultBrand;
            }

            // Generar hash único para el dispositivo
            const deviceHash = generateDeviceHash(record);

            const device: Device = {
                ...record,
                device_hash: deviceHash,
                sheet_name: sheetName,
                row_index: rowIndex,
            } as Device;

            devices.push(device);
        } catch (error) {
            errors.push({
                sheet: sheetName,
                row: rowIndex,
                message: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }

    return { devices, errors };
}

/**
 * Parsea una hoja de Inventory
 */
function parseInventorySheet(worksheet: ExcelJS.Worksheet): {
    items: InventoryItem[];
    errors: ParseError[];
} {
    const items: InventoryItem[] = [];
    const errors: ParseError[] = [];
    const sheetName = worksheet.name;

    // Encontrar encabezados (buscar en las primeras 5 filas)
    let headerRowIndex = 0;
    let columnMap: Map<number, string> | null = null;

    for (let i = 1; i <= 5; i++) {
        const row = worksheet.getRow(i);
        const headers = getRowValues(row);
        const testMap = createColumnMap(headers);

        // Para inventory buscamos al menos model y tac o device_name
        if (testMap.size >= 2) {
            headerRowIndex = i;
            columnMap = testMap;
            break;
        }
    }

    if (!columnMap || headerRowIndex === 0) {
        errors.push({
            sheet: sheetName,
            row: 0,
            message: 'No se encontraron encabezados de inventario válidos',
        });
        return { items, errors };
    }

    // Procesar filas
    for (let rowIndex = headerRowIndex + 1; rowIndex <= worksheet.rowCount; rowIndex++) {
        const row = worksheet.getRow(rowIndex);
        const values = getRowValues(row);

        if (values.every(v => !v || String(v).trim() === '')) {
            continue;
        }

        try {
            const item: InventoryItem = {
                metadata: {},
            };

            columnMap.forEach((fieldName, colIndex) => {
                const value = values[colIndex];
                if (value !== undefined && value !== null) {
                    const stringValue = String(value).trim();
                    if (stringValue === '') return;

                    if (fieldName === 'in_inventory') {
                        const lowVal = stringValue.toLowerCase();
                        item.in_inventory = lowVal === 'yes' || lowVal === 'y' || lowVal === 'si' || lowVal === 's' || lowVal === 'true' || lowVal === '1';
                    } else if (fieldName === 'device_name') {
                        item.device_name = stringValue;
                    } else if (fieldName === 'model') {
                        item.model = stringValue;
                    } else if (fieldName === 'tac') {
                        item.tac = stringValue;
                    } else if (fieldName.toLowerCase() === 'solution_type' ||
                        fieldName.toLowerCase() === 'target_solution' ||
                        fieldName.toLowerCase() === 'dpc/dlc' ||
                        fieldName.toLowerCase() === 'solution') {
                        item.solution_type = stringValue;
                    } else if (fieldName === 'nm_flow') {
                        item.nm_flow = stringValue;
                    } else if (fieldName === 'brand') {
                        item.brand = stringValue;
                    } else if (fieldName === 'marketing_name') {
                        item.marketing_name = stringValue;
                    } else if (fieldName === 'serial_number') {
                        item.serial_number = stringValue;
                    } else if (fieldName === 'imei1') {
                        item.imei1 = stringValue;
                    } else if (fieldName === 'imei2') {
                        item.imei2 = stringValue;
                    } else if (fieldName === 'received_on') {
                        item.received_on = stringValue;
                    } else if (fieldName === 'returned_on') {
                        item.returned_on = stringValue;
                    } else if (fieldName === 'remark') {
                        item.remark = stringValue;
                    } else if (fieldName === 'comments' || fieldName === 'inventory_comments') {
                        item.comments = stringValue;
                    } else if (fieldName === 'target_customer' || fieldName === 'customer') {
                        item.target_customer = normalizeRegionAndCustomer(stringValue);
                    } else {
                        // Otros campos van a metadata
                        item.metadata = item.metadata || {};
                        item.metadata[fieldName] = stringValue;
                    }
                }
            });

            // Generar hash único para el item de inventario
            item.inventory_hash = generateInventoryHash(item);

            // Solo agregar si tiene datos significativos
            if (item.model || item.tac || item.device_name || item.serial_number || item.imei1) {
                items.push(item);
            }
        } catch (error) {
            errors.push({
                sheet: sheetName,
                row: rowIndex,
                message: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }

    return { items, errors };
}

/**
 * Extrae valores de una fila como array de strings
 */
function getRowValues(row: ExcelJS.Row): string[] {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        values[colNumber - 1] = getCellValue(cell);
    });
    return values;
}

/**
 * Obtiene el valor de una celda como string
 */
function getCellValue(cell: ExcelJS.Cell): string {
    if (!cell || cell.value === null || cell.value === undefined) {
        return '';
    }

    const value = cell.value;

    // Manejar diferentes tipos de valores
    if (typeof value === 'object') {
        // En ExcelJS, las celdas con formato enriquecido tienen una propiedad 'richText'
        if ('richText' in value && Array.isArray((value as any).richText)) {
            return (value as any).richText.map((rt: any) => rt.text || '').join('');
        }

        if ('result' in value) {
            // Fórmula
            return String(value.result || '');
        }

        if ('text' in value) {
            // Hipervínculos o texto simple envuelto
            return String(value.text || '');
        }

        if (value instanceof Date) {
            // Usar componentes UTC para mantener la consistencia con ExcelJS
            const y = value.getUTCFullYear();
            const m = String(value.getUTCMonth() + 1).padStart(2, '0');
            const d = String(value.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }

        return JSON.stringify(value);
    }

    return String(value);
}

/**
 * Mapea valores de fila a un objeto record
 */
function mapRowToRecord(
    values: string[],
    columnMap: Map<number, string>
): Record<string, unknown> {
    const record: Record<string, unknown> = {};

    columnMap.forEach((fieldName, colIndex) => {
        const value = values[colIndex];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            record[fieldName] = convertValue(fieldName, value);
        } else {
            record[fieldName] = null;
        }
    });

    return record;
}

/**
 * Convierte valor según el tipo de campo
 */
/**
 * Normaliza nombres de regiones y clientes para corregir typos y estandarizar
 */
function normalizeRegionAndCustomer(val: string): string {
    if (!val) return val;

    // Lista de mapeos para corregir typos conocidos
    const typoMap: Record<string, string> = {
        'bhamas': 'Bahamas',
        'bhahamas': 'Bahamas',
        'peru': 'Peru',
        'mxico': 'Mexico',
        'mexico': 'Mexico',
        'panam': 'Panama',
        'panama': 'Panama',
        'colomiba': 'Colombia',
        'dominicana': 'República Dominicana',
        'jamaica and barbados': 'Jamaica, Barbados',
        'om': 'Latam Om',
        'latam om': 'Latam Om',
    };

    // Delimitadores: coma, "and", "&", "/", "\n", y espacios múltiples
    const parts = val.split(/,|\s+and\s+|&|\/|\n/i);

    return parts
        .map(s => {
            let part = s.trim();
            if (!part || part.length < 2) return '';

            const lowPart = part.toLowerCase();

            // 1. Corregir typos según mapa
            if (typoMap[lowPart]) {
                return typoMap[lowPart];
            }

            // 2. Normalizar a Proper Case (Primera letra Mayúscula)
            return part.split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        })
        .filter(Boolean)
        .sort() // Ordenar alfabéticamente para consistencia en el hash
        .join(', ');
}

/**
 * Convierte valor según el tipo de campo
 */
function convertValue(fieldName: string, value: string): unknown {
    const trimmed = String(value).trim();

    // Normalización de Regiones y Clientes
    if (fieldName === 'target_region' || fieldName === 'target_customer') {
        return normalizeRegionAndCustomer(trimmed);
    }

    // Normalización de Soluciones (limpieza y corrección de typos como 1.o)
    if (fieldName === 'target_solution') {
        return trimmed.split(',')
            .map(s => s.trim()
                .replace(/1\.o/g, '1.0')
                .replace(/1\.O/g, '1.0')
            )
            .filter(Boolean)
            .join(', ');
    }

    // Campos de fecha
    if (fieldName.includes('date') || fieldName.includes('schedule')) {
        return parseDate(trimmed);
    }

    // Campo booleano
    if (fieldName === 'dual_sim') {
        return trimmed.toLowerCase() === 'y' ||
            trimmed.toLowerCase() === 'yes' ||
            trimmed === '1' ||
            trimmed.toLowerCase() === 'true';
    }

    return trimmed;
}

/**
 * Parsea una fecha de Excel a string YYYY-MM-DD de forma segura
 */
function parseDate(value: string | unknown): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (str === '') return null;

    // 1. Ya está en formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }

    // 2. Formato DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // 3. Fallback: new Date() pero con cuidado extremado
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        // Usar componentes UTC para evitar saltos
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return null;
}

/**
 * Genera un hash único para un dispositivo
 */
function generateDeviceHash(record: Record<string, unknown>): string {
    // Campos clave para identificar un dispositivo único
    const keyFields = ['device', 'model', 'tac', 'build', 'target_region', 'target_solution', 'target_customer'];
    const keyData = keyFields
        .map(f => String(record[f] || '').toLowerCase().trim())
        .join('|');

    return crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 64);
}

/**
 * Genera un hash único para un item de inventario
 */
function generateInventoryHash(item: InventoryItem): string {
    // Campos clave para identificar un item de inventario único
    // Usamos model, serial, imeis y solución/cliente
    const keyFields: (keyof InventoryItem)[] = [
        'brand', 'model', 'serial_number', 'imei1', 'imei2',
        'solution_type', 'target_customer', 'nm_flow'
    ];

    const keyData = keyFields
        .map(f => String(item[f] || '').toLowerCase().trim())
        .join('|');

    return crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 64);
}

/**
 * Calcula el hash de un archivo
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Obtiene información básica de un archivo
 */
export async function getFileInfo(filePath: string): Promise<{
    fileName: string;
    fileSize: number;
    fileHash: string;
}> {
    const fs = await import('fs/promises');
    const stats = await fs.stat(filePath);
    const fileHash = await calculateFileHash(filePath);

    return {
        fileName: path.basename(filePath),
        fileSize: stats.size,
        fileHash,
    };
}
