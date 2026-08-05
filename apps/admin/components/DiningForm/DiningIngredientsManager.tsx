import { Dining } from '@/types';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Input } from '@heroui/input';
import { useState } from 'react';

interface DiningIngredientsManagerProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
}

export default function DiningIngredientsManager({
  formData,
  onFormDataChange,
}: DiningIngredientsManagerProps) {
  const [currentIngredient, setCurrentIngredient] = useState('');

  const addIngredient = () => {
    if (
      currentIngredient.trim() &&
      !formData.ingredients?.includes(currentIngredient.trim())
    ) {
      onFormDataChange({
        ...formData,
        ingredients: [
          ...(formData.ingredients || []),
          currentIngredient.trim(),
        ],
      });
      setCurrentIngredient('');
    }
  };

  const removeIngredient = (ingredient: string) => {
    onFormDataChange({
      ...formData,
      ingredients: formData.ingredients?.filter(i => i !== ingredient) || [],
    });
  };

  return (
    <div>
      <label className='block text-sm font-medium mb-2'>Ingredients</label>
      <div className='flex gap-2 mb-2'>
        <Input
          placeholder='Add an ingredient'
          value={currentIngredient}
          onChange={e => setCurrentIngredient(e.target.value)}
          onKeyPress={e =>
            e.key === 'Enter' && (e.preventDefault(), addIngredient())
          }
          size='sm'
        />
        <Button size='sm' onPress={addIngredient} variant='bordered'>
          Add
        </Button>
      </div>
      <div className='flex gap-1 flex-wrap'>
        {formData.ingredients?.map(ingredient => (
          <Chip
            key={ingredient}
            onClose={() => removeIngredient(ingredient)}
            variant='flat'
          >
            {ingredient}
          </Chip>
        ))}
      </div>
    </div>
  );
}
