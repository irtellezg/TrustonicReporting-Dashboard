/**
 * TrustonicReporting - Database Loader Service
 * 
 * Carga datos a PostgreSQL con upsert, transacciones y logging.
 */
import { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { pool, transaction, query, SCHEMA } from '../config/database';
import { Device, InventoryItem, MonthlyTrack, ProcessedFile, AutomationLog, ETLResult } from '../types';

/**
 * Registra un archivo como procesado
 */
export async function registerProcessedFile(
    fileInfo: Omit<ProcessedFile, 'id' | 'created_at'>
): Promise<string> {
    const result = await query<{ id: string }>(
        `INSERT INTO ${SCHEMA}.processed_files 
     (file_name, file_path, file_hash, content_hash, file_size, sheet_count, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (file_hash) 
     DO UPDATE SET 
       status = 'PROCESSING',
       processed_at = NULL,
       error_message = NULL
     RETURNING id`,
        [
            fileInfo.file_name,
            fileInfo.file_path,
            fileInfo.file_hash,
            fileInfo.content_hash || null,
            fileInfo.file_size || 0,
            fileInfo.sheet_count || 0,
            'PROCESSING',
        ]
    );

    return result[0].id;
}

/**
 * Actualiza el estado de un archivo procesado
 */
export async function updateFileStatus(
    fileId: string,
    status: 'COMPLETED' | 'ERROR',
    counts?: { devices: number; inventory: number },
    errorMessage?: string
): Promise<void> {
    await query(
        `UPDATE ${SCHEMA}.processed_files 
     SET status = $1, 
         processed_at = NOW(),
         devices_count = COALESCE($3, devices_count),
         inventory_count = COALESCE($4, inventory_count),
         error_message = $5
     WHERE id = $2`,
        [status, fileId, counts?.devices, counts?.inventory, errorMessage]
    );
}

/**
 * Verifica si un archivo ya fue procesado (sin cambios)
 */
export async function isFileAlreadyProcessed(fileHash: string): Promise<boolean> {
    const result = await query<{ status: string }>(
        `SELECT status FROM ${SCHEMA}.processed_files 
     WHERE file_hash = $1 AND status = 'COMPLETED'`,
        [fileHash]
    );
    return result.length > 0;
}

/**
 * Carga dispositivos en la base de datos
 */
export async function loadDevices(
    devices: Device[],
    fileId: string
): Promise<{ inserted: number; updated: number; skipped: number }> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    await transaction(async (client) => {
        for (const device of devices) {
            const result = await upsertDevice(client, device, fileId);
            if (result === 'inserted') inserted++;
            else if (result === 'updated') updated++;
            else skipped++;
        }
    });

    return { inserted, updated, skipped };
}

/**
 * Upsert de un dispositivo individual
 */
