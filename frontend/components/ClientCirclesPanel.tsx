// --- Client Circles Panel ---
import { useState } from "react";
import React from "react";

const ClientCirclesPanel: React.FC<{
  getClientNameById: (id: number) => string;
  clients?: any[];
  onAddClientClick?: () => void;
  authHeaders: Record<string, string>;
  setClients: React.Dispatch<React.SetStateAction<any[]>>;
}> = ({
  getClientNameById,
  clients = [],
  onAddClientClick,
  authHeaders,
  setClients,
}) => {
  const API_BASE = '/api';
  const [hoveredClientId, setHoveredClientId] = useState<number | null>(null);
  const [changingActiveId, setChangingActiveId] = useState<number | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; client: any | null }>({ open: false, client: null });
  const [editModal, setEditModal] = useState<{ open: boolean; client: any | null }>({ open: false, client: null });

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

  const handleEditClient = async (clientId: number) => {
    setEditModal({ open: false, client: null });
    try {
      const res = await fetch(`${API_BASE}/users/${clientId}`, {
        method: 'PATCH',
        headers: authHeaders as any,
      });
      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== clientId));
      }
    } catch (e) {
      console.error('Error editing client', e);
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
                {(client?.profile.firstName?.charAt(0)?.toUpperCase()) + (client?.profile.lastName?.charAt(0)?.toUpperCase() || '')}
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
                {getClientNameById(client?.id)}
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

                {/* Edit Circle (Left) */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -18,
                    left: -18,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#fded09ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(26,35,64,0.10)',
                    cursor: changingActiveId === client.id ? 'not-allowed' : 'pointer',
                    border: '2px solid #fff',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  title="Editar cliente"
                  onClick={() => changingActiveId !== client.id && setEditModal({ open: true, client })}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="13" width="10" height="3" rx="1" fill="#fff" opacity="0.2"/>
                    <path d="M13.5 6.5l-7 7M14.2 5.8a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-.7.3H4a1 1 0 0 1-1-1v-1.5a1 1 0 0 1 .3-.7l7-7a1 1 0 0 1 1.4 0l1.5 1.5z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>

                {/* Generate Invoice Button (Right) */}
                <button
                  style={{
                    position: 'absolute',
                    bottom: -18,
                    right: -18,
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#0ea5e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(26,35,64,0.10)',
                    cursor: changingActiveId === client.id ? 'not-allowed' : 'pointer',
                    border: '2px solid #fff',
                    zIndex: 10,
                    transition: 'background 0.2s',
                  }}
                  title="Generar factura"
                  disabled={changingActiveId === client.id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (changingActiveId === client.id) return;
                    try {
                      const res = await fetch(`/api/invoices/test/${client.id}`, {
                        method: 'POST',
                        headers: authHeaders as any,
                      });
                      if (res.ok) {
                        // Open PDF in new tab
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } else {
                        alert('No se pudo generar la factura.');
                      }
                    } catch (err) {
                      alert('Error generando la factura.');
                    }
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="4" y="4" width="12" height="12" rx="2" stroke="#fff" strokeWidth="2" />
                    <path d="M7 8h6M7 11h6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
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

      {/* Edit Modal */}
      {editModal.open && editModal.client && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(26, 35, 64, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          animation: 'fadeInModal 0.4s cubic-bezier(.68,-0.55,.27,1.55)'
        }}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);

              // Build the profile object from form values
              const profile = {
                firstName: formData.get('firstName') as string,
                lastName: formData.get('lastName') as string,
                feePercentage: Number(formData.get('feePercentage')),
                feeInterval: formData.get('feeInterval') as string,
                preferredCurrency: formData.get('preferredCurrency') as string,
              };

              try {
                const res = await fetch(`/api/users/${editModal.client.id}`, {
                  method: 'PATCH',
                  headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ profile }),
                });
                if (res.ok) {
                  const updated = await res.json();
                  setClients(prev =>
                    prev.map(c => c.id === updated.id ? updated : c)
                  );
                  setEditModal({ open: false, client: null });
                } else {
                  alert('No se pudo actualizar el cliente.');
                }
              } catch {
                alert('Error actualizando el cliente.');
              }
            }}
            style={{
              background: '#fff', width: '90%', maxWidth: 480, borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', padding: 36, gap: 18, position: 'relative',
              animation: 'popInModal 0.5s cubic-bezier(.68,-0.55,.27,1.55)'
            }}
          >
            <h2 style={{ margin: 0, color: '#1a2340', fontSize: 22, fontWeight: 800, textAlign: 'center', letterSpacing: 1 }}>Editar Cliente</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <input name="firstName" defaultValue={editModal.client.profile.firstName} required placeholder="Nombre" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
              <input name="lastName" defaultValue={editModal.client.profile.lastName} placeholder="Apellidos" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
            </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <input name="email" defaultValue={editModal.client.email} required placeholder="E-mail" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
              <input name="password" defaultValue={''} placeholder="Contraseña" style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <select
                name="preferredCurrency"
                defaultValue={editModal.client.profile.preferredCurrency}
                required
                style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }}
              >
                <option value="">Selecciona divisa</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <select
                name="feeInterval"
                defaultValue={editModal.client.profile.feeInterval}
                required
                style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16 }}
              >
                <option value="">Selecciona intervalo factura</option>
                <option value="quarterly">Trimestral</option>
                <option value="biannual">Semestral</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <label style={{ fontWeight: 600, color: '#020202ff', minWidth: 90 }}>
                Comisión
                <input
                  type="range"
                  name="feePercentage"
                  min={0}
                  max={0.01}
                  step={0.0001}
                  defaultValue={editModal.client.profile.feePercentage ?? 0.003}
                  onChange={e => {
                    // Show percentage value live if you want
                    const span = (e.target as HTMLInputElement).nextElementSibling as HTMLSpanElement;
                    if (span) span.innerText = ((Number(e.target.value) * 100).toFixed(2)) + '%';
                  }}
                  style={{ width: 120, marginLeft: 8, verticalAlign: 'middle' }}
                />
                <span style={{ marginLeft: 8, fontWeight: 700, color: '#1a2340' }}>
                  {((Number(editModal.client.profile.feePercentage ?? 0.003) * 100).toFixed(2))}%
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => setEditModal({ open: false, client: null })} style={{ padding: '12px 24px', border: '1px solid #ddd', background: '#fff', color: '#555', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '15px', transition: 'background 0.2s' }}>Cancelar</button>
              <button type="submit" style={{ padding: '12px 32px', border: 'none', background: '#1a2340', color: '#fff', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 12px rgba(26, 35, 64, 0.2)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}>Guardar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ClientCirclesPanel;
