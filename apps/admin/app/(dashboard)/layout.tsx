import { AuthGuard } from '@/components/AuthGuard';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
