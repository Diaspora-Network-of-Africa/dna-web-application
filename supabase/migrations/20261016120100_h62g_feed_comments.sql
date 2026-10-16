-- Handoff 62-G (Session 62), PR 1, file 2 of 2: the Feed card's comment layer. Rulings 1844, 1848,
-- 1849 (the sentences), 1677 (one level of replies), 1796 (oldest first), 1797 and 82 (no number to a
-- reader), 1809 and 1822 (the action row and the comment's summary), 1817 (the Author mark, intents
-- on a comment notify its author, every intent takes the comment as its object), 1820 (every name
-- with its photo), 1651 and 1316 (a reaction never notifies), 1319 (private.notify is the one writer
-- of notifications), 1318 (the kinds are the vocabulary), B60 guardrail 3 ratified under 1700 (a
-- comment notifies the post's author, a reply the comment's author, under the post's C); with 141,
-- 186, 198, 1116, 1299, 1300, 1734, 225, 466, 564, 1827.
--
-- What ships:
--
--   1. public.comments              a comment on a published post: text (1 to 2000 characters), one
--                                   image (a public.media row the commenter uploaded through
--                                   media-upload into the post's own folder), or both; parent_id names
--                                   a top-level comment for a reply and nothing deeper (1677);
--                                   edited_at and deleted_at for PR 2's edit and tombstone. A viewer
--                                   reads a comment only on a post the posts row policy admits for
--                                   them, and never one by a member blocked either way (141, 186).
--                                   No member insert, update or delete grant: comment_post is the
--                                   one path in (415's shape), and PR 2's edit and delete follow it.
--   2. public.comment_reactions     the member's one public reaction on a comment, post_reactions'
--                                   shape: kind asante, celebrate, learned, standing or other, emoji
--                                   for other. Written only by comment_react.
--   3. public.comment_intents       I can help and Let's build on a comment, post_intents' shape, with
--                                   the optional line. Written only by comment_intent, which notifies
--                                   the comment's author (1817).
--   4. A select policy on public.media for the image a readable comment names, as
--                                   media_post_viewer_select does for a post's image (1709).
--   5. Two notification kinds, comment_on_post and reply_to_comment: C from the object (the post, or
--                                   the comment's post), grouping on inside a window of 7 days so the
--                                   rows read "{n1} and {n2} commented on your post" (1849), email off.
--                                   private.notification_c_for gains the comment branch, which also
--                                   serves intent_help and intent_build on a comment (1817).
--   6. Functions, every one on auth.uid(), none taking the viewer as a parameter:
--        public.comment_post              write a comment or a reply; notifies as above
--        public.post_comments             the thread, oldest first, paged with no figure
--        public.post_latest_comments      the newest comment per post for the collapsed card
--        public.comment_react             set, change or remove the one public reaction
--        public.comment_intent            turn an intent on or off; on notifies the comment's author
--        public.comment_reaction_rows     the summary for a set of comments, no figure
--        public.comment_reactors_visible  the reader's sheet for a comment, names by privacy
--        public.comment_reactors_author   the commenter's own sheet, exact figures
--      Each public function is security invoker, as 62-A's are: it reads public.posts, and
--      public.comments where a comment is named, under the caller's own policies, so the row
--      policies decide which post and which comment answer (and only a published post, never a
--      deleted comment), then calls a private security definer helper that does the row work for
--      auth.uid(). Every name a helper returns is admitted by private.visible_to, the one
--      member-visibility predicate (1734; the handoff names private.can_see_core, which has answered
--      through visible_to since 20261013150000), and no row crosses a block in either direction
--      (186). Times leave the server absolute; the client formats them (1817).
--   7. Every new table catalogued for DIA (1300) with explicit RLS and the absent personas named.
--
-- Readings taken here and named in the PR:
--   A comment's image is the post pipeline's: the client calls media-upload with the post's id, so
--     the master lands in post-media under {commenter}/{post}/{uuid} as a media row of kind post,
--     which post_media_objects_member_select already serves to whoever may read the post. comment_post
--     accepts only a media row the caller owns in that folder, named by no post_media row and no
--     other comment: one image per comment, never another member's upload, never a post's own image.
--   A reply to a deleted comment is refused, as is a reply to a reply (1677); a comment whose post
--     the caller may not see is no post to them (42501, the posts row policy).
--   A blocked commenter is absent both ways with their replies: a reply whose parent the viewer may
--     not see has no thread to sit in. The viewer's own comments always answer.
--   A commenter private.visible_to does not admit for the viewer answers with no id, name, handle
--     or photo (author null); the comment itself stays, because its audience is the post's (141).
--     The client renders the role names.ts supplies, with no photo and no link (1820).
--   A deleted comment with replies answers as a tombstone: deleted true and no author, body, media
--     or reactions. A deleted top-level comment with no reply left answers nothing. Replies are
--     never tombstoned, because nothing hangs under them (1677).
--   The newest comment for the collapsed card is the newest the viewer may read, reply or top-level,
--     never deleted; never a count (1797).
--   The body's ceiling is 2000 characters, named here because posts.body carries none; the message
--     body's own ceiling is the Messenger's and not reused.
--   comment_reactors_author is the commenter's: 1813's author's sheet for a comment opens for the
--     member who wrote the comment, since the figures are theirs (SPEC-62 8.2).
--   The pages of a thread are keyed on (created_at, id) of the last top-level comment answered, so
--     a page never repeats or skips across an insert; a top-level comment carries every reply it has.
--   private.can_see_anchor gains no comment branch: no post anchors on a comment, and nothing
--     resolves a comment through it. A notification's object the client resolves by reading
--     public.comments under its own policy.
--
-- This file carries a delete inside two function bodies (comment_react's remove and comment_intent's
-- off), as 20261015120100 does; nothing outside a function body deletes, drops or revokes a thing
-- that exists on the project, and no table named by the founder is touched destructively. It names the
-- anchor value 'comment' only inside plpgsql bodies, evaluated when called, never in the transaction
-- that added it (20261016120000). Committed before it is applied (225).
--
-- Admin block (1299): comments is exempt until PR 2 carries a reported comment into the Messenger's
-- queue, where the queue's own projection shows it; comment_reactions and comment_intents are exempt,
-- a member's own rows that no console shows, as post_reactions and post_intents are.
-- DIA block (1300): comments is member_side, the parties, the post, whether it is a reply and the age
-- as structure, never the body or the image, under the doctrine that DIA reads metadata only;
-- comment_intents is member_side as post_intents is (1802, H62-E), never the line;
-- comment_reactions is excluded.

-- ---------------------------------------------------------------------------------------------------
-- 1. public.comments (1677, 1796, 141).
-- ---------------------------------------------------------------------------------------------------

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.members (id) on delete cascade,
  body text,
  media_id uuid references public.media (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint comments_body_check check (body is null or length(body) between 1 and 2000),
  constraint comments_content_check check (deleted_at is not null or body is not null or media_id is not null),
  constraint comments_parent_check check (parent_id is null or parent_id <> id)
);
create index comments_post_idx on public.comments (post_id, created_at, id);
create index comments_parent_idx on public.comments (parent_id) where parent_id is not null;
create index comments_author_idx on public.comments (author_id);
create unique index comments_media_idx on public.comments (media_id) where media_id is not null;

alter table public.comments enable row level security;
revoke all on table public.comments from public, anon, authenticated;
grant select on table public.comments to authenticated;
grant all on table public.comments to service_role;

-- The comment's audience is its post's: the subquery runs under the caller's own posts policies, so
-- a post the caller may not see admits no comment. A commenter blocked either way is absent (186).
create policy comments_member_select on public.comments
  for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and (author_id = (select auth.uid()) or not private.is_blocked(author_id, (select auth.uid())))
  );
create policy comments_service_role on public.comments
  for all to service_role using (true) with check (true);

comment on table public.comments is
  'A comment on a Feed post (handoff 62-G, rulings 1677, 1796, 1817): text of 1 to 2000 characters, one image as a public.media row the commenter uploaded into the post''s folder, or both; parent_id names a top-level comment for a reply and never a reply (1677). edited_at and deleted_at are PR 2''s; a deleted comment with replies stays as a tombstone. Written only by comment_post (and PR 2''s edit and delete). Read under the post''s own audience (141): comments_member_select reads public.posts under the caller''s policies and refuses a commenter blocked either way (186). No count column anywhere (1797). Personas (1116): member reads comments on a post they may read; Space lead and event host read a Space post''s or an event post''s comments as readers of that post, through the same policy, and have no further access; admin is deliberately absent because no console shows a comment until PR 2 carries a reported one into the Messenger''s queue; service role holds all.';
comment on column public.comments.parent_id is
  'The top-level comment this reply answers; null for a top-level comment. One level only (1677): comment_post refuses a parent that itself has a parent.';
comment on column public.comments.media_id is
  'The one image, a public.media row of kind post in post-media under {commenter}/{post}/, owned by the commenter and named by no post_media row and no other comment. Null for a comment with no image.';
comment on column public.comments.deleted_at is
  'Set by PR 2''s delete when the comment has replies; the row stays as a tombstone with no author, body or image to a reader.';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'comments', 'exempt',
   'A member''s comment on a post; no console shows it until Report''s extension (62-G PR 2) carries a reported comment into the Messenger''s queue, whose own projection shows it then.',
   'member_side', 'DIA reads a comment''s parties, its post, whether it is a reply and its age as structure, never its body or its image (the metadata-only doctrine).');

-- ---------------------------------------------------------------------------------------------------
-- 2. public.comment_reactions (1817, 1822): post_reactions' shape on a comment.
-- ---------------------------------------------------------------------------------------------------

create table public.comment_reactions (
  member_id uuid not null references public.members (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  kind text not null,
  emoji text references public.message_reaction_emoji (emoji),
  created_at timestamptz not null default now(),
  primary key (member_id, comment_id),
  constraint comment_reactions_kind_check check (kind in ('asante', 'celebrate', 'learned', 'standing', 'other')),
  constraint comment_reactions_other_check check ((kind = 'other') = (emoji is not null))
);
create index comment_reactions_comment_idx on public.comment_reactions (comment_id);

alter table public.comment_reactions enable row level security;
revoke all on table public.comment_reactions from public, anon, authenticated;
grant select on table public.comment_reactions to authenticated;
grant all on table public.comment_reactions to service_role;

create policy comment_reactions_member_select on public.comment_reactions
  for select to authenticated using (member_id = (select auth.uid()));
create policy comment_reactions_service_role on public.comment_reactions
  for all to service_role using (true) with check (true);

comment on table public.comment_reactions is
  'One public reaction per member per comment (handoff 62-G, rulings 1817, 1822): kind is one of the four public post_reaction_kinds or other, and emoji is the message_reaction_emoji character of an other reaction, null otherwise. Written only by comment_react; a reaction never notifies (1316). No count column anywhere; a reader sees names and glyphs, never a figure (1797). Personas (1116): member reads their own rows; every reader''s view of others'' reactions comes through comment_reaction_rows and the two sheets; Space lead and event host have no access beyond their own member rows; admin is deliberately absent, as it is for post_reactions since 20261001120000; service role holds all.';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'comment_reactions', 'exempt',
   'A member''s reaction on a comment; no console shows it, as post_reactions (1817).',
   'excluded', 'A reaction, not something DIA reasons over.');

-- ---------------------------------------------------------------------------------------------------
-- 3. public.comment_intents (1798, 1802, 1817): private to the comment's author.
-- ---------------------------------------------------------------------------------------------------

create table public.comment_intents (
  member_id uuid not null references public.members (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  kind text not null references public.post_reaction_kinds (kind) check (kind in ('help', 'build')),
  line text check (line is null or length(line) between 1 and 240),
  created_at timestamptz not null default now(),
  primary key (member_id, comment_id, kind)
);
create index comment_intents_comment_idx on public.comment_intents (comment_id);

alter table public.comment_intents enable row level security;
revoke all on table public.comment_intents from public, anon, authenticated;
grant select on table public.comment_intents to authenticated;
grant all on table public.comment_intents to service_role;

create policy comment_intents_member_select on public.comment_intents
  for select to authenticated using (member_id = (select auth.uid()));
create policy comment_intents_service_role on public.comment_intents
  for all to service_role using (true) with check (true);

comment on table public.comment_intents is
  'I can help and Let''s build on a comment (handoff 62-G, rulings 1798, 1802, 1817): one row per member, comment and kind, with the optional line the member sent. Written only by comment_intent, which notifies the comment''s author through private.notify with the comment as the object (1817); never shown on a comment, in a reader''s sheet or in any reader''s projection. Unlike post_intents the member holds no delete grant: comment_intent off is the one way out. Personas (1116): the member reads their own rows; the comment''s author reads them only through comment_reactors_author; Space lead, event host and admin are deliberately absent because an intent is between the member and the author and reaches no console; service role holds all.';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'comment_intents', 'exempt',
   'A member''s private intent to a comment''s author; no console shows it (1802, 1817).',
   'member_side', 'DIA reads an intent''s kind, parties and age as structure for the day-later follow-up (1802, H62-E), never its line.');

-- ---------------------------------------------------------------------------------------------------
-- 4. The image a readable comment names (1709's shape).
-- ---------------------------------------------------------------------------------------------------

create policy media_comment_viewer_select on public.media
  for select to authenticated
  using (exists (select 1 from public.comments c where c.media_id = media.id));

-- ---------------------------------------------------------------------------------------------------
-- 5. The notification kinds (1849, B60 guardrail 3) and the comment branch of
--    private.notification_c_for (1325, 1817).
-- ---------------------------------------------------------------------------------------------------

insert into public.notification_kinds (kind, c, c_from_object, destination, renders, groups, group_window, position) values
  ('comment_on_post',  null, true, 'Opens the post',    true, true, interval '7 days', 12),
  ('reply_to_comment', null, true, 'Opens the comment', true, true, interval '7 days', 13);

-- The live body is 20261015120100's, with the comment branch added: a comment's C is its post's.
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
    -- 62-G (1817, 1849): a comment, a reply and an intent on a comment are under the post's C.
    when 'comment' then
      select p.c_category into v_c
      from public.comments c
      join public.posts p on p.id = c.post_id
      where c.id = p_object_id;
      return v_c;
    else
      return null;
  end case;
end;
$$;

comment on function private.notification_c_for(public.anchor_kind, uuid) is
  'The C a context-derived notification kind takes from its object (1325): an event is Convene, a Space is Collaborate, a community group thread is Connect (1636), any other thread is its anchor''s, a post is its own c_category (62-A, 1802), a comment is its post''s (62-G, 1817). Null where the context names no C, which private.notify refuses.';

-- ---------------------------------------------------------------------------------------------------
-- 6. Private helpers.
-- ---------------------------------------------------------------------------------------------------

-- The member a comment's intents and replies reach, and the commenter's sheet opens for.
create function private.comment_author(p_comment uuid)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select c.author_id from public.comments c where c.id = p_comment;
$$;

revoke all on function private.comment_author(uuid) from public, anon;
grant execute on function private.comment_author(uuid) to authenticated, service_role;

comment on function private.comment_author(uuid) is
  'The member who wrote a comment (62-G): the recipient of a reply''s and an intent''s notification (1817), and the one member comment_reactors_author answers. Null for no such comment.';

-- One comment as every projection renders it (1817, 1820, 141): the author named only where
-- visible_to admits them for the caller, the post author's mark, the image's media row, the
-- absolute times, and the reaction summary from p_rx (keyed by comment id). A deleted comment is a
-- tombstone: deleted true and nothing else about it.
create function private.comment_json(c public.comments, p_post_author uuid, p_rx jsonb)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'post_id', c.post_id,
    'parent_id', c.parent_id,
    'deleted', c.deleted_at is not null,
    'you', c.deleted_at is null and c.author_id = auth.uid(),
    'is_post_author', c.deleted_at is null and c.author_id = p_post_author,
    'author', case
      when c.deleted_at is not null then null
      when c.author_id = auth.uid() or private.visible_to(c.author_id) then
        (select jsonb_build_object('id', m.id, 'name', m.name, 'handle', m.handle, 'avatar_path', m.avatar_path)
         from public.members m where m.id = c.author_id)
      end,
    'body', case when c.deleted_at is null then c.body end,
    'media', case
      when c.deleted_at is null and c.media_id is not null then
        (select jsonb_build_object('id', md.id, 'storage_path', md.storage_path, 'width', md.width,
                                   'height', md.height, 'crop', md.crop, 'focal_point', md.focal_point)
         from public.media md where md.id = c.media_id)
      end,
    'created_at', c.created_at,
    'edited_at', c.edited_at,
    'reactions', case when c.deleted_at is null then coalesce(p_rx -> c.id::text, '{}'::jsonb) end
  );
$$;

revoke all on function private.comment_json(public.comments, uuid, jsonb) from public, anon, authenticated;

comment on function private.comment_json(public.comments, uuid, jsonb) is
  'One comment as the thread, the collapsed card and comment_post answer it (62-G, 1817, 1820): author with id, name, handle and photo only where private.visible_to admits them for the caller, else null for the client''s role; the post author''s mark; the image''s media row; absolute times; the reaction summary read out of p_rx by id. A deleted comment answers deleted true and no author, body, media or reactions.';

-- The summary per comment, for ids the caller has already been admitted to (1799, 1822): the
-- public kinds used in fixed order, whether any other exists, up to two people in the caller's
-- network admitted by visible_to (the caller first when they reacted, then by most recent reaction,
-- ranked here and never returned), whether more reactors exist, the caller's own kind and emoji,
-- and the caller's own intents. No figure (1797); no other member's intent.
create function private.comment_reaction_rows_for(p_comments uuid[])
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with rx as (
    select r.comment_id, r.member_id, r.kind, r.emoji, r.created_at
    from public.comment_reactions r
    where r.comment_id = any (p_comments)
  ),
  people as (
    select rx.comment_id, rx.member_id,
           row_number() over (
             partition by rx.comment_id
             order by (rx.member_id = auth.uid()) desc, rx.created_at desc, rx.member_id) as rn
    from rx
    where rx.member_id = auth.uid()
       or (exists (select 1 from public.member_connections c
                   where c.member_id = auth.uid() and c.other_id = rx.member_id)
           and not private.is_blocked(auth.uid(), rx.member_id)
           and private.visible_to(rx.member_id))
  )
  select coalesce(jsonb_object_agg(x.id::text, jsonb_build_object(
    'kinds', (select coalesce(jsonb_agg(k.kind order by k.position), '[]'::jsonb)
              from public.post_reaction_kinds k
              where k.class = 'public'
                and exists (select 1 from rx where rx.comment_id = x.id and rx.kind = k.kind)),
    'other', exists (select 1 from rx where rx.comment_id = x.id and rx.kind = 'other'),
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', m.id, 'name', m.name, 'handle', m.handle, 'avatar_path', m.avatar_path,
                 'you', m.id = auth.uid()) order by pe.rn), '[]'::jsonb)
               from people pe
               join public.members m on m.id = pe.member_id
               where pe.comment_id = x.id and pe.rn <= 2),
    'more', (select count(*) from rx where rx.comment_id = x.id)
            > (select count(*) from people pe where pe.comment_id = x.id and pe.rn <= 2),
    'own', (select jsonb_build_object('kind', rx.kind, 'emoji', rx.emoji)
            from rx where rx.comment_id = x.id and rx.member_id = auth.uid()),
    'intents', (select coalesce(jsonb_agg(i.kind order by k.position), '[]'::jsonb)
                from public.comment_intents i
                join public.post_reaction_kinds k on k.kind = i.kind
                where i.comment_id = x.id and i.member_id = auth.uid())
  )), '{}'::jsonb)
  from unnest(p_comments) as x (id);
