'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { CollectorLogin } from '../../components/collector/collector-login';

export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      if (user.role === 'COLLECTOR') {
        router.push('/collector');
      } else {
        router.push('/admin');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-neutral-950 flex flex-col justify-center items-center p-4">
      <CollectorLogin
        onLoginSuccess={(loggedUser) => {
          if (loggedUser.role === 'COLLECTOR') {
            router.push('/collector');
          } else {
            router.push('/admin');
          }
        }}
      />
    </div>
  );
}
