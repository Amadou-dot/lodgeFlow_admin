interface ContainerProps {
  children: React.ReactNode;
}

export default function Container({ children }: ContainerProps) {
  return <div className='grid md:grid-cols-2 w-full gap-6'>{children}</div>;
}
