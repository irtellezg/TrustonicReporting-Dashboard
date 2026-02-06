# Trustonic Reporting System

Sistema de reporte y monitoreo de validación de dispositivos para Trustonic. El sistema permite la ingesta automatizada de datos desde archivos Excel, almacenamiento en PostgreSQL y visualización mediante un dashboard interactivo.

## Estructura del Proyecto

- `backend/`: Servidor Node.js (TypeScript) con Express. Se encarga del procesamiento ETL, monitoreo de archivos y API.
- `frontend/`: Aplicación React (Vite/TypeScript) con Tailwind CSS para el Dashboard.
- `database/`: Scripts SQL para la inicialización y mantenimiento de la base de datos.
- `.agent/`: Flujos de trabajo y habilidades de IA para el asistente Antigravity.

## Requisitos Previos

- Node.js (v18+)
- PostgreSQL (v15+)
- Archivos Excel de planificación de dispositivos (.xlsx)

## Configuración

1.  **Variables de Entorno**: Copia `.env.example` a `.env` en la raíz y en `backend/` y configura tus credenciales de base de datos.
2.  **Base de Datos**: Ejecuta los scripts en `database/` para crear el esquema y las tablas necesarias.
3.  **Instalación**:
    ```bash
    npm run install:all
    ```

## Ejecución

Para iniciar tanto el frontend como el backend simultáneamente:
```bash
npm start
```

## Funcionalidades Principales

- **Monitoreo Automático**: Detecta cambios en archivos Excel en tiempo real y actualiza la base de datos.
- **Buscador Global**: Búsqueda rápida de dispositivos con sugerencias inteligentes.
- **Visualización de Inventario**: Gestión detallada de dispositivos recibidos y en stock.
- **Exportación**: Generación de reportes PDF de alta calidad.
