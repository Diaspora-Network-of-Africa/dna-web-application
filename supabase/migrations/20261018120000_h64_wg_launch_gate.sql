-- Handoff 64-WG (Session 64): the launch gate, server half (rulings 1854, 1855, 1751; 307 for the
-- client gate, 1827 for the route). Committed before it is applied (225); applied through
-- migrate.yml, rehearse then apply, each approved by the founder (1827), with its
-- supabase_migrations row in the same transaction, and never by apply_migration (553). Nothing here
-- drops, revokes an existing grant, or deletes a row.
--
-- What a held member is. public.members gains admitted_at (timestamptz, bare, no default: 564). A
-- row whose admitted_at is null is held. Every account existing at apply is admitted at apply time
-- (1855 item 5: all twelve current accounts), with one admin_actions row naming them, so behaviour
-- for them is unchanged; a row private.handle_new_user inserts after apply is held until an admin
-- admits it. Sign-up stays closed (1852), so no held member exists until the whole gate is live.
--
-- What the gate is. A route guard alone is not a gate: a held session can call the database
-- directly (1854 item 4), so the gate is the database, on two layers, and the client gate in
-- src/routes/__root.tsx (OnboardingGate) is not changed by this file.
--
--   1. Row policy. Every table authenticated reaches directly carries one RESTRICTIVE policy,
--      `<table>_admitted_gate`, for all commands, ANDed with the table's existing policies:
--      using and with check `(select private.is_admitted())`. A held member reads zero rows and
--      writes none, and every security-invoker function (convene_discovery, event_page,
--      publish_post, rsvp_event, save_profile_section, post_react, the feed and Messenger views,
--      and the rest) answers nothing through them. members and media carry the own-row shape,
--      `id = auth.uid() or admitted` and `owner_id = auth.uid() or admitted`, because a held
--      member keeps their own members row and their own media rows; storage.objects carries
--      `bucket_id = 'profile-media' or admitted`, because a held member keeps their own profile
--      media. Vocabularies (every table whose only policy is `true`) carry no gate: they name no
--      member, and the onboarding screens read them through vocabularies().
--   2. The definer gate. A security definer function runs as its owner and no row policy reaches
--      it, so every member-facing definer executable by authenticated takes
--      `private.assert_admitted()` as its first statement, which raises 42501 for a signed-in
--      caller who is not admitted and does nothing for a signed-out one (the function's own
--      signed-out answer stands, byte for byte). The seventy-six functions are rewritten below
--      from their live definition, read with pg_get_functiondef as 20260913065114 (r469) did,
--      with the one line inserted after the top-level `begin` (plpgsql) or at the top of the body
--      (sql); each rewrite is verified to carry the line exactly once, and a guard at the end
--      raises if any definer the rule covers is left without it.
--
-- The allowlist for a held member (handoff item 4). onboarding_state() (which now also answers
-- `admitted`); the three onboarding write paths, onboard_who, onboard_where, onboard_relationship;
-- the self-row read and update on members (members_owner_select, members_owner_update); their own
-- media rows and profile-media objects; rate_limit_check, the ceiling every write path and the
-- media-upload function read (an avatar on the Who screen goes through it); vocabularies() and the
-- vocabulary tables; sign-out, which is Auth's and reads no table. The read the DIA suggestion will
-- need later is held: no such projection exists in the tree today, and B64-Waitlist names it.
--
-- Exempt, with the reason. The seventeen admin_* projections and writes and live_arms_admin_member
-- hold their own gate, private.has_platform_role at aal2 (1265), which a held member cannot pass;
-- admin_session_state answers any caller their own standing and nothing else (holds_role false for
-- a held member, as for every member with no role), so it is not gated either.
-- email_unsubscribe, event_public_page, public_attestations, record_event and resolve_event_link
-- are the signed-out corpus (141, 680, 1297, 1100): callable by anon, the same answer with no
-- session, so a gate on them would withhold nothing. Tables with no grant to anon or authenticated
-- (admin_actions, platform_roles, event_aliases, member_embeddings and the rest) are closed already.
--
-- Inventory (the PR carries the same table).
--   Gated tables (57, the restrictive policy): attestations, connection_requests, convene_picks,
--     discovery_dismissals, dismissed_suggestions, edges, event_blocks, event_delivery,
--     event_host_settings, event_parties, event_registrations, events, member_about, member_blocks,
--     member_connections, member_corridors, member_focus_areas, member_follows, member_homes,
--     member_industries, member_intent, member_intents, member_interests, member_lane_activity,
--     member_languages, member_links, member_messaging_settings, member_origin, member_rail_state,
--     member_reaction_picks, member_regional_expertise, member_skills, member_stance_details,
--     member_subscriptions, member_visibility, message_mentions, message_reactions,
--     message_reports, message_requests, messages, messenger_dia_dismissals,
--     notification_preferences, notifications, opportunities, post_dia, post_drafts, post_intents,
--     post_links, post_media, post_reactions, post_saves, posts, space_roles, spaces, stories,
--     thread_members, threads.
--   Own-row gated (3): members, media, storage.objects (profile-media kept).
--   Gated definers (76): claim_guest_registrations, connect_cards, connect_filter_options,
--     connect_requests_pending, connect_where, connection_request_intros, dismiss_discovery_item,
--     dismiss_suggestion, event_alias_check, invite_event_party, mark_surface_seen,
--     member_recent_reactions, the forty-seven messenger_* functions, note_lane_act,
--     notification_email_view, notifications_dot, notifications_mark_all_read,
--     notifications_mark_seen, profile_view (signed in only), remove_event_party,
--     respond_to_event_role, respond_to_request, save_event_blocks, send_introduction,
--     session_revoke, sessions_list, set_follow, set_notification_preference, set_subscription,
--     withdraw_request.
--   Invoker functions, gated by the row policies (15): convene_discovery, convene_places,
--     event_going_names, event_page, event_presenters, event_speakers, post_intent, post_react,
--     post_reaction_rows, post_reactors_author, post_reactors_visible, publish_post, rsvp_event,
--     save_profile_section (the members columns stay editable, the sections refuse), vocabularies.
--   Views, gated through their tables (4): feed, messenger_messages_view, messenger_requests_view,
--     messenger_threads_view.
--
-- The admin act (handoff item 6, Done Means 4). public.admin_admit_all(p_reason) admits every held
-- member in one statement, writes one admin_actions row (admission.admitted_all, the ids before and
-- the count and time after), returns the action id, and refuses with 42501 anyone not holding the
-- admin role at aal2 (private.has_platform_role, as admin_grant_role does), with 22023 a blank
-- reason or a call when nobody is held. No surface calls it yet (docs/GAPS.md).
--
-- The live arms (382). live_arms gains select and update on members.admitted_at, scoped as before
-- to the two ruling 218 accounts, so the H64-WG arm can hold member-test inside its rolled-back
-- transaction, and execute on private.admission_actions_count(text), which counts admin_actions
-- rows by action as private.admin_org_actions_count counts them by setting.
--
-- tests/visibility-conformance.cjs reads permissive policies only from here: a restrictive
-- admission policy is not a visibility rule, and the H64-WG arm in tests/live-db.cjs holds every
-- gated table to exactly one restrictive policy reaching private.is_admitted.

