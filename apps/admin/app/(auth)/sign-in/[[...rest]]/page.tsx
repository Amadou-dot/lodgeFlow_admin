import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='w-full max-w-md px-4'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground'>Welcome Back</h1>
          <p className='text-foreground-500 mt-2'>
            Sign in to access your LodgeFlow dashboard
          </p>
          <p className='flex flex-col text-gray-500 text-sm'>
            Test account:
            <span>email: admin+clerk_test@lodgeflow.app</span>
            <span>password: lodgeflow</span>
            <span>verification code: 424242</span>
          </p>
        </div>
        <div className='flex justify-center'>
          <SignIn />
        </div>
      </div>
    </div>
  );
}
