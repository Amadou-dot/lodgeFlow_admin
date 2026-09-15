'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CabinItem {
  name: string;
  bookingCount: number;
  revenue: number;
}

interface TooltipPayloadItem {
  payload: CabinItem;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

interface Props {
  data?: CabinItem[];
  isLoading: boolean;
}

export default function PopularCabinsChart({ data, isLoading }: Props) {
  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className='bg-content1 p-3 border border-divider rounded-lg shadow-lg'>
          <p className='font-medium'>{item.name}</p>
          <p className='text-sm text-default-600'>
            {item.bookingCount} bookings
          </p>
          <p className='text-sm text-default-600'>
            ${item.revenue.toLocaleString()} revenue
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>Popular Cabins</h3>
        <div className='h-64 bg-default-100 rounded-lg animate-pulse'></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>Popular Cabins</h3>
        <div className='h-64 flex items-center justify-center text-default-400'>
          No data available
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(data.length * 40, 200);

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>Popular Cabins</h3>
      <div style={{ height: Math.min(chartHeight, 320) }}>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart
            data={data}
            layout='vertical'
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='#e5e7eb'
              opacity={0.5}
              horizontal={false}
            />
            <XAxis
              type='number'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
            />
            <YAxis
              type='category'
              dataKey='name'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey='bookingCount'
              fill='#8b5cf6'
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
