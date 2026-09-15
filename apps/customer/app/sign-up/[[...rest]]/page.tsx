import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <div className='w-full max-w-md'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-foreground'>Join LodgeFlow</h1>
          <p className='text-foreground-500 mt-2'>
            Create your account to start booking amazing experiences
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
