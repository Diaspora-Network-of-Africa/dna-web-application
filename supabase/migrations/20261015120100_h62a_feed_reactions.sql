-- Handoff 62-A (Session 62), file 2 of 2: the Feed card's reaction layer. Rulings 1796 to 1826, above
-- all 1797 (no number to a reader), 1798 and 1818 (the six and their emoji), 1799, 1808, 1811, 1813,
-- 1820 to 1823 (the summary, the sheets, no mark on a photo), 1802 and 1817 (intent notifications),
-- 1821 (the recents), 1826 (the 36 rows carry over as Asante); with 141, 198, 1116, 1299, 1300, 1316,
-- 1319, 1325, 1528, 1734, 225, 466, 564, 963.
--
-- What ships:
--
--   1. public.post_reaction_kinds     the six as a vocabulary: asante, celebrate, learned, standing
--                                     (class public), help, build (class intent); each row's emoji is
--                                     a message_reaction_emoji character (1818), its label the
--                                     extraction's Q.* string verbatim, its position the bar's order.
--                                     Served by vocabularies() as post_reaction_kinds, each row with
--                                     its glosses. No component holds the six as literals (194).
--   2. public.post_reaction_glosses   Asante's gloss per language, read at runtime (1819): en, fr, pt.
--                                     Swahili is deliberately absent, because Asante is the word and
--                                     the name reads Asante alone; ar, am, ha and yo are absent rows
--                                     held for a translation, never placeholders.
--   3. public.post_reactions          gains kind (asante, celebrate, learned, standing or other) and
--                                     emoji (set only for other; a message_reaction_emoji character).
--                                     One row per member per post stays the key; the 36 existing rows
--                                     become asante (1826). The member's direct insert and delete go:
--                                     post_react is the one write path (415's shape).
--   4. public.post_intents            I can help and Let's build, one row per member, post and kind,
--                                     with an optional line of 1 to 240 characters. Read by the member
--                                     and by the post's author through post_reactors_author alone.
--   5. public.member_reaction_picks   the characters the member chose from the full picker, for the
--                                     bar's recents (1821).
--   6. Functions, every one on auth.uid(), none taking the viewer as a parameter:
--        public.post_react             set, change or remove the one public reaction
--        public.post_intent            turn an intent on or off; on notifies the author
--        public.post_reaction_rows     the summary for a page of posts, no figure
--        public.post_reactors_visible  the reader's sheet, names by privacy, never an intent
--        public.post_reactors_author   the author's sheet, exact figures, roles for withheld names
--        public.member_recent_reactions  the five most recent picker emoji, newest first
--      Each public function is security invoker and reads public.posts under the caller's own
--      policies, so the posts row policy decides which post answers (and only a published one), then
--      calls a private security definer helper, granted to authenticated as private.member_display
--      is (20260921160100), that does the row work for auth.uid(). Every name a helper returns is
--      admitted by private.visible_to, the one member-visibility predicate (1734; the handoff names
--      private.can_see_core, which has answered through visible_to since 20261013150000 and which
--      tests/visibility-conformance.cjs refuses outside the predicate), and filtered by
--      private.is_blocked in both directions (186).
--   7. Two notification kinds, intent_help and intent_build (1802, 1817): C from the object, the post
--      (private.notification_c_for gains the post branch), grouping on inside a window of 7 days,
--      destination "Opens Who reacted", email off. A public reaction notifies no one (1316).
--   8. Every new table catalogued for DIA (1300) with explicit RLS and the absent personas named.
--
-- Readings taken here and named in the PR:
--   The post's author, for the intent's recipient and the author's sheet, is private.post_author:
--     author_id for a member post, created_by (the role holder who pressed Publish) for a Space post.
--   An intent turned off leaves the author's notification standing: the row is grouped and may name
--     other members, and the author's sheet is the truth; private.notification_retract would take
--     the whole row.
--   A reaction of kind other stores the base character the vocabulary holds: a skin tone modifier
--     the picker sends is read off as private.message_react reads it, and the base is kept, because
--     emoji is a foreign key to message_reaction_emoji as the handoff asks. The Messenger keeps the
--     tone; the Feed does not. Recorded as a gap in the PR.
--   The recents are a table of the member's picker picks, not a derivation from post_reactions:
--     1821 says picking from the strip does not reorder, and a derivation from the reaction rows
--     would reorder on every strip pick and forget a pick the moment the reaction changed. The
--     Messenger's half (1405) joins in from message_reactions, read to its base character.
--   A blocked pair is absent from every list, the author's included (the handoff's "neither name
--     either way"): private.notify never wrote across the block, and a reaction that predates the
--     block adds a glyph to the summary and nothing else.
--
-- This file carries a delete inside two function bodies (post_react's remove and post_intent's off),
-- which the execute_sql guard refuses even inside a quoted string (1528), so it reaches the project by
-- the founder's SQL Editor paste of a script Chat generates and rehearses, recording this version in the
-- same transaction. Since the file goes by paste, the two member write policies post_reactions no longer
-- needs are dropped rather than left inert. Committed before it is applied (225). It names the anchor
-- value 'post' only inside plpgsql bodies and a notification_kinds row, evaluated when called, never in
-- the transaction that added it (20261015120000).
--
-- Admin block (1299): post_reaction_kinds and post_reaction_glosses are operated vocabularies;
-- post_intents and member_reaction_picks are exempt, a member's own rows that no console shows.
-- DIA block (1300): the kinds and glosses are excluded (vocabularies); post_intents is member_side,
-- kind, parties and age as structure for 1802's day-later follow-up (H62-E), never the line;
-- member_reaction_picks is excluded.

-- ---------------------------------------------------------------------------------------------------
-- 1. The six (1798, 1818) and Asante's glosses (1819).
-- ---------------------------------------------------------------------------------------------------

create table public.post_reaction_kinds (
  kind text primary key,
  class text not null check (class in ('public', 'intent')),
  emoji text not null unique references public.message_reaction_emoji (emoji),
  label text not null,
  position integer not null unique
);

alter table public.post_reaction_kinds enable row level security;
revoke all on table public.post_reaction_kinds from public, anon, authenticated;
grant select on table public.post_reaction_kinds to authenticated;
grant all on table public.post_reaction_kinds to service_role;
create policy post_reaction_kinds_member_select on public.post_reaction_kinds
  for select to authenticated using (true);
create policy post_reaction_kinds_service_role on public.post_reaction_kinds
  for all to service_role using (true) with check (true);

comment on table public.post_reaction_kinds is
  'The six reactions of a Feed post (handoff 62-A, rulings 1798, 1818): four public (asante, celebrate, learned, standing) and two intents (help, build), each with its emoji from message_reaction_emoji, its label verbatim from the extraction and its position on the bar. Served by vocabularies() as post_reaction_kinds; no component holds the six as literals (194). Personas (1116): member, Space lead, event host and admin read it as authenticated; service role writes it; anon is deliberately absent because no signed-out surface shows a reaction.';

insert into public.post_reaction_kinds (kind, class, emoji, label, position) values
  ('asante',    'public', '🫶', 'Asante',            1),
  ('celebrate', 'public', '🎉', 'Celebrate',         2),
  ('learned',   'public', '💡', 'Learned from this', 3),
  ('standing',  'public', '🤝', 'Standing with you', 4),
  ('help',      'intent', '🙋', 'I can help',        5),
  ('build',     'intent', '🛠️', 'Let’s build',       6);

create table public.post_reaction_glosses (
  kind text not null references public.post_reaction_kinds (kind),
  language text not null check (language ~ '^[a-z]{2,3}$'),
  gloss text not null check (length(gloss) between 1 and 40),
  primary key (kind, language)
);

alter table public.post_reaction_glosses enable row level security;
revoke all on table public.post_reaction_glosses from public, anon, authenticated;
grant select on table public.post_reaction_glosses to authenticated;
grant all on table public.post_reaction_glosses to service_role;
create policy post_reaction_glosses_member_select on public.post_reaction_glosses
  for select to authenticated using (true);
create policy post_reaction_glosses_service_role on public.post_reaction_glosses
  for all to service_role using (true) with check (true);

comment on table public.post_reaction_glosses is
  'A reaction''s gloss per language, keyed by the language''s primary subtag (handoff 62-A, ruling 1819): Asante reads "Asante · Thank you" in English, French and Portuguese. Swahili is deliberately absent, because Asante is the word and the name reads Asante alone; Arabic, Amharic, Hausa and Yoruba are absent rows held for a translation, never placeholders. Served by vocabularies() inside each post_reaction_kinds row. Personas (1116): member, Space lead, event host and admin read it as authenticated; service role writes it; anon is deliberately absent because no signed-out surface shows a reaction.';

insert into public.post_reaction_glosses (kind, language, gloss) values
  ('asante', 'en', 'Thank you'),
  ('asante', 'fr', 'Merci'),
  ('asante', 'pt', 'Obrigado');

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'post_reaction_kinds', 'operated',
   'A vocabulary a console edits by row; served to signed-in callers through vocabularies() (1798, 1818).',
   'excluded', 'A vocabulary, not member data.'),
  ('public', 'post_reaction_glosses', 'operated',
   'A vocabulary a console edits by row; served to signed-in callers through vocabularies() (1819).',
   'excluded', 'A vocabulary, not member data.');

