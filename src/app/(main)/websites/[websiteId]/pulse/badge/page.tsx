import type { Metadata } from 'next';
import { PulseBadgePage } from '@/components/pulse/PulseBadgePage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseBadgePage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Badge & Webhooks',
};
