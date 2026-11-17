import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { timingSafeEqual } from 'node:crypto';

type Call = {
  id?: string;
  type?: string;
  callType?: string;
  direction?: string;
  status?: string;
  durationSec?: number;
  calleeNumber?: string;
  startedAt?: string;
  answeredBy?: string;
  endReason?: string;
  endedReason?: string;
};
type Settings = { message: string; template_id: string; enabled_at: string | null };
const requiredSecrets = [
  'RAVAN_API_KEY', 'SAMPARKHUB_API_KEY', 'SAMPARKHUB_SENDER_ID', 'SMS_INTELL_WORKER_KEY',
];
const activationTemplateId = '1677100000000398673';
const activationTemplate = 'Your {#var#} Has Been Activated On This Phone No {#var#} Registeration details{#var#} -ECOM';

function renderMessage(settings: Settings, phone: string) {
  if (settings.template_id !== activationTemplateId) {
    return settings.message.includes('{#var#}') ? null : settings.message;
  }
  if (settings.message !== activationTemplate) return null;
  const values = ['150% bonus activated', phone, 'www.winturbo.com'];
  let slot = 0;
  return settings.message.replaceAll('{#var#}', () => values[slot++]);
}

const usesUnicode = (message: string) => /[^\x00-\x7F]/.test(message);
const origin = 'https://winturbo.live';
const indianMobile = (phone: string) => phone.replace(/[\s()+.-]/g, '')
  .replace(/^(?:0091|91)(?=\d{10}$)/, '');

function eligible(call: Call, start: number, end: number) {
  const type = call.direction ?? call.callType ?? call.type;
  const time = Date.parse(call.startedAt ?? '');
  return /^(outbound|outbound_call)$/i.test(type ?? '') &&
    /^completed$/i.test(call.status ?? '') && (call.durationSec ?? 0) > 0 &&
    !/voicemail|machine|fax/i.test([call.answeredBy, call.endReason, call.endedReason].join(' ')) &&
    time >= start && time <= end && typeof call.id === 'string' &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(call.id) &&
    /^[6-9]\d{9}$/.test(indianMobile(call.calleeNumber ?? ''));
}

