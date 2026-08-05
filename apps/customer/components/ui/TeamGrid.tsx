'use client';
import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Chip } from '@heroui/chip';
import { Button } from '@heroui/button';

interface TeamMemberProps {
  /** The name of the team member */
  name: string;
  /** The role of the team member */
  role: string;
  /** A short bio of the team member */
  bio: string;
  /** The URL of the team member's image */
  image?: string;
  /** A memorable tagline or quote from the team member */
  tagline?: string;
  /** The organization the team member belongs to */
  organization?: string;
}

interface TeamGridProps {
  /** The title of the team grid */
  title?: string;
  /** The subtitle of the team grid */
  subtitle?: string;
  /** The team members to display */
  members: TeamMemberProps[];
  /** Number of columns in the grid (2, 3, or 4) */
  columns?: 2 | 3 | 4;
  /** Maximum number of team members to display */
  maxDisplay?: number;
  /** Additional CSS classes for the grid container */
  className?: string;
}

export function TeamGrid({
  members,
  columns = 3,
  maxDisplay,
  className = '',
}: TeamGridProps) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  const displayMembers = maxDisplay ? members.slice(0, maxDisplay) : members;

  return (
    <div className={`grid ${gridCols[columns]} gap-8 ${className}`}>
      {displayMembers.map((member, index) => (
        <TeamMemberCard key={index} {...member} />
      ))}
    </div>
  );
}

function TeamMemberCard({
  name,
  role,
  bio,
  image,
  tagline,
  organization = 'LodgeFlow Team',
}: TeamMemberProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('');

  // Always show truncated bio by default, use line-clamp for consistency
  const shouldTruncate = bio.length > 180;

  return (
    <Card className='py-4 h-full'>
      <CardBody className='overflow-visible p-4 flex flex-col gap-4'>
        {/* Image - Fixed height */}
        {image ? (
          <div className='w-full h-64 rounded-xl overflow-hidden flex-shrink-0'>
            <img
              alt={`${name} - ${role}`}
              className='w-full h-full object-cover'
              src={image}
            />
          </div>
        ) : (
          <div className='w-full h-64 bg-gradient-to-br from-green-200 to-blue-200 dark:from-green-700 dark:to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0'>
            <span className='text-green-700 dark:text-green-200 font-bold text-3xl'>
              {initials}
            </span>
          </div>
        )}

        {/* Name & Role - Fixed height section */}
        <div className='space-y-2 flex-shrink-0'>
          <Chip color='primary' size='sm' variant='flat'>
            {role}
          </Chip>
          <h4 className='font-bold text-large'>{name}</h4>
          <small className='text-default-500 block'>{organization}</small>
        </div>

        {/* Tagline - Fixed to 2 lines max */}
        {tagline && (
          <p className='text-sm text-default-500 italic border-l-2 border-primary pl-3 line-clamp-2 min-h-[2.5rem] flex-shrink-0'>
            "{tagline}"
          </p>
        )}

        {/* Bio with Read More - Fixed to 3 lines when collapsed */}
        <div className='flex-grow'>
          <p
            className={`text-sm text-default-600 leading-relaxed min-h-[4.5rem] ${
              !isExpanded && shouldTruncate ? 'line-clamp-3' : ''
            }`}
          >
            {bio}
          </p>
          {shouldTruncate && (
            <Button
              className='mt-2 -ml-1'
              color='primary'
              size='sm'
              variant='light'
              onPress={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Read Less' : 'Read More'}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
