-- Server-only read of session identity and login time for verified agent auditing.
grant select(id,user_id,created_at) on auth.sessions to service_role;
