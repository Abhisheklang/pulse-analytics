import type { Metadata } from 'next';
import { PulseRevenuePage } from '@/components/pulse/PulseRevenuePage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseRevenuePage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Revenue',
};