-- ---------------------------------------------------------------------------------------------------
-- 2. public.post_reactions gains the public kind (1817, 1826). The column is not null with its default,
--    so the single statement reaches every existing row, which is 564's exemption and 1826's outcome:
--    the 36 rows read asante. The default stays because every insert goes through post_react, which
--    names the kind. emoji is added bare, with no default, so it stays null on every existing row.
-- ---------------------------------------------------------------------------------------------------

alter table public.post_reactions add column kind text not null default 'asante';

alter table public.post_reactions add column emoji text references public.message_reaction_emoji (emoji);

alter table public.post_reactions
  add constraint post_reactions_kind_check
  check (kind in ('asante', 'celebrate', 'learned', 'standing', 'other'));

alter table public.post_reactions
  add constraint post_reactions_other_check
  check ((kind = 'other') = (emoji is not null));

-- 415's shape: the member holds no insert grant, no delete grant and no policy for either;
-- post_react is the only path in and out. The own-row select stays for the member's marks.
revoke insert, delete on table public.post_reactions from authenticated;
drop policy post_reactions_member_insert on public.post_reactions;
drop policy post_reactions_member_delete on public.post_reactions;

comment on table public.post_reactions is
  'One public reaction per member per post (handoff 62-A, rulings 1817, 1826): kind is one of the four public post_reaction_kinds or other, and emoji is the message_reaction_emoji character of an other reaction, null otherwise. Written only by post_react. No count column anywhere; a reader sees names and glyphs, never a figure (1797). Personas (1116): member reads their own rows; Space lead and event host have no access beyond their own member rows; admin is deliberately absent since 20261001120000 (reactions reach no console); service role holds all.';
