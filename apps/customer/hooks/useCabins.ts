import { useQuery } from '@tanstack/react-query';
import type { Cabin, ApiResponse, CabinsQueryParams } from '@/types';

const fetchCabins = async (
  params: CabinsQueryParams = {}
): Promise<Cabin[]> => {
  const searchParams = new URLSearchParams();

  if (params.capacity)
    searchParams.append('capacity', params.capacity.toString());
  if (params.minPrice)
    searchParams.append('minPrice', params.minPrice.toString());
  if (params.maxPrice)
    searchParams.append('maxPrice', params.maxPrice.toString());
  if (params.available !== undefined)
    searchParams.append('available', params.available.toString());
  if (params.search) searchParams.append('search', params.search);

  const url = `/api/cabins${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch cabins');
  }

  const result: ApiResponse<Cabin[]> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch cabins');
  }

  return result.data || [];
};

export function useCabins(params: CabinsQueryParams = {}) {
  return useQuery({
    queryKey: ['cabins', params],
    queryFn: () => fetchCabins(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
