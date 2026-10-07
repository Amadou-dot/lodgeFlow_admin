import type { BOOKING_STATUSES } from '@lodgeflow/database/config';
export type ReportBookingStatus = (typeof BOOKING_STATUSES)[number];
export type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y' | 'all';

export interface DashboardData {
  overview: {
    totalBookings: number;
    totalRevenue: number;
    totalCabins: number;
    totalCustomers: number;
    totalCancellations: number;
    occupancyRate: number;
    checkInsToday: number;
    checkOutsToday: number;
  };
  recentActivity: {
    id: string;
    customerName: string;
    cabinName: string;
    checkInDate: string;
    checkOutDate: string;
    totalPrice: number;
    status: ReportBookingStatus;
    createdAt: string;
  }[];
  charts: {
    occupancy: {
      date: string;
      occupancyRate: number;
      totalGuests: number;
      totalCapacity: number;
    }[];
    revenue: { week: string; revenue: number; bookings: number }[];
    durations: { name: string; value: number; color: string }[];
  };
}

export interface SalesData {
  date: string;
  fullDate: string;
  sales: number;
  bookings: number;
}

interface ExtrasStat {
  count: number;
  rate: number;
}

export interface BookingAnalyticsData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    avgBookingValue: number;
    cancellationRate: number;
  };
  revenueOverTime: {
    date: string;
    revenue: number;
    bookings: number;
  }[];
  statusDistribution: {
    status: ReportBookingStatus;
    count: number;
  }[];
  popularCabins: {
    name: string;
    bookingCount: number;
    revenue: number;
  }[];
  demographics: {
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
}
