import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

/**
 * Inicializa el servidor de WebSockets
 */
export function initSocket(server: HttpServer) {
    io = new SocketIOServer(server, {
        cors: {
            origin: '*', // En producción centralizar esto
            methods: ['GET', 'POST', 'DELETE']
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Cliente conectado: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`🔌 Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
}

/**
 * Notifica a todos los clientes que los datos han cambiado
 */
export function notifyDataChange(type: 'devices' | 'inventory' | 'all' | 'file_processed') {
    if (!io) return;

    console.log(`📢 Emitiendo notificación: ${type}`);
    io.emit('data_updated', { type, timestamp: new Date().toISOString() });
}
