'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface StatusItem {
  status: string;
  count: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3b82f6',
  'checked-in': '#10b981',
  'checked-out': '#6b7280',
  cancelled: '#ef4444',
  unconfirmed: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  'checked-in': 'Checked In',
  'checked-out': 'Checked Out',
  cancelled: 'Cancelled',
  unconfirmed: 'Unconfirmed',
};

interface Props {
  data?: StatusItem[];
  isLoading: boolean;
}

export default function StatusDistributionChart({ data, isLoading }: Props) {
  const chartData = (data || []).map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] || '#9ca3af',
  }));

  const sortedData = [...chartData].sort((a, b) => b.value - a.value);
  const total = sortedData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className='bg-content1 p-3 border border-divider rounded-lg shadow-lg'>
          <p className='font-medium'>{item.name}</p>
          <p className='text-sm text-default-600'>
            {item.value} bookings (
            {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Status Distribution
        </h3>
        <div className='h-64 bg-default-100 rounded-lg animate-pulse'></div>
      </div>
    );
  }

  if (!data || sortedData.length === 0) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Status Distribution
        </h3>
        <div className='h-64 flex items-center justify-center text-default-400'>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>Status Distribution</h3>

      {/* Mobile Layout */}
      <div className='md:hidden'>
        <div className='h-48 mb-4'>
          <ResponsiveContainer width='100%' height='100%'>
            <PieChart>
              <Pie
                data={sortedData}
                cx='50%'
                cy='50%'
                innerRadius={35}
                outerRadius={70}
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
              <span className='text-xs font-medium truncate'>
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className='hidden md:block'>
        <div className='h-64 flex'>
          <div className='flex-1'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={sortedData}
                  cx='50%'
                  cy='50%'
                  innerRadius={50}
                  outerRadius={90}
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
          <div className='w-44 flex flex-col justify-center pl-4'>
            <div className='space-y-3'>
              {sortedData.map((entry, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <div
                    className='w-3 h-3 rounded-full'
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className='text-sm font-medium'>
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