async function upsertDevice(
    client: PoolClient,
    device: Device,
    fileId: string
): Promise<'inserted' | 'updated' | 'skipped'> {
    const existingResult = await client.query(
        `SELECT id FROM ${SCHEMA}.devices WHERE device_hash = $1`,
        [device.device_hash]
    );

    if (existingResult.rows.length > 0) {
        // Actualizar registro existente
        await client.query(
            `UPDATE ${SCHEMA}.devices SET
        source_file_id = $2,
        sheet_name = $3,
        row_index = $4,
        brand = $5,
        device = $6,
        device_type = $7,
        project = $8,
        model = $9,
        build = $10,
        tac = $11,
        approved_date = $12,
        dual_sim = $13,
        target_region = $14,
        target_customer = $15,
        android_version = $16,
        volume_forecast = $17,
        target_solution = $18,
        integration_requirement = $19,
        initial_sw_schedule = $20,
        commercial_schedule = $21,
        sw_freeze_date = $22,
        initial_shipment_date = $23,
        initial_selling_date = $24,
        launch_date = $25,
        sample_shipped = $26,
        priority = $27,
        status = $28,
        comments = $29,
        tester = $30,
        contact = $31,
        updated_at = NOW()
      WHERE device_hash = $1`,
            [
                device.device_hash,
                fileId,
                device.sheet_name,
                device.row_index,
                device.brand,
                device.device,
                device.device_type,
                device.project,
                device.model,
                device.build,
                device.tac,
                device.approved_date,
                device.dual_sim,
                device.target_region,
                device.target_customer,
                device.android_version,
                device.volume_forecast,
                device.target_solution,
                device.integration_requirement,
                device.initial_sw_schedule,
                device.commercial_schedule,
                device.sw_freeze_date,
                device.initial_shipment_date,
                device.initial_selling_date,
                device.launch_date,
                device.sample_shipped,
                device.priority,
                device.status,
                device.comments,
                device.tester,
                device.contact,
            ]
        );
        return 'updated';
    } else {
        // Insertar nuevo registro
        await client.query(
            `INSERT INTO ${SCHEMA}.devices (
        device_hash, source_file_id, sheet_name, row_index,
        brand, device, device_type, project, model, build, tac,
        approved_date, dual_sim, target_region, target_customer,
        android_version, volume_forecast, target_solution,
        integration_requirement, initial_sw_schedule, commercial_schedule,
        sw_freeze_date, initial_shipment_date, initial_selling_date,
        launch_date, sample_shipped, priority,
        status, comments, tester, contact
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      )`,
            [
                device.device_hash,
                fileId,
                device.sheet_name,
                device.row_index,
                device.brand,
                device.device,
                device.device_type,
                device.project,
                device.model,
                device.build,
                device.tac,
                device.approved_date,
                device.dual_sim,
                device.target_region,
                device.target_customer,
                device.android_version,
                device.volume_forecast,
                device.target_solution,
                device.integration_requirement,
                device.initial_sw_schedule,
                device.commercial_schedule,
                device.sw_freeze_date,
                device.initial_shipment_date,
                device.initial_selling_date,
                device.launch_date,
                device.sample_shipped,
                device.priority,
                device.status,
                device.comments,
                device.tester,
                device.contact,
            ]
        );
        return 'inserted';
    }
}

/**
 * Carga items de inventario en la base de datos
 */
export async function loadInventory(
    items: InventoryItem[],
    fileId: string
): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;

    await transaction(async (client) => {
        for (const item of items) {
            // Generar hash si no existe (fallback de seguridad)
            if (!item.inventory_hash) {
                const keyFields: (keyof InventoryItem)[] = [
                    'brand', 'model', 'serial_number', 'imei1', 'imei2',
                    'solution_type', 'target_customer', 'nm_flow'
                ];
                const keyData = keyFields
                    .map(f => String(item[f] || '').toLowerCase().trim())
                    .join('|');
                item.inventory_hash = crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 64);
            }

            const result = await client.query(
                `INSERT INTO ${SCHEMA}.inventory (
          inventory_hash, source_file_id, in_inventory, nm_flow, solution_type,
          model, tac, device_name, brand, marketing_name, 
          serial_number, imei1, imei2, received_on, 
          returned_on, remark, target_customer, comments, metadata,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
        ON CONFLICT (inventory_hash) 
        DO UPDATE SET 
          source_file_id = EXCLUDED.source_file_id,
          in_inventory = EXCLUDED.in_inventory,
          nm_flow = EXCLUDED.nm_flow,
          solution_type = EXCLUDED.solution_type,
          model = EXCLUDED.model,
          tac = EXCLUDED.tac,
          device_name = EXCLUDED.device_name,
          brand = EXCLUDED.brand,
          marketing_name = EXCLUDED.marketing_name,
          serial_number = EXCLUDED.serial_number,
          imei1 = EXCLUDED.imei1,
          imei2 = EXCLUDED.imei2,
          received_on = EXCLUDED.received_on,
          returned_on = EXCLUDED.returned_on,
          remark = EXCLUDED.remark,
          target_customer = EXCLUDED.target_customer,
          comments = EXCLUDED.comments,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING (xmin = 0) as is_update`,
                [
                    item.inventory_hash,
                    fileId,
                    item.in_inventory || false,
                    item.nm_flow,
                    item.solution_type,
                    item.model,
                    item.tac,
                    item.device_name,
                    item.brand,
                    item.marketing_name,
                    item.serial_number,
                    item.imei1,
                    item.imei2,
                    item.received_on,
                    item.returned_on,
                    item.remark,
                    item.target_customer,
                    item.comments,
                    JSON.stringify(item.metadata || {}),
                ]
            );

            // Increment based on what happened (simplified)
            inserted++;
        }
    });

    return { inserted, updated };
}

/**
 * Carga seguimiento mensual en la base de datos con detección de duplicados
 */
