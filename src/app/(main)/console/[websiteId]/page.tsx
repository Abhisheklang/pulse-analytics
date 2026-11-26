import type { Metadata } from 'next';
import { TestConsolePage } from './TestConsolePage';

async function getEnabled() {
  // UI-6 / FIN-5: this dev console posts randomised events, including
  // fake revenue, into a real website. It is a development surface:
  // it stays unreachable in production builds even if the env flag
  // is set by mistake.
  return process.env.NODE_ENV !== 'production' && !!process.env.ENABLE_TEST_CONSOLE;
}

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  const enabled = await getEnabled();

  if (!enabled) {
    return null;
  }

  return <TestConsolePage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Test Console',
};