comment on column public.post_reactions.kind is
  'asante, celebrate, learned, standing (a public_reaction_kinds row of class public) or other (1817). The 36 rows that predate this column read asante (1826).';
comment on column public.post_reactions.emoji is
  'The message_reaction_emoji base character of an other reaction, null for the four named kinds; a skin tone modifier the picker sends is read off and the base kept.';

-- ---------------------------------------------------------------------------------------------------
-- 3. public.post_intents (1798, 1802): private to the post's author.
-- ---------------------------------------------------------------------------------------------------

create table public.post_intents (
  member_id uuid not null references public.members (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  kind text not null references public.post_reaction_kinds (kind) check (kind in ('help', 'build')),
  line text check (line is null or length(line) between 1 and 240),
  created_at timestamptz not null default now(),
  primary key (member_id, post_id, kind)
);
create index post_intents_post_idx on public.post_intents (post_id);

alter table public.post_intents enable row level security;
revoke all on table public.post_intents from public, anon, authenticated;
grant select, delete on table public.post_intents to authenticated;
grant all on table public.post_intents to service_role;

create policy post_intents_member_select on public.post_intents
  for select to authenticated using (member_id = (select auth.uid()));
create policy post_intents_member_delete on public.post_intents
  for delete to authenticated using (member_id = (select auth.uid()));
create policy post_intents_service_role on public.post_intents
  for all to service_role using (true) with check (true);

comment on table public.post_intents is
  'I can help and Let''s build on a Feed post (handoff 62-A, rulings 1798, 1802): one row per member, post and kind, with the optional line the member sent. Written only by post_intent, which notifies the post''s author through private.notify; never shown on a card, in a reader''s sheet or in any reader''s projection. Personas (1116): the member reads and deletes their own rows; the post''s author reads them only through post_reactors_author; Space lead, event host and admin are deliberately absent because an intent is between the member and the author and reaches no console; service role holds all.';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'post_intents', 'exempt',
   'A member''s private intent to a post''s author; no console shows it (1802).',
   'member_side', 'DIA reads an intent''s kind, parties and age as structure for the day-later follow-up (1802, H62-E), never its line.');

-- ---------------------------------------------------------------------------------------------------
-- 4. public.member_reaction_picks (1821): what the member chose from the full picker.
-- ---------------------------------------------------------------------------------------------------

create table public.member_reaction_picks (
  member_id uuid not null references public.members (id) on delete cascade,
  emoji text not null references public.message_reaction_emoji (emoji),
  picked_at timestamptz not null default now(),
  primary key (member_id, emoji)
);

alter table public.member_reaction_picks enable row level security;
revoke all on table public.member_reaction_picks from public, anon, authenticated;
grant select on table public.member_reaction_picks to authenticated;
grant all on table public.member_reaction_picks to service_role;

create policy member_reaction_picks_member_select on public.member_reaction_picks
  for select to authenticated using (member_id = (select auth.uid()));
create policy member_reaction_picks_service_role on public.member_reaction_picks
  for all to service_role using (true) with check (true);

comment on table public.member_reaction_picks is
  'The emoji a member chose from the full picker for a Feed reaction, with the moment of the last pick (handoff 62-A, ruling 1821): the Feed half of member_recent_reactions, written only by post_react when the pick came from the picker, never by a pick on the strip, so the strip never reorders and a changed reaction never forgets a pick. Personas (1116): the member reads their own rows; Space lead, event host and admin are deliberately absent because a pick is the member''s own and reaches no console; service role holds all.';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'member_reaction_picks', 'exempt',
   'A member''s own picker recents; no console shows them (1821).',
   'excluded', 'Structure of the member''s own picker use, not something DIA reasons over.');

