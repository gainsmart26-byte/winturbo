# Call Intell agent workspace

Open `/call-intell.html` on winturbo.io, or use Call Intell in the existing Leads agent navigation. www.winturbo.io redirects to the apex and preserves the path. Existing Supabase sessions and phone/password agent credentials are reused. No new user accounts or expanded non-agent grants are created. The gateway requires an active managed agent and active Leads Intell section grant, or an active admin profile.

The workspace loads every paginated registered player, saved lead and WATI contact through the existing authenticated gateway. Phone matching, ambiguous registration labels and shared notes retain the existing lead identity rules. Lists mask phones; opening one lead reveals its phone for calling and notes. Agent note saves retain current edit-token expiry and edit/login auditing. Admins can inspect and save notes with their own audit attribution.

Paid means positive recorded lifetime deposits, not pending deposits or a count of payment attempts. Registration/lead-added dates and first-paid dates are separate filter bases in IST. Missing first-paid dates are not inferred. Source tables use available saved source metadata and WATI account membership; membership can overlap and does not establish last-click attribution. Unknown sources are not invented. Data follows existing admin/WATI sync; Refresh reloads stored records and does not trigger a new provider sync.

Call opens a native `tel:` link. It does not automatically originate a server-side call, record audio, report call connection or change a customer account. Agents manually save outcomes and callback times in IST. Notes remain shared lead records with audit history.

Validation: `node --test tests/call-intell.test.cjs tests/leads-agent-gateway.test.cjs tests/agent-contact-gateway.test.cjs`; syntax checks for call-intell.js, call-intell-core.js and leads-intell.js. Authenticated browser tests with an actual managed agent remain required for full device-call QA.

## Integrated panel

Call Intell now mounts as a section within dashboard.html using the existing `sb` client and signed-in user. Its UI lives in a Shadow DOM to isolate table/filter styles and element IDs. It creates no Supabase client and contains no login form. Both navigation links open the section in-place. The old /call-intell.html address redirects to /dashboard.html#callIntell so visitors use only the normal agent login. Existing Leads Intell permissions cover the integrated section, while backend authorization stays unchanged.

Validation: `node tests/call-intell-integration.test.cjs` verifies use of the supplied authenticated client and record rendering with no secondary sign-in implementation.
