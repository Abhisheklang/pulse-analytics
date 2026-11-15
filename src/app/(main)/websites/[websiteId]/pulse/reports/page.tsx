import type { Metadata } from 'next';
import { PulseReportsPage } from '@/components/pulse/PulseReportsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseReportsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Reports',
};
