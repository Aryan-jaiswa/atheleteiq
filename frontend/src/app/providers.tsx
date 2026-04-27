'use client';

import { ReactNode, useEffect, useState } from 'react';
import axios from 'axios';
import app from '@/config/firebase';
import { checkBackendHealth } from '@/lib/api';

const isDevBypassEnabled =
  process.env.NODE_ENV === 'development' &&
  (process.env.NEXT_PUBLIC_API_URL?.includes('localhost') ?? false) &&
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'your-firebase-api-key';

export function Providers({ children }: { children: ReactNode }) {
  const [backendReachable, setBackendReachable] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (isDevBypassEnabled) {
      axios.defaults.headers.common.Authorization = 'Bearer dev-bypass-token';
    } else {
      delete axios.defaults.headers.common.Authorization;
    }

    if (app) {
      console.log('Firebase initialized on frontend');
      return;
    }

    console.warn('Firebase is unavailable on the frontend. Development bypass may be active.');
  }, []);

  useEffect(() => {
    let mounted = true;

    const runHealthCheck = async () => {
      const healthy = await checkBackendHealth();
      if (mounted) {
        setBackendReachable(healthy);
      }
    };

    runHealthCheck();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      {!backendReachable && !bannerDismissed && (
        <div className="sticky top-0 z-50 border-b border-yellow-500/40 bg-yellow-400/90 text-slate-950">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 text-sm font-medium">
            <span>⚠️ Backend service is unreachable. Some features may not work.</span>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="rounded border border-slate-950/20 px-3 py-1 hover:bg-slate-950/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
