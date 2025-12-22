import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ProfitCard from '../components/ProfitCard';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area
} from 'recharts';

// --- TIPOS (Adaptados a tu estructura JSON) ---

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
    deudaSobrePatrimonio: string; // "13.85%"
    rendimientoAnualActual: string; // "3.38%"
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

// --- CONSTANTES Y UTILIDADES ---

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

// --- SUBCOMPONENTES ---

const KpiWidget = ({ label, value, subtext, iconColor = '#1a2340' }: { label: string, value: string, subtext?: string, iconColor?: string }) => (
  <div style={{ ...CardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
    <div>
      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>
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

// --- COMPONENTE PRINCIPAL ---

function Dashboard() {
  const router = useRouter();
  const { auth } = useAuth();
  const API_BASE = '/api';

  // Client State
  const [lastDoc, setLastDoc] = useState<any>(null);
  
  // Admin State
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);

  // --- PROCESADO DE DATOS ADMIN ---
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
        name: `Client ${r.clienteId}`, // Replace with email if available in your data
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
        topClient: topClientObj ? { name: `ID #${topClientObj.clienteId}`, value: topClientObj.resumenEjecutivo.totalPatrimonio } : null
      },
      aggregatedDistribution,
      topClientsData
    };
  }, [reports]);

  // --- EFECTOS ---

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
            // Handle array directly or nested in data property
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

  // --- VISTA ADMINISTRADOR ---
  if (auth.role === 'admin') {
    return (
      <div className="dashboard-container" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: 60 }}>
        <Header variant="dashboard" title="Torre de Control" />
        
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
              {/* FILA DE KPIS */}
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

{/* FILA DE GRÁFICAS Y CLIENTES */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 24, marginBottom: 32 }}>
  {/* 1. Distribución Global Pie */}
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
          <Legend verticalAlign="bottom" height={36} iconType="circle"/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>

  {/* 2. Visualización de Clientes tipo "Contactos" */}
  <div style={{ ...CardStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: 400 }}>
    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 24 }}>Clientes</h3>
    <ClientCirclesPanel reports={reports} />
  </div>
</div>

              {/* TABLA DETALLADA */}
              <div style={{ ...CardStyle, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '24px 24px 0 24px', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Registro de Últimos Informes</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Fecha Informe</th>
                        <th style={{ padding: '16px 24px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>ID Cliente</th>
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
                            #{report.clienteId}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                            {formatCurrency(report.resumenEjecutivo?.totalPatrimonio)}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', color: '#ef4444', fontWeight: 500 }}>
                            {report.resumenEjecutivo?.deudaSobrePatrimonio}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', color: parsePercentage(report.resumenEjecutivo?.rendimientoAnualActual) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                            {report.resumenEjecutivo?.rendimientoAnualActual}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <button 
                              style={{ background: 'none', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569' }}
                              onClick={() => console.log('Ver detalles', report.id)}
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

            </>
          )}
        </div>
      </div>
    );
  }

  // --- VISTA CLIENTE (Legado) ---
  return (
    <div className="dashboard-container">
      <Header variant="dashboard" title="Panel" />
      <main className="dashboard-main">
        <ProfitCard />
        <div className="card-grid">
          <div className={`card small-card ${lastDoc ? 'highlighted-card' : ''}`} onClick={() => router.push('/reports')}>
            <p className="card-title">Último informe</p>
            {lastDoc ? (
              <>
                <p className="doc-title" title={lastDoc.title || lastDoc.originalName}>
                  {(lastDoc.title || lastDoc.originalName).slice(0, 30)}...
                </p>
                <div className="go-link">Ver en informes →</div>
              </>
            ) : (
              <>
                <div className="card-placeholder line" />
                <div className="card-placeholder line short" />
              </>
            )}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
             <div key={i} className="card small-card"><div className="card-placeholder line" /><div className="card-placeholder line short" /></div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default withAuth(Dashboard, ['client', 'admin', 'superadmin']);

// --- COMPONENTE DE CLIENTES CON ANIMACIÓN ---
import React from 'react';

const getInitials = (nameOrEmail: string) => {
  if (!nameOrEmail) return '';
  const parts = nameOrEmail.split(/[@.\s]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
};

const ClientCirclesPanel = ({ reports }: { reports: ReportData[] }) => {
  // Extraer clientes únicos con role 'client' (simulado: todos los clienteId únicos)
  const clients = React.useMemo(() => {
    const map = new Map<number, ReportData>();
    reports.forEach(r => {
      if (!map.has(r.clienteId)) map.set(r.clienteId, r);
    });
    return Array.from(map.values());
  }, [reports]);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', alignItems: 'flex-end', minHeight: 320
    }}>
      {clients.map((client, idx) => (
        <div
          key={client.clienteId}
          className="client-circle-anim"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
            animation: `roll-in 0.7s cubic-bezier(.68,-0.55,.27,1.55) ${0.1 * idx}s both`,
          }}
        >
          <div
            className="client-circle"
            style={{
              width: 72, height: 72, borderRadius: '50%', background: '#e0e7ef',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#1a2340', marginBottom: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'transform 0.25s cubic-bezier(.68,-0.55,.27,1.55)',
            }}
            tabIndex={0}
            title={`Cliente #${client.clienteId}`}
          >
            {getInitials(client?.resumenEjecutivo?.email || String(client.clienteId))}
          </div>
          <span style={{ fontSize: 15, color: '#334155', fontWeight: 600, marginTop: 2, textAlign: 'center', maxWidth: 90, wordBreak: 'break-word' }}>
            {client?.resumenEjecutivo?.email || `Cliente #${client.clienteId}`}
          </span>
        </div>
      ))}
      <style>{`
        @keyframes roll-in {
          0% { opacity: 0; transform: translateY(80px) rotate(-180deg) scale(0.5); }
          60% { opacity: 1; transform: translateY(-10px) rotate(10deg) scale(1.1); }
          80% { transform: translateY(0px) rotate(-2deg) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
        }
        .client-circle:hover, .client-circle:focus {
          transform: scale(1.18) rotate(-2deg);
          box-shadow: 0 4px 16px #bfa14a55;
        }
      `}</style>
    </div>
  );
};