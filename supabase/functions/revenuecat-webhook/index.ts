import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAuthorizedRevenueCatRequest } from './auth.ts';
import { parseRevenueCatProEvent } from './event.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!isAuthorizedRevenueCatRequest(request, expected)) return json({ error: 'unauthorized' }, 401);
  let payload: { event?: Record<string, unknown> };
  try { payload = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const event = parseRevenueCatProEvent(payload.event);
  if (!event) return json({ ok: true, ignored: true });
  if (!uuid.test(event.appUserId)) return json({ error: 'invalid_app_user_id' }, 422);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.rpc('apply_revenuecat_entitlement_event', {
    p_user_id: event.appUserId,
    p_event_id: event.eventId,
    p_event_at: event.eventAt,
    p_active: event.active,
    p_expires_at: event.expiresAt,
  });
  if (error) return json({ error: 'persistence_failed' }, 500);
  return json({ ok: true, applied: Boolean(data) });
});

function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
