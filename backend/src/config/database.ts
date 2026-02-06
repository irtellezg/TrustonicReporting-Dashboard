/**
 * TrustonicReporting - Database Configuration
 */
import { Pool, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'trustonic_reporting',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);

// Manejo de errores de conexión
pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Ejecuta una consulta SQL
 */
export async function query<T = unknown>(
    text: string,
    params?: unknown[]
): Promise<T[]> {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result.rows as T[];
    } finally {
        client.release();
    }
}

/**
 * Ejecuta una transacción
 */
export async function transaction<T>(
    callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Verifica la conexión a la base de datos
 */
export async function testConnection(): Promise<boolean> {
    try {
        const result = await query<{ now: Date }>('SELECT NOW()');
        console.log('✅ Conexión a PostgreSQL exitosa:', result[0].now);
        return true;
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error);
        return false;
    }
}

export const SCHEMA = process.env.DB_SCHEMA || 'reporting';
