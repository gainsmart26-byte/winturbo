# Turbo Man support v2

The public widget uses `turboman-support`, deployed in WINTURBO2. The standard OpenAI key stays in Edge Function Secrets. Voice uses a 60-second ephemeral credential, not the main key. The configured realtime model is `gpt-realtime-2.1` (override with `TURBOMAN_VOICE_MODEL`); text uses `TURBOMAN_SUPPORT_MODEL` or `gpt-6.1-terra` with low reasoning.

## Install on winturbo.com

The separate customer website source is not in this repository. Its homepage currently exposes WhatsApp and Intercom, but no Turbo Man script. Add the following once in the customer website shared layout, after the body has been created, for both homepage and logged-in views:

```html
<script defer src="https://winturbo.live/turboman-embed.js"></script>
```

The script guards against duplicate loading. It starts silently and opens only on a click. Microphone capture starts only when the user presses the microphone. Close, page hide, language change and sign-out end audio capture. Voice calls have a five-minute UI limit; it is not a provider-side billing cap. Configure provider project spend limits separately.

## Customer login integration — outstanding

The widget's `window.WinTurboSupport.setAccessToken(token)` accepts only a customer Supabase access token. The server verifies the token via `auth.getUser`, requires a confirmed Indian phone, matches the full normalized registered phone, and refuses ambiguous matches. Neither typed usernames nor customer-supplied phone numbers establish identity.

If the customer website uses a different authentication system, its backend must implement a verified identity exchange to a supported customer session. Its existing admin reporting key is not a customer login token. Do not expose it or pass it to the widget. No website login exchange is configured by this change.

Call `window.WinTurboSupport.clearIdentity()` on website logout or account change. This ends voice, clears visible private history and resets the support conversation. In-flight responses from the previous identity are discarded. Wire the verified customer token after sign-in and after token refresh; clear it when refresh fails. Do not place tokens in URLs or markup.

## OTP — outstanding

Supabase currently reports the phone auth provider as disabled. Configure an SMS provider and enable phone authentication in WINTURBO2. The widget checks actual provider status and does not promise an OTP when disabled. Then test delivery and verification with a controlled registered test account. OTPs go only to the verification form, never to the model.

## Account data

The support tool reads the verified customer's recorded deposits and withdrawals. It includes `synced_at` and explicitly cannot calculate a live wallet or withdrawable balance. A separately authenticated current-balance endpoint is still needed for those features. This assistant never initiates deposits/withdrawals or edits financial records.

## Knowledge and human support

Only active approved knowledge is used for public policies. Staff should add the current FAQ, complaint procedures and verified service policies in TurboMan Intelligence. Language options are language targets, not a claim that every language/dialect has passed spoken QA.

Human handover sets `chatbot_sessions.handoff_requested` and status `handoff`, visible in the existing TurboMan Intelligence panel. It does not send an external notification or promise immediate agent availability.

## Validation

Run `node tests/turboman-support.test.cjs` and `node --check turboman-embed.js`. Test native-script account questions, Hinglish followups, unconfirmed/expired identities, account switching, denial of another customer's identity, provider failure, microphone permission denial and interruption on actual customer devices. Production spoken QA and customer login/OTP tests remain required.

## WhatsApp support

TurboMan Intelligence and the VIP chat use WhatsApp +919205098663 for human support.

## VIP landing page

`turboman-vip.html` is the dedicated TURBO Support — VIP Members Only landing page. Root requests for winturbo.vip rewrite to it. The four cards open Turbo Man, WhatsApp +919205098663, Instagram @winturboplay and Telegram @winturbonow. The original WinTurbo logo is loaded from the customer website. Caption translations are selectable for 22 scheduled Indian languages plus English/Hinglish; regional wording still benefits from native-speaker QA.

Member login uses a server-side username lookup and sends SMS only to the phone already stored on that member record. An unrecognized or ambiguous member receives no OTP. Attempts and delivery requests are rate limited; challenges expire after ten minutes with five attempts. Supabase phone authentication/SMS delivery is currently disabled, so the login route fails clearly until configured. This uses synced member records; newly registered members must be present in that sync. No user-entered destination phone is accepted by username login.

winturbo.vip is assigned to the existing Vercel project. Its authoritative nameservers are ns01.domaincontrol.com and ns02.domaincontrol.com (external GoDaddy DNS), and its apex DNS now resolves to the connected Vercel project; HTTPS has been verified. No DNS account credentials are present in this repository.

## Intelligence dashboard rebuild

Dashboard → TurboMan Intelligence has Overview, Conversations, Knowledge and Settings. Reports aggregate all messages in an inclusive IST date range (maximum 367 days), excluding marked QA sessions by default. It shows customer turns, support answers, current handoff/open/staff-resolution state, verified member IDs, browser visit IDs, response latency, AI-classified topics/languages/gaps, errors, channels, daily/hourly activity, popular questions and retrieved knowledge. Retrieved entries are context supplied to AI, not proof they influenced its answer. Legacy unknown fields are not invented or backfilled. No sentiment or automatic resolution-success rate is claimed.

Conversations are searchable and paged 30 at a time. Full transcript browsing loads 100 older records per request; JSON export fetches every message in the selected conversation. Staff manually mark resolution/follow-up. Access remains restricted by admin RLS and RPC checks.

Knowledge entries support editing, draft/approval, enable/disable, keywords/aliases, sample questions, language and source. Only enabled approved entries reach the support model. The server ranks keyword/question/full-text matches, and AI can search with translated keywords for followups. Preview matching in Knowledge before publishing. Do not store customer-specific secrets, passwords or OTPs in shared knowledge.

All submitted text requests and AI support answers are persisted. Voice stores delivered user/assistant transcription events (not raw audio) with idempotent event IDs; backend voice tool questions have a separate record type and do not inflate customer-turn analytics. Browser/network failure can prevent a final voice event reaching the server; failed persistence ends voice with a visible warning. Existing voice conversations cannot be reconstructed retroactively. Website conversations outside this widget and external WhatsApp/social messages are not ingested by this feature.

Tests: `node tests/turboman-support.test.cjs`, `node tests/turboman-widget.test.cjs`, syntax checks for both JS files, and transactional `tests/turboman-analytics.sql` (run with a role able to create fixtures, always rolls back). Live admin browser UI is behind login, so signed-in visual QA remains outstanding.

## VIP phone entry filter

The VIP page requires an Indian phone number before loading its support content. The `vip-access` Edge Function normalizes 10-digit and +91 numbers and matches them against the synced `admin_players` registered records through the existing restricted RPC. A match opens the page; no match shows Register Now — GET VIP STATUS linking to winturbo.com. No OTP is sent for page entry. Lookup failures keep the gate closed and show a retry message. Checks are limited to 60 per IP per hour.

This is a page entry filter, not authentication: knowing a registered number permits page access. It creates no account session, exposes no member data and does not unlock personal account tools. Those retain their existing secure verification. The phone is not persisted in browser storage, so reopening/reloading requires another check. Newly registered users depend on admin record sync; unavailable or stale records do not grant access.