export async function loadMonthlyTracks(
    tracks: MonthlyTrack[],
    fileId: string
): Promise<{ inserted: number }> {
    let inserted = 0;

    await transaction(async (client) => {
        for (const track of tracks) {
            await client.query(
                `INSERT INTO ${SCHEMA}.monthly_tracking (
                    source_file_id, country, customer, solution, 
                    record_date, registered, activated, total_billable, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                ON CONFLICT (country, customer, solution, record_date) 
                DO UPDATE SET 
                    source_file_id = EXCLUDED.source_file_id,
                    registered = EXCLUDED.registered,
                    activated = EXCLUDED.activated,
                    total_billable = EXCLUDED.total_billable,
                    updated_at = NOW()`,
                [
                    fileId,
                    track.country,
                    track.customer,
                    track.solution,
                    track.record_date,
                    track.registered,
                    track.activated,
                    track.total_billable
                ]
            );
            inserted++;
        }
    });

    return { inserted };
}
export async function logAutomation(log: Omit<AutomationLog, 'id' | 'created_at'>): Promise<void> {
    await query(
        `INSERT INTO ${SCHEMA}.automation_logs 
     (file_id, action, table_name, rows_inserted, rows_updated, rows_skipped, errors, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            log.file_id,
            log.action,
            log.table_name,
            log.rows_inserted || 0,
            log.rows_updated || 0,
            log.rows_skipped || 0,
            JSON.stringify(log.errors || []),
            log.duration_ms || 0,
        ]
    );
}

/**
 * Helper para construir la cláusula WHERE basada en filtros
 */
function buildWhereClause(filters?: {
    region?: string;
    customer?: string;
    status?: string;
    solution?: string;
    brand?: string;
    search?: string;
}) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.region) {
        // Usamos ILIKE para encontrar la región dentro de posibles listas separadas por comas
        conditions.push(`target_region ILIKE $${paramIndex++}`);
        params.push(`%${filters.region}%`);
    }
    if (filters?.customer) {
        conditions.push(`target_customer ILIKE $${paramIndex++}`);
        params.push(`%${filters.customer}%`);
    }
    if (filters?.status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(filters.status);
    }
    if (filters?.solution) {
        conditions.push(`target_solution ILIKE $${paramIndex++}`);
        params.push(`%${filters.solution}%`);
    }
    if (filters?.brand) {
        conditions.push(`brand ILIKE $${paramIndex++}`);
        params.push(`%${filters.brand}%`);
    }
    if (filters?.search) {
        conditions.push(`(device ILIKE $${paramIndex} OR model ILIKE $${paramIndex} OR tac ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Log para depuración (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 SQL Filter:', { whereClause, params });
    }

    return { whereClause, params };
}

/**
 * Helper para construir la cláusula WHERE basada en filtros para INVENTARIO
 */
function buildInventoryWhereClause(filters?: {
    brand?: string;
    customer?: string;
    received_on?: string;
    search?: string;
}) {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters?.brand) {
        conditions.push(`brand ILIKE $${paramIndex++}`);
        params.push(`%${filters.brand}%`);
    }
    if (filters?.customer) {
        conditions.push(`target_customer ILIKE $${paramIndex++}`);
        params.push(`%${filters.customer}%`);
    }
    if (filters?.received_on) {
        conditions.push(`received_on ILIKE $${paramIndex++}`);
        params.push(`%${filters.received_on}%`);
    }
    if (filters?.search) {
        const s = `%${filters.search}%`;
        conditions.push(`(
            brand ILIKE $${paramIndex} OR 
            marketing_name ILIKE $${paramIndex} OR 
            model ILIKE $${paramIndex} OR 
            imei1 ILIKE $${paramIndex} OR 
            imei2 ILIKE $${paramIndex} OR 
            serial_number ILIKE $${paramIndex} OR
            target_customer ILIKE $${paramIndex} OR
            received_on ILIKE $${paramIndex} OR
            remark ILIKE $${paramIndex} OR
            comments ILIKE $${paramIndex} OR
            solution_type ILIKE $${paramIndex}
        )`);
        params.push(s);
        paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, params };
}

/**
 * Obtiene estadísticas del dashboard con filtros
 */
export async function getDashboardKPIs(filters?: any): Promise<Record<string, number>> {
    const { whereClause, params } = buildWhereClause(filters);

    // El contador de inventario ignorará los filtros de dispositivos por ahora
    const result = await query<any>(
        `SELECT 
            COUNT(*) as total_devices,
            COUNT(*) FILTER (WHERE status = 'Completed') as completed,
            COUNT(*) FILTER (WHERE status = 'Testing') as testing,
            COUNT(*) FILTER (WHERE status = 'Issue') as with_issues,
            COUNT(*) FILTER (WHERE status = 'Not Started') as not_started,
            COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled,
            COUNT(DISTINCT target_region) as total_regions,
            COUNT(DISTINCT brand) as total_brands,
            (SELECT COUNT(*) FROM ${SCHEMA}.inventory) as inventory_count
         FROM ${SCHEMA}.devices ${whereClause}`,
        params
    );
    return result[0] || {};
}

/**
 * Obtiene resumen por estado con filtros
 */
export async function getStatusSummary(filters?: any): Promise<Array<{
    status: string;
    device_count: number;
    regions_count: number;
    brands_count: number;
}>> {
    const { whereClause, params } = buildWhereClause(filters);

    return query(
        `SELECT 
            status,
            COUNT(*) as device_count,
            COUNT(DISTINCT target_region) as regions_count,
            COUNT(DISTINCT brand) as brands_count
        FROM ${SCHEMA}.devices
        ${whereClause ? whereClause + ' AND' : 'WHERE'} status IS NOT NULL
        GROUP BY status
        ORDER BY 
            CASE status 
                WHEN 'Completed' THEN 1
                WHEN 'Testing' THEN 2
                WHEN 'Issue' THEN 3
                WHEN 'Not Started' THEN 4
                WHEN 'Cancelled' THEN 5
            END`,
        params
    );
}

/**
 * Obtiene resumen por región con filtros
 */
export async function getRegionSummary(filters?: any): Promise<Array<{
    target_region: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
    not_started: number;
    cancelled: number;
}>> {
    const { whereClause, params } = buildWhereClause(filters);

    // Para regiones splitteamos primero y limpiamos
    return query(
        `WITH split_regions AS (
            SELECT 
                trim(r)::VARCHAR(100) as region, 
                status 
            FROM ${SCHEMA}.devices, 
                 unnest(string_to_array(target_region, ',')) AS r 
            ${whereClause}
        )
        SELECT 
            region as target_region,
            COUNT(*) as total_devices,
            COUNT(*) FILTER (WHERE status = 'Completed') as completed,
            COUNT(*) FILTER (WHERE status = 'Testing') as testing,
            COUNT(*) FILTER (WHERE status = 'Issue') as with_issues,
            COUNT(*) FILTER (WHERE status = 'Not Started') as not_started,
            COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled
        FROM split_regions
        WHERE region != ''
        GROUP BY region
        ORDER BY total_devices DESC`,
        params
    );
}

/**
 * Obtiene resumen por solución con filtros, normalizando DLC 1.o -> DLC 1.0
 */
export async function getSolutionSummary(filters?: any): Promise<Array<{
    target_solution: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
}>> {
    const { whereClause, params } = buildWhereClause(filters);

    return query(
        `WITH split_solutions AS (
            SELECT 
                TRIM(REPLACE(REPLACE(s, '1.o', '1.0'), '1.O', '1.0'))::VARCHAR(100) as solution,
                status
            FROM ${SCHEMA}.devices,
                 unnest(string_to_array(target_solution, ',')) AS s
            ${whereClause}
        )
        SELECT 
            solution as target_solution,
            COUNT(*) as total_devices,
            COUNT(*) FILTER (WHERE status = 'Completed') as completed,
            COUNT(*) FILTER (WHERE status = 'Testing') as testing,
            COUNT(*) FILTER (WHERE status = 'Issue') as with_issues
        FROM split_solutions
        WHERE solution IS NOT NULL AND solution != ''
        GROUP BY solution
        ORDER BY total_devices DESC`,
        params
    );
}

/**
 * Obtiene resumen por marca con filtros
 */
export async function getBrandSummary(filters?: any): Promise<Array<{
    brand: string;
    device_count: number;
}>> {
    const { whereClause, params } = buildWhereClause(filters);

    return query(
        `SELECT 
            brand,
            COUNT(*) as device_count
        FROM ${SCHEMA}.devices
        ${whereClause}
        GROUP BY brand
        ORDER BY device_count DESC`,
        params
    );
}

/**
 * Obtiene resumen por cliente con filtros
 */
export async function getCustomerSummary(filters?: any): Promise<Array<{
    customer: string;
    device_count: number;
}>> {
    const { whereClause, params } = buildWhereClause(filters);

    return query(
        `WITH split_customers AS (
            SELECT 
                trim(c)::VARCHAR(100) as customer
            FROM ${SCHEMA}.devices, 
                 unnest(string_to_array(target_customer, ',')) AS c 
            ${whereClause}
        )
        SELECT 
            customer,
            COUNT(*) as device_count
        FROM split_customers
        WHERE customer != ''
        GROUP BY customer
        ORDER BY device_count DESC`,
        params
    );
}

/**
 * Obtiene dispositivos con filtros
 */
export async function getDevices(filters?: {
    region?: string;
    customer?: string;
    status?: string;
    solution?: string;
    brand?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDir?: 'ASC' | 'DESC';
}): Promise<{ devices: Device[]; total: number }> {
    const { whereClause, params } = buildWhereClause(filters);

    // El offset y limit no los maneja buildWhereClause, los extraemos aparte
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${SCHEMA}.devices ${whereClause}`,
        params
    );

    // Dynamic sorting with safety
    const allowedSortFields = [
        'brand', 'device', 'device_type', 'project', 'model', 'build', 'tac',
        'target_region', 'target_customer', 'android_version', 'status', 'approved_date',
        'tester', 'contact', 'priority', 'updated_at', 'target_solution', 'comments',
        'dual_sim', 'volume_forecast', 'integration_requirement', 'initial_sw_schedule',
        'commercial_schedule', 'sw_freeze_date', 'initial_shipment_date', 'launch_date',
        'initial_selling_date', 'sample_shipped'
    ];
    // Default sort: newest first
    let orderBy = '"updated_at" DESC';

    if (filters?.sortBy && allowedSortFields.includes(filters.sortBy)) {
        const direction = filters.sortDir === 'DESC' ? 'DESC' : 'ASC';
        // Secondary sort by updated_at to ensure deterministic order during ties
        orderBy = `"${filters.sortBy}" ${direction}, "updated_at" DESC`;
    }

    if (process.env.NODE_ENV !== 'production' || !process.env.NODE_ENV) {
        console.log('📊 [API] Sorting devices by:', orderBy);
    }

    const devices = await query<Device>(
        `SELECT * FROM ${SCHEMA}.devices ${whereClause} 
     ORDER BY ${orderBy} 
     LIMIT ${limit} OFFSET ${offset}`,
        params
    );

    return {
        devices,
        total: parseInt(countResult[0].count, 10),
    };
}

/**
 * Obtiene opciones de filtros disponibles (cascada)
 */
export async function getFilterOptions(currentFilters?: any): Promise<{
    regions: string[];
    customers: string[];
    brands: string[];
    solutions: string[];
    statuses: string[];
}> {
    // Función helper para obtener la cláusula WHERE parcial (excluyendo el campo que estamos calculando)
    const getPartialWhere = (excludeField: string) => {
        const filters = { ...currentFilters };
        delete filters[excludeField];
        const { whereClause, params } = buildWhereClause(filters);
        return { whereClause, params };
    };

    // Función helper para obtener valores únicos splitteados por varios delimitadores y normalizados
    const getDistinctSplitValues = async (column: string, fieldName: string) => {
        const { whereClause, params } = getPartialWhere(fieldName);

        const rows = await query<{ value: string }>(
            `WITH filtered_devices AS (
                SELECT * FROM ${SCHEMA}.devices ${whereClause}
            ),
            raw_values AS (
                SELECT DISTINCT trim(val) as val
                FROM filtered_devices,
                     regexp_split_to_table(${column}, ',| and |&|/|\\n') as val
                WHERE ${column} IS NOT NULL
            ),
            normalized_values AS (
                SELECT 
                    CASE 
                        WHEN lower(val) = 'bhamas' OR lower(val) = 'bhahamas' THEN 'Bahamas'
                        WHEN lower(val) = 'peru' THEN 'Peru'
                        WHEN lower(val) = 'colomiba' THEN 'Colombia'
                        WHEN lower(val) = 'mexico' OR lower(val) = 'mxico' THEN 'Mexico'
                        WHEN lower(val) = 'om' THEN 'Latam Om'
                        WHEN lower(val) = 'latam' THEN 'Latam Om'
                        WHEN val = upper(val) AND length(val) > 2 THEN initcap(val)
                        ELSE trim(val)
                    END as value
                FROM raw_values
                WHERE val != ''
            )
            SELECT DISTINCT value FROM normalized_values WHERE value != '' ORDER BY value`,
            params
        );
        return rows.map(r => r.value);
    };

    const [regions, customers, brands, solutions, statuses] = await Promise.all([
        getDistinctSplitValues('target_region', 'region'),
        getDistinctSplitValues('target_customer', 'customer'),
        (async () => {
            const { whereClause, params } = getPartialWhere('brand');
            const rows = await query<{ value: string }>(
                `SELECT DISTINCT brand as value FROM ${SCHEMA}.devices 
                 ${whereClause}
                 ${whereClause ? 'AND' : 'WHERE'} brand IS NOT NULL AND brand != '' ORDER BY value`,
                params
            );
            return rows.map(r => r.value);
        })(),
        (async () => {
            const { whereClause, params } = getPartialWhere('solution');
            const rows = await query<{ value: string }>(
                `WITH filtered_devices AS (
                    SELECT * FROM ${SCHEMA}.devices ${whereClause}
                ),
                raw_sol AS (
                    SELECT DISTINCT trim(val) as val
                    FROM filtered_devices,
                         regexp_split_to_table(target_solution, ',|&|/') as val
                    WHERE target_solution IS NOT NULL
                )
                SELECT DISTINCT 
                    TRIM(REPLACE(REPLACE(val, '1.o', '1.0'), '1.O', '1.0')) as value 
                FROM raw_sol WHERE val != '' ORDER BY value`,
                params
            );
            return rows.map(r => r.value);
        })(),
        (async () => {
            const { whereClause, params } = getPartialWhere('status');
            const rows = await query<{ value: string }>(
                `SELECT DISTINCT status as value FROM ${SCHEMA}.devices 
                 ${whereClause}
                 ${whereClause ? 'AND' : 'WHERE'} status IS NOT NULL ORDER BY value`,
                params
            );
            return rows.map(r => r.value);
        })(),
    ]);

    return {
        regions,
        customers,
        brands,
        solutions,
        statuses,
    };
}

/**
 * Obtiene items de inventario con paginación y filtros
 */
export async function getInventoryItems(
    limit = 100,
    offset = 0,
    filters?: {
        brand?: string;
        customer?: string;
        received_on?: string;
        search?: string;
    }
): Promise<{ items: InventoryItem[]; total: number }> {
    const { whereClause, params } = buildInventoryWhereClause(filters);

    if (process.env.NODE_ENV !== 'production' || true) {
        console.log('[DEBUG] Inventory Query:', { whereClause, params, filters });
    }

    const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${SCHEMA}.inventory ${whereClause}`,
        params
    );

    const items = await query<InventoryItem>(
        `SELECT * FROM ${SCHEMA}.inventory 
     ${whereClause}
     ORDER BY created_at DESC 
     LIMIT ${limit} OFFSET ${offset}`,
        params
    );

    return {
        items,
        total: parseInt(countResult[0].count, 10),
    };
}

