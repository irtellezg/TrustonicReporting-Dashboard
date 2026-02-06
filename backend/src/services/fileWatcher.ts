/**
 * TrustonicReporting - File Watcher Service
 * 
 * Monitorea una carpeta local para detectar archivos Excel nuevos o modificados.
 */
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { parseExcelFile, getFileInfo } from './excelParser';
import {
    registerProcessedFile,
    updateFileStatus,
    isFileAlreadyProcessed,
    loadDevices,
    loadInventory,
    logAutomation
} from './databaseLoader';
import { ETLResult } from '../types';

let currentWatcher: chokidar.FSWatcher | null = null;
let currentOptions: WatcherOptions | null = null;

// Extensiones de archivo válidas
const VALID_EXTENSIONS = ['.xlsx', '.xls'];

// Delay para asegurar que el archivo terminó de escribirse
const FILE_STABILITY_DELAY_MS = 2000;

export interface WatcherOptions {
    watchPath: string;
    onFileProcessed?: (result: ETLResult) => void;
    onError?: (error: Error, filePath: string) => void;
}

/**
 * Inicia el monitoreo de una carpeta
 */
export function startWatcher(options: WatcherOptions): chokidar.FSWatcher {
    const { watchPath, onFileProcessed, onError } = options;

    // Si ya hay un watcher, lo cerramos primero
    if (currentWatcher) {
        currentWatcher.close();
    }

    currentOptions = options;
    console.log(`📂 Iniciando monitoreo de: ${watchPath} (Modo Solo Lectura)`);

    const watcher = chokidar.watch(watchPath, {
        ignored: [
            /(^|[\/\\])\../, // Ignorar archivos ocultos
            /~\$.*/          // Ignorar archivos temporales de Excel
        ],
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
            stabilityThreshold: FILE_STABILITY_DELAY_MS,
            pollInterval: 500,
        },
    });

    watcher
        .on('add', async (filePath) => {
            if (isValidExcelFile(filePath)) {
                console.log(`📄 Archivo detectado: ${path.basename(filePath)}`);
                try {
                    const result = await processFile(filePath);
                    onFileProcessed?.(result);
                } catch (error) {
                    console.error(`❌ Error procesando: ${filePath}`, error);
                    onError?.(error as Error, filePath);
                }
            }
        })
        .on('change', async (filePath) => {
            if (isValidExcelFile(filePath)) {
                console.log(`🔄 Archivo modificado: ${path.basename(filePath)}`);
                try {
                    const result = await processFile(filePath);
                    onFileProcessed?.(result);
                } catch (error) {
                    console.error(`❌ Error procesando cambio: ${filePath}`, error);
                    onError?.(error as Error, filePath);
                }
            }
        })
        .on('error', (error) => {
            console.error('❌ Error en el watcher:', error);
        })
        .on('ready', () => {
            console.log('✅ Watcher listo y escuchando cambios');
        });

    currentWatcher = watcher;
    return watcher;
}

/**
 * Reinicia el watcher con una nueva ruta
 */
export async function restartWatcher(newPath: string): Promise<void> {
    if (!currentOptions) {
        throw new Error('Watcher no ha sido inicializado');
    }

    console.log(`🔄 Reiniciando watcher con nueva ruta: ${newPath}`);

    const newOptions: WatcherOptions = {
        ...currentOptions!,
        watchPath: newPath,
    };

    startWatcher(newOptions);
}

/**
 * Procesa un archivo Excel
 */
