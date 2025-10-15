import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/globals.css';
import '../styles/login.css';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, auth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirige si ya hay sesión activa
  useEffect(() => {
    if (auth) {
      router.push('/dashboard');
    }
  }, [auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:5000/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Error al iniciar sesión');
        setLoading(false);
        return;
      }

      login(data.access_token);
      router.push('/dashboard');
    } catch (err) {
      setError('No se pudo conectar con el servidor');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-shell">
        {/* Card */}
        <div className="login-card">
          <h1 className="login-title">LOGIN</h1>
          <p className="login-subtitle">Accede a tu panel financiero</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">
              Email:
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label htmlFor="password">
              Password:
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </button>
          </form>

          {error && <p className="login-error">{error}</p>}
          <p className="forgot-password">¿Olvidaste tu contraseña?</p>
        </div>

        {/* Ilustración: solo se muestra en ≥1024px por CSS */}
        <figure className="login-art" aria-hidden="true">
          <img src="/login-image.png" alt="" />
        </figure>
      </div>
    </div>
  );
}
