-- Handoff 61-S1, the Account drawer (Settings, first PR): Sign-in and security's Signed-in devices
-- (extraction 60-SETTINGS 3.2, S10 to S19; 12C privacy rule 1).
--
-- Two functions and no table, so no admin_catalogue row (1299) and nothing for DIA (1300).
--
--   public.sessions_list()                 the caller's own auth.sessions rows: id, user agent, last
--                                          activity and whether the row is the session making the
--                                          call. Never an IP address, a location or a factor.
--   public.session_revoke(p_session_id)    deletes one of the caller's own rows, never the current one
--                                          and never another member's. auth.refresh_tokens.session_id
--                                          and auth.mfa_amr_claims.session_id both reference
--                                          auth.sessions on delete cascade (read on the canonical
--                                          project, 13 October 2026), so the row's refresh tokens go
--                                          with it and the device cannot mint a new access token.
--
-- Both are security definer on auth.uid() and neither takes the member as a parameter. The current
-- session is the `session_id` claim Supabase Auth writes into every access token, read through
-- auth.jwt(); a call whose token carries no such claim cannot tell which row is its own, so
-- session_revoke refuses rather than guess. auth.sessions.refreshed_at is timestamp without time
-- zone, written in UTC by Supabase Auth, so it is read at time zone 'UTC' beside updated_at.
--
-- Grants: authenticated only; revoked from public and anon. service_role is deliberately absent:
-- nothing server-side lists or revokes a member's devices on their behalf.
--
-- This file holds a `delete`, so it reaches the canonical project by the founder's SQL Editor paste
-- of a file Chat generates from these committed bytes (1528), never through execute_sql, and the
-- paste records its own supabase_migrations.schema_migrations row in the same transaction (225).

create function public.sessions_list()
returns table (
  id uuid,
  user_agent text,
  last_active_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    s.id,
    s.user_agent,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) as last_active_at,
    s.id::text = (auth.jwt() ->> 'session_id') as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
    and auth.uid() is not null
    and (s.not_after is null or s.not_after > now())
  order by (s.id::text = (auth.jwt() ->> 'session_id')) desc,
           coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at) desc,
           s.id;
$$;

revoke all on function public.sessions_list() from public, anon;
grant execute on function public.sessions_list() to authenticated;

comment on function public.sessions_list() is
  'Handoff 61-S1 (extraction 60-SETTINGS S10 to S19): the caller''s own signed-in devices as id, user agent, last activity (refreshed_at, else updated_at) and whether the row is the current session, by the access token''s session_id claim. Never an IP address, a location or a factor (12C privacy rule 1). Expired rows (not_after passed) are left out.';

create function public.session_revoke(p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current text := auth.jwt() ->> 'session_id';
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_session_id is null then
    raise exception 'bad_session' using errcode = '22023';
  end if;
  if v_current is null then
    -- A token with no session_id claim cannot name its own row, so nothing is revoked (S13 reads
    -- S14, "That device was not signed out. Try again.").
    raise exception 'no_session_claim' using errcode = '42501';
  end if;
  if p_session_id::text = v_current then
    raise exception 'current_session' using errcode = '42501';
  end if;
  delete from auth.sessions s
  where s.id = p_session_id
    and s.user_id = v_uid;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    -- Another member's session and a row that is already gone read the same: nothing of the
    -- caller's was found, and nothing about any other member is disclosed.
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.session_revoke(uuid) from public, anon;
grant execute on function public.session_revoke(uuid) to authenticated;

comment on function public.session_revoke(uuid) is
  'Handoff 61-S1 (extraction 60-SETTINGS S13, S14): deletes one of the caller''s own auth.sessions rows, never the current session (current_session, 42501) and never another member''s (session_not_found, P0002). The row''s refresh tokens and AMR claims go by cascade, so the device cannot mint a new access token.';
