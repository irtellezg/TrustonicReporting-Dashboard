/**
 * TrustonicReporting - KPI Cards Component
 */
import type { DashboardKPIs } from '../services/api';


interface KPICardsProps {
    kpis: DashboardKPIs | null;
    loading: boolean;
}

export function KPICards({ kpis, loading }: KPICardsProps) {
    if (loading) {
        return (
            <div className="kpi-grid">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="kpi-card" style={{ opacity: 0.5 }}>
                        <div className="kpi-label">Cargando...</div>
                        <div className="kpi-value">--</div>
                    </div>
                ))}
            </div>
        );
    }

    if (!kpis) return null;

    const cards = [
        { label: 'Total Dispositivos', value: kpis.total_devices, className: '' },
        { label: 'Completados', value: kpis.completed, className: 'completed' },
        { label: 'En Pruebas', value: kpis.testing, className: 'testing' },
        { label: 'Con Problemas', value: kpis.with_issues, className: 'issue' },
        { label: 'Sin Iniciar', value: kpis.not_started, className: 'not-started' },
        { label: 'Cancelados', value: kpis.cancelled, className: 'cancelled' },
    ];

    return (
        <div className="kpi-grid">
            {cards.map((card) => (
                <div key={card.label} className={`kpi-card ${card.className}`}>
                    <div className="kpi-label">{card.label}</div>
                    <div className="kpi-value">{card.value.toLocaleString()}</div>
                </div>
            ))}
        </div>
    );
}
