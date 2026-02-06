/**
 * TrustonicReporting - Devices Table Component
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    createColumnHelper,
} from '@tanstack/react-table';
import type { SortingState, ColumnFiltersState, VisibilityState, OnChangeFn } from '@tanstack/react-table';
import type { Device } from '../services/api';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';


const columnHelper = createColumnHelper<Device>();

interface DevicesTableProps {
    devices: Device[];
    loading: boolean;
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onRefresh: () => void;
    sorting: SortingState;
    onSortingChange: OnChangeFn<SortingState>;
    globalFilter: string;
    onGlobalFilterChange: (value: string) => void;
}


export function DevicesTable({
    devices,
    loading,
    total,
    page,
    pageSize,
    onPageChange,
    onRefresh,
    sorting,
    onSortingChange,
    globalFilter,
    onGlobalFilterChange,
}: DevicesTableProps) {
    const { showNotification, confirm } = useNotification();
    // const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        brand: true,
        device: true,
        device_type: true,
        model: true,
        target_region: true,
        target_customer: true,
        android_version: true,
        target_solution: true,
        status: true,
        approved_date: true,
        comments: true,
        updated_at: true,
        // Hidden by default
        project: false,
        build: false,
        tac: false,
        dual_sim: false,
        volume_forecast: false,
        integration_requirement: false,
        tester: false,
        contact: false,
        priority: false,
        initial_sw_schedule: false,
        commercial_schedule: false,
        sw_freeze_date: false,
        initial_shipment_date: false,
        launch_date: false,
        initial_selling_date: false,
        sample_shipped: false,
    });

    const [rowSelection, setRowSelection] = useState({});
    const [deleting, setDeleting] = useState(false);

    // Search suggestions states
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [searchTerm, setSearchTerm] = useState(globalFilter);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Synchronize local search term with prop (e.g. when filters are cleared)
    useEffect(() => {
        setSearchTerm(globalFilter);
    }, [globalFilter]);

    // Suggestions logic based on local search term for speed, but filtered devices for depth
    const searchSuggestions = useMemo(() => {
        if (!searchTerm || searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        const suggestions = new Set<string>();

        devices.forEach(d => {
            if (d.brand?.toLowerCase().includes(term)) suggestions.add(d.brand);
            if (d.device?.toLowerCase().includes(term)) suggestions.add(d.device);
            if (d.model?.toLowerCase().includes(term)) suggestions.add(d.model);
            if (d.tac?.toLowerCase().includes(term)) suggestions.add(d.tac);
            if (d.target_customer?.toLowerCase().includes(term)) suggestions.add(d.target_customer);
            if (d.target_solution?.toLowerCase().includes(term)) suggestions.add(d.target_solution);
            if (d.status?.toLowerCase().includes(term)) suggestions.add(d.status);
        });

        return Array.from(suggestions).slice(0, 15);
    }, [devices, searchTerm]);

    const handleSelectSuggestion = (suggestion: string) => {
        setSearchTerm(suggestion);
        onGlobalFilterChange(suggestion);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
    };

    const triggerDebouncedFilter = (value: string) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            onGlobalFilterChange(value);
        }, 400);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || searchSuggestions.length === 0) {
            if (e.key === 'Escape') setShowSuggestions(false);
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < searchSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0) {
                    handleSelectSuggestion(searchSuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                setShowSuggestions(false);
                setSelectedSuggestionIndex(-1);
                break;
        }
    };

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);


    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close column toggle when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowColumnToggle(false);
            }
        }
        if (showColumnToggle) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showColumnToggle]);

    const columns = useMemo(
        () => [
            columnHelper.display({
                id: 'select',
                header: ({ table }) => (
                    <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={table.getIsAllRowsSelected()}
                        onChange={table.getToggleAllRowsSelectedHandler()}
                    />
                ),
                cell: ({ row }) => (
                    <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={row.getIsSelected()}
                        onChange={row.getToggleSelectedHandler()}
                    />
                ),
            }),
            columnHelper.accessor('brand', {
                header: 'Marca',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('device', {
                header: 'Nombre',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('device_type', {
                header: 'Type',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('project', {
                header: 'Proyecto',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('model', {
                header: 'Modelo',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('build', {
                header: 'Build',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('tac', {
                header: 'TAC',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('target_region', {
                header: 'Región',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('target_customer', {
                header: 'Cliente',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('android_version', {
                header: 'Android',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('dual_sim', {
                header: 'Dual SIM',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('volume_forecast', {
                header: 'Forecast',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('target_solution', {
                header: 'Solución',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('integration_requirement', {
                header: 'Requerimiento',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('status', {
                header: 'Estado',
                cell: (info) => {
                    const status = info.getValue();
                    const statusClass = status?.toLowerCase().replace(' ', '-') || '';
                    return (
                        <span className={`status-badge ${statusClass}`}>
                            {status || 'Sin estado'}
                        </span>
                    );
                },
            }),
            columnHelper.accessor('tester', {
                header: 'Tester',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('contact', {
                header: 'Contacto',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('priority', {
                header: 'Prioridad',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('approved_date', {
                header: 'Aprobado',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('initial_sw_schedule', {
                header: 'SW Schedule',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('commercial_schedule', {
                header: 'Commercial Sch',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('sw_freeze_date', {
                header: 'SW Freeze',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('initial_shipment_date', {
                header: 'Shipment Date',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('launch_date', {
                header: 'Launch Date',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('initial_selling_date', {
                header: 'Selling Date',
                cell: (info) => {
                    const val = info.getValue();
                    return val ? String(val).split('T')[0] : '-';
                },
            }),
            columnHelper.accessor('sample_shipped', {
                header: 'Sample Shipped',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('comments', {
                header: 'Comentarios',
                cell: (info) => info.getValue() || '-',
            }),
            columnHelper.accessor('updated_at', {
                header: 'Actualizado',
                cell: (info) => {
                    const date = info.getValue();
                    return date ? new Date(date).toLocaleDateString('es-MX') : '-';
                },
            }),
        ],
        []
    );

    const table = useReactTable({
        data: devices,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            globalFilter,
            rowSelection,
        },
        onSortingChange,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange,
        onRowSelectionChange: setRowSelection,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount: Math.ceil(total / pageSize),
    });

    async function handleDeleteSelected() {
        const selectedIds = Object.keys(rowSelection);
        if (selectedIds.length === 0) return;

        const confirmed = await confirm(
            'Eliminar Dispositivos',
            `¿Estás seguro de que deseas eliminar los ${selectedIds.length} dispositivos seleccionados?`
        );

        if (!confirmed) return;

        setDeleting(true);
        try {
            await api.deleteDevices(selectedIds);
            setRowSelection({});
            showNotification({
                type: 'success',
                title: 'Eliminados',
                message: `${selectedIds.length} dispositivos han sido eliminados.`
            });
            onRefresh();
        } catch (error) {
            console.error('Error deleting devices:', error);
            showNotification({
                type: 'error',
                title: 'Error al Eliminar',
                message: error instanceof Error ? error.message : 'No se pudieron eliminar los registros.'
            });
        } finally {
            setDeleting(false);
        }
    }

    const totalPages = Math.ceil(total / pageSize);
    const selectedCount = Object.keys(rowSelection).length;

    return (
        <div className="card">
            <div className="card-header" style={{ borderBottom: 'none' }}>
                <h3 className="card-title">Dispositivos ({total.toLocaleString()})</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedCount > 0 && (
                        <button
                            className="btn"
                            style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', fontSize: '13px' }}
                            onClick={handleDeleteSelected}
                            disabled={deleting}
                        >
                            🗑️ Eliminar ({selectedCount})
                        </button>
                    )}
                    <div className="column-toggle-container" ref={dropdownRef}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowColumnToggle(!showColumnToggle)}
                            style={{ fontSize: '13px' }}
                        >
                            ⚙️ Columnas
                        </button>

                        {showColumnToggle && (
                            <div className="column-toggle-dropdown scale-in">
                                <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px', fontWeight: 600, fontSize: '12px', color: '#64748b' }}>
                                    MOSTRAR COLUMNAS
                                </div>
                                {table.getAllLeafColumns()
                                    .filter(col => col.id !== 'select')
                                    .map(column => (
                                        <label key={column.id} className={`column-toggle-item ${column.getIsVisible() ? 'active' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={column.getIsVisible()}
                                                onChange={column.getToggleVisibilityHandler()}
                                            />
                                            {typeof column.columnDef.header === 'string'
                                                ? column.columnDef.header
                                                : column.id}
                                        </label>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Search Panel */}
            <div style={{
                margin: '0 16px 16px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                position: 'relative'
            }}>
                <div style={{ position: 'relative' }}>
                    <div style={{
                        position: 'relative',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        border: '2px solid transparent',
                        transition: 'border-color 0.2s'
                    }}>
                        <span style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px',
                            opacity: 0.5
                        }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscador global: marca, nombre, modelo, TAC, cliente, solución, estado..."
                            style={{
                                width: '100%',
                                padding: '14px 16px 14px 48px',
                                fontSize: '15px',
                                border: 'none',
                                borderRadius: '12px',
                                outline: 'none',
                                background: 'transparent'
                            }}
                            value={searchTerm}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchTerm(val);
                                setShowSuggestions(true);
                                triggerDebouncedFilter(val);
                            }}
                            onKeyDown={handleSearchKeyDown}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    onGlobalFilterChange('');
                                    setShowSuggestions(false);
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: '#f1f5f9',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px'
                                }}
                            >✕</button>
                        )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showSuggestions && searchSuggestions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                            marginTop: '4px',
                            zIndex: 1000,
                            overflow: 'hidden',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {searchSuggestions.map((suggestion, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectSuggestion(suggestion)}
                                    style={{
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        borderBottom: idx < searchSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        fontSize: '14px',
                                        transition: 'background 0.15s',
                                        background: idx === selectedSuggestionIndex ? '#e0f2fe' : 'white'
                                    }}
                                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                                >
                                    <span style={{ color: '#6b7280', marginRight: '8px' }}>🔍</span>
                                    {suggestion}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="data-table-container">
                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <span>Cargando dispositivos...</span>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <th
                                            key={header.id}
                                            onClick={header.column.getToggleSortingHandler()}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div
                                                className={`sort-indicator ${header.column.getIsSorted() ? 'active' : ''}`}
                                            >
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                                {header.column.getIsSorted() === 'asc' ? ' 🔼' :
                                                    header.column.getIsSorted() === 'desc' ? ' 🔽' :
                                                        ' ↕️'}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px' }}>
                                        No se encontraron dispositivos
                                    </td>
                                </tr>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <tr key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <td key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="pagination">
                <div className="pagination-info">
                    Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} de {total}
                </div>
                <div className="pagination-controls">
                    <button
                        className="btn btn-secondary"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        Anterior
                    </button>
                    <span style={{ padding: '0 12px', color: '#6b7280' }}>
                        Página {page} de {totalPages}
                    </span>
                    <button
                        className="btn btn-secondary"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div >
    );
}
