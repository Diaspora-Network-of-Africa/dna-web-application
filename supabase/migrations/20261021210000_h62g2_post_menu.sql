-- Handoff 62-G2 (Session 62), file 1 of 3: the Feed card's menu on the server. HANDOFF-62-G "Done
-- Means, PR 2" item 1 and "Data, PR 2": post edit, which sets an edited time; a change of audience
-- with the values the composer writes; post delete, cascading; post hides per member, with undo.
-- Rulings 1653 (B60 2.3, the card menu), 1844, 1848, 141 (audience is row policy), 186 (blocks),
-- 1319 (private.notify's siblings retract), 1116, 1299, 1300, 225, 466, 564, 1827.
--
-- What ships:
--
--   1. public.posts.edited_at        added bare, no default: every existing post reads null, so no
--                                    post reads Edited that was not edited (564).
--   2. public.post_hides             one row per member per post they hid: "Hide this post" (F27).
--                                    The member reads their own rows and nothing else; written only
--                                    by post_hide and post_unhide.
--   3. public.feed                   the same view, security invoker, the same rows and the same
--                                    order, with two columns added at its end: edited_at, and hidden,
--                                    true where the caller holds a post_hides row for the post. The
--                                    Feed's list reads hidden = false as a server-side predicate, as
--                                    it reads a lens; a post opened by its own link still answers,
--                                    hidden, so the card can render Hidden with Undo (F33).
--   4. Functions, every one on auth.uid(), none taking the viewer as a parameter. Each public
--      function is security invoker, as 62-A's and 62-G's are: it reads public.posts under the
--      caller's own policies, so the row policies decide which post answers, then calls a private
--      security definer helper that does the row work for auth.uid().
--        public.post_edit          the author's new body; edited_at is set when the body changes
--        public.post_set_audience  everyone, connections or anchored (anchored only with an anchor)
--        public.post_delete        the post and, by cascade, its reactions, intents, comments (with
--                                  theirs), saves, hides, media rows, links and DIA row; every
--                                  notification whose object is the post or one of its comments is
--                                  retracted through private.notification_retract
--        public.post_hide          hide a post the caller may see and did not write
--        public.post_unhide        undo it
--
-- Readings taken here and named in the PR:
--   "The author" is whoever the posts row policies let update and delete the post: the member who
--     wrote a member post, and a lead of the Space that wrote a Space post (posts_member_update,
--     posts_space_lead_update, and their delete twins). private.post_owned states the same test
--     for the definer helpers, so the function and the policy cannot disagree on who may act.
--   An edit changes the body alone. A post's image, link and created object are the composer's and
--     stay as published; the edit Sheet (F28) carries the text. A body may be empty only where the
--     post still carries an image, a link or a created object, as publish_post's own floor reads.
--   A change of audience is not an edit: edited_at does not move (F14 is the body's mark, F30 the
--     audience's toast).
--   A post's own author does not hide it; the author's menu has no Hide (F26).
--   Delete retracts notifications for every recipient, because the object they name is gone: a
--     row left behind would open on nothing.
--   The image a post carried stays in public.media and in storage after delete, as post_media's
--     on delete set null has always left it; the purge is not this handoff's (named as a gap).
--
-- This file carries deletes inside function bodies only (post_delete's delete of the post the
-- caller owns, post_unhide's delete of the caller's own hide row, and the retract it calls), as
-- 20261016120100 does; nothing outside a function body deletes, drops or revokes a thing that exists
-- on the project. Committed before it is applied (225).
--
-- Admin block (1299): post_hides is exempt, a member's own preference that no console shows.
-- DIA block (1300): post_hides is excluded; DIA reads nothing of a hide.

-- ---------------------------------------------------------------------------------------------------
-- 1. public.posts.edited_at (F14).
-- ---------------------------------------------------------------------------------------------------

alter table public.posts add column edited_at timestamptz;

comment on column public.posts.edited_at is
  'When the author last changed the body through post_edit (62-G2, F14: the card''s meta line reads "{date} · Edited"). Null for a post never edited; a change of audience does not set it.';

-- ---------------------------------------------------------------------------------------------------
-- 2. public.post_hides (F27, F33).
-- ---------------------------------------------------------------------------------------------------

create table public.post_hides (
  member_id uuid not null references public.members (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, post_id)
);
create index post_hides_post_idx on public.post_hides (post_id);

alter table public.post_hides enable row level security;
revoke all on table public.post_hides from public, anon, authenticated;
grant select on table public.post_hides to authenticated;
grant all on table public.post_hides to service_role;

create policy post_hides_owner_select on public.post_hides
  for select to authenticated
  using (member_id = (select auth.uid()));
create policy post_hides_service_role on public.post_hides
  for all to service_role using (true) with check (true);
create policy post_hides_admitted_gate on public.post_hides
  as restrictive for all to authenticated
  using ((select private.is_admitted())) with check ((select private.is_admitted()));

comment on table public.post_hides is
  'A post a member hid from their own Feed (62-G2, B60 2.3, F27 "Hide this post", F33 Hidden with Undo). One row per member per post; the Feed''s list reads public.feed.hidden = false. Written only by post_hide and post_unhide. Personas (1116): member reads their own rows; Space lead and event host deliberately absent, because a hide is the member''s own and says nothing to a post''s author or anchor; admin deliberately absent, because no console shows a member''s hides; service role holds all. Gated by admission (H64-WG).';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'post_hides', 'exempt',
   'A member''s own choice to hide a post from their Feed; no console shows it.',
   'excluded', 'DIA reads nothing of a hide: it is the member''s own and is not a signal ruled for any suggestion.');

-- ---------------------------------------------------------------------------------------------------
-- 3. public.feed: the definition of 20260912090557 (416), the same rows in the same order, with
--    edited_at and the caller's own hide added at the end. security_invoker stays, so the audience
--    predicate is still the posts RLS and post_hides answers the caller's own rows alone.
-- ---------------------------------------------------------------------------------------------------

create or replace view public.feed
with (security_invoker = true)
as
select p.id,
  p.author_kind,
  p.author_id,
  p.created_by,
  p.c_category,
  p.body,
  p.anchor_kind,
  p.anchor_id,
  p.created_object_kind,
  p.created_object_id,
  p.audience,
  p.status,
  p.published_at,
  p.created_at,
  case when p.author_kind = 'member' and private.can_see_core(p.author_id) then mm.name end as author_name,
  case when p.author_kind = 'member' and private.can_see_core(p.author_id) then mm.handle end as author_handle,
  case when p.author_kind = 'member' and private.can_see_core(p.author_id) then mm.avatar_path end as author_avatar_path,
  p.edited_at,
  exists (select 1 from public.post_hides h
          where h.post_id = p.id and h.member_id = (select auth.uid())) as hidden
from public.posts p
left join public.members mm on p.author_kind = 'member' and mm.id = p.author_id
where p.status = 'published'
order by p.published_at desc, p.id desc;

-- ---------------------------------------------------------------------------------------------------
-- 4. Private helpers.
-- ---------------------------------------------------------------------------------------------------

-- Whether the caller may change and delete a post: the posts row policies' own test (member author,
-- or a lead of the authoring Space).
create function private.post_owned(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post
      and ((p.author_kind = 'member' and p.author_id = auth.uid())
           or (p.author_kind = 'space' and private.is_space_lead(p.author_id)))
  );
