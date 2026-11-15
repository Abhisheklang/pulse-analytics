import { pulseDb } from '@/lib/pulse/stats';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canViewWebsite } from '@/permissions';

// Privacy audit: what Pulse stores about a visitor, derived from the actual
// session/event schema. The session table has no IP address column and the
// tracking script sets no cookies.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, error } = await parseRequest(request);
  if (error) return error();

  const { websiteId } = await params;
  if (!(await canViewWebsite(auth, websiteId))) return unauthorized();

  const setting = await pulseDb().pulseSiteSetting.findUnique({ where: { websiteId } });

  return json({
    storedPerVisitor: [
      { field: 'browser', source: 'session', note: 'Browser name parsed from the user agent' },
      { field: 'os', source: 'session', note: 'Operating system parsed from the user agent' },
      { field: 'device', source: 'session', note: 'Device type (desktop / mobile / tablet)' },
      { field: 'screen', source: 'session', note: 'Screen resolution' },
      { field: 'language', source: 'session', note: 'Browser language' },
      { field: 'country / region / city', source: 'session', note: 'Approximate location from IP geolocation at collection time' },
      { field: 'distinctId', source: 'session', note: 'Only when your site sends one explicitly' },
      { field: 'pageviews & events', source: 'website_event', note: 'URL path, referrer domain, page title, timestamps, UTM parameters' },
      { field: 'event data', source: 'event_data', note: 'Custom key/value pairs your site chooses to send with an event' },
    ],
    rawIpStored: false,
    rawIpNote:
      'The session and event tables contain no IP address column. IPs are used transiently at collection time (geolocation and the daily-rotating visitor hash) and are not persisted.',
    cookiesUsed: false,
    cookiesNote:
      'The tracking script sets no cookies. Visitors are recognised within a day by a salted hash that rotates daily, so the same person cannot be followed across days.',
    retentionDays: setting?.retentionDays ?? 0,
    retentionNote:
      (setting?.retentionDays ?? 0) > 0
        ? `Events and sessions older than ${setting!.retentionDays} days are removed when cleanup runs.`
        : 'Retention is disabled (data is kept indefinitely) until you set a retention period.',
  });
}
