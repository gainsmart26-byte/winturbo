import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "content-type": "application/json" },
});
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const APIFY_BASE = "https://api.apify.com/v2/acts";
const GOOGLE_ACTOR = "apify~google-search-scraper";
const INSTAGRAM_ACTOR = "apify~instagram-scraper";
const sourceConfig = {
  instagram: { site: "instagram.com", label: "Instagram" },
  youtube: { site: "youtube.com", label: "YouTube" },
  linkedin: { site: "linkedin.com/in", label: "LinkedIn" },
} as const;
type Source = keyof typeof sourceConfig;

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

function profileFromUrl(raw: string, source: Source) {
  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    if (source === "instagram") {
      const handle = (parts[0] || "").replace(/^@/, "");
      if (!handle || ["p", "reel", "reels", "explore", "stories", "accounts"].includes(handle.toLowerCase())) return null;
      return { handle, url: `https://www.instagram.com/${handle}/` };
    }
    if (source === "youtube") {
      if (!parts[0] || !(/^@/.test(parts[0]) || ["channel", "c", "user"].includes(parts[0]))) return null;
      const handle = parts[0].startsWith("@") ? parts[0].slice(1) : (parts[1] || parts[0]);
      return handle ? { handle, url: `https://www.youtube.com/${parts[0].startsWith("@") ? "@" + handle : parts[0] + "/" + handle}` } : null;
    }
    const marker = parts.indexOf("in");
    const handle = marker >= 0 ? parts[marker + 1] : "";
    return handle ? { handle, url: `https://www.linkedin.com/in/${handle}/` } : null;
  } catch {
    return null;
  }
}

function compactQuery(...values: string[]) {
  return values.join(" ").replace(/\s+/g, " ").trim().split(" ").slice(0, 26).join(" ");
}

function numericMetric(value: unknown) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0) return Math.round(direct);
  const match = clean(value).toLowerCase().match(/([\d,.]+)\s*([kmb])?/);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  const multiplier = match[2] === "k" ? 1e3 : match[2] === "m" ? 1e6 : match[2] === "b" ? 1e9 : 1;
  return Number.isFinite(base) ? Math.round(base * multiplier) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ ok: false, error: "POST required" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const apify = Deno.env.get("APIFY_API_TOKEN") || "";
    if (!apify || !url || !anon) throw new Error("Influencer search secrets are incomplete");
    const auth = request.headers.get("Authorization") || "";
    const client = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ ok: false, error: "Authentication required" }, 401);

    const body = await request.json().catch(() => ({}));
    const keyword = clean(body.keyword, 100);
    const topic = clean(body.topic, 100);
    const lifestyle = clean(body.lifestyle, 100);
    const location = clean(body.location, 100);
    const similarAccount = clean(body.similar_account, 160);
    const requested = Array.isArray(body.sources) ? body.sources : [];
    const sources = requested.map((item: unknown) => clean(item, 20).toLowerCase()).filter((item: string): item is Source => item in sourceConfig);
    const limit = Math.max(5, Math.min(50, Number(body.max_results) || 20));
    const minFollowers = Math.max(0, Number(body.min_followers) || 0);
    if (!sources.length) return json({ ok: false, error: "Select at least one source" }, 400);
    if (![keyword, topic, lifestyle, similarAccount].some(Boolean)) return json({ ok: false, error: "Add a keyword, topic, lifestyle or similar account" }, 400);

    try {
      const intent = compactQuery(keyword, topic, lifestyle, location, similarAccount ? `similar to ${similarAccount}` : "", "influencer creator");
      const queries = sources.map((source) => `${intent} site:${sourceConfig[source].site}`);
      const pages = Math.max(1, Math.min(3, Math.ceil(limit / (sources.length * 10))));
      const serpPages = await runActor(apify, GOOGLE_ACTOR, {
        queries: queries.join("\n"), maxPagesPerQuery: pages, resultsPerPage: 10,
        countryCode: String(body.country_code || "in").toLowerCase(), languageCode: "en", mobileResults: false,
      });
      const candidates = new Map<string, Record<string, unknown>>();
      for (const page of serpPages) {
        for (const result of (page.organicResults || page.organic_results || [])) {
          const rawUrl = clean(result.url || result.link, 500);
          const source = sources.find((item) => rawUrl.toLowerCase().includes(sourceConfig[item].site));
          if (!source) continue;
          const profile = profileFromUrl(rawUrl, source);
          if (!profile) continue;
          const key = `${source}:${profile.handle.toLowerCase()}`;
          if (candidates.has(key)) continue;
          const title = clean(result.title, 180).replace(/\s*[|·-]\s*(Instagram|YouTube|LinkedIn).*$/i, "");
          const bio = clean(result.description || result.snippet, 600);
          const haystack = `${title} ${profile.handle} ${bio}`.toLowerCase();
          const terms = [keyword, topic, lifestyle, location].filter(Boolean);
          const reasons = terms.filter((term) => haystack.includes(term.toLowerCase())).map((term) => `Matches ${term}`);
          if (similarAccount) reasons.push(`Similar-account discovery: ${similarAccount}`);
          const followers = numericMetric(bio.match(/([\d,.]+\s*[kmb]?)\s+(followers|subscribers)/i)?.[1]);
          candidates.set(key, {
            id: crypto.randomUUID(), platform: sourceConfig[source].label,
            name: title || profile.handle, handle: profile.handle, profile_url: profile.url,
            bio: bio || null, followers, location: location || null,
            relevance_score: Math.min(99, 55 + reasons.length * 10 + (followers ? 5 : 0)),
            match_reasons: reasons.length ? reasons : ["Source and search-intent match"],
            metadata: { search_title: title, search_position: result.position ?? null },
          });
        }
      }

      const instagram = [...candidates.values()].filter((item) => item.platform === "Instagram").slice(0, 25);
      if (instagram.length) {
        try {
          const details = await runActor(apify, INSTAGRAM_ACTOR, { directUrls: instagram.map((item) => item.profile_url), resultsType: "details", resultsLimit: 1 });
          for (const detail of details) {
            const handle = clean(detail.username || detail.ownerUsername).toLowerCase();
            const target = candidates.get(`instagram:${handle}`);
            if (!target) continue;
            target.name = clean(detail.fullName || detail.full_name || target.name, 180);
            target.bio = clean(detail.biography || detail.bio || target.bio, 600) || null;
            target.avatar_url = clean(detail.profilePicUrl || detail.profile_pic_url || detail.profilePicUrlHD, 600) || null;
            target.followers = numericMetric(detail.followersCount ?? detail.followers ?? target.followers);
            target.email = clean(detail.businessEmail || detail.publicEmail || detail.email, 180) || null;
            target.metadata = { ...(target.metadata as object), verified: Boolean(detail.verified || detail.isVerified), posts_count: numericMetric(detail.postsCount) };
          }
        } catch (error) {
          console.warn("Instagram enrichment skipped", error instanceof Error ? error.message : String(error));
        }
      }

      const rows = [...candidates.values()].filter((item) => !minFollowers || item.followers == null || Number(item.followers) >= minFollowers).sort((a, b) => Number(b.relevance_score) - Number(a.relevance_score)).slice(0, limit);
      return json({ ok: true, results: rows, message: rows.length ? undefined : "No public influencer profiles matched these filters" });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
