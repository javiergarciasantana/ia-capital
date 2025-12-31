import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed
import Header from '../components/Header'
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
  const API_BASE = '/api';
  const { auth } = useAuth();
  
  const [clients, setClients] = useState<User[]>([]);
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
        const res = await fetch(`${API_BASE}/users?role=client`, { headers: authHeaders as any });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch (e) { 
        console.error("Error fetching clients", e); 
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [authHeaders]);

  // --- DOWNLOAD HANDLERS ---

  const handleDownloadAllGlobal = async () => {
    try {
      setIsGlobalDownloading(true);
      setFeedback(null);

      const res = await fetch(`${API_BASE}/invoices/all-pdfs`, {
        method: 'GET',
        headers: authHeaders as any,
      });

      if (!res.ok) throw new Error('Error de descarga');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Global_Invoices_${new Date().toISOString().split('T')[0]}.zip`; 
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setFeedback({ type: 'success', msg: 'Archivo global descargado correctamente.' });
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Error al descargar facturas globales.' });
    } finally {
      setIsGlobalDownloading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleDownloadUserInvoices = async (userId: string, userName: string) => {
    try {
      setDownloadingUserId(userId);
      setFeedback(null);

      const res = await fetch(`${API_BASE}/invoices/user/${userId}/download`, {
        method: 'GET',
        headers: authHeaders as any,
      });

      if (!res.ok) throw new Error('Error de descarga');

      const blob = await res.blob();
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

  const filteredUsers = clients.filter(client => 
    getClientName(client).toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              onClick={handleDownloadAllGlobal}
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

        {/* Client Grid */}
        <SectionTitle title="Directorio de Clientes" />
        
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
            Cargando clientes...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {filteredUsers.map((client) => (
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
                
                <div style={{ marginTop: '20px', borderTop: '1px solid #f5f5f5', paddingTop: '20px' }}>
                  <button 
                    onClick={() => handleDownloadUserInvoices(client.id, getClientName(client))}
                    disabled={downloadingUserId === client.id}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
                      padding: '12px', borderRadius: '8px', 
                      background: downloadingUserId === client.id ? '#f4f6f8' : '#fff',
                      border: downloadingUserId === client.id ? '1px solid #ddd' : '1px solid #1a2340',
                      color: downloadingUserId === client.id ? '#999' : '#1a2340', 
                      fontWeight: 600, 
                      cursor: downloadingUserId === client.id ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      gap: '8px',
                      fontSize: '14px'
                    }}
                  >
                    {downloadingUserId === client.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                    {downloadingUserId === client.id ? 'Descargando...' : 'Descargar Facturas'}
                  </button>
                </div>
              </div>
            ))}
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