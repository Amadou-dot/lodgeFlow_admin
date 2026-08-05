'use client';

import type { Cabin } from '@/types';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { Checkbox } from '@heroui/checkbox';
import { Chip } from '@heroui/chip';
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/dropdown';
import { Eye } from 'lucide-react';
import Image from 'next/image';
import { EditIcon, TrashIcon, VerticalDotsIcon } from './icons';

interface CabinCardProps {
  cabin: Cabin;
  onView?: (cabin: Cabin) => void;
  onEdit: (cabin: Cabin) => void;
  onDelete: (cabin: Cabin) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  selectionMode?: boolean;
}

const statusColorMap = {
  active: 'success',
  maintenance: 'warning',
  inactive: 'danger',
} as const;

export default function CabinCard({
  cabin,
  onView,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelect,
  selectionMode,
}: CabinCardProps) {
  const discountedPrice = cabin.price - cabin.discount;
  const cabinStatus = cabin.status || 'active';

  return (
    <Card
      shadow='sm'
      className={`group w-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <CardBody className='p-0 cursor-pointer' onClick={() => onView?.(cabin)}>
        <div className='relative'>
          {onToggleSelect && (
            <div
              className={`absolute top-2 left-2 z-10 transition-opacity ${
                selectionMode || isSelected
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              }`}
              onClick={e => e.stopPropagation()}
            >
              <Checkbox
                isSelected={isSelected}
                onValueChange={onToggleSelect}
                aria-label={`Select ${cabin.name}`}
                classNames={{
                  wrapper:
                    'bg-white/80 dark:bg-black/50 backdrop-blur-sm shadow-sm',
                }}
              />
            </div>
          )}
          <Image
            src={cabin.image}
            alt={cabin.name}
            width={400}
            height={250}
            className='w-full h-48 object-cover rounded-t-lg'
          />
          <div className='absolute top-2 right-2 flex gap-1'>
            {cabinStatus !== 'active' && (
              <Chip
                color={statusColorMap[cabinStatus]}
                variant='solid'
                size='sm'
                className='shadow-md capitalize'
              >
                {cabinStatus}
              </Chip>
            )}
            {cabin.discount > 0 && (
              <Chip
                color='danger'
                variant='solid'
                size='sm'
                className='shadow-md'
              >
                ${cabin.discount} off
              </Chip>
            )}
          </div>
          <div className='absolute bottom-2 left-2'>
            <Chip
              color='primary'
              variant='solid'
              size='sm'
              className='shadow-md'
            >
              {cabin.capacity} guests
            </Chip>
          </div>
        </div>

        <div className='p-4'>
          <div className='flex justify-between items-start mb-2'>
            <h3 className='text-lg font-semibold'>{cabin.name}</h3>
            <Dropdown>
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant='light'
                  size='sm'
                  aria-label='Cabin actions'
                  onClick={e => e.stopPropagation()}
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
          </div>

          <div className='flex items-center gap-2 mb-3'>
            {cabin.discount > 0 ? (
              <>
                <span className='text-xl font-bold text-success'>
                  ${discountedPrice}
                </span>
                <span className='text-sm text-default-500 line-through'>
                  ${cabin.price}
                </span>
                <span className='text-xs text-default-400'>per night</span>
              </>
            ) : (
              <>
                <span className='text-xl font-bold'>${cabin.price}</span>
                <span className='text-xs text-default-400'>per night</span>
              </>
            )}
          </div>

          {(cabin.bedrooms || cabin.bathrooms || cabin.size) && (
            <div className='flex items-center gap-3 mb-3 text-sm text-default-500'>
              {cabin.bedrooms && <span>{cabin.bedrooms} bd</span>}
              {cabin.bathrooms && <span>{cabin.bathrooms} ba</span>}
              {cabin.size && <span>{cabin.size} ft&sup2;</span>}
            </div>
          )}

          {cabin.description && (
            <p className='text-sm text-default-500 line-clamp-2 mb-3'>
              {cabin.description}
            </p>
          )}

          <div className='flex flex-wrap gap-1'>
            {cabin.amenities.slice(0, 3).map(amenity => (
              <Chip key={amenity} size='sm' variant='flat' color='default'>
                {amenity}
              </Chip>
            ))}
            {cabin.amenities.length > 3 && (
              <Chip size='sm' variant='flat' color='default'>
                +{cabin.amenities.length - 3} more
              </Chip>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
