import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { withAuth } from '../utils/withAuth';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import ProfitCard from '../components/ProfitCard';

type FileItem = {
  id: number;
  title?: string;
  originalName: string;
  filename: string;
  user?: { id: number };
};

function Dashboard() {
  const [lastDoc, setLastDoc] = useState<FileItem | null>(null);
  const [highlight, setHighlight] = useState(false);
  const { auth } = useAuth();
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api:5000';

  useEffect(() => {
    if (!auth?.token) return;

    const fetchLast = async () => {
      try {
        const res = await fetch(`${API_BASE}/documents`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`, // ✅ ahora enviamos el token
          },
        });

        if (!res.ok) {
          console.error('Error al obtener documentos:', res.status);
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error('Respuesta inesperada de /documents:', data);
          return;
        }

        // Solo documentos del usuario o generales
        const visibles = data.filter(
          (doc) => !doc.user || doc.user.id === auth.userId
        );

        if (visibles.length > 0) {
          const latest = visibles[0];
          setLastDoc(latest);

          const seen = JSON.parse(localStorage.getItem('seenDocs') || '[]');
          if (!seen.includes(latest.id)) {
            setHighlight(true);
            setTimeout(() => {
              const updated = [...seen, latest.id];
              localStorage.setItem('seenDocs', JSON.stringify(updated));
              setHighlight(false);
            }, 5000);
          }
        }
      } catch (err) {
        console.error('Error al cargar el último documento:', err);
      }
    };

    fetchLast();
  }, [auth, API_BASE]);

  if (!auth) {
    return (
      <div className="loading-container">
        <div className="loading-card">
          <h1>IA Capital</h1>
          <p>Cargando usuario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <Header variant="dashboard" title="Dashboard" />

      <main className="dashboard-main">
        {/* Tarjeta de beneficios */}
        <ProfitCard />

        {/* Último informe */}
        <div className="card-grid">
          <div
            className={`card small-card ${highlight ? 'highlighted-card' : ''}`}
            onClick={() => router.push('/reports')}
          >
            <p className="card-title">Último informe</p>
            {lastDoc ? (
              <>
                <p
                  className="doc-title"
                  title={lastDoc.title || lastDoc.originalName}
                >
                  {(lastDoc.title || lastDoc.originalName).slice(0, 30)}...
                </p>
                <div className="go-link">Ver en informes →</div>
              </>
            ) : (
              <>
                <div className="card-placeholder line" />
                <div className="card-placeholder line short" />
              </>
            )}
          </div>

          {/* Más widgets vacíos */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card small-card">
              <div className="card-placeholder line" />
              <div className="card-placeholder line short" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default withAuth(Dashboard, ['client', 'admin', 'superadmin']);
