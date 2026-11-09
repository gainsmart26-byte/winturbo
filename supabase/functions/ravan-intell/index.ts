import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

async function sendCallFollowUpSms(recipient: string, dispatchId: string) {
  if (Deno.env.get('RAVAN_FOLLOWUP_SMS_ENABLED')?.trim() !== 'true') return 'disabled';

  const apiKey = Deno.env.get('TWOFACTOR_SMS_API_KEY')?.trim();
  const sender = Deno.env.get('TWOFACTOR_SMS_SENDER_ID')?.trim();
  const message = Deno.env.get('RAVAN_FOLLOWUP_SMS_TEXT');
  const entityId = Deno.env.get('TWOFACTOR_SMS_DLT_ENTITY_ID')?.trim();
  const templateId = Deno.env.get('TWOFACTOR_SMS_DLT_TEMPLATE_ID')?.trim();
  if (!apiKey || !sender || !message?.trim() || Boolean(entityId) !== Boolean(templateId)) {
    console.error(JSON.stringify({ event: 'ravan_followup_sms_misconfigured', dispatch_id: dispatchId }));
    return 'not_configured';
  }

  const body = new URLSearchParams({
    module: 'TRANS_SMS',
    apikey: apiKey,
    to: recipient.slice(1),
    from: sender,
    msg: message,
  });
  if (entityId && templateId) {
    body.set('peid', entityId);
    body.set('ctid', templateId);
  }

  // A transport failure can happen after 2Factor receives the SMS. Avoid automatic retries.
  let status = 'unconfirmed';
  try {
    const response = await fetch('https://2factor.in/API/R1/', {
      method: 'POST',
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    if (response.ok && result?.Status === 'Success') status = 'submitted';
    else if (result?.Status === 'Error' && response.status < 500) status = 'rejected';
  } catch {
    // Report the outcome without exposing the recipient, message, or credentials in logs.
  }
  console.info(JSON.stringify({ event: 'ravan_followup_sms', dispatch_id: dispatchId, status }));
  return status;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin !== 'https://winturbo.live') return new Response(null, { status: 403 });
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  const reply = (body: unknown, status = 200) => Response.json(body, { headers, status });
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);

  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply({ error: 'Sign in required.' }, 401);
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return reply({ error: 'Sign in required.' }, 401);
    const { data: profile, error } = await db.from('profiles').select('role,is_active').eq('id', user.id).maybeSingle();
    if (error || profile?.role !== 'admin' || !profile.is_active) {
      return reply({ error: 'Active administrator access required.' }, 403);
    }

    const body = await request.json();
    const action = body?.action;
    const key = Deno.env.get('RAVAN_API_KEY')?.trim();
    if (!key) return reply({ error: 'RAVAN_API_KEY is missing in Supabase.' }, 503);
    if (action === 'dial') {
      const agent = Deno.env.get('RAVAN_AGENT_ID')?.trim();
      const caller = Deno.env.get('RAVAN_FROM_PHONE_NUMBER')?.trim();
      if (!agent || !caller || !/^\+[1-9]\d{7,14}$/.test(caller)) {
        return reply({ error: 'Set RAVAN_AGENT_ID and RAVAN_FROM_PHONE_NUMBER in Supabase before dialing.' }, 503);
      }
      const normalize = (value: unknown) => String(value ?? '').replace(/[\s()+.-]/g, '').replace(/^(?:0091|91)(?=\d{10}$)/, '');
      const phone = normalize(body.phone);
      const leadKey = body.leadKey;
      if (body.confirmed !== true || !/^[6-9]\d{9}$/.test(phone) ||
          typeof leadKey !== 'string' || !/^(?:user|phone):[a-zA-Z0-9_.@-]{1,100}$/.test(leadKey)) {
        return reply({ error: 'Review and confirm a valid Indian lead number.' }, 400);
      }

      const recipient = '+91' + phone;
      const variants = [phone, '91' + phone, recipient, '0091' + phone];
      const registered = typeof body.username === 'string' &&
        'user:' + body.username.toLowerCase() === leadKey
        ? await db.from('admin_players').select('phone').eq('username', body.username).maybeSingle()
        : { data: null, error: null };
      const [record, wati, blocked] = await Promise.all([
        db.from('lead_intell_records').select('phone,response').or(
          'lead_key.eq.' + leadKey + ',phone.in.(' + variants.join(',') + ')',
        ),
        db.from('wati_contacts').select('phone').in('phone', variants).limit(1),
        db.from('ai_call_contacts').select('phone').in('phone', variants).eq('do_not_call', true).limit(1),
      ]);
      if (registered.error || record.error || wati.error || blocked.error) {
        return reply({ error: 'Could not verify lead and do-not-call records.' }, 503);
      }
      if (blocked.data.length || record.data.some((row) =>
        /^(?:DND|Do Not Call|Connected Not Interested)$/i.test(row.response ?? '')
      )) return reply({ error: 'This lead is marked as do not call or not interested.' }, 403);
      const phones = [registered.data?.phone, ...record.data.map((row) => row.phone), ...wati.data.map((row) => row.phone)];
      if (!phones.some((value) => normalize(value) === phone)) {
        return reply({ error: 'This number could not be verified against Leads Intell.' }, 400);
      }

      const { data: dispatch, error: claimError } = await db.from('ravan_call_dispatches')
        .insert({ phone: recipient, lead_key: leadKey, requested_by: user.id }).select('id').single();
      if (claimError?.code === '23505') return reply({ error: 'A call was already attempted for this number today (IST).' }, 409);
      if (claimError || !dispatch) return reply({ error: 'Could not record this call attempt.' }, 503);
      try {
        const response = await fetch('https://api.ravan.ai/api/v1/calling/create-call', {
          method: 'POST',
          headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'outbound_call', agent_id: agent, from_phone_number: caller, to_phone_number: recipient,
            metadata: { winturbo_dispatch_id: dispatch.id, winturbo_lead_key: leadKey },
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error('Unconfirmed call');
      } catch {
        await db.from('ravan_call_dispatches').update({ status: 'unconfirmed' }).eq('id', dispatch.id);
        return reply({ error: 'Ravan did not confirm the call. Check Ravan call history before attempting it again.' }, 502);
      }
      await db.from('ravan_call_dispatches').update({ status: 'submitted' }).eq('id', dispatch.id);
      const smsStatus = await sendCallFollowUpSms(recipient, dispatch.id);
      return reply({ data: { submitted: true, sms_status: smsStatus } });
    }

    let path;
    if (action === 'connection') path = 'agents/';
    else if (action === 'history') path = 'calling/call-sessions';
    else if (action === 'detail' && typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id)) {
      path = 'calling/call-sessions-detail/' + body.id;
    } else return reply({ error: 'Invalid request.' }, 400);

    const response = await fetch('https://api.ravan.ai/api/v1/' + path, {
      headers: { 'X-Api-Key': key },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return reply({ error: 'Ravan returned HTTP ' + response.status + '.' }, 502);
    const result = await response.json();
    if (result.success === false) return reply({ error: 'Ravan rejected the request.' }, 502);
    if (action === 'connection') return reply({ connected: true });
    if (action === 'history' && !Array.isArray(result.data?.callSessions)) {
      return reply({ error: 'Ravan returned an unexpected call history format.' }, 502);
    }
    return reply({ data: result.data });
  } catch {
    return reply({ error: 'Could not complete the Ravan request.' }, 502);
  }
});