-- ---------------------------------------------------------------------------------------------------
-- 5. The notification kinds (1802, 1817) and the post branch of private.notification_c_for (1325).
-- ---------------------------------------------------------------------------------------------------

insert into public.notification_kinds (kind, c, c_from_object, destination, renders, groups, group_window, position) values
  ('intent_help',  null, true, 'Opens Who reacted', true, true, interval '7 days', 10),
  ('intent_build', null, true, 'Opens Who reacted', true, true, interval '7 days', 11);

-- The live body is 20261009120100's, with the post branch added: a post's C is its own c_category.
create or replace function private.notification_c_for(p_object_kind public.anchor_kind, p_object_id uuid)
returns public.c_category
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_kind text;
  v_anchor_kind public.anchor_kind;
  v_anchor_id uuid;
  v_c public.c_category;
begin
  if p_object_kind is null or p_object_id is null then
    return null;
  end if;
  case p_object_kind::text
    when 'event' then
      return 'convene';
    when 'space' then
      return 'collaborate';
    when 'thread' then
      select t.kind, t.anchor_kind, t.anchor_id into v_kind, v_anchor_kind, v_anchor_id
      from public.threads t where t.id = p_object_id;
      -- 1636: a community group is Connect's.
      if v_kind = 'community_group' then
        return 'connect';
      end if;
      if v_anchor_kind is null or v_anchor_kind::text = 'thread' then
        return null;
      end if;
      return private.notification_c_for(v_anchor_kind, v_anchor_id);
    -- 62-A (1802, 1823): an intent on a post is under the post's C.
    when 'post' then
      select p.c_category into v_c from public.posts p where p.id = p_object_id;
      return v_c;
    else
      return null;
  end case;
end;
$$;

comment on function private.notification_c_for(public.anchor_kind, uuid) is
  'The C a context-derived notification kind takes from its object (1325): an event is Convene, a Space is Collaborate, a community group thread is Connect (1636), any other thread is its anchor''s, a post is its own c_category (62-A, 1802). Null where the context names no C, which private.notify refuses.';

-- ---------------------------------------------------------------------------------------------------
-- 6. Private helpers.
-- ---------------------------------------------------------------------------------------------------

