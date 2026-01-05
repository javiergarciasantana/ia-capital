import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed
import Header from '../components/Header'
import api from '../services/api'
import { 
  Download, 
  Search, 
  FileText, 
  Users, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

// --- TYPES ---

type User = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  profile?: {
    firstName?: string;
    lastName?: string;
  };
  name?: string; // Fallback
};

// --- SUB-COMPONENTS (Styling Blocks from Reference) ---

const SectionTitle = ({ title }: { title: string }) => (
  <h4 style={{
    color: '#1a2340',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 700,
    borderBottom: '2px solid #bfa14a',
    paddingBottom: '8px',
    marginBottom: '24px',
    marginTop: '32px'
  }}>
    {title}
  </h4>
);

const KpiCard = ({ label, value, icon: Icon, isHighlight = false }: { label: string, value: string | number, icon?: any, isHighlight?: boolean }) => (
  <div style={{
    flex: 1,
    background: '#fff',
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '20px',
    minWidth: '200px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      {Icon && <Icon size={16} color={isHighlight ? '#bfa14a' : '#ccc'} />}
    </div>
    <div style={{
      fontSize: '24px',
      fontWeight: 700,
      color: isHighlight ? '#1a2340' : '#333'
    }}>
      {value}
    </div>
  </div>
);

// --- MAIN COMPONENT ---

export default function InvoiceManager() {
  const router = useRouter();
  const { auth } = useAuth();
  
  const [clients, setClients] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Download States
  const [downloadingUserId, setDownloadingUserId] = useState<string | null>(null);
  const [isGlobalDownloading, setIsGlobalDownloading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  // Auth Headers Memo
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.token) {
      headers['Authorization'] = `Bearer ${auth.token}`;
    }
    return headers;
  }, [auth?.token]);

  // Helpers
  const getClientName = (user: User) => {
    if (user.profile?.firstName && user.profile?.lastName) {
      return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    return user.profile?.firstName || user.name || user.email.split('@')[0];
  };

  const getInitials = (user: User) => {
    const name = getClientName(user);
    return name.substring(0, 2).toUpperCase();
  };

  // Fetch Clients
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users?role=client`, { headers: authHeaders as any });
        if (res.status < 200 || res.status >= 300) throw new Error('Failed');
        const data = await res.data;
        setClients(Array.isArray(data) ? data : []);
      } catch (e) { 
        console.error("Error fetching clients", e); 
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [authHeaders]);

useEffect(() => {
  const fetchInvoicesForClients = async () => {
    if (!auth?.token) return;
    if (!clients.length) return;
    setLoading(true);
    try {
      // Fetch invoices for each client in parallel
      const allInvoices: any[] = [];
      await Promise.all(
        clients.map(async (client) => {
          const res = await api.get(`/invoices/user/${client.id}`, {
            headers: authHeaders as any,
          });
          if (res.status >= 200 && res.status < 300) {
            const data = res.data;
            // Attach clientId to each invoice for filtering
            const invoices = data.data
            if (Array.isArray(invoices)) {
              allInvoices.push(...invoices);
            }
          }
        })
      );
      //console.log("Invoices", allInvoices)
      setInvoices(allInvoices);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };
  fetchInvoicesForClients();
}, [auth?.token, clients, authHeaders]);

  // --- DOWNLOAD HANDLERS ---

const handleDownloadInvoice = async (invoiceId: number) => {
    try {
      setDownloadingUserId(invoiceId.toString());
      setFeedback(null);
      const res = await api.get(`/invoices/${invoiceId}/download`, {
        headers: authHeaders as any,
        responseType: 'blob',
      });
      if (res.status < 200 || res.status >= 300) throw new Error('Error de descarga');
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Factura_${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setFeedback({ type: 'error', msg: `No se pudo descargar la factura #${invoiceId}` });
    } finally {
      setDownloadingUserId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Download all invoices from a User (admin only)
  const handleDownloadUserInvoices = async (userId: string, userName: string) => {
    try {
      setDownloadingUserId(userId);
      setFeedback(null);

      const res = await api.get(`/invoices/user/${userId}/download/all-pdfs`, {
        headers: authHeaders as any,
        responseType: 'blob',
      });

      if (res.status < 200 || res.status >= 300) throw new Error('Error de descarga');

      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${userName.replace(/\s+/g, '_')}_Invoices.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setFeedback({ type: 'error', msg: `No se pudieron descargar las facturas de ${userName}` });
    } finally {
      setDownloadingUserId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Download all invoices (admin only)
  const handleDownloadAll = async () => {
    try {
      setFeedback(null);
      const res = await api.get(`/invoices/all-pdfs`, {
        method: 'GET',
        headers: authHeaders as any,
        responseType: 'blob',
      });
      if (res.status < 200 || res.status >= 300) throw new Error('Error de descarga');
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Todas_las_Facturas.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setFeedback({ type: 'error', msg: `No se pudo descargar el ZIP de facturas.` });
    }
  };

  const filteredUsers = clients.filter(client => 
    getClientName(client).toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ...imports and state as before...

  return (
    <div className="dashboard-container" style={{ backgroundColor: '#f4f6f8', minHeight: '100vh', paddingBottom: '40px' }}>
      <Header variant="dashboard" title="" />
      {/* Feedback Toast */}
      {feedback && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 999,
          background: '#fff', padding: '16px 24px', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderLeft: feedback.type === 'error' ? '4px solid #e74c3c' : '4px solid #217a3c',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          {feedback.type === 'error' ? <AlertCircle size={20} color="#e74c3c"/> : <CheckCircle2 size={20} color="#217a3c"/>}
          <span style={{ color: '#1a2340', fontWeight: 500 }}>{feedback.msg}</span>
        </div>
      )}

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a2340', margin: 0, textAlign: 'center'  }}>
              Gestión de <b style={{ fontWeight: 700 }}>Facturas</b>
            </h2>
            <p style={{ color: '#666', marginTop: '8px', textAlign: 'center'  }}>
              Administración y descarga de documentos fiscales por cliente.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
          <KpiCard label="Clientes Totales" value={clients.length} icon={Users} isHighlight />
          <KpiCard label="Clientes Filtrados" value={filteredUsers.length} icon={Search} />
          {/* Global Action Card */}
          <div style={{
            flex: 2,
            background: 'linear-gradient(135deg, #1a2340 0%, #2a3555 100%)',
            borderRadius: '8px',
            padding: '20px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(26,35,64,0.15)'
          }}>
            <div>
              <div style={{ fontSize: '14px', color: '#bfa14a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Acción Global
              </div>
              <div style={{ fontSize: '16px', opacity: 0.9 }}>
                Descargar todas las facturas de todos los clientes (ZIP)
              </div>
            </div>
            <button
              onClick={handleDownloadAll}
              disabled={isGlobalDownloading}
              style={{
                background: isGlobalDownloading ? 'rgba(255,255,255,0.1)' : '#bfa14a',
                color: isGlobalDownloading ? '#ccc' : '#1a2340',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: isGlobalDownloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {isGlobalDownloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              {isGlobalDownloading ? 'Procesando...' : 'Descargar Todo'}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '24px', position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '16px 16px 16px 48px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              fontSize: '16px',
              background: '#fff',
              outline: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          />
          <Search style={{ position: 'absolute', left: '16px', top: '16px', color: '#ccc' }} />
        </div>

        {/* Client Grid with Invoices */}
        <SectionTitle title="Directorio de Clientes" />
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
            Cargando clientes...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {filteredUsers.map((client) => {
              // Find all invoices for this client
              const clientInvoices = invoices.filter(inv => String(inv.clienteId) === String(client.id));
              return (
                <div key={client.id} className="card" style={{
                  background: '#fff', borderRadius: '12px', padding: '24px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.04)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f0f4f8 60%, #e3e9f3 100%)',
                      color: '#1a2340', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '20px', marginBottom: '16px',
                      boxShadow: '0 4px 12px rgba(26,35,64,0.08)',
                      border: '2px solid #fff',
                      fontFamily: 'Segoe UI, Merriweather, sans-serif',
                    }}>
                      {getInitials(client)}
                    </div>
                    <h3 style={{
                      fontSize: '18px', fontWeight: 600, color: '#1a2340', marginBottom: '4px',
                      fontFamily: 'Segoe UI, sans-serif',
                    }}>
                      {getClientName(client)}
                    </h3>
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#217a3c' }}></span>
                      {client.email}
                    </div>
                  </div>
                  {/* Invoices Table */}
                  <div style={{ marginTop: '16px' }}>
                    {clientInvoices.length === 0 ? (
                      <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center', margin: '16px 0' }}>
                        No hay facturas para este cliente.
                      </div>
                    ) : (
                      <table style={{ width: '100%', fontSize: 14, marginBottom: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Fecha</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Importe</th>
                            <th style={{ textAlign: 'center', padding: '4px 8px' }}>Descargar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientInvoices.map(inv => (
                            <tr key={inv.id}>
                              <td style={{ padding: '4px 8px' }}>{inv.fechaFactura?.slice(0, 10)}</td>
                              <td style={{ padding: '4px 8px' }}>{inv.importe ? `${inv.importe} €` : ''}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDownloadInvoice(inv.id)}
                                  disabled={downloadingUserId === String(inv.id)}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #1a2340',
                                    color: '#1a2340',
                                    borderRadius: 6,
                                    padding: '4px 12px',
                                    fontWeight: 600,
                                    cursor: downloadingUserId === String(inv.id) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                  }}
                                >
                                  {downloadingUserId === String(inv.id) ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                                  {downloadingUserId === String(inv.id) ? '...' : 'PDF'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {/* Download all for this client (if you have such endpoint) */}
                  <button
                    onClick={() => handleDownloadUserInvoices(client.id, getClientName(client))}
                    style={{
                      width: '100%',
                      background: '#bfa14a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 0',
                      fontWeight: 700,
                      marginTop: 8,
                      cursor: 'pointer'
                    }}
                  >
                    Descargar todas las facturas de este cliente (ZIP)
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', opacity: 0.6 }}>
            <Users size={48} color="#ccc" style={{ marginBottom: '16px' }} />
            <p>No se encontraron clientes.</p>
          </div>
        )}
      </div>
    </div>
  );
}