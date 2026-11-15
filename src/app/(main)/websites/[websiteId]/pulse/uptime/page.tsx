import type { Metadata } from 'next';
import { PulseUptimePage } from '@/components/pulse/PulseUptimePage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseUptimePage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Uptime',
};
