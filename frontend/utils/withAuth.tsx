import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export const withAuth = (WrappedComponent: any, allowedRoles?: string[]) => {
  return function ProtectedComponent(props: any) {
    const { auth, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        if (!auth) {
          router.push('/login');
        } else if (allowedRoles && !allowedRoles.includes(auth.role)) {
          router.push('/dashboard');
        }
      }
    }, [loading, auth, router]);

     if (loading || !auth) {
      return <div>Loading...</div>; // Or a proper spinner component
    }

    return <WrappedComponent {...props} />;
  };
};
