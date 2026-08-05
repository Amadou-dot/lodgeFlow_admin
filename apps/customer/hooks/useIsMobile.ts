'use client';

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 1024; // Tailwind lg breakpoint

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(query.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
