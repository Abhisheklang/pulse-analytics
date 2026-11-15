import type { Metadata } from 'next';
import { PulseRollupPage } from '@/components/pulse/PulseRollupPage';

export default function () {
  return <PulseRollupPage />;
}

export const metadata: Metadata = {
  title: 'Roll-up',
};
