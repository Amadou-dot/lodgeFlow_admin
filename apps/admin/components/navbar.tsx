'use client';

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import { Link } from '@heroui/link';
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from '@heroui/navbar';

import { ThemeSwitch } from '@/components/theme-switch';
import { getDetailMemory } from '@/hooks/useDetailPageMemory';
import { Button } from '@heroui/button';
import clsx from 'clsx';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Sun,
  Moon,
  LayoutDashboard,
  Home,
  Calendar,
  Sparkles,
  UtensilsCrossed,
  Users,
  Settings,
  ExternalLink,
} from 'lucide-react';

const MEMORY_SECTIONS: Record<string, string> = {
  '/guests': 'guests',
  '/bookings': 'bookings',
};

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathName = usePathname();
  const { setTheme, theme } = useTheme();
  const menuItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Cabins', href: '/cabins', icon: Home },
    { name: 'Bookings', href: '/bookings', icon: Calendar },
    { name: 'Experiences', href: '/experiences', icon: Sparkles },
    { name: 'Dining', href: '/dining', icon: UtensilsCrossed },
    { name: 'Guests', href: '/guests', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <HeroUINavbar
      isBordered
      maxWidth='2xl'
      isMenuOpen={isOpen}
      onMenuOpenChange={setIsOpen}
    >
      <NavbarContent>
        <NavbarMenuToggle className='md:hidden' />
      </NavbarContent>

      <NavbarContent as='div' justify='end'>
        <SignedOut>
          <ThemeSwitch />
          <SignInButton>
            <Button color='primary' variant='ghost'>
              Sign In
            </Button>
          </SignInButton>
          <SignUpButton>
            <Button color='primary' variant='solid'>
              Sign Up
            </Button>
          </SignUpButton>
        </SignedOut>

        <SignedIn>
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label='Toggle theme'
                labelIcon={
                  theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />
                }
                onClick={toggleTheme}
              />
              <UserButton.Action
                label='Customer site'
                labelIcon={<ExternalLink size={16} />}
                onClick={() => window.open('https://lodgeflow.app', '_blank')}
              />
            </UserButton.MenuItems>
          </UserButton>
        </SignedIn>
      </NavbarContent>

      <NavbarMenu>
        {menuItems.map((item, index) => {
          const sectionKey = MEMORY_SECTIONS[item.href];
          const savedPath = sectionKey ? getDetailMemory(sectionKey) : null;
          const effectiveHref =
            savedPath && savedPath.startsWith(item.href + '/')
              ? savedPath
              : item.href;
          const isLinkActive = pathName === item.href;
          const Icon = item.icon;
          return (
            <NavbarMenuItem key={index}>
              <Link
                onPress={() => setIsOpen(!isOpen)}
                color='foreground'
                className={clsx(
                  'w-full p-2 flex items-center gap-3',
                  isLinkActive && 'font-bold rounded-lg bg-primary'
                )}
                href={effectiveHref}
                size='lg'
              >
                <Icon size={20} />
                {item.name}
              </Link>
            </NavbarMenuItem>
          );
        })}
      </NavbarMenu>
    </HeroUINavbar>
  );
};
