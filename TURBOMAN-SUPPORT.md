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

Only active approved knowledge is used for public policies. There are currently three approved entries; staff should add the current FAQ, complaint procedures and verified service policies in TurboMan Intelligence. Language options are language targets, not a claim that every language/dialect has passed spoken QA.

Human handover sets `chatbot_sessions.handoff_requested` and status `handoff`, visible in the existing TurboMan Intelligence panel. It does not send an external notification or promise immediate agent availability.

## Validation

Run `node tests/turboman-support.test.cjs` and `node --check turboman-embed.js`. Test native-script account questions, Hinglish followups, unconfirmed/expired identities, account switching, denial of another customer's identity, provider failure, microphone permission denial and interruption on actual customer devices. Production spoken QA and customer login/OTP tests remain required.

## Human phone

The user designated +91 79717 01093 for human calls. Handover replies include a tel link to +917971701093. Tapping opens the customer device dialer. This does not originate a server-side phone call or provide a live call transfer; a telephony provider is required for that. Existing WhatsApp destinations are unchanged. All submitted Turbo Man text and voice requests receive automatic support answers or a clear failure message; this does not add bots to external messaging channels.

## VIP landing page

`turboman-vip.html` is the dedicated TURBO Support — VIP Members Only landing page. Root requests for winturbo.vip rewrite to it. The four cards open Turbo Man, WhatsApp +919997292089, Instagram @winturboplay and Telegram @winturbonow. The original WinTurbo logo is loaded from the customer website. Caption translations are selectable for 22 scheduled Indian languages plus English/Hinglish; regional wording still benefits from native-speaker QA.

Member login uses a server-side username lookup and sends SMS only to the phone already stored on that member record. An unrecognized or ambiguous member receives no OTP. Attempts and delivery requests are rate limited; challenges expire after ten minutes with five attempts. Supabase phone authentication/SMS delivery is currently disabled, so the login route fails clearly until configured. This uses synced member records; newly registered members must be present in that sync. No user-entered destination phone is accepted by username login.

winturbo.vip is assigned to the existing Vercel project. Its authoritative nameservers are ns01.domaincontrol.com and ns02.domaincontrol.com (external GoDaddy DNS), and its apex A records still point to parking IPs. Apply the project-specific recommended DNS records returned by Vercel; verify DNS and TLS afterward. No DNS account credentials are present in this repository.
