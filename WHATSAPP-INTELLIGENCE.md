# WhatsApp Intelligence

Admin dashboard → WhatsApp Intelligence → Add / update WATI integration.

Add an account label, business WhatsApp number, WATI API base endpoint (including tenant ID for v1) and a `contacts:read` API token. Save, then Sync contacts. Repeat for each account. Updating the same endpoint and business number replaces credentials. Credentials are encrypted using AES-GCM on the server; rotating the Supabase service-role secret requires re-entering WATI tokens. No credentials are committed or returned by the list API.

The contacts API operates at WATI workspace level. If several business numbers share one workspace, these account labels do not establish which number acquired a contact. Separate account memberships and deduplicated overall phone counts are shown; campaign attribution is not inferred.

Sync runs page by page from the open dashboard. Errors preserve saved pages and a resume pointer. Last complete sync changes only when the final page succeeds. There is no unattended schedule in this release. A complete subsequent sync restarts at page one. Contacts are retained if absent from a later page; imports do not imply deletion in WATI.

Phone normalization links Indian +91/91/0091 and local ten-digit records. Only a unique registered-player match is used. Shared phone matches are marked Ambiguous. FTD means registered with total deposits > 0, consistently with Leads Intell. Player freshness is shown per row; Refresh matches reads the latest stored Admin Intelligence sync. Contacts without a usable phone are skipped and counted.

Contacts already registered or already in Leads Intell keep their existing lead record. New contacts enter Leads Intell once per phone; all WATI account memberships are kept in wati_contacts. Existing notes, responses and callbacks remain unchanged. Open lead filters Leads Intell by that phone. Agents retain existing Leads Intell access and phone masking; WATI credentials and the intelligence section are admin only.

Backend: wati-intelligence Edge Function, wati_connections, wati_credentials, wati_contacts, and a service-role-only atomic ingestion RPC. RLS protects all three tables; clients cannot read credentials or invoke ingestion. Fetch only accepts HTTPS wati.io endpoints and refuses redirects.

Validation: core identity/status tests; DOM tests for add/update, account/status filters, escaping, pagination, navigation and agent exclusion; transactional SQL tests for ingestion, duplicate preservation, page sequencing and access boundaries. Real WATI account sync requires credentials entered in the dashboard.
