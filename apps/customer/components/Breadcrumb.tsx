import { BreadcrumbItem, Breadcrumbs } from '@heroui/breadcrumbs';
import Link from 'next/link';

export interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItemType[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <Breadcrumbs
      size='lg'
      classNames={{
        list: 'flex flex-wrap',
      }}
    >
      {items.map((item, index) => (
        <BreadcrumbItem
          key={index}
          className={index === items.length - 1 ? 'font-semibold' : ''}
          isCurrent={index === items.length - 1}
        >
          {item.href && index !== items.length - 1 ? (
            <Link
              className='hover:text-primary transition-colors'
              href={item.href}
            >
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </BreadcrumbItem>
      ))}
    </Breadcrumbs>
  );
}
