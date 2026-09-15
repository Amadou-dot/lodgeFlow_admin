import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='w-full max-w-md'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground'>Welcome Back</h1>
          <p className='text-foreground-500 mt-2'>
            Sign in to book your perfect cabin getaway
          </p>
        </div>
        <SignIn withSignUp />
      </div>
    </div>
  );
}
