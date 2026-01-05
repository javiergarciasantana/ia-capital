import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, auth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const res = await fetch(`/api/auth/login`, {
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
      <div className="login-shell-flex">
        {/* Card */}
        <div
          className="login-card"
          style={{
            margin: 0,
            alignSelf: 'center',
            justifySelf: 'flex-start',
            marginLeft: 0,
            marginRight: 'auto',
          }}
        >
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

        {/* Ilustración */}
        <figure
          className="login-art"
          aria-hidden="true"
        >
          <img
            src="/login-image.png"
            alt=""
            style={{
              opacity: 0,
              transform: 'translateX(-40px) scale(0.95)',
              animation: 'loginArtAppear 0.8s cubic-bezier(0.4,0,0.2,1) forwards',
              width: '100%',
              height: 'auto',
              maxWidth: '520px', // increased size
              display: 'block',
              marginLeft: '360px', // move further right
            }}
          />
          <style jsx>{`
            @keyframes loginArtAppear {
              to {
                opacity: 1;
                transform: translateX(0) scale(1);
              }
            }
            .login-shell-flex {
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              gap: 2rem;
            }
            .login-card {
              width: 350px;
              background: #fff;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              padding: 2rem;
            }
            .login-art {
              display: none;
            }
            @media (min-width: 1024px) {
              .login-art {
                display: block;
              }
            }
          `}</style>
        </figure>
      </div>
    </div>
  );
}
