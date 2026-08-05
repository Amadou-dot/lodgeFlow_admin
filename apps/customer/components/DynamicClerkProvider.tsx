'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import { ReactNode, useEffect, useState } from 'react';

interface DynamicClerkProviderProps {
  children: ReactNode;
}

export function DynamicClerkProvider({ children }: DynamicClerkProviderProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for theme to be resolved on client side
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use dark theme when app is dark, undefined (default) for light
  const clerkTheme = mounted && resolvedTheme === 'dark' ? dark : undefined;

  return (
    <ClerkProvider appearance={{ theme: clerkTheme }}>{children}</ClerkProvider>
  );
}
