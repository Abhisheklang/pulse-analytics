import type { Metadata } from 'next';
import { PulseOnboardingPage } from '@/components/pulse/PulseOnboardingPage';

export default function () {
  return <PulseOnboardingPage />;
}

export const metadata: Metadata = {
  title: 'Getting started',
};
