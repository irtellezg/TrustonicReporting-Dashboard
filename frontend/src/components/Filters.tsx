/**
 * TrustonicReporting - Filters Component
 */
import type { FilterOptions } from '../services/api';

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
    const hasActiveFilters = Object.values(filters).some((v) => v !== '');

    return (
        <div className="filters-bar">
            <div className="filter-group">
                <label className="filter-label">Marca</label>
                <select
                    className="filter-select"
                    value={filters.brand}
                    onChange={(e) => onChange('brand', e.target.value)}
                >
                    <option value="">Todas las marcas</option>
                    {options?.brands.map((brand) => (
                        <option key={brand} value={brand}>
                            {brand}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Región</label>
                <select
                    className="filter-select"
                    value={filters.region}
                    onChange={(e) => onChange('region', e.target.value)}
                >
                    <option value="">Todas las regiones</option>
                    {options?.regions.map((region) => (
                        <option key={region} value={region}>
                            {region}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Cliente</label>
                <select
                    className="filter-select"
                    value={filters.customer}
                    onChange={(e) => onChange('customer', e.target.value)}
                >
                    <option value="">Todos los clientes</option>
                    {options?.customers.map((customer) => (
                        <option key={customer} value={customer}>
                            {customer}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Estado</label>
                <select
                    className="filter-select"
                    value={filters.status}
                    onChange={(e) => onChange('status', e.target.value)}
                >
                    <option value="">Todos los estados</option>
                    {options?.statuses.map((status) => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Solución</label>
                <select
                    className="filter-select"
                    value={filters.solution}
                    onChange={(e) => onChange('solution', e.target.value)}
                >
                    <option value="">Todas las soluciones</option>
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
                        Limpiar filtros
                    </button>
                </div>
            )}
        </div>
    );
}
