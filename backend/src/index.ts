/**
 * TrustonicReporting - Backend Entry Point
 * 
 * Inicia el servidor API y el watcher de archivos.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createApp } from './routes/api';
import { startWatcher } from './services/fileWatcher';
import { testConnection } from './config/database';
import { createServer } from 'http';
import { initSocket, notifyDataChange } from './services/socketService';

const PORT = process.env.PORT || 3001;
const WATCH_FOLDER = process.env.WATCH_FOLDER || path.resolve(__dirname, '../../data');

async function main() {
    console.log('🚀 TrustonicReporting Backend');
    console.log('================================');

    // Verificar conexión a BD
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.error('❌ No se pudo conectar a la base de datos. Verifica la configuración en .env');
        process.exit(1);
    }

    // Iniciar servidor API
    const app = createApp();
    const server = createServer(app);

    // Inicializar Sockets
    initSocket(server);

    server.listen(PORT, () => {
        console.log(`🌐 API Server corriendo en: http://localhost:${PORT}`);
        console.log(`📡 WebSocket listo para notificaciones en tiempo real`);
    });

    // Iniciar watcher de archivos
    console.log(`📂 Carpeta de monitoreo: ${WATCH_FOLDER}`);

    const watcher = startWatcher({
        watchPath: WATCH_FOLDER,
        onFileProcessed: (result) => {
            console.log('📊 Resultado ETL:', {
                dispositivos: `${result.devicesInserted} nuevos, ${result.devicesUpdated} actualizados`,
                inventario: `${result.inventoryInserted} items`,
                tiempo: `${result.durationMs}ms`,
            });
            // Notificar cambio a los clientes
            notifyDataChange('file_processed');
        },
        onError: (error, filePath) => {
            console.error(`❌ Error procesando ${path.basename(filePath)}:`, error.message);
        },
    });

    // Manejo de cierre graceful
    process.on('SIGINT', async () => {
        console.log('\n👋 Cerrando aplicación...');
        await watcher.close();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n👋 Cerrando aplicación...');
        await watcher.close();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
});
