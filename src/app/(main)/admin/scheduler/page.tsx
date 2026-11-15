import type { Metadata } from 'next';
import { PulseSchedulerPage } from '@/components/pulse/PulseSchedulerPage';

export default function () {
  return <PulseSchedulerPage />;
}

export const metadata: Metadata = {
  title: 'Scheduler',
};
