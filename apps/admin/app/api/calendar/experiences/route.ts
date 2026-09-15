import { calendarResponse } from '@/lib/calendar-route';
export async function GET(request: Request) {
  return calendarResponse(request, 'experiences');
}
