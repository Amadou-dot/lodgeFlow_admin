'use client';

interface ExtrasStat {
  count: number;
  rate: number;
}

interface Props {
  demographics?: {
    avgPartySize: number;
    avgStayLength: number;
    extras: {
      breakfast: ExtrasStat;
      pets: ExtrasStat;
      parking: ExtrasStat;
      earlyCheckIn: ExtrasStat;
      lateCheckOut: ExtrasStat;
    };
  };
  isLoading: boolean;
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex flex-col items-center p-3 rounded-lg bg-default-50 dark:bg-default-100/50'>
      <span className='text-xs text-default-500 uppercase tracking-wide mb-1'>
        {label}
      </span>
      <span className='text-lg font-bold'>{value}</span>
    </div>
  );
}

export default function GuestDemographics({ demographics, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
        <h3 className='text-lg md:text-xl font-bold mb-4'>
          Guest Demographics
        </h3>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className='h-16 bg-default-100 rounded-lg animate-pulse'
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (!demographics) return null;

  return (
    <div className='bg-content1 p-4 md:p-6 rounded-lg border border-divider'>
      <h3 className='text-lg md:text-xl font-bold mb-4'>Guest Demographics</h3>
      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
        <StatItem
          label='Avg Party Size'
          value={`${demographics.avgPartySize} guests`}
        />
        <StatItem
          label='Avg Stay Length'
          value={`${demographics.avgStayLength} nights`}
        />
        <StatItem
          label='Breakfast Adoption'
          value={`${demographics.extras.breakfast.rate}%`}
        />
        <StatItem
          label='Pet Bookings'
          value={`${demographics.extras.pets.rate}%`}
        />
        <StatItem
          label='Parking Add-on'
          value={`${demographics.extras.parking.rate}%`}
        />
        <StatItem
          label='Early/Late Check'
          value={`${Math.max(demographics.extras.earlyCheckIn.rate, demographics.extras.lateCheckOut.rate)}%`}
        />
      </div>
    </div>
  );
}
