import { Dining } from '@/types';
import { Input, Textarea } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';

interface DiningBasicInfoProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
  errors: Record<string, string>;
}

export default function DiningBasicInfo({
  formData,
  onFormDataChange,
  errors,
}: DiningBasicInfoProps) {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='Name'
          placeholder='Enter dining item name'
          value={formData.name || ''}
          onChange={e =>
            onFormDataChange({ ...formData, name: e.target.value })
          }
          isRequired
          errorMessage={errors.name}
          isInvalid={!!errors.name}
        />

        <Input
          label='Price'
          placeholder='0.00'
          type='number'
          step='0.01'
          min='0'
          startContent='$'
          value={formData.price?.toString() || ''}
          onChange={e =>
            onFormDataChange({
              ...formData,
              price: parseFloat(e.target.value) || 0,
            })
          }
          isRequired
          errorMessage={errors.price}
          isInvalid={!!errors.price}
        />
      </div>

      <Textarea
        label='Description'
        placeholder='Describe this dining item'
        value={formData.description || ''}
        onChange={e =>
          onFormDataChange({ ...formData, description: e.target.value })
        }
        isRequired
        errorMessage={errors.description}
        isInvalid={!!errors.description}
      />

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Select
          label='Type'
          placeholder='Select type'
          selectedKeys={formData.type ? [formData.type] : []}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            onFormDataChange({
              ...formData,
              type: selected as 'menu' | 'experience',
            });
          }}
          isRequired
        >
          <SelectItem key='menu'>Regular Menu</SelectItem>
          <SelectItem key='experience'>Dining Experience</SelectItem>
        </Select>

        <Select
          label='Meal Type'
          placeholder='Select meal type'
          selectedKeys={formData.mealType ? [formData.mealType] : []}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as
              | 'breakfast'
              | 'lunch'
              | 'dinner'
              | 'all-day';
            onFormDataChange({ ...formData, mealType: selected });
          }}
          isRequired
        >
          <SelectItem key='breakfast'>Breakfast</SelectItem>
          <SelectItem key='lunch'>Lunch</SelectItem>
          <SelectItem key='dinner'>Dinner</SelectItem>
          <SelectItem key='all-day'>All Day</SelectItem>
        </Select>
      </div>
    </div>
  );
}
