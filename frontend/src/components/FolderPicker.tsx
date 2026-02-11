/**
 * TrustonicReporting - Folder Picker Component
 */
import { useState, useEffect } from 'react';
import { api, type DirectoryListing } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface FolderPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    initialPath?: string;
}

export function FolderPicker({ isOpen, onClose, onSelect, initialPath }: FolderPickerProps) {
    const { t } = useLanguage();
    const [listing, setListing] = useState<DirectoryListing | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState(initialPath || 'C:\\');

    useEffect(() => {
        if (isOpen) {
            const path = initialPath || 'C:\\';
            setCurrentPath(path);
            loadPath(path);
        }
    }, [isOpen]);

    const loadPath = async (path: string) => {
        setLoading(true);
        setError(null);
        setCurrentPath(path);
        try {
            const data = await api.listDirectories(path);
            setListing(data);
            setCurrentPath(data.currentPath);
        } catch (err) {
            console.error('Error loading path:', err);
            setError(t('folder_access_error', { path }));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="card" style={{ width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="card-title">{t('select_folder_title')}</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                </div>

                <div className="card-body" style={{ overflowY: 'auto', padding: '16px' }}>
                    <div style={{ marginBottom: '16px', fontSize: '14px', color: '#6b7280', wordBreak: 'break-all' }}>
                        {t('current_path')}: <strong>{currentPath}</strong>
                    </div>

                    {loading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '20px' }}>
                            <div style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</div>
                            <button className="btn" onClick={() => loadPath('C:\\')}>
                                {t('back_to_root')}
                            </button>
                        </div>
                    ) : (
                        <div className="folder-list">
                            {listing?.parentPath && (
                                <div
                                    className="nav-item"
                                    style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px', backgroundColor: '#f3f4f6' }}
                                    onClick={() => loadPath(listing.parentPath!)}
                                >
                                    📁 .. ({t('parent_folder')})
                                </div>
                            )}
                            {listing?.directories.map((dir: { name: string, path: string }) => (
                                <div
                                    key={dir.path}
                                    className="nav-item"
                                    style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px' }}
                                    onClick={() => loadPath(dir.path)}
                                >
                                    📁 {dir.name}
                                </div>
                            ))}
                            {listing?.directories.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                                    {t('no_subfolders')}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="card-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn" onClick={onClose}>{t('cancel')}</button>
                    <button
                        className="btn btn-primary"
                        disabled={!listing}
                        onClick={() => listing && onSelect(listing.currentPath)}
                    >
                        {t('select_this_folder')}
                    </button>
                </div>
            </div>
        </div>
    );
}
