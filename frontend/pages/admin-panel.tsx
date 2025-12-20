


import MobileMenu from '../components/MobileMenu';
import { withAuth } from '../utils/withAuth';
import { useRouter } from 'next/router';
import Header from '../components/Header';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Simple icon SVGs for visual polish
const ClientIcon = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="#2ecc71" strokeWidth="2"/><path d="M4 20c0-2.5 3.5-4 8-4s8 1.5 8 4" stroke="#2ecc71" strokeWidth="2"/></svg>
);
const UploadIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="#3498db" strokeWidth="2"/><rect x="4" y="16" width="16" height="4" rx="2" fill="#3498db"/></svg>
);


function AdminPanel() {
  const router = useRouter();
  const API_BASE = '/api';
  const { auth } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [lastUploadedData, setLastUploadedData] = useState<any>(null);
  const [uploadingClientId, setUploadingClientId] = useState<number | null>(null);

  const authHeaders = useMemo(
    () =>
      auth?.token
        ? { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' },
    [auth?.token]
  );

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API_BASE}/users?role=client`, { headers: authHeaders as any });
        const data = await res.json();
        setClients(Array.isArray(data) ? data : []);
      } catch {
        setError('Error al obtener clientes');
      }
    };
    fetchClients();
  }, [authHeaders]);

  const handleXlsxUpload = async (clientId: number, file: File) => {
    if (!file) return;
    setUploadingClientId(clientId);
    setLastUploadedData(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/xlsx/${clientId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth?.token || ''}` },
        body: formData,
      });
      const result = await res.json();
      if (result && result.data) {
        setLastUploadedData(result.data);
        alert('Archivo XLSX procesado correctamente');
      } else {
        alert(result.message || 'Error al procesar el archivo');
      }
    } catch (e) {
      alert('Error al procesar el archivo');
    } finally {
      setUploadingClientId(null);
    }
  };


  return (
    <div className="admin-container">
      <Header variant="dashboard" title="Admin Panel" />

      <div className="admin-actions" style={{ display: 'flex', gap: 16, padding: '24px 32px', background: '#fff', borderBottom: '1px solid #eaeaea' }}>
        <button className="action-btn" style={{ background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 16 }} onClick={() => router.push('/documents')}>
          Subir nuevo informe
        </button>
        <button className="action-btn" style={{ background: '#3498db', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontSize: 16 }} onClick={() => router.push('/admin-users')}>
          Gestionar usuarios
        </button>
      </div>

      <main className="admin-content" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '32px',
        padding: '32px',
        maxWidth: 1200,
        margin: '0 auto',
        alignItems: 'stretch',
        minHeight: '60vh'
      }}>
        <section className="admin-table" style={{
          flex: 1,
          minWidth: 340,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}>
          <h2 style={{ fontWeight: 600, fontSize: 20, marginBottom: 18, color: '#222' }}>Gestión de Clientes</h2>
          {error && <p style={{ color: '#e74c3c', fontWeight: 500 }}>{error}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {clients.map((client) => (
              <div key={client.id} className="client-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
                <ClientIcon />
                <span style={{ flex: 1, fontWeight: 500, color: '#333' }}>{client.email}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: uploadingClientId === client.id ? 'not-allowed' : 'pointer', color: uploadingClientId === client.id ? '#aaa' : '#3498db', fontWeight: 500 }}>
                  <UploadIcon />
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={uploadingClientId !== null}
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleXlsxUpload(client.id, e.target.files[0]);
                      }
                    }}
                  />
                  <span>{uploadingClientId === client.id ? 'Subiendo...' : 'Subir XLSX'}</span>
                </label>
              </div>
            ))}
          </div>
        </section>

        {lastUploadedData && (
          <aside className="report-preview" style={{
            flex: 1,
            minWidth: 320,
            maxWidth: 420,
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            padding: 28,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <h3 style={{ fontWeight: 600, fontSize: 18, marginBottom: 18, color: '#222' }}>Resumen del Informe Extraído</h3>
            <div className="kpi-card" style={{ background: '#eafaf1', borderRadius: 8, padding: '16px 12px', marginBottom: 18 }}>
              <p style={{ margin: 0, color: '#27ae60', fontWeight: 500 }}>Patrimonio Neto</p>
              <h2 style={{ color: '#2ecc71', fontSize: 28, margin: 0 }}>
                ${lastUploadedData.snapshot?.patrimonioNeto?.toLocaleString?.() || 'N/A'}
              </h2>
            </div>
            <div className="kpi-grid" style={{
              display: 'flex',
              gap: 16,
              marginBottom: 18,
              flexWrap: 'wrap',
              alignItems: 'stretch',
              justifyContent: 'space-between'
            }}>
              <div className="kpi-item" style={{
                flex: '1 1 120px',
                minWidth: 120,
                background: '#f5f8fa',
                borderRadius: 8,
                padding: 12,
                textAlign: 'center',
                marginBottom: 8
              }}>
                <small style={{ color: '#888' }}>Custodia</small>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#2980b9' }}>{lastUploadedData.snapshot?.custodia?.toLocaleString?.() ?? 'N/A'}</div>
              </div>
              <div className="kpi-item" style={{
                flex: '1 1 120px',
                minWidth: 120,
                background: '#f5f8fa',
                borderRadius: 8,
                padding: 12,
                textAlign: 'center',
                marginBottom: 8
              }}>
                <small style={{ color: '#888' }}>Fuera Custodia</small>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#2980b9' }}>{lastUploadedData.snapshot?.fueraCustodia?.toLocaleString?.() ?? 'N/A'}</div>
              </div>
              <div className="kpi-item" style={{
                flex: '1 1 120px',
                minWidth: 120,
                background: '#f5f8fa',
                borderRadius: 8,
                padding: 12,
                textAlign: 'center',
                marginBottom: 8
              }}>
                <small style={{ color: '#888' }}>Deuda</small>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#c0392b' }}>{lastUploadedData.snapshot?.deuda?.toLocaleString?.() ?? 'N/A'}</div>
              </div>
            </div>
            <hr style={{ margin: '18px 0' }} />
            <h4 style={{ fontWeight: 600, fontSize: 16, marginBottom: 10, color: '#222' }}>Distribución de Activos</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 15 }}>
              <li>🔵 Renta Fija: 83.37%</li>
              <li>🟠 Renta Variable: 12.30%</li>
              <li>🟢 Activos Digitales: 4.33%</li>
            </ul>
            <button
              className="confirm-btn"
              onClick={() => alert('Informe publicado')}
              style={{ width: '100%', marginTop: '24px', padding: '12px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
            >
              Publicar Informe
            </button>
          </aside>
        )}
      </main>
    </div>
  );
}

export default withAuth(AdminPanel, ['admin', 'superadmin']);
