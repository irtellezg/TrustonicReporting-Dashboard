/**
 * TrustonicReporting - Charts Components
 */
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LabelList,
} from 'recharts';
import type { StatusSummary, RegionSummary, SolutionSummary, BrandSummary, CustomerSummary } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
    'Completed': '#10b981',
    'Testing': '#3b82f6',
    'Issue': '#f59e0b',
    'Not Started': '#6b7280',
    'Cancelled': '#ef4444',
};

const CHART_COLORS = ['#0066e6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface StatusChartProps {
    data: StatusSummary[];
}

// Helper para formatear etiquetas de porcentajes en barras
const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, value, total } = props;
    const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;

    if (value === 0) return null;

    return (
        <text
            x={x + width + 5}
            y={y + height / 2}
            fill="#374151"
            textAnchor="start"
            dominantBaseline="middle"
            fontSize={11}
            fontWeight="600"
        >
            {`${value} (${percent}%)`}
        </text>
    );
};

export function StatusChart({ data }: StatusChartProps) {
    const totalDevices = data.reduce((sum, item) => sum + Number(item.device_count), 0);
    const chartData = data.map((item) => ({
        name: item.status,
        count: Number(item.device_count),
        total: totalDevices,
        fill: STATUS_COLORS[item.status] || '#6b7280',
    }));

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Dispositivos por Estado</h3>
            </div>
            <div className="card-body chart-container" style={{ minHeight: '380px' }}>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 10, right: 60, top: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e5e7eb" />
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: '#374151', fontSize: 13, fontWeight: '500' }}
                            width={110}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                            contentStyle={{
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                        />
                        <Bar
                            dataKey="count"
                            radius={[0, 6, 6, 0]}
                            barSize={30}
                            isAnimationActive={false}
                        >
                            {/* @ts-ignore */}
                            <LabelList dataKey="count" content={(props: any) => renderCustomBarLabel({ ...props, total: totalDevices })} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

interface RegionChartProps {
    data: RegionSummary[];
}

export function RegionChart({ data }: RegionChartProps) {
    const totalDevices = data.reduce((sum, item) => sum + Number(item.total_devices), 0);
    const chartData = [...data]
        .sort((a, b) => Number(b.total_devices) - Number(a.total_devices))
        .slice(0, 10)
        .map((item) => ({
            name: item.target_region || 'Sin región',
            total: Number(item.total_devices),
            completed: Number(item.completed),
            testing: Number(item.testing),
            issues: Number(item.with_issues),
            cancelled: Number(item.cancelled),
        }));

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Dispositivos por Región (Top 10)</h3>
            </div>
            <div className="card-body chart-container" style={{ minHeight: '420px' }}>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 10, right: 80, top: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: '#374151', fontSize: 11, fontWeight: '500' }}
                            width={120}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                            contentStyle={{
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                        />
                        <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                        <Bar dataKey="completed" name="Completados" fill="#10b981" stackId="a" barSize={24} isAnimationActive={false} />
                        <Bar dataKey="testing" name="En Pruebas" fill="#3b82f6" stackId="a" barSize={24} isAnimationActive={false} />
                        <Bar dataKey="issues" name="Con Problemas" fill="#f59e0b" stackId="a" barSize={24} isAnimationActive={false} />
                        <Bar dataKey="cancelled" name="Cancelados" fill="#ef4444" stackId="a" barSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                            {/* @ts-ignore */}
                            <LabelList dataKey="total" content={(props: any) => {
                                const { x, y, width, height, value } = props;
                                const percent = totalDevices > 0 ? ((value / totalDevices) * 100).toFixed(1) : 0;
                                return (
                                    <text x={x + width + 5} y={y + height / 2} fill="#374151" fontSize={11} dominantBaseline="middle" fontWeight="600">
                                        {`${value} (${percent}%)`}
                                    </text>
                                );
                            }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

interface SolutionChartProps {
    data: SolutionSummary[];
}

export function SolutionChart({ data }: SolutionChartProps) {
    const chartData = data.map((item, index) => ({
        name: item.target_solution || 'Sin solución',
        value: Number(item.total_devices),
        fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Distribución por Solución</h3>
            </div>
            <div className="card-body chart-container" style={{ minHeight: '450px' }}>
                <ResponsiveContainer width="100%" height={420}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(1)}%)`}
                            labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                            isAnimationActive={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                background: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

interface BrandChartProps {
    data: BrandSummary[];
}

export function BrandChart({ data }: BrandChartProps) {
    const totalDevices = data.reduce((sum, item) => sum + Number(item.device_count), 0);
    const chartData = data.map((item, index) => ({
        name: item.brand,
        count: Number(item.device_count),
        total: totalDevices,
        fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Dispositivos por Marca</h3>
            </div>
            <div className="card-body chart-container" style={{ minHeight: '380px' }}>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                        data={chartData}
                        margin={{ left: 10, right: 60, top: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#374151', fontSize: 11 }}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={60}
                        />
                        <YAxis type="number" hide />
                        <Tooltip />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40} isAnimationActive={false}>
                            {/* @ts-ignore */}
                            <LabelList dataKey="count" position="top" content={(props: any) => {
                                const { x, y, width, value } = props;
                                const percent = totalDevices > 0 ? ((value / totalDevices) * 100).toFixed(1) : 0;
                                return (
                                    <text x={x + width / 2} y={y - 10} fill="#374151" fontSize={11} textAnchor="middle" fontWeight="600">
                                        {`${value} (${percent}%)`}
                                    </text>
                                );
                            }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

interface CustomerChartProps {
    data: CustomerSummary[];
}

export function CustomerChart({ data }: CustomerChartProps) {
    const totalDevices = data.reduce((sum, item) => sum + Number(item.device_count), 0);
    const chartData = data.map((item, index) => ({
        name: item.customer,
        count: Number(item.device_count),
        total: totalDevices,
        fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Dispositivos por Cliente</h3>
            </div>
            <div className="card-body chart-container" style={{ minHeight: '480px' }}>
                <ResponsiveContainer width="100%" height={450}>
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ left: 10, right: 60, top: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={110}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            style={{ fontSize: '10px', fontWeight: '500' }}
                        />
                        <Tooltip />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false}>
                            {/* @ts-ignore */}
                            <LabelList dataKey="count" position="right" content={(props: any) => {
                                const { x, y, width, height, value } = props;
                                const percent = totalDevices > 0 ? ((value / totalDevices) * 100).toFixed(1) : 0;
                                return (
                                    <text x={x + width + 5} y={y + height / 2} fill="#374151" fontSize={11} dominantBaseline="middle" fontWeight="600">
                                        {`${value} (${percent}%)`}
                                    </text>
                                );
                            }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
