'use client';

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs';
import { Button } from '@heroui/button';
import { Link } from '@heroui/link';
import {
  Navbar as HeroUINavbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from '@heroui/navbar';
import { link as linkStyles } from '@heroui/theme';
import clsx from 'clsx';
import { ClipboardList, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ThemeSwitch } from '@/components/theme-switch';
import { siteConfig } from '@/config/site';
export const Navbar = () => {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <HeroUINavbar
      isBordered
      isMenuOpen={isMenuOpen}
      maxWidth='xl'
      position='sticky'
      onMenuOpenChange={setIsMenuOpen}
    >
      <NavbarContent className='basis-1/5 sm:basis-full' justify='start'>
        <NavbarBrand as='li' className='gap-3 max-w-fit'>
          <NextLink className='flex justify-start items-center gap-3' href='/'>
            <Image
              alt='LodgeFlow'
              height={48}
              priority
              src='/logo.svg'
              width={48}
            />
            <span className='hidden sm:inline-block font-bold text-xl text-inherit mr-3.5'>
              LodgeFlow
            </span>
          </NextLink>
        </NavbarBrand>
        <ul className='hidden sm:flex gap-6 justify-start ml-8'>
          {siteConfig.navItems.map(item => (
            <NavbarItem key={item.href}>
              <NextLink
                color='foreground'
                href={item.href}
                className={clsx(
                  linkStyles({ color: 'foreground' }),
                  'transition-colors',
                  isActive(item.href)
                    ? 'text-green-600 font-semibold'
                    : 'hover:text-green-600'
                )}
              >
                {item.label}
              </NextLink>
            </NavbarItem>
          ))}
        </ul>
      </NavbarContent>

      <NavbarContent
        className='hidden sm:flex basis-1/5 sm:basis-full'
        justify='end'
      >
        {/* Authentication Section */}
        <NavbarItem className='flex gap-2'>
          <SignedOut>
            <SignInButton mode='modal'>
              <Button
                className='font-medium'
                color='default'
                size='sm'
                variant='bordered'
              >
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode='modal'>
              <Button
                className='font-medium'
                color='secondary'
                size='sm'
                variant='bordered'
              >
                Sign Up
              </Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'w-8 h-8',
                },
              }}
            >
              <UserButton.MenuItems>
                <UserButton.Link
                  href='/bookings'
                  label='Booking History'
                  labelIcon={<ClipboardList className='w-4 h-4' />}
                />
                <UserButton.Action
                  label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  labelIcon={
                    theme === 'dark' ? (
                      <Sun className='w-4 h-4' />
                    ) : (
                      <Moon className='w-4 h-4' />
                    )
                  }
                  onClick={toggleTheme}
                />
              </UserButton.MenuItems>
            </UserButton>
          </SignedIn>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent className='sm:hidden basis-1 pl-4' justify='end'>
        <SignedIn>
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link
                href='/bookings'
                label='Booking History'
                labelIcon={<ClipboardList className='w-4 h-4' />}
              />
              <UserButton.Action
                label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                labelIcon={
                  theme === 'dark' ? (
                    <Sun className='w-4 h-4' />
                  ) : (
                    <Moon className='w-4 h-4' />
                  )
                }
                onClick={toggleTheme}
              />
            </UserButton.MenuItems>
          </UserButton>
        </SignedIn>
        <SignedOut>
          <ThemeSwitch />
        </SignedOut>
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        <div className='mx-4 mt-2 flex flex-col gap-2'>
          {siteConfig.navItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                as={NextLink}
                color='foreground'
                href={item.href}
                size='lg'
                className={clsx(
                  'transition-colors',
                  isActive(item.href)
                    ? 'text-green-600 font-semibold'
                    : 'hover:text-green-600'
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}

          {/* Mobile Authentication */}
          <NavbarMenuItem>
            <SignedOut>
              <div className='flex flex-col gap-2 mt-4'>
                <SignInButton mode='modal'>
                  <Button
                    className='w-full'
                    color='default'
                    size='md'
                    variant='bordered'
                  >
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode='modal'>
                  <Button
                    className='w-full'
                    color='secondary'
                    size='md'
                    variant='bordered'
                  >
                    Sign Up
                  </Button>
                </SignUpButton>
              </div>
            </SignedOut>
          </NavbarMenuItem>
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};
