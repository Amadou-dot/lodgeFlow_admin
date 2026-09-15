'use client';

import type { Experience } from '@/types';
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
import { getDifficultyColor } from './ExperienceCard';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface ExperienceTableViewProps {
  experiences: Experience[];
  isLoading: boolean;
  onView?: (experience: Experience) => void;
  onEdit: (experience: Experience) => void;
  onDelete: (experience: Experience) => void;
}

const columns = [
  { key: 'image', label: '' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'price', label: 'Price' },
  { key: 'duration', label: 'Duration' },
  { key: 'actions', label: '' },
];

const getCategoryColor = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'adventure':
      return 'danger';
    case 'nature':
      return 'success';
    case 'culture':
      return 'secondary';
    case 'relaxation':
      return 'primary';
    case 'food & drink':
      return 'warning';
    case 'sports':
      return 'danger';
    default:
      return 'default';
  }
};

export default function ExperienceTableView({
  experiences,
  isLoading,
  onView,
  onEdit,
  onDelete,
}: ExperienceTableViewProps) {
  const loadingState =
    isLoading && experiences.length === 0 ? 'loading' : 'idle';

  const renderCell = (item: Experience, columnKey: string) => {
    switch (columnKey) {
      case 'image':
        return (
          <Image
            src={item.image || '/placeholder-experience.jpg'}
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
      case 'category':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={getCategoryColor(item.category)}
          >
            {item.category}
          </Chip>
        );
      case 'difficulty':
        return (
          <Chip
            size='sm'
            variant='flat'
            color={getDifficultyColor(item.difficulty)}
          >
            {item.difficulty}
          </Chip>
        );
      case 'price':
        return <span className='font-semibold'>${item.price}</span>;
      case 'duration':
        return <span className='text-default-600'>{item.duration}</span>;
      case 'actions':
        return (
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                variant='light'
                size='sm'
                aria-label='Experience actions'
              >
                <VerticalDotsIcon size={18} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label='Experience actions'>
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
      aria-label='Experiences table'
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
        items={experiences}
        isLoading={isLoading}
        loadingContent={<Spinner label='Loading experiences...' />}
        loadingState={loadingState}
        emptyContent='No experiences found'
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
