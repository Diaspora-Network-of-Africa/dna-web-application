-- Handoff 60-NC: notification controls and one-click unsubscribe, the database half (rulings 1529,
-- 1552 to 1557, 1560, 1572; 477, 194, 1299, 1300; gap G245).
--
--   public.notification_email_modes   the email mode vocabulary (1554): off, immediate, digest, with
--                                     their labels. It becomes the one owner of the mode set
--                                     (Finding 1): notification_preferences.mode and
--                                     notification_kinds.email_default reference it by foreign key,
--                                     their two literal check constraints go, and the preference
--                                     writer reads it. Served by vocabularies() as
--                                     notification_email_modes.
--   public.notification_categories    the email category vocabulary (1555): the five Cs, then system
--                                     as Account. The key is public.c_category itself, so no key can
--                                     exist outside the enum, and the block after the seed raises
--                                     unless the keys are the enum's labels in the enum's order
--                                     (Finding 2). Served by vocabularies() as notification_categories.
--   private.notification_preference_write
--                                     the one writer of notification_preferences, for a named member;
--                                     set_notification_preference (the member's own row) and
--                                     email_unsubscribe (every category off for the token's member)
--                                     both go through it, so the mode check lives in one place.
--   public.notification_email_view    the email view's one read (1553, 1560): per category, whether a
--                                     non-transactional kind with a fixed C carries both copy
--                                     columns, the caller's own mode, and the shared email_default of
--                                     those kinds when they agree.
--   private.email_unsubscribe_tokens  the one-click token store (G245, 1529, 1572): a sha256 of the
--                                     token, never the token; the member; the outbox row it was sent
--                                     with; created, used and expiry at 60 days.
--   public.email_unsubscribe_mint     notify-deliver's mint, before sendMail, for a non-transactional
--                                     outbox row; returns the token once. Service role only.
--   public.email_unsubscribe          the one-click write the /api/email/unsubscribe route calls with
--                                     the publishable key: done, or expired for a token that is
--                                     unknown, used or past its 60 days. Every category off.
--
-- Findings, as resolved here:
--   1. The mode set had three literal owners, not two: notification_preferences_mode_check,
--      set_notification_preference's not in list, and notification_kinds_email_default_check, which
--      the handoff did not name. All three now read notification_email_modes. Two check constraints
--      are dropped and replaced by foreign keys: that is the destructive DDL in this file. Code that
--      acts on what a mode means (private.notify's immediate and digest branches, the outbox's
--      immediate-or-digest check) is behaviour on a value, not a second list of the set, and is left.
--   2. notification_categories.value is of type public.c_category, and the assertion below compares
--      its keys in position order with enum_range(null::public.c_category).
--
-- A kind whose C comes from the object (c_from_object) has no fixed category and never qualifies a
-- category in notification_email_view; none carries copy at this file's writing (Session 60's read).
--
-- Contains destructive DDL: two `drop constraint` statements (notification_preferences_mode_check,
-- notification_kinds_email_default_check). No drop column, drop type, drop trigger or delete.
-- Committed before it is applied (225).

-- ---------------------------------------------------------------------------------------------------
-- 1. The two vocabularies (1554, 1555).
-- ---------------------------------------------------------------------------------------------------

create table public.notification_email_modes (
  value text primary key,
  label text not null,
  position smallint not null unique
);

alter table public.notification_email_modes enable row level security;
revoke all on table public.notification_email_modes from public, anon, authenticated;
grant select on table public.notification_email_modes to authenticated;
grant all on table public.notification_email_modes to service_role;
create policy notification_email_modes_member_select on public.notification_email_modes
  for select to authenticated using (true);
create policy notification_email_modes_service_role on public.notification_email_modes
  for all to service_role using (true) with check (true);
comment on table public.notification_email_modes is
  'The email modes a member chooses per category (handoff 60-NC, ruling 1554), served by vocabularies() as notification_email_modes, and the one owner of the mode set: notification_preferences.mode and notification_kinds.email_default reference it, and private.notification_preference_write reads it. Personas (1116): member, Space lead, event host and admin read it as authenticated; service role writes it; anon is deliberately absent because the email view belongs to a signed-in member.';

insert into public.notification_email_modes (value, label, position) values
  ('off', 'Off', 1),
  ('immediate', 'Right away', 2),
  ('digest', 'Daily digest', 3);

create table public.notification_categories (
  value public.c_category primary key,
  label text not null,
  position smallint not null unique
);

alter table public.notification_categories enable row level security;
revoke all on table public.notification_categories from public, anon, authenticated;
grant select on table public.notification_categories to authenticated;
grant all on table public.notification_categories to service_role;
create policy notification_categories_member_select on public.notification_categories
  for select to authenticated using (true);
create policy notification_categories_service_role on public.notification_categories
  for all to service_role using (true) with check (true);
comment on table public.notification_categories is
  'The categories a member sets an email mode for (handoff 60-NC, ruling 1555): the five Cs, then system as Account, keyed by public.c_category in the enum''s order. Served by vocabularies() as notification_categories. Personas (1116): member, Space lead, event host and admin read it as authenticated; service role writes it; anon is deliberately absent because the email view belongs to a signed-in member.';

insert into public.notification_categories (value, label, position) values
  ('connect', 'Connect', 1),
  ('convene', 'Convene', 2),
  ('collaborate', 'Collaborate', 3),
  ('contribute', 'Contribute', 4),
  ('convey', 'Convey', 5),
  ('system', 'Account', 6);

-- Finding 2: the keys are c_category's labels, every one, in its order.
do $$
declare
  v_keys text[];
  v_enum text[];
begin
  select array_agg(c.value::text order by c.position) into v_keys from public.notification_categories c;
  select array_agg(x::text order by x) into v_enum from unnest(enum_range(null::public.c_category)) x;
  if v_keys is distinct from v_enum then
    raise exception 'notification_categories: keys % are not c_category % in order', v_keys, v_enum;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 2. One owner of the mode set (Finding 1). Both tables hold only values the vocabulary carries at
--    the Session 60 read (0 preference rows; 9 kinds, every one off), so the keys validate.
-- ---------------------------------------------------------------------------------------------------

alter table public.notification_preferences drop constraint notification_preferences_mode_check;

alter table public.notification_preferences
  add constraint notification_preferences_mode_fkey
  foreign key (mode) references public.notification_email_modes (value);

alter table public.notification_kinds drop constraint notification_kinds_email_default_check;

alter table public.notification_kinds
  add constraint notification_kinds_email_default_fkey
  foreign key (email_default) references public.notification_email_modes (value);

create function private.notification_preference_write(p_member uuid, p_c public.c_category, p_mode text)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
begin
  if p_member is null or p_c is null or p_mode is null
     or not exists (select 1 from public.notification_email_modes m where m.value = p_mode) then
    raise exception 'notification_preference_write: a member, a category and a mode from notification_email_modes are required'
      using errcode = '22023';
  end if;
  insert into public.notification_preferences as p (member_id, c, channel, mode, updated_at)
  values (p_member, p_c, 'email', p_mode, now())
  on conflict (member_id, c, channel) do update
    set mode = excluded.mode, updated_at = now()
    where p.mode is distinct from excluded.mode;
end;
$$;

revoke all on function private.notification_preference_write(uuid, public.c_category, text)
  from public, anon, authenticated;

comment on function private.notification_preference_write(uuid, public.c_category, text) is
  'The one writer of public.notification_preferences (handoff 60-NC): one member''s email mode for one category, refused with 22023 unless the mode is a notification_email_modes value. Called by set_notification_preference for the caller and by email_unsubscribe for a token''s member; no client role executes it.';

create or replace function public.set_notification_preference(p_c public.c_category, p_channel text, p_mode text)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'set_notification_preference: not signed in' using errcode = '42501';
  end if;
  if p_c is null or p_channel is distinct from 'email'
     or p_mode is null
     or not exists (select 1 from public.notification_email_modes m where m.value = p_mode) then
    raise exception 'set_notification_preference: a C, the email channel and a mode from notification_email_modes are required'
      using errcode = '22023';
  end if;
  perform private.notification_preference_write(v_uid, p_c, p_mode);
end;
$$;

comment on function public.set_notification_preference(public.c_category, text, text) is
  'The member''s own email mode for one category (handoff 55-A, 1320; 60-NC, 1552): the caller''s row through private.notification_preference_write. Refuses anything but the email channel and a notification_email_modes value with 22023.';

comment on table public.notification_preferences is
  'A member''s email mode for each C (handoff 55-A, ruling 1320), a notification_email_modes value (60-NC, 1554). private.notify reads it when a kind carries copy (1520); a transactional kind ignores it. Personas (1116): a member, a Space lead, an event host and an admin each read only their own rows as authenticated and write them only through set_notification_preference, or every category off through a one-click email_unsubscribe token; both reach private.notification_preference_write; service role holds all; anon is deliberately absent because a preference belongs to a signed-in member.';

-- ---------------------------------------------------------------------------------------------------
-- 3. The email view's one read (1553, 1560).
-- ---------------------------------------------------------------------------------------------------

create function public.notification_email_view()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'notification_email_view: not signed in' using errcode = '42501';
  end if;
  -- A kind qualifies its category when it is not transactional, its C is fixed, and both copy
  -- columns are set: exactly the kinds private.notify enqueues against a preference. The default is
  -- shown only when every such kind in the category agrees (1560).
  select coalesce(jsonb_agg(jsonb_build_object(
           'c', cat.value,
           'has_copy', coalesce(k.n, 0) > 0,
           'mode', p.mode,
           'email_default', case when k.defaults = 1 then k.email_default end)
         order by cat.position), '[]'::jsonb)
  into v_rows
  from public.notification_categories cat
  left join lateral (
    select count(*) as n,
           count(distinct nk.email_default) as defaults,
           min(nk.email_default) as email_default
    from public.notification_kinds nk
    where nk.c = cat.value
      and not nk.c_from_object
      and not nk.transactional
      and nk.email_subject is not null and btrim(nk.email_subject) <> ''
      and nk.email_line is not null and btrim(nk.email_line) <> ''
  ) k on true
  left join public.notification_preferences p
    on p.member_id = v_uid and p.c = cat.value and p.channel = 'email';
  return v_rows;
end;
$$;

revoke all on function public.notification_email_view() from public, anon;
grant execute on function public.notification_email_view() to authenticated;

comment on function public.notification_email_view() is
  'The email preferences view''s one read (handoff 60-NC, rulings 1553, 1560), for the caller only: one entry per notification_categories row in its order, with has_copy (a non-transactional kind with a fixed C carries both email_subject and email_line), the caller''s own mode or null, and email_default, the one default those kinds share or null when they differ or there are none. A c_from_object kind has no fixed category and qualifies none. Never takes a member.';

-- ---------------------------------------------------------------------------------------------------
-- 4. One-click unsubscribe (G245, 1529, 1572; 477).
-- ---------------------------------------------------------------------------------------------------

create table private.email_unsubscribe_tokens (
  token_hash bytea primary key,
  member_id uuid not null references auth.users (id) on delete cascade,
  outbox_id uuid not null unique references private.notification_outbox (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint email_unsubscribe_tokens_hash_check check (octet_length(token_hash) = 32),
  constraint email_unsubscribe_tokens_expiry_check check (expires_at = created_at + interval '60 days')
);

create index email_unsubscribe_tokens_member_idx on private.email_unsubscribe_tokens (member_id);

alter table private.email_unsubscribe_tokens enable row level security;
revoke all on table private.email_unsubscribe_tokens from public, anon, authenticated;

comment on table private.email_unsubscribe_tokens is
  'One row per non-transactional email sent (handoff 60-NC, G245, rulings 1529, 1572): the sha256 of the one-click token, never the token; the member it names; the outbox row it went out with; when it was minted, when it was used, and its expiry 60 days after minting. Written by email_unsubscribe_mint (notify-deliver, service role) and email_unsubscribe (the one-click route). Personas (1116): member, Space lead, event host and admin are deliberately absent, because a token is a credential and no surface reads one; anon and authenticated reach it only through email_unsubscribe, which answers a word and never a row; service role reaches it only through the two functions; live_arms reads and ages the two test accounts'' rows inside a rolled-back transaction (382).';

create function public.email_unsubscribe_mint(p_outbox_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_member uuid;
  v_transactional boolean;
  v_token text;
  v_now timestamptz := now();
begin
  select o.member_id, k.transactional
  into v_member, v_transactional
  from private.notification_outbox o
  join public.notifications n on n.id = o.notification_id
  join public.notification_kinds k on k.kind = n.kind
  where o.id = p_outbox_id;
  if v_member is null then
    raise exception 'email_unsubscribe_mint: no outbox row' using errcode = '22023';
  end if;
  -- 477: transactional mail carries no unsubscribe.
  if v_transactional then
    raise exception 'email_unsubscribe_mint: a transactional email carries no unsubscribe' using errcode = '22023';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.email_unsubscribe_tokens as t (token_hash, member_id, outbox_id, created_at, expires_at)
  values (extensions.digest(v_token, 'sha256'), v_member, p_outbox_id, v_now, v_now + interval '60 days')
  on conflict (outbox_id) do update
    set token_hash = excluded.token_hash,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        used_at = null;
  return v_token;
end;
$$;

revoke all on function public.email_unsubscribe_mint(uuid) from public, anon, authenticated;
grant execute on function public.email_unsubscribe_mint(uuid) to service_role;
grant execute on function public.email_unsubscribe_mint(uuid) to live_arms;

comment on function public.email_unsubscribe_mint(uuid) is
  'notify-deliver''s mint (handoff 60-NC, G245, 1572), called before sendMail so a failed send still leaves the row: a fresh 32-byte token for one non-transactional outbox row, stored as its sha256 against the row''s member with a 60-day expiry, and returned once. A second mint for the same row replaces the first token. Refuses a transactional row (477) and an unknown row with 22023. Service role, and live_arms inside a rolled-back transaction (382).';

create function public.email_unsubscribe(p_token text)
returns text
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_row private.email_unsubscribe_tokens%rowtype;
  v_c public.c_category;
begin
  -- An unknown, malformed, used or expired token reads the same, so the answer says nothing about
  -- which.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return 'expired';
  end if;
  select t.* into v_row
  from private.email_unsubscribe_tokens t
  where t.token_hash = extensions.digest(p_token, 'sha256')
  for update;
  if not found or v_row.used_at is not null or v_row.expires_at <= now() then
    return 'expired';
  end if;
  -- 1529: every category off; transactional mail ignores the preference (477).
  for v_c in select c.value from public.notification_categories c order by c.position loop
    perform private.notification_preference_write(v_row.member_id, v_c, 'off');
  end loop;
  update private.email_unsubscribe_tokens t
  set used_at = now()
  where t.token_hash = v_row.token_hash;
  return 'done';
end;
$$;

revoke all on function public.email_unsubscribe(text) from public;
grant execute on function public.email_unsubscribe(text) to anon, authenticated, service_role;

comment on function public.email_unsubscribe(text) is
  'The one-click write (handoff 60-NC, G245, rulings 1529, 1557): for a live token, every notification_categories row goes to off for the token''s member and the token is marked used; answers done. A token unknown, malformed, already used or past its 60 days answers expired and changes nothing. Called by the /api/email/unsubscribe route with the publishable key, signed out or in; the token is the credential, so it never takes a member.';

-- ---------------------------------------------------------------------------------------------------
-- 5. The live arms (382): the token arms seed through the canonical paths inside a rolled-back
--    transaction. They give connection_request copy (so private.notify enqueues), read the outbox
--    row a test account's notification enqueued, and age that row's token to 61 days.
-- ---------------------------------------------------------------------------------------------------

grant select (kind, email_subject, email_line), update (email_subject, email_line)
  on table public.notification_kinds to live_arms;

create policy notification_kinds_live_arms_select on public.notification_kinds
  for select to live_arms
  using (kind = 'connection_request');

create policy notification_kinds_live_arms_update on public.notification_kinds
  for update to live_arms
  using (kind = 'connection_request')
  with check (kind = 'connection_request');

grant select (id, notification_id, member_id, mode) on table private.notification_outbox to live_arms;

create policy notification_outbox_live_arms_select on private.notification_outbox
  for select to live_arms
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.handle in ('owner-test', 'member-test')
  ));

grant select (outbox_id, member_id, created_at, expires_at, used_at),
      update (created_at, expires_at)
  on table private.email_unsubscribe_tokens to live_arms;

create policy email_unsubscribe_tokens_live_arms_select on private.email_unsubscribe_tokens
  for select to live_arms
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.handle in ('owner-test', 'member-test')
  ));

