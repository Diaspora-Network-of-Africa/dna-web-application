-- Handoff 61-VT (Session 61), Fix PR 05: private.visible_to, the one member-visibility predicate.
-- Rulings 1734, 1747, 1748, 198, 459, 485, 544, 141, 186, 225, 466, 563, 564, 1114, 1227, 1139.
--
-- What this closes (the 1734 inventory finding, Moderate, invite-boundary under 140): a block
-- removed the connection and the follow both ways (198) but not a shared Space role or a shared
-- attested event, and private.admit_section carried no block term, so a blocked party who shared an
-- anchor still passed for an `anchored` section. Only private.can_see_registrant composed block and
-- audience; the eleven member_* section tables, attestations, members, the profile-media objects and
-- every projection reached audience through admit_section, admit_member, can_see_section or
-- can_see_core with no block in the question.
--
-- What ships (1734, 1747):
--
--   1. private.visible_to(p_member uuid, p_section public.profile_section default null), security
--      definer, keyed on auth.uid(), no viewer parameter. The viewer is the member: true. No section:
--      what private.admit_member(p_member, auth.uid()) answers today. A section and no block either
--      way: what private.admit_section(p_member, p_section, auth.uid()) answers today. A section and
--      a block in either direction (private.is_blocked): true only where the section's audience is
--      `everyone` and the member is not profile_private, so connections and anchored never admit a
--      blocked party, in either direction (198, D300). A null member answers false.
--
--   2. Every table policy that reached audience through can_see_core or can_see_section names
--      private.visible_to directly (alter policy ... using): members_member_select,
--      members_anon_select, the twelve member_* section-table viewer policies,
--      attestations_viewer_select, and profile_media_objects_viewer_select on storage.objects, which
--      the handoff's table did not list and this migration reports. can_see_core and can_see_section
--      stay, rewritten to answer through visible_to, so no caller this migration did not find can
--      answer differently; their names stay because dropping a function is the destructive DDL that
--      moves a migration to the SQL Editor paste path (1528), and because a name that answers
--      through the predicate is not a second predicate.
--
--   3. The projections that reached audience with auth.uid() are rewritten from their live bodies,
--      the audience calls routed through visible_to and nothing else changed: public.profile_view,
--      public.connect_cards, public.connect_where, public.send_introduction,
--      private.event_presenter_profile and private.is_visible_stance_variant. Discovery and contact
--      keep private.is_blocked, and connect_cards, connect_where and send_introduction keep
--      private.is_onboarded (459, 1748); visible_to carries no onboarding term.
--
--      Not rewritten, and why: private.connect_card and private.members_order_tier take the viewer
--      as a parameter from connect_cards, which has already excluded every blocked party under
--      is_blocked before either is called, so admit_section and visible_to answer identically
--      there; making a helper with a viewer parameter ignore it would be the wrong shape.
--      public.public_attestations is the signed-out corpus (141, 435): the anonymous rule with no
--      viewer, the same answer for every caller, and routing it through a predicate keyed on the
--      caller would change what a signed-in reader sees on a public surface. event_page and
--      event_going_names read is_connected and shares_anchor to order and label rows the policies
--      already admitted; they name no audience.
--
--      profile_view keeps v_scope for the third-party labels only (141): the party who was blocked
--      still reads attester names as the public does. Its section gates now come from visible_to,
--      which is symmetric, so B4A section 6's asymmetry (the blocker kept their own viewer, and
--      ruling 220's anchor still admitted Anchored sections to them) ends here under 1747. The
--      owner's "View as public" asks the anonymous rule directly, because visible_to is keyed on
--      auth.uid() and would answer the owner as the owner; a signed-out caller gets that same rule
--      from visible_to itself.
--
--   4. A self-check at the end, in the shape of 1010's: for every member, every section and every
--      viewer in the cast plus signed out, visible_to answers exactly what admit_section and
--      admit_member answer wherever no block exists, and the 1747 rule wherever one does. A
--      disagreement raises and the transaction does not commit.
--
-- Live bodies this file rewrites, read on the canonical project at 12:40 PDT (19:40 UTC) on
-- 13 October 2026, md5(prosrc) and length, each byte-identical to its last file in the tree except
-- connect_where, whose live body ruling 459's migration rewrote in place:
--
--   public.profile_view                2f6a641800c7807ac9e14cb1333434d7  20572  (20260912090557)
--   public.connect_cards               9c2fe3e733ac4c8b26b5d59f31e6c865  14726  (20261010120000)
--   public.connect_where               57b15121238cd17bcc441bfa573ffb66   1800  (live; the tree's
--                                      20260909160000 body is a9af652d3cd461465a22ac83bc78aeab, 1738)
--   public.send_introduction           578ab8227881dc098ab4a42256fc1bd0   2447  (20261008120300)
--   private.event_presenter_profile    b0ee8b71e71c3d93f5435f0a00f45b25   1264  (20260929120000)
--   private.is_visible_stance_variant  6d006713139e7cf1d41dcccfdd86b071    188  (20260911052909)
--   private.can_see_core               e1b44d257e16775cea094d6f0bbc855a     54  (20260909160000)
--   private.can_see_section            b080db2ab89123dc5abaa4b902169b21     66  (20260908071744)
--
-- Admin block: no new table, so no admin_catalogue row (1299). DIA block: DIA reads nothing new and
-- writes nothing; every surface DIA reasons over is scoped by this same predicate, so a blocked
-- party's anchored sections never reach a DIA explanation for them (1300).
--
-- No drop, no delete, no destructive DDL: this file reaches the project through execute_sql (963),
-- committed first (225), with its supabase_migrations.schema_migrations row in the same transaction.
-- No public signature changes, so src/lib/database.types.ts is not regenerated.

-- ------------------------------------------------------------------------------------------------
-- 1. The predicate.
-- ------------------------------------------------------------------------------------------------