-- ---------------------------------------------------------------------------------------------------
-- 1. The marker. Added bare (564): a new row is held; the backfill below reaches every row that
--    exists at apply, by its own update, so that the intent is a statement and not a default.
-- ---------------------------------------------------------------------------------------------------

alter table public.members add column admitted_at timestamptz;

comment on column public.members.admitted_at is
  'When the member was admitted past the launch gate (handoff 64-WG, rulings 1854, 1855). Null is held: the row policies and the definer gate answer a held member nothing but the allowlist (onboarding_state, the onboarding writes, the self row, own media, rate_limit_check, vocabularies). Written by public.admin_admit_all and by the 20261018120000 backfill of every account existing at apply; never by a client.';

-- ---------------------------------------------------------------------------------------------------
-- 2. The helpers. is_admitted reads auth.uid() only (a security-definer helper never takes the
--    viewer as a parameter); assert_admitted is the definer gate and is executable by no client
--    role, because it runs inside definers as their owner.
-- ---------------------------------------------------------------------------------------------------

create function private.is_admitted()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = auth.uid() and m.admitted_at is not null
  );
$$;

comment on function private.is_admitted() is
  'Whether the caller is admitted past the launch gate (handoff 64-WG, ruling 1854): a members row for auth.uid() with admitted_at set. Reads auth.uid() only. Cited by every <table>_admitted_gate restrictive policy and by private.assert_admitted.';

