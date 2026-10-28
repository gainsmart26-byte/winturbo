# TrafficStars Intell

Active dashboard administrators can connect a TrafficStars API key and fetch performance reports from the sidebar's TrafficStars Intell section. This integration reads campaign data; it does not change bids, budgets, campaign states, or creatives.

## Connect

1. Sign in as an active dashboard admin.
2. Open TrafficStars Intell → Connect TrafficStars / update API key.
3. Enter an account label, confirm the account reporting currency, and enter the API key generated at https://admin.trafficstars.com/profile/.
4. Select dates and Fetch latest & analyse. Choose a campaign and breakdown for campaign, daily, creative, country, device, or placement analysis.

API keys are validated against TrafficStars, encrypted with AES-GCM server-side, and never returned by the API. Connection replacement clears report caches. Rotating the Supabase service secret requires reconnecting the TrafficStars key. Browser storage does not hold TrafficStars credentials or reports.

## Deployment

- Apply `supabase/trafficstars-intelligence.sql` to create backend-only storage with RLS and no anon/authenticated table grants.
- Deploy `supabase/functions/trafficstars-intelligence/index.ts` and its `core.js` dependency with JWT verification enabled. No additional provider secrets are required; the connection form supplies the key.
- Publish `dashboard.html`, `trafficstars-core.js`, `trafficstars-intell.js`, and `trafficstars-intell.css` together.
- No scheduled synchronization is configured. Fetch latest makes a live request; Load saved report returns the exact selection's last saved report (or fetches when none exists). The fetched timestamp is shown in IST.

## API contracts

Verified against https://docs.trafficstars.com/#/_auth, https://docs.trafficstars.com/#/_campaigns and https://docs.trafficstars.com/#/_reports on 28 October 2026.

- `POST /v1/auth/token` with `grant_type=refresh_token` and API key as `refresh_token`.
- `GET /v1.1/campaigns` for current campaign metadata.
- `POST /v2/campaigns/statistics` with `date_from`, `date_to`, `group_by`, optional `campaigns`, and `show_archived=false`.
- Reports accept up to 180 inclusive days. Date boundaries follow TrafficStars reporting semantics. No unsupported timezone parameter is sent.

Conversions are reported TrafficStars leads, not verified registrations or FTDs. Missing metrics and zero-denominator ratios display —. Aggregate ratios use summed denominators. Target CPA is a user assumption; recommendations require at least five reported conversions before comparing CPA. Spend without conversions calls for tracking checks first. No account-revenue / deposit matching is claimed.

## Validation

Run `node tests/trafficstars-core.test.cjs`, `node tests/trafficstars-gateway.test.cjs` and `node tests/trafficstars-dom.test.cjs`. Gateway tests use Node 24's built-in TypeScript stripping; DOM tests use jsdom. Set `NODE_PATH` to a jsdom installation when running the DOM test. Tests cover admin and inactive-user denial, encryption, redaction, official endpoint payloads, caching, failure retention, metric maths, CSV escaping, date validation, navigation, filters and sign-out cleanup.
