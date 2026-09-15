import { ReservationDetail } from '@/components/ReservationDetail';
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ReservationDetail kind='dining' id={(await params).id} />;
}