create function private.assert_admitted()
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if auth.uid() is not null and not private.is_admitted() then
    raise exception 'not admitted' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_admitted() from public, anon, authenticated;

comment on function private.assert_admitted() is
  'The definer gate (handoff 64-WG, ruling 1854): the first statement of every member-facing security definer function authenticated may execute. Raises 42501 for a signed-in caller who is not admitted and does nothing for a signed-out one, so each function''s own signed-out answer stands. No client role may execute it.';

-- ---------------------------------------------------------------------------------------------------
-- 3. Backfill: every account existing at apply is admitted at apply time (1855 item 5), and the act
--    is recorded once, with the ids it reached, so the log says who was admitted by the migration.
-- ---------------------------------------------------------------------------------------------------

do $do$
declare
  v_ids uuid[];
  v_now timestamptz := now();
begin
  select coalesce(array_agg(m.id order by m.created_at, m.id), '{}'::uuid[]) into v_ids
  from public.members m
  where m.admitted_at is null;

  update public.members set admitted_at = v_now where admitted_at is null;

  insert into public.admin_actions (actor, role_at_time, action, target_kind, target_id, reason, before, after)
  values (
    null, null, 'admission.backfilled', 'members', null,
    'Handoff 64-WG (ruling 1855 item 5): every account existing at apply is admitted by 20261018120000',
    jsonb_build_object('held', coalesce(array_length(v_ids, 1), 0), 'member_ids', to_jsonb(v_ids)),
    jsonb_build_object('admitted', coalesce(array_length(v_ids, 1), 0), 'admitted_at', v_now));
end
$do$;

-- ---------------------------------------------------------------------------------------------------
-- 4. Row policy: one restrictive policy per table authenticated reaches directly, ANDed with the
--    table's own policies. The three own-row shapes follow.
-- ---------------------------------------------------------------------------------------------------

do $do$
declare
  t text;
begin
  foreach t in array array[
    'attestations', 'connection_requests', 'convene_picks', 'discovery_dismissals',
    'dismissed_suggestions', 'edges', 'event_blocks', 'event_delivery', 'event_host_settings',
    'event_parties', 'event_registrations', 'events', 'member_about', 'member_blocks',
    'member_connections', 'member_corridors', 'member_focus_areas', 'member_follows',
    'member_homes', 'member_industries', 'member_intent', 'member_intents', 'member_interests',
    'member_lane_activity', 'member_languages', 'member_links', 'member_messaging_settings',
    'member_origin', 'member_rail_state', 'member_reaction_picks', 'member_regional_expertise',
    'member_skills', 'member_stance_details', 'member_subscriptions', 'member_visibility',
    'message_mentions', 'message_reactions', 'message_reports', 'message_requests', 'messages',
    'messenger_dia_dismissals', 'notification_preferences', 'notifications', 'opportunities',
    'post_dia', 'post_drafts', 'post_intents', 'post_links', 'post_media', 'post_reactions',
    'post_saves', 'posts', 'space_roles', 'spaces', 'stories', 'thread_members', 'threads'
  ] loop
    if to_regclass('public.' || t) is null then
      raise exception 'H64-WG: public.% is not a table on this project', t;
    end if;
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      'using ((select private.is_admitted())) with check ((select private.is_admitted()))',
      t || '_admitted_gate', t);
  end loop;
