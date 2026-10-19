Leads Intell is available to active dashboard administrators. It reads every page of the existing Admin Intelligence player cache and combines it with manual lead records. Registered users include FTDs, depositors and nondepositors; deposit freshness follows the existing Admin API sync.

Upload `.xlsx`, `.xls` or `.csv` files using Phone / Username headers, or use one phone or username per row without a header. Only the first worksheet is imported. Preview reports invalid and duplicate rows; confirmation imports valid leads without changing existing responses. The manual form accepts either identifier. Phone-only leads match registered users only when the normalized phone is unique; usernames match case-insensitively. Indian +91/0091 phone prefixes are normalized for matching.

Opening a lead allows the five requested responses and optional notes. Call Back requires a future date/time in IST; changing the response clears the scheduled callback. The dashboard banner shows today's callbacks and older pending callbacks. Reminders refresh every minute while the dashboard is visible. They are in-app reminders, not background push notifications.

The `lead_intell_records` table has active-admin RLS for reads, inserts and updates. Uploaded data is rendered as text. Spreadsheet parsing uses the locally hosted SheetJS CE 0.20.3 bundle; its Apache 2.0 license is in `vendor/SHEETJS-LICENSE`.

Validation:

```
node --test tests/leads-intell.test.cjs
NODE_PATH=<directory-containing-jsdom> node tests/leads-intell-dom.cjs
node tests/leads-intell-browser.cjs # optional, requires Playwright and installed Chromium
```

The DOM integration test covers 501 registered users, pagination, deposit filters, callback persistence and clearing, a real XLSX upload, duplicate protection and overdue reminders. Database authorization and callback constraints were also exercised with rolled-back test transactions.
