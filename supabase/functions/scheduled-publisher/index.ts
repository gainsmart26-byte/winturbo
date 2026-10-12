import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const clean = (v: any) => String(v || "").replace(/^@/, "").toLowerCase();

const tokenFor = (username: any) => {
  const u = clean(username);
  if (u === "thegreatraka") return Deno.env.get("TELEGRAM_BOT_TOKEN_GREATRAKA");
  if (u === "jaaniplayer") return Deno.env.get("TELEGRAM_BOT_TOKEN_JAANIPLAYER");
  return Deno.env.get("TELEGRAM_BOT_TOKEN");
};

Deno.serve(async (req: Request) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);
    const cron = req.headers.get("x-winturbo-cron") === "scheduled-publisher-v3";
    const auth = req.headers.get("Authorization") || "";

    if (!cron && auth !== `Bearer ${key}`) {
      const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await client.auth.getUser();
      if (!user) return Response.json({ ok: false, error: "Authentication required" }, { status: 401 });
      const { data: grant } = await admin
        .from("user_access_grants")
        .select("access_level,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (grant?.access_level !== "admin") {
        return Response.json({ ok: false, error: "Admin required" }, { status: 403 });
      }
    }

    const bufferKey = Deno.env.get("BUFFER_API_KEY");
    if (bufferKey) {
      const {data: delegated} = await admin.from("publishing_queue").select("id,external_post_id").eq("platform","instagram").in("status",["publishing","scheduled"]).like("external_post_id","buffer:%").limit(25);
      for (const item of delegated || []) {
        try {
          const response = await fetch("https://api.buffer.com",{method:"POST",headers:{Authorization:`Bearer ${bufferKey}`,"Content-Type":"application/json"},body:JSON.stringify({query:"query Status($input: PostInput!) { post(input:$input) { id status sentAt } }",variables:{input:{id:item.external_post_id.slice(7)}}}),signal:AbortSignal.timeout(15000)});
          const result=await response.json(),post=result.data?.post;
          if(post?.status==="sent")await admin.from("publishing_queue").update({status:"published",published_at:post.sentAt||new Date().toISOString(),error_message:null}).eq("id",item.id);
          if(post?.status==="error")await admin.from("publishing_queue").update({status:"failed",error_message:"Buffer could not publish this Instagram post. Check the channel connection and media."}).eq("id",item.id);
        } catch { /* Leave pending delivery pending; never create a duplicate. */ }
      }
    }
    const { data: due, error } = await admin.rpc("claim_due_publishing_items", { p_limit: 25 });
    if (error) throw error;

    const results = [];
    for (const q of due || []) {
      if (q.platform === "instagram" && String(q.external_post_id||"").startsWith("buffer:")) {
        await admin.from("publishing_queue").update({status:"scheduled"}).eq("id",q.id);
        results.push({id:q.id,ok:true,delegated:true});
        continue;
      }
      if (q.platform !== "telegram") {
        await admin.from("publishing_queue").update({
          status: "failed",
          error_message: "Scheduled publishing for this platform is not configured",
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);
        results.push({ id: q.id, ok: false });
        continue;
      }

      const { data: account } = await admin
        .from("publishing_accounts")
        .select("*")
        .eq("id", q.publishing_account_id)
        .single();
      const token = tokenFor(account?.username);
      const chatId = account?.external_account_id || account?.username;

      if (!token || !chatId) {
        await admin.from("publishing_queue").update({
          status: "failed",
          error_message: "Telegram account configuration missing",
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);
        results.push({ id: q.id, ok: false });
        continue;
      }

      let method = "sendMessage";
      const payload: any = { chat_id: chatId, parse_mode: "HTML" };
      const mediaType = String(q.media_type || "").toLowerCase();

      if (q.media_url && ["photo", "image"].includes(mediaType)) {
        method = "sendPhoto";
        payload.photo = q.media_url;
        payload.caption = q.content_text || "";
      } else if (q.media_url && ["video", "reel"].includes(mediaType)) {
        method = "sendVideo";
        payload.video = q.media_url;
        payload.caption = q.content_text || "";
      } else {
        payload.text = q.content_text || "";
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const telegram = await response.json().catch(() => ({ ok: false }));

      if (!telegram?.ok) {
        await admin.from("publishing_queue").update({
          status: "failed",
          error_message: telegram?.description || `Telegram HTTP ${response.status}`,
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);
        results.push({ id: q.id, ok: false });
        continue;
      }

      const messageId = String(telegram.result?.message_id || "");
      const username = clean(account?.username);
      const publishedUrl = username && messageId ? `https://t.me/${username}/${messageId}` : null;
      await admin.from("publishing_queue").update({
        status: "published",
        published_at: new Date().toISOString(),
        external_post_id: messageId || null,
        published_url: publishedUrl,
        updated_at: new Date().toISOString(),
        error_message: null,
      }).eq("id", q.id);
      results.push({ id: q.id, ok: true, published_url: publishedUrl });
    }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
});
