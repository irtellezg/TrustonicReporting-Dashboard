/**
 * TrustonicReporting - API Service
 */

const getAPIBase = () => {
    const savedPort = localStorage.getItem('trustonic_api_port') || '3001';
    return `http://localhost:${savedPort}/api`;
};

export interface DashboardKPIs {
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
    not_started: number;
    cancelled: number;
    total_regions: number;
    total_brands: number;
    inventory_count: number;
}

export interface InventoryItem {
    id: string;
    brand?: string;
    marketing_name?: string;
    model: string;
    serial_number?: string;
    imei1?: string;
    imei2?: string;
    received_on?: string;
    returned_on?: string;
    remark?: string;
    solution_type?: string;
    target_customer?: string;
    comments?: string;
    in_inventory: boolean;
    nm_flow?: string;
    tac?: string;
    device_name?: string;
    updated_at: string;
}

export interface InventoryResponse {
    items: InventoryItem[];
    total: number;
}

export interface DirectoryListing {
    currentPath: string;
    parentPath: string | null;
    directories: Array<{ name: string; path: string }>;
}

export interface StatusSummary {
    status: string;
    device_count: number;
    regions_count: number;
    brands_count: number;
}

export interface RegionSummary {
    target_region: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
    not_started: number;
    cancelled: number;
}

export interface SolutionSummary {
    target_solution: string;
    total_devices: number;
    completed: number;
    testing: number;
    with_issues: number;
}

export interface Device {
    id: string;
    brand: string;
    device: string;
    device_type: string;
    project: string;
    model: string;
    build: string;
    tac: string;
    approved_date: string;
    dual_sim: string;
    target_region: string;
    target_customer: string;
    android_version: string;
    volume_forecast: string;
    target_solution: string;
    integration_requirement: string;
    initial_sw_schedule: string;
    commercial_schedule: string;
    sw_freeze_date: string;
    initial_shipment_date: string;
    initial_selling_date: string;
    launch_date: string;
    sample_shipped: string;
    priority: string;
    status: string;
    comments: string;
    tester: string;
    contact: string;
    sheet_name: string;
    row_index: number;
    updated_at: string;
}

export interface FilterOptions {
    regions: string[];
    customers: string[];
    brands: string[];
    solutions: string[];
    statuses: string[];
}

export interface SystemConfig {
    watch_folder: string;
    port: number;
    database_status: string;
}

export interface ConfigResponse {
    success: boolean;
    message: string;
    new_path?: string;
}

export interface DevicesResponse {
    devices: Device[];
    total: number;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${getAPIBase()}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

export const api = {
    // Dashboard
    getKPIs: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<DashboardKPIs>(`/dashboard/kpis${query}`);
    },
    getStatusSummary: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<StatusSummary[]>(`/dashboard/status${query}`);
    },
    getRegionSummary: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<RegionSummary[]>(`/dashboard/regions${query}`);
    },
    getSolutionSummary: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<SolutionSummary[]>(`/dashboard/solutions${query}`);
    },

    // Devices
    getDevices: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<DevicesResponse>(`/devices${query}`);
    },

    // Inventory
    getInventory: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        console.log('[API] getInventory - params:', params, 'query:', query);
        return fetchAPI<InventoryResponse>(`/inventory${query}`);
    },

    // Inventory filter options (brands/customers that exist in inventory)
    getInventoryFilters: () => {
        return fetchAPI<{ brands: string[]; customers: string[] }>('/inventory/filters');
    },

    // Filters (deprecated - use getInventoryFilters for inventory)
    getFilterOptions: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params)}` : '';
        return fetchAPI<FilterOptions>(`/filters${query}`);
    },

    // Process
    processFile: (filePath: string) =>
        fetchAPI('/process/file', {
            method: 'POST',
            body: JSON.stringify({ filePath }),
        }),

    processFolder: (folderPath: string) =>
        fetchAPI('/process/folder', {
            method: 'POST',
            body: JSON.stringify({ folderPath }),
        }),

    // Health
    checkHealth: () => fetchAPI<{ status: string }>('/health'),

    // Configuration
    getConfig: () => fetchAPI<SystemConfig>('/config'),

    listDirectories: (path?: string) => {
        const query = path ? `?path=${encodeURIComponent(path)}` : '';
        return fetchAPI<DirectoryListing>(`/config/list-directories${query}`);
    },

    updateWatchFolder: (folderPath: string) =>
        fetchAPI<ConfigResponse>('/config/watch-folder', {
            method: 'POST',
            body: JSON.stringify({ folderPath }),
        }),

    updateBackendPort: (port: string) =>
        fetchAPI<ConfigResponse>('/config/port', {
            method: 'POST',
            body: JSON.stringify({ port }),
        }),

    // Data Management
    clearAllData: () => fetchAPI<{ success: boolean; message: string }>('/data/all', { method: 'DELETE' }),

    deleteDevices: (ids: string[]) => fetchAPI<{ success: boolean; message: string }>('/devices', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
    }),

    deleteInventory: (ids: string[]) => fetchAPI<{ success: boolean; message: string }>('/inventory', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
    }),
};

export default api;
