import { useState } from 'react';
import '../styles/globals.css';
import '../styles/settings.css';
import Header from '../components/Header';
import { withAuth } from '../utils/withAuth';

function SettingsPage() {
  const [theme, setTheme] = useState('white');
  const [language, setLanguage] = useState('en');

  return (
    <div className="settings-container">
      <Header variant="dashboard" title="Dashboard" />

      <main className="settings-main">
        <div className="form-section">
          <label>
            <span>Name:</span>
            <div className="input-placeholder" />
          </label>
          <label>
            <span>Phone<br />Number:</span>
            <div className="input-placeholder" />
          </label>
          <label>
            <span>Email:</span>
            <div className="input-placeholder" />
          </label>
        </div>

        <div className="preferences-section">
          <div className="theme-section">
            <p className="section-title">Colors:</p>
            <div className="theme-options">
              <label className={theme === 'white' ? 'active' : ''}>
                <input
                  type="radio"
                  name="theme"
                  value="white"
                  checked={theme === 'white'}
                  onChange={() => setTheme('white')}
                />
                White
              </label>
              <label className={theme === 'black' ? 'active' : ''}>
                <input
                  type="radio"
                  name="theme"
                  value="black"
                  checked={theme === 'black'}
                  onChange={() => setTheme('black')}
                />
                Black
              </label>
            </div>
          </div>

          <div className="language-section">
            <p className="section-title">Language:</p>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
      </main>
    </div>
  );
}

export default withAuth(SettingsPage, ['client', 'admin', 'superadmin']);