import type { Metadata } from 'next';
import { PulseSettingsPage } from '@/components/pulse/PulseSettingsPage';

export default function () {
  return <PulseSettingsPage />;
}

export const metadata: Metadata = {
  title: 'Settings',
};
