'use client';

import { ReactNode, useEffect } from 'react';
import '@/config/firebase';

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    console.log('✅ Firebase initialized on frontend');
  }, []);

  return <>{children}</>;
}
