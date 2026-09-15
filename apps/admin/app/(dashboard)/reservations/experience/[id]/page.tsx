import { ReservationDetail } from '@/components/ReservationDetail';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ReservationDetail kind='experience' id={(await params).id} />;
}
