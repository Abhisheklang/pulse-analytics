import type { Metadata } from 'next';
import { PulseInsightsPage } from '@/components/pulse/PulseInsightsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseInsightsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Insights',
};
