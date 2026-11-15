import type { Metadata } from 'next';
import { PulsePrivacyPage } from '@/components/pulse/PulsePrivacyPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulsePrivacyPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Privacy & Retention',
};