export async function processFile(filePath: string): Promise<ETLResult> {
    const startTime = Date.now();
    const errors: Array<{ sheet: string; row: number; message: string }> = [];

    console.log(`⚙️ Procesando: ${path.basename(filePath)}`);

    // Obtener información del archivo
    const fileInfo = await getFileInfo(filePath);

    // Verificar si ya fue procesado
    const alreadyProcessed = await isFileAlreadyProcessed(fileInfo.fileHash);
    if (alreadyProcessed) {
        console.log(`⏭️ Archivo sin cambios, omitiendo: ${fileInfo.fileName}`);
        return {
            success: true,
            devicesInserted: 0,
            devicesUpdated: 0,
            devicesSkipped: 0,
            inventoryInserted: 0,
            inventoryUpdated: 0,
            errors: [],
            durationMs: Date.now() - startTime,
        };
    }

    // Extraer marca del nombre del archivo (última palabra)
    // Ejemplo: "Device Planning Blu.xlsx" -> "Blu"
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const fileNameParts = fileNameWithoutExt.split(/[\s_-]+/); // Dividir por espacio, guion o underscore
    const extractedBrand = fileNameParts[fileNameParts.length - 1];

    console.log(`🏷️ Marca extraída del archivo: ${extractedBrand}`);

    // Parsear el archivo Excel, pasando la marca por defecto
    const parseResult = await parseExcelFile(filePath, extractedBrand);
    errors.push(...parseResult.errors);

    console.log(`📊 Parseado: ${parseResult.devices.length} dispositivos, ${parseResult.inventory.length} items inventory`);

    // Registrar archivo en BD
    const fileId = await registerProcessedFile({
        file_name: fileInfo.fileName,
        file_path: filePath,
        file_hash: fileInfo.fileHash,
        file_size: fileInfo.fileSize,
        sheet_count: parseResult.sheetCount,
        status: 'PROCESSING',
    });

    try {
        // Cargar dispositivos
        const deviceResult = await loadDevices(parseResult.devices, fileId);
        console.log(`💾 Dispositivos: ${deviceResult.inserted} insertados, ${deviceResult.updated} actualizados, ${deviceResult.skipped} omitidos`);

        // Registrar log de dispositivos
        await logAutomation({
            file_id: fileId,
            action: 'LOAD_DEVICES',
            table_name: 'devices',
            rows_inserted: deviceResult.inserted,
            rows_updated: deviceResult.updated,
            rows_skipped: deviceResult.skipped,
            errors: errors.filter(e => e.sheet !== 'Inventory'),
            duration_ms: Date.now() - startTime,
        });

        // Cargar inventario
        const inventoryResult = await loadInventory(parseResult.inventory, fileId);
        console.log(`📦 Inventario: ${inventoryResult.inserted} insertados`);

        // Registrar log de inventario
        await logAutomation({
            file_id: fileId,
            action: 'LOAD_INVENTORY',
            table_name: 'inventory',
            rows_inserted: inventoryResult.inserted,
            rows_updated: inventoryResult.updated,
            errors: errors.filter(e => e.sheet === 'Inventory'),
            duration_ms: Date.now() - startTime,
        });

        // Actualizar estado del archivo
        await updateFileStatus(fileId, 'COMPLETED', {
            devices: deviceResult.inserted + deviceResult.updated,
            inventory: inventoryResult.inserted,
        });

        const result: ETLResult = {
            success: true,
            devicesInserted: deviceResult.inserted,
            devicesUpdated: deviceResult.updated,
            devicesSkipped: deviceResult.skipped,
            inventoryInserted: inventoryResult.inserted,
            inventoryUpdated: inventoryResult.updated,
            errors,
            durationMs: Date.now() - startTime,
        };

        console.log(`✅ Procesamiento completado en ${result.durationMs}ms`);
        return result;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        await updateFileStatus(fileId, 'ERROR', undefined, errorMessage);

        await logAutomation({
            file_id: fileId,
            action: 'ERROR',
            errors: [{ sheet: 'N/A', row: 0, message: errorMessage }],
            duration_ms: Date.now() - startTime,
        });

        throw error;
    }
}

/**
 * Verifica si es un archivo Excel válido (ignora temporales y ocultos)
 */
function isValidExcelFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Ignorar si comienza con ~$ (temporales de Excel) o . (ocultos)
    if (fileName.startsWith('~$') || fileName.startsWith('.')) {
        return false;
    }

    return VALID_EXTENSIONS.includes(ext);
}


/**
 * Procesa manualmente todos los archivos en una carpeta
 */
export async function processAllFiles(folderPath: string): Promise<ETLResult[]> {
    const results: ETLResult[] = [];

    try {
        const files = await fs.readdir(folderPath);
        const excelFiles = files.filter(f => isValidExcelFile(f));

        console.log(`📂 Encontrados ${excelFiles.length} archivos Excel en ${folderPath}`);

        for (const file of excelFiles) {
            const filePath = path.join(folderPath, file);
            try {
                const result = await processFile(filePath);
                results.push(result);
            } catch (error) {
                console.error(`❌ Error procesando ${file}:`, error);
                results.push({
                    success: false,
                    devicesInserted: 0,
                    devicesUpdated: 0,
                    devicesSkipped: 0,
                    inventoryInserted: 0,
                    inventoryUpdated: 0,
                    errors: [{
                        sheet: 'N/A',
                        row: 0,
                        message: error instanceof Error ? error.message : 'Error desconocido'
                    }],
                    durationMs: 0,
                });
            }
        }
    } catch (error) {
        console.error(`❌ Error leyendo carpeta ${folderPath}:`, error);
    }

    return results;
}
