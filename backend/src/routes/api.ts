/**
 * TrustonicReporting - API Server
 * 
 * API REST para el dashboard web.
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as path from 'path';
import { testConnection } from '../config/database';
import {
    getDashboardKPIs,
    getStatusSummary,
    getRegionSummary,
    getSolutionSummary,
    getBrandSummary,
    getCustomerSummary,
    getDevices,
    getFilterOptions,
    getInventoryItems,
    getMonthlyTracking,
    getCustomerTrackingOptions,
    clearAllData,
    deleteDevices,
    deleteInventoryItems,
} from '../services/databaseLoader';
import { processFile, processAllFiles, restartWatcher } from '../services/fileWatcher';
import * as fs from 'fs/promises';
import { notifyDataChange } from '../services/socketService';

const router = express.Router();

// Middleware de error handling
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Health check
router.get('/health', asyncHandler(async (req, res) => {
    const dbConnected = await testConnection();
    res.json({
        status: dbConnected ? 'healthy' : 'unhealthy',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
    });
}));

// Helper para extraer filtros comunes
const getCommonFilters = (req: Request) => ({
    region: req.query.region as string | undefined,
    customer: req.query.customer as string | undefined,
    status: req.query.status as string | undefined,
    solution: req.query.solution as string | undefined,
    brand: req.query.brand as string | undefined,
    search: req.query.search as string | undefined,
});

// Dashboard KPIs
router.get('/dashboard/kpis', asyncHandler(async (req, res) => {
    const kpis = await getDashboardKPIs(getCommonFilters(req));
    res.json(kpis);
}));

// Status summary
router.get('/dashboard/status', asyncHandler(async (req, res) => {
    const summary = await getStatusSummary(getCommonFilters(req));
    res.json(summary);
}));

// Region summary
router.get('/dashboard/regions', asyncHandler(async (req, res) => {
    const summary = await getRegionSummary(getCommonFilters(req));
    res.json(summary);
}));

// Solution summary
router.get('/dashboard/solutions', asyncHandler(async (req, res) => {
    const summary = await getSolutionSummary(getCommonFilters(req));
    res.json(summary);
}));

// Brand summary
router.get('/dashboard/brands', asyncHandler(async (req, res) => {
    const summary = await getBrandSummary(getCommonFilters(req));
    res.json(summary);
}));

// Customer summary
router.get('/dashboard/customers', asyncHandler(async (req, res) => {
    const summary = await getCustomerSummary(getCommonFilters(req));
    res.json(summary);
}));

// Get devices with filters
router.get('/devices', asyncHandler(async (req, res) => {
    const filters = {
        region: req.query.region as string | undefined,
        customer: req.query.customer as string | undefined,
        status: req.query.status as string | undefined,
        solution: req.query.solution as string | undefined,
        brand: req.query.brand as string | undefined,
        search: req.query.search as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
        sortBy: req.query.sortBy as string | undefined,
        sortDir: req.query.sortDir as 'ASC' | 'DESC' | undefined,
    };

    const result = await getDevices(filters);
    res.json(result);
}));

// Get filter options
router.get('/filters', asyncHandler(async (req, res) => {
    const options = await getFilterOptions(getCommonFilters(req));
    res.json(options);
}));

// Process a specific file
router.post('/process/file', asyncHandler(async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
        res.status(400).json({ error: 'filePath is required' });
        return;
    }

    const result = await processFile(filePath);
    notifyDataChange('file_processed');
    res.json(result);
}));

// Process all files in a folder
router.post('/process/folder', asyncHandler(async (req, res) => {
    const { folderPath } = req.body;

    if (!folderPath) {
        res.status(400).json({ error: 'folderPath is required' });
        return;
    }

    const results = await processAllFiles(folderPath);
    notifyDataChange('all');
    res.json({
        processed: results.length,
        results,
    });
}));

// Get current config
router.get('/config', (req, res) => {
    res.json({
        watch_folder: process.env.WATCH_FOLDER || './data',
        port: process.env.PORT || 3001,
        database_status: 'connected'
    });
});

// Update watch folder
router.post('/config/watch-folder', asyncHandler(async (req, res) => {
    const { folderPath } = req.body;

    if (!folderPath) {
        res.status(400).json({ error: 'folderPath is required' });
        return;
    }

    try {
        // 1. Reiniciar watcher en memoria
        await restartWatcher(folderPath);

        // 2. Intentar actualizar .env para persistencia
        const envPath = path.resolve(__dirname, '../../../.env');
        try {
            let envContent = await fs.readFile(envPath, 'utf8');
            if (envContent.includes('WATCH_FOLDER=')) {
                envContent = envContent.replace(/WATCH_FOLDER=.*/, `WATCH_FOLDER=${folderPath}`);
            } else {
                envContent += `\nWATCH_FOLDER=${folderPath}`;
            }
            await fs.writeFile(envPath, envContent);
        } catch (e) {
            console.warn('No se pudo escribir en .env, el cambio no persistirá tras reinicio profundo');
        }

        // 3. Actualizar variable en proceso actual
        process.env.WATCH_FOLDER = folderPath;

        res.json({
            success: true,
            message: 'Carpeta de monitoreo actualizada correctamente',
            new_path: folderPath
        });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Error al actualizar la configuración' });
    }
}));


