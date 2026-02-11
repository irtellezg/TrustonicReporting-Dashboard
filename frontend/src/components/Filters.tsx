/**
 * TrustonicReporting - Filters Component
 */
import type { FilterOptions } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface FiltersProps {
    filters: {
        region: string;
        customer: string;
        status: string;
        solution: string;
        brand: string;
    };
    options: FilterOptions | null;
    onChange: (key: string, value: string) => void;
    onClear: () => void;
}

export function Filters({ filters, options, onChange, onClear }: FiltersProps) {
    const { t } = useLanguage();
    const hasActiveFilters = Object.values(filters).some((v) => v !== '');

    return (
        <div className="filters-bar">
            <div className="filter-group">
                <label className="filter-label">{t('brand')}</label>
                <select
                    className="filter-select"
                    value={filters.brand}
                    onChange={(e) => onChange('brand', e.target.value)}
                >
                    <option value="">{t('all_brands')}</option>
                    {options?.brands.map((brand) => (
                        <option key={brand} value={brand}>
                            {brand}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">{t('region')}</label>
                <select
                    className="filter-select"
                    value={filters.region}
                    onChange={(e) => onChange('region', e.target.value)}
                >
                    <option value="">{t('all_regions')}</option>
                    {options?.regions.map((region) => (
                        <option key={region} value={region}>
                            {region}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">{t('customer')}</label>
                <select
                    className="filter-select"
                    value={filters.customer}
                    onChange={(e) => onChange('customer', e.target.value)}
                >
                    <option value="">{t('all_customers')}</option>
                    {options?.customers.map((customer) => (
                        <option key={customer} value={customer}>
                            {customer}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">{t('status')}</label>
                <select
                    className="filter-select"
                    value={filters.status}
                    onChange={(e) => onChange('status', e.target.value)}
                >
                    <option value="">{t('all_statuses')}</option>
                    {options?.statuses.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">{t('solution')}</label>
                <select
                    className="filter-select"
                    value={filters.solution}
                    onChange={(e) => onChange('solution', e.target.value)}
                >
                    <option value="">{t('all_solutions')}</option>
                    {options?.solutions.map((solution) => (
                        <option key={solution} value={solution}>
                            {solution}
                        </option>
                    ))}
                </select>
            </div>

            {hasActiveFilters && (
                <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                    <label className="filter-label">&nbsp;</label>
                    <button className="btn btn-secondary" onClick={onClear}>
                        {t('clear_filters')}
                    </button>
                </div>
            )}
        </div>
    );
}
