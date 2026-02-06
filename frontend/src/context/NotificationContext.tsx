import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
}

interface NotificationContextType {
    notifications: Notification[];
    showNotification: (notification: Omit<Notification, 'id'>) => void;
    hideNotification: (id: string) => void;
    confirm: (title: string, message: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [confirmData, setConfirmData] = useState<{
        resolve: (value: boolean) => void;
        title: string;
        message: string;
    } | null>(null);

    const hideNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = useCallback((data: Omit<Notification, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const duration = data.duration || 5000;

        setNotifications((prev) => [...prev, { ...data, id }]);

        if (duration > 0) {
            setTimeout(() => hideNotification(id), duration);
        }
    }, [hideNotification]);

    const confirm = useCallback((title: string, message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmData({ resolve, title, message });
        });
    }, []);

    const handleConfirmClose = (value: boolean) => {
        if (confirmData) {
            confirmData.resolve(value);
            setConfirmData(null);
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, showNotification, hideNotification, confirm }}>
            {children}

            {/* Notifications Host */}
            <div className="notifications-container">
                {notifications.map((n) => (
                    <div key={n.id} className={`notification-toast ${n.type} slide-in`}>
                        <div className="notification-icon">
                            {n.type === 'success' && '✅'}
                            {n.type === 'error' && '❌'}
                            {n.type === 'warning' && '⚠️'}
                            {n.type === 'info' && '💎'}
                        </div>
                        <div className="notification-content">
                            <div className="notification-title">{n.title}</div>
                            <div className="notification-message">{n.message}</div>
                        </div>
                        <button className="notification-close" onClick={() => hideNotification(n.id)}>×</button>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {confirmData && (
                <div className="modal-overlay fade-in">
                    <div className="modal-content scale-in">
                        <h3 className="modal-title">{confirmData.title}</h3>
                        <p className="modal-message">{confirmData.message}</p>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleConfirmClose(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleConfirmClose(true)}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