-- The member an intent reaches and the author's sheet opens for: author_id of a member post, the
-- role holder who pressed Publish for a Space post.
create function private.post_author(p_post uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select case when p.author_kind = 'member' then p.author_id else p.created_by end
  from public.posts p
  where p.id = p_post;
$$;

revoke all on function private.post_author(uuid) from public, anon;
grant execute on function private.post_author(uuid) to authenticated, service_role;

comment on function private.post_author(uuid) is
  'The member a post''s intents reach and the author''s sheet opens for (62-A): author_id of a member post, created_by of a Space post. Null for no such post.';

-- The base character the vocabulary holds for a picked emoji, read as private.message_react reads
-- it: at most one skin tone modifier, U+1F3FB to U+1F3FF, at the end, looked up as sent and then
-- with the variation selector the toned form drops. Null where the vocabulary holds no such base.
create function private.reaction_base(p_emoji text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_reaction text := coalesce(p_emoji, '');
  v_modifier text := substring(v_reaction from '[\U0001F3FB-\U0001F3FF]$');
  v_base text;
begin
  v_base := case when v_modifier is null then v_reaction
                 else left(v_reaction, char_length(v_reaction) - 1) end;
  if v_base = '' or v_base ~ '[\U0001F3FB-\U0001F3FF]' then
    return null;
  end if;
  if exists (select 1 from public.message_reaction_emoji e where e.emoji = v_base) then
    return v_base;
  end if;
  if v_modifier is not null
     and exists (select 1 from public.message_reaction_emoji e where e.emoji = v_base || chr(65039)) then
    return v_base || chr(65039);
  end if;
  return null;
end;
$$;

revoke all on function private.reaction_base(text) from public, anon, authenticated;

comment on function private.reaction_base(text) is
  'The message_reaction_emoji base of a picked character (62-A): a trailing skin tone modifier read off as private.message_react reads it, the base looked up as sent and then with U+FE0F. Null where the vocabulary holds no such base.';

-- The closest mutual between the caller and a member, that the caller may see: a member connected
-- to both (member_connections, both hops live), the materialised second degree's own sample first in
-- its order, then by the caller's most recent connection; admitted by visible_to, never across a
-- block. No row where no such mutual exists.
create function private.post_mutual_for(p_member uuid)
returns table (id uuid, name text, handle text, avatar_path text)
language sql
stable
security definer
set search_path to ''
as $$
  select m.id, m.name, m.handle, m.avatar_path
  from (
    select c1.other_id as via,
           c1.created_at,
           coalesce((select array_position(sd.sample_via_ids, c1.other_id)
                     from public.second_degree sd
                     where sd.member_id = auth.uid() and sd.fof_id = p_member), 2147483647) as sample_rank
    from public.member_connections c1
    join public.member_connections c2 on c2.member_id = c1.other_id and c2.other_id = p_member
    where c1.member_id = auth.uid()
      and c1.other_id <> p_member
  ) v
  join public.members m on m.id = v.via
  where not private.is_blocked(auth.uid(), m.id)
    and private.visible_to(m.id)
  order by v.sample_rank, v.created_at desc
  limit 1;
$$;

revoke all on function private.post_mutual_for(uuid) from public, anon, authenticated;

comment on function private.post_mutual_for(uuid) is
  'The closest mutual between auth.uid() and a member that the caller may see (62-A, 1817): connected to both in member_connections, second_degree''s sample first, then the caller''s most recent connection; private.visible_to and never across a block. At most one row.';

-- The caller's one public reaction on a post: set, change or remove (1817). p_picked marks a pick
-- from the full picker, which joins the recents (1821); a pick on the strip does not.
create function private.post_reaction_write(p_post uuid, p_kind text, p_emoji text, p_picked boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_base text;
  v_held_kind text;
  v_held_emoji text;
begin
  if p_kind = 'other' then
    v_base := private.reaction_base(p_emoji);
    if v_base is null then
      raise exception 'bad_reaction' using errcode = '22023';
    end if;
  elsif not exists (select 1 from public.post_reaction_kinds k where k.kind = p_kind and k.class = 'public') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;

  select r.kind, r.emoji into v_held_kind, v_held_emoji
  from public.post_reactions r
  where r.member_id = v_uid and r.post_id = p_post;

  -- Choosing the held reaction removes it (1817).
  if v_held_kind = p_kind and (p_kind <> 'other' or v_held_emoji = v_base) then
    delete from public.post_reactions r where r.member_id = v_uid and r.post_id = p_post;
    return null;
  end if;

  insert into public.post_reactions (member_id, post_id, kind, emoji)
  values (v_uid, p_post, p_kind, v_base)
  on conflict (member_id, post_id) do update
    set kind = excluded.kind, emoji = excluded.emoji, created_at = now();

  if p_picked and p_kind = 'other' then
    insert into public.member_reaction_picks (member_id, emoji)
    values (v_uid, v_base)
    on conflict (member_id, emoji) do update set picked_at = now();
  end if;

  return jsonb_build_object('kind', p_kind, 'emoji', v_base);
end;
$$;

revoke all on function private.post_reaction_write(uuid, text, text, boolean) from public, anon;
grant execute on function private.post_reaction_write(uuid, text, text, boolean) to authenticated, service_role;

comment on function private.post_reaction_write(uuid, text, text, boolean) is
  'The one writer of post_reactions (62-A, 1817, 1821), called by post_react after the posts row policy has admitted the post: a public kind or other with a vocabulary base, upserted as the caller''s one row; the held reaction chosen again is removed and null returned; a pick from the full picker also writes member_reaction_picks. Raises 22023 bad_kind or bad_reaction.';

-- The caller's one intent of a kind on a post, on or off (1798, 1802). Turning it on for the first
-- time notifies the post's author under the post's C, grouped per post and kind; turning it on
-- again keeps the row and takes a new line where one is sent; off removes the row and leaves the
-- notification standing.
create function private.post_intent_write(p_post uuid, p_kind text, p_on boolean, p_line text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_line text := nullif(btrim(coalesce(p_line, '')), '');
  v_had boolean;
  v_notification text;
begin
  if not exists (select 1 from public.post_reaction_kinds k where k.kind = p_kind and k.class = 'intent') then
    raise exception 'bad_kind' using errcode = '22023';
  end if;
  if v_line is not null and length(v_line) > 240 then
    raise exception 'line_too_long' using errcode = '22023';
  end if;

  if p_on then
    select exists (
      select 1 from public.post_intents i
      where i.member_id = v_uid and i.post_id = p_post and i.kind = p_kind
    ) into v_had;

    insert into public.post_intents (member_id, post_id, kind, line)
    values (v_uid, p_post, p_kind, v_line)
    on conflict (member_id, post_id, kind) do update
      set line = coalesce(excluded.line, public.post_intents.line);

    if not v_had then
      v_notification := case p_kind when 'help' then 'intent_help' when 'build' then 'intent_build' end;
      perform private.notify(
        private.post_author(p_post), v_notification,
        'member', v_uid,
        'post', p_post,
        'post:' || p_post::text);
    end if;
  else
    delete from public.post_intents i
    where i.member_id = v_uid and i.post_id = p_post and i.kind = p_kind;
  end if;

  return (
    select coalesce(jsonb_agg(i.kind order by k.position), '[]'::jsonb)
    from public.post_intents i
    join public.post_reaction_kinds k on k.kind = i.kind
    where i.member_id = v_uid and i.post_id = p_post
  );
end;
$$;

revoke all on function private.post_intent_write(uuid, text, boolean, text) from public, anon;
grant execute on function private.post_intent_write(uuid, text, boolean, text) to authenticated, service_role;

comment on function private.post_intent_write(uuid, text, boolean, text) is
  'The one writer of post_intents (62-A, 1798, 1802), called by post_intent after the posts row policy has admitted the post: on inserts the caller''s row with its optional line and, for a new row, calls private.notify for the post''s author (intent_help or intent_build, object the post, group key per post); off removes the row. Returns the caller''s intents on the post in the vocabulary''s order. Raises 22023 bad_kind or line_too_long.';

-- The summary per post, for a page the posts row policy has already admitted (1799, 1822): the
-- public kinds used in fixed order, whether any other exists, up to two people in the caller's
-- network admitted by visible_to (the caller first when they reacted, then by most recent reaction,
-- ranked here and never returned), whether more reactors exist, the caller's own kind and emoji,
-- and the caller's own intents. No figure (1797); no other member's intent.
create function private.post_reaction_rows_for(p_posts uuid[])
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with rx as (
    select r.post_id, r.member_id, r.kind, r.emoji, r.created_at
    from public.post_reactions r
    where r.post_id = any (p_posts)
  ),
  people as (
    select rx.post_id, rx.member_id,
           row_number() over (
             partition by rx.post_id
             order by (rx.member_id = auth.uid()) desc, rx.created_at desc, rx.member_id) as rn
    from rx
    where rx.member_id = auth.uid()
       or (exists (select 1 from public.member_connections c
                   where c.member_id = auth.uid() and c.other_id = rx.member_id)
           and not private.is_blocked(auth.uid(), rx.member_id)
           and private.visible_to(rx.member_id))
  )
  select coalesce(jsonb_object_agg(p.id::text, jsonb_build_object(
    'kinds', (select coalesce(jsonb_agg(k.kind order by k.position), '[]'::jsonb)
              from public.post_reaction_kinds k
              where k.class = 'public'
                and exists (select 1 from rx where rx.post_id = p.id and rx.kind = k.kind)),
    'other', exists (select 1 from rx where rx.post_id = p.id and rx.kind = 'other'),
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', m.id, 'name', m.name, 'handle', m.handle, 'avatar_path', m.avatar_path,
                 'you', m.id = auth.uid()) order by pe.rn), '[]'::jsonb)
               from people pe
               join public.members m on m.id = pe.member_id
               where pe.post_id = p.id and pe.rn <= 2),
    'more', (select count(*) from rx where rx.post_id = p.id)
            > (select count(*) from people pe where pe.post_id = p.id and pe.rn <= 2),
    'own', (select jsonb_build_object('kind', rx.kind, 'emoji', rx.emoji)
            from rx where rx.post_id = p.id and rx.member_id = auth.uid()),
    'intents', (select coalesce(jsonb_agg(i.kind order by k.position), '[]'::jsonb)
                from public.post_intents i
                join public.post_reaction_kinds k on k.kind = i.kind
                where i.post_id = p.id and i.member_id = auth.uid())
  )), '{}'::jsonb)
  from unnest(p_posts) as p (id);