end
$do$;

create policy members_admitted_gate on public.members
  as restrictive for all to authenticated
  using (id = (select auth.uid()) or (select private.is_admitted()))
  with check (id = (select auth.uid()) or (select private.is_admitted()));

create policy media_admitted_gate on public.media
  as restrictive for all to authenticated
  using (owner_id = (select auth.uid()) or (select private.is_admitted()))
  with check (owner_id = (select auth.uid()) or (select private.is_admitted()));

create policy objects_admitted_gate on storage.objects
  as restrictive for all to authenticated
  using (bucket_id = 'profile-media' or (select private.is_admitted()))
  with check (bucket_id = 'profile-media' or (select private.is_admitted()));

-- ---------------------------------------------------------------------------------------------------
-- 5. The definer gate, inserted into each function's live definition (r469's method). A name that
--    resolves to no function or to more than one raises; a rewrite that does not carry the line
--    exactly once raises; and after the loop every security definer function in public that
--    authenticated may execute, outside the allowlist, the admin set and the signed-out corpus,
--    must carry it, or the apply fails by name.
-- ---------------------------------------------------------------------------------------------------

do $do$
declare
  v_names text[] := array[
    'claim_guest_registrations', 'connect_cards', 'connect_filter_options',
    'connect_requests_pending', 'connect_where', 'connection_request_intros',
    'dismiss_discovery_item', 'dismiss_suggestion', 'event_alias_check', 'invite_event_party',
    'mark_surface_seen', 'member_recent_reactions',
    'messenger_archive', 'messenger_delete', 'messenger_delivered_to', 'messenger_dia_dismiss',
    'messenger_dia_signals', 'messenger_edit', 'messenger_event_thread_available',
    'messenger_event_thread_join', 'messenger_event_thread_open', 'messenger_mark_unread',
    'messenger_media_access', 'messenger_media_forget', 'messenger_media_locate',
    'messenger_media_marked', 'messenger_media_record', 'messenger_mute',
    'messenger_open_one_to_one', 'messenger_pin_message', 'messenger_pin_thread',
    'messenger_react', 'messenger_read_to', 'messenger_recent_reactions', 'messenger_report',
    'messenger_report_view', 'messenger_request_accept', 'messenger_request_block',
    'messenger_request_decline', 'messenger_request_recover', 'messenger_request_send',
    'messenger_search', 'messenger_send', 'messenger_settings', 'messenger_settings_set',
    'messenger_space_thread_sync', 'messenger_thread_create_group', 'messenger_thread_invite',
    'messenger_thread_invite_accept', 'messenger_thread_invite_decline',
    'messenger_thread_leave', 'messenger_thread_remove', 'messenger_thread_rename',
    'messenger_thread_set_history', 'messenger_thread_set_role', 'messenger_unarchive',
    'messenger_unpin_message', 'messenger_unpin_thread', 'messenger_unreact',
    'note_lane_act', 'notification_email_view', 'notifications_dot',
    'notifications_mark_all_read', 'notifications_mark_seen', 'profile_view',
    'remove_event_party', 'respond_to_event_role', 'respond_to_request', 'save_event_blocks',
    'send_introduction', 'session_revoke', 'sessions_list', 'set_follow',
    'set_notification_preference', 'set_subscription', 'withdraw_request'
  ];
  v_allow text[] := array[
    -- the allowlist (handoff item 4)
    'onboarding_state', 'onboard_who', 'onboard_where', 'onboard_relationship', 'rate_limit_check',
    -- the signed-out corpus, callable by anon, the same answer with no session
    'email_unsubscribe', 'event_public_page', 'public_attestations', 'record_event',
    'resolve_event_link',
    -- the admin set and this file's own act, gated by private.has_platform_role at aal2 (1265)
    'admin_change_history', 'admin_dia_note_read', 'admin_dia_note_write', 'admin_grant_role',
    'admin_my_sessions', 'admin_org_settings_read', 'admin_org_settings_save',
    'admin_overview_company', 'admin_overview_levers', 'admin_overview_mobilization',
    'admin_overview_network', 'admin_overview_window', 'admin_read_log', 'admin_revoke_role',
    'admin_session_state', 'admin_staff_settings_read', 'admin_staff_settings_save',
    'admin_admit_all'
  ];
  v_name text;
  v_oid oid;
  v_n int;
  v_lang text;
  v_src text;
  v_out text;
  v_tag text;
  v_at int;
  v_gate text;
  v_missing text;
