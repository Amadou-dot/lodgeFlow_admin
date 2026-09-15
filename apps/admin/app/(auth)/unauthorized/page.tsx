import { SignOutButton } from '@clerk/nextjs';
import { Button } from '@heroui/button';

export default function UnauthorizedPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='w-full max-w-md p-8'>
        <div className='text-center space-y-6'>
          {/* Icon */}
          <div className='flex justify-center'>
            <div className='rounded-full bg-danger/10 p-6'>
              <svg
                className='w-16 h-16 text-danger'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                xmlns='http://www.w3.org/2000/svg'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className='text-3xl font-bold text-foreground'>Access Denied</h1>

          {/* Message */}
          <div className='space-y-2'>
            <p className='text-foreground-600'>
              You do not have permission to access this application.
            </p>
            <p className='text-sm text-foreground-500'>
              This admin portal is only accessible to administrators. If you
              believe this is an error, please contact your system
              administrator.
            </p>
          </div>

          {/* Sign Out Button */}
          <div className='pt-4'>
            <SignOutButton>
              <Button
                color='danger'
                variant='flat'
                size='lg'
                className='w-full'
              >
                Sign Out
              </Button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </div>
  );
}
