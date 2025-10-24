// frontend/pages/documents.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

type FileItem = {
  id: number;
  filename: string;
  originalName: string;
  title?: string;
  description?: string;
  type: string;
  date: string;
  month: string;
  year: string;
  bank: string;
  user?: { id: number; email: string } | null;
};

// --- Helpers seguros ---
const ensureArray = <T,>(v: unknown, fallback: T[] = []): T[] =>
  Array.isArray(v) ? (v as T[]) : fallback;

// Devuelve siempre HeadersInit válido sin props undefined
const makeHeaders = (token?: string, extra?: Record<string, string>): HeadersInit => {
  const h: Record<string, string> = { ...(extra || {}) };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

export default function DocumentManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState('');
  const [type] = useState('mensual');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [bank, setBank] = useState('BBVA');
  const [clients, setClients] = useState<{ id: number; email: string }[]>([]);
  const [targetUserId, setTargetUserId] = useState<'all' | number>('all');
  const [editingDoc, setEditingDoc] = useState<FileItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  const API_BASE = 'https://ia-capital-web-iacapital.fn24pb.easypanel.host/api' as const;
  const router = useRouter();
  const { auth } = useAuth();
  const token = auth?.token;

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: makeHeaders(token),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(ensureArray<FileItem>(data));
      setError('');
    } catch (e) {
      console.error('GET /documents error:', e);
      setFiles([]);
      setError('Error al obtener archivos');
    }
  };

  useEffect(() => {
    // Evita petición sin token para no provocar 401
    if (!token) return;
    fetchFiles();
  }, [token]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${API_BASE}/users?role=client`, {
          headers: makeHeaders(token),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setClients(ensureArray<{ id: number; email: string }>(data));
      } catch (e) {
        console.error('GET /users error:', e);
        setClients([]);
      }
    };
    if (token) fetchClients();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    if (file && !title) setTitle(file.name);
  };

  const handleUpload = async () => {
    if (!selectedFile || !token || !month || !year || !bank) {
      setError('Faltan campos obligatorios o no hay sesión.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title || selectedFile.name);
    formData.append('description', description);
    formData.append('month', month);
    formData.append('year', year);
    formData.append('bank', bank);
    formData.append('type', type);
    formData.append('date', new Date().toISOString());
    formData.append('userId', targetUserId === 'all' ? '' : String(targetUserId));

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: makeHeaders(token), // NO setees Content-Type con FormData
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchFiles();

      // Limpieza
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setMonth('');
      setYear('');
      setError('');
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      if (input) input.value = '';
    } catch (e) {
      console.error('POST /documents/upload error:', e);
      setError('No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return setError('No hay sesión.');
    if (!confirm('¿Seguro que deseas eliminar este documento?')) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE',
        headers: makeHeaders(token),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchFiles();
    } catch (err) {
      console.error('DELETE /documents error:', err);
      alert('Error al eliminar el documento');
    }
  };

  const handleEdit = (file: FileItem) => {
    setEditingDoc(file);
    setShowModal(true);
  };

  return (
    <div className="document-manager">
      <button className="back-button" onClick={() => router.push('/admin-panel')}>
        ← Volver
      </button>

      <h2>Gestión de Documentos PDF</h2>

      <div className="upload-section">
        <input type="file" accept="application/pdf" onChange={handleFileChange} />
        <input
          type="text"
          placeholder="Título (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="row-fields">
          <select value={month} onChange={(e) => setMonth(e.target.value)} required>
            <option value="">Mes</option>
            {[
              'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
            ].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Año"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />
        </div>
        <select value={bank} onChange={(e) => setBank(e.target.value)}>
          <option value="BBVA">BBVA</option>
          <option value="Santander">Santander</option>
          <option value="JPMorgan">JPMorgan</option>
          <option value="Varios">Varios</option>
        </select>
        <select
          value={targetUserId}
          onChange={(e) => {
            const value = e.target.value;
            setTargetUserId(value === 'all' ? 'all' : Number(value));
          }}
        >
          <option value="all">📂 Documento general (para todos)</option>
          {clients.map((user) => (
            <option key={user.id} value={user.id}>{user.email}</option>
          ))}
        </select>
        <button onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? 'Subiendo...' : 'Subir'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="file-list">
        {Array.isArray(files) &&
          files.map((file) => (
            <li key={file.id}>
              <strong className="truncated-text">{file.title || file.originalName}</strong><br />
              {(file.month || '')} {(file.year || '')} — {(file.bank || '—')}<br />
              {file.description && <em>{file.description}</em>}<br />
              Usuario: {file.user ? file.user.email : 'General'}<br /><br />
              <a
                href={`${API_BASE}/uploads/${file.filename}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver / Descargar
              </a>{' '}
              | <button className="edit-btn" onClick={() => handleEdit(file)}>✏️ Editar</button>{' '}
              <button className="delete-btn" onClick={() => handleDelete(file.id)}>🗑 Eliminar</button>
            </li>
          ))}
      </ul>

      {showModal && editingDoc && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar documento</h3>

            <input
              type="text"
              value={editingDoc.title || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
              placeholder="Título"
            />
            <textarea
              value={editingDoc.description || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
              placeholder="Descripción"
            />
            <select
              value={editingDoc.month || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, month: e.target.value })}
            >
              <option value="">Mes</option>
              {[
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
              ].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Año"
              value={editingDoc.year || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, year: e.target.value })}
            />
            <select
              value={editingDoc.bank || ''}
              onChange={(e) => setEditingDoc({ ...editingDoc, bank: e.target.value })}
            >
              <option value="">Banco</option>
              <option value="BBVA">BBVA</option>
              <option value="Santander">Santander</option>
              <option value="JPMorgan">JPMorgan</option>
              <option value="Varios">Varios</option>
            </select>
            <select
              value={editingDoc.user?.id ?? 'general'}
              onChange={(e) => {
                const selectedId = e.target.value === 'general' ? null : Number(e.target.value);
                const selectedUser = clients.find((u) => u.id === selectedId) || null;
                setEditingDoc({
                  ...editingDoc,
                  user: selectedUser ? { id: selectedUser.id, email: selectedUser.email } : null,
                });
              }}
            >
              <option value="general">📂 Documento general (para todos)</option>
              {clients.map((user) => (
                <option key={user.id} value={user.id}>{user.email}</option>
              ))}
            </select>

            <div className="modal-actions">
              <button
                onClick={async () => {
                  if (!token) return alert('No hay sesión.');
                  try {
                    const res = await fetch(`${API_BASE}/documents/${editingDoc.id}`, {
                      method: 'PATCH',
                      headers: makeHeaders(token, { 'Content-Type': 'application/json' }),
                      body: JSON.stringify({
                        title: editingDoc.title,
                        description: editingDoc.description,
                        month: editingDoc.month,
                        year: editingDoc.year,
                        bank: editingDoc.bank,
                        userId: editingDoc.user?.id ?? null,
                      }),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    await fetchFiles();
                    setShowModal(false);
                    setEditingDoc(null);
                  } catch (err) {
                    console.error('PATCH /documents error:', err);
                    alert('Error al guardar los cambios');
                  }
                }}
              >
                Guardar
              </button>
              <button onClick={() => setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
