'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useDurationData } from '@/hooks/useData';

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

export default function DurationChart() {
  const { data, isLoading, error } = useDurationData();

  // Sort data by value in descending order for legend
  const sortedData = data ? [...data].sort((a, b) => b.value - a.value) : [];

  // Recharts custom tooltip
  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = sortedData.reduce((sum, item) => sum + item.value, 0);
      return (
        <div className='bg-content1 p-3 border border-divider rounded-lg shadow-lg'>
          <p className='font-medium'>{data.name}</p>
          <p className='text-sm text-default-600'>
            {data.value} bookings ({((data.value / total) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider h-auto md:h-96'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Stay Duration Distribution
        </h3>
        <div className='h-64 md:h-80 bg-default-100 rounded-lg animate-pulse'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider h-auto md:h-96'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Stay Duration Distribution
        </h3>
        <div className='bg-danger-50 border border-danger-200 p-4 rounded-lg'>
          <p className='text-danger-600'>Failed to load duration data</p>
        </div>
      </div>
    );
  }

  if (!data || !sortedData.length) return null;

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider h-auto md:h-96'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>
        Stay Duration Distribution
      </h3>

      {/* Mobile Layout - Stack vertically */}
      <div className='md:hidden'>
        <div className='h-64 mb-4'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={sortedData}
                cx='50%'
                cy='50%'
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey='value'
              >
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          {sortedData.map((entry, index) => (
            <div key={index} className='flex items-center gap-2'>
              <div
                className='w-3 h-3 rounded-full flex-shrink-0'
                style={{ backgroundColor: entry.color }}
              />
              <span className='text-xs font-medium truncate'>{entry.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Layout - Side by side */}
      <div className='hidden md:block h-80'>
        <div className='h-full flex'>
          <div className='flex-1'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={sortedData}
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey='value'
                >
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className='w-40 flex flex-col justify-center pl-4'>
            <div className='space-y-3'>
              {sortedData.map((entry, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <div
                    className='w-3 h-3 rounded-full'
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className='text-sm font-medium'>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