/**
 * Obtiene opciones de filtro específicas del inventario
 */
export async function getInventoryFilterOptions(): Promise<{
    brands: string[];
    customers: string[];
}> {
    const brandsResult = await query<{ brand: string }>(
        `SELECT DISTINCT brand FROM ${SCHEMA}.inventory WHERE brand IS NOT NULL ORDER BY brand`
    );

    const customersResult = await query<{ target_customer: string }>(
        `SELECT DISTINCT target_customer FROM ${SCHEMA}.inventory WHERE target_customer IS NOT NULL ORDER BY target_customer`
    );

    return {
        brands: brandsResult.map(r => r.brand),
        customers: customersResult.map(r => r.target_customer),
    };
}

/**
 * Elimina toda la información de las tablas principales
 */
export async function clearAllData(): Promise<void> {
    await transaction(async (client) => {
        await client.query(`DELETE FROM ${SCHEMA}.automation_logs`);
        await client.query(`DELETE FROM ${SCHEMA}.devices`);
        await client.query(`DELETE FROM ${SCHEMA}.inventory`);
        await client.query(`DELETE FROM ${SCHEMA}.monthly_tracking`);
        await client.query(`DELETE FROM ${SCHEMA}.processed_files`);
    });
}

/**
 * Elimina dispositivos por ID
 */
