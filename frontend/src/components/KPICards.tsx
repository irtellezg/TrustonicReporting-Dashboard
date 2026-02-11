/**
 * TrustonicReporting - KPI Cards Component
 */
import type { DashboardKPIs } from '../services/api';
import { useLanguage } from '../context/LanguageContext';


interface KPICardsProps {
    kpis: DashboardKPIs | null;
    loading: boolean;
}

export function KPICards({ kpis, loading }: KPICardsProps) {
    const { t } = useLanguage();

    if (loading) {
        return (
            <div className="kpi-grid">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="kpi-card" style={{ opacity: 0.5 }}>
                        <div className="kpi-label">{t('loading')}...</div>
                        <div className="kpi-value">--</div>
                    </div>
                ))}
            </div>
        );
    }

    if (!kpis) return null;

    const cards = [
        { label: t('total_devices'), value: kpis.total_devices, className: '' },
        { label: t('completed'), value: kpis.completed, className: 'completed' },
        { label: t('testing'), value: kpis.testing, className: 'testing' },
        { label: t('with_issues'), value: kpis.with_issues, className: 'issue' },
        { label: t('not_started'), value: kpis.not_started, className: 'not-started' },
        { label: t('cancelled'), value: kpis.cancelled, className: 'cancelled' },
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
