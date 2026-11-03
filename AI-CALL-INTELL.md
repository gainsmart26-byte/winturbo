# AI Call Intell — Bolna support integration

An admin-only dashboard tab connects existing Bolna agents to reviewed leads in `lead_intell_records`. It does not embed the Bolna dashboard: the application uses its API server-side, and provides a link to the Bolna dashboard for voice and phone configuration.

## Connection

1. Bolna Dashboard → Developers → API Keys. Create/copy the key privately.
2. WINTURBO2 Supabase → Edge Functions → Secrets: add `BOLNA_API_KEY`.
3. In AI Call Intell, check connection (`GET https://api.bolna.ai/user/me`).
4. Copy the existing agent UUID into a support case. In Bolna, include `{{case_instructions}}` and `{{preferred_language}}` in its prompt, then select appropriate voice/transcriber/language and telephony number. Verify agent in the tab. The integration checks both variables before launching so case instructions are not silently ignored. Per-call language context does not change an unsupported synthesizer voice into a supported one.
5. Save a case: callback due now, support assistance or manually reviewed support list. Set exact source/response filters, language, instructions, daily cap and calling hours (IST). Cases start paused.
6. Select 1–20 leads and record contact permission/callback reference. Preparing does not dial. Review each queued recipient, instruction snapshot and agent; explicitly place the call. Bolna wallet/telephony charges apply.

No API key is stored in public JS, browser storage or client database rows. The Edge Function validates the Supabase user and active administrator profile. New tables use administrator RLS; jobs are client read-only and service-created. The claim RPC is executable only by service_role and serializes launch claims with an advisory lock. `verify_jwt` is enabled.

## Calling controls

Server-side phone normalization and daily phone deduplication; no more than one prepared job per phone per IST day. A case has a 1–50 daily cap and 09:00–20:00 boundaries, with a separate dashboard-wide cap of 100 launches/day. Due callbacks require `Call Back` and a due callback timestamp. `Connected Not Interested`, `Do Not Call`, and `DND` responses are excluded; the separate Do Not Call list is checked at preparation and atomic launch. The exact source/response filters are rechecked when preparing. Current phone/preference is checked before launch.

The queue retains an instruction/language/agent snapshot. Case enablement, hours and caps are checked at launch. Jobs claim a durable dispatch state before POST `/call`. A timeout, missing execution ID or uncertain write becomes `unknown`, with no automatic retry. A process crash may leave `dispatching`; check Bolna history rather than resetting it or redialling. Cancelling only cancels a ready local job; it does not hang up an active provider call. No automatic dialling scheduler or background retries are installed.

Per-call variables contain case instructions, preferred language, case type and local call reference. The customer phone is sent as recipient_phone_number. Private account balances, transaction records, lead notes, passwords and OTPs are not sent. Actual agent behavior and all requested languages require controlled spoken testing in the customer Bolna account.

## Results and analytics

Use Sync latest Bolna results in Calls. This fetches up to 20 loaded execution IDs from `/executions/{id}`. Call-disconnected is transitional; final transcript, extracted data, summary (if enabled in Bolna), recording URL, cost and duration are saved only once a final status arrives. No unauthenticated webhook is installed. Sync continues to work without exposing credentials. It does not fetch calls that originated outside this tab.

Overview uses all records in the selected inclusive IST date range, not just the visible page. Status counts, provider-completed calls, no-answer/busy, uncertain/failed jobs, duration, raw provider-reported cost, and daily volume are reported. Cost is labelled Bolna units because the connected account's currency/unit has not been verified. A completed call is not labelled a resolved support issue. Transcripts/extracted fields are stored under admin-only RLS and do not overwrite lead response or callback fields automatically.

The current build has no supplied Bolna API key or agent ID and has not placed a real phone call. Connection, provider account/number readiness and signed-in browser QA remain to be completed after configuration. There is no claimed automatic campaign execution or webhook synchronization.

## Validation

`node --check ai-call-intell.js`
`node tests/ai-call-intell.test.cjs`

The mocked provider test covers admin/origin restrictions, contact-review requirement, exact recipient, launch state, repeat launch rejection and ambiguous provider failure without automatic redial. SQL runtime checks verify admin aggregation, unauthorized rejection and empty-state counts. No production recipients are used for testing.

Official API sources: https://www.bolna.ai/docs/quickstarts/api.md and https://www.bolna.ai/docs/prompting/using-context.md
