import { ReactNode } from 'react';
import { Button } from '@heroui/button';
import { Link } from '@heroui/link';

interface CallToActionButton {
  label: string;
  href: string;
  variant?:
    'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost';
  color?:
    'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  startContent?: ReactNode;
  endContent?: ReactNode;
  isExternal?: boolean;
}

interface CallToActionSectionProps {
  title: string;
  subtitle?: string;
  buttons: CallToActionButton[];
  background?: 'default' | 'gradient' | 'colored';
  className?: string;
}

export function CallToActionSection({
  title,
  subtitle,
  buttons,
  background = 'gradient',
  className = '',
}: CallToActionSectionProps) {
  const backgroundClasses = {
    default: 'bg-content1',
    gradient:
      'bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950',
    colored: 'bg-green-50 dark:bg-green-950',
  };

  return (
    <section
      className={`text-center ${backgroundClasses[background]} rounded-2xl p-12 ${className}`}
    >
      <h2 className='text-2xl md:text-3xl font-bold mb-4'>{title}</h2>
      {subtitle && (
        <p className='text-default-600 mb-8 max-w-2xl mx-auto'>{subtitle}</p>
      )}
      <div className='flex flex-col sm:flex-row gap-4 justify-center'>
        {buttons.map((button, index) => (
          <Button
            key={index}
            as={Link}
            className='px-8'
            color={button.color || 'primary'}
            endContent={button.endContent}
            href={button.href}
            isExternal={button.isExternal}
            size={button.size || 'lg'}
            startContent={button.startContent}
            variant={button.variant || 'solid'}
          >
            {button.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
