'use client';

import { SignedIn } from '@clerk/nextjs';
import { ReactNode } from 'react';

import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SignedIn>
      <div className='flex h-screen'>
        <Sidebar />
        <div className='flex flex-col flex-1 overflow-hidden'>
          <Navbar />
          <main className='flex-1 overflow-auto'>
            <div className=' mx-auto  pt-6 px-6 h-full'>{children}</div>
          </main>
        </div>
      </div>
    </SignedIn>
  );
}