$$;

revoke all on function private.post_owned(uuid) from public, anon;
grant execute on function private.post_owned(uuid) to authenticated, service_role;

comment on function private.post_owned(uuid) is
  'Whether the caller may edit, change the audience of and delete a post (62-G2): the member who wrote a member post, or a lead of the Space that wrote a Space post, the same test posts_member_update, posts_space_lead_update and their delete twins apply. False for no such post.';

create function private.post_edit_write(p_post uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_post public.posts;
  v_body text := coalesce(p_body, '');
begin
  if not private.post_owned(p_post) then
    raise exception 'not_author' using errcode = '42501';
  end if;
  select p.* into v_post from public.posts p where p.id = p_post for update;
  if length(trim(v_body)) = 0
     and v_post.created_object_kind is null
     and not exists (select 1 from public.post_media pm where pm.post_id = p_post)
     and not exists (select 1 from public.post_links pl where pl.post_id = p_post) then
    raise exception 'empty_post' using errcode = '22023';
  end if;
  if v_body is distinct from v_post.body then
    update public.posts
    set body = v_body, edited_at = now()
    where id = p_post
    returning * into v_post;
  end if;
  return jsonb_build_object('id', v_post.id, 'body', v_post.body, 'edited_at', v_post.edited_at);
end;
$$;

revoke all on function private.post_edit_write(uuid, text) from public, anon;
grant execute on function private.post_edit_write(uuid, text) to authenticated, service_role;

comment on function private.post_edit_write(uuid, text) is
  'The one writer of a post''s body after publish (62-G2, F28), called by post_edit after the posts row policy has admitted the post: the caller must own it (private.post_owned); a body may be empty only while the post carries an image, a link or a created object; edited_at is set when the body changes and only then. Returns id, body and edited_at. Raises 42501 not_author and 22023 empty_post.';

create function private.post_audience_write(p_post uuid, p_audience public.audience)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_post public.posts;
begin
  if not private.post_owned(p_post) then
    raise exception 'not_author' using errcode = '42501';
  end if;
  if p_audience is null then
    raise exception 'bad_audience' using errcode = '22023';
  end if;
  select p.* into v_post from public.posts p where p.id = p_post for update;
  if p_audience = 'anchored' and v_post.anchor_kind is null then
    raise exception 'anchored_needs_anchor' using errcode = '22023';
  end if;
  if p_audience is distinct from v_post.audience then
    update public.posts set audience = p_audience where id = p_post returning * into v_post;
  end if;
  return jsonb_build_object('id', v_post.id, 'audience', v_post.audience);
end;
$$;

revoke all on function private.post_audience_write(uuid, public.audience) from public, anon;
grant execute on function private.post_audience_write(uuid, public.audience) to authenticated, service_role;

comment on function private.post_audience_write(uuid, public.audience) is
  'The one writer of a post''s audience after publish (62-G2, F29), called by post_set_audience after the posts row policy has admitted the post: the caller must own it; everyone, connections, or anchored where the post has an anchor, the values publish_post writes. Does not set edited_at. Raises 42501 not_author, 22023 bad_audience or anchored_needs_anchor.';

create function private.post_delete_write(p_post uuid)
returns void
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_comments uuid[];
  n record;
begin
  if not private.post_owned(p_post) then
    raise exception 'not_author' using errcode = '42501';
  end if;
  perform 1 from public.posts p where p.id = p_post for update;
  select coalesce(array_agg(c.id), '{}'::uuid[]) into v_comments
  from public.comments c where c.post_id = p_post;
  for n in
    select distinct x.recipient_member_id, x.kind::text as kind, x.object_kind, x.object_id
    from public.notifications x
    where (x.object_kind = 'post' and x.object_id = p_post)
       or (x.object_kind = 'comment' and x.object_id = any (v_comments))
  loop
    perform private.notification_retract(n.recipient_member_id, n.kind, n.object_kind, n.object_id);
  end loop;
  delete from public.posts where id = p_post;
end;
$$;

revoke all on function private.post_delete_write(uuid) from public, anon;
grant execute on function private.post_delete_write(uuid) to authenticated, service_role;

comment on function private.post_delete_write(uuid) is
  'The one delete of a post (62-G2, F31), called by post_delete after the posts row policy has admitted the post: the caller must own it; every notification whose object is the post or one of its comments is retracted through private.notification_retract, then the post is deleted and its reactions, intents, comments (with their reactions, intents and hides), saves, hides, media rows, links and DIA row go by cascade. Raises 42501 not_author.';

create function private.post_hide_write(p_post uuid, p_on boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
begin
  if p_on is null then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  if private.post_owned(p_post) then
    raise exception 'own_post' using errcode = '22023';
  end if;
  if p_on then
    insert into public.post_hides (member_id, post_id) values (v_uid, p_post)
    on conflict (member_id, post_id) do nothing;
  else
    delete from public.post_hides where member_id = v_uid and post_id = p_post;
  end if;
  return p_on;
end;
$$;

revoke all on function private.post_hide_write(uuid, boolean) from public, anon;
grant execute on function private.post_hide_write(uuid, boolean) to authenticated, service_role;

comment on function private.post_hide_write(uuid, boolean) is
  'The one writer of public.post_hides (62-G2, F27, F33), called by post_hide and post_unhide after the posts row policy has admitted the post: the caller''s own row, set or removed; idempotent both ways. A post the caller owns is not hidden (22023 own_post). Returns the state written.';

-- ---------------------------------------------------------------------------------------------------
-- 5. Public functions.
-- ---------------------------------------------------------------------------------------------------

create function public.post_edit(p_post uuid, p_body text)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_edit: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_edit: no such post' using errcode = '42501';
  end if;
  return private.post_edit_write(v_id, p_body);
end;
$$;

revoke all on function public.post_edit(uuid, text) from public, anon;
grant execute on function public.post_edit(uuid, text) to authenticated, service_role;

comment on function public.post_edit(uuid, text) is
  'The author''s edit of a published post''s body (62-G2, F26 Edit, F28 the edit Sheet): edited_at is set when the body changes, and the card''s meta reads "{date} · Edited" (F14). Returns id, body and edited_at. Security invoker; writes through private.post_edit_write.';

create function public.post_set_audience(p_post uuid, p_audience public.audience)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_set_audience: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_set_audience: no such post' using errcode = '42501';
  end if;
  return private.post_audience_write(v_id, p_audience);
end;
$$;

revoke all on function public.post_set_audience(uuid, public.audience) from public, anon;
grant execute on function public.post_set_audience(uuid, public.audience) to authenticated, service_role;

comment on function public.post_set_audience(uuid, public.audience) is
  'The author''s change of who sees a published post (62-G2, F26 Change audience, F29, F30): everyone, connections, or anchored where the post has an anchor. Who sees the post sees its reactions and comments, because their row policies read the post''s. Returns id and audience. Security invoker; writes through private.post_audience_write.';

create function public.post_delete(p_post uuid)
returns void
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_delete: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_delete: no such post' using errcode = '42501';
  end if;
  perform private.post_delete_write(v_id);
end;
$$;

revoke all on function public.post_delete(uuid) from public, anon;
grant execute on function public.post_delete(uuid) to authenticated, service_role;

comment on function public.post_delete(uuid) is
  'The author''s delete of a published post (62-G2, F26 Delete, F31, F32): the post, its reactions, intents, comments, saves and hides go for everyone, and the notifications naming it or its comments are retracted. Security invoker; writes through private.post_delete_write.';

create function public.post_hide(p_post uuid)
returns boolean
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_hide: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_hide: no such post' using errcode = '42501';
  end if;
  return private.post_hide_write(v_id, true);
end;
$$;

revoke all on function public.post_hide(uuid) from public, anon;
grant execute on function public.post_hide(uuid) to authenticated, service_role;

comment on function public.post_hide(uuid) is
  'Hide a published post the caller may see and did not write from their own Feed (62-G2, F27 "Hide this post", F33, F34). Returns true. Security invoker; writes through private.post_hide_write.';

create function public.post_unhide(p_post uuid)
returns boolean
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_unhide: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_unhide: no such post' using errcode = '42501';
  end if;
  return private.post_hide_write(v_id, false);
end;
$$;

revoke all on function public.post_unhide(uuid) from public, anon;
grant execute on function public.post_unhide(uuid) to authenticated, service_role;

comment on function public.post_unhide(uuid) is
  'Undo a hide (62-G2, F33 Undo, F34 "Post shown again"): the caller''s own post_hides row is removed. Returns false, the state written. Security invoker; writes through private.post_hide_write.';
