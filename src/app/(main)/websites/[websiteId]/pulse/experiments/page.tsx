import type { Metadata } from 'next';
import { PulseExperimentsPage } from '@/components/pulse/PulseExperimentsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseExperimentsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'A/B Testing',
};
