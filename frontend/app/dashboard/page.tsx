'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user, isLoading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    // Route to role-specific dashboard
    switch (role) {
      case 'ATHLETE':
        router.push('/dashboard/athlete');
        break;
      case 'COACH':
        router.push('/dashboard/coach');
        break;
      case 'SCOUT':
        router.push('/dashboard/scout');
        break;
      case 'FEDERATION':
        router.push('/dashboard/federation');
        break;
      case 'ADMIN':
        router.push('/dashboard/admin');
        break;
      default:
        router.push('/login');
    }
  }, [user, isLoading, role, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
