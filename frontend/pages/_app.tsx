import '../styles/admin-panel.css';
import '../styles/chat.css';
import '../styles/dashboard.css';
import '../styles/documents.css';
import '../styles/documentsManager.css';
import '../styles/globals.css';
import '../styles/login.css';
import '../styles/MobileMenu.module.css';
import '../styles/reports.css';
import '../styles/settings.css';


import { ToastContainer } from 'react-toastify';
import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { appWithTranslation } from 'next-i18next';
import { AuthProvider } from '../context/AuthContext';

function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthProvider>
        <Component {...pageProps} />
        <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default appWithTranslation(App);
