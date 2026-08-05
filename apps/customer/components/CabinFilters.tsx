import { Card, CardBody } from '@heroui/card';
import { Select, SelectItem } from '@heroui/select';
import { Input } from '@heroui/input';
import { Button } from '@heroui/button';

interface CabinFiltersProps {
  onFiltersChange: (filters: {
    capacity?: number;
    minPrice?: number;
    maxPrice?: number;
  }) => void;
  isLoading?: boolean;
}

export default function CabinFilters({
  onFiltersChange,
  isLoading,
}: CabinFiltersProps) {
  const handleFilterChange = (filterType: string, value: string) => {
    const numValue = value ? parseInt(value) : undefined;

    // Get current URL params to maintain existing filters
    const urlParams = new URLSearchParams(window.location.search);

    if (value) {
      urlParams.set(filterType, value);
    } else {
      urlParams.delete(filterType);
    }

    // Update URL without reload
    const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);

    // Build filters object from all current params
    const filters = {
      capacity: urlParams.get('capacity')
        ? parseInt(urlParams.get('capacity')!)
        : undefined,
      minPrice: urlParams.get('minPrice')
        ? parseInt(urlParams.get('minPrice')!)
        : undefined,
      maxPrice: urlParams.get('maxPrice')
        ? parseInt(urlParams.get('maxPrice')!)
        : undefined,
    };

    onFiltersChange(filters);
  };

  const clearFilters = () => {
    window.history.replaceState({}, '', window.location.pathname);
    onFiltersChange({});
  };

  const capacityOptions = [
    { key: '', label: 'Any capacity' },
    { key: '1', label: '1+ guests' },
    { key: '2', label: '2+ guests' },
    { key: '4', label: '4+ guests' },
    { key: '6', label: '6+ guests' },
    { key: '8', label: '8+ guests' },
  ];

  const priceOptions = [
    { key: '', label: 'Any price' },
    { key: '50', label: '$50+' },
    { key: '100', label: '$100+' },
    { key: '150', label: '$150+' },
    { key: '200', label: '$200+' },
  ];

  const maxPriceOptions = [
    { key: '', label: 'No max' },
    { key: '100', label: 'Up to $100' },
    { key: '150', label: 'Up to $150' },
    { key: '200', label: 'Up to $200' },
    { key: '300', label: 'Up to $300' },
  ];

  return (
    <Card className='mb-6'>
      <CardBody>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4 items-end'>
          <Select
            isDisabled={isLoading}
            label='Capacity'
            placeholder='Select capacity'
            onChange={e => handleFilterChange('capacity', e.target.value)}
          >
            {capacityOptions.map(option => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>

          <Select
            isDisabled={isLoading}
            label='Min Price'
            placeholder='Minimum price'
            onChange={e => handleFilterChange('minPrice', e.target.value)}
          >
            {priceOptions.map(option => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>

          <Select
            isDisabled={isLoading}
            label='Max Price'
            placeholder='Maximum price'
            onChange={e => handleFilterChange('maxPrice', e.target.value)}
          >
            {maxPriceOptions.map(option => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>

          <Button
            color='default'
            isDisabled={isLoading}
            variant='flat'
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