create function private.visible_to(p_member uuid, p_section public.profile_section default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_member is null then false
    when auth.uid() is not null and auth.uid() = p_member then true
    when p_section is null then private.admit_member(p_member, auth.uid())
    when private.is_blocked(auth.uid(), p_member) then
      private.section_audience(p_member, p_section) = 'everyone'
      and not exists (select 1 from public.members m where m.id = p_member and m.profile_private)
    else private.admit_section(p_member, p_section, auth.uid())
  end;
$$;

comment on function private.visible_to(uuid, public.profile_section) is
  'The one member-visibility predicate (1734, 1747): may the caller, auth.uid(), see this member''s core row (no section) or this section. The member sees themselves. No section: private.admit_member. A section with no block either way: private.admit_section. A section with a block in either direction: only an everyone-scope section of a member who is not profile_private, so connections and anchored never admit a blocked party (198). No viewer parameter, no onboarding term (459, 1748): discovery and contact keep private.is_blocked and private.is_onboarded themselves.';

-- The policies below evaluate this as anon and as authenticated, the same grants can_see_core and
-- can_see_section carry (20260908071744). Never to live_arms, which reads through the policies.
revoke execute on function private.visible_to(uuid, public.profile_section) from public;
grant execute on function private.visible_to(uuid, public.profile_section) to anon, authenticated, service_role;

-- The two wrappers answer through the predicate. Every policy and projection names visible_to
-- directly from here on; these stay so that nothing this migration did not find can bypass it.
create or replace function private.can_see_core(p_member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.visible_to(p_member);
$$;

comment on function private.can_see_core(uuid) is
  'Retained name (Brief 3). Answers through private.visible_to(p_member) since handoff 61-VT (1734); no policy or projection names it any more.';

create or replace function private.can_see_section(p_member uuid, p_section public.profile_section)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.visible_to(p_member, p_section);
$$;

comment on function private.can_see_section(uuid, public.profile_section) is
  'Retained name (Brief 3). Answers through private.visible_to(p_member, p_section) since handoff 61-VT (1734); no policy or projection names it any more.';

-- The policies. Roles and commands are unchanged; only the expression moves.
alter policy members_member_select on public.members using (private.visible_to(id));
alter policy members_anon_select on public.members using (private.visible_to(id));

alter policy member_about_viewer_select on public.member_about
  using (private.visible_to(member_id, 'about'));
alter policy member_origin_viewer_select on public.member_origin
  using (private.visible_to(member_id, 'origin'));
alter policy member_intent_viewer_select on public.member_intent
  using (private.visible_to(member_id, 'intent'));
alter policy member_intents_viewer_select on public.member_intents
  using (private.visible_to(member_id, 'intent'));
alter policy member_focus_areas_viewer_select on public.member_focus_areas
  using (private.visible_to(member_id, 'work'));
alter policy member_industries_viewer_select on public.member_industries
  using (private.visible_to(member_id, 'work'));
alter policy member_regional_expertise_viewer_select on public.member_regional_expertise
  using (private.visible_to(member_id, 'work'));
alter policy member_skills_viewer_select on public.member_skills
  using (private.visible_to(member_id, 'skills'));
alter policy member_languages_viewer_select on public.member_languages
  using (private.visible_to(member_id, 'languages'));
alter policy member_links_viewer_select on public.member_links
  using (private.visible_to(member_id, 'links'));
alter policy member_interests_viewer_select on public.member_interests
  using (private.visible_to(member_id, 'stance'));
alter policy member_stance_details_viewer_select on public.member_stance_details
  using (private.visible_to(member_id, 'stance') and private.is_visible_stance_variant(member_id, stance));

alter policy attestations_viewer_select on public.attestations
  using (
    private.visible_to(member_id, 'badges')
    or private.visible_to(member_id, (c_category::text)::public.profile_section)
  );

-- The profile-media objects (20260908071744:427). The handoff's table did not list this policy; it
-- reached audience through can_see_core and is routed with the rest.
alter policy profile_media_objects_viewer_select on storage.objects
  using (
    bucket_id = 'profile-media'
    and private.visible_to(private.uuid_or_null((storage.foldername(name))[1]))
  );

-- ------------------------------------------------------------------------------------------------
-- 2. The projections and the policy helpers, each from its live body with the audience calls routed
--    through private.visible_to and nothing else changed.
-- ------------------------------------------------------------------------------------------------

create or replace function private.is_visible_stance_variant(p_member uuid, p_stance public.stance)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_member = auth.uid()
      or (private.visible_to(p_member, 'stance')
          and exists (select 1 from public.members m where m.id = p_member and m.stance = p_stance));
$$;

create or replace function private.event_presenter_profile(p_presented jsonb, p_as_public boolean)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  -- The viewer is never a parameter: it is the caller, or nobody when the public page asks. A caller
  -- can therefore see through this function only what profile_view already shows them, and asking
  -- as the public only ever shows less. Handoff 61-VT (1734, 1747): the signed-in reading is
  -- private.visible_to's, keyed on auth.uid(); the public reading is the anonymous rule, which
  -- visible_to cannot be asked for on behalf of a signed-in caller.
  with v as (select coalesce(p_as_public, true) as as_public)
  select case
    when p_presented is null or p_presented ->> 'kind' is distinct from 'member' then
      jsonb_build_object('headline', null, 'links', '[]'::jsonb)
    else coalesce((
      select jsonb_build_object(
        'headline',
          case when a.core then nullif(btrim(m.headline), '') end,
        'links',
          case when a.core and a.links then
            coalesce((
              select jsonb_agg(jsonb_build_object('kind', l.kind, 'url', l.url) order by l.kind)
              from public.member_links l
              where l.member_id = m.id and l.url ~ '^https?://'
            ), '[]'::jsonb)
          else '[]'::jsonb end
      )
      from public.members m
      cross join lateral (
        select
          case when v.as_public then private.admit_member(m.id, null) else private.visible_to(m.id) end as core,
          case when v.as_public then private.admit_section(m.id, 'links', null) else private.visible_to(m.id, 'links') end as links
      ) a
      where m.id = (p_presented ->> 'id')::uuid
    ), jsonb_build_object('headline', null, 'links', '[]'::jsonb))
  end
  from v;
$$;

create or replace function public.profile_view(p_handle text default null, p_as_public boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_viewer uuid;
  m public.members%rowtype;
  v_owner boolean;
  v_private boolean;
  v_first text;
  v_tier text;
  v_sections jsonb := '{}'::jsonb;
  v_seg_fields jsonb;
  v_variants jsonb;
  v_rel text := 'none';
  v_following boolean := false;
  v_mutuals jsonb := '[]'::jsonb;
  v_shared_spaces jsonb := '[]'::jsonb;
  v_anchored boolean := false;
  v_badges jsonb := '[]'::jsonb;
  v_dia text;
  v_vis jsonb;
  -- Ruling 187: the label for this member's stance, read from the one vocabulary table.
  v_stance_label text;
  -- Ruling 198 and B4A section 6. The two directions are separate facts and do separate work.
  -- v_blocked_by_me: the caller has blocked this member. It is the caller's own row, so it may be
  -- told to them (viewer_blocked), and it does not touch their audience scope.
  -- v_blocked_by_them: this member has blocked the caller. This is ruling 198's "blocked party",
  -- and the only case that drops a viewer to the anonymous rule.
  -- v_blocked: either direction, which is private.is_blocked. It governs discovery and contact,
  -- symmetric by ruling 198, so neither party gets a relationship object.
  v_blocked_by_me boolean := false;
  v_blocked_by_them boolean := false;
  v_blocked boolean := false;
  -- The scope the third-party labels see (141). It is v_viewer for everyone except a viewer this
  -- member has blocked, who reads the labels as a signed-out stranger does. Under 1747 the section
  -- gates no longer read it: private.visible_to carries the block itself, in both directions.
  v_scope uuid;
  -- Handoff 61-VT (1734, 1747): every section gate below answers through private.visible_to,
  -- evaluated once per section into this map. The owner's "View as public" (v_viewer null while
  -- auth.uid() is the owner) evaluates the anonymous rule directly, because visible_to is keyed on
  -- auth.uid() and would answer the owner as the owner; a signed-out caller gets the same anonymous
  -- rule from visible_to itself, so the two branches agree wherever both can be asked.
  v_admit jsonb;
  v_rows jsonb;
  v_obj jsonb;
  v_tmp text;
  -- Ruling 212: the three audiences that decide the five core-row attributes. One
  -- evaluation each, used by both the section and the member object, so the two can
  -- never disagree the way F2 found them disagreeing.
  v_see_origin boolean;
  v_see_where boolean;
  v_see_stance boolean;
begin
  if p_handle is null then
    if v_caller is null then return null; end if;
    select * into m from public.members where id = v_caller;
  else
    select * into m from public.members where handle = lower(p_handle);
  end if;
  if m.id is null then return null; end if;
  select s.label into v_stance_label from public.member_stances s where s.stance = m.stance;

  v_owner := v_caller is not null and v_caller = m.id and not coalesce(p_as_public, false);
  v_viewer := case when v_owner then v_caller when v_caller = m.id then null else v_caller end;
  -- Ruling 198: the block drops the viewer's scope; it does not hide the page. Hiding it would
  -- disclose the block (a page that opened yesterday and 404s today says exactly what happened) and
  -- be circumvented by signing out anyway. So the gate below still reads v_viewer, and a blocked
  -- member who could open this profile before can still open it, seeing what the public sees.
  -- Read directly rather than through private.is_blocked, which cannot tell the two apart. The
  -- lookup is the (blocker_id, blocked_id) primary key both ways round.
  if v_caller is not null and v_caller <> m.id then
    v_blocked_by_me := exists (
      select 1 from public.member_blocks b where b.blocker_id = v_caller and b.blocked_id = m.id);
    v_blocked_by_them := exists (
      select 1 from public.member_blocks b where b.blocker_id = m.id and b.blocked_id = v_caller);
  end if;
  v_blocked := v_blocked_by_me or v_blocked_by_them;
  -- B4A section 6 kept the blocker's own viewer for the section gates; ruling 1747 holds both
  -- parties to everyone-scope sections through private.visible_to, so v_scope now scopes only the
  -- third-party labels: the party who was blocked reads them as the public does.
  v_scope := case when v_blocked_by_them then null else v_viewer end;
  if v_viewer is null and not v_owner and not m.profile_shared then return null; end if;
  v_private := m.profile_private and not v_owner;
  -- Ruling 213: a Private member's row is the owner's and their existing connections', and nobody
  -- else's. A non-connection's handle lookup returns the same NULL an unshared profile already
  -- returns anonymously, so the two cases are indistinguishable and existence is not disclosed.
  -- The owner's own "View as public" evaluates the same rule and gets the same NULL.
  if v_private and not private.is_connected(v_caller, m.id) then return null; end if;
  v_first := split_part(m.name, ' ', 1);
  v_tier := case
    when exists (select 1 from public.attestations a where a.member_id = m.id and a.accepted_at is not null) then 'attested'
    when m.identified_at is not null then 'identified'
    else 'account' end;
  select jsonb_object_agg(
           s.section::text,
           case when v_viewer is null then private.admit_section(m.id, s.section, null)
                else private.visible_to(m.id, s.section) end)
    into v_admit
  from unnest(enum_range(null::public.profile_section)) as s(section);
  v_see_origin  := v_owner or (not v_private and (v_admit ->> 'origin')::boolean);
  v_see_where   := v_owner or (not v_private and (v_admit ->> 'where')::boolean);
  v_see_stance := v_owner or (not v_private and (v_admit ->> 'stance')::boolean);

  -- A section is admitted when the owner is looking, or when private.visible_to admits the caller
  -- (1734, 1747); "View as public" renders the anonymous rule through v_admit above.

  -- About
  if v_owner or (not v_private and (v_admit ->> 'about')::boolean) then
    select jsonb_build_object('about', a.about) into v_obj from public.member_about a where a.member_id = m.id;
    if v_owner or v_obj is not null then v_sections := v_sections || jsonb_build_object('about', coalesce(v_obj, '{}'::jsonb)); end if;
  end if;

  -- Stance: the current variant's fields; the owner also gets every variant.
  if v_see_stance then
    select jsonb_strip_nulls(jsonb_build_object(
      'timeline', d.return_timeline, 'needs', d.needs, 'base', d.base, 'offer', d.offer, 'support', d.support))
    into v_seg_fields from public.member_stance_details d where d.member_id = m.id and d.stance = m.stance;
    v_seg_fields := coalesce(v_seg_fields, '{}'::jsonb);
    if m.stance = 'exploring' then
      select coalesce(jsonb_agg(i.name order by t.position), '[]'::jsonb) into v_rows
      from public.member_interests i join public.interests t on t.name = i.name where i.member_id = m.id;
      v_seg_fields := v_seg_fields || jsonb_build_object('interests', v_rows);
    end if;
    if v_owner then
      select coalesce(jsonb_object_agg(d.stance, jsonb_strip_nulls(jsonb_build_object(
        'timeline', d.return_timeline, 'needs', d.needs, 'base', d.base, 'offer', d.offer, 'support', d.support))), '{}'::jsonb)
      into v_variants from public.member_stance_details d where d.member_id = m.id;
      select coalesce(jsonb_agg(i.name order by t.position), '[]'::jsonb) into v_rows
      from public.member_interests i join public.interests t on t.name = i.name where i.member_id = m.id;
      v_variants := v_variants || jsonb_build_object('exploring', coalesce(v_variants -> 'exploring', '{}'::jsonb) || jsonb_build_object('interests', v_rows));
      v_sections := v_sections || jsonb_build_object('stance', jsonb_build_object('stance', m.stance, 'fields', v_seg_fields, 'variants', v_variants));
    elsif m.stance is not null and (
      v_seg_fields - 'interests' <> '{}'::jsonb or jsonb_array_length(coalesce(v_seg_fields -> 'interests', '[]'::jsonb)) > 0) then
      v_sections := v_sections || jsonb_build_object('stance', jsonb_build_object('stance', m.stance, 'fields', v_seg_fields));
    end if;
  end if;

  -- Origin and heritage
  if v_see_origin then
    select jsonb_strip_nulls(jsonb_build_object('origin_country', m.origin_country, 'heritage', o.heritage, 'pathway', o.pathway))
    into v_obj from (select 1) s left join public.member_origin o on o.member_id = m.id;
    v_obj := coalesce(v_obj, jsonb_strip_nulls(jsonb_build_object('origin_country', m.origin_country)));
    if v_owner or v_obj <> '{}'::jsonb then v_sections := v_sections || jsonb_build_object('origin', v_obj); end if;
  end if;

  -- Where I am
  if v_see_where then
    v_obj := jsonb_strip_nulls(jsonb_build_object('current_place', m.current_place, 'current_country', m.current_country, 'local_tz', m.local_tz));
    if v_owner or m.current_place is not null or m.current_country is not null then v_sections := v_sections || jsonb_build_object('where', v_obj); end if;
  end if;

  -- What I work on
  if v_owner or (not v_private and (v_admit ->> 'work')::boolean) then
    v_obj := jsonb_build_object(
      'focus', (select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) from public.member_focus_areas j join public.focus_areas t on t.name = j.name where j.member_id = m.id),
      'industries', (select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) from public.member_industries j join public.industries t on t.name = j.name where j.member_id = m.id),
      'regions', (select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) from public.member_regional_expertise j join public.regional_expertise t on t.name = j.name where j.member_id = m.id));
    if v_owner or jsonb_array_length(v_obj -> 'focus') + jsonb_array_length(v_obj -> 'industries') + jsonb_array_length(v_obj -> 'regions') > 0 then
      v_sections := v_sections || jsonb_build_object('work', v_obj);
    end if;
  end if;

  -- Skills
  if v_owner or (not v_private and (v_admit ->> 'skills')::boolean) then
    select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) into v_rows
    from public.member_skills j join public.skills t on t.name = j.name where j.member_id = m.id;
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('skills', jsonb_build_object('skills', v_rows)); end if;
  end if;

  -- Languages
  if v_owner or (not v_private and (v_admit ->> 'languages')::boolean) then
    select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) into v_rows
    from public.member_languages j join public.languages t on t.name = j.name where j.member_id = m.id;
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('languages', jsonb_build_object('languages', v_rows)); end if;
  end if;

  -- What I am here for
  if v_owner or (not v_private and (v_admit ->> 'intent')::boolean) then
    select coalesce(jsonb_agg(j.name order by t.position), '[]'::jsonb) into v_rows
    from public.member_intents j join public.intents t on t.name = j.name where j.member_id = m.id;
    select n.note into v_tmp from public.member_intent n where n.member_id = m.id;
    v_obj := jsonb_strip_nulls(jsonb_build_object('intent', v_rows, 'note', v_tmp));
    if v_owner or jsonb_array_length(v_rows) > 0 or v_tmp is not null then v_sections := v_sections || jsonb_build_object('intent', v_obj); end if;
  end if;

  -- Links
  if v_owner or (not v_private and (v_admit ->> 'links')::boolean) then
    select coalesce(jsonb_object_agg(l.kind, l.url), '{}'::jsonb) into v_obj from public.member_links l where l.member_id = m.id;
    if v_owner or v_obj <> '{}'::jsonb then v_sections := v_sections || jsonb_build_object('links', v_obj); end if;
  end if;

  -- Activity (ruling 125): grounded-or-empty, projections over attestations, space_roles, stories.
  if v_owner or (not v_private and (v_admit ->> 'convene')::boolean) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', e.title,
      'sub', 'Attested by ' || private.third_party_label(am.id, a.attester_role, v_scope is null)
        || case when v_scope is not null or private.named_publicly(am.id) then ', ' || a.attester_role else '' end,
      'when', a.attested_at) order by a.attested_at desc), '[]'::jsonb)
    into v_rows from public.attestations a
    join public.events e on e.id = a.object_id and a.object_kind = 'event'
    join public.members am on am.id = a.attester_member_id
    where a.member_id = m.id and a.c_category = 'convene' and a.accepted_at is not null;
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('convene', v_rows); end if;
  end if;
  if v_owner or (not v_private and (v_admit ->> 'collaborate')::boolean) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', s.title,
      'sub', (case r.role when 'lead' then 'Lead' else 'Member' end) || ' since ' || to_char(r.created_at, 'Mon YYYY'),
      'completed', s.status = 'completed', 'when', r.created_at) order by r.created_at desc), '[]'::jsonb)
    into v_rows from public.space_roles r join public.spaces s on s.id = r.space_id
    where r.member_id = m.id and r.status = 'active';
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('collaborate', v_rows); end if;
  end if;
  if v_owner or (not v_private and (v_admit ->> 'contribute')::boolean) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'title', o.title, 'sub', 'Fulfilled a Need from ' || private.third_party_label(am.id, a.attester_role, v_scope is null), 'when', a.attested_at) order by a.attested_at desc), '[]'::jsonb)
    into v_rows from public.attestations a
    join public.opportunities o on o.id = a.object_id and a.object_kind = 'opportunity'
    join public.members am on am.id = a.attester_member_id
    where a.member_id = m.id and a.c_category = 'contribute' and a.accepted_at is not null;
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('contribute', v_rows); end if;
  end if;
  if v_owner or (not v_private and (v_admit ->> 'convey')::boolean) then
    select coalesce(jsonb_agg(jsonb_build_object('title', s.title, 'sub', 'Story', 'when', s.created_at, 'post_id', p.id) order by s.created_at desc), '[]'::jsonb)
    into v_rows from public.stories s
    left join public.posts p on p.created_object_kind = 'story' and p.created_object_id = s.id and p.status = 'published'
    where s.author_member_id = m.id;
    if v_owner or jsonb_array_length(v_rows) > 0 then v_sections := v_sections || jsonb_build_object('convey', v_rows); end if;
  end if;

  -- Badges (ruling 123): one per attested context, in order Convene, Collaborate, Contribute.
  if v_owner or (not v_private and (v_admit ->> 'badges')::boolean) then
    select coalesce(jsonb_agg(jsonb_build_object('c', g.c, 'items', g.items) order by g.ord), '[]'::jsonb) into v_badges
    from (
      select a.c_category as c,
        case a.c_category when 'convene' then 1 when 'collaborate' then 2 else 3 end as ord,
        jsonb_agg(jsonb_build_object(
          'object', coalesce(e.title, s.title, o.title, 'Attested'),
          'attester', private.third_party_label(am.id, a.attester_role, v_scope is null),
          'role', case when v_scope is not null or private.named_publicly(am.id) then a.attester_role end,
          'when', a.attested_at) order by a.attested_at desc) as items
      from public.attestations a
      join public.members am on am.id = a.attester_member_id
      left join public.events e on a.object_kind = 'event' and e.id = a.object_id
      left join public.spaces s on a.object_kind = 'space' and s.id = a.object_id
      left join public.opportunities o on a.object_kind = 'opportunity' and o.id = a.object_id
      where a.member_id = m.id and a.accepted_at is not null
      group by a.c_category
    ) g;
  end if;

  -- Relationship, mutuals and shared Spaces: a signed-in visitor only (rulings 118 to 120, 136).
  -- The blocked party gets none of it (ruling 198): no mutual name, no shared Space, no anchored
  -- qualification and no DIA line, which is B4A section 7's "does not render" list. The blocker
  -- keeps all of it (B4A section 7, Done Means 5): a block does not remove them for the blocker.
  -- The relationship object itself is withheld from both, on v_blocked below, so neither party is
  -- offered a Connect action or a Follow, and it is absent rather than 'none' so the surface
  -- renders no action at all.
  if v_viewer is not null and not v_owner and not v_blocked_by_them then
    -- Brief 4 (rulings 157, 168, 214): one relationship rule for every surface, and the window
    -- reaches no surface as itself. private.relationship_display maps it to sent.
    v_rel := private.relationship_display(v_viewer, m.id);
    v_following := exists (select 1 from public.member_follows f where f.follower_id = v_viewer and f.member_id = m.id);
    v_anchored := private.shares_anchor(v_viewer, m.id);
    if not v_private then
      -- Up to three connections in common, as names (never a count).
      with mine as (
        select c.other_id as other from public.member_connections c
        where c.member_id = v_viewer and not private.is_blocked(v_viewer, c.other_id)
      ), theirs as (
        select c.other_id as other from public.member_connections c where c.member_id = m.id
      )
      select coalesce(jsonb_agg(jsonb_build_object('name', mm.name, 'handle', mm.handle, 'avatar_path', mm.avatar_path) order by mm.name), '[]'::jsonb)
      into v_mutuals
      from (select other from mine intersect select other from theirs limit 3) x
      join public.members mm on mm.id = x.other;
      select coalesce(jsonb_agg(s.title order by s.title), '[]'::jsonb) into v_shared_spaces
      from public.space_roles ra join public.space_roles rb on rb.space_id = ra.space_id
      join public.spaces s on s.id = ra.space_id
      where ra.member_id = v_viewer and rb.member_id = m.id and ra.status = 'active' and rb.status = 'active';
      -- DIA's line (ruling 125): only with a real reason, in words.
      select 'Fulfilled a Need in the Space you lead.' into v_dia
      from public.attestations a join public.opportunities o on o.id = a.object_id and a.object_kind = 'opportunity'
      where a.member_id = m.id and a.c_category = 'contribute' and a.accepted_at is not null and o.space_id is not null
        and exists (select 1 from public.space_roles r where r.space_id = o.space_id and r.member_id = v_viewer and r.role = 'lead' and r.status = 'active')
      order by a.attested_at desc limit 1;
      if v_dia is not null then
        v_dia := v_first || ' fulfilled a Need in the Space you lead.';
      else
        select v_first || ' was at ' || e.title || ', which you hosted.' into v_dia
        from public.attestations a join public.events e on e.id = a.object_id and a.object_kind = 'event'
        where a.member_id = m.id and e.host_member_id = v_viewer and a.accepted_at is not null
        order by a.attested_at desc limit 1;
      end if;
    end if;
  end if;

  -- The owner's audience settings, every section with its default.
  if v_owner then
    select jsonb_object_agg(s.section, private.section_audience(m.id, s.section)) into v_vis
    from unnest(enum_range(null::public.profile_section)) as s(section);
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'viewer', case when v_owner then 'owner' when v_viewer is null then 'anon' else 'member' end,
    -- Ruling 212 (F2a, F2b): the five section-gated attributes are admitted or omitted by the same
    -- predicate the sections use, with the explicit viewer already in scope, anonymous callers
    -- included. Omit, never blank: a withheld attribute produces no key at all.
    'member', jsonb_strip_nulls(jsonb_build_object(
      'id', m.id, 'handle', m.handle, 'name', m.name, 'headline', m.headline,
      'avatar_path', m.avatar_path, 'cover_path', m.cover_path, 'cover_focus', m.cover_focus,
      'origin_country', case when v_see_origin then m.origin_country end,
      'current_place', case when v_see_where then m.current_place end,
      'current_country', case when v_see_where then m.current_country end,
      'local_tz', case when v_see_where then m.local_tz end,
      'stance', case when v_see_stance then m.stance end,
      'stance_label', case when v_see_stance then v_stance_label end,
      'pattern', m.pattern, 'tier', v_tier)),
    'switches', case when v_owner then jsonb_build_object('private', m.profile_private, 'shared', m.profile_shared) end,
    'private', v_private,
    'sections', v_sections,
    'badges', v_badges,
    'visibility', v_vis,
    'relationship', case when v_viewer is not null and not v_owner and not v_blocked
                         then jsonb_build_object('state', v_rel, 'following', v_following) end,
    -- B4A section 4: the overflow reads Block or Unblock from the caller's own block, and nothing
    -- in this payload says whether this member has blocked the caller.
    'viewer_blocked', v_blocked_by_me,
    'mutuals', v_mutuals,
    'shared_spaces', v_shared_spaces,
    'anchored', v_anchored,
    'dia_line', v_dia
  ));
