'use client';

import type { ReactNode } from 'react';
import { Card, CardBody } from '@heroui/card';
import { Pagination } from '@heroui/pagination';
import { Select, SelectItem } from '@heroui/select';
import { Spinner } from '@heroui/spinner';

export function OperationsPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className='container mx-auto px-4 py-8'>
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <h1 className='text-3xl font-bold'>{title}</h1>
          <p className='text-default-600 mt-1'>{description}</p>
        </div>
        {action}
      </div>
      <div className='space-y-6'>{children}</div>
    </section>
  );
}

export function OperationsSelect({
  label,
  value,
  onChange,
  options,
  isDisabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      label={label}
      aria-label={label}
      size='sm'
      variant='bordered'
      className={className}
      selectedKeys={[value || '__all__']}
      isDisabled={isDisabled}
      disallowEmptySelection
      onSelectionChange={keys => {
        const selected = Array.from(keys)[0];
        if (selected !== undefined)
          onChange(selected === '__all__' ? '' : String(selected));
      }}
    >
      {options.map(option => (
        <SelectItem key={option.value || '__all__'}>{option.label}</SelectItem>
      ))}
    </Select>
  );
}

export function OperationsLoading({ label }: { label: string }) {
  return (
    <Card>
      <CardBody className='items-center justify-center py-16'>
        <Spinner label={label} />
      </CardBody>
    </Card>
  );
}

export function OperationsError({ message }: { message: string }) {
  return message ? (
    <Card className='bg-danger-50 border border-danger-200'>
      <CardBody>
        <p role='alert' className='text-danger'>
          {message}
        </p>
      </CardBody>
    </Card>
  ) : null;
}

export function OperationsPagination({
  page,
  total,
  loading,
  onChange,
}: {
  page: number;
  total: number;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-4'>
      <span className='text-sm text-default-500'>
        Page {page} of {Math.max(1, Math.ceil(total / 25))}
      </span>
      <Pagination
        showControls
        page={page}
        total={Math.max(1, Math.ceil(total / 25))}
        isDisabled={loading}
        onChange={onChange}
      />
    </div>
  );
}
