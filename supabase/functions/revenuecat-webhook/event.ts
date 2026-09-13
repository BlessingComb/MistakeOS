export type RevenueCatProEvent = {
  appUserId: string;
  eventId: string;
  eventAt: string;
  active: boolean;
  expiresAt: string | null;
};

type RevenueCatEvent = Record<string, unknown>;

const PRO_ENTITLEMENT = 'pro';
const INACTIVE_TYPES = new Set(['EXPIRATION', 'REFUND']);

/** Parses only entitlement events that can affect MistakeOS Pro. */
export function parseRevenueCatProEvent(value: unknown): RevenueCatProEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as RevenueCatEvent;
  const appUserId = typeof event.app_user_id === 'string' ? event.app_user_id : '';
  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  const eventTimestamp = typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : NaN;
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids.filter((id): id is string => typeof id === 'string')
    : [];
  if (!appUserId || !eventId || !Number.isFinite(eventTimestamp) || eventTimestamp <= 0 || !entitlementIds.includes(PRO_ENTITLEMENT)) {
    return null;
  }
  const expirationMs = typeof event.expiration_at_ms === 'number' && Number.isFinite(event.expiration_at_ms)
    ? event.expiration_at_ms
    : null;
  const type = typeof event.type === 'string' ? event.type : '';
  return {
    appUserId,
    eventId,
    eventAt: new Date(eventTimestamp).toISOString(),
    active: !INACTIVE_TYPES.has(type),
    expiresAt: expirationMs ? new Date(expirationMs).toISOString() : null,
  };
}
