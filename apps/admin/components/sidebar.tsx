'use client';

import { useStaffAccess } from '@/components/AuthGuard';
import { pagePermission } from '@/lib/permissions';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getDetailMemory } from '@/hooks/useDetailPageMemory';

const sidebarItems = [
  { label: 'Reservations', href: '/reservations', icon: '📥' },
  { label: 'Calendar', href: '/calendar', icon: '🗓️' },
  { label: 'Audit history', href: '/audit', icon: '📋' },
  { label: 'Staff', href: '/staff', icon: '🔑' },
  {
    label: 'Dashboard',
    href: '/',
    icon: '🏠',
  },
  {
    label: 'Cabins',
    href: '/cabins',
    icon: '🏘️',
  },
  {
    label: 'Bookings',
    href: '/bookings',
    icon: '📅',
  },
  {
    label: 'Experiences',
    href: '/experiences',
    icon: '🌄',
  },
  {
    label: 'Dining',
    href: '/dining',
    icon: '🍽️',
  },
  {
    label: 'Guests',
    href: '/guests',
    icon: '👥',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: '⚙️',
  },
];

const MEMORY_SECTIONS: Record<string, string> = {
  '/guests': 'guests',
  '/bookings': 'bookings',
};

export const Sidebar = () => {
  const access = useStaffAccess();
  const pathname = usePathname();
  const router = useRouter();
  const [_mounted, setMounted] = useState(false);

  // Only render logo after component has mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <aside className='hidden md:flex w-64 bg-background border-r border-default-200 h-full flex-col'>
      <div className='p-6 '>
        <Link href='/' className='flex justify-center'>
          <Image src='/logo.svg' alt='LodgeFlow' width={120} height={120} />
        </Link>
      </div>

      <nav className='flex-1 px-4 py-4'>
        <ul className='space-y-2'>
          {sidebarItems
            .filter(item =>
              access?.permissions.includes(pagePermission(item.href))
            )
            .map(item => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={e => {
                      const sectionKey = MEMORY_SECTIONS[item.href];
                      if (sectionKey) {
                        const savedPath = getDetailMemory(sectionKey);
                        if (
                          savedPath &&
                          savedPath.startsWith(item.href + '/')
                        ) {
                          e.preventDefault();
                          router.push(savedPath);
                        }
                      }
                    }}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-default-100'
                    )}
                  >
                    <span className='text-lg'>{item.icon}</span>
                    <span className='font-medium'>{item.label}</span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      <div className='p-4 border-t border-default-200'>
        <p className='text-xs text-default-400 text-center'>© 2025 LodgeFlow</p>
      </div>
    </aside>
  );
};
