import type { Metadata } from 'next';
import { PulseVitalsPage } from '@/components/pulse/PulseVitalsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseVitalsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Web Vitals',
};
