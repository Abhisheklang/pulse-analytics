import type { Metadata } from 'next';
import { PulseImportPage } from '@/components/pulse/PulseImportPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseImportPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'CSV Importer',
};
