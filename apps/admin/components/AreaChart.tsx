'use client';

import {
  Area,
  CartesianGrid,
  AreaChart as RechartsAreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSalesData } from '@/hooks/useData';

interface TooltipPayloadItem {
  dataKey: string;
  color: string;
  value: number;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export default function AreaChart() {
  const { data, isLoading, error } = useSalesData();

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const salesData = payload.find(p => p.dataKey === 'sales');
      const bookingsData = payload.find(p => p.dataKey === 'bookings');

      return (
        <div className='bg-content1 p-3 border border-divider rounded-lg shadow-lg'>
          <p className='font-medium mb-2'>{label}</p>
          <div className='space-y-1'>
            {salesData && (
              <p className='text-sm'>
                <span style={{ color: salesData.color }}>● </span>
                Sales: ${salesData.value.toLocaleString()}
              </p>
            )}
            {bookingsData && (
              <p className='text-sm'>
                <span style={{ color: bookingsData.color }}>● </span>
                Bookings: {bookingsData.value}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatYAxisSales = (value: number) => {
    return `$${(value / 1000).toFixed(0)}k`;
  };

  const formatYAxisBookings = (value: number) => {
    return value.toString();
  };

  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Sales & Bookings Trend
        </h3>
        <div className='h-64 md:h-80 bg-default-100 rounded-lg animate-pulse'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Sales & Bookings Trend
        </h3>
        <div className='bg-danger-50 border border-danger-200 p-4 rounded-lg'>
          <p className='text-danger-600'>Failed to load sales data</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>
        Sales & Bookings Trend
      </h3>
      <p className='text-sm text-default-600 mb-4 md:hidden'>Last 30 Days</p>
      <div className='h-64 md:h-80'>
        <ResponsiveContainer width='100%' height='100%'>
          <RechartsAreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id='salesGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.8} />
                <stop offset='95%' stopColor='#3b82f6' stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id='bookingsGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#10b981' stopOpacity={0.8} />
                <stop offset='95%' stopColor='#10b981' stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='#e5e7eb'
              opacity={0.5}
            />
            <XAxis
              dataKey='date'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              interval='preserveStartEnd'
            />
            <YAxis
              yAxisId='sales'
              orientation='left'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={formatYAxisSales}
              width={40}
            />
            <YAxis
              yAxisId='bookings'
              orientation='right'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={formatYAxisBookings}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId='sales'
              type='monotone'
              dataKey='sales'
              stroke='#3b82f6'
              strokeWidth={2}
              fillOpacity={1}
              fill='url(#salesGradient)'
            />
            <Area
              yAxisId='bookings'
              type='monotone'
              dataKey='bookings'
              stroke='#10b981'
              strokeWidth={2}
              fillOpacity={1}
              fill='url(#bookingsGradient)'
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
      <div className='flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-4'>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-blue-500' />
          <span className='text-sm font-medium'>Sales ($)</span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-green-500' />
          <span className='text-sm font-medium'>Bookings (#)</span>
        </div>
      </div>
    </div>
  );
}
