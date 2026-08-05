'use client';

import type { Cabin } from '@/types';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { Spinner } from '@heroui/spinner';
import {
  type Selection,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/table';
import { Eye } from 'lucide-react';
import Image from 'next/image';
import { Key } from 'react';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface CabinTableViewProps {
  cabins: Cabin[];
  isLoading: boolean;
  onView?: (cabin: Cabin) => void;
  onEdit: (cabin: Cabin) => void;
  onDelete: (cabin: Cabin) => void;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Selection) => void;
}

const columns = [
  { key: 'image', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'price', label: 'Price' },
  { key: 'discount', label: 'Discount' },
  { key: 'amenities', label: 'Amenities' },
  { key: 'actions', label: '' },
];

const statusColorMap = {
  active: 'success',
  maintenance: 'warning',
  inactive: 'danger',
} as const;

export default function CabinTableView({
  cabins,
  isLoading,
  onView,
  onEdit,
  onDelete,
  selectedKeys,
  onSelectionChange,
}: CabinTableViewProps) {
  const loadingState = isLoading && cabins.length === 0 ? 'loading' : 'idle';

  const handleRowAction = (key: Key) => {
    const cabin = cabins.find(c => c.id === String(key));
    if (cabin) onView?.(cabin);
  };

  const renderCell = (cabin: Cabin, columnKey: string) => {
    switch (columnKey) {
      case 'image':
        return (
          <Image
            src={cabin.image}
            alt={cabin.name}
            width={48}
            height={48}
            className='w-12 h-12 rounded-md object-cover'
          />
        );
      case 'name':
        return (
          <div>
            <p className='font-semibold'>{cabin.name}</p>
            {cabin.description && (
              <p className='text-xs text-default-400 line-clamp-1 max-w-[200px]'>
                {cabin.description}
              </p>
            )}
          </div>
        );
      case 'status':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={statusColorMap[cabin.status || 'active']}
            className='capitalize'
          >
            {cabin.status || 'active'}
          </Chip>
        );
      case 'capacity':
        return (
          <Chip size='sm' variant='flat' color='primary'>
            {cabin.capacity} guests
          </Chip>
        );
      case 'rooms':
        return cabin.bedrooms || cabin.bathrooms ? (
          <span className='text-sm text-default-600'>
            {cabin.bedrooms && `${cabin.bedrooms} bd`}
            {cabin.bedrooms && cabin.bathrooms && ' / '}
            {cabin.bathrooms && `${cabin.bathrooms} ba`}
          </span>
        ) : (
          <span className='text-default-400'>-</span>
        );
      case 'price':
        return cabin.discount > 0 ? (
          <div className='flex items-center gap-1'>
            <span className='font-semibold text-success'>
              ${cabin.price - cabin.discount}
            </span>
            <span className='text-xs text-default-400 line-through'>
              ${cabin.price}
            </span>
          </div>
        ) : (
          <span className='font-semibold'>${cabin.price}</span>
        );
      case 'discount':
        return cabin.discount > 0 ? (
          <Chip size='sm' color='danger' variant='flat'>
            ${cabin.discount} off
          </Chip>
        ) : (
          <span className='text-default-400'>-</span>
        );
      case 'amenities':
        return (
          <Chip size='sm' variant='flat' color='default'>
            {cabin.amenities.length} amenities
          </Chip>
        );
      case 'actions':
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                variant='light'
                size='sm'
                aria-label='Cabin actions'
              >
                <VerticalDotsIcon size={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label='Cabin actions'>
              {onView ? (
                <DropdownItem
                  key='view'
                  startContent={<Eye className='w-4 h-4' />}
                  onPress={() => onView(cabin)}
                >
                  View Details
                </DropdownItem>
              ) : null}
              <DropdownItem
                key='edit'
                startContent={<EditIcon size={16} />}
                onPress={() => onEdit(cabin)}
              >
                Edit
              </DropdownItem>
              <DropdownItem
                key='delete'
                className='text-danger'
                color='danger'
                startContent={<TrashIcon size={16} />}
                onPress={() => onDelete(cabin)}
              >
                Delete
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        );
      default:
        return null;
    }
  };

  return (
    <Table
      aria-label='Cabins table'
      removeWrapper
      selectionMode='multiple'
      selectedKeys={selectedKeys}
      onSelectionChange={onSelectionChange}
      onRowAction={handleRowAction}
      classNames={{
        base: 'max-h-[600px] overflow-auto',
        table: 'min-h-[200px] table-fixed w-full',
        thead: '[&>tr]:first:shadow-none',
        tbody: 'divide-y divide-default-200',
        tr: 'group-data-[odd]:bg-default-50 hover:bg-default-100 transition-colors cursor-pointer',
        th: 'bg-default-100 text-default-700 font-semibold',
        td: 'py-3 text-default-600',
      }}
    >
      <TableHeader columns={columns}>
        {column => (
          <TableColumn
            key={column.key}
            className={`${column.key === 'image' ? 'w-16' : ''} ${column.key === 'actions' ? 'w-16 text-center' : ''} ${column.key === 'name' ? 'w-[200px]' : ''}`}
          >
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        items={cabins}
        isLoading={isLoading}
        loadingContent={<Spinner label='Loading cabins...' />}
        loadingState={loadingState}
        emptyContent='No cabins found'
      >
        {cabin => (
          <TableRow key={cabin.id}>
            {columnKey => (
              <TableCell>{renderCell(cabin, columnKey as string)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
