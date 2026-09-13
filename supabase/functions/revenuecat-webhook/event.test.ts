import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRevenueCatProEvent } from './event';

const baseEvent = {
  app_user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  id: 'event-123',
  event_timestamp_ms: 1_800_000_000_000,
  entitlement_ids: ['pro'],
  expiration_at_ms: 1_800_086_400_000,
  type: 'RENEWAL',
};

test('accepts a Pro entitlement event and preserves its ordering timestamp', () => {
  const event = parseRevenueCatProEvent(baseEvent);
  assert.equal(event?.active, true);
  assert.equal(event?.eventId, 'event-123');
  assert.match(event?.eventAt ?? '', /^2027-/);
});

test('marks expiration and refund events as inactive', () => {
  assert.equal(parseRevenueCatProEvent({ ...baseEvent, type: 'EXPIRATION' })?.active, false);
  assert.equal(parseRevenueCatProEvent({ ...baseEvent, type: 'REFUND' })?.active, false);
});

test('ignores events for a different entitlement or without a stable event id', () => {
  assert.equal(parseRevenueCatProEvent({ ...baseEvent, entitlement_ids: ['other'] }), null);
  assert.equal(parseRevenueCatProEvent({ ...baseEvent, id: '' }), null);
});