export async function deleteDevices(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
        await query(`DELETE FROM ${SCHEMA}.devices WHERE id = ANY($1::uuid[])`, [ids]);
    } catch (error) {
        console.error('Error in deleteDevices:', error);
        throw error;
    }
}

/**
 * Elimina ítems de inventario por ID
 */
export async function deleteInventoryItems(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
        await query(`DELETE FROM ${SCHEMA}.inventory WHERE id = ANY($1::uuid[])`, [ids]);
    } catch (error) {
        console.error('Error in deleteInventoryItems:', error);
        throw error;
    }
}

/**
 * Obtiene datos de seguimiento mensual para los gráficos
 */
export async function getMonthlyTracking(filters?: {
    customer?: string;
    country?: string;
    solution?: string;
    year?: string;
}): Promise<MonthlyTrack[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters?.customer) {
        conditions.push(`customer = $${pIdx++}`);
        params.push(filters.customer);
    }
    if (filters?.country) {
        conditions.push(`country = $${pIdx++}`);
        params.push(filters.country);
    }
    if (filters?.solution) {
        conditions.push(`solution = $${pIdx++}`);
        params.push(filters.solution);
    }
    if (filters?.year) {
        conditions.push(`EXTRACT(YEAR FROM record_date) = $${pIdx++}`);
        params.push(filters.year);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return query<MonthlyTrack>(
        `SELECT * FROM ${SCHEMA}.monthly_tracking ${where} ORDER BY record_date ASC`,
        params
    );
}

