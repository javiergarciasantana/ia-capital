import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Chart from 'chart.js/auto';
import { useAuth } from '../context/AuthContext';
import '../styles/dashboard.css';

type BankRow = { key: string; total: string | number };
type MonthRow = { key: string; year: number; total: string | number };
type Row = BankRow | MonthRow;

type FileItem = {
    id: number;
    title?: string;
    originalName: string;
    filename: string;
    bank?: string;
    month?: string;
    year?: string | number;
    date?: string;
    createdAt?: string;
    user?: { id: number };
};

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

function toNumber(v: unknown): number {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v !== 'string') return 0;
    const n = Number(v.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
}

// Ordena por fecha descendente con varios posibles campos
function byNewest(a: FileItem, b: FileItem): number {
    const ta = Date.parse(a.date || a.createdAt || '1970-01-01');
    const tb = Date.parse(b.date || b.createdAt || '1970-01-01');
    return tb - ta;
}

export default function ProfitCard() {
    const router = useRouter();
    const { auth } = useAuth();
    const [mode, setMode] = useState<'bank' | 'month'>('bank');
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

    // ---- Navegación general (CTA superior) ----
    const goToReports = (row: any) => {
        if (mode === 'bank') {
            router.push({
                pathname: '/reports',
                query: { bank: row.key },     // ej: ?bank=Santander
            });
        } else {
            const q: Record<string, string> = { month: row.key }; // ej: ?month=Mayo
            if (row.year) q.year = String(row.year);              //        &year=2025
            router.push({
                pathname: '/reports',
                query: q,
            });
        }
    };

    // ---- Abrir PDF directo para una fila ----
    const openPdfForRow = async (r: any) => {
        if (!auth?.token) return;

        // 1) Cargamos documentos visibles y filtramos por banco / mes-año
        const res = await fetch(`${API}/documents`, {
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        }).catch(() => null);
        if (!res || !res.ok) return alert('No se pudieron obtener los documentos.');

        const all: FileItem[] = await res.json().catch(() => []);
        const visibles = Array.isArray(all)
            ? all.filter((d) => !d.user || d.user.id === auth.userId)
            : [];

        let candidates: FileItem[] = [];
        if (mode === 'bank') {
            const bank = String(r.key || '').toLowerCase();
            candidates = visibles.filter((d) => String(d.bank || '').toLowerCase() === bank);
        } else {
            // month + year
            const month = String(r.key || '').toLowerCase();
            const year = Number(r.year);
            candidates = visibles.filter(
                (d) =>
                    String(d.month || '').toLowerCase() === month &&
                    Number(d.year) === (Number.isFinite(year) ? year : -1)
            );
        }

        if (!candidates.length) return alert('No hay PDF asociado a esa fila.');
        candidates.sort(byNewest);
        const doc = candidates[0];

        // 2) Intentamos varias rutas comunes; si alguna devuelve 200, abrimos blob
        const tryUrls = [
            `${API}/documents/${doc.id}/download`,
            `${API}/documents/${doc.id}/file`,
            `${API}/uploads/${encodeURIComponent(doc.filename)}`,
        ];

        for (const url of tryUrls) {
            try {
                const r = await fetch(url, {
                    headers: { Authorization: `Bearer ${auth.token}` },
                });
                if (r.ok) {
                    const blob = await r.blob();
                    const fileUrl = URL.createObjectURL(blob);
                    window.open(fileUrl, '_blank', 'noopener,noreferrer');
                    return;
                }
            } catch {
                /* continúa con la siguiente url */
            }
        }

        alert('No se pudo abrir el PDF. Revisa las rutas de descarga en el backend.');
    };

    // ---- Carga de datos agregados ----
    useEffect(() => {
        if (!auth?.token) return;

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setErrorMsg(null);

            const url =
                mode === 'bank' ? `${API}/profits/summary/bank` : `${API}/profits/summary/month`;

            try {
                const res = await fetch(url, {
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
                });

                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    if (!cancelled) {
                        setRows([]);
                        setErrorMsg(`Error ${res.status} al cargar ${mode}.`);
                    }
                    console.error(`[ProfitCard] ${mode} error`, res.status, text);
                    return;
                }

                const data = await res.json();
                if (!Array.isArray(data)) {
                    if (!cancelled) {
                        setRows([]);
                        setErrorMsg('Respuesta inesperada del servidor.');
                    }
                    return;
                }

                const safe: Row[] = data
                    .filter((x: any) => x && typeof x.key === 'string')
                    .map((x: any) => ({
                        key: String(x.key ?? ''),
                        year: typeof x.year === 'number' ? x.year : x.year ? Number(x.year) : undefined,
                        total: toNumber(x.total),
                    }));

                if (!cancelled) setRows(safe);
            } catch (err) {
                console.error('[ProfitCard] fetch error', err);
                if (!cancelled) {
                    setRows([]);
                    setErrorMsg('No se pudo conectar con el servidor.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [mode, auth?.token]);

    const labels = useMemo(() => {
        if (!Array.isArray(rows)) return [];
        if (mode === 'bank') return (rows as BankRow[]).map((r) => r.key || '—');
        return (rows as MonthRow[]).map((r) => (r.year ? `${r.key} ${r.year}` : r.key));
    }, [rows, mode]);

    const values = useMemo(() => rows.map((r: any) => toNumber(r.total)), [rows]);

    const grandTotal = useMemo(
        () => values.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0),
        [values]
    );

    // ---- Doughnut ----
    useEffect(() => {
        if (!canvasRef.current) return;
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }
        if (!labels.length || !values.length) return;

        chartRef.current = new Chart(canvasRef.current, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, borderWidth: 2 }] },
            options: {
                responsive: true,
                cutout: '60%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) =>
                                `${ctx.label}: ${Number(ctx.parsed).toLocaleString('es-ES', {
                                    minimumFractionDigits: 2,
                                })} €`,
                        },
                    },
                },
            },
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [labels, values]);

    return (
        <>
            <div className="card profit-card">
                <div className="profit-left">
                    <div className="profit-total">
                        {loading ? '—' : grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </div>

                    <div className="profit-tabs" role="tablist" aria-label="Distribución de beneficios">
                        <button
                            className={`profit-tab ${mode === 'bank' ? 'active' : ''}`}
                            onClick={() => setMode('bank')}
                            role="tab"
                            aria-selected={mode === 'bank'}
                        >
                            Por banco
                        </button>
                        <button
                            className={`profit-tab ${mode === 'month' ? 'active' : ''}`}
                            onClick={() => setMode('month')}
                            role="tab"
                            aria-selected={mode === 'month'}
                        >
                            Por mes
                        </button>
                    </div>

                    {!loading && errorMsg && (
                        <div className="profit-item empty" style={{ marginTop: 6 }}>
                            {errorMsg}
                        </div>
                    )}

                    <ul className="profit-list" aria-live="polite">
                        {!loading && !errorMsg && labels.length === 0 && (
                            <li className="profit-item empty">Sin datos</li>
                        )}
                        {!errorMsg &&
                            rows.map((r: any) => (
                                <li key={`${mode}-${r.key}-${r.year ?? ''}`} className="profit-item">
                                    <span className="profit-bank">
                                        {mode === 'month' && r.year ? `${r.key} ${r.year}` : r.key}
                                    </span>
                                    <span className="profit-amount">
                                        {toNumber(r.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                                    </span>
                                </li>
                            ))}
                    </ul>
                </div>

                <div className="profit-right">
                    <div className="pie-wrap">
                        <canvas ref={canvasRef} />
                    </div>
                </div>
            </div>

            {/* Tabla de resumen debajo */}
            <section className="profit-table card">
                <div className="card-title">
                    {mode === 'bank' ? 'Resumen por banco' : 'Resumen por mes'}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>{mode === 'bank' ? 'Banco' : 'Periodo'}</th>
                            <th>Total (€)</th>
                            {/* NUEVO */}
                            <th className="action-col">Acción</th>
                        </tr>
                    </thead>

                    <tbody>
                        {!errorMsg &&
                            rows.map((r: any) => (
                                <tr key={`t-${mode}-${r.key}-${r.year ?? ''}`}>
                                    <td>{mode === 'month' && r.year ? `${r.key} ${r.year}` : r.key}</td>
                                    <td>{toNumber(r.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>

                                    {/* NUEVO */}
                                    <td className="action-col">
                                        <button
                                            type="button"
                                            className="table-link"
                                            onClick={() => goToReports(r)}
                                        >
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>

                {!loading && !errorMsg && rows.length === 0 && (
                    <div className="profit-item empty" style={{ padding: '8px' }}>
                        Sin datos para mostrar
                    </div>
                )}
            </section>
        </>
    );
}
