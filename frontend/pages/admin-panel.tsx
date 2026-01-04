import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import RichTextEditor from '@/components/RichTextEditor';
import DOMPurify from 'dompurify';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';

// --- TYPES & CONFIG ---

type Report = {
  clienteId: number;
  fechaInforme: string;
  resumenEjecutivo: any;
  snapshot: any;
  historico: any[];
  distribucion: any[];
  distribucion_hijos: any[];
};

const PIE_COLORS = [
  '#1a2340', '#bfa14a', '#217a3c', '#8884d8', '#82ca9d',
  '#ffc658', '#ff8042', '#00C49F', '#0088FE', '#FFBB28'
];

// --- UTILS ---

const formatCurrency = (val: number | undefined) => {
  if (val === undefined || val === null) return 'N/A';
  return val.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// --- SUB-COMPONENTS (Styling Blocks) ---

const SectionTitle = ({ title }: { title: string }) => (
  <h4 style={{
    color: '#1a2340',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 700,
    borderBottom: '2px solid #bfa14a',
    paddingBottom: '8px',
    marginBottom: '16px',
    marginTop: '24px'
  }}>
    {title}
  </h4>
);

const KpiCard = ({ label, value, isHighlight = false, subValue }: { label: string, value: string | number, isHighlight?: boolean, subValue?: string }) => (
  <div style={{
    flex: 1,
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '16px',
    minWidth: '140px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  }}>
    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', fontWeight: 500 }}>{label}</div>
    <div style={{
      fontSize: '20px',
      fontWeight: 700,
      color: isHighlight ? '#217a3c' : '#1a2340'
    }}>
      {value}
    </div>
    {subValue && <div style={{ fontSize: '11px', color: '#bfa14a', marginTop: '4px', fontWeight: 600 }}>{subValue}</div>}
  </div>
);

const CustomTooltip = (props: TooltipProps<number, string>) => {
  const { active } = props;
  const payload = (props as any).payload;
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ccc',
        padding: '10px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ margin: 0, color: '#1a2340', fontWeight: 600 }}>{payload[0].name}</p>
        <p style={{ margin: 0, color: '#555' }}>
          {formatCurrency(payload[0].value as number)}
        </p>
      </div>
    );
  }
  return null;
};

// --- MAIN COMPONENT ---

function AdminPanel() {
  const router = useRouter();
  const API_BASE = '/api';
  const { auth } = useAuth();
  
  const [clients, setClients] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportPreview, setReportPreview] = useState<Report | null>(null);
  const [editingDate, setEditingDate] = useState(false);
  const [uploadingClientId, setUploadingClientId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);

  const [globalSummary, setGlobalSummary] = useState<string | null>(null);
  const [tailoredSummary, setTailoredSummary] = useState<string | null>(null);


  // Auth Headers Memo
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return headers;
  }, [auth?.token]);

  const getClientNameById = (id: number) => {
    const client = clients.find(c => c.id === id);
    if (!client) return `#${id}`;
    return `${client.profile?.firstName}${client.profile?.lastName ? ' ' + client.profile?.lastName : ''}`;
  };

  // Fetch Clients
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

  // Handlers
  const handleXlsxUpload = async (clientId: number, file: File) => {
    if (!file) return;
    setUploadingClientId(clientId);
    setReportPreview(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/xlsx/${clientId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth?.token || ''}` },
        body: formData,
      });
      const result = await res.json();
      if (result?.data) {
        setReportPreview(result.data);
        setModalOpen(true);
      } else {
        alert(result.message || 'Error al procesar.');
      }
    } catch (e) {
      alert('Error de conexión.');
    } finally {
      setUploadingClientId(null);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!reportPreview) return;
    setReportPreview({
      ...reportPreview,
      fechaInforme: e.target.value,
    });
    setEditingDate(false);
  };

  const handlePublish = async () => {
    if (!reportPreview) return;
    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/reports/${reportPreview.clienteId}/publish`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          clientId: reportPreview.clienteId,
          report: reportPreview,
          monthYear: reportPreview.fechaInforme,
          resumenGlobal: globalSummary,
          resumenTailored: tailoredSummary,
        }),
      });
      const result = await res.json();
      if (result && !result.error) {
        setModalOpen(false);
        setReportPreview(null);
      } else {
        alert(result.message || 'Error al publicar');
      }
    } catch (e) { alert('Error al publicar'); }
    finally { setPublishing(false); }
  };

  // --- RENDER HELPERS ---

  const renderAssetChips = (items: any[], totalLabel = 'Total', variant: 'blue' | 'gold' = 'blue') => {
    if (!items || items.length === 0) return null;
    const total = items.find(d => d.categoria === totalLabel);
    const assets = items.filter(d => d.categoria !== totalLabel && d.valor !== 0);
    const bg = variant === 'blue' ? '#f0f4f8' : '#fcfbf5';
    const color = variant === 'blue' ? '#1a2340' : '#8a6d3b';
    const border = variant === 'blue' ? '1px solid #d9e2ec' : '1px solid #e3dcb8';

    if (assets.length === 0 && !total) return <p style={{color: '#999', fontStyle: 'italic'}}>Sin datos disponibles.</p>;

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {assets.map((d, idx) => (
          <div key={idx} style={{
            background: bg, border, color,
            borderRadius: '20px', padding: '6px 14px', fontSize: '13px', fontWeight: 500
          }}>
            {d.categoria}: <strong>{formatCurrency(d.valor)}</strong> <span style={{opacity: 0.7}}>({d.porcentaje?.toFixed(2)}%)</span>
          </div>
        ))}
        {total && (
          <div style={{
            background: variant === 'blue' ? '#1a2340' : '#bfa14a',
            color: '#fff', borderRadius: '4px', padding: '8px 16px',
            fontSize: '14px', fontWeight: 700, marginLeft: 'auto'
          }}>
            TOTAL: {formatCurrency(total.valor)}
          </div>
        )}
      </div>
    );
  };

  const pieData = useMemo(() => {
    return reportPreview?.distribucion
      ?.filter((d) => d.valor > 0 && d.categoria !== 'Total')
      .map((d) => ({ name: d.categoria, value: d.valor })) || [];
  }, [reportPreview]);

  return (
    <div className="dashboard-container" style={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <Header variant="dashboard" title="" />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a2340', margin: 0 }}>
            Gestión de <b style={{ fontWeight: 700 }}>Clientes</b>
          </h2>
            <p style={{ color: '#666', marginTop: '8px', textAlign: 'center' }}>Seleccione un cliente para subir y generar un nuevo informe mensual.</p>
        </div>
        {/* RichTextEditor for executive summary */}
        <div style={{
          background: '#fff',
          border: '1px solid #eee',
          borderRadius: '10px',
          padding: '24px',
          marginBottom: '36px',
          boxShadow: '0 2px 6px rgba(26,35,64,0.04)',
          maxWidth: '1900px'
        }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: '#1a2340',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Resumen Ejecutivo Global (Editor)
          </div>
          <RichTextEditor
            value={''}
            onChange={html => setGlobalSummary(html)}
          />
        </div>
        {/* Client Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {clients.filter(client => client.isActive).map((client) => (
        <div key={client.id} className="card" style={{
          background: '#fff', borderRadius: '12px', padding: '24px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          cursor: 'default',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #f0f4f8 60%, #e3e9f3 100%)',
          color: '#1a2340', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '22px', marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(26,35,64,0.08)',
          transition: 'transform 0.18s cubic-bezier(.4,0,.2,1), box-shadow 0.18s',
          cursor: 'pointer',
          border: '2px solid #e3e9f3',
          letterSpacing: '2px',
          fontFamily: 'Segoe UI, Merriweather, sans-serif',
            }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
          {(client?.profile?.firstName.charAt(0)?.toUpperCase()) + (client?.profile?.lastName?.charAt(0)?.toUpperCase() || '')}
            </div>
            <h3 style={{
          fontSize: '18px', fontWeight: 600, color: '#1a2340', marginBottom: '4px',
          fontFamily: 'Segoe UI, Merriweather, sans-serif', letterSpacing: '1px',
          textAlign: 'center',
            }}>
              {getClientNameById(client?.id)}
            </h3>
          </div>
          
          <div style={{ marginTop: '24px' }}>
            <label style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          padding: '10px', borderRadius: '8px', border: '1px dashed #bfa14a',
          color: '#bfa14a', fontWeight: 600, cursor: uploadingClientId === client.id ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s'
            }}>
          <input
            type="file" accept=".xlsx"
            disabled={uploadingClientId !== null}
            style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && handleXlsxUpload(client.id, e.target.files[0])}
          />
          {uploadingClientId === client.id ? 'Procesando...' : 'Subir Informe (XLSX)'}
            </label>
          </div>
        </div>
          ))}
        </div>
      </div>

      {/* --- PROFESSIONAL MODAL --- */}
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
                  Fecha del informe:{' '}
                    {editingDate ? (
                      <input
                        type="date"
                        value={reportPreview.fechaInforme?.slice(0, 10) || ''}
                        onChange={handleDateChange}
                        onBlur={() => setEditingDate(false)}
                        style={{
                          fontSize: '13px',
                          color: '#1a2340',
                          border: '1px solid #bfa14a',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1a2340',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '13px',
                          padding: 0,
                        }}
                        onClick={() => setEditingDate(true)}
                        title="Cambiar fecha"
                      >
                        {formatDate(reportPreview.fechaInforme)}
                      </button>
                    )}
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
                <KpiCard 
                  label="PATRIMONIO TOTAL" 
                  value={formatCurrency(reportPreview.resumenEjecutivo?.totalPatrimonio)} 
                  isHighlight 
                />
                <KpiCard 
                  label="RENDIMIENTO ANUAL (YTD)" 
                  value={reportPreview.resumenEjecutivo?.rendimientoAnualActual ?? '0%'} 
                  isHighlight 
                  subValue="Rentabilidad Acumulada"
                />
                <KpiCard 
                  label="APALANCAMIENTO" 
                  value={reportPreview.resumenEjecutivo?.deudaSobrePatrimonio ?? '0%'} 
                />
              </div>

              {/* Modal Global Summary */}
              <SectionTitle title="Resumen Ejecutivo Global" />
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid #eee',
                  borderRadius: '6px',
                  padding: '5px',
                  marginBottom: '16px',
                  color: '#888',           // dim text
                  fontSize: '15px',
                  height: '100px',      // adjust as needed
                  maxHeight: '100px',
                  overflowY: 'scroll',
                  opacity: 0.7,            // further dimming
                  pointerEvents: 'none',   // not interactive
                  userSelect: 'text',      // allow text selection if desired
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(globalSummary || '<i>Sin resumen disponible</i>'),
                }}
              />
              {/* RichTextEditor for tailored summary */}
              <SectionTitle title="Resumen Ejecutivo Individual" />
              <div style={{
                background: '#fff',
                border: '1px solid #eee',
                borderRadius: '10px',
                padding: '24px',
                marginBottom: '36px',
                boxShadow: '0 2px 6px rgba(26,35,64,0.04)',
                maxWidth: '1900px'
              }}>
                <RichTextEditor
                  value={''}
                  onChange={html => setTailoredSummary(html)}
                />
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

              {/* 3. Distribución Assets (Expandable feel) */}
              {(reportPreview.distribucion?.length > 0 || reportPreview.distribucion_hijos?.length > 0) && (
                <>
                  <SectionTitle title="Distribución de Activos" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {reportPreview.distribucion?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Cartera Principal</div>
                        {renderAssetChips(reportPreview.distribucion, 'Total', 'blue')}
                      </div>
                    )}
                    {reportPreview.distribucion_hijos?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#888', marginBottom: '8px', textTransform: 'uppercase' }}>Sub-Carteras / Hijos</div>
                        {renderAssetChips(reportPreview.distribucion_hijos, 'Total', 'gold')}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 4. Chart & History (Side by Side) */}
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
                        {reportPreview.historico?.slice(-6).map((h, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '10px 16px', color: '#555' }}>
                              {new Date(h.fecha).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>{h.valorNeto?.toLocaleString()}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: (h.rendimientoMensual || 0) >= 0 ? '#217a3c' : '#e74c3c' }}>
                              {(h.rendimientoMensual || 0) > 0 ? '+' : ''}{h.rendimientoMensual?.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                        {(!reportPreview.historico || reportPreview.historico.length === 0) && (
                          <tr><td colSpan={3} style={{ padding: '16px', textAlign: 'center', color: '#999' }}>Sin histórico reciente</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pie Chart (Bottom Right Placement) */}
                {pieData.length > 0 && (
                  <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <SectionTitle title="Composición Visual" />
                    <div style={{ width: '100%', height: '250px', position: 'relative' }}>
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
                      {/* Center Text Trick */}
                      <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -65%)',
                        textAlign: 'center', pointerEvents: 'none'
                      }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#1a2340' }}>{pieData.length}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>Activos</div>
                      </div>
                    </div>
                  </div>
                )}
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
                Cancelar
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  padding: '12px 32px', border: 'none', background: publishing ? '#ccc' : '#1a2340',
                  color: '#fff', borderRadius: '6px', fontWeight: 600, cursor: publishing ? 'not-allowed' : 'pointer',
                  fontSize: '14px', boxShadow: '0 4px 12px rgba(26, 35, 64, 0.2)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {publishing ? 'Publicando...' : 'APROBAR Y PUBLICAR'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(AdminPanel, ['admin', 'superadmin']);