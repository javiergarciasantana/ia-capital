import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

type KycStatus = 'pending' | 'approved' | 'rejected';

type ProfileForm = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  documentId?: string;
  birthDate?: string; // YYYY-MM-DD
  preferredLanguage?: string;
  preferredCurrency?: string;
  riskProfile?: string;
  taxResidence?: string;
  bankName?: string;
  iban?: string;
  swift?: string;
  kycStatus?: KycStatus;
  marketingOptIn?: boolean;
  notes?: string;
};

export default function AdminUsers() {
  const router = useRouter();
  const API_BASE = '/api' as const; const { auth } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<ProfileForm>({});

  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const authHeaders = useMemo(
    () =>
      auth?.token
        ? { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' },
    [auth?.token]
  );

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users?role=client`, { headers: authHeaders as any });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setError('Error al obtener usuarios');
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.token]);

  const clean = (obj: any) => {
    // elimina '', null y undefined para pasar @IsOptional()
    const out: any = {};
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v === '' || v === undefined || v === null) return;
      out[k] = v;
    });
    return out;
  };

  const handleCreate = async () => {
    setError('');
    if (!email || !password) return;

    setCreating(true);
    try {
      const { kycStatus, marketingOptIn, ...allowedProfile } = profile; // <- quita los no permitidos
      const body = {
        email,
        password,
        role: 'client' as const,
        isActive: true,
        profile: clean(allowedProfile),
      };

      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: authHeaders as any,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Nest ValidationPipe suele responder { message: string | string[] }
        const msg = Array.isArray(err?.message) ? err.message.join(' · ') : err?.message || 'No se pudo crear el usuario';
        throw new Error(msg);
      }

      setEmail('');
      setPassword('');
      setProfile({ kycStatus: 'pending', marketingOptIn: false });
      await fetchUsers();
    } catch (e: any) {
      setError(e?.message || 'No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: number, active: boolean) => {
    try {
      await fetch(`${API_BASE}/users/${id}/${active ? 'deactivate' : 'activate'}`, {
        method: 'PATCH',
        headers: authHeaders as any,
      });
      fetchUsers();
    } catch {
      alert('Error al cambiar estado del usuario');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar completamente este usuario?')) return;
    try {
      await fetch(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
        headers: authHeaders as any,
      });
      fetchUsers();
    } catch {
      alert('Error al eliminar');
    }
  };

  const filtered = users.filter((u) =>
    !search ? true : String(u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const bind = (key: keyof ProfileForm) => ({
    value: (profile[key] as any) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setProfile((p) => ({ ...p, [key]: e.target.type === 'checkbox' ? (e.target as any).checked : e.target.value })),
  });

  return (
    <div className="document-manager">
      <button className="back-button" onClick={() => router.push('/admin-panel')}>
        ← Volver
      </button>

      <h2>Gestión de Clientes</h2>

      {/* Crear cliente */}
      <div className="upload-section">
        <h3 style={{ marginTop: 0 }}>Nuevo cliente</h3>

        <div className="row-fields">
          <input
            type="email"
            placeholder="Correo electrónico*"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña*"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#003b5c' }}>
            Perfil (opcional)
          </summary>

          <div className="grid-2">
            <input placeholder="Nombre" {...bind('firstName')} />
            <input placeholder="Apellidos" {...bind('lastName')} />
            <input placeholder="Teléfono" {...bind('phone')} />
            <input placeholder="País" {...bind('country')} />
            <input placeholder="Ciudad" {...bind('city')} />
            <input placeholder="Dirección" {...bind('address')} />
            <input placeholder="Código postal" {...bind('postalCode')} />
            <input placeholder="DNI / NIF" {...bind('documentId')} />
            <input type="date" placeholder="Fecha de nacimiento" {...bind('birthDate')} />
            <input placeholder="Idioma preferido (es, en…)" {...bind('preferredLanguage')} />
            <input placeholder="Moneda (EUR, USD…)" {...bind('preferredCurrency')} />
            <input placeholder="Perfil de riesgo" {...bind('riskProfile')} />
            <input placeholder="Residencia fiscal" {...bind('taxResidence')} />
            <input placeholder="Banco" {...bind('bankName')} />
            <input placeholder="IBAN" {...bind('iban')} />
            <input placeholder="SWIFT" {...bind('swift')} />

            <label className="inline">
              KYC:
              <select {...bind('kycStatus')}>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>

            <label className="inline">
              <input
                type="checkbox"
                checked={!!profile.marketingOptIn}
                onChange={(e) => setProfile((p) => ({ ...p, marketingOptIn: e.target.checked }))}
              />
              Acepta marketing
            </label>

            <textarea placeholder="Notas internas" {...bind('notes')} className="span-2" />
          </div>
        </details>

        <button onClick={handleCreate} disabled={!email || !password || creating}>
          {creating ? 'Creando…' : 'Crear cliente'}
        </button>
      </div>

      {/* Buscar */}
      <div className="upload-section" style={{ marginTop: '1rem' }}>
        <input
          type="search"
          placeholder="Buscar por email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="error">{error}</p>}

      {/* Lista */}
      <ul className="file-list">
        {filtered.map((user: any) => (
          <li key={user.id}>
            <strong>{user.email}</strong>
            <br />
            Estado: {user.isActive ? 'Activo' : 'Inactivo'}
            <br />
            <button className="edit-btn" onClick={() => toggleActive(user.id, user.isActive)}>
              {user.isActive ? 'Dar de baja' : 'Activar'}
            </button>
            <button className="delete-btn" onClick={() => handleDelete(user.id)}>
              Eliminar
            </button>
            {user.profile && (
              <div style={{ marginTop: '.5rem', color: '#516173', fontSize: '.95rem' }}>
                <em>
                  {user.profile.firstName || user.profile.lastName
                    ? `${user.profile.firstName || ''} ${user.profile.lastName || ''}`.trim()
                    : '—'}
                  {' · '}
                  {user.profile.kycStatus || 'pending'}
                </em>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
