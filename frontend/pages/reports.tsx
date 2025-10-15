import { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/globals.css';
import '../styles/reports.css';
import Header from '../components/Header';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

type FileItem = {
  id: number;
  filename: string;
  originalName: string;
  title?: string;
  description?: string;
  type: string;
  date?: string;              // ISO o similar
  month?: string | null;
  year?: string | number | null;
  bank?: string | null;
  user?: { id: number; email: string } | null;
  createdAt?: string;         // por si la fecha está aquí
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

function parseDate(d?: string) {
  const t = Date.parse(d || '');
  return isNaN(t) ? 0 : t;
}

function formatDate(d?: string) {
  const t = parseDate(d);
  if (!t) return '—';
  const dt = new Date(t);
  return dt.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' });
}

function ReportsPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterBank, setFilterBank] = useState('');

  const { auth } = useAuth();
  const router = useRouter();

  const didInitFromQuery = useRef(false);

  useEffect(() => {
    if (!router.isReady || didInitFromQuery.current) return;

    const { bank, month, year } = router.query;

    if (typeof bank === 'string') setFilterBank(bank);
    if (typeof month === 'string') setFilterMonth(month);
    if (typeof year === 'string') setFilterYear(year);

    didInitFromQuery.current = true;
  }, [router.isReady, router.query]);

  useEffect(() => {
    if (!didInitFromQuery.current) return;
    const q: Record<string, string> = {};
    if (filterBank) q.bank = filterBank;
    if (filterMonth) q.month = filterMonth;
    if (filterYear) q.year = filterYear;
    router.replace({ pathname: '/reports', query: q }, undefined, { shallow: true });
  }, [filterBank, filterMonth, filterYear]);

  // Abrir PDF de forma segura (con token si la ruta lo requiere)
  const openPdf = async (file: FileItem) => {
    if (!auth?.token) return;

    // intentos típicos de backend
    const tryUrls = [
      `${API_BASE}/documents/${file.id}/download`,
      `${API_BASE}/documents/${file.id}/file`,
      `${API_BASE}/uploads/${encodeURIComponent(file.filename)}`,
    ];

    for (const url of tryUrls) {
      try {
        const r = await fetch(url, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (r.ok) {
          const blob = await r.blob();
          const urlBlob = URL.createObjectURL(blob);
          window.open(urlBlob, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch {
        // probar siguiente
      }
    }
    alert('No se pudo abrir el PDF. Revisa las rutas de descarga.');
  };

  useEffect(() => {
    let alive = true;
    const fetchFiles = async () => {
      if (!auth?.token) return;

      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${API_BASE}/documents`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (alive) {
            setFiles([]);
            setErrorMsg(`Error ${res.status} al cargar documentos.`);
          }
          console.error('[Reports] /documents error', res.status, text);
          return;
        }

        const data = await res.json().catch(() => []);
        if (alive) setFiles(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[Reports] fetch error', err);
        if (alive) {
          setFiles([]);
          setErrorMsg('No se pudo conectar con el servidor.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchFiles();
    return () => {
      alive = false;
    };
  }, [auth?.token]);

  if (!auth) return <p className="loading-message">Cargando sesión...</p>;

  // refuerzo por usuario (por si el backend no filtró)
  const myUserId = (auth as any).userId ?? (auth as any).id;

  const visibleFiles = useMemo(
    () =>
      files
        .filter((f) => !f.user || f.user.id === myUserId)
        .sort((a, b) => (parseDate(b.date || b.createdAt) - parseDate(a.date || a.createdAt))),
    [files, myUserId]
  );

  const filteredFiles = useMemo(
    () =>
      visibleFiles.filter((file) => {
        const okMonth = !filterMonth || file.month === filterMonth;
        const okYear = !filterYear || String(file.year ?? '') === filterYear;
        const okBank = !filterBank || file.bank === filterBank;
        return okMonth && okYear && okBank;
      }),
    [visibleFiles, filterMonth, filterYear, filterBank]
  );

  return (
    <div className="reports-container">
      <Header variant="dashboard" title="Dashboard" />

      {/* Layout responsive: sidebar + contenido */}
      <div className="reports-grid">
        {/* Filtros (horizontales en móvil, sidebar en desktop) */}
        <aside className="filters">
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="">Mes</option>
            {[
              'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
              'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
            ].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)}>
            <option value="">Banco</option>
            {['BBVA', 'Santander', 'JPMorgan', 'Varios'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="">Año</option>
            {[2025, 2024, 2023, 2022].map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          <button
            className="clear-btn"
            onClick={() => {
              setFilterMonth('');
              setFilterYear('');
              setFilterBank('');
            }}
          >
            Reset
          </button>
        </aside>

        {/* LISTA (solo móvil/tablet) */}
        <section className="report-list only-mobile">
          {loading ? (
            <p className="loading-message">Cargando documentos...</p>
          ) : errorMsg ? (
            <p className="no-files">{errorMsg}</p>
          ) : filteredFiles.length === 0 ? (
            <p className="no-files">No hay documentos disponibles.</p>
          ) : (
            <ul>
              {filteredFiles.map((file) => (
                <li key={file.id} className="report-item">
                  <div className="report-icon">📎</div>
                  <div className="report-info">
                    <strong className="truncated-text">
                      {file.title || file.originalName}
                    </strong>
                    <p>{file.description || 'Sin descripción.'}</p>
                    <small>
                      {file.month ?? ''} {file.year ?? ''} — {file.bank ?? '—'}
                    </small>
                  </div>
                  <button className="report-button" onClick={() => openPdf(file)}>
                    Ver PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* TABLA (solo desktop) */}
        <section className="reports-table only-desktop">
          {loading ? (
            <div className="table-skeleton" />
          ) : errorMsg ? (
            <p className="no-files">{errorMsg}</p>
          ) : filteredFiles.length === 0 ? (
            <p className="no-files">No hay documentos disponibles.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bank</th>
                  <th>Type</th>
                  <th className="actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={`row-${file.id}`}>
                    <td>
                      <div className="date-cell">
                        <span className="date">{formatDate(file.date || file.createdAt)}</span>
                        <span className="subdate">
                          {file.month ?? '—'} {file.year ?? ''}
                        </span>
                      </div>
                    </td>
                    <td>{file.bank ?? '—'}</td>
                    <td>{file.type || '—'}</td>
                    <td className="actions">
                      <button className="link-btn" onClick={() => openPdf(file)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default withAuth(ReportsPage, ['client', 'admin', 'superadmin']);
