'use client';
import {
  ArrowLeft,
  Edit,
  EllipsisVertical,
  LayoutGrid,
  List,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';
import { useEffect, useState } from 'react';

import { IconSvgProps } from '@/types';

export const Logo: React.FC<IconSvgProps> = ({ size = 36, width, height }) => {
  const [_mounted, setMounted] = useState(false);

  // Only render logo after component has mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSize = Number(size || width || height || 36);

  return (
    <Image
      src='/logo.svg'
      alt='LodgeFlow'
      width={logoSize}
      height={logoSize}
      className='rounded'
    />
  );
};

export const MoonFilledIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const iconSize = size || width || height || 24;
  return <Moon size={iconSize} {...props} />;
};

export const SunFilledIcon = ({
  size = 24,
  width,
  height,
  ...props
}: IconSvgProps) => {
  const iconSize = size || width || height || 24;
  return <Sun size={iconSize} {...props} />;
};

export const SearchIcon = (props: IconSvgProps) => {
  return <Search {...props} />;
};

export const PlusIcon = (props: IconSvgProps) => {
  return <Plus {...props} />;
};

export const ArrowLeftIcon = (props: IconSvgProps) => {
  return <ArrowLeft {...props} />;
};

export const EditIcon = (props: IconSvgProps) => {
  return <Edit {...props} />;
};

export const TrashIcon = (props: IconSvgProps) => {
  return <Trash2 {...props} />;
};

export const VerticalDotsIcon = (props: IconSvgProps) => {
  return <EllipsisVertical {...props} />;
};

export const GridIcon = (props: IconSvgProps) => {
  return <LayoutGrid {...props} />;
};

export const ListIcon = (props: IconSvgProps) => {
  return <List {...props} />;
};
