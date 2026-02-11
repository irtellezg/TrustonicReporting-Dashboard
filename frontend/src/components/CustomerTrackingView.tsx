import React, { useState, useEffect, useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    BarChart,
    Bar,
    Cell,
    LabelList,
    PieChart,
    Pie,
    Label
} from 'recharts';
import api from '../services/api';
import type { MonthlyTrack, TrackingOptions } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ff7300', '#a4de6c'];

export const CustomerTrackingView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MonthlyTrack[]>([]);
    const [options, setOptions] = useState<TrackingOptions>({
        customers: [],
        countries: [],
        solutions: [],
        years: []
    });
    const [filters, setFilters] = useState({
        customer: '',
        country: '',
        solution: '',
        year: ''
    });

    // Load options with cascading effect
    useEffect(() => {
        const loadOptions = async () => {
            try {
                const params: Record<string, string> = {};
                if (filters.customer) params.customer = filters.customer;
                if (filters.country) params.country = filters.country;
                if (filters.solution) params.solution = filters.solution;
                if (filters.year) params.year = filters.year;

                const opt = await api.getTrackingOptions(params);
                setOptions(opt);
            } catch (err) {
                console.error('Error loading tracking options:', err);
            }
        };
        loadOptions();
    }, [filters]);

    // Load main data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const params: Record<string, string> = {};
                if (filters.customer) params.customer = filters.customer;
                if (filters.country) params.country = filters.country;
                if (filters.solution) params.solution = filters.solution;
                if (filters.year) params.year = filters.year;

                const result = await api.getTracking(params);
                setData(result);
            } catch (err) {
                console.error('Error loading tracking data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [filters]);

    // Data for Evolution chart (Trend)
    const trendData = useMemo(() => {
        const map = new Map<string, { name: string, Registered: number, Activated: number, Billable: number }>();
        data.forEach(item => {
            const month = item.record_date.substring(0, 7);
            const existing = map.get(month) || { name: month, Registered: 0, Activated: 0, Billable: 0 };
            existing.Registered += item.registered;
            existing.Activated += item.activated;
            existing.Billable += (item.total_billable || 0);
            map.set(month, existing);
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    // Aggregate data by customer for bar charts
    const customerTotals = useMemo(() => {
        const map = new Map<string, { customer: string, registered: number, activated: number }>();
        data.forEach(item => {
            const existing = map.get(item.customer) || { customer: item.customer, registered: 0, activated: 0 };
            existing.registered += item.registered;
            existing.activated += item.activated;
            map.set(item.customer, existing);
        });
        return Array.from(map.values());
    }, [data]);

    const registeredData = useMemo(() => {
        return customerTotals
            .filter(item => item.registered > 0)
            .sort((a, b) => b.registered - a.registered);
    }, [customerTotals]);

    const activatedData = useMemo(() => {
        return customerTotals
            .filter(item => item.activated > 0)
            .sort((a, b) => b.activated - a.activated);
    }, [customerTotals]);

    // Aggregate data by solution (only if customer filter is active)
    const solutionDistribution = useMemo(() => {
        if (!filters.customer) return [];
        const map = new Map<string, { name: string, value: number }>();
        data.forEach(item => {
            const existing = map.get(item.solution) || { name: item.solution, value: 0 };
            existing.value += item.registered; // We use registered as volume measure
            map.set(item.solution, existing);
        });
        return Array.from(map.values()).sort((a, b) => b.value - a.value);
    }, [data, filters.customer]);

    if (loading && data.length === 0) {
        return <div className="loading-container"><div className="loading-spinner"></div><p>Cargando seguimiento...</p></div>;
    }

    const totalRegistered = data.reduce((acc, curr) => acc + curr.registered, 0);
    const totalActivated = data.reduce((acc, curr) => acc + curr.activated, 0);
    const totalBillable = data.reduce((acc, curr) => acc + (curr.total_billable || 0), 0);
    const totalNonBillable = Math.max(0, totalActivated - totalBillable);

    return (
        <div className="tracking-view">
            {/* Filters */}
            <div className="filters-bar" style={{ marginBottom: '24px' }}>
                <div className="filter-group">
                    <label className="filter-label">Año</label>
                    <select
                        id="tracking-year-filter"
                        className="filter-select"
                        value={filters.year}
                        onChange={(e) => setFilters(f => ({ ...f, year: e.target.value }))}
                    >
                        <option value="">Todos los Años</option>
                        {options.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label className="filter-label">Cliente</label>
                    <select
                        id="tracking-customer-filter"
                        className="filter-select"
                        value={filters.customer}
                        onChange={(e) => setFilters(f => ({ ...f, customer: e.target.value }))}
                    >
                        <option value="">Todos los Clientes</option>
                        {options.customers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label className="filter-label">País</label>
                    <select
                        id="tracking-country-filter"
                        className="filter-select"
                        value={filters.country}
                        onChange={(e) => setFilters(f => ({ ...f, country: e.target.value }))}
                    >
                        <option value="">Todos los Países</option>
                        {options.countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="filter-group">
                    <label className="filter-label">Solución</label>
                    <select
                        id="tracking-solution-filter"
                        className="filter-select"
                        value={filters.solution}
                        onChange={(e) => setFilters(f => ({ ...f, solution: e.target.value }))}
                    >
                        <option value="">Todas las Soluciones</option>
                        {options.solutions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="tracking-report-content">
                {/* KPI Cards */}
                <div className="kpi-grid">
                    <div className="kpi-card testing">
                        <div className="kpi-label">Total Registrados</div>
                        <div className="kpi-value">{totalRegistered.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card completed">
                        <div className="kpi-label">Total Activados</div>
                        <div className="kpi-value">{totalActivated.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card issue">
                        <div className="kpi-label">Total Facturable</div>
                        <div className="kpi-value">{totalBillable.toLocaleString()}</div>
                    </div>
                    <div className="kpi-card cancelled">
                        <div className="kpi-label">Total No Facturado</div>
                        <div className="kpi-value">{totalNonBillable.toLocaleString()}</div>
                    </div>
                </div>


                <div className="charts-grid" style={{ gridTemplateColumns: '1fr', marginBottom: '24px' }}>
                    {/* Evolution Chart */}
                    <div className="card chart-container" id="tracking-evolution-chart">
                        <div className="card-header">
                            <h3 className="card-title">Evolución Temporal: Registros, Activaciones y Facturación</h3>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorBill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ffc658" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#ffc658" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                                    <XAxis dataKey="name" stroke="var(--gray-500)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--gray-500)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            borderColor: 'var(--gray-200)',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Legend verticalAlign="top" height={36} />
                                    <Area
                                        type="monotone"
                                        dataKey="Registered"
                                        name="Registrados"
                                        stroke="#8884d8"
                                        fillOpacity={1}
                                        fill="url(#colorReg)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="Activated"
                                        name="Activados"
                                        stroke="#82ca9d"
                                        fillOpacity={1}
                                        fill="url(#colorAct)"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="Billable"
                                        name="Facturables"
                                        stroke="#ffc658"
                                        fillOpacity={1}
                                        fill="url(#colorBill)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="charts-grid" style={{ gridTemplateColumns: filters.customer ? '1fr 1fr 1.2fr' : '1fr 1fr' }}>
                    {/* Registered by Customer */}
                    <div className="card chart-container" id="tracking-registered-customer-chart">
                        <div className="card-header">
                            <h3 className="card-title">Total Registrados</h3>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={Math.max(300, registeredData.length * 30)}>
                                <BarChart data={registeredData} layout="vertical" margin={{ left: 10, right: 40, top: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--gray-200)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="customer"
                                        type="category"
                                        width={100}
                                        fontSize={10}
                                        stroke="var(--gray-500)"
                                        interval={0}
                                    />
                                    <Tooltip cursor={{ fill: 'var(--gray-100)' }} />
                                    <Bar dataKey="registered" name="Registrados" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20}>
                                        {registeredData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                                        ))}
                                        <LabelList dataKey="registered" position="right" fontSize={10} formatter={(v: any) => v?.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activated by Customer */}
                    <div className="card chart-container" id="tracking-activated-customer-chart">
                        <div className="card-header">
                            <h3 className="card-title">Total Activados</h3>
                        </div>
                        <div className="card-body">
                            <ResponsiveContainer width="100%" height={Math.max(300, activatedData.length * 30)}>
                                <BarChart data={activatedData} layout="vertical" margin={{ left: 10, right: 40, top: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--gray-200)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="customer"
                                        type="category"
                                        width={100}
                                        fontSize={10}
                                        stroke="var(--gray-500)"
                                        interval={0}
                                    />
                                    <Tooltip cursor={{ fill: 'var(--gray-100)' }} />
                                    <Bar dataKey="activated" name="Activados" fill="#82ca9d" radius={[0, 4, 4, 0]} barSize={20}>
                                        {activatedData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                                        ))}
                                        <LabelList dataKey="activated" position="right" fontSize={10} formatter={(v: any) => v?.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Solution Distribution (Only shown if customer filtered) */}
                    {filters.customer && solutionDistribution.length > 0 && (
                        <div className="card chart-container" id="tracking-solution-pie-chart">
                            <div className="card-header">
                                <h3 className="card-title">Distribución de Solución</h3>
                            </div>
                            <div className="card-body">
                                <ResponsiveContainer width="100%" height={350}>
                                    <PieChart margin={{ right: 40 }}>
                                        <Pie
                                            data={solutionDistribution}
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={2}
                                            dataKey="value"
                                            minAngle={5}
                                            label={({ name, percent }) => (percent || 0) > 0.02 ? `${name} (${((percent || 0) * 100).toFixed(0)}%)` : ''}
                                        >
                                            {solutionDistribution.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                            <Label
                                                value={solutionDistribution.reduce((acc, curr) => acc + curr.value, 0).toLocaleString()}
                                                position="center"
                                                fontSize={18}
                                                fontWeight="bold"
                                                fill="var(--gray-800)"
                                            />
                                            <Label
                                                value="Total"
                                                position="center"
                                                dy={15}
                                                fontSize={10}
                                                fill="var(--gray-500)"
                                            />
                                        </Pie>
                                        <Tooltip formatter={(value: any) => value.toLocaleString()} />
                                        <Legend
                                            layout="vertical"
                                            verticalAlign="middle"
                                            align="right"
                                            formatter={(value) => {
                                                const dataItem = solutionDistribution.find(d => d.name === value);
                                                return <span style={{ color: 'var(--gray-700)', fontSize: '10px' }}>
                                                    {value}: <strong>{dataItem?.value.toLocaleString()}</strong>
                                                </span>;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
