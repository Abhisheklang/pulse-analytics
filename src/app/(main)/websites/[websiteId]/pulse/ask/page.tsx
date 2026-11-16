import type { Metadata } from 'next';
import { PulseAskPage } from '@/components/pulse/PulseAskPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseAskPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Ask Pulse',
};
