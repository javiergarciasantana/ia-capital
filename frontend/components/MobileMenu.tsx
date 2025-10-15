import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import styles from '../styles/MobileMenu.module.css';
import { useAuth } from '../context/AuthContext';

export default function MobileMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { logout, auth } = useAuth();

  useEffect(() => setMounted(true), []);

  // bloquear scroll cuando está abierto
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? 'hidden' : prev || '';
    return () => { document.body.style.overflow = prev || ''; };
  }, [menuOpen, mounted]);

  const toggleMenu = () => setMenuOpen(p => !p);
  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  const overlay = (
    <div
      className={styles.menuOverlay}
      role="dialog"
      aria-modal="true"
      onClick={() => setMenuOpen(false)}
    >
      <button
        className={styles.closeButton}
        aria-label="Cerrar menú"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
      >
        <span className={styles.closeBar} />
        <span className={styles.closeBar} />
      </button>

      <nav className={styles.menuContent} onClick={(e) => e.stopPropagation()}>
        <ul>
          <li onClick={() => navigateTo('/dashboard')}>Dashboard</li>
          <li onClick={() => navigateTo('/reports')}>Reports</li>
          <li onClick={() => navigateTo('/chat')}>Chat</li>
          {(auth?.role === 'admin' || auth?.role === 'superadmin') && (
            <li onClick={() => navigateTo('/admin-panel')}>Admin Panel</li>
          )}
          <li onClick={() => navigateTo('/settings')}>Settings</li>
          <li onClick={logout}>Logout</li>
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* hamburguesa de 2 líneas */}
      <button
        className={styles.menuButton}
        onClick={toggleMenu}
        aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        <span className={styles.line} />
        <span className={styles.line} />
      </button>

      {menuOpen && mounted && createPortal(overlay, document.body)}
    </>
  );
}