end;
$$;

create or replace function public.connect_cards(p_lens text, p_filters jsonb default '{}'::jsonb, p_cursor text default null::text, p_limit integer default 20)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 40);
  v_cur_name text;
  v_cur_id uuid;
  v_next text;
  v_items jsonb := '[]'::jsonb;
  v_requests jsonb := '[]'::jsonb;
  v_sent jsonb := '[]'::jsonb;
  v_connections jsonb := '[]'::jsonb;
  v_following jsonb := '[]'::jsonb;
  v_matched text[];
  v_window interval := make_interval(days => private.setting_int('decline_window_days', 90));
  v_n integer := 0;
  v_card jsonb;
  r record;
begin
  if v_uid is null then return null; end if;

  if p_lens = 'members' then
    -- Ruling 1483 (Fix PR 10): the Members order is a request waiting on the viewer, then anchored,
    -- then second degree, then a shared corridor or an attribute overlap, then name. The tier is
    -- private.members_order_tier, computed inline for every admitted member and never shown; the
    -- page is ordered by (tier, name, id) and the cursor is {tier}|{name}|{id}. The client treats
    -- the cursor as opaque (src/lib/connect.ts); one that does not parse in this form starts from
    -- the first page rather than raising. Filters narrow and never reorder: the filter block below
    -- is the one the branch carried before this ruling, moved into the candidate set unchanged.
    -- The cursor is the last emitted row's key (W94): the row fetched at limit + 1 is the next
    -- page's first row, and a cursor taken from it skipped that member at every boundary.
    declare
      v_cur_tier smallint;
      v_last_tier smallint;
      v_last_name text;
      v_last_id uuid;
    begin
      if p_cursor ~ '^[0-4]\|.+\|[0-9a-fA-F-]{36}$' then
        v_cur_tier := left(p_cursor, 1)::smallint;
        v_cur_id := private.uuid_or_null(right(p_cursor, 36));
        v_cur_name := substr(p_cursor, 3, length(p_cursor) - 39);
      end if;
      v_matched := array_remove(array[f ->> 'focus', f ->> 'industry', f ->> 'skill', f ->> 'region'], null);
      for r in
        -- Materialized so the tier is computed once per candidate, for the keyset and the order alike.
        with cand as materialized (
          select m.id, m.name, private.members_order_tier(v_uid, m.id) as tier
          from public.members m
          where m.id <> v_uid
            and not private.is_blocked(v_uid, m.id)
            -- Ruling 213: a Private member is not in Members for anyone but an existing connection.
            and private.visible_to(m.id) and private.is_onboarded(m.id)
            -- Ruling 212 (F5): every axis over a section-gated attribute checks the audience first, or
            -- the filter is a searchable index over what the member withheld. stance, location and
            -- origin join heritage, pathway, focus, industry, skill and region, which already did.
            and (f ->> 'stance' is null or (private.visible_to(m.id, 'stance') and m.stance::text = f ->> 'stance'))
            and (f ->> 'location' is null or (private.visible_to(m.id, 'where') and m.current_country = f ->> 'location'))
            and (f ->> 'origin' is null or (private.visible_to(m.id, 'origin') and m.origin_country = f ->> 'origin'))
            and (f ->> 'heritage' is null or (private.visible_to(m.id, 'origin') and exists (
              select 1 from public.member_origin o where o.member_id = m.id and o.heritage::text = f ->> 'heritage')))
            and (f ->> 'pathway' is null or (private.visible_to(m.id, 'origin') and exists (
              select 1 from public.member_origin o where o.member_id = m.id and o.pathway::text = f ->> 'pathway')))
            and (f ->> 'corridor' is null or exists (
              select 1 from public.member_corridors mc join public.corridors c on c.id = mc.corridor_id
              where mc.member_id = m.id and mc.corridor_id = f ->> 'corridor' and c.status = 'active'))
            and (f ->> 'focus' is null or (private.visible_to(m.id, 'work') and exists (
              select 1 from public.member_focus_areas j where j.member_id = m.id and j.name = f ->> 'focus')))
            and (f ->> 'industry' is null or (private.visible_to(m.id, 'work') and exists (
              select 1 from public.member_industries j where j.member_id = m.id and j.name = f ->> 'industry')))
            and (f ->> 'skill' is null or (private.visible_to(m.id, 'skills') and exists (
              select 1 from public.member_skills j where j.member_id = m.id and j.name = f ->> 'skill')))
            and (f ->> 'region' is null or (private.visible_to(m.id, 'work') and exists (
              select 1 from public.member_regional_expertise j where j.member_id = m.id and j.name = f ->> 'region')))
        )
        select c.id, c.name, c.tier
        from cand c
        where v_cur_id is null or (c.tier, c.name, c.id) > (v_cur_tier, v_cur_name, v_cur_id)
        order by c.tier, c.name, c.id
        limit v_limit + 1
      loop
        v_n := v_n + 1;
        if v_n > v_limit then
          -- W94 (Fix PR 10): this row, fetched at limit + 1, is the next page's first row, so the
          -- cursor is the key of the last row this page consumed, never this row's own key.
          v_next := v_last_tier::text || '|' || v_last_name || '|' || v_last_id::text;
          exit;
        end if;
        v_last_tier := r.tier;
        v_last_name := r.name;
        v_last_id := r.id;
        v_card := private.connect_card(v_uid, r.id, 'members', v_matched);
        if v_card is not null then v_items := v_items || v_card; end if;
      end loop;
      return jsonb_build_object('items', v_items, 'next_cursor', v_next);
    end;

  elsif p_lens = 'suggested' then
    for r in
      with cand as (
        select m.id, m.name,
          (select coalesce(jsonb_agg(distinct e.title), '[]'::jsonb)
             from public.attestations xa
             join public.attestations xb on xb.object_kind = 'event' and xb.object_id = xa.object_id
             join public.events e on e.id = xa.object_id
             where xa.object_kind = 'event'
               and xa.accepted_at is not null and xb.accepted_at is not null
               and v_uid in (xa.member_id, xa.attester_member_id)
               and m.id in (xb.member_id, xb.attester_member_id)) as events,
          (select coalesce(jsonb_agg(distinct s.title), '[]'::jsonb)
             from public.space_roles ra
             join public.space_roles rb on rb.space_id = ra.space_id
             join public.spaces s on s.id = ra.space_id
             where ra.member_id = v_uid and rb.member_id = m.id
               and ra.status = 'active' and rb.status = 'active') as spaces,
          (select coalesce(jsonb_agg(distinct (c.diaspora_place || ' to ' || c.continental_place)), '[]'::jsonb)
             from public.member_corridors a
             join public.member_corridors b on b.corridor_id = a.corridor_id
             join public.corridors c on c.id = a.corridor_id
             where a.member_id = v_uid and b.member_id = m.id and c.status = 'active') as corridors,
          case when private.visible_to(m.id, 'work') then
            (select coalesce(jsonb_agg(a.name order by t.position), '[]'::jsonb)
               from public.member_focus_areas a join public.member_focus_areas b on b.name = a.name
               join public.focus_areas t on t.name = a.name
               where a.member_id = v_uid and b.member_id = m.id) else '[]'::jsonb end as focus,
          case when private.visible_to(m.id, 'work') then
            (select coalesce(jsonb_agg(a.name order by t.position), '[]'::jsonb)
               from public.member_industries a join public.member_industries b on b.name = a.name
               join public.industries t on t.name = a.name
               where a.member_id = v_uid and b.member_id = m.id) else '[]'::jsonb end as industries,
          case when private.visible_to(m.id, 'work') then
            (select coalesce(jsonb_agg(a.name order by t.position), '[]'::jsonb)
               from public.member_regional_expertise a join public.member_regional_expertise b on b.name = a.name
               join public.regional_expertise t on t.name = a.name
               where a.member_id = v_uid and b.member_id = m.id) else '[]'::jsonb end as regions,
          case when private.visible_to(m.id, 'skills') then
            (select coalesce(jsonb_agg(a.name order by t.position), '[]'::jsonb)
               from public.member_skills a join public.member_skills b on b.name = a.name
               join public.skills t on t.name = a.name
               where a.member_id = v_uid and b.member_id = m.id) else '[]'::jsonb end as skills,
          case when private.visible_to(m.id, 'languages') then
            (select coalesce(jsonb_agg(a.name order by t.position), '[]'::jsonb)
               from public.member_languages a join public.member_languages b on b.name = a.name
               join public.languages t on t.name = a.name
               where a.member_id = v_uid and b.member_id = m.id) else '[]'::jsonb end as languages,
          (select coalesce(jsonb_agg(x.name order by x.name), '[]'::jsonb)
             from (
               select mm.name
               from public.member_connections c1
               join public.member_connections c2 on c2.member_id = m.id and c2.other_id = c1.other_id
               join public.members mm on mm.id = c1.other_id
               where c1.member_id = v_uid and not private.is_blocked(v_uid, c1.other_id)
               order by mm.name limit 3
             ) x) as mutuals,
          exists (select 1 from public.second_degree s where s.member_id = v_uid and s.fof_id = m.id) as fof
        from public.members m
        where m.id <> v_uid
          and not private.is_blocked(v_uid, m.id)
          -- Ruling 213: and not a Private member the viewer is not already connected to.
          and private.visible_to(m.id) and private.is_onboarded(m.id)
          and not exists (select 1 from public.dismissed_suggestions d where d.member_id = v_uid and d.dismissed_id = m.id)
          -- Ruling 229: Suggested reads the outward state, not the raw one. A withdrawn request
          -- inside the window reads sent everywhere else, so a candidate reappearing here would be
          -- the probe the ruling closes: present means it was pending, absent means it was declined.
          and private.relationship_display(v_uid, m.id) = 'none'
      ),
      scored as (
        select c.*,
          (jsonb_array_length(c.events) > 0)::integer
          + (jsonb_array_length(c.spaces) > 0)::integer
          + (jsonb_array_length(c.corridors) > 0)::integer
          + (jsonb_array_length(c.focus) + jsonb_array_length(c.industries) + jsonb_array_length(c.regions)
             + jsonb_array_length(c.skills) + jsonb_array_length(c.languages) > 0)::integer
          + (c.fof and jsonb_array_length(c.mutuals) > 0)::integer as hits
        from cand c
      )
      select * from scored s
      where s.hits > 0
      order by s.hits desc, s.name, s.id
      limit v_limit
    loop
      v_card := private.connect_card(v_uid, r.id, 'suggested', '{}');
      if v_card is null then continue; end if;
      v_items := v_items || (v_card || jsonb_build_object('facts', jsonb_strip_nulls(jsonb_build_object(
        'events', nullif(r.events, '[]'::jsonb),
        'spaces', nullif(r.spaces, '[]'::jsonb),
        'corridors', nullif(r.corridors, '[]'::jsonb),
        'overlap', nullif(jsonb_strip_nulls(jsonb_build_object(
          'focus', nullif(r.focus, '[]'::jsonb),
          'industries', nullif(r.industries, '[]'::jsonb),
          'regions', nullif(r.regions, '[]'::jsonb),
          'skills', nullif(r.skills, '[]'::jsonb),
          'languages', nullif(r.languages, '[]'::jsonb))), '{}'::jsonb),
        'mutuals', case when r.fof then nullif(r.mutuals, '[]'::jsonb) end
      ))));
    end loop;
    return jsonb_build_object('items', v_items);

  elsif p_lens = 'network' then
    for r in
      select c.id, c.from_member_id, c.message, c.created_at
      from public.connection_requests c
      where c.to_member_id = v_uid and c.status = 'pending' and not private.is_blocked(v_uid, c.from_member_id)
      order by c.created_at desc
    loop
      v_card := private.connect_card(v_uid, r.from_member_id, 'requests', '{}');
      -- Rulings 1449 and 1530 (handoff 44-MC-R3): the request's arrival travels raw as since; the app's
      -- lib formats it, never the part and never this projection.
      if v_card is not null then
        v_requests := v_requests || (v_card || jsonb_build_object('message', r.message, 'since', r.created_at));
      end if;
    end loop;
    for r in
      select distinct on (c.to_member_id) c.to_member_id
      from public.connection_requests c
      where c.from_member_id = v_uid and c.to_member_id is not null
        and not private.is_blocked(v_uid, c.to_member_id)
        -- Ruling 229: a withdrawn request keeps its Sent row for the rest of the window, for the
        -- same reason. Without it, withdrawing and watching the row vanish separates a pending
        -- request from one inside the window in a single click.
        and (c.status = 'pending'
          or (c.status in ('declined', 'withdrawn') and c.responded_at > now() - v_window))
      order by c.to_member_id, c.created_at desc
    loop
      v_card := private.connect_card(v_uid, r.to_member_id, 'sent', '{}');
      -- Pending until the window elapses (ruling 157): the projection never says declined.
      if v_card is not null then v_sent := v_sent || (v_card || jsonb_build_object('rel', 'sent')); end if;
    end loop;
    for r in
      select c.other_id from public.member_connections c
      where c.member_id = v_uid and not private.is_blocked(v_uid, c.other_id)
      order by c.created_at desc, c.other_id
    loop
      v_card := private.connect_card(v_uid, r.other_id, 'connections', '{}');
      if v_card is not null then v_connections := v_connections || v_card; end if;
    end loop;
    for r in
      select e.to_id from public.edges e
      where e.from_id = v_uid and e.edge_type = 'follow' and e.revoked_at is null
        and not private.is_blocked(v_uid, e.to_id)
      order by e.created_at desc, e.to_id
    loop
      v_card := private.connect_card(v_uid, r.to_id, 'following', '{}');
      if v_card is not null then v_following := v_following || v_card; end if;
    end loop;
    return jsonb_build_object('requests', v_requests, 'sent', v_sent, 'connections', v_connections, 'following', v_following);
  end if;

  raise exception 'connect_cards: unknown lens %', p_lens using errcode = '22023';
