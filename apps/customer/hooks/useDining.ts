import {
  readCatalogResponse,
  diningListSchema,
} from '@/lib/validations/catalog-json';
import { useQuery } from '@tanstack/react-query';
import type { Dining, DiningQueryParams } from '@/types';

const fetchDining = async (
  params: DiningQueryParams = {}
): Promise<Dining[]> => {
  const searchParams = new URLSearchParams();

  if (params.type) searchParams.append('type', params.type);
  if (params.mealType) searchParams.append('mealType', params.mealType);
  if (params.category) searchParams.append('category', params.category);
  if (params.isPopular !== undefined)
    searchParams.append('isPopular', params.isPopular.toString());
  if (params.minPrice !== undefined)
    searchParams.append('minPrice', params.minPrice.toString());
  if (params.maxPrice !== undefined)
    searchParams.append('maxPrice', params.maxPrice.toString());
  if (params.dietary?.length)
    searchParams.append('dietary', params.dietary.join(','));
  if (params.search) searchParams.append('search', params.search);

  const url = `/api/dining${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url);

  return readCatalogResponse({
    response,
    schema: diningListSchema,
    fallback: 'Failed to fetch dining options',
  });
};

export function useDining(params: DiningQueryParams = {}) {
  return useQuery({
    queryKey: ['dining', params],
    queryFn: () => fetchDining(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