// List directories for folder picker
router.get('/config/list-directories', asyncHandler(async (req, res) => {
    const queryPath = (req.query.path as string) || 'C:\\';

    try {
        const absolutePath = path.isAbsolute(queryPath) ? queryPath : path.resolve(queryPath);
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });

        const directories = entries
            .filter(entry => entry.isDirectory())
            .map(entry => ({
                name: entry.name,
                path: path.join(absolutePath, entry.name)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const parentPath = path.dirname(absolutePath);

        res.json({
            currentPath: absolutePath,
            parentPath: parentPath !== absolutePath ? parentPath : null,
            directories
        });
    } catch (error) {
        console.error('Error listing directories:', error);
        res.status(500).json({ error: 'No se pudo acceder a la ruta especificada' });
    }
}));

// Get inventory
router.get('/inventory', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const filters = {
        brand: req.query.brand as string | undefined,
        customer: req.query.customer as string | undefined,
        received_on: req.query.received_on as string | undefined,
        search: req.query.search as string | undefined,
    };

    const result = await getInventoryItems(limit, offset, filters);
    res.json(result);
}));

// Get inventory filter options (only brands/customers that exist in inventory)
router.get('/inventory/filters', asyncHandler(async (req, res) => {
    const { getInventoryFilterOptions } = await import('../services/databaseLoader');
    const options = await getInventoryFilterOptions();
    res.json(options);
}));

// Update API Port (Server side .env update)
router.post('/config/port', asyncHandler(async (req, res) => {
    const { port } = req.body;

    if (!port || isNaN(parseInt(port))) {
        res.status(400).json({ error: 'Valid port is required' });
        return;
    }

    try {
        const envPath = path.resolve(__dirname, '../../../.env');
        let envContent = await fs.readFile(envPath, 'utf8');

        if (envContent.includes('PORT=')) {
            envContent = envContent.replace(/PORT=.*/, `PORT=${port}`);
        } else {
            envContent += `\nPORT=${port}`;
        }
        await fs.writeFile(envPath, envContent);

        res.json({
            success: true,
            message: 'Puerto actualizado en .env. El cambio se aplicará en el próximo reinicio manual del backend.',
            new_port: port
        });
    } catch (error) {
        console.error('Error updating port:', error);
        res.status(500).json({ error: 'Error al actualizar el puerto' });
    }
}));

// Delete all data
router.delete('/data/all', asyncHandler(async (req, res) => {
    await clearAllData();
    notifyDataChange('all');
    res.json({ success: true, message: 'Toda la información ha sido eliminada' });
}));

// Delete selected devices
router.delete('/devices', asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        res.status(400).json({ error: 'IDs array is required' });
        return;
    }
    try {
        await deleteDevices(ids);
        notifyDataChange('devices');
        res.json({ success: true, message: `${ids.length} dispositivos eliminados` });
    } catch (error) {
        console.error('API Error deleting devices:', error);
        res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
}));

// Delete selected inventory items
router.delete('/inventory', asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
        res.status(400).json({ error: 'IDs array is required' });
        return;
    }
    try {
        await deleteInventoryItems(ids);
        notifyDataChange('inventory');
        res.json({ success: true, message: `${ids.length} ítems de inventario eliminados` });
    } catch (error) {
        console.error('API Error deleting inventory:', error);
        res.status(500).json({ error: 'Internal Server Error', message: (error as Error).message });
    }
}));

// Get customer tracking data
router.get('/tracking', asyncHandler(async (req, res) => {
    const filters = {
        customer: req.query.customer as string | undefined,
        country: req.query.country as string | undefined,
        solution: req.query.solution as string | undefined,
        year: req.query.year as string | undefined,
    };

    const data = await getMonthlyTracking(filters);
    res.json(data);
}));

// Get tracking filter options
router.get('/tracking/options', asyncHandler(async (req, res) => {
    const filters = {
        customer: req.query.customer as string | undefined,
        country: req.query.country as string | undefined,
        solution: req.query.solution as string | undefined,
        year: req.query.year as string | undefined,
    };
    const options = await getCustomerTrackingOptions(filters);
    res.json(options);
}));

export default router;

/**
 * Crea y configura la aplicación Express
 */
export function createApp() {
    const app = express();

    // Middlewares
    app.use(cors());
    app.use(express.json());

    // Ruta raíz
    app.get('/', (req, res) => {
        res.json({
            service: 'TrustonicReporting Backend',
            status: 'running',
            endpoints: {
                health: '/api/health',
                dashboard: '/api/dashboard/kpis',
                devices: '/api/devices',
                documentation: '/api/docs'
            }
        });
    });

    // API routes
    app.use('/api', router);

    // Error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('API Error:', err);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
        });
    });

    return app;
}
