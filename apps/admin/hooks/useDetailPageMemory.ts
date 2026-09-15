import { useEffect } from 'react';

const STORAGE_PREFIX = 'detailMemory:';

export function useDetailPageMemory(sectionKey: string): void {
  useEffect(() => {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${sectionKey}`,
      window.location.pathname
    );
  }, [sectionKey]);
}

export function clearDetailMemory(sectionKey: string): void {
  sessionStorage.removeItem(`${STORAGE_PREFIX}${sectionKey}`);
}

export function getDetailMemory(sectionKey: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`${STORAGE_PREFIX}${sectionKey}`);
}