create policy email_unsubscribe_tokens_live_arms_update on private.email_unsubscribe_tokens
  for update to live_arms
  using (exists (
    select 1 from public.members m
    where m.id = member_id and m.handle in ('owner-test', 'member-test')
  ))
  with check (exists (
    select 1 from public.members m
    where m.id = member_id and m.handle in ('owner-test', 'member-test')
  ));

-- ---------------------------------------------------------------------------------------------------
-- 6. vocabularies() gains the two keys; every other line is the body read live (md5 of prosrc
--    0fefb39508e5eb611efc37ac45a79049, equal to 20261008150700's).
-- ---------------------------------------------------------------------------------------------------

create or replace function public.vocabularies()
returns jsonb
language sql
stable
set search_path to ''
as $$
  select jsonb_build_object(
    'focus', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.focus_areas),
    'industries', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.industries),
    'regions', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.regional_expertise),
    'skills', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.skills),
    'languages', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.languages),
    'intent', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.intents),
    'interests', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.interests),
    'countries', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.countries),
    'world', (select coalesce(jsonb_agg(name order by position), '[]'::jsonb) from public.world_countries),
    -- Ruling 187: the stance labels come from the table, here as everywhere else.
    'stances', (select coalesce(jsonb_agg(jsonb_build_object('value', s.stance, 'label', s.label)
                                           order by s.position), '[]'::jsonb)
                 from public.member_stances s),
    'heritage', (select jsonb_agg(x) from unnest(enum_range(null::public.heritage_kind)) x),
    'pathway', (select jsonb_agg(x) from unnest(enum_range(null::public.return_pathway)) x),
    'timeline', (select jsonb_agg(x) from unnest(enum_range(null::public.return_timeline)) x),
    -- Ruling 193: the Contribute instrument, in enum order, with its label derived from its value.
    'instrument', (select coalesce(jsonb_agg(jsonb_build_object(
                            'value', x,
                            'label', upper(left(replace(x::text, '_', '-'), 1))
                                     || substr(replace(x::text, '_', '-'), 2)) order by x), '[]'::jsonb)
                   from unnest(enum_range(null::public.contribute_instrument)) x),
    -- Ruling 1018: the roles a host can name on an event, with the verb the invitation reads.
    'event_roles', (select coalesce(jsonb_agg(jsonb_build_object('value', k.role, 'label', k.label, 'verb', k.verb)
                                               order by k.position), '[]'::jsonb)
                    from public.event_role_kinds k),
    -- Rulings 657, 1037 and 1038: Convene's category families, in the report's order.
    'convene_families', (select coalesce(jsonb_agg(jsonb_build_object(
                                  'value', f.family, 'label', f.label, 'schema_org', to_jsonb(f.schema_org))
                                  order by f.position), '[]'::jsonb)
                         from public.convene_families f),
    -- Rulings 693, 925, 729, 1041 and 1093: Convene's lens set, All then the four who-lenses.
    'convene_lenses', (select coalesce(jsonb_agg(jsonb_build_object(
                                'value', l.lens, 'name', l.name, 'short', l.short, 'icon', l.icon, 'scope', l.scope)
                                order by l.position), '[]'::jsonb)
                       from public.convene_lenses l),
    -- Rulings 1092 and 1105: Discovery's nine lanes, in their one fixed order.
    'convene_lanes', (select coalesce(jsonb_agg(jsonb_build_object('value', n.lane, 'name', n.name)
                                order by n.position), '[]'::jsonb)
                      from public.convene_lanes n),
    -- Ruling 1186: the kinds of host-written block and the heading each shows.
    'event_block_kinds', (select coalesce(jsonb_agg(jsonb_build_object('value', k.kind, 'label', k.label)
                                                     order by k.position), '[]'::jsonb)
                          from public.event_block_kinds k),
    -- Ruling 1177: the platform roles a member can hold, in the vocabulary's order.
    'platform_role_kinds', (select coalesce(jsonb_agg(jsonb_build_object('value', k.role, 'label', k.label)
                                                       order by k.position), '[]'::jsonb)
                            from public.platform_role_kinds k),
    -- Brief 14 (1331): Messenger's thread kinds, surfaced or schema-only.
    'thread_kinds', (select coalesce(jsonb_agg(jsonb_build_object(
                              'value', k.value, 'label', k.label, 'surfaced', k.surfaced)
                              order by k.position), '[]'::jsonb)
                     from public.thread_kinds k),
    -- Brief 14 (1348): the three mute durations.
    'message_mute_durations', (select coalesce(jsonb_agg(jsonb_build_object('value', d.value, 'label', d.label)
                                                          order by d.position), '[]'::jsonb)
                               from public.message_mute_durations d),
    -- Brief 14 (1349): the six report reasons.
    'message_report_reasons', (select coalesce(jsonb_agg(jsonb_build_object('value', r.value, 'label', r.label)
                                                          order by r.position), '[]'::jsonb)
                               from public.message_report_reasons r),
    -- Brief 14, 41-E (1403, 1577): the quick bar's eight emoji in 1403's order, the character and
    -- its glyph name. The full set is message_reaction_emoji; the picker reads emojibase's own
    -- file from the app's origin and never this projection.
    'message_reaction_quick', (select coalesce(jsonb_agg(jsonb_build_object('value', e.emoji, 'label', e.label)
                                                          order by e.quick_position), '[]'::jsonb)
                               from public.message_reaction_emoji e
                               where e.quick_position is not null),
    -- Handoff 45-D (1381, 1393): the admin app's appearances.
    'admin_appearances', (select coalesce(jsonb_agg(jsonb_build_object('value', a.value, 'label', a.label)
                                                     order by a.position), '[]'::jsonb)
                          from public.admin_appearances a),
    -- Handoff 45-D (1304, 1392): the Overview's grains, values as the projections take them.
    'overview_grains', (select coalesce(jsonb_agg(jsonb_build_object('value', g.value, 'label', g.label)
                                                   order by g.position), '[]'::jsonb)
                        from public.overview_grains g),
    -- Handoff 45-D (1304, 1392): the Overview's comparisons.
    'overview_comparisons', (select coalesce(jsonb_agg(jsonb_build_object('value', c.value, 'label', c.label)
                                                        order by c.position), '[]'::jsonb)
                             from public.overview_comparisons c),
    -- Handoff 45-D (1382, 1394): the reporting zones, by IANA identifier.
    'reporting_zones', (select coalesce(jsonb_agg(jsonb_build_object(
                                 'value', z.value, 'name', z.name, 'city', z.city, 'abbreviation', z.abbreviation)
                                 order by z.position), '[]'::jsonb)
                        from public.reporting_zones z),
    -- Handoff 55-A (1318, 1325): the notification kinds, each with its C or the marker that the C
    -- comes from the object's context, the destination in words (490) and whether it renders.
    'notification_kinds', (select coalesce(jsonb_agg(jsonb_build_object(
                                    'value', k.kind, 'c', k.c, 'c_from_object', k.c_from_object,
                                    'destination', k.destination, 'renders', k.renders)
                                    order by k.position), '[]'::jsonb)
                           from public.notification_kinds k),
    -- Handoff 60-NC (1554): the email modes, each a value notification_preferences.mode and
    -- notification_kinds.email_default reference, in the order the Segment shows them.
    'notification_email_modes', (select coalesce(jsonb_agg(jsonb_build_object('value', m.value, 'label', m.label)
                                                            order by m.position), '[]'::jsonb)
                                 from public.notification_email_modes m),
    -- Handoff 60-NC (1555): the email categories, the five Cs then system, keyed by c_category.
    'notification_categories', (select coalesce(jsonb_agg(jsonb_build_object('value', c.value, 'label', c.label)
                                                           order by c.position), '[]'::jsonb)
                                from public.notification_categories c)
  );
$$;
-- ---------------------------------------------------------------------------------------------------
-- 7. The catalogue (1299, 1300). No admin view of a member's preferences and no DIA line (Work 7).
-- ---------------------------------------------------------------------------------------------------

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'notification_email_modes', 'operated',
   'A vocabulary a console edits by row; served to signed-in callers through vocabularies() (handoff 60-NC, 1554).',
   'excluded', 'A vocabulary, not member data (1300).'),
  ('public', 'notification_categories', 'operated',
   'A vocabulary a console edits by row; served to signed-in callers through vocabularies() (handoff 60-NC, 1555).',
   'excluded', 'A vocabulary, not member data (1300).'),
  ('private', 'email_unsubscribe_tokens', 'exempt',
   'One-click unsubscribe credentials, stored as hashes and reached only through email_unsubscribe_mint and email_unsubscribe (handoff 60-NC, G245); no console reads them (1299).',
   'excluded', 'A credential; DIA has no part in notification controls (1300).');
