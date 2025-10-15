import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export const withAuth = (Component: any, allowedRoles?: string[]) => {
  return function ProtectedComponent(props: any) {
    const { auth } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!auth) {
        router.push('/login');
      } else if (allowedRoles && !allowedRoles.includes(auth.role)) {
        router.push('/dashboard');
      }
    }, [auth]);

    if (!auth) return null;
    if (allowedRoles && !allowedRoles.includes(auth.role)) return null;

    return <Component {...props} />;
  };
};
