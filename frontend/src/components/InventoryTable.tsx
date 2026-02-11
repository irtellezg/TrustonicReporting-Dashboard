import { useState, useEffect, useMemo, useRef } from 'react';
import api, { type InventoryItem } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';

interface InventoryTableProps {
    items: InventoryItem[];
    loading: boolean;
    total: number;
    onRefresh: () => void;
    onRefreshWithParams: (filters?: Record<string, string>) => void;
}

export function InventoryTable({ items, loading, total, onRefresh, onRefreshWithParams }: InventoryTableProps) {
    const { showNotification, confirm } = useNotification();
    const { t, language } = useLanguage();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);

    // Filter states
    const [brandFilter, setBrandFilter] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [receivedFilter, setReceivedFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Search suggestions keyboard navigation
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

    // Date filter suggestions
    const [showDateSuggestions, setShowDateSuggestions] = useState(false);
    const [selectedDateIndex, setSelectedDateIndex] = useState(-1);

    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch inventory-specific filter options
    const [inventoryOptions, setInventoryOptions] = useState<{ brands: string[]; customers: string[] } | null>(null);

    useEffect(() => {
        api.getInventoryFilters()
            .then(opts => setInventoryOptions(opts))
            .catch(err => console.error('Error loading inventory filters:', err));
    }, []);

    // Use inventory-specific options, fallback to deriving from items
    const allBrands = useMemo(() => {
        if (inventoryOptions?.brands && inventoryOptions.brands.length > 0) return inventoryOptions.brands;
        return Array.from(new Set(items.map(i => i.brand).filter((b): b is string => !!b))).sort();
    }, [inventoryOptions, items]);

    // Derive all available dates from items for smart date filter
    const allDates = useMemo(() => {
        const dates = new Set<string>();
        items.forEach(item => {
            if (item.received_on) dates.add(item.received_on);
        });
        return Array.from(dates).sort().reverse(); // Most recent first
    }, [items]);

    // Date suggestions based on filter input
    const dateSuggestions = useMemo(() => {
        if (receivedFilter.length < 1) return allDates.slice(0, 10);
        const term = receivedFilter.toLowerCase();
        return allDates.filter(d => d.toLowerCase().includes(term)).slice(0, 10);
    }, [allDates, receivedFilter]);

    // Autocomplete suggestions for search (includes brand)
    const searchSuggestions = useMemo(() => {
        if (searchTerm.length < 2) return [];
        const term = searchTerm.toLowerCase();
        const suggestions = new Set<string>();

        items.forEach(item => {
            // Include brand in suggestions
            if (item.brand?.toLowerCase().includes(term)) suggestions.add(item.brand);
            if (item.marketing_name?.toLowerCase().includes(term)) suggestions.add(item.marketing_name);
            if (item.model?.toLowerCase().includes(term)) suggestions.add(item.model);
            if (item.serial_number?.toLowerCase().includes(term)) suggestions.add(item.serial_number);
            if (item.imei1?.toLowerCase().includes(term)) suggestions.add(item.imei1);
            if (item.remark?.toLowerCase().includes(term)) suggestions.add(item.remark);
            if (item.target_customer?.toLowerCase().includes(term)) suggestions.add(item.target_customer);
            if (item.solution_type?.toLowerCase().includes(term)) suggestions.add(item.solution_type);
        });

        return Array.from(suggestions).slice(0, 10);
    }, [items, searchTerm]);

    // Core filter function - stable reference
    const applyFilters = (brand: string, customer: string, received: string, search: string) => {
        const params: Record<string, string> = {
            limit: '100',
            offset: '0'
        };
        if (brand) params.brand = brand;
        if (customer) params.customer = customer;
        if (received) params.received_on = received;
        if (search) params.search = search;

        console.log('[InventoryTable] Applying filters:', params);
        onRefreshWithParams(params);
    };

    // Handle brand change - immediate
    const handleBrandChange = (newBrand: string) => {
        setBrandFilter(newBrand);
        // Apply filter immediately
        setTimeout(() => applyFilters(newBrand, customerFilter, receivedFilter, searchTerm), 0);
    };

    // Handle customer change - immediate
    const handleCustomerChange = (newCustomer: string) => {
        setCustomerFilter(newCustomer);
        // Apply filter immediately
        setTimeout(() => applyFilters(brandFilter, newCustomer, receivedFilter, searchTerm), 0);
    };

    // Handle search term change - debounced
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchTerm(value);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(-1);
        triggerDebouncedFilter(value);
    };

    // Debounced filter trigger for text inputs
    const triggerDebouncedFilter = (newSearch: string) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
            applyFilters(brandFilter, customerFilter, receivedFilter, newSearch);
        }, 400);
    };

    // Handle keyboard navigation in suggestions
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || searchSuggestions.length === 0) {
            if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
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

    // Handle selecting a suggestion
    const handleSelectSuggestion = (suggestion: string) => {
        setSearchTerm(suggestion);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        applyFilters(brandFilter, customerFilter, receivedFilter, suggestion);
    };

    // Handle received date change - debounced with suggestions
    const handleReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setReceivedFilter(value);
        setShowDateSuggestions(true);
        setSelectedDateIndex(-1);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            applyFilters(brandFilter, customerFilter, value, searchTerm);
        }, 400);
    };

    // Handle keyboard navigation for date suggestions
    const handleDateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDateSuggestions || dateSuggestions.length === 0) {
            if (e.key === 'Escape') {
                setShowDateSuggestions(false);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedDateIndex((prev: number) =>
                    prev < dateSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedDateIndex((prev: number) => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedDateIndex >= 0) {
                    handleSelectDate(dateSuggestions[selectedDateIndex]);
                }
                break;
            case 'Escape':
                setShowDateSuggestions(false);
                setSelectedDateIndex(-1);
                break;
        }
    };

    // Handle selecting a date suggestion
    const handleSelectDate = (date: string) => {
        setReceivedFilter(date);
        setShowDateSuggestions(false);
        setSelectedDateIndex(-1);
        applyFilters(brandFilter, customerFilter, date, searchTerm);
    };

    // Clear all filters
    const handleClearFilters = () => {
        setBrandFilter('');
        setCustomerFilter('');
        setReceivedFilter('');
        setSearchTerm('');
        setShowSuggestions(false);
        onRefresh();
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, []);

    const toggleSelectAll = () => {
        if (selectedIds.size === items.length && items.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(items.map(i => i.id)));
        }
    };

    const toggleSelectItem = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    async function handleDeleteSelected() {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        const confirmed = await confirm(
            t('confirm_delete_title'),
            t('confirm_delete_message', { count: ids.length })
        );

        if (!confirmed) return;

        setDeleting(true);
        try {
            await api.deleteInventory(ids);
            setSelectedIds(new Set());
            showNotification({
                type: 'success',
                title: t('success_title'),
                message: t('success_title')
            });
            onRefresh();
        } catch (error) {
            console.error('Error deleting inventory:', error);
            showNotification({
                type: 'error',
                title: t('error_title'),
                message: error instanceof Error ? error.message : t('error_title')
            });
        } finally {
            setDeleting(false);
        }
    }

    // Loading state only when no data
    const showFullLoading = loading && items.length === 0;

    if (showFullLoading) {
        return (
            <div style={{ padding: '60px', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
                <p style={{ color: '#6b7280', fontWeight: 500 }}>{t('loading_inventory')}</p>
            </div>
        );
    }

    const hasActiveFilters = brandFilter || customerFilter || receivedFilter || searchTerm;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Loading overlay */}
            {loading && items.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(255,255,255,0.6)',
                    zIndex: 20,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingTop: '100px',
                    borderRadius: '12px',
                    pointerEvents: 'none'
                }}>
                    <div style={{
                        padding: '12px 24px',
                        background: 'white',
                        borderRadius: '25px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--primary-600)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                        {t('filtering')}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="card-title" style={{ margin: 0 }}>
                    {t('inventory_items')}
                    <span style={{
                        marginLeft: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--gray-500)',
                        background: 'var(--gray-100)',
                        padding: '2px 10px',
                        borderRadius: '12px'
                    }}>
                        {total.toLocaleString()}
                    </span>
                </h3>
                {selectedIds.size > 0 && (
                    <button
                        className="btn"
                        style={{ backgroundColor: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', fontSize: '13px' }}
                        onClick={handleDeleteSelected}
                        disabled={deleting}
                    >
                        🗑️ {t('delete_selected', { count: selectedIds.size })}
                    </button>
                )}
            </div>

            {/* Professional Filters Panel */}
            <div style={{
                margin: '16px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                {/* Search Bar - Primary */}
                <div style={{ position: 'relative', marginBottom: '20px' }}>
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
                            placeholder={t('search_placeholder_inventory') || "Buscar por marca, nombre comercial, modelo, IMEI o número de serie..."}
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
                            onChange={handleSearchChange}
                            onKeyDown={handleSearchKeyDown}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setShowSuggestions(false); applyFilters(brandFilter, customerFilter, receivedFilter, ''); }}
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
                            zIndex: 30,
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
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#f8fafc';
                                        setSelectedSuggestionIndex(idx);
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = idx === selectedSuggestionIndex ? '#e0f2fe' : 'white';
                                    }}
                                >
                                    <span style={{ color: '#6b7280' }}>🔍</span> {suggestion}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Secondary Filters Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    alignItems: 'end'
                }}>
                    {/* Brand Filter */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {t('brand')}
                        </label>
                        <select
                            value={brandFilter}
                            onChange={(e) => handleBrandChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                background: 'white',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        >
                            <option value="">{t('all_brands')}</option>
                            {allBrands.map((b: string) => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Customer Filter */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {t('customer')}
                        </label>
                        <select
                            value={customerFilter}
                            onChange={(e) => handleCustomerChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                background: 'white',
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                        >
                            <option value="">{t('all_customers')}</option>
                            {inventoryOptions?.customers.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date Filter with Autocomplete */}
                    <div style={{ position: 'relative' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#64748b',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {t('received_date')}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder={t('date_placeholder') || "Buscar fecha..."}
                                value={receivedFilter}
                                onChange={handleReceivedChange}
                                onKeyDown={handleDateKeyDown}
                                onFocus={() => setShowDateSuggestions(true)}
                                onBlur={() => setTimeout(() => setShowDateSuggestions(false), 200)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    fontSize: '14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    background: 'white',
                                    outline: 'none'
                                }}
                            />
                            {receivedFilter && (
                                <button
                                    onClick={() => { setReceivedFilter(''); setShowDateSuggestions(false); applyFilters(brandFilter, customerFilter, '', searchTerm); }}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: '#f1f5f9',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px'
                                    }}
                                >✕</button>
                            )}
                        </div>

                        {/* Date Suggestions Dropdown */}
                        {showDateSuggestions && dateSuggestions.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                marginTop: '4px',
                                zIndex: 30,
                                overflow: 'hidden',
                                maxHeight: '200px',
                                overflowY: 'auto'
                            }}>
                                {dateSuggestions.map((date, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleSelectDate(date)}
                                        style={{
                                            padding: '8px 12px',
                                            cursor: 'pointer',
                                            borderBottom: idx < dateSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            fontSize: '13px',
                                            transition: 'background 0.15s',
                                            background: idx === selectedDateIndex ? '#e0f2fe' : 'white'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f8fafc';
                                            setSelectedDateIndex(idx);
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = idx === selectedDateIndex ? '#e0f2fe' : 'white';
                                        }}
                                    >
                                        <span style={{ color: '#6b7280' }}>📅</span> {date}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Clear Button */}
                    {hasActiveFilters && (
                        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                            <button
                                onClick={handleClearFilters}
                                style={{
                                    padding: '10px 20px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    background: 'white',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                ✕ {t('clear_filters')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Active Filters Tags */}
                {hasActiveFilters && (
                    <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '16px',
                        borderTop: '1px solid #e2e8f0'
                    }}>
                        <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px' }}>{t('active_filters')}:</span>
                        {brandFilter && (
                            <span style={{
                                background: '#dbeafe',
                                color: '#1d4ed8',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500
                            }}>
                                {t('brand')}: {brandFilter}
                            </span>
                        )}
                        {customerFilter && (
                            <span style={{
                                background: '#ecfdf5',
                                color: '#059669',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500
                            }}>
                                {t('customer')}: {customerFilter}
                            </span>
                        )}
                        {receivedFilter && (
                            <span style={{
                                background: '#fef3c7',
                                color: '#d97706',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500
                            }}>
                                {t('received_date')}: {receivedFilter}
                            </span>
                        )}
                        {searchTerm && (
                            <span style={{
                                background: '#f3e8ff',
                                color: '#7c3aed',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 500
                            }}>
                                {t('search')}: "{searchTerm}"
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Empty State */}
            {items.length === 0 && !loading && (
                <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                        {t('no_results')}
                    </h3>
                    <p style={{ fontSize: '14px', maxWidth: '300px', margin: '0 auto' }}>
                        {t('no_results_desc')}
                    </p>
                    <button
                        className="btn btn-secondary"
                        style={{ marginTop: '16px' }}
                        onClick={handleClearFilters}
                    >
                        {t('clear_filters')}
                    </button>
                </div>
            )}

            {/* Data Table */}
            {items.length > 0 && (
                <div className="data-table-container" style={{ margin: '0 16px 16px' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        className="checkbox-custom"
                                        checked={items.length > 0 && selectedIds.size === items.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th>{t('brand')}</th>
                                <th>{t('marketing_name') || 'Nombre Comercial'}</th>
                                <th>{t('model')}</th>
                                <th>S/N</th>
                                <th>IMEIs</th>
                                <th>{t('customer')}</th>
                                <th>{t('received')} || 'Recibido'</th>
                                <th>{t('status')}</th>
                                <th>Remark</th>
                                <th>{t('comments')}</th>
                                <th>{t('solution')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className={selectedIds.has(item.id) ? 'selected-row' : ''}>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            className="checkbox-custom"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => toggleSelectItem(item.id)}
                                        />
                                    </td>
                                    <td style={{ fontWeight: 600, color: '#111827' }}>
                                        {item.brand || '—'}
                                    </td>
                                    <td>{item.marketing_name || '—'}</td>
                                    <td style={{ fontWeight: 500 }}>{item.model || '—'}</td>
                                    <td>
                                        <code style={{
                                            background: '#f3f4f6',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '12px'
                                        }}>
                                            {item.serial_number || '—'}
                                        </code>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
                                            <div><span style={{ color: '#9ca3af' }}>1:</span> {item.imei1 || '—'}</div>
                                            {item.imei2 && <div><span style={{ color: '#9ca3af' }}>2:</span> {item.imei2}</div>}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: '13px' }}>{item.target_customer || '—'}</td>
                                    <td style={{ fontSize: '13px' }}>{item.received_on || '—'}</td>
                                    <td>
                                        {(!item.returned_on || item.returned_on.toLowerCase().includes('inventory')) ? (
                                            <span className="status-badge testing" style={{ fontSize: '11px', padding: '2px 8px', background: '#ecfdf5', color: '#059669', border: '1px solid #10b981' }}>
                                                En Inventario
                                            </span>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <span className="status-badge completed" style={{ fontSize: '11px', padding: '2px 8px', width: 'fit-content' }}>
                                                    Devuelto
                                                </span>
                                                <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '4px' }}>
                                                    {item.returned_on}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ fontSize: '12px', color: '#4b5563' }}>{item.remark || '—'}</td>
                                    <td style={{ fontSize: '12px', color: '#6b7280', maxWidth: '200px' }}>
                                        <div style={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }} title={item.comments || ''}>
                                            {item.comments || '—'}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${(item.solution_type || (item as any).target_solution)?.toLowerCase().includes('dpc') ? 'testing' : 'completed'}`}
                                            style={{ fontSize: '11px', padding: '2px 8px' }}>
                                            {item.solution_type || (item as any).target_solution || '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer */}
            <div className="pagination" style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px' }}>
                <div className="pagination-info" style={{ color: '#9ca3af' }}>
                    Mostrando {items.length} de {total} registros
                </div>
            </div>
        </div>
    );
}
