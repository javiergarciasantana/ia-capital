import { createContext, useContext, useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useRouter } from 'next/router';

type Role = 'client' | 'admin' | 'superadmin';

type AuthData = {
  email: string;
  role: Role;
  token: string;
  userId: number;
};

interface AuthContextType {
  auth: AuthData | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [auth, setAuth] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true); // Start in a loading state

  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode<{ email: string; role: Role; sub: number }>(token);
        setAuth({
          token,
          email: decoded.email,
          role: decoded.role,
          userId: decoded.sub,
        });
      } catch (err) {
        console.warn('Token inválido. Cerrando sesión.');
        localStorage.removeItem('token');
        setAuth(null);
      }
    }
    setLoading(false)
  }, []);

  const login = (token: string) => {
    try {
      const decoded = jwtDecode<{ email: string; role: Role; sub: number }>(token);
      localStorage.setItem('token', token);
      setAuth({
        token,
        email: decoded.email,
        role: decoded.role,
        userId: decoded.sub,
      });
      router.push('/dashboard');
    } catch (err) {
      console.error('Error al procesar token de login:', err);
      localStorage.removeItem('token');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAuth(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ auth, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe estar dentro de AuthProvider');
  return context;
};
