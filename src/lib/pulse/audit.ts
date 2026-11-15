import { uuid } from '@/lib/crypto';
import { pulseDb } from './stats';

// Pulse admin audit log: records sensitive operator actions (visitor data
// deletion, retention cleanups, CSV imports, warehouse export runs and data
// exports) so an admin can see who did what, where, and when.

export type AuditAction =
  | 'visitor_delete'
  | 'retention_cleanup'
  | 'csv_import'
  | 'warehouse_export'
  | 'data_export';

export async function logAudit(
  auth: any,
  action: AuditAction,
  websiteId: string | null,
  details?: Record<string, any>,
): Promise<void> {
  try {
    const user = auth?.user;
    await pulseDb().pulseAuditLog.create({
      data: {
        id: uuid(),
        userId: user?.id || null,
        username: user?.username || null,
        action,
        websiteId: websiteId || null,
        details: details || undefined,
      },
    });
  } catch {
    // Auditing must never break the action it records.
  }
}