$$;

revoke all on function private.post_reaction_rows_for(uuid[]) from public, anon;
grant execute on function private.post_reaction_rows_for(uuid[]) to authenticated, service_role;

comment on function private.post_reaction_rows_for(uuid[]) is
  'The reaction summary per post for ids the posts row policy has admitted (62-A, 1799, 1822): kinds in fixed order, other, up to two people in the caller''s network under private.visible_to and never across a block, more, the caller''s own reaction and intents. No figure and no other member''s intent (1797).';

-- The reader's sheet (1808, 1811, 1813, 1820): every reactor visible_to admits for the caller, the
-- caller's own row first, then by most recent reaction; name, handle, avatar, headline, kind and
-- emoji, and the relationship in words (self, connected, through with the closest mutual, outside).
-- Never an intent, never a figure.
create function private.post_reactors_visible_for(p_post uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'name', m.name, 'handle', m.handle, 'avatar_path', m.avatar_path,
    'headline', m.headline,
    'kind', r.kind, 'emoji', r.emoji,
    'you', m.id = auth.uid(),
    'relationship', case
      when m.id = auth.uid() then 'self'
      when private.is_connected(auth.uid(), m.id) then 'connected'
      when mu.id is not null then 'through'
      else 'outside' end,
    'through', case
      when m.id <> auth.uid() and not private.is_connected(auth.uid(), m.id) and mu.id is not null
      then jsonb_build_object('id', mu.id, 'name', mu.name, 'handle', mu.handle, 'avatar_path', mu.avatar_path)
      end
  ) order by (m.id = auth.uid()) desc, r.created_at desc, m.id), '[]'::jsonb)
  from public.post_reactions r
  join public.members m on m.id = r.member_id
  left join lateral private.post_mutual_for(m.id) mu on m.id <> auth.uid()
  where r.post_id = p_post
    and (m.id = auth.uid()
         or (not private.is_blocked(auth.uid(), m.id) and private.visible_to(m.id)));
