import type { Metadata } from 'next';
import { PulseAuditLogPage } from '@/components/pulse/PulseAuditLogPage';

export default function () {
  return <PulseAuditLogPage />;
}

export const metadata: Metadata = {
  title: 'Audit Log',
};