$$;

revoke all on function private.comment_reaction_rows_for(uuid[]) from public, anon;
grant execute on function private.comment_reaction_rows_for(uuid[]) to authenticated, service_role;

comment on function private.comment_reaction_rows_for(uuid[]) is
  'The reaction summary per comment for ids the caller has been admitted to (62-G, 1799, 1822): kinds in fixed order, other, up to two people in the caller''s network under private.visible_to and never across a block, more, the caller''s own reaction and intents. No figure and no other member''s intent (1797).';

-- The thread for a post the posts row policy has admitted (1796, 1677): top-level comments oldest
-- first from after the cursor, each with every reply it has, oldest first; a blocked commenter
-- absent both ways with their replies; a deleted top-level comment kept as a tombstone only while a
-- reply stands under it. One page holds p_limit top-level comments and says whether more exist, and
-- names the cursor for the next page; never a figure (1797).
create function private.post_comments_for(p_post uuid, p_after timestamptz, p_after_id uuid, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_post_author uuid := private.post_author(p_post);
  v_page uuid[];
  v_more boolean;
  v_rx jsonb;
  v_next jsonb;
begin
  -- The page of top-level comments, plus one to learn whether more exist.
  with tops as (
    select c.id, c.created_at
    from public.comments c
    where c.post_id = p_post
      and c.parent_id is null
      and (c.author_id = v_uid or not private.is_blocked(v_uid, c.author_id))
      and (c.deleted_at is null
           or exists (select 1 from public.comments r
                      where r.parent_id = c.id and r.deleted_at is null
                        and (r.author_id = v_uid or not private.is_blocked(v_uid, r.author_id))))
      and (p_after is null
           or (c.created_at, c.id) > (p_after, coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    order by c.created_at, c.id
    limit p_limit + 1
  ),
  page as (
    select t.id, t.created_at from tops t order by t.created_at, t.id limit p_limit
  )
  select coalesce((select array_agg(p.id order by p.created_at, p.id) from page p), '{}'::uuid[]),
         (select count(*) from tops) > p_limit,
         (select jsonb_build_object('created_at', p.created_at, 'id', p.id)
          from page p order by p.created_at desc, p.id desc limit 1)
  into v_page, v_more, v_next;

  -- One summary read for the page and its replies.
  select private.comment_reaction_rows_for(coalesce(array_agg(c.id), '{}'::uuid[])) into v_rx
  from public.comments c
  where c.id = any (v_page)
     or (c.parent_id = any (v_page) and c.deleted_at is null
         and (c.author_id = v_uid or not private.is_blocked(v_uid, c.author_id)));

  return jsonb_build_object(
    'comments', coalesce((
      select jsonb_agg(
        private.comment_json(c, v_post_author, v_rx)
        || jsonb_build_object('replies', coalesce((
             select jsonb_agg(private.comment_json(r, v_post_author, v_rx) order by r.created_at, r.id)
             from public.comments r
             where r.parent_id = c.id
               and r.deleted_at is null
               and (r.author_id = v_uid or not private.is_blocked(v_uid, r.author_id))), '[]'::jsonb))
        order by c.created_at, c.id)
      from public.comments c
      where c.id = any (v_page)), '[]'::jsonb),
    'more', coalesce(v_more, false),
    'next', case when v_more then v_next end
  );
end;
$$;

revoke all on function private.post_comments_for(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function private.post_comments_for(uuid, timestamptz, uuid, integer) to authenticated, service_role;

comment on function private.post_comments_for(uuid, timestamptz, uuid, integer) is
  'The thread for a post the posts row policy has admitted (62-G, 1796, 1677): a page of top-level comments oldest first after the cursor, each with its replies oldest first, a blocked commenter absent with their replies, a tombstone kept only while a reply stands under it; more and the next cursor, never a figure (1797). Called by post_comments alone.';

-- The newest comment per post, for a page of posts the posts row policy has admitted (SPEC-62 8.3):
-- the newest the caller may read, reply or top-level, never deleted, with its author by privacy.
create function private.post_latest_comments_for(p_posts uuid[])
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(jsonb_object_agg(x.post_id::text, x.j), '{}'::jsonb)
  from (
    select distinct on (c.post_id)
           c.post_id,
           private.comment_json(c, private.post_author(c.post_id), '{}'::jsonb) - 'reactions' as j
    from public.comments c
    where c.post_id = any (p_posts)
      and c.deleted_at is null
      and (c.author_id = auth.uid() or not private.is_blocked(auth.uid(), c.author_id))
    order by c.post_id, c.created_at desc, c.id desc
  ) x;
$$;

revoke all on function private.post_latest_comments_for(uuid[]) from public, anon;
grant execute on function private.post_latest_comments_for(uuid[]) to authenticated, service_role;

comment on function private.post_latest_comments_for(uuid[]) is
  'The newest comment per post for ids the posts row policy has admitted (62-G, SPEC-62 8.3): the newest the caller may read, never deleted, with its author where private.visible_to admits them; keyed by post id, no summary, never a count (1797). Called by post_latest_comments alone.';

-- The one writer of public.comments in PR 1 (1677, 1849, B60 guardrail 3), called by comment_post
-- after the posts row policy has admitted the post: text, one image, or both; a reply only to a
-- top-level comment the caller may see that is not deleted; a top-level comment notifies the post's
-- author and a reply the comment's author, grouped per object, under the post's C; the comment is
-- returned as the thread renders it.
create function private.comment_write(p_post uuid, p_parent uuid, p_body text, p_media uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_parent public.comments;
  v_post_author uuid := private.post_author(p_post);
  v_id uuid;
begin
  if v_body is null and p_media is null then
    raise exception 'empty_comment' using errcode = '22023';
  end if;
  if v_body is not null and length(v_body) > 2000 then
    raise exception 'body_too_long' using errcode = '22023';
  end if;

  if p_parent is not null then
    select c.* into v_parent
    from public.comments c
    where c.id = p_parent
      and c.post_id = p_post
      and (c.author_id = v_uid or not private.is_blocked(v_uid, c.author_id));
    if v_parent.id is null then
      raise exception 'comment_write: no such comment' using errcode = '42501';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'reply_to_reply' using errcode = '22023';
    end if;
    if v_parent.deleted_at is not null then
      raise exception 'comment_deleted' using errcode = '22023';
    end if;
  end if;

  if p_media is not null then
    if not exists (
      select 1 from public.media m
      where m.id = p_media
        and m.owner_id = v_uid
        and m.bucket = 'post-media'
        and m.kind = 'post'
        and m.storage_path like v_uid::text || '/' || p_post::text || '/%'
    ) then
      raise exception 'bad_media' using errcode = '22023';
    end if;
    if exists (select 1 from public.post_media pm where pm.media_id = p_media)
       or exists (select 1 from public.comments c where c.media_id = p_media) then
      raise exception 'media_in_use' using errcode = '22023';
    end if;
  end if;

  insert into public.comments (post_id, parent_id, author_id, body, media_id)
  values (p_post, p_parent, v_uid, v_body, p_media)
  returning id into v_id;

  if p_parent is null then
    perform private.notify(
      v_post_author, 'comment_on_post',
      'member', v_uid,
      'post', p_post,
      'post:' || p_post::text);
  else
    perform private.notify(
      v_parent.author_id, 'reply_to_comment',
      'member', v_uid,
      'comment', p_parent,
      'comment:' || p_parent::text);
  end if;

  return (
    select private.comment_json(c, v_post_author, '{}'::jsonb)
           || case when p_parent is null then jsonb_build_object('replies', '[]'::jsonb) else '{}'::jsonb end
    from public.comments c
    where c.id = v_id
  );
end;
$$;

revoke all on function private.comment_write(uuid, uuid, text, uuid) from public, anon;
grant execute on function private.comment_write(uuid, uuid, text, uuid) to authenticated, service_role;

comment on function private.comment_write(uuid, uuid, text, uuid) is
  'The one writer of comments in 62-G PR 1 (1677, 1849), called by comment_post after the posts row policy has admitted the post: text of 1 to 2000 characters, one image the caller uploaded into the post''s folder and nothing else names, or both; a reply only to a top-level, undeleted comment the caller may see; then private.notify for the post''s author (comment_on_post, object the post) or the comment''s author (reply_to_comment, object the comment), grouped per object under the post''s C. Returns the comment as the thread renders it. Raises 22023 empty_comment, body_too_long, reply_to_reply, comment_deleted, bad_media or media_in_use, and 42501 for a parent the caller may not see.';

-- The caller's one public reaction on a comment: set, change or remove (1817). p_picked marks a
-- pick from the full picker, which joins the recents (1821); a pick on the strip does not.
create function private.comment_reaction_write(p_comment uuid, p_kind text, p_emoji text, p_picked boolean)
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
  from public.comment_reactions r
  where r.member_id = v_uid and r.comment_id = p_comment;

  -- Choosing the held reaction removes it (1817).
  if v_held_kind = p_kind and (p_kind <> 'other' or v_held_emoji = v_base) then
    delete from public.comment_reactions r where r.member_id = v_uid and r.comment_id = p_comment;
    return null;
  end if;

  insert into public.comment_reactions (member_id, comment_id, kind, emoji)
  values (v_uid, p_comment, p_kind, v_base)
  on conflict (member_id, comment_id) do update
    set kind = excluded.kind, emoji = excluded.emoji, created_at = now();

  if p_picked and p_kind = 'other' then
    insert into public.member_reaction_picks (member_id, emoji)
    values (v_uid, v_base)
    on conflict (member_id, emoji) do update set picked_at = now();
  end if;

  return jsonb_build_object('kind', p_kind, 'emoji', v_base);
end;
$$;

revoke all on function private.comment_reaction_write(uuid, text, text, boolean) from public, anon;
grant execute on function private.comment_reaction_write(uuid, text, text, boolean) to authenticated, service_role;

comment on function private.comment_reaction_write(uuid, text, text, boolean) is
  'The one writer of comment_reactions (62-G, 1817, 1821), called by comment_react after the comments and posts row policies have admitted the comment: a public kind or other with a vocabulary base, upserted as the caller''s one row; the held reaction chosen again is removed and null returned; a pick from the full picker also writes member_reaction_picks. Raises 22023 bad_kind or bad_reaction.';

-- The caller's one intent of a kind on a comment, on or off (1798, 1802, 1817). Turning it on for
-- the first time notifies the comment's author under the post's C with the comment as the object,
-- grouped per comment and kind; turning it on again keeps the row and takes a new line where one is
-- sent; off removes the row and leaves the notification standing, as post_intent does.
create function private.comment_intent_write(p_comment uuid, p_kind text, p_on boolean, p_line text)
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
      select 1 from public.comment_intents i
      where i.member_id = v_uid and i.comment_id = p_comment and i.kind = p_kind
    ) into v_had;

    insert into public.comment_intents (member_id, comment_id, kind, line)
    values (v_uid, p_comment, p_kind, v_line)
    on conflict (member_id, comment_id, kind) do update
      set line = coalesce(excluded.line, public.comment_intents.line);

    if not v_had then
      v_notification := case p_kind when 'help' then 'intent_help' when 'build' then 'intent_build' end;
      perform private.notify(
        private.comment_author(p_comment), v_notification,
        'member', v_uid,
        'comment', p_comment,
        'comment:' || p_comment::text);
    end if;
  else
    delete from public.comment_intents i
    where i.member_id = v_uid and i.comment_id = p_comment and i.kind = p_kind;
  end if;

  return (
    select coalesce(jsonb_agg(i.kind order by k.position), '[]'::jsonb)
    from public.comment_intents i
    join public.post_reaction_kinds k on k.kind = i.kind
    where i.member_id = v_uid and i.comment_id = p_comment
  );
end;
$$;

revoke all on function private.comment_intent_write(uuid, text, boolean, text) from public, anon;
grant execute on function private.comment_intent_write(uuid, text, boolean, text) to authenticated, service_role;

comment on function private.comment_intent_write(uuid, text, boolean, text) is
  'The one writer of comment_intents (62-G, 1798, 1802, 1817), called by comment_intent after the comments and posts row policies have admitted the comment: on inserts the caller''s row with its optional line and, for a new row, calls private.notify for the comment''s author (intent_help or intent_build, object the comment, group key per comment); off removes the row. Returns the caller''s intents on the comment in the vocabulary''s order. Raises 22023 bad_kind or line_too_long.';

-- The reader's sheet for a comment (1808, 1811, 1813, 1820): every reactor visible_to admits for the
-- caller, the caller's own row first, then by most recent reaction; name, handle, avatar, headline,
-- kind and emoji, and the relationship in words. Never an intent, never a figure.
create function private.comment_reactors_visible_for(p_comment uuid)
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
  from public.comment_reactions r
  join public.members m on m.id = r.member_id
  left join lateral private.post_mutual_for(m.id) mu on m.id <> auth.uid()
  where r.comment_id = p_comment
    and (m.id = auth.uid()
         or (not private.is_blocked(auth.uid(), m.id) and private.visible_to(m.id)));
$$;

revoke all on function private.comment_reactors_visible_for(uuid) from public, anon;
grant execute on function private.comment_reactors_visible_for(uuid) to authenticated, service_role;

comment on function private.comment_reactors_visible_for(uuid) is
  'The reader''s sheet for a comment the row policies have admitted (62-G, 1808, 1811, 1813): every reactor private.visible_to admits for the caller and no blocked party, the caller first, each with name, handle, avatar, headline, kind, emoji and the relationship in words. Never an intent, never a figure (1797).';

-- The commenter's own sheet (1799, 141, 1820): every reaction and every intent on the caller's own
-- comment, with exact figures per kind, the intent's line, and no id, name, handle, photo or headline
-- for a member visible_to does not admit for the commenter (the client renders A.role). A blocked
-- party is absent from the rows and the figures alike.
create function private.comment_reactors_author_for(p_comment uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with rows as (
    select r.member_id, r.kind, r.emoji, null::text as line, r.created_at, 'reaction'::text as class
    from public.comment_reactions r
    where r.comment_id = p_comment and not private.is_blocked(auth.uid(), r.member_id)
    union all
    select i.member_id, i.kind, null::text, i.line, i.created_at, 'intent'::text
    from public.comment_intents i
    where i.comment_id = p_comment and not private.is_blocked(auth.uid(), i.member_id)
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

revoke all on function private.comment_reactors_author_for(uuid) from public, anon;
grant execute on function private.comment_reactors_author_for(uuid) to authenticated, service_role;

comment on function private.comment_reactors_author_for(uuid) is
  'The commenter''s own sheet for a comment (62-G, 1799, 141): exact figures per kind with all and other, and every reaction and intent row with its line; a member private.visible_to does not admit for the commenter carries no id, name, handle, photo or headline; a blocked party is absent. Called by comment_reactors_author alone, which checks authorship.';

-- ---------------------------------------------------------------------------------------------------
-- 7. The public functions: security invoker, the posts and comments row policies decide what answers.
-- ---------------------------------------------------------------------------------------------------

create function public.comment_post(p_post uuid, p_parent uuid default null, p_body text default null, p_media uuid default null)
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
    raise exception 'comment_post: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'comment_post: no such post' using errcode = '42501';
  end if;
  return private.comment_write(v_id, p_parent, p_body, p_media);
end;
$$;

revoke all on function public.comment_post(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.comment_post(uuid, uuid, text, uuid) to authenticated, service_role;

comment on function public.comment_post(uuid, uuid, text, uuid) is
  'Write a comment, or a reply to a top-level comment, on a published post the posts row policy admits (62-G, 1677, 1849): text of 1 to 2000 characters, one image uploaded through media-upload into the post''s folder, or both. A top-level comment notifies the post''s author and a reply the comment''s author, under the post''s C; a self-act notifies no one. Returns the comment as the thread renders it. Security invoker; writes through private.comment_write.';

create function public.post_comments(p_post uuid, p_after timestamptz default null, p_after_id uuid default null, p_limit integer default 20)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_comments: not signed in' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'Between 1 and 50 comments a page.' using errcode = '22023';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_comments: no such post' using errcode = '42501';
  end if;
  return private.post_comments_for(v_id, p_after, p_after_id, p_limit);
end;
$$;

revoke all on function public.post_comments(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.post_comments(uuid, timestamptz, uuid, integer) to authenticated, service_role;

comment on function public.post_comments(uuid, timestamptz, uuid, integer) is
  'The thread of a published post the posts row policy admits (62-G, 1796, 1677): a page of top-level comments oldest first after the cursor (the created_at and id of the last comment answered), each with its replies oldest first and its reaction summary; more and the next cursor, never a figure (1797). Security invoker; between 1 and 50 top-level comments a page.';

create function public.post_latest_comments(p_posts uuid[])
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'post_latest_comments: not signed in' using errcode = '42501';
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
  return private.post_latest_comments_for(v_ids);
end;
$$;

revoke all on function public.post_latest_comments(uuid[]) from public, anon;
grant execute on function public.post_latest_comments(uuid[]) to authenticated, service_role;

comment on function public.post_latest_comments(uuid[]) is
  'The newest comment per post for a page of posts, keyed by post id (62-G, SPEC-62 8.3): the newest the caller may read, with its author by privacy; a post with no comment the caller may read has no key; never a count (1797). Security invoker; the posts row policy decides which ids answer; at most 200 ids a call.';

create function public.comment_react(p_comment uuid, p_kind text, p_emoji text default null, p_picked boolean default false)
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
    raise exception 'comment_react: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_react: no such comment' using errcode = '42501';
  end if;
  return private.comment_reaction_write(v_id, p_kind, p_emoji, p_picked);
end;
$$;

revoke all on function public.comment_react(uuid, text, text, boolean) from public, anon;
grant execute on function public.comment_react(uuid, text, text, boolean) to authenticated, service_role;

comment on function public.comment_react(uuid, text, text, boolean) is
  'Set, change or remove the caller''s one public reaction on a comment the comments and posts row policies admit (62-G, 1817): kind asante, celebrate, learned, standing or other with an emoji; the held reaction chosen again removes it and returns null; p_picked marks a pick from the full picker for the recents (1821). Returns {kind, emoji}. Security invoker; writes through private.comment_reaction_write. A reaction notifies no one (1316).';

create function public.comment_intent(p_comment uuid, p_kind text, p_on boolean, p_line text default null)
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
    raise exception 'comment_intent: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_intent: no such comment' using errcode = '42501';
  end if;
  return private.comment_intent_write(v_id, p_kind, p_on, p_line);
end;
$$;

revoke all on function public.comment_intent(uuid, text, boolean, text) from public, anon;
grant execute on function public.comment_intent(uuid, text, boolean, text) to authenticated, service_role;

comment on function public.comment_intent(uuid, text, boolean, text) is
  'Turn I can help or Let''s build on or off on a comment the comments and posts row policies admit, with an optional line of up to 240 characters (62-G, 1798, 1802, 1817): on notifies the comment''s author once per intent, grouped per comment and kind, with the comment as the object; off removes the row. Returns the caller''s intents on the comment. Security invoker; writes through private.comment_intent_write.';

create function public.comment_reaction_rows(p_comments uuid[])
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'comment_reaction_rows: not signed in' using errcode = '42501';
  end if;
  if p_comments is null or cardinality(p_comments) = 0 then
    return '{}'::jsonb;
  end if;
  if cardinality(p_comments) > 200 then
    raise exception 'At most 200 comments at a time.' using errcode = '22023';
  end if;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_ids
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = any (p_comments) and c.deleted_at is null and p.status = 'published';
  return private.comment_reaction_rows_for(v_ids);
end;
$$;

revoke all on function public.comment_reaction_rows(uuid[]) from public, anon;
grant execute on function public.comment_reaction_rows(uuid[]) to authenticated, service_role;

comment on function public.comment_reaction_rows(uuid[]) is
  'The reaction summary for a set of comments, keyed by comment id (62-G, 1799, 1822): the public kinds used in fixed order, other, up to two people in the caller''s network, more, the caller''s own reaction and intents; no figure and no other member''s intent (1797). Security invoker; the comments and posts row policies decide which ids answer; at most 200 ids a call.';

create function public.comment_reactors_visible(p_comment uuid)
returns jsonb
language plpgsql
stable
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_reactors_visible: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_reactors_visible: no such comment' using errcode = '42501';
  end if;
  return private.comment_reactors_visible_for(v_id);
end;
$$;

revoke all on function public.comment_reactors_visible(uuid) from public, anon;
grant execute on function public.comment_reactors_visible(uuid) to authenticated, service_role;

comment on function public.comment_reactors_visible(uuid) is
  'The reader''s sheet for a comment the comments and posts row policies admit (62-G, 1808, 1811, 1813): every reactor the caller may see, the caller first, with the relationship in words; never an intent, never a figure (1797). Security invoker.';

create function public.comment_reactors_author(p_comment uuid)
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
    raise exception 'comment_reactors_author: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published' and c.author_id = v_uid;
  if v_id is null then
    raise exception 'comment_reactors_author: not the author' using errcode = '42501';
  end if;
  return private.comment_reactors_author_for(v_id);
end;
$$;

revoke all on function public.comment_reactors_author(uuid) from public, anon;
grant execute on function public.comment_reactors_author(uuid) to authenticated, service_role;

comment on function public.comment_reactors_author(uuid) is
  'The commenter''s own sheet (62-G, 1799, 141): raises 42501 unless the caller wrote the comment; every reaction and intent with exact figures per kind, the intent lines, and a role row with no name, handle, photo or link for a member the commenter may not see. Security invoker.';