function matchesSecret(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const encoder = new TextEncoder();
  const left = encoder.encode(received);
  const right = encoder.encode(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function blocked(db: ReturnType<typeof createClient>, phone: string) {
  const variants = [phone, '+91' + phone, '91' + phone, '0091' + phone];
  const [contacts, leads] = await Promise.all([
    db.from('ai_call_contacts').select('phone').in('phone', variants).eq('do_not_call', true).limit(1),
    db.from('lead_intell_records').select('response').in('phone', variants),
  ]);
  if (contacts.error || leads.error) throw new Error('Could not verify contact preferences.');
  return contacts.data.length > 0 || leads.data.some(({ response }) =>
    /^(DND|Do Not Call|Connected Not Interested)$/i.test(response ?? ''));
}

async function poll(db: ReturnType<typeof createClient>, settings: Settings) {
  const ravanKey = Deno.env.get('RAVAN_API_KEY')?.trim();
  const smsKey = Deno.env.get('SAMPARKHUB_API_KEY')?.trim();
  const senderId = Deno.env.get('SAMPARKHUB_SENDER_ID')?.trim();
  if (!settings.enabled_at || !ravanKey || !smsKey || senderId?.length !== 6) return;
  const end = Date.now();
  const start = Math.max(Date.parse(settings.enabled_at), end - 60 * 60 * 1000);
  const pageSize = 20;
  const calls: Call[] = [];
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      page: String(page), page_size: String(pageSize), sort_order: 'asc',
      started_after: new Date(start - 1).toISOString(), started_before: new Date(end).toISOString(),
    });
    const response = await fetch('https://api.ravan.ai/api/v1/calling/call-sessions?' + query, {
      headers: { 'X-Api-Key': ravanKey }, redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Ravan history unavailable.');
    const result = await response.json();
    const sessions = result.data?.callSessions;
    if (!Array.isArray(sessions)) throw new Error('Unexpected Ravan response.');
    calls.push(...sessions.filter((call) => eligible(call, start, end)));
    if (sessions.length < pageSize) break;
    if (page >= 25) throw new Error('Ravan history exceeds the polling window capacity.');
  }
  if (!calls.length) return;
  const ids = [...new Set(calls.map((call) => call.id!))];
  const { data: previous, error } = await db.from('sms_intell_dispatches').select('call_id').in('call_id', ids);
  if (error) throw error;
  const seen = new Set(previous.map((row) => row.call_id));
  for (const call of calls) {
    if (seen.has(call.id!)) continue;
    const phone = indianMobile(call.calleeNumber!);
    const message = renderMessage(settings, phone);
    if (!message) continue;
    if (await blocked(db, phone)) continue;
    const { data: current, error: configError } = await db.from('sms_intell_settings')
      .select('enabled_at').eq('id', true).single();
    if (configError || current.enabled_at !== settings.enabled_at) return;
    const { error: claim } = await db.from('sms_intell_dispatches').insert({ call_id: call.id, phone });
    if (claim?.code === '23505') continue;
    if (claim) throw claim;
    seen.add(call.id!);
    const query = new URLSearchParams({
      apikey: smsKey, senderid: senderId, templateid: settings.template_id,
      number: phone, message, format: 'JSON',
    });
    if (usesUnicode(message)) query.set('unicode', '2');
    const response = await fetch('https://sms.samparkhub.com/V2/apikey.php?' + query, {
      redirect: 'error', signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!response) continue;
    const result = await response.json().catch(() => null);
    const rawCode = result?.code;
    const code = typeof rawCode === 'string' || typeof rawCode === 'number'
      ? String(rawCode).padStart(3, '0') : '';
    const providerCode = /^\d{3}$/.test(code) ? code : null;
    const rejected = (providerCode !== null && providerCode !== '011') ||
      result?.status === false || /^false$/i.test(String(result?.status ?? ''));
    const status = !response.ok || rejected ? 'http_error'
      : providerCode === '011' ? 'http_ok' : 'unconfirmed';
    const rawMessageId = result?.data?.messageid ?? result?.messageid;
    const messageId = typeof rawMessageId === 'string' || Number.isSafeInteger(rawMessageId)
      ? String(rawMessageId).trim() : '';
    const { error: updateError } = await db.from('sms_intell_dispatches').update({
      status, http_status: response.status, provider_code: providerCode,
      provider_message_id: status === 'http_ok' && messageId.length <= 200 ? messageId || null : null,
    }).eq('call_id', call.id);
    if (updateError) throw updateError;
  }
}

async function refreshDelivery(db: ReturnType<typeof createClient>) {
  const key = Deno.env.get('SAMPARKHUB_API_KEY')?.trim();
  if (!key) throw new Error('SMS API key is missing.');
  const { data, error } = await db.from('sms_intell_dispatches')
    .select('call_id,phone,provider_message_id')
    .eq('provider_code', '011')
    .not('provider_message_id', 'is', null)
    .or('delivery_status.is.null,delivery_status.eq.submitted,delivery_status.eq.pending,delivery_status.eq.queued')
    .order('delivery_checked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false }).limit(15);
  if (error) throw error;

  let updated = 0;
  let unavailable = 0;
  for (let offset = 0; offset < data.length; offset += 5) {
    await Promise.all(data.slice(offset, offset + 5).map(async (row) => {
      const checkedAt = new Date().toISOString();
      let fields: { delivery_checked_at: string; delivery_status?: string; delivery_time?: string | null } =
        { delivery_checked_at: checkedAt };
      try {
        const params = new URLSearchParams({ apikey: key, msgid: row.provider_message_id, format: 'json' });
        const response = await fetch('https://sms.samparkhub.com/V2/http-dlr.php?' + params, {
          redirect: 'error', signal: AbortSignal.timeout(3000),
        });
        const result = await response.json();
        if (!response.ok || String(result?.code).padStart(3, '0') !== '004' || !Array.isArray(result.data)) {
          throw new Error('Invalid delivery report.');
        }
        const match = result.data.find((item: { mobile?: unknown }) =>
          item && (typeof item.mobile === 'string' || typeof item.mobile === 'number') &&
          indianMobile(String(item.mobile)) === indianMobile(row.phone));
        const status = typeof match?.status === 'string' ? match.status.trim().toLowerCase() : '';
        if (status && status.length <= 80) {
          const time = typeof match.delvd_time === 'string' ? match.delvd_time.trim() : '';
          fields = { ...fields, delivery_status: status, delivery_time: /\d/.test(time) ? time.slice(0, 80) : null };
          updated++;
        } else unavailable++;
      } catch {
        unavailable++;
      }
      const { error: writeError } = await db.from('sms_intell_dispatches').update(fields)
        .eq('call_id', row.call_id)
        .or('delivery_checked_at.is.null,delivery_checked_at.lt.' + checkedAt);
      if (writeError) throw writeError;
    }));
  }
  return { checked: data.length, updated, unavailable };
}

Deno.serve(async (request) => {
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { headers, status });
  const worker = matchesSecret(request.headers.get('x-sms-worker-key'), Deno.env.get('SMS_INTELL_WORKER_KEY'));
  if (!worker && request.headers.get('Origin') !== origin) return reply({ error: 'Forbidden.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if (!worker) {
      const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) return reply({ error: 'Sign in required.' }, 401);
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) return reply({ error: 'Sign in required.' }, 401);
      const { data: profile, error } = await db.from('profiles')
        .select('role,is_active').eq('id', user.id).maybeSingle();
      if (error || profile?.role !== 'admin' || !profile.is_active) return reply({ error: 'Admin access required.' }, 403);
    }
    const { action, message, templateId } = await request.json();
    const configured = requiredSecrets.every((key) => Boolean(Deno.env.get(key)?.trim())) &&
      Deno.env.get('SAMPARKHUB_SENDER_ID')?.trim().length === 6;
    if (worker) {
      if (action !== 'poll') return reply({ error: 'Invalid worker action.' }, 400);
      const { data, error } = await db.from('sms_intell_settings').select('*').eq('id', true).maybeSingle();
      if (error) throw error;
      if (data) await poll(db, data);
      return reply({ ok: true });
    }
    const delivery = action === 'refresh-delivery' ? await refreshDelivery(db) : null;
    if (action === 'save') {
      if (typeof message !== 'string' || !message.trim() || message.length > (usesUnicode(message) ? 500 : 1000) ||
          typeof templateId !== 'string' || !/^\d{1,40}$/.test(templateId)) {
        return reply({ error: 'Enter a numeric template ID and a message up to 1,000 characters, or 500 for Unicode.' }, 400);
      }
      const { error } = await db.from('sms_intell_settings')
        .upsert({ id: true, message, template_id: templateId, enabled_at: null });
      if (error) throw error;
    } else if (action === 'enable' || action === 'pause') {
      if (action === 'enable' && !configured) return reply({ error: 'SMS server configuration is incomplete.' }, 409);
      let update = db.from('sms_intell_settings')
        .update({ enabled_at: action === 'enable' ? new Date().toISOString() : null }).eq('id', true);
      if (action === 'enable') {
        update = update.eq('message', message).eq('template_id', templateId).is('enabled_at', null);
      }
      const { data, error } = await update.select('id');
      if (error) throw error;
      if (!data.length) return reply({ error: 'Reload and review the saved draft first.' }, 409);
    } else if (action !== 'status' && action !== 'refresh-delivery') {
      return reply({ error: 'Invalid SMS action.' }, 400);
    }

    const [settings, log] = await Promise.all([
      db.from('sms_intell_settings').select('*').eq('id', true).maybeSingle(),
      db.from('sms_intell_dispatches').select('phone,status,http_status,provider_code,created_at,provider_message_id,delivery_status,delivery_time')
        .order('created_at', { ascending: false }).limit(50),
    ]);
    if (settings.error || log.error) throw new Error('Could not load SMS Intell.');
    return reply({ configured, delivery, settings: settings.data, log: log.data });
  } catch {
    // SMS provider URLs can contain credentials and message text.
    return reply({ error: 'Could not complete the SMS Intell request.' }, 502);
  }
});
