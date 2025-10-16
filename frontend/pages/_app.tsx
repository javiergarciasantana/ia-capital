import '../styles/admin-panel.css';
import '../styles/chat.css';
import '../styles/dashboard.css';
import '../styles/documents.css';
import '../styles/documentsManager.css';
import '../styles/globals.css';
import '../styles/login.css';
import '../styles/MovileMenu.module.css';
import '../styles/reports.css';
import '../styles/settings.css';

import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { appWithTranslation } from 'next-i18next';
import { AuthProvider } from '../context/AuthContext';

function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default appWithTranslation(App);