$$;

revoke all on function private.post_reactors_visible_for(uuid) from public, anon;
grant execute on function private.post_reactors_visible_for(uuid) to authenticated, service_role;

comment on function private.post_reactors_visible_for(uuid) is
  'The reader''s sheet for a post the posts row policy has admitted (62-A, 1808, 1811, 1813): every reactor private.visible_to admits for the caller and no blocked party, the caller first, each with name, handle, avatar, headline, kind, emoji and the relationship in words. Never an intent, never a figure (1797).';

-- The author's sheet (1799, 141, 1820): every reaction and every intent on the author's own post,
-- with exact figures per kind, the intent's line, and no id, name, handle, photo or headline for a
-- member visible_to does not admit for the author (the client renders A.role). A blocked party is
-- absent from the rows and the figures alike.
create function private.post_reactors_author_for(p_post uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with rows as (
    select r.member_id, r.kind, r.emoji, null::text as line, r.created_at, 'reaction'::text as class
    from public.post_reactions r
    where r.post_id = p_post and not private.is_blocked(auth.uid(), r.member_id)
    union all
    select i.member_id, i.kind, null::text, i.line, i.created_at, 'intent'::text
    from public.post_intents i
    where i.post_id = p_post and not private.is_blocked(auth.uid(), i.member_id)
  ),
  named as (
    select rows.*, (rows.member_id = auth.uid() or private.visible_to(rows.member_id)) as named
    from rows
  )
  select jsonb_build_object(
    'figures', (select coalesce(jsonb_object_agg(k.kind, (select count(*) from named n where n.kind = k.kind)), '{}'::jsonb)
                from public.post_reaction_kinds k)
               || jsonb_build_object(
                    'all', (select count(*) from named),
                    'other', (select count(*) from named n where n.kind = 'other')),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', case when n.named then m.id end,
      'name', case when n.named then m.name end,
      'handle', case when n.named then m.handle end,
      'avatar_path', case when n.named then m.avatar_path end,
      'headline', case when n.named then m.headline end,
      'class', n.class,
      'kind', n.kind, 'emoji', n.emoji, 'line', n.line,
      'you', m.id = auth.uid(),
      'relationship', case
        when not n.named then null
        when m.id = auth.uid() then 'self'
        when private.is_connected(auth.uid(), m.id) then 'connected'
        when mu.id is not null then 'through'
        else 'outside' end,
      'through', case
        when n.named and m.id <> auth.uid() and not private.is_connected(auth.uid(), m.id) and mu.id is not null
        then jsonb_build_object('id', mu.id, 'name', mu.name, 'handle', mu.handle, 'avatar_path', mu.avatar_path)
        end
    ) order by n.created_at desc, n.member_id, n.kind), '[]'::jsonb)
    from named n
    join public.members m on m.id = n.member_id
    left join lateral private.post_mutual_for(m.id) mu on n.named and m.id <> auth.uid())
  );
$$;

revoke all on function private.post_reactors_author_for(uuid) from public, anon;
grant execute on function private.post_reactors_author_for(uuid) to authenticated, service_role;

comment on function private.post_reactors_author_for(uuid) is
  'The author''s sheet for the caller''s own post (62-A, 1799, 141): exact figures per kind with all and other, and every reaction and intent row with its line; a member private.visible_to does not admit for the author carries no id, name, handle, photo or headline; a blocked party is absent. Called by post_reactors_author alone, which checks authorship.';

-- ---------------------------------------------------------------------------------------------------
-- 7. The public functions: security invoker, the posts row policy decides which post answers.
-- ---------------------------------------------------------------------------------------------------

create function public.post_react(p_post uuid, p_kind text, p_emoji text default null, p_picked boolean default false)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'post_react: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_react: no such post' using errcode = '42501';
  end if;
  return private.post_reaction_write(v_id, p_kind, p_emoji, p_picked);
end;
$$;

revoke all on function public.post_react(uuid, text, text, boolean) from public, anon;
grant execute on function public.post_react(uuid, text, text, boolean) to authenticated, service_role;

comment on function public.post_react(uuid, text, text, boolean) is
  'Set, change or remove the caller''s one public reaction on a published post the posts row policy admits (62-A, 1817): kind asante, celebrate, learned, standing or other with an emoji; the held reaction chosen again removes it and returns null; p_picked marks a pick from the full picker for the recents (1821). Returns {kind, emoji}. Security invoker; writes through private.post_reaction_write. A public reaction notifies no one (1316).';

create function public.post_intent(p_post uuid, p_kind text, p_on boolean, p_line text default null)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'post_intent: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_intent: no such post' using errcode = '42501';
  end if;
  return private.post_intent_write(v_id, p_kind, p_on, p_line);
end;
$$;

revoke all on function public.post_intent(uuid, text, boolean, text) from public, anon;
grant execute on function public.post_intent(uuid, text, boolean, text) to authenticated, service_role;

