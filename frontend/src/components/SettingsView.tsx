import { useState, useEffect } from 'react';
import api from '../services/api';
import type { SystemConfig } from '../services/api';
import { FolderPicker } from './FolderPicker';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { type Language } from '../i18n/translations';

export function SettingsView() {
    const { showNotification, confirm } = useNotification();
    const { t, language, setLanguage } = useLanguage();
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [newPath, setNewPath] = useState('');
    const [newPort, setNewPort] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isPickerOpen, setIsPickerOpen] = useState(false);


    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        setLoading(true);
        try {
            const data = await api.getConfig();
            setConfig(data);
            setNewPath(data.watch_folder);

            // Usar el puerto de localStorage si existe, si no el del config
            const savedPort = localStorage.getItem('trustonic_api_port') || data.port.toString();
            setNewPort(savedPort);
        } catch (error) {
            console.error('Error loading config:', error);
            showNotification({ type: 'error', title: t('error_title'), message: t('loading_data') });
        } finally {
            setLoading(false);
        }
    }

    async function handleSavePath() {
        if (!newPath) return;

        setSaving(true);
        try {
            const result = await api.updateWatchFolder(newPath);
            if (result.success) {
                showNotification({ type: 'success', title: 'Configuración Actualizada', message: result.message });
                if (result.new_path) {
                    setNewPath(result.new_path);
                    if (config) setConfig({ ...config, watch_folder: result.new_path });
                }
            }
        } catch (error) {
            console.error('Error saving path:', error);
            showNotification({ type: 'error', title: t('error_title'), message: t('update_folder_error_message') });
        } finally {
            setSaving(false);
        }
    }

    async function handleSavePort() {
        if (!newPort) return;

        setSaving(true);
        try {
            // 1. Guardar en localStorage para que el Front sepa a dónde hablar
            localStorage.setItem('trustonic_api_port', newPort);

            // 2. Intentar avisar al Backend para que actualice su .env (opcional)
            await api.updateBackendPort(newPort);

            showNotification({
                type: 'success',
                title: 'Puerto Actualizado',
                message: `Puerto actualizado a ${newPort}. La página se recargará...`,
                duration: 2000
            });

            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Error saving port:', error);
            showNotification({ type: 'error', title: 'Error de Puerto', message: 'Se guardó localmente, pero no se pudo actualizar el backend.' });
        } finally {
            setSaving(false);
        }
    }

    async function handleClearData() {
        const confirmed = await confirm(
            t('confirm_clear_title'),
            t('confirm_clear_message')
        );

        if (!confirmed) return;

        setSaving(true);
        try {
            const result = await api.clearAllData();
            if (result.success) {
                showNotification({ type: 'success', title: 'Datos Eliminados', message: result.message });
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            showNotification({ type: 'error', title: 'Error', message: 'No se pudo borrar la información.' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="card">
                <div className="card-body" style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p>{t('loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">{t('system_settings')}</h3>
            </div>

            <div className="card-body">
                <div style={{ maxWidth: '600px' }}>

                    {/* Language Settings */}
                    <div className="filter-group" style={{ marginBottom: '32px', width: '100%', alignItems: 'flex-start' }}>
                        <label className="filter-label" style={{ marginBottom: '8px' }}>
                            {t('language')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <select
                                className="filter-select"
                                style={{ width: '200px', padding: '10px 14px' }}
                                value={language}
                                onChange={(e) => setLanguage(e.target.value as Language)}
                            >
                                <option value="es">{t('spanish')}</option>
                                <option value="en">{t('english')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Port Configuration */}
                    <div className="filter-group" style={{ marginBottom: '32px', width: '100%', alignItems: 'flex-start' }}>
                        <label className="filter-label" style={{ marginBottom: '8px' }}>
                            {t('api_port')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <input
                                type="number"
                                className="filter-select"
                                style={{ width: '120px', padding: '10px 14px' }}
                                value={newPort}
                                onChange={(e) => setNewPort(e.target.value)}
                                placeholder="3001"
                            />
                            <button
                                className="btn btn-primary"
                                onClick={handleSavePort}
                                disabled={saving || !newPort}
                            >
                                {t('update_connection')}
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                            {t('port_desc')}
                        </p>
                    </div>

                    {/* Folder Configuration */}
                    <div className="filter-group" style={{ marginBottom: '24px', width: '100%', alignItems: 'flex-start' }}>
                        <label className="filter-label" style={{ marginBottom: '8px' }}>
                            {t('watch_folder')}
                        </label>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <input
                                    type="text"
                                    className="filter-select"
                                    style={{ width: '100%', padding: '10px 14px', backgroundColor: '#f9fafb', cursor: 'pointer' }}
                                    value={newPath}
                                    readOnly
                                    onClick={() => setIsPickerOpen(true)}
                                    placeholder={t('select_folder') + '...'}
                                />
                            </div>
                            <button
                                className="btn"
                                onClick={() => setIsPickerOpen(true)}
                            >
                                📁 {t('select_folder')}
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSavePath}
                                disabled={saving || !newPath || newPath === config?.watch_folder}
                            >
                                {saving ? t('saving') : t('save_folder')}
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                            {t('folder_desc')}
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '24px', marginTop: '24px' }}>
                        <h4 style={{ marginBottom: '16px', fontSize: '14px', color: '#374151' }}>{t('connection_status')}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="kpi-card" style={{ padding: '16px' }}>
                                <div className="kpi-label">{t('active_port')}</div>
                                <div className="kpi-value" style={{ fontSize: '18px' }}>{localStorage.getItem('trustonic_api_port') || '3001'}</div>
                            </div>
                            <div className="kpi-card" style={{ padding: '16px' }}>
                                <div className="kpi-label">{t('db_status')}</div>
                                <div className="kpi-value" style={{ fontSize: '18px', color: config ? '#10b981' : '#ef4444' }}>
                                    {config ? t('connected') : t('disconnected')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div style={{ borderTop: '1px solid #fee2e2', paddingTop: '24px', marginTop: '48px' }}>
                        <h4 style={{ marginBottom: '8px', fontSize: '16px', color: '#dc2626', fontWeight: 600 }}>{t('danger_zone')}</h4>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                            {t('danger_desc')}
                        </p>
                        <button
                            className="btn"
                            style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', fontSize: '13px', padding: '10px 16px' }}
                            onClick={handleClearData}
                            disabled={saving}
                        >
                            🗑️ {t('clear_all_data')}
                        </button>
                    </div>
                </div>
            </div>

            <FolderPicker
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                initialPath={newPath}
                onSelect={(path) => {
                    setNewPath(path);
                    setIsPickerOpen(false);
                }}
            />
        </div>
    );
}