begin
  foreach v_name in array v_names loop
    select count(*), min(p.oid) into v_n, v_oid
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = v_name and p.prokind = 'f';
    if v_n <> 1 then
      raise exception 'H64-WG: public.% resolves to % functions, not one', v_name, v_n;
    end if;
    select l.lanname into v_lang from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = v_oid;
    if not (select p.prosecdef from pg_proc p where p.oid = v_oid) then
      raise exception 'H64-WG: public.% is not security definer; the row policies gate it', v_name;
    end if;
    v_src := pg_get_functiondef(v_oid);
    v_tag := substring(v_src from 'AS (\$[A-Za-z_]*\$)');
    if v_tag is null then
      raise exception 'H64-WG: no dollar-quoted body found in public.%', v_name;
    end if;
    if v_lang = 'sql' then
      -- The one-line wrappers keep their body on the tag's own line, so the gate goes right after
      -- the tag and the body's own leading whitespace follows it.
      v_gate := E'\n  select private.assert_admitted();';
      v_at := position('AS ' || v_tag in v_src) + length('AS ' || v_tag);
    elsif v_lang = 'plpgsql' then
      v_gate := '  perform private.assert_admitted();' || E'\n';
      v_at := position(E'\nbegin\n' in v_src);
      if v_at = 0 then
        raise exception 'H64-WG: no top-level begin found in public.%', v_name;
      end if;
      v_at := v_at + length(E'\nbegin\n');
    else
      raise exception 'H64-WG: public.% is written in %, which this file does not rewrite', v_name, v_lang;
    end if;
    if position('private.assert_admitted()' in v_src) > 0 then
      raise exception 'H64-WG: public.% already carries the gate', v_name;
    end if;
    v_out := substr(v_src, 1, v_at - 1) || v_gate || substr(v_src, v_at);
    execute v_out;
    select count(*) into v_n
    from regexp_matches((select p.prosrc from pg_proc p where p.oid = v_oid), 'private\.assert_admitted\(\)', 'g');
    if v_n <> 1 then
      raise exception 'H64-WG: public.% carries the gate % times after the rewrite, not once', v_name, v_n;
    end if;
  end loop;

  -- The guard: nothing the rule covers is left out.
  select string_agg(p.proname, ', ' order by p.proname) into v_missing
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.prokind = 'f'
    and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'execute')
    and not has_function_privilege('anon', p.oid, 'execute')
    and p.proname <> all (v_allow)
    and position('private.assert_admitted()' in p.prosrc) = 0;
  if v_missing is not null then
    raise exception 'H64-WG: security definer functions executable by authenticated without the gate: %', v_missing;
  end if;
end
$do$;

-- ---------------------------------------------------------------------------------------------------
-- 6. onboarding_state() answers `admitted` (handoff item 5). The live definition of 18 October 2026
--    (b5, r343, r469), byte for byte, plus the one key; `next` is unchanged.
-- ---------------------------------------------------------------------------------------------------

create or replace function public.onboarding_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  m public.members%rowtype;
  v_label text;
