// --- IMPORTS ---
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ProfitCard from '../components/ProfitCard';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, 
  AreaChart, Area
} from 'recharts';

// --- CONSTANTS & UTILITIES ---
const PIE_COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8',
  '#82ca9d', '#a4de6c', '#d0ed57', '#a4c8e0', '#1a2340'
];

const formatCurrency = (val: number) =>
  val ? val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '€0';

const parsePercentage = (str: string | number): number => {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return parseFloat(str.replace('%', ''));
};

const CardStyle = {
  background: '#fff',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  padding: '24px',
  border: '1px solid rgba(0,0,0,0.02)',
  transition: 'transform 0.2s ease',
};

// --- TYPES ---
type HistoryItem = {
  id: number;
  fecha: string;
  valorNeto: number;
  rendimientoMensual: number;
  rendimientoYTD: number;
};

type DistributionItem = {
  id: number;
  categoria: string;
  valor: number;
  porcentaje: number;
};

type ReportData = {
  id: number;
  clienteId: number;
  fechaInforme: string;
  resumenEjecutivo: {
    desgloseBancos: Record<string, { deuda: number; custodia: number; fueraCustodia: number; patrimonioNeto: number }>;
    totalPatrimonio: number;
    deudaSobrePatrimonio: string;
    rendimientoAnualActual: string;
  };
  snapshot: {
    deuda: number;
    custodia: number;
    fueraCustodia: number;
    patrimonioNeto: number;
  };
  history: HistoryItem[];
  distribution: DistributionItem[];
  child_distribution: DistributionItem[];
};

type DashboardMetrics = {
  totalAUM: number;
  totalDebt: number;
  avgYtd: number;
  clientCount: number;
  topClient: { name: string; value: number } | null;
};

// --- COMPONENTS ---

// KPI Widget
const KpiWidget = ({
  label,
  value,
  subtext,
  iconColor = '#1a2340'
}: {
  label: string,
  value: string,
  subtext?: string,
  iconColor?: string
}) => (
  <div style={{
    ...CardStyle,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: '140px'
  }}>
    <div>
      <div style={{
        fontSize: '12px',
        color: '#64748b',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '8px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '28px',
        fontWeight: 800,
        color: '#1e293b',
        letterSpacing: '-0.5px'
      }}>
        {value}
      </div>
    </div>
    {subtext && (
      <div style={{
        fontSize: '13px',
        color: iconColor,
        fontWeight: 600,
        marginTop: '12px',
        background: `${iconColor}15`,
        padding: '4px 8px',
        borderRadius: '6px',
        width: 'fit-content'
      }}>
        {subtext}
      </div>
    )}
  </div>
);

// Section Title
const SectionTitle = ({ title }: { title: string }) => (
  <h3 style={{
    fontSize: 16,
    fontWeight: 700,
    color: '#1a2340',
    margin: '24px 0 12px 0'
  }}>{title}</h3>
);

// Helper: Get Initials
const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.split(/[@.\s]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
};

// Helper: Format Date
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString();
};

// Helper: Render Asset Chips
const renderAssetChips = (distribution: DistributionItem[], exclude: string, color: string) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    {distribution.filter(d => d.categoria !== exclude).map((d, i) => (
      <span key={i} style={{
        background: color === 'blue' ? '#e0f2fe' : '#fef9c3',
        color: color === 'blue' ? '#0369a1' : '#bfa14a',
        fontWeight: 700,
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: 14,
        marginBottom: 4,
        border: `1px solid ${color === 'blue' ? '#bae6fd' : '#fde68a'}`
      }}>
        {d.categoria}: {formatCurrency(d.valor)} ({d.porcentaje.toFixed(2)}%)
      </span>
    ))}
  </div>
);

