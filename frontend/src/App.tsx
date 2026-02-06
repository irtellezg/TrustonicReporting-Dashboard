/**
 * TrustonicReporting - Main App Component
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './index.css';
import api from './services/api';
import type {
  DashboardKPIs,
  StatusSummary,
  RegionSummary,
  SolutionSummary,
  Device,
  InventoryItem,
  FilterOptions,
} from './services/api';
import { KPICards } from './components/KPICards';
import { StatusChart, RegionChart, SolutionChart } from './components/Charts';
import { DevicesTable } from './components/DevicesTable';
import { Filters } from './components/Filters';
import { exportToPDF } from './services/pdfExport';
import { SettingsView } from './components/SettingsView';
import { InventoryTable } from './components/InventoryTable';
import { useNotification } from './context/NotificationContext';


type View = 'dashboard' | 'devices' | 'inventory' | 'settings';

function App() {
  const { showNotification } = useNotification();
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);

  // Data
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [statusData, setStatusData] = useState<StatusSummary[]>([]);
  const [regionData, setRegionData] = useState<RegionSummary[]>([]);
  const [solutionData, setSolutionData] = useState<SolutionSummary[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryTotal, setInventoryTotal] = useState(0);
  const [devicesTotal, setDevicesTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    regions: [],
    customers: [],
    brands: [],
    solutions: [],
    statuses: [],
  });

  // Filters
  const [filters, setFilters] = useState({
    region: '',
    customer: '',
    status: '',
    solution: '',
    brand: '',
    search: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // Sorting
  const [sorting, setSorting] = useState<any[]>([]);

  // Refs
  const chartsRef = useRef<HTMLDivElement>(null);

  async function loadDashboardData() {
    setLoading(true);
    try {
      console.log('📂 Cargando dashboard y filtros (con filtros)...');

      const commonParams: Record<string, string> = {};
      if (filters.region) commonParams.region = filters.region;
      if (filters.customer) commonParams.customer = filters.customer;
      if (filters.status) commonParams.status = filters.status;
      if (filters.solution) commonParams.solution = filters.solution;
      if (filters.brand) commonParams.brand = filters.brand;

      const [kpiRes, statusRes, regionRes, solutionRes, filterRes, invRes] = await Promise.all([
        api.getKPIs(commonParams),
        api.getStatusSummary(commonParams),
        api.getRegionSummary(commonParams),
        api.getSolutionSummary(commonParams),
        api.getFilterOptions(commonParams),
        api.getInventory({ limit: '100', offset: '0' })
      ]);

      setKpis(kpiRes);
      setStatusData(statusRes);
      setRegionData(regionRes);
      setSolutionData(solutionRes);
      setFilterOptions(filterRes);
      setInventory(invRes.items);
      setInventoryTotal(invRes.total);

      // También refrescar dispositivos
      await loadDevices();
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      showNotification({
        type: 'error',
        title: 'Error de Datos',
        message: 'No se pudieron cargar los datos del sistema.'
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadDevices() {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(pageSize),
        offset: String((page - 1) * pageSize),
      };

      if (filters.region) params.region = filters.region;
      if (filters.customer) params.customer = filters.customer;
      if (filters.status) params.status = filters.status;
      if (filters.solution) params.solution = filters.solution;
      if (filters.brand) params.brand = filters.brand;
      if (filters.search) params.search = filters.search;

      if (sorting.length > 0) {
        params.sortBy = sorting[0].id;
        params.sortDir = sorting[0].desc ? 'DESC' : 'ASC';
      }

      console.log('📡 Fetching devices with params:', params);
      const result = await api.getDevices(params);
      setDevices(result.devices);
      setDevicesTotal(result.total);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  }

  const refreshInventory = useCallback(async (filters?: Record<string, string>) => {
    console.log('[App] refreshInventory called with filters:', filters);
    setLoading(true);
    try {
      const params = filters || { limit: '100', offset: '0' };
      console.log('[App] Calling API with params:', params);
      const invRes = await api.getInventory(params);
      console.log('[App] API response - items count:', invRes.items.length, 'total:', invRes.total);
      setInventory(invRes.items);
      setInventoryTotal(invRes.total);
    } catch (err) {
      console.error('Error refreshing inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create stable references for socket callbacks to avoid stale closures
  const refreshFns = useRef({ loadDashboardData, loadDevices, refreshInventory });

  useEffect(() => {
    refreshFns.current = { loadDashboardData, loadDevices, refreshInventory };
  });

  // Load data when filters change (includes initial load)
  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  // Load devices when page, sorting, or filters change
  useEffect(() => {
    loadDevices();
  }, [page, sorting, filters]);

  // Real-time updates via WebSockets
  useEffect(() => {
    const savedPort = localStorage.getItem('trustonic_api_port') || '3001';
    const socket = io(`http://localhost:${savedPort}`);

    socket.on('connect', () => {
      console.log('📡 Conectado al servidor de tiempo real');
    });

    socket.on('data_updated', (data: { type: string }) => {
      console.log('🔄 Notificación recibida:', data.type);

      showNotification({
        type: 'info',
        title: 'Actualización automática',
        message: 'Los datos se han sincronizado en tiempo real.',
        duration: 3000
      });

      // Use the latest versions of the functions from Ref
      const { current } = refreshFns;
      if (data.type === 'devices') {
        current.loadDevices();
      } else if (data.type === 'inventory') {
        current.refreshInventory();
      } else {
        current.loadDashboardData();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);


  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }


  function handleClearFilters() {
    setFilters({
      region: '',
      customer: '',
      status: '',
      solution: '',
      brand: '',
      search: '',
    });
    setPage(1);
  }

  async function handleExportPDF() {
    await exportToPDF({
      title: 'TrustonicReporting',
      subtitle: new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      filters: {
        Región: filters.region,
        Cliente: filters.customer,
        Estado: filters.status,
        Solución: filters.solution,
        Marca: filters.brand,
      },
      kpis: kpis || undefined,
      devices,
      chartsElement: chartsRef.current || undefined,
    });
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">T</div>
          <span className="sidebar-title">Trustonic</span>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <span>📊</span>
            Dashboard
          </div>
          <div
            className={`nav-item ${view === 'devices' ? 'active' : ''}`}
            onClick={() => setView('devices')}
          >
            <span>📱</span>
            Dispositivos
          </div>
          <div
            className={`nav-item ${view === 'inventory' ? 'active' : ''}`}
            onClick={() => setView('inventory')}
          >
            <span>📦</span>
            Inventario
          </div>
          <div
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            <span>⚙️</span>
            Configuración
          </div>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
          <div className="nav-item" onClick={loadDashboardData}>
            <span>🔄</span>
            Actualizar
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <div className="page-header">
          <h1 className="page-title">
            {view === 'dashboard' ? 'Dashboard de Validación' :
              view === 'devices' ? 'Lista de Dispositivos' :
                view === 'inventory' ? 'Inventario de Dispositivos' : 'Configuración del Sistema'}
          </h1>
          <div className="header-actions">
            {view !== 'settings' && (
              <button className="btn btn-primary" onClick={handleExportPDF}>
                📄 Exportar PDF
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {view !== 'settings' && view !== 'inventory' && (
          <Filters
            filters={filters}
            options={filterOptions}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        )}


        {/* Dashboard View */}
        {
          view === 'dashboard' && (
            <>
              <KPICards kpis={kpis} loading={loading} />

              <div ref={chartsRef}>
                <div className="charts-grid">
                  <StatusChart data={statusData} />
                  <RegionChart data={regionData} />
                </div>

                <div className="charts-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <SolutionChart data={solutionData} />
                </div>
              </div>
            </>
          )
        }

        {/* Devices View */}
        {
          view === 'devices' && (
            <DevicesTable
              devices={devices}
              loading={loading}
              total={devicesTotal}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onRefresh={loadDevices}
              sorting={sorting}
              onSortingChange={setSorting}
              globalFilter={filters.search}
              onGlobalFilterChange={(value) => handleFilterChange('search', value)}
            />
          )
        }

        {/* Inventory View */}
        {
          view === 'inventory' && (
            <div className="card">
              <InventoryTable
                items={inventory}
                loading={loading}
                total={inventoryTotal}
                onRefresh={() => refreshInventory()}
                onRefreshWithParams={refreshInventory}
              />
            </div>
          )
        }

        {/* Settings View */}
        {view === 'settings' && <SettingsView />}
      </main >
    </div >
  );
}

export default App;
