import type { Metadata } from 'next';
import { PulseAlertsPage } from '@/components/pulse/PulseAlertsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseAlertsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Alerts',
};
