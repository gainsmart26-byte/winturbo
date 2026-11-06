import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

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
    let path;
    if (action === 'connection') path = 'agents/';
    else if (action === 'history') path = 'calling/call-sessions';
    else if (action === 'detail' && typeof body.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(body.id)) {
      path = 'calling/call-sessions-detail/' + body.id;
    } else return reply({ error: 'Invalid request.' }, 400);

    const key = Deno.env.get('RAVAN_API_KEY')?.trim();
    if (!key) return reply({ error: 'RAVAN_API_KEY is missing in Supabase.' }, 503);
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