begin
  if v_uid is null then return null; end if;
  select * into m from public.members where id = v_uid;
  if m.id is null then return null; end if;
  select s.label into v_label from public.member_stances s where s.stance = m.stance;
  return jsonb_build_object(
    'next', case
      when m.who_completed_at is null then 'who'
      when m.current_place is null then 'where'
      when m.onboarded_at is null then 'relationship'
      else null end,
    'who', jsonb_build_object(
      'name', case when m.who_completed_at is null then '' else m.name end,
      'username', case when m.who_completed_at is null then null else m.handle end,
      'suggestion', case when m.who_completed_at is null then null else private.derive_username(m.name) end,
      'avatar_path', m.avatar_path,
      'completed', m.who_completed_at is not null),
    'where', jsonb_build_object(
      'city', m.current_place,
      'country', m.current_country,
      'completed', m.current_place is not null),
    'relationship', jsonb_build_object(
      'stance', m.stance,
      'stance_label', v_label,
      'declared', m.stance_declared_at is not null,
      'completed', m.onboarded_at is not null),
    'onboarded_at', m.onboarded_at,
    'admitted', m.admitted_at is not null);
end;
$$;

comment on function public.onboarding_state() is
  'The one read the client gate decides on (ruling 307): next names the onboarding step owed or is null, who, where and relationship carry each step''s state, onboarded_at the close, and admitted whether the caller is past the launch gate (handoff 64-WG, ruling 1854). Allowlisted for a held member. Reads auth.uid() only.';

-- ---------------------------------------------------------------------------------------------------
-- 7. The admin act (handoff item 6, Done Means 4).
-- ---------------------------------------------------------------------------------------------------

create function public.admin_admit_all(p_reason text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ids uuid[];
  v_now timestamptz := now();
  v_action_id bigint;
begin
  if not private.has_platform_role('admin') then
    raise exception 'admin_admit_all: admin at aal2 required' using errcode = '42501';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'admin_admit_all: a reason is required' using errcode = '22023';
  end if;

  select coalesce(array_agg(m.id order by m.created_at, m.id), '{}'::uuid[]) into v_ids
  from public.members m
  where m.admitted_at is null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'admin_admit_all: no member is held' using errcode = '22023';
  end if;

  update public.members set admitted_at = v_now where admitted_at is null;

  insert into public.admin_actions (actor, role_at_time, action, target_kind, target_id, reason, before, after)
  values (
    auth.uid(), 'admin', 'admission.admitted_all', 'members', null, btrim(p_reason),
    jsonb_build_object('held', array_length(v_ids, 1), 'member_ids', to_jsonb(v_ids)),
    jsonb_build_object('admitted', array_length(v_ids, 1), 'admitted_at', v_now))
  returning id into v_action_id;

  return v_action_id;
end;
$$;

revoke all on function public.admin_admit_all(text) from public, anon;
grant execute on function public.admin_admit_all(text) to authenticated;

comment on function public.admin_admit_all(text) is
  'The one write that admits every held member at once (handoff 64-WG, rulings 1854, 1855). Refuses with 42501 unless the caller is an admin at aal2 (private.has_platform_role, as admin_grant_role), and with 22023 a blank reason or a call when no member is held. Sets admitted_at on every held members row in one statement and writes its admin_actions row (admission.admitted_all, the ids before, the count and time after) in the same transaction, returning the action id. No surface calls it yet.';

-- ---------------------------------------------------------------------------------------------------
-- 8. The live arms (382): hold member-test inside a rolled-back transaction, and count the act's row.
-- ---------------------------------------------------------------------------------------------------

grant select (admitted_at), update (admitted_at) on table public.members to live_arms;

create function private.admission_actions_count(p_action text)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select count(*)::integer
  from public.admin_actions a
  where a.target_kind = 'members' and a.action = p_action;
$$;

revoke all on function private.admission_actions_count(text) from public, anon, authenticated;
grant execute on function private.admission_actions_count(text) to live_arms;

comment on function private.admission_actions_count(text) is
  'How many admin_actions rows carry the admission action named (admission.backfilled, admission.admitted_all), for the H64-WG live arm (382), as private.admin_org_actions_count counts a setting''s. Executable by live_arms only; no payload leaves it.';