end;
$$;

create or replace function public.connect_where()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_floor integer := private.setting_int('where_floor', 5);
  v_out jsonb;
begin
  if v_uid is null then return null; end if;
  select jsonb_build_object(
    'continent', coalesce((select jsonb_agg(c.name order by c.name) from (
       select m.current_country as name from public.members m
       where m.current_country is not null and not private.is_blocked(v_uid, m.id)
         -- Ruling 213: a Private member is not counted for a non-connection. Ruling 212: a member
         -- who withheld Where is not counted at all, so no tile is built from a hidden attribute
         -- and no tile leads to a Members filter that then returns nobody.
         and private.visible_to(m.id) and private.is_onboarded(m.id)
         and private.visible_to(m.id, 'where')
       group by m.current_country having count(*) >= v_floor) c
       where exists (select 1 from public.countries k where k.name = c.name)), '[]'::jsonb),
    'diaspora', coalesce((select jsonb_agg(c.name order by c.name) from (
       select m.current_country as name from public.members m
       where m.current_country is not null and not private.is_blocked(v_uid, m.id)
         -- Ruling 213: a Private member is not counted for a non-connection. Ruling 212: a member
         -- who withheld Where is not counted at all, so no tile is built from a hidden attribute
         -- and no tile leads to a Members filter that then returns nobody.
         and private.visible_to(m.id) and private.is_onboarded(m.id)
         and private.visible_to(m.id, 'where')
       group by m.current_country having count(*) >= v_floor) c
       where not exists (select 1 from public.countries k where k.name = c.name)), '[]'::jsonb))
  into v_out;
  return v_out;
