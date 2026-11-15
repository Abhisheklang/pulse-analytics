import type { Metadata } from 'next';
import { PulseDashboardsPage } from '@/components/pulse/PulseDashboardsPage';

export default function () {
  return <PulseDashboardsPage />;
}

export const metadata: Metadata = {
  title: 'Custom Dashboards',
};
