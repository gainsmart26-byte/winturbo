-- Backend-only credentials. The gateway authorizes active administrators.
create table if not exists public.google_intell_connection (
 id integer primary key check(id=1), property_id text not null,
 ciphertext text not null, updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.google_intell_connection enable row level security;
revoke all on public.google_intell_connection from public, anon, authenticated;
grant select,insert,update,delete on public.google_intell_connection to service_role;