end;
$$;

create or replace function public.send_introduction(p_recipient uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_message, ''));
  v_name text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'send_introduction: not signed in' using errcode = '42501'; end if;
  if p_recipient is null or p_recipient = v_uid then
    raise exception 'send_introduction: recipient required' using errcode = '22023';
  end if;
  -- Ruling 401 (under 417): the message is one short optional note. The profile's Connect entry
  -- sends none; Connect's own sheet still asks for one on the client. The cap stands.
  if length(v_msg) > 300 then
    raise exception 'An introduction needs a message of up to 300 characters.' using errcode = '22023';
  end if;
  -- Ruling 442 (F23): a ceiling per member on introductions, in words, never a number to the client.
  if not private.rate_limit(v_uid, 'send_introduction', interval '1 hour', 20) then
    raise exception 'Too many introductions for now. Try again later.' using errcode = 'P0001';
  end if;
  select m.name into v_name from public.members m where m.id = p_recipient;
  if v_name is null then raise exception 'send_introduction: not available' using errcode = '42501'; end if;
  -- Ruling 213: a Private member who is not already a connection has no card to send from, so an
  -- introduction to them is refused. It joins the block and the window in the one refusal every
  -- other condition already shares, so the caller cannot work out which condition fired.
  -- Ruling 229: the gate reads the outward state too. A sender who withdrew inside the window gave
  -- up their turn, so a re-send is refused with the same one message, and the write path cannot be
  -- used as an oracle for a state the surfaces have made identical.
  if private.is_blocked(v_uid, p_recipient)
     or not private.visible_to(p_recipient)
     or not private.is_onboarded(p_recipient)
     or private.relationship_display(v_uid, p_recipient) <> 'none' then
    raise exception 'send_introduction: not available' using errcode = '42501';
  end if;
  insert into public.connection_requests (from_member_id, to_member_id, to_name, why, message, status)
  values (v_uid, p_recipient, v_name, nullif(v_msg, ''), v_msg, 'pending')
  returning id into v_id;
  -- 461, N1: the recipient hears of the request, in this transaction (1319).
  perform private.notify(p_recipient, 'connection_request', 'member', v_uid, 'connection_request', v_id);
  return v_id;
