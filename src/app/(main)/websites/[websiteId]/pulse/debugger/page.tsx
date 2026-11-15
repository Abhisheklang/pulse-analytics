import type { Metadata } from 'next';
import { PulseDebuggerPage } from '@/components/pulse/PulseDebuggerPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <PulseDebuggerPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Live Event Debugger',
};
