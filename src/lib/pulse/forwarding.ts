import { uuid } from '@/lib/crypto';
import { pulseDb } from './stats';

const db = () => pulseDb();

export interface ForwardPayload {
  websiteId: string;
  eventType: number;
  eventName?: string;
  urlPath?: string;
  url?: string;
  referrer?: string;
  title?: string;
  hostname?: string;
  timestamp?: number;
}

/**
 * Best-effort webhook forwarding for accepted collection events.
 * Never throws and never blocks the ingestion response (short timeout).
 */
export async function forwardEvent(payload: ForwardPayload): Promise<void> {
  try {
    const config = await db().pulseWebhookConfig.findUnique({
      where: { websiteId: payload.websiteId },
    });

    if (!config || !config.enabled) return;

    const isPageview = payload.eventType === 1;
    if (config.events === 'pageview' && !isPageview) return;
    if (config.events === 'custom' && isPageview) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    let status: number | undefined;
    let ok = false;
    let error: string | undefined;

    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.secret ? { 'x-pulse-secret': config.secret } : {}),
        },
        body: JSON.stringify({ source: 'pulse-webhook', ...payload }),
        signal: controller.signal,
      });
      status = res.status;
      ok = res.ok;
    } catch (e: any) {
      error = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e);
    } finally {
      clearTimeout(timer);
    }

    await db().pulseWebhookDelivery.create({
      data: {
        id: uuid(),
        websiteId: payload.websiteId,
        eventType: payload.eventType,
        eventName: payload.eventName,
        urlPath: payload.urlPath,
        ok,
        status,
        error,
      },
    });
  } catch {
    // Forwarding must never break ingestion.
  }
}
