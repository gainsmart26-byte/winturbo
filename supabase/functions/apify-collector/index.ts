import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const APIFY_BASE = "https://api.apify.com/v2/acts";
const INSTAGRAM_ACTOR = "apify~instagram-scraper";
const TELEGRAM_ACTOR = "maximedupre~telegram-channel-messages-scraper";
const CRON_HEADER = "posting-intelligence-daily-v1";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const handleFromUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.pathname.split("/").filter(Boolean).filter((part) => part !== "s")[0]?.replace(/^@/, "") || "";
  } catch {
    return value.replace(/^@/, "").trim();
  }
};
const normalizeHandle = (value: string) => value.replace(/^@/, "").trim().toLowerCase();
const iso = (value: unknown) => {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const reactionTotal = (value: unknown) => {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + (number(item?.count) || 0), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((sum: number, count) => sum + (number(count) || 0), 0);
  return number(value);
};
const postTypeLabel = (value: string) => {
  const type = value.toLowerCase();
  if (type.includes("reel")) return "Reel";
  if (type.includes("video")) return "Video Post";
  if (type.includes("carousel") || type.includes("sidecar")) return "Carousel Post";
  if (type.includes("image") || type.includes("photo")) return "Image Post";
  if (type === "text") return "Text Post";
  return "Media Post";
};
const creativeScore = (views: number | null, reactions: number | null, postText: string) => Math.min(100, Math.round((
  30
  + Math.min(45, Math.log(Math.max(0, views || 0) + 1) * 5)
  + (reactions == null ? 0 : Math.min(15, Math.log(Math.max(0, reactions) + 1) * 3))
  + (postText.length >= 40 ? 10 : postText.length ? 5 : 0)
) * 10) / 10);

async function runActor(token: string, actor: string, input: Record<string, unknown>) {
  const response = await fetch(`${APIFY_BASE}/${actor}/run-sync-get-dataset-items?timeout=240&clean=true&format=json`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error(payload?.error?.message || `${actor} failed with HTTP ${response.status}`);
  return Array.isArray(payload) ? payload : [];
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  if (request.headers.get("x-winturbo-cron") !== CRON_HEADER) return json({ ok: false, error: "Unauthorized" }, 401);

  const token = Deno.env.get("APIFY_API_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !supabaseUrl || !serviceKey) return json({
    ok: false,
    error: "Collector secrets are incomplete",
    missing: [!token && "APIFY_API_TOKEN", !supabaseUrl && "SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
  }, 500);

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const startedAt = new Date().toISOString();
  const run = await db.from("collection_runs").insert({ provider: "apify", status: "running", started_at: startedAt }).select("id").single();
  const runId = run.data?.id;
  const summary = { sources: 0, fetched: 0, inserted_or_updated: 0, skipped: 0, errors: [] as string[] };

  try {
    const sourcesResult = await db.from("monitored_sources").select("*").eq("is_active", true).in("platform", ["Telegram", "Instagram"]);
    if (sourcesResult.error) throw sourcesResult.error;
    const sources = sourcesResult.data || [];
    summary.sources = sources.length;

    const unique = new Map<string, any>();
    for (const source of sources) {
      const handle = source.handle || handleFromUrl(source.source_url);
      const key = `${String(source.platform).toLowerCase()}:${normalizeHandle(handle)}`;
      if (!unique.has(key)) unique.set(key, { ...source, handle });
    }
    const publicSources = [...unique.values()].filter((source) => {
      const isPrivateTelegram = source.platform === "Telegram" && /t\.me\/(\+|joinchat\/)/i.test(source.source_url);
      if (isPrivateTelegram) summary.skipped++;
      return !isPrivateTelegram;
    });

    const telegram = publicSources.filter((source) => source.platform === "Telegram");
    const instagram = publicSources.filter((source) => source.platform === "Instagram");
    const rows: Array<Record<string, unknown>> = [];

    if (telegram.length) {
      try {
        const items = await runActor(token, TELEGRAM_ACTOR, {
          targets: telegram.map((source) => source.source_url),
          maxMessages: 150,
          dateFrom: new Date(Date.now() - 8 * 86400000).toISOString(),
          sortOrder: "newest_first",
          mediaMode: "metadata",
        });
        summary.fetched += items.length;
        for (const item of items) {
          const handle = text(item.channelUsername) || handleFromUrl(text(item.channelUrl || item.inputTarget));
          const source = telegram.find((candidate) => normalizeHandle(candidate.handle) === normalizeHandle(handle));
          if (!source) { summary.skipped++; continue; }
          rows.push({ source, handle, item, platform: "Telegram" });
        }
      } catch (error) {
        summary.errors.push(`Telegram: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (instagram.length) {
      try {
        const items = await runActor(token, INSTAGRAM_ACTOR, {
          directUrls: instagram.map((source) => source.source_url.split("?")[0]),
          resultsType: "posts",
          resultsLimit: 100,
          onlyPostsNewerThan: "8 days",
          addParentData: true,
        });
        summary.fetched += items.length;
        for (const item of items) {
          const handle = text(item.ownerUsername || item.username || item.owner?.username);
          const source = instagram.find((candidate) => normalizeHandle(candidate.handle || handleFromUrl(candidate.source_url)) === normalizeHandle(handle));
          if (!source) { summary.skipped++; continue; }
          rows.push({ source, handle, item, platform: "Instagram" });
        }
      } catch (error) {
        summary.errors.push(`Instagram: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const row of rows) {
      const source: any = row.source;
      const item: any = row.item;
      const platform = String(row.platform);
      const handle = text(row.handle) || source.handle || handleFromUrl(source.source_url);
      let account = await db.from("accounts").select("id").eq("platform", platform).ilike("handle", handle).maybeSingle();
      if (!account.data) {
        account = await db.from("accounts").insert({
          platform,
          account_name: source.source_name || handle,
          handle,
          profile_url: source.source_url,
          account_type: "competitor",
          entity_category: source.entity_category || "company",
          first_seen_at: startedAt,
          last_seen_at: startedAt,
        }).select("id").single();
      } else {
        await db.from("accounts").update({ last_seen_at: startedAt, updated_at: startedAt }).eq("id", account.data.id);
      }
      if (account.error || !account.data?.id) {
        summary.errors.push(`${platform}/${handle}: account upsert failed`);
        continue;
      }

      const telegramRow = platform === "Telegram";
      const postId = telegramRow ? text(item.messageId || item.rawMessageId) : text(item.id || item.shortCode || item.code);
      const postUrl = telegramRow ? text(item.messageUrl || item.sourceUrl) : text(item.url || item.postUrl || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : ""));
      const postText = telegramRow ? text(item.text) : text(item.caption || item.text);
      const postedAt = iso(telegramRow ? item.date : (item.timestamp || item.takenAt || item.date));
      if (!postId || !postedAt) { summary.skipped++; continue; }
      const media = telegramRow ? item.media : null;
      const mediaType = telegramRow
        ? (Array.isArray(media) && media.length ? text(media[0]?.type) || "media" : "text")
        : text(item.type || item.productType || (item.videoUrl ? "video" : "image")).toLowerCase();
      const views = telegramRow ? number(item.views) : number(item.videoViewCount ?? item.videoPlayCount ?? item.playCount);
      const reactions = telegramRow ? reactionTotal(item.reactions) : (number(item.likesCount) || 0) + (number(item.commentsCount) || 0);
      const post = {
        account_id: account.data.id,
        platform_post_id: postId,
        post_url: postUrl || null,
        post_text: postText || null,
        posted_at: postedAt,
        media_type: mediaType || "text",
        theme: postTypeLabel(mediaType || "text"),
        media_url: telegramRow ? text(media?.[0]?.url) || null : text(item.displayUrl || item.imageUrl || item.videoUrl) || null,
        views,
        reactions_count: reactions,
        creative_score: creativeScore(views, reactions, postText),
        first_seen_at: startedAt,
        last_seen_at: startedAt,
      };
      const upsert = await db.from("posts").upsert(post, { onConflict: "account_id,platform_post_id" });
      if (upsert.error) summary.errors.push(`${platform}/${handle}/${postId}: ${upsert.error.message}`);
      else summary.inserted_or_updated++;
    }

    for (const source of sources) {
      const error = summary.errors.find((entry) => entry.startsWith(`${source.platform}:`));
      await db.from("monitored_sources").update({
        scrape_status: error ? "failed" : "active",
        last_scraped_at: startedAt,
        last_error: error || null,
        updated_at: startedAt,
      }).eq("id", source.id);
    }
    const status = summary.errors.length ? (summary.inserted_or_updated ? "partial" : "failed") : "completed";
    if (runId) await db.from("collection_runs").update({ status, finished_at: new Date().toISOString(), summary, error_message: summary.errors.join(" | ") || null }).eq("id", runId);
    return json({ ok: status !== "failed", status, ...summary }, status === "failed" ? 502 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await db.from("collection_runs").update({ status: "failed", finished_at: new Date().toISOString(), summary, error_message: message }).eq("id", runId);
    return json({ ok: false, error: message, ...summary }, 500);
  }
});
