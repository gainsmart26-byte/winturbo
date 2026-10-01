import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const splitTeams = (name: string) => {
  const parts = name.split(/\s+v(?:s\.?)?\s+/i);
  return parts.length > 1 ? [parts[0].trim(), parts.slice(1).join(" v ").trim()] : [null, null];
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return response({ ok: false, error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return response({ ok: false, error: "Server configuration is incomplete" }, 500);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date();
  const force = new URL(request.url).searchParams.get("force") === "true" || request.headers.get("x-event-refresh") === "manual";
  if (!force) {
    const recent = await db.from("event_collection_runs").select("finished_at").eq("status", "completed")
      .gte("finished_at", new Date(now.getTime() - 10 * 60_000).toISOString()).limit(1);
    if (recent.data?.length) return response({ ok: true, skipped: true, reason: "Events refreshed less than 10 minutes ago" });
  }

  const run = await db.from("event_collection_runs").insert({ status: "running" }).select("id").single();
  const runId = run.data?.id;
  try {
    const source = await fetch("https://winturbo.com/api/sports", {
      headers: { accept: "application/json", "user-agent": "WinTurbo-Dashboard-Events/1.0" },
    });
    if (!source.ok) throw new Error(`WinTurbo sports feed returned HTTP ${source.status}`);
    const payload = await source.json();
    const sports = Array.isArray(payload?.sports) ? payload.sports : [];
    const rows: Record<string, unknown>[] = [];
    for (const sport of sports) for (const tournament of (Array.isArray(sport?.tournaments) ? sport.tournaments : [])) {
      for (const entry of (Array.isArray(tournament?.events) ? tournament.events : [])) {
        const event = entry?.event || entry;
        const externalId = text(event?.id || entry?.eventId || entry?._id);
        const eventName = text(event?.name || entry?.name);
        const startsAt = new Date(event?.openDate || entry?.marketTime || "");
        if (!externalId || !eventName || Number.isNaN(startsAt.getTime())) continue;
        const [home, away] = splitTeams(eventName);
        rows.push({
          external_event_id: externalId,
          sport_id: text(sport?.id) || null,
          sport_name: text(sport?.name) || text(entry?.eventTypeName) || "Other",
          tournament_id: text(tournament?.id) || text(entry?.competitionId) || null,
          tournament_name: text(tournament?.name) || text(entry?.competitionName) || null,
          event_name: eventName,
          home_name: home,
          away_name: away,
          starts_at: startsAt.toISOString(),
          market_count: Number(entry?.marketCount || 0),
          provider: text(entry?.provider) || null,
          source_url: "https://winturbo.com/",
          is_active: entry?.isActive !== false && startsAt.getTime() >= now.getTime() - 6 * 60 * 60_000,
          raw_data: { eventTypeId: entry?.eventTypeId || sport?.id, competitionId: entry?.competitionId || tournament?.id },
          last_seen_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      }
    }
    if (!rows.length) throw new Error("WinTurbo returned no valid events");
    const upsert = await db.from("winturbo_events").upsert(rows, { onConflict: "external_event_id" });
    if (upsert.error) throw upsert.error;
    await db.from("winturbo_events").update({ is_active: false, updated_at: now.toISOString() })
      .lt("last_seen_at", new Date(now.getTime() - 2 * 60 * 60_000).toISOString());
    if (runId) await db.from("event_collection_runs").update({
      status: "completed", finished_at: new Date().toISOString(), events_received: rows.length, events_upserted: rows.length,
    }).eq("id", runId);
    return response({ ok: true, events_received: rows.length, events_upserted: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await db.from("event_collection_runs").update({ status: "failed", finished_at: new Date().toISOString(), error_message: message }).eq("id", runId);
    return response({ ok: false, error: message }, 502);
  }
});
