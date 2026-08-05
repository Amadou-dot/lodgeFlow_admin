'use client';

import BookingAnalyticsStats from '@/components/BookingAnalyticsStats';
import GuestDemographics from '@/components/GuestDemographics';
import PopularCabinsChart from '@/components/PopularCabinsChart';
import RevenueOverTimeChart from '@/components/RevenueOverTimeChart';
import StatusDistributionChart from '@/components/StatusDistributionChart';
import {
  useBookingAnalytics,
  type AnalyticsPeriod,
  type BookingAnalyticsData,
} from '@/hooks/useBookingAnalytics';
import { Button } from '@heroui/button';
import { Tab, Tabs } from '@heroui/tabs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function generateCSV(data: BookingAnalyticsData, period: AnalyticsPeriod) {
  const lines: string[] = [];

  // Summary
  lines.push('Section,Metric,Value');
  lines.push(`Summary,Total Revenue,$${data.summary.totalRevenue}`);
  lines.push(`Summary,Total Bookings,${data.summary.totalBookings}`);
  lines.push(`Summary,Avg Booking Value,$${data.summary.avgBookingValue}`);
  lines.push(`Summary,Cancellation Rate,${data.summary.cancellationRate}%`);
  lines.push('');

  // Revenue over time
  lines.push('Date,Revenue,Bookings');
  for (const row of data.revenueOverTime) {
    lines.push(`${row.date},${row.revenue},${row.bookings}`);
  }
  lines.push('');

  // Status distribution
  lines.push('Status,Count');
  for (const row of data.statusDistribution) {
    lines.push(`${row.status},${row.count}`);
  }
  lines.push('');

  // Popular cabins
  lines.push('Cabin,Booking Count,Revenue');
  for (const row of data.popularCabins) {
    lines.push(`${row.name},${row.bookingCount},${row.revenue}`);
  }
  lines.push('');

  // Demographics
  lines.push('Demographic,Value');
  lines.push(`Avg Party Size,${data.demographics.avgPartySize}`);
  lines.push(`Avg Stay Length,${data.demographics.avgStayLength}`);
  lines.push(`Breakfast Rate,${data.demographics.extras.breakfast.rate}%`);
  lines.push(`Pet Rate,${data.demographics.extras.pets.rate}%`);
  lines.push(`Parking Rate,${data.demographics.extras.parking.rate}%`);
  lines.push(
    `Early Check-in Rate,${data.demographics.extras.earlyCheckIn.rate}%`
  );
  lines.push(
    `Late Check-out Rate,${data.demographics.extras.lateCheckOut.rate}%`
  );

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.href = url;
  link.download = `booking-analytics-${period}-${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const PERIOD_OPTIONS: { key: AnalyticsPeriod; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All Time' },
];

export default function BookingAnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
  const { data, isLoading } = useBookingAnalytics(period);

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8'>
        <div>
          <div className='flex items-center gap-3 mb-1'>
            <button
              onClick={() => router.push('/bookings')}
              className='text-default-400 hover:text-default-600 transition-colors'
              aria-label='Back to bookings'
            >
              <svg
                width='20'
                height='20'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M19 12H5M12 19l-7-7 7-7' />
              </svg>
            </button>
            <h1 className='text-3xl font-bold'>Booking Analytics</h1>
          </div>
          <p className='text-default-600 mt-1 ml-8'>
            Insights into booking trends, revenue, and guest behavior
          </p>
        </div>
        <Button
          variant='bordered'
          isDisabled={isLoading || !data}
          onPress={() => data && generateCSV(data, period)}
          className='w-full sm:w-auto'
        >
          Export CSV
        </Button>
      </div>

      {/* Period Selector */}
      <div className='mb-6'>
        <Tabs
          selectedKey={period}
          onSelectionChange={key => setPeriod(key as AnalyticsPeriod)}
          variant='bordered'
          size='sm'
        >
          {PERIOD_OPTIONS.map(opt => (
            <Tab key={opt.key} title={opt.label} />
          ))}
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className='mb-6'>
        <BookingAnalyticsStats summary={data?.summary} isLoading={isLoading} />
      </div>

      {/* Revenue Chart */}
      <div className='mb-6'>
        <RevenueOverTimeChart
          data={data?.revenueOverTime}
          isLoading={isLoading}
        />
      </div>

      {/* Two-column: Status Distribution + Popular Cabins */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
        <StatusDistributionChart
          data={data?.statusDistribution}
          isLoading={isLoading}
        />
        <PopularCabinsChart data={data?.popularCabins} isLoading={isLoading} />
      </div>

      {/* Demographics */}
      <GuestDemographics
        demographics={data?.demographics}
        isLoading={isLoading}
      />
    </div>
  );
}
