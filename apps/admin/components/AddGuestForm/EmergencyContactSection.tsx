import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import type { FormData, GuestInputChange } from './types';
import { relationships } from './types';

interface EmergencyContactSectionProps {
  formData: FormData;
  onInputChange: GuestInputChange;
}

export default function EmergencyContactSection({
  formData,
  onInputChange,
}: EmergencyContactSectionProps) {
  return (
    <div className='space-y-4 w-full'>
      <h3 className='text-lg font-semibold'>Emergency Contact</h3>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='Contact First Name'
          placeholder='Enter contact first name'
          value={formData.emergencyContact.firstName}
          onValueChange={value =>
            onInputChange({
              section: 'emergencyContact',
              field: 'firstName',
              value: value,
            })
          }
        />
        <Input
          label='Contact Last Name'
          placeholder='Enter contact last name'
          value={formData.emergencyContact.lastName}
          onValueChange={value =>
            onInputChange({
              section: 'emergencyContact',
              field: 'lastName',
              value: value,
            })
          }
        />
        <Input
          label='Contact Phone'
          placeholder='Enter contact phone'
          value={formData.emergencyContact.phone}
          onValueChange={value =>
            onInputChange({
              section: 'emergencyContact',
              field: 'phone',
              value: value,
            })
          }
        />
        <Select
          label='Relationship'
          placeholder='Select relationship'
          selectedKeys={
            formData.emergencyContact.relationship
              ? [formData.emergencyContact.relationship]
              : []
          }
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            onInputChange({
              section: 'emergencyContact',
              field: 'relationship',
              value: selected || '',
            });
          }}
        >
          {relationships.map(relationship => (
            <SelectItem key={relationship}>{relationship}</SelectItem>
          ))}
        </Select>
      </div>
    </div>
  );
}