comment on function public.post_intent(uuid, text, boolean, text) is
  'Turn I can help or Let''s build on or off on a published post the posts row policy admits, with an optional line of up to 240 characters (62-A, 1798, 1802): on notifies the post''s author once per intent, grouped per post and kind; off removes the row. Returns the caller''s intents on the post. Security invoker; writes through private.post_intent_write.';

create function public.post_reaction_rows(p_posts uuid[])
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'post_reaction_rows: not signed in' using errcode = '42501';
  end if;
  if p_posts is null or cardinality(p_posts) = 0 then
    return '{}'::jsonb;
  end if;
  if cardinality(p_posts) > 200 then
    raise exception 'At most 200 posts at a time.' using errcode = '22023';
  end if;
  select coalesce(array_agg(p.id), '{}'::uuid[]) into v_ids
  from public.posts p
  where p.id = any (p_posts) and p.status = 'published';
  return private.post_reaction_rows_for(v_ids);
end;
$$;

revoke all on function public.post_reaction_rows(uuid[]) from public, anon;
grant execute on function public.post_reaction_rows(uuid[]) to authenticated, service_role;

comment on function public.post_reaction_rows(uuid[]) is
  'The reaction summary for a page of posts, keyed by post id (62-A, 1799, 1822): the public kinds used in fixed order, other, up to two people in the caller''s network, more, the caller''s own reaction and intents; no figure and no other member''s intent (1797). Security invoker; the posts row policy decides which ids answer; at most 200 ids a call.';

create function public.post_reactors_visible(p_post uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_reactors_visible: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_reactors_visible: no such post' using errcode = '42501';
  end if;
  return private.post_reactors_visible_for(v_id);
end;
$$;

revoke all on function public.post_reactors_visible(uuid) from public, anon;
grant execute on function public.post_reactors_visible(uuid) to authenticated, service_role;

comment on function public.post_reactors_visible(uuid) is
  'The reader''s sheet for a post the posts row policy admits (62-A, 1808, 1811, 1813): every reactor the caller may see, the caller first, with the relationship in words; never an intent, never a figure (1797). Security invoker.';

create function public.post_reactors_author(p_post uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'post_reactors_author: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id
  from public.posts p
  where p.id = p_post and p.status = 'published' and private.post_author(p.id) = v_uid;
  if v_id is null then
    raise exception 'post_reactors_author: not the author' using errcode = '42501';
  end if;
  return private.post_reactors_author_for(v_id);
end;
$$;

revoke all on function public.post_reactors_author(uuid) from public, anon;
grant execute on function public.post_reactors_author(uuid) to authenticated, service_role;

comment on function public.post_reactors_author(uuid) is
  'The author''s sheet (62-A, 1799, 141): raises 42501 unless the caller authored the post (private.post_author); every reaction and intent with exact figures per kind, the intent lines, and a role row with no name, handle, photo or link for a member the author may not see. Security invoker.';

-- The five most recent distinct emoji the caller chose from the full picker, newest first (1821):
-- the Feed's picks and the Messenger's reactions (1405's half), each read to its base character.
create function public.member_recent_reactions()
returns text[]
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(array_agg(x.emoji order by x.last_at desc), '{}'::text[])
  from (
    select u.emoji, max(u.at) as last_at
    from (
      select p.emoji, p.picked_at as at
      from public.member_reaction_picks p
      where p.member_id = auth.uid()
      union all
      select private.reaction_base(r.reaction), r.created_at
      from public.message_reactions r
      where r.member_id = auth.uid()
    ) u
    where u.emoji is not null
    group by u.emoji
    order by last_at desc
    limit 5
  ) x;
$$;

revoke all on function public.member_recent_reactions() from public, anon;
grant execute on function public.member_recent_reactions() to authenticated, service_role;

comment on function public.member_recent_reactions() is
  'The caller''s up to five most recent distinct picker emoji, newest first (62-A, 1821): member_reaction_picks and the Messenger''s message_reactions (1405), each to its message_reaction_emoji base. Empty until the picker has been used. Security definer on auth.uid(); the caller''s own rows only.';

-- ---------------------------------------------------------------------------------------------------
-- 8. vocabularies() gains post_reaction_kinds (1798, 1818, 1819). Every other key is the live
--    definition byte for byte (20261012120000).
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
                                from public.notification_categories c),
    -- Handoff 62-A (1798, 1818, 1819): the six reactions of a Feed post in the bar's order, each with
    -- its class, its emoji character, its label verbatim and its glosses keyed by language.
    'post_reaction_kinds', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'value', k.kind, 'class', k.class, 'emoji', k.emoji, 'label', k.label,
                                     'glosses', (select coalesce(jsonb_object_agg(g.language, g.gloss), '{}'::jsonb)
                                                 from public.post_reaction_glosses g where g.kind = k.kind))
                                     order by k.position), '[]'::jsonb)
                            from public.post_reaction_kinds k)
  );
$$;
