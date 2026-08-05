import { Dining } from '@/types';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Input } from '@heroui/input';
import { useState } from 'react';

interface DiningTagsManagerProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
}

export default function DiningTagsManager({
  formData,
  onFormDataChange,
}: DiningTagsManagerProps) {
  const [currentTag, setCurrentTag] = useState('');

  const addTag = () => {
    if (currentTag.trim() && !formData.tags?.includes(currentTag.trim())) {
      onFormDataChange({
        ...formData,
        tags: [...(formData.tags || []), currentTag.trim()],
      });
      setCurrentTag('');
    }
  };

  const removeTag = (tag: string) => {
    onFormDataChange({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || [],
    });
  };

  return (
    <div>
      <label className='block text-sm font-medium mb-2'>Tags</label>
      <div className='flex gap-2 mb-2'>
        <Input
          placeholder='Add a tag'
          value={currentTag}
          onChange={e => setCurrentTag(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
          size='sm'
        />
        <Button size='sm' onPress={addTag} variant='bordered'>
          Add
        </Button>
      </div>
      <div className='flex gap-1 flex-wrap'>
        {formData.tags?.map(tag => (
          <Chip key={tag} onClose={() => removeTag(tag)} variant='flat'>
            {tag}
          </Chip>
        ))}
      </div>
    </div>
  );
}
