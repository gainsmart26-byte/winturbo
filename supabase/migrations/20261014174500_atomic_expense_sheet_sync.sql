create or replace function public.replace_expense_sheet_rows(p_rows jsonb)
returns integer language plpgsql security definer set search_path=''
as $function$
declare inserted_count integer;
begin
  if current_user not in ('service_role','postgres','supabase_admin') then raise exception 'Service role required'; end if;
  perform pg_advisory_xact_lock(hashtext('winturbo_expense_sheet_sync'));
  delete from public.expenses where source_sheet='Expense Sheet';
  insert into public.expenses(source_key,expense_type,amount,category,purpose,source_sheet,source_row,synced_at,updated_at)
  select x.source_key,x.expense_type,x.amount,x.category,x.purpose,x.source_sheet,x.source_row,x.synced_at,x.updated_at
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    source_key text,expense_type text,amount numeric,category text,purpose text,
    source_sheet text,source_row integer,synced_at timestamptz,updated_at timestamptz
  );
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;$function$;
revoke all on function public.replace_expense_sheet_rows(jsonb) from public,anon,authenticated;
grant execute on function public.replace_expense_sheet_rows(jsonb) to service_role;
