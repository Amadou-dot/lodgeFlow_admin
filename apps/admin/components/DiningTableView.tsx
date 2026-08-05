'use client';

import type { Dining } from '@/types';
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/table';
import { Eye } from 'lucide-react';
import Image from 'next/image';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface DiningTableViewProps {
  dining: Dining[];
  isLoading: boolean;
  onView?: (dining: Dining) => void;
  onEdit: (dining: Dining) => void;
  onDelete: (dining: Dining) => void;
}

const columns = [
  { key: 'image', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'mealType', label: 'Meal' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price' },
  { key: 'availability', label: 'Status' },
  { key: 'actions', label: '' },
];

const getMealTypeColor = (mealType: string) => {
  switch (mealType) {
    case 'breakfast':
      return 'warning';
    case 'lunch':
      return 'primary';
    case 'dinner':
      return 'secondary';
    case 'all-day':
      return 'success';
    default:
      return 'default';
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'craft-beer':
      return 'warning';
    case 'wine':
      return 'danger';
    case 'spirits':
      return 'secondary';
    case 'non-alcoholic':
      return 'success';
    default:
      return 'primary';
  }
};

export default function DiningTableView({
  dining,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: DiningTableViewProps) {
  const loadingState = isLoading && dining.length === 0 ? 'loading' : 'idle';

  const renderCell = (item: Dining, columnKey: string) => {
    switch (columnKey) {
      case 'image':
        return (
          <Image
            src={item.image}
            alt={item.name}
            width={48}
            height={48}
            className='w-12 h-12 rounded-md object-cover'
          />
        );
      case 'name':
        return (
          <div>
            <p className='font-semibold'>{item.name}</p>
            {item.description && (
              <p className='text-xs text-default-400 line-clamp-1 max-w-[200px]'>
                {item.description}
              </p>
            )}
          </div>
        );
      case 'type':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={item.type === 'experience' ? 'secondary' : 'default'}
          >
            {item.type}
          </Chip>
        );
      case 'mealType':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={getMealTypeColor(item.mealType)}
          >
            {item.mealType}
          </Chip>
        );
      case 'category':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={getCategoryColor(item.category)}
          >
            {item.category.replace('-', ' ')}
          </Chip>
        );
      case 'price':
        return <span className='font-semibold'>${item.price}</span>;
      case 'availability':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={item.isAvailable ? 'success' : 'default'}
          >
            {item.isAvailable ? 'Available' : 'Unavailable'}
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
                aria-label='Dining actions'
              >
                <VerticalDotsIcon size={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label='Dining actions'>
              {onView ? (
                <DropdownItem
                  key='view'
                  startContent={<Eye className='w-4 h-4' />}
                  onPress={() => onView(item)}
                >
                  View Details
                </DropdownItem>
              ) : null}
              <DropdownItem
                key='edit'
                startContent={<EditIcon size={16} />}
                onPress={() => onEdit(item)}
              >
                Edit
              </DropdownItem>
              <DropdownItem
                key='delete'
                className='text-danger'
                color='danger'
                startContent={<TrashIcon size={16} />}
                onPress={() => onDelete(item)}
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
      aria-label='Dining items table'
      removeWrapper
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
        items={dining}
        isLoading={isLoading}
        loadingContent={<Spinner label='Loading dining items...' />}
        loadingState={loadingState}
        emptyContent='No dining items found'
      >
        {item => (
          <TableRow key={item._id} onClick={() => onView?.(item)}>
            {columnKey => (
              <TableCell>{renderCell(item, columnKey as string)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
