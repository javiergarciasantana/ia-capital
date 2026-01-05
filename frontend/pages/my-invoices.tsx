import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext'; // Adjust path as needed
import Header from '../components/Header'
import api from '../services/api'
import { 
  Download, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

// --- TYPES ---

type Invoice = {
  id: number;
  fechaFactura: string;
  importe: number;
  // Add other invoice properties if available, e.g., description
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


// --- MAIN COMPONENT ---

export default function MyInvoices() {
  const router = useRouter();
  const { auth } = useAuth();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Download States
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
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

  // Fetch user's invoices on load
  useEffect(() => {
    const fetchMyInvoices = async () => {
      if (!auth?.userId) return;
      setLoading(true);
      try {
        // Endpoint to get invoices for the logged-in user
        const res = await api.get(`/invoices/user/${auth.userId}`, {
          headers: authHeaders as any,
        });
        const data = res.data?.data || [];
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setInvoices([]);
        setFeedback({ type: 'error', msg: 'No se pudieron cargar tus facturas.' });
      } finally {
        setLoading(false);
      }
    };
    fetchMyInvoices();
  }, [auth?.userId, authHeaders]);

  // --- DOWNLOAD HANDLERS ---

  const handleDownloadInvoice = async (invoiceId: number) => {
    try {
      setDownloadingInvoiceId(invoiceId);
      setFeedback(null);
      const res = await api.get(`/invoices/${invoiceId}/download`, {
        headers: authHeaders as any,
        responseType: 'blob',
      });
      
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
      setDownloadingInvoiceId(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Download all invoices for the current user
  const handleDownloadAll = async () => {
    if (!auth?.userId) return;
    setIsGlobalDownloading(true);
    try {
      setFeedback(null);
      const res = await api.get(`/invoices/user/${auth.userId}/download/all-pdfs`, {
        headers: authHeaders as any,
        responseType: 'blob',
      });
      
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mis_Facturas.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setFeedback({ type: 'error', msg: `No se pudo descargar el ZIP de facturas.` });
    } finally {
      setIsGlobalDownloading(false);
    }
  };

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

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px' }}>
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 300, color: '#1a2340', margin: 0, textAlign: 'center'  }}>
              Tus <b style={{ fontWeight: 700 }}>Facturas</b>
            </h2>
            <p style={{ color: '#666', marginTop: '8px', textAlign: 'center'  }}>
              Consulta y descarga tus recibos.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
          {/* Global Action Card */}
          <div style={{
            flex: 1,
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
                Descargar todas tus facturas (ZIP)
              </div>
            </div>
            <button
              onClick={handleDownloadAll}
              disabled={isGlobalDownloading || invoices.length === 0}
              style={{
                background: isGlobalDownloading ? 'rgba(255,255,255,0.1)' : '#bfa14a',
                color: isGlobalDownloading ? '#ccc' : '#1a2340',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: isGlobalDownloading || invoices.length === 0 ? 'not-allowed' : 'pointer',
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

        {/* Invoices Table */}
        <SectionTitle title="Historial de Facturas" />
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#666' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
              Cargando facturas...
            </div>
          ) : invoices.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <th style={{ textAlign: 'left', padding: '16px', color: '#666', fontWeight: 500, fontSize: '14px' }}>Nº Factura</th>
                  <th style={{ textAlign: 'left', padding: '16px', color: '#666', fontWeight: 500, fontSize: '14px' }}>Fecha</th>
                  <th style={{ textAlign: 'right', padding: '16px', color: '#666', fontWeight: 500, fontSize: '14px' }}>Importe</th>
                  <th style={{ textAlign: 'center', padding: '16px', color: '#666', fontWeight: 500, fontSize: '14px' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '16px', fontWeight: 600, color: '#1a2340' }}>#{invoice.id}</td>
                    <td style={{ padding: '16px', color: '#333' }}>{new Date(invoice.fechaFactura).toLocaleDateString('es-ES')}</td>
                    <td style={{ padding: '16px', color: '#333', textAlign: 'right', fontWeight: 600 }}>{invoice.importe.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDownloadInvoice(invoice.id)}
                        disabled={downloadingInvoiceId === invoice.id}
                        style={{
                          background: '#fff',
                          border: '1px solid #1a2340',
                          color: '#1a2340',
                          borderRadius: 6,
                          padding: '6px 16px',
                          fontWeight: 600,
                          cursor: downloadingInvoiceId === invoice.id ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        {downloadingInvoiceId === invoice.id ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />}
                        {downloadingInvoiceId === invoice.id ? '...' : 'PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
              <FileText size={40} style={{ marginBottom: '16px', color: '#ccc' }} />
              <p>No tienes facturas disponibles en este momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
