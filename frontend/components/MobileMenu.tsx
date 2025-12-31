import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import styles from '../styles/MobileMenu.module.css';
import { useAuth } from '../context/AuthContext';

export default function MobileMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAnim, setShowAnim] = useState(false);
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

  const toggleMenu = () => {
    if (!menuOpen) {
      setMenuOpen(true);
      setTimeout(() => setShowAnim(true), 10); // allow DOM mount before anim
    } else {
      setShowAnim(false);
      setTimeout(() => setMenuOpen(false), 300); // match CSS transition duration
    }
  };
  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  const overlay = (
    <div
      className={
        styles.menuOverlay + ' ' + (showAnim ? styles.menuOverlayVisible : styles.menuOverlayHidden)
      }
      role="dialog"
      aria-modal="true"
      onClick={toggleMenu}
    >
      <button
        className={styles.closeButton}
        aria-label="Cerrar menú"
        onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
      >
        <span className={styles.closeBar} />
        <span className={styles.closeBar} />
      </button>

      <nav
        className={
          styles.menuContent + ' ' + (showAnim ? styles.menuContentVisible : styles.menuContentHidden)
        }
        onClick={(e) => e.stopPropagation()}
      >
        <ul>
          <li onClick={() => navigateTo('/dashboard')}>Panel principal</li>
          {/* <li onClick={() => navigateTo('/reports')}>Informes</li> */}
          {(auth?.role === 'admin' || auth?.role === 'superadmin') && (
            <li onClick={() => navigateTo('/admin-panel')}>Subir Informes</li>
          )}
          {(auth?.role === 'admin' || auth?.role === 'superadmin') && (
            <li onClick={() => navigateTo('/invoices')}>Facturas</li>
          )}
          <li onClick={() => navigateTo('/chat')}>Chat</li>
          {/* <li onClick={() => navigateTo('/settings')}>Configuración</li> */}
          <li onClick={logout}>Cerrar sesión</li>
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