/**
 * Obtiene lista de opciones únicas para el seguimiento de clientes
 */
export async function getCustomerTrackingOptions(filters?: {
    customer?: string;
    country?: string;
    solution?: string;
    year?: string;
}): Promise<{
    customers: string[];
    countries: string[];
    solutions: string[];
    years: string[];
}> {
    const buildQuery = (column: string) => {
        const localParams: any[] = [];
        let localPIdx = 1;

        const whereClauses: string[] = [];
        whereClauses.push(`${column === 'year' ? 'record_date' : column} IS NOT NULL`);

        // Solo agregamos filtros si tienen valor y no son para la columna que estamos consultando
        if (filters?.customer && filters.customer !== '' && column !== 'customer') {
            whereClauses.push(`customer = $${localPIdx++}`);
            localParams.push(filters.customer);
        }
        if (filters?.country && filters.country !== '' && column !== 'country') {
            whereClauses.push(`country = $${localPIdx++}`);
            localParams.push(filters.country);
        }
        if (filters?.solution && filters.solution !== '' && column !== 'solution') {
            whereClauses.push(`solution = $${localPIdx++}`);
            localParams.push(filters.solution);
        }
        if (filters?.year && filters.year !== '' && column !== 'year') {
            whereClauses.push(`EXTRACT(YEAR FROM record_date)::text = $${localPIdx++}`);
            localParams.push(filters.year);
        }

        const where = `WHERE ${whereClauses.join(' AND ')}`;
        const selectCol = column === 'year' ? 'DISTINCT EXTRACT(YEAR FROM record_date)::text as val' : `DISTINCT ${column} as val`;
        const orderCol = column === 'year' ? 'val DESC' : 'val';

        return {
            sql: `SELECT ${selectCol} FROM ${SCHEMA}.monthly_tracking ${where} ORDER BY ${orderCol}`,
            params: localParams
        };
    };

    try {
        const qCustomers = buildQuery('customer');
        const qCountries = buildQuery('country');
        const qSolutions = buildQuery('solution');
        const qYears = buildQuery('year');

        const [customers, countries, solutions, years] = await Promise.all([
            query<{ val: string }>(qCustomers.sql, qCustomers.params),
            query<{ val: string }>(qCountries.sql, qCountries.params),
            query<{ val: string }>(qSolutions.sql, qSolutions.params),
            query<{ val: string }>(qYears.sql, qYears.params)
        ]);

        return {
            customers: customers.map(r => r.val).filter(v => v),
            countries: countries.map(r => r.val).filter(v => v),
            solutions: solutions.map(r => r.val).filter(v => v),
            years: years.map(r => r.val).filter(v => v)
        };
    } catch (error) {
        console.error('Error in getCustomerTrackingOptions:', error);
        // Retornar listas vacías si falla pero no tirar la app
        return { customers: [], countries: [], solutions: [], years: [] };
    }
}
