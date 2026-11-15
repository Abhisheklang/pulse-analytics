import type { Metadata } from 'next';
import { PulseExportsPage } from '@/components/pulse/PulseExportsPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseExportsPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Warehouse Export',
};
