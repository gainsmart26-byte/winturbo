[README.md](https://github.com/user-attachments/files/32142246/README.md)
# WinTurbo Creative Intelligence Dashboard

This is a live Supabase-connected dashboard prototype.

## What works
- Real Supabase email/password login
- Password reset flow
- Protected dashboard view
- Reads the existing `accounts` table after login
- Displays the six Telegram competitors already stored in Supabase
- Competitor leaderboard
- Audience-size chart
- Data quality / architecture status
- Logout and refresh

## Security
- Uses only the Supabase publishable browser key.
- No service-role key is included.
- Your existing Row Level Security policies remain the primary data-access control.

## How to run
Because the dashboard uses browser modules and Supabase Auth, serve the folder over HTTP rather than double-clicking the HTML file.

Examples:
- `python3 -m http.server 8080`
- Open `http://localhost:8080`

## Login account
Create a user in Supabase Authentication > Users, or use an existing Supabase Auth user.
The profile trigger already configured in the project should create a `profiles` row with role `viewer` for new users.

## Production deployment
Recommended URL: `dashboard.winturbo.com`
This prototype can be deployed to Vercel, Netlify, Cloudflare Pages, or migrated into Next.js for a production-grade app.

## First user setup
Open the dashboard, enter an email and password, and click **Create account**. If Supabase email confirmation is enabled, confirm the email first, then log in.

## Current Supabase project
Connected to `https://kxspsqtdvngiovjvskuq.supabase.co` (WINTURBO2).

## Growth Analytics
The dashboard now reads from `public.competitor_growth_analytics` and displays current audience, audience rank, 24-hour follower change/growth %, and 7-day follower change/growth %. Newly created tracking windows display `Collecting` until enough snapshot history exists.
