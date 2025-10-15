import '../styles/globals.css';
import '../styles/admin-panel.css';
import MobileMenu from '../components/MobileMenu';
import { withAuth } from '../utils/withAuth';
import { useRouter } from 'next/router';

function AdminPanel() {
  const router = useRouter();

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="admin-header-left">
          <span className="logo">IA Capital</span>
          <h1 className="admin-title">Panel de Administración</h1>
        </div>
        <MobileMenu />
      </header>

      <div className="admin-actions">
        <button className="action-btn" onClick={() => router.push('/documents')}>
          Subir nuevo informe
        </button>

        <button className="action-btn" onClick={() => router.push('/admin-users')}>
          Gestionar usuarios
        </button>
      </div>

      <div className="admin-table">
        <p>Accede a “Subir nuevo informe” para gestionar tus archivos PDF.</p>
      </div>
    </div>
  );
}

export default withAuth(AdminPanel, ['admin', 'superadmin']);
