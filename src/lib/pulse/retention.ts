import { pulseDb } from './stats';

// Data-retention cleanup shared by the Privacy page action and the built-in
// scheduler. Deletes events (and their event data) older than the site's
// retention cutoff, then sessions left empty by that deletion.

// The cutoff before which data is deleted, or null when retention is
// disabled (retentionDays <= 0 means "keep everything").
export function retentionCutoff(retentionDays: number, nowMs: number): Date | null {
  if (!retentionDays || retentionDays <= 0) return null;
  return new Date(nowMs - retentionDays * 86400_000);
}

export interface RetentionResult {
  retentionDays: number;
  cutoff: string;
  eventsDeleted: number;
  eventDataDeleted: number;
  sessionsDeleted: number;
  skipped?: boolean;
}

export async function runRetentionCleanup(
  websiteId: string,
  nowMs = Date.now(),
): Promise<RetentionResult> {
  const db = pulseDb();
  const setting = await db.pulseSiteSetting.findUnique({ where: { websiteId } });
  const retentionDays = setting?.retentionDays || 0;

  const cutoff = retentionCutoff(retentionDays, nowMs);

  if (!cutoff) {
    return {
      retentionDays,
      cutoff: '',
      eventsDeleted: 0,
      eventDataDeleted: 0,
      sessionsDeleted: 0,
      skipped: true,
    };
  }

  // Delete dependent rows first, then events, then orphaned sessions.
  const oldEvents = await db.websiteEvent.findMany({
    where: { websiteId, createdAt: { lt: cutoff } },
    select: { id: true },
  });
  const oldEventIds = oldEvents.map((e: any) => e.id);

  let eventDataDeleted = 0;
  if (oldEventIds.length) {
    const res = await db.eventData.deleteMany({ where: { websiteEventId: { in: oldEventIds } } });
    eventDataDeleted = res.count;
  }

  const eventsDeleted = await db.websiteEvent.deleteMany({
    where: { websiteId, createdAt: { lt: cutoff } },
  });

  // Sessions created before the cutoff that no longer hold any events
  const orphanSessions = await db.session.findMany({
    where: { websiteId, createdAt: { lt: cutoff }, websiteEvents: { none: {} } },
    select: { id: true },
  });
  const orphanIds = orphanSessions.map((s: any) => s.id);

  let sessionsDeleted = 0;
  if (orphanIds.length) {
    await db.sessionData.deleteMany({ where: { sessionId: { in: orphanIds } } });
    const res = await db.session.deleteMany({ where: { id: { in: orphanIds } } });
    sessionsDeleted = res.count;
  }

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    eventsDeleted: eventsDeleted.count,
    eventDataDeleted,
    sessionsDeleted,
  };
}
