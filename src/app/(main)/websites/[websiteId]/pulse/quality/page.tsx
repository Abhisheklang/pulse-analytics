import type { Metadata } from 'next';
import { PulseQualityPage } from '@/components/pulse/PulseQualityPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseQualityPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Data Quality',
};
