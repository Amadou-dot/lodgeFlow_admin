import { requireApiAuth } from '@/lib/api-utils';
import { redirect } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) {
    redirect(access.error?.status === 401 ? '/sign-in' : '/unauthorized');
  }
  return (
    <AuthGuard>
      <div className='flex h-screen'>
        <Sidebar />
        <div className='flex flex-col flex-1 overflow-hidden'>
          <Navbar />
          <main className='flex-1 overflow-auto'>
            <div className='mx-auto pt-6 px-6 h-full'>{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
