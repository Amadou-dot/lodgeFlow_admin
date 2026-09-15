import { ReactNode } from 'react';
import { Card, CardBody } from '@heroui/card';

interface ContactInfoItemProps {
  icon: ReactNode;
  title: string;
  lines: string[];
  subtitle?: string;
}

interface ContactInfoCardProps {
  title: string;
  items: ContactInfoItemProps[];
  children?: ReactNode;
  className?: string;
}

export function ContactInfoCard({
  title,
  items,
  children,
  className = '',
}: ContactInfoCardProps) {
  return (
    <Card className={className}>
      <CardBody className='space-y-6'>
        <h3 className='text-xl font-bold'>{title}</h3>

        <div className='space-y-4'>
          {items.map((item, index) => (
            <ContactInfoItem key={index} {...item} />
          ))}
        </div>

        {children}
      </CardBody>
    </Card>
  );
}

function ContactInfoItem({
  icon,
  title,
  lines,
  subtitle,
}: ContactInfoItemProps) {
  return (
    <div className='flex items-start gap-3'>
      <div className='w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0'>
        {icon}
      </div>
      <div>
        <h4 className='font-semibold'>{title}</h4>
        {lines.map((line, index) => (
          <p key={index} className='text-default-600'>
            {line}
          </p>
        ))}
        {subtitle && <p className='text-sm text-default-500'>{subtitle}</p>}
      </div>
    </div>
  );
}
