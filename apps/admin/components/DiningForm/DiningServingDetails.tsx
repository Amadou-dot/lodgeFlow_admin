import { Dining } from '@/types';
import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';

interface DiningServingDetailsProps {
  formData: Partial<Dining>;
  onFormDataChange: (data: Partial<Dining>) => void;
  errors: Record<string, string>;
}

export default function DiningServingDetails({
  formData,
  onFormDataChange,
  errors,
}: DiningServingDetailsProps) {
  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Select
          label='Category'
          placeholder='Select category'
          selectedKeys={formData.category ? [formData.category] : []}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as
              | 'regular'
              | 'craft-beer'
              | 'wine'
              | 'spirits'
              | 'non-alcoholic';
            onFormDataChange({ ...formData, category: selected });
          }}
          isRequired
        >
          <SelectItem key='regular'>Regular Food</SelectItem>
          <SelectItem key='craft-beer'>Craft Beer</SelectItem>
          <SelectItem key='wine'>Wine</SelectItem>
          <SelectItem key='spirits'>Spirits</SelectItem>
          <SelectItem key='non-alcoholic'>Non-Alcoholic</SelectItem>
        </Select>

        <Input
          label='Sub Category'
          placeholder='e.g., IPA, Lager, etc.'
          value={formData.subCategory || ''}
          onChange={e =>
            onFormDataChange({ ...formData, subCategory: e.target.value })
          }
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='Serving Start Time'
          placeholder='09:00'
          type='time'
          value={formData.servingTime?.start || ''}
          onChange={e =>
            onFormDataChange({
              ...formData,
              servingTime: { ...formData.servingTime!, start: e.target.value },
            })
          }
          isRequired
          errorMessage={errors.servingTime}
          isInvalid={!!errors.servingTime}
        />

        <Input
          label='Serving End Time'
          placeholder='17:00'
          type='time'
          value={formData.servingTime?.end || ''}
          onChange={e =>
            onFormDataChange({
              ...formData,
              servingTime: { ...formData.servingTime!, end: e.target.value },
            })
          }
          isRequired
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='Min People'
          placeholder='1'
          type='number'
          min='1'
          value={formData.minPeople?.toString() || ''}
          onChange={e =>
            onFormDataChange({
              ...formData,
              minPeople: parseInt(e.target.value) || 1,
            })
          }
        />

        <Input
          label='Max People'
          placeholder='1'
          type='number'
          min='1'
          value={formData.maxPeople?.toString() || ''}
          onChange={e =>
            onFormDataChange({
              ...formData,
              maxPeople: parseInt(e.target.value) || 1,
            })
          }
          isRequired
          errorMessage={errors.maxPeople}
          isInvalid={!!errors.maxPeople}
        />
      </div>
    </div>
  );
}
