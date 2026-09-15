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

interface Props {
  data?: { date: string; revenue: number; bookings: number }[];
  isLoading: boolean;
}

export default function RevenueOverTimeChart({ data, isLoading }: Props) {
  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const revenueData = payload.find(p => p.dataKey === 'revenue');
      const bookingsData = payload.find(p => p.dataKey === 'bookings');

      return (
        <div className='bg-content1 p-3 border border-divider rounded-lg shadow-lg'>
          <p className='font-medium mb-2'>{label}</p>
          <div className='space-y-1'>
            {revenueData && (
              <p className='text-sm'>
                <span style={{ color: revenueData.color }}>● </span>
                Revenue: ${revenueData.value.toLocaleString()}
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

  const formatYAxisRevenue = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
    return `$${value}`;
  };

  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>Revenue Trend</h3>
        <div className='h-64 md:h-80 bg-default-100 rounded-lg animate-pulse'></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>Revenue Trend</h3>
        <div className='h-64 md:h-80 flex items-center justify-center text-default-400'>
          No data available for this period
        </div>
      </div>
    );
  }

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>Revenue Trend</h3>
      <div className='h-64 md:h-80'>
        <ResponsiveContainer width='100%' height='100%'>
          <RechartsAreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id='revenueGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.8} />
                <stop offset='95%' stopColor='#3b82f6' stopOpacity={0.1} />
              </linearGradient>
              <linearGradient
                id='analyticsBookingsGradient'
                x1='0'
                y1='0'
                x2='0'
                y2='1'
              >
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
              yAxisId='revenue'
              orientation='left'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              tickFormatter={formatYAxisRevenue}
              width={50}
            />
            <YAxis
              yAxisId='bookings'
              orientation='right'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#6b7280' }}
              width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId='revenue'
              type='monotone'
              dataKey='revenue'
              stroke='#3b82f6'
              strokeWidth={2}
              fillOpacity={1}
              fill='url(#revenueGradient)'
            />
            <Area
              yAxisId='bookings'
              type='monotone'
              dataKey='bookings'
              stroke='#10b981'
              strokeWidth={2}
              fillOpacity={1}
              fill='url(#analyticsBookingsGradient)'
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
      <div className='flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 mt-4'>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-blue-500' />
          <span className='text-sm font-medium'>Revenue ($)</span>
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 rounded-full bg-green-500' />
          <span className='text-sm font-medium'>Bookings (#)</span>
        </div>
      </div>
    </div>
  );
}