end;
$$;

-- ------------------------------------------------------------------------------------------------
-- 3. The self-check (in 1010's shape). auth.uid() reads request.jwt.claims, so each viewer is set
--    transaction-locally the way PostgREST sets it, and the setting is restored at the end. For
--    every member and every section, against every member as viewer and against signed out:
--      no block either way  ->  visible_to = admit_section (section) and admit_member (core);
--      a block either way   ->  the core answer is admit_member's, and a section is admitted only
--                               where its audience is everyone and the member is not private.
--    Any disagreement raises, and the transaction that carries this file does not commit.
-- ------------------------------------------------------------------------------------------------

do $$
declare
  v_prev text := current_setting('request.jwt.claims', true);
  v_viewer uuid;
  v_member record;
  v_section public.profile_section;
  v_expected boolean;
  v_got boolean;
  v_checked bigint := 0;
  v_blocked_pairs bigint := 0;
  v_diff bigint := 0;
  v_first text;
begin
  for v_viewer in
    select v.id from public.members v union all select null::uuid
  loop
    perform set_config('request.jwt.claims',
      case when v_viewer is null then '' else json_build_object('sub', v_viewer, 'role', 'authenticated')::text end,
      true);
    for v_member in select m.id, m.profile_private from public.members m loop
      -- The core row.
      v_expected := case
        when v_viewer is not null and v_viewer = v_member.id then true
        else private.admit_member(v_member.id, v_viewer) end;
      v_got := private.visible_to(v_member.id);
      v_checked := v_checked + 1;
      if v_got is distinct from v_expected then
        v_diff := v_diff + 1;
        v_first := coalesce(v_first, format('core: member %s viewer %s expected %s got %s', v_member.id, v_viewer, v_expected, v_got));
      end if;
      if v_viewer is not null and v_viewer <> v_member.id and private.is_blocked(v_viewer, v_member.id) then
        v_blocked_pairs := v_blocked_pairs + 1;
      end if;
      -- Every section.
      for v_section in select unnest(enum_range(null::public.profile_section)) loop
        v_expected := case
          when v_viewer is not null and v_viewer = v_member.id then true
          when v_viewer is not null and private.is_blocked(v_viewer, v_member.id) then
            private.section_audience(v_member.id, v_section) = 'everyone' and not v_member.profile_private
          else private.admit_section(v_member.id, v_section, v_viewer) end;
        v_got := private.visible_to(v_member.id, v_section);
        v_checked := v_checked + 1;
        if v_got is distinct from v_expected then
          v_diff := v_diff + 1;
          v_first := coalesce(v_first, format('section %s: member %s viewer %s expected %s got %s', v_section, v_member.id, v_viewer, v_expected, v_got));
        end if;
      end loop;
    end loop;
  end loop;
  perform set_config('request.jwt.claims', coalesce(v_prev, ''), true);
  if v_diff > 0 then
    raise exception 'Handoff 61-VT: private.visible_to disagrees on % of % answers (first: %).', v_diff, v_checked, v_first
      using errcode = 'P0001';
  end if;
  raise notice 'Handoff 61-VT: private.visible_to agrees on all % answers; % blocked member-viewer pairs in the cast.', v_checked, v_blocked_pairs;
end;
$$;