// --- Client Circles Panel ---
const ClientCirclesPanel = ({
  getClientNameById,
  clients = [],
  onAddClientClick,
  authHeaders,
  setClients,
}: {
  getClientNameById: (id: number) => string;
  clients?: any[];
  onAddClientClick?: () => void;
  authHeaders: Record<string, string>;
  setClients: React.Dispatch<React.SetStateAction<any[]>>;
}) => {
  const API_BASE = '/api';
  const [hoveredClientId, setHoveredClientId] = useState<number | null>(null);
  const [changingActiveId, setChangingActiveId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; client: any | null }>({ open: false, client: null });

  // Handlers for activating/deactivating and deleting clients
  const handleToggleActive = async (client: any) => {
    setChangingActiveId(client.id);
    try {
      const url = `${API_BASE}/users/${client.id}/${client.isActive ? 'deactivate' : 'activate'}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: authHeaders as any,
      });
      if (res.ok) {
        // Update client in state
        setClients(prev =>
          prev.map(c =>
            c.id === client.id ? { ...c, isActive: !client.isActive } : c
          )
        );
      }
    } catch (e) {
      console.error('Error toggling client active state', e);
    } finally {
      setChangingActiveId(null);
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    setDeleteModal({ open: false, client: null });
    try {
      const res = await fetch(`${API_BASE}/users/${clientId}`, {
        method: 'DELETE',
        headers: authHeaders as any,
      });
      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== clientId));
      }
    } catch (e) {
      console.error('Error deleting client', e);
    }
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          justifyContent: 'center',
          alignItems: 'flex-start',
          minHeight: clients.length ? 180 : 0,
          transition: 'min-height 0.5s cubic-bezier(.68,-0.55,.27,1.55)',
        }}
      >
        {clients.map((client, idx) => (
          <div
            key={client.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 90,
              height: 90,
            }}
            onMouseEnter={() => setHoveredClientId(client.id)}
            onMouseLeave={() => setHoveredClientId(null)}
          >
            {/* Main Circle */}
            <div
              style={{
                background: '#fff',
                borderRadius: '50%',
                width: 90,
                height: 90,
                boxShadow: '0 4px 16px rgba(26,35,64,0.08)',
                border: '2px solid #e3e9f3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'box-shadow 0.3s, transform 0.3s',
                animation: `fadeInCircle 0.5s ${0.1 * idx}s cubic-bezier(.68,-0.55,.27,1.55) both`,
                zIndex: hoveredClientId === client.id ? 2 : 1,
              }}
            >
              <div style={{
                fontWeight: 700,
                fontSize: 28,
                color: '#1a2340',
                letterSpacing: 2,
                fontFamily: 'Segoe UI, Merriweather, sans-serif',
                marginBottom: 2,
              }}>
                {(client?.name?.charAt(0)?.toUpperCase()) + (client?.surname?.charAt(0)?.toUpperCase() || '')}
              </div>
              <div style={{
                fontSize: 12,
                color: '#888',
                textAlign: 'center',
                fontWeight: 600,
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 80,
              }}>
                {client.name + (client.surname ? ' ' + client.surname : '')}
              </div>
            </div>
            {/* Hover Action Circles */}
            {hoveredClientId === client.id && (
              <>
                {/* Toggle Active Circle (Left) */}
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: -18,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: client.isActive ? '#22c55e' : '#fbbf24',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(26,35,64,0.10)',
                    cursor: changingActiveId === client.id ? 'not-allowed' : 'pointer',
                    border: '2px solid #fff',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  title={client.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                  onClick={() => changingActiveId !== client.id && handleToggleActive(client)}
                >
                  {changingActiveId === client.id ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="3" opacity="0.5" />
                      <path d="M10 4v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="1s" repeatCount="indefinite" />
                      </path>
                    </svg>
                  ) : client.isActive ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="3" />
                      <path d="M7 10.5l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="8" stroke="#fff" strokeWidth="3" />
                      <path d="M6 10h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {/* Delete Circle (Right) */}
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    right: -18,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#e74c3c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(26,35,64,0.10)',
                    cursor: changingActiveId === client.id ? 'not-allowed' : 'pointer',
                    border: '2px solid #fff',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  title="Eliminar cliente"
                  onClick={() => changingActiveId !== client.id && setDeleteModal({ open: true, client })}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="5.5" y="8" width="9" height="7" rx="2" stroke="#fff" strokeWidth="2" />
                    <path d="M8 8V6.5A2.5 2.5 0 0110.5 4h0A2.5 2.5 0 0113 6.5V8" stroke="#fff" strokeWidth="2" />
                    <path d="M7 8h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              </>
            )}
          </div>
        ))}
        {/* Add Client Button */}
        {onAddClientClick && (
          <div
            style={{
              background: '#f8fafc',
              borderRadius: '50%',
              width: 90,
              height: 90,
              border: '2px dashed #bfa14a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#bfa14a',
              fontWeight: 700,
              fontSize: 36,
              transition: 'background 0.2s',
              marginLeft: 8,
            }}
            onClick={onAddClientClick}
          >
            +
          </div>
        )}
        <style>{`
          @keyframes fadeInCircle {
            0% { opacity: 0; transform: scale(0.85) translateY(30px);}
            100% { opacity: 1; transform: scale(1) translateY(0);}
          }
        `}</style>
      </div>
      {/* Delete Modal */}
      {deleteModal.open && deleteModal.client && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(26,35,64,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            padding: '32px 28px',
            minWidth: 320,
            maxWidth: '90vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'popInModal 0.3s cubic-bezier(.68,-0.55,.27,1.55)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#e74c3c', marginBottom: 12 }}>
              ¿Estás seguro que quieres eliminar al usuario?
            </div>
            <div style={{ fontSize: 16, color: '#1a2340', marginBottom: 24, textAlign: 'center' }}>
              <b>{deleteModal.client.name}{deleteModal.client.surname ? ' ' + deleteModal.client.surname : ''}</b>
            </div>
            <div style={{ display: 'flex', gap: 18 }}>
              <button
                onClick={() => setDeleteModal({ open: false, client: null })}
                style={{
                  padding: '10px 28px',
                  border: '1px solid #ddd',
                  background: '#fff',
                  color: '#555',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                No
              </button>
              <button
                onClick={() => handleDeleteClient(deleteModal.client.id)}
                style={{
                  padding: '10px 28px',
                  border: 'none',
                  background: '#e74c3c',
                  color: '#fff',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- MAIN DASHBOARD COMPONENT ---
function Dashboard() {
  const router = useRouter();
  const { auth } = useAuth();
  const API_BASE = '/api';

  // --- STATE ---
  const [clients, setClients] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportPreview, setReportPreview] = useState<ReportData | null>(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [addClientError, setAddClientError] = useState<string | null>(null);
  const [addClientSuccess, setAddClientSuccess] = useState(false);
  const [addClientForm, setAddClientForm] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    role: 'client',
    isActive: true,
  });

  // Handle Add Client Form Change
  const handleAddClientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setAddClientForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' && e.target instanceof HTMLInputElement ? e.target.checked : value,
    }));
  };

  // --- MEMOIZED HEADERS ---
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return headers;
  }, [auth?.token]);

  // --- HELPERS ---
  const getClientNameById = (id: number) => {
    const client = clients.find(c => c.id === id);
    if (!client) return `#${id}`;
    return `${client.name}${client.surname ? ' ' + client.surname : ''}`;
  };

  // --- FETCH CLIENTS ---
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API_BASE}/users?role=client`, { headers: authHeaders as any });
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) { console.error("Error fetching clients", e); }
    };
    fetchClients();
  }, [authHeaders]);

  // --- AGGREGATE DATA ---
  const { metrics, aggregatedDistribution, topClientsData } = useMemo(() => {
    if (!reports.length) return { metrics: null, aggregatedDistribution: [], topClientsData: [] };

    // 1. Filter: Get only the LATEST report per client to avoid double counting AUM
    const latestReportsMap = new Map<number, ReportData>();
    reports.forEach(r => {
      const existing = latestReportsMap.get(r.clienteId);
      if (!existing || new Date(r.fechaInforme) > new Date(existing.fechaInforme)) {
        latestReportsMap.set(r.clienteId, r);
      }
    });
    const uniqueReports = Array.from(latestReportsMap.values());

    // 2. Calculate Metrics
    const totalAUM = uniqueReports.reduce((sum, r) => sum + (r.resumenEjecutivo?.totalPatrimonio || 0), 0);
    const totalDebt = uniqueReports.reduce((sum, r) => sum + (r.snapshot?.deuda || 0), 0);

    // Avg YTD (weighted could be better, but simple avg for now)
    const validYtds = uniqueReports
      .map(r => parsePercentage(r.resumenEjecutivo?.rendimientoAnualActual))
      .filter(n => !isNaN(n));
    const avgYtd = validYtds.length ? validYtds.reduce((a, b) => a + b, 0) / validYtds.length : 0;

    // Top Client
    const topClientObj = uniqueReports.reduce((prev, curr) =>
      (curr.resumenEjecutivo?.totalPatrimonio > prev.resumenEjecutivo?.totalPatrimonio) ? curr : prev
      , uniqueReports[0]);

    // 3. Aggregate Distribution (Global Allocation)
    const distMap = new Map<string, number>();
    uniqueReports.forEach(r => {
      r.distribution?.forEach(d => {
        if (d.categoria !== 'Total') {
          const current = distMap.get(d.categoria) || 0;
          distMap.set(d.categoria, current + d.valor);
        }
      });
    });
    const aggregatedDistribution = Array.from(distMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 4. Top Clients Chart Data
    const topClientsData = uniqueReports
      .map(r => ({
        name: `${getClientNameById(r.clienteId)}`,
        value: r.resumenEjecutivo?.totalPatrimonio || 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      metrics: {
        totalAUM,
        totalDebt,
        avgYtd,
        clientCount: uniqueReports.length,
        topClient: topClientObj ? { name: `${getClientNameById(topClientObj.clienteId)}`, value: topClientObj.resumenEjecutivo.totalPatrimonio } : null
      },
      aggregatedDistribution,
      topClientsData
    };
  }, [reports, clients]);

  // --- FETCH REPORTS / DOCS ---
  useEffect(() => {
    if (!auth?.token) return;

    if (auth.role === 'admin') {
      // Admin Fetch
      const fetchReports = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/xlsx/all/${dateRange.from}/${dateRange.to}`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          if (res.ok) {
            const json = await res.json();
            const data = Array.isArray(json) ? json : json.data;
            setReports(Array.isArray(data) ? data : []);
          }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
      };
      fetchReports();
    } else {
      // Client Fetch (Original Logic)
      const fetchLast = async () => {
        try {
          const res = await fetch(`${API_BASE}/documents`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const visibles = data.filter((doc: any) => !doc.user || doc.user.id === auth.userId);
              if (visibles.length > 0) setLastDoc(visibles[0]);
            }
          }
        } catch (e) { console.error(e); }
      };
      fetchLast();
    }
  }, [auth, dateRange]);

  if (!auth) return <div className="loading-container">Cargando...</div>;

  // --- ADMIN VIEW ---
  if (auth.role === 'admin') {
    async function handleAddClientSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setAddClientLoading(true);
      setAddClientError(null);
      setAddClientSuccess(false);

      try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: authHeaders as any,
        body: JSON.stringify(addClientForm),
      });
      if (!res.ok) {
        const errorData = await res.json();
        setAddClientError(errorData?.message || 'Error al crear el cliente');
      } else {
        setAddClientSuccess(true);
        setShowAddClientModal(false);
        setAddClientForm({
        name: '',
        surname: '',
        email: '',
        password: '',
        role: 'client',
        isActive: true,
        });
        // Refetch clients
        const clientsRes = await fetch(`${API_BASE}/users?role=client`, { headers: authHeaders as any });
        const clientsData = await clientsRes.json();
        setClients(Array.isArray(clientsData) ? clientsData : []);
      }
      } catch (e: any) {
      setAddClientError('Error de red al crear el cliente');
      } finally {
      setAddClientLoading(false);
      }
    }
    function handleAddClient(): void {
      setShowAddClientModal(true);
      setAddClientError(null);
      setAddClientSuccess(false);
      setAddClientForm({
      name: '',
      surname: '',
      email: '',
      password: '',
      role: 'client',
      isActive: true,
      });
    }
    return (
      <div className="dashboard-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: 60 }}>
        <Header variant="dashboard" title="Panel Principal" />
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '0 32px' }}>
          {/* CONTROL BAR */}
          <div style={{
            marginTop: 32, marginBottom: 32, background: '#fff', padding: '16px 24px', borderRadius: 12,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Resumen Global de Inversiones</h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Datos agregados en tiempo real de los informes de clientes</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#f1f5f9', padding: '8px 16px', borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Periodo:</span>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                style={{ background: 'transparent', border: 'none', fontWeight: 600, color: '#0f172a', outline: 'none' }}
              />
              <span style={{ color: '#cbd5e1' }}>→</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                style={{ background: 'transparent', border: 'none', fontWeight: 600, color: '#0f172a', outline: 'none' }}
              />
            </div>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>Cargando datos del panel...</div>
          ) : !metrics ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>No se encontraron informes en este rango.</div>
          ) : (
            <>
              {/* KPIS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
                <KpiWidget
                  label="Patrimonio Bajo Gestión"
                  value={formatCurrency(metrics.totalAUM)}
                  subtext={`Entre ${metrics.clientCount} clientes`}
                  iconColor="#0ea5e9"
                />
                <KpiWidget
                  label="Deuda Total"
                  value={formatCurrency(metrics.totalDebt)}
                  subtext={`${((Math.abs(metrics.totalDebt) / metrics.totalAUM) * 100).toFixed(2)}% Ratio de Apalancamiento`}
                  iconColor="#ef4444"
                />
                <KpiWidget
                  label="Rentabilidad YTD Promedio"
                  value={`${metrics.avgYtd.toFixed(2)}%`}
                  subtext="Media ponderada global"
                  iconColor="#22c55e"
                />
                <KpiWidget
                  label="Mayor Volumen Cliente"
                  value={metrics.topClient ? formatCurrency(metrics.topClient.value) : '€0'}
                  subtext={metrics.topClient?.name}
                  iconColor="#eab308"
                />
              </div>
              {/* CHARTS & CLIENTS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 24, marginBottom: 32 }}>
                {/* Pie Chart */}
                <div style={CardStyle}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>Distribución Global de Activos</h3>
                  <div style={{ height: 350, width: '100%' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={aggregatedDistribution}
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {aggregatedDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value?: number) => formatCurrency(value ?? 0)}
                          contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* Clients */}
                <div style={{ ...CardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: 400 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>Clientes</h3>
                  <ClientCirclesPanel
                    getClientNameById={getClientNameById}
                    clients={clients}
                    onAddClientClick={handleAddClient}
                    authHeaders={authHeaders}
                    setClients={setClients}
                  />
                  {showAddClientModal && (
                    <div style={{
                      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                      background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                      animation: 'fadeInModal 0.4s cubic-bezier(.68,-0.55,.27,1.55)'
                    }}>
                      <form onSubmit={handleAddClientSubmit} style={{
                        background: '#fff', width: '90%', maxWidth: 480, borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        display: 'flex', flexDirection: 'column', padding: 36, gap: 18, position: 'relative',
                        animation: 'popInModal 0.5s cubic-bezier(.68,-0.55,.27,1.55)'
                      }}>
                        <h2 style={{ margin: 0, color: '#1a2340', fontSize: 22, fontWeight: 800, textAlign: 'center', letterSpacing: 1 }}>Registrar Nuevo Cliente</h2>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <input name="name" value={addClientForm.name} onChange={handleAddClientChange} required placeholder="Nombre" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
                          <input name="surname" value={addClientForm.surname} onChange={handleAddClientChange} placeholder="Apellidos" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
                        </div>
                        <input name="email" value={addClientForm.email} onChange={handleAddClientChange} required type="email" placeholder="Email" style={{ padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
                        <input name="password" value={addClientForm.password} onChange={handleAddClientChange} required type="password" placeholder="Contraseña" style={{ padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
                        <input type="hidden" name="isActive" value="true" />
                        {/* No "Activo" checkbox needed, as el cliente siempre estará activo */}
                        {addClientError && <div style={{ color: '#e74c3c', fontWeight: 600, textAlign: 'center' }}>{addClientError}</div>}
                        {/* Ensure isActive is always true in the JSON sent to the API */}
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button type="button" onClick={() => setShowAddClientModal(false)} style={{ padding: '12px 24px', border: '1px solid #ddd', background: '#fff', color: '#555', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '15px', transition: 'background 0.2s' }}>Cancelar</button>
                          <button type="submit" disabled={addClientLoading} style={{ padding: '12px 32px', border: 'none', background: addClientLoading ? '#ccc' : '#1a2340', color: '#fff', borderRadius: '6px', fontWeight: 700, cursor: addClientLoading ? 'not-allowed' : 'pointer', fontSize: '15px', boxShadow: '0 4px 12px rgba(26, 35, 64, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}>{addClientLoading ? 'Creando...' : 'Registrar'}</button>
                        </div>
                        <style>{`
                          @keyframes fadeInModal { 0% { opacity: 0; } 100% { opacity: 1; } }
                          @keyframes popInModal { 0% { transform: scale(0.85) translateY(40px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
                        `}</style>
                      </form>
                    </div>
                  )}
                </div>
              </div>
              {/* REPORTS TABLE */}
              <div style={{ ...CardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '24px 24px 0 24px', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Registro de Últimos Informes</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Fecha Informe</th>
                        <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Cliente</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Patrimonio Neto</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Ratio Deuda</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>Rentabilidad YTD</th>
                        <th style={{ padding: '16px 24px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr key={report.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="hover:bg-gray-50">
                          <td style={{ padding: '16px 24px', color: '#334155' }}>
                            {new Date(report.fechaInforme).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#334155', fontWeight: 500 }}>
                            {getClientNameById(report.clienteId)}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                            {formatCurrency(report.resumenEjecutivo?.totalPatrimonio)}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>
                            {report.resumenEjecutivo?.deudaSobrePatrimonio}
                          </td>
                          <td style={{
                            padding: '16px 24px',
                            textAlign: 'right',
                            color: parsePercentage(report.resumenEjecutivo?.rendimientoAnualActual) >= 0 ? '#22c55e' : '#ef4444',
                            fontWeight: 700
                          }}>
                            {report.resumenEjecutivo?.rendimientoAnualActual}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <button
                              style={{
                                background: 'none',
                                border: '1px solid #e2e8f0',
                                padding: '6px 12px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#475569'
                              }}
                              onClick={() => { setReportPreview(report); setModalOpen(true); }}
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* MODAL */}
              {modalOpen && reportPreview && (
                <div style={{
                  position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                  background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                  <div style={{
                    background: '#fff', width: '90%', maxWidth: '1000px', height: '90vh',
                    borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                  }}>
                    {/* Modal Header */}
                    <div style={{
                      padding: '24px 32px', borderBottom: '1px solid #eee',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#fcfcfc'
                    }}>
                      <div>
                        <h2 style={{ margin: 0, color: '#1a2340', fontSize: '20px', fontWeight: 700 }}>Vista Previa de Informe</h2>
                        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '13px' }}>
                          Fecha del reporte: <b style={{ color: '#1a2340' }}>{formatDate(reportPreview.fechaInforme)}</b>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase' }}>Cliente</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a2340' }}>{getClientNameById(reportPreview.clienteId)}</div>
                      </div>
                    </div>
                    {/* Modal Scrollable Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                      {/* 1. KPIs Row */}
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
                        <KpiWidget
                          label="PATRIMONIO TOTAL"
                          value={formatCurrency(reportPreview.resumenEjecutivo?.totalPatrimonio)}
                          subtext={undefined} iconColor="#217a3c" />
                        <KpiWidget
                          label="RENDIMIENTO ANUAL (YTD)"
                          value={reportPreview.resumenEjecutivo?.rendimientoAnualActual ?? '0%'}
                          subtext="Rentabilidad Acumulada" iconColor="#217a3c" />
                        <KpiWidget
                          label="APALANCAMIENTO"
                          value={reportPreview.resumenEjecutivo?.deudaSobrePatrimonio ?? '0%'}
                          subtext={undefined} iconColor="#217a3c" />
                      </div>
                      {/* 2. Snapshot & Desglose Bancos */}
                      <SectionTitle title="Posición Financiera" />
                      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginBottom: '24px' }}>
                        {/* Snapshot Table */}
                        <div style={{ flex: 1, minWidth: '300px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <tbody>
                              {[
                                { l: 'Custodia', v: reportPreview.snapshot?.custodia, b: false },
                                { l: 'Fuera de Custodia', v: reportPreview.snapshot?.fueraCustodia, b: false },
                                { l: 'Deuda', v: reportPreview.snapshot?.deuda, b: false, c: '#e74c3c' },
                                { l: 'Patrimonio Neto', v: reportPreview.snapshot?.patrimonioNeto, b: true, c: '#217a3c' },
                              ].map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '12px 0', color: '#666' }}>{row.l}</td>
                                  <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: row.b ? 700 : 500, color: row.c || '#1a2340' }}>
                                    {formatCurrency(row.v)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Bank Breakdown Cards */}
                        {reportPreview.resumenEjecutivo?.desgloseBancos && (
                          <div style={{ flex: 2, display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' }}>
                            {Object.entries(reportPreview.resumenEjecutivo.desgloseBancos).map(([banco, datos]: any, idx) => (
                              <div key={banco} style={{
                                minWidth: '220px', background: '#f8f9fa', borderRadius: '8px', padding: '16px',
                                borderLeft: `4px solid ${PIE_COLORS[idx % PIE_COLORS.length]}`
                              }}>
                                <div style={{ fontWeight: 700, color: '#1a2340', marginBottom: '8px' }}>{banco}</div>
                                <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.6' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span>Neto:</span>
                                    <b>{formatCurrency(datos.patrimonioNeto)}</b>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span>Custodia:</span>
                                    <b>{formatCurrency(datos.custodia)}</b>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span>Fuera Custodia:</span>
                                    <b>{formatCurrency(datos.fueraCustodia)}</b>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Deuda:</span>
                                    <b>{formatCurrency(datos.deuda)}</b>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* 3. Distribución Assets */}
                      {(reportPreview.distribution?.length > 0 || reportPreview.child_distribution?.length > 0) && (
                        <>
                          <SectionTitle title="Distribución de Activos" />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {reportPreview.distribution?.length > 0 && (
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Cartera Principal</div>
                                {renderAssetChips(reportPreview.distribution, 'Total', 'blue')}
                              </div>
                            )}
                            {reportPreview.child_distribution?.length > 0 && (
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Sub-Carteras / Hijos</div>
                                {renderAssetChips(reportPreview.child_distribution, 'Total', 'gold')}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      {/* 4. Chart & History */}
                      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', marginTop: '32px', alignItems: 'flex-start' }}>
                        {/* Historico Table */}
                        <div style={{ flex: 1, minWidth: '300px' }}>
                          <SectionTitle title="Evolución Histórica" />
                          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                              <thead style={{ background: '#f8f9fa' }}>
                                <tr>
                                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340' }}>Fecha</th>
                                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340', textAlign: 'right' }}>Valor</th>
                                  <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340', textAlign: 'right' }}>% Mes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportPreview.history?.slice(-6).map((h, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                    <td style={{ padding: '10px 16px', color: '#555' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>{h.valorNeto?.toLocaleString()}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right', color: (h.rendimientoMensual || 0) >= 0 ? '#217a3c' : '#e74c3c' }}>
                                      {(h.rendimientoMensual || 0) > 0 ? '+' : ''}{h.rendimientoMensual?.toFixed(2)}%
                                    </td>
                                  </tr>
                                ))}
                                {(!reportPreview.history || reportPreview.history.length === 0) && (
                                  <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#999' }}>Sin histórico reciente</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {/* Pie Chart for Distribución de Activos */}
                        <div style={{ flex: 1, minWidth: '320px', maxWidth: 400 }}>
                          <SectionTitle title="Distribución de Activos" />
                          <div style={{ height: 260, width: '100%' }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={reportPreview.distribution?.filter(d => d.categoria !== 'Total') || []}
                                  dataKey="valor"
                                  nameKey="categoria"
                                  innerRadius={60}
                                  outerRadius={90}
                                  paddingAngle={5}
                                >
                                  {(reportPreview.distribution?.filter(d => d.categoria !== 'Total') || []).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value?: number) => formatCurrency(value ?? 0)}
                                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={32} iconType="circle" />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Modal Actions Footer */}
                    <div style={{
                      padding: '24px 32px', borderTop: '1px solid #eee', background: '#fff',
                      display: 'flex', gap: '16px', justifyContent: 'flex-end'
                    }}>
                      <button
                        onClick={() => setModalOpen(false)}
                        style={{
                          padding: '12px 24px', border: '1px solid #ddd', background: '#fff', color: '#555',
                          borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                          transition: 'background 0.2s'
                        }}
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

 
/* --- USER REPORTS DASHBOARD --- */

// --- Custom KPI Card for User ---
const KpiCard = ({
  label,
  value,
  subValue,
  isHighlight = false,
}: {
  label: string;
  value: string;
  subValue?: string;
  isHighlight?: boolean;
}) => (
  <div
    style={{
      background: isHighlight ? '#f0f9ff' : '#fff',
      borderRadius: 14,
      boxShadow: isHighlight ? '0 4px 24px #bae6fd55' : '0 2px 10px #e5e7eb',
      padding: '20px 24px',
      minWidth: 180,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      border: isHighlight ? '2px solid #38bdf8' : '1px solid #e5e7eb',
      marginBottom: 8,
    }}
  >
    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b', marginBottom: subValue ? 2 : 0 }}>{value}</div>
    {subValue && (
      <div style={{ fontSize: 13, color: '#0ea5e9', fontWeight: 600, marginTop: 2 }}>{subValue}</div>
    )}
  </div>
);

// --- Custom Tooltip for PieChart ---
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '8px 14px',
        fontSize: 14,
        color: '#1a2340',
        boxShadow: '0 2px 8px #0001'
      }}>
        <b>{payload[0].name}</b>
        <div>{formatCurrency(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

// --- Helper: Group reports by year/month ---
function groupReportsByYearMonth(reports: ReportData[]) {
  const grouped: Record<string, Record<string, ReportData[]>> = {};
  reports.forEach((r) => {
    const d = new Date(r.fechaInforme);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = [];
    grouped[year][month].push(r);
  });
  return grouped;
}

// --- USER REPORTS DASHBOARD COMPONENT ---
const UserReportsDashboard = ({
  auth,
  API_BASE,
  formatCurrency,
  PIE_COLORS,
  parsePercentage,
  renderAssetChips,
  SectionTitle,
  CardStyle,
  formatDate,
}: any) => {
  const [userReports, setUserReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  // Fetch all user reports
  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    fetch(`${API_BASE}/xlsx/myinfo/${dateRange.from}/${dateRange.to}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : data.data;
        setUserReports(arr || []);
        // Default to latest year/month
        if (arr && arr.length) {
          const sorted = [...arr].sort((a, b) => new Date(b.fechaInforme).getTime() - new Date(a.fechaInforme).getTime());
          const d = new Date(sorted[0].fechaInforme);
          setSelectedYear(d.getFullYear().toString());
          setSelectedMonth((d.getMonth() + 1).toString().padStart(2, '0'));
          setSelectedReport(sorted[0]);
        }
      })
      .finally(() => setLoading(false));
  }, [auth?.token, auth?.userId]);

  // Grouped by year/month for toggles
  const grouped = useMemo(() => groupReportsByYearMonth(userReports), [userReports]);
  const years = useMemo(() => Object.keys(grouped).sort((a, b) => Number(b) - Number(a)), [grouped]);
  const months = useMemo(() => selectedYear ? Object.keys(grouped[selectedYear] || {}).sort((a, b) => Number(b) - Number(a)) : [], [grouped, selectedYear]);
  const reportsForSelected = useMemo(() => (selectedYear && selectedMonth && grouped[selectedYear]?.[selectedMonth]) || [], [grouped, selectedYear, selectedMonth]);

  // Pie data for chart
  const pieData = useMemo(() => {
    if (!selectedReport) return [];
    return (selectedReport.distribution || []).filter((d) => d.categoria !== 'Total').map((d) => ({
      name: d.categoria,
      value: d.valor,
    }));
  }, [selectedReport]);

  // Extra metrics
  const extraMetrics = useMemo(() => {
    if (!selectedReport) return null;
    const hist = selectedReport.history || [];
    const last = hist[0];
    const first = hist[hist.length - 1];
    const totalReturn = last && first ? ((last.valorNeto / first.valorNeto - 1) * 100) : 0;
    const maxDrawdown = hist.reduce((max, h, i, arr) => {
      const peak = Math.max(...arr.slice(0, i + 1).map(x => x.valorNeto));
      const dd = (peak - h.valorNeto) / peak;
      return Math.max(max, dd);
    }, 0);
    return {
      totalReturn,
      maxDrawdown: maxDrawdown * 100,
      months: hist.length,
    };
  }, [selectedReport]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 0' }}>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1a2340', marginBottom: 8 }}>Tus Informes de Inversión</h2>
      <p style={{ color: '#64748b', marginBottom: 24, textAlign: 'center' }}>
        Visualiza y explora la evolución de tu patrimonio, rentabilidad y distribución de activos por mes y año.
      </p>
      {/* Year/Month Toggles */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontWeight: 600, color: '#64748b', marginRight: 8 }}>Año:</span>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { setSelectedYear(y); setSelectedMonth(''); setSelectedReport(null); }}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: y === selectedYear ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                background: y === selectedYear ? '#e0f2fe' : '#fff',
                color: y === selectedYear ? '#0369a1' : '#1a2340',
                fontWeight: 700,
                marginRight: 4,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              {y}
            </button>
          ))}
        </div>
        {selectedYear && (
          <div>
            <span style={{ fontWeight: 600, color: '#64748b', marginRight: 8 }}>Mes:</span>
            {months.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setSelectedMonth(m);
                  const rep = grouped[selectedYear][m]?.sort((a, b) => new Date(b.fechaInforme).getTime() - new Date(a.fechaInforme).getTime())[0];
                  setSelectedReport(rep || null);
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 8,
                  border: m === selectedMonth ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                  background: m === selectedMonth ? '#e0f2fe' : '#fff',
                  color: m === selectedMonth ? '#0369a1' : '#1a2340',
                  fontWeight: 700,
                  marginRight: 4,
                  cursor: 'pointer',
                  fontSize: 15,
                }}
              >
                {new Date(2000, Number(m) - 1).toLocaleString('es-ES', { month: 'short' }).toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Report Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 60 }}>Cargando informes...</div>
      ) : !selectedReport ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 60 }}>Selecciona año y mes para ver tu informe.</div>
      ) : (
        <div style={{ ...CardStyle, padding: 0, overflow: 'hidden' }}>
          {/* --- USER REPORT MODAL-LIKE PRESENTATION --- */}
          <div style={{ padding: '32px 32px 0 32px' }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
              borderBottom: '1px solid #f1f5f9', paddingBottom: 12
            }}>
              <div>
                <h3 style={{ margin: 0, color: '#1a2340', fontSize: 22, fontWeight: 800 }}>Informe de {formatDate(selectedReport.fechaInforme)}</h3>
                <div style={{ color: '#64748b', fontSize: 14, marginTop: 2 }}>
                  <b>Patrimonio Neto:</b> {formatCurrency(selectedReport.resumenEjecutivo?.totalPatrimonio)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#999', textTransform: 'uppercase' }}>Rentabilidad YTD</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e' }}>{selectedReport.resumenEjecutivo?.rendimientoAnualActual}</div>
              </div>
            </div>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 32 }}>
              <KpiCard
                label="PATRIMONIO TOTAL"
                value={formatCurrency(selectedReport.resumenEjecutivo?.totalPatrimonio)}
                isHighlight
              />
              <KpiCard
                label="RENDIMIENTO ANUAL (YTD)"
                value={selectedReport.resumenEjecutivo?.rendimientoAnualActual ?? '0%'}
                isHighlight
                subValue="Rentabilidad Acumulada"
              />
              <KpiCard
                label="APALANCAMIENTO"
                value={selectedReport.resumenEjecutivo?.deudaSobrePatrimonio ?? '0%'}
              />
              <KpiCard
                label="Deuda Total"
                value={formatCurrency(selectedReport.snapshot?.deuda)}
              />
              <KpiCard
                label="Custodia"
                value={formatCurrency(selectedReport.snapshot?.custodia)}
              />
              <KpiCard
                label="Fuera Custodia"
                value={formatCurrency(selectedReport.snapshot?.fueraCustodia)}
              />
              {extraMetrics && (
                <>
                  <KpiCard
                    label="Rentabilidad Total"
                    value={extraMetrics.totalReturn ? `${extraMetrics.totalReturn.toFixed(2)}%` : '0%'}
                    subValue="Desde el primer informe"
                  />
                  <KpiCard
                    label="Máx. Drawdown"
                    value={extraMetrics.maxDrawdown ? `${extraMetrics.maxDrawdown.toFixed(2)}%` : '0%'}
                    subValue="Caída máxima"
                  />
                  <KpiCard
                    label="Meses de Histórico"
                    value={Number(extraMetrics.months).toString()}
                  />
                </>
              )}
            </div>
            {/* Bank Breakdown */}
            <SectionTitle title="Desglose por Bancos" />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
              {selectedReport.resumenEjecutivo?.desgloseBancos &&
                Object.entries(selectedReport.resumenEjecutivo.desgloseBancos).map(([banco, datos]: any, idx) => (
                  <div key={banco} style={{
                    minWidth: 200, background: '#f8fafc', borderRadius: 8, padding: 16,
                    borderLeft: `4px solid ${PIE_COLORS[idx % PIE_COLORS.length]}`,
                    flex: 1,
                  }}>
                    <div style={{ fontWeight: 700, color: '#1a2340', marginBottom: 8 }}>{banco}</div>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Neto:</span>
                        <b>{formatCurrency(datos.patrimonioNeto)}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Custodia:</span>
                        <b>{formatCurrency(datos.custodia)}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>Fuera Custodia:</span>
                        <b>{formatCurrency(datos.fueraCustodia)}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Deuda:</span>
                        <b>{formatCurrency(datos.deuda)}</b>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            {/* Distribución de Activos */}
            {(selectedReport.distribution?.length > 0 || selectedReport.child_distribution?.length > 0) && (
              <>
                <SectionTitle title="Distribución de Activos" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
                  {selectedReport.distribution?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Cartera Principal</div>
                      {renderAssetChips(selectedReport.distribution, 'Total', 'blue')}
                    </div>
                  )}
                  {selectedReport.child_distribution?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>Sub-Carteras / Hijos</div>
                      {renderAssetChips(selectedReport.child_distribution, 'Total', 'gold')}
                    </div>
                  )}
                </div>
              </>
            )}
            {/* Chart & History */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 32, alignItems: 'flex-start' }}>
              {/* Historico Table */}
              <div style={{ flex: 1, minWidth: 320 }}>
                <SectionTitle title="Evolución Histórica" />
                <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead style={{ background: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340' }}>Fecha</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340', textAlign: 'right' }}>Valor</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340', textAlign: 'right' }}>% Mes</th>
                        <th style={{ padding: '12px 16px', fontWeight: 600, color: '#1a2340', textAlign: 'right' }}>% YTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReport.history || []).slice(0, 12).map((h, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '10px 16px', color: '#555' }}>{new Date(h.fecha).toLocaleDateString()}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>{h.valorNeto?.toLocaleString()}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: (h.rendimientoMensual || 0) >= 0 ? '#217a3c' : '#e74c3c' }}>
                            {(h.rendimientoMensual || 0) > 0 ? '+' : ''}{h.rendimientoMensual?.toFixed(2)}%
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', color: (h.rendimientoYTD || 0) >= 0 ? '#217a3c' : '#e74c3c' }}>
                            {(h.rendimientoYTD || 0) > 0 ? '+' : ''}{h.rendimientoYTD?.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                      {(!selectedReport.history || selectedReport.history.length === 0) && (
                        <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#999' }}>Sin histórico reciente</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Pie Chart */}
              {pieData.length > 0 && (
                <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <SectionTitle title="Composición Visual" />
                  <div style={{ width: '100%', height: 250, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Text */}
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -65%)',
                      textAlign: 'center', pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1a2340' }}>{pieData.length}</div>
                      <div style={{ fontSize: 12, color: '#999' }}>Activos</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- RENDER USER DASHBOARD IF CLIENT ---
if (auth.role === 'client') {
  return (
    <div className="dashboard-container" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 60 }}>
      <Header variant="dashboard" title="Panel Personal" />
      <UserReportsDashboard
        auth={auth}
        API_BASE={API_BASE}
        formatCurrency={formatCurrency}
        PIE_COLORS={PIE_COLORS}
        parsePercentage={parsePercentage}
        renderAssetChips={renderAssetChips}
        SectionTitle={SectionTitle}
        CardStyle={CardStyle}
        formatDate={formatDate}
      />
    </div>
  );
}
}

export default withAuth(Dashboard, ['client', 'admin', 'superadmin']);