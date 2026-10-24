-- Handoff 62-G2 (Session 62), file 2 of 3: the comment menu on the server. HANDOFF-62-G "Done Means,
-- PR 2" item 2 and "Data, PR 2": comment edit and delete, comment hides per member with undo, and
-- what the menu needs to know of each commenter for the viewer. SPEC-62-FEED-CARD section 9 (1810,
-- 1820), B60 F14, F15, F19 to F23; with 141, 186, 1319, 1677, 1797, 1116, 1299, 1300, 225, 466,
-- 564, 1827.
--
-- What ships:
--
--   1. public.comment_hides           one row per member per comment they asked not to see
--                                     (M.seeLess "I don't want to see this"); the thread renders it
--                                     collapsed to one line, Hidden with Undo (M.hidden, M.undo), for
--                                     that member only. Written only by comment_hide and
--                                     comment_unhide.
--   2. private.comment_json           62-G's definition with three facts added for the caller:
--                                     hidden (the caller's own hide), and on the author, following
--                                     (the caller follows them: M.unfollow is absent where false) and
--                                     messageable (private.messenger_reachable from the caller:
--                                     M.message is absent where false). Nothing else changes, and a
--                                     tombstone still answers nothing about who wrote it.
--   3. private.post_latest_comments_for  62-G's definition with the caller's hidden comments left
--                                     out of the collapsed card's one line, as deleted ones are.
--   4. Functions, every one on auth.uid(), none taking the viewer as a parameter. Each public
--      function is security invoker: it reads public.comments under the caller's own policies (so
--      the post's audience and the block both answer first), then calls a private security definer
--      helper that does the row work for auth.uid().
--        public.comment_edit     the commenter's new text; edited_at is set when it changes
--        public.comment_delete   the commenter's, or the post author's, delete: a top-level comment
--                                with a reply standing under it stays as the tombstone (F15) and its
--                                replies stay; any other comment is removed
--        public.comment_hide     M.seeLess
--        public.comment_unhide   M.undo
--
-- Readings taken here and named in the PR:
--   An edit changes the text alone; the image stays as sent. Text may be emptied only where the
--     comment carries an image, the floor comments_content_check already holds.
--   The commenter edits; the post's author deletes but does not edit (SPEC 9: M.edit is the
--     commenter's, M.delete the commenter's and the post author's). "The post's author" is
--     private.post_author, the member who wrote a member post or pressed Publish on a Space's.
--   A tombstone keeps no reactions or intents: they are deleted with the text, because nothing on
--     a tombstone can be read or answered. Notifications whose object is the comment are retracted
--     when it is removed outright, and its intents' notifications when it becomes a tombstone; a
--     reply's notification names its parent as object (62-G) and is left to the parent.
--   Deleting the last reply under a tombstone removes the tombstone too, which is what the thread
--     already shows (post_comments_for keeps a tombstone only while a reply stands under it).
--   A member does not hide their own comment; the commenter's menu has no M.seeLess (SPEC 9).
--   The image a removed comment carried stays in public.media and in storage, as comments.media_id's
--     on delete set null leaves it; named as the same gap as the post's.
--
-- This file carries deletes inside function bodies only (comment_delete's removal of a comment,
-- its tombstone's reactions and intents, and the retract it calls; comment_unhide's removal of the
-- caller's own hide row); nothing outside a function body deletes, drops or revokes a thing that
-- exists on the project. comment_json and post_latest_comments_for are replaced under their own
-- signatures with create or replace, which keeps their grants and comments; their live bodies were
-- read on the project on 21 October 2026 and equal 20261016120100's byte for byte. Committed before
-- it is applied (225).
--
-- Admin block (1299): comment_hides is exempt, a member's own preference that no console shows.
-- DIA block (1300): comment_hides is excluded; DIA reads nothing of a hide.

-- ---------------------------------------------------------------------------------------------------
-- 1. public.comment_hides (M.seeLess, M.hidden, M.undo).
-- ---------------------------------------------------------------------------------------------------

create table public.comment_hides (
  member_id uuid not null references public.members (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, comment_id)
);
create index comment_hides_comment_idx on public.comment_hides (comment_id);

alter table public.comment_hides enable row level security;
revoke all on table public.comment_hides from public, anon, authenticated;
grant select on table public.comment_hides to authenticated;
grant all on table public.comment_hides to service_role;

create policy comment_hides_owner_select on public.comment_hides
  for select to authenticated
  using (member_id = (select auth.uid()));
create policy comment_hides_service_role on public.comment_hides
  for all to service_role using (true) with check (true);
create policy comment_hides_admitted_gate on public.comment_hides
  as restrictive for all to authenticated
  using ((select private.is_admitted())) with check ((select private.is_admitted()));

comment on table public.comment_hides is
  'A comment a member asked not to see (62-G2, SPEC-62 9: M.seeLess "I don''t want to see this"); the thread renders it collapsed to one line, Hidden with Undo, for that member only. Written only by comment_hide and comment_unhide. Personas (1116): member reads their own rows; Space lead and event host deliberately absent, because a hide is the member''s own and says nothing to a post''s anchor; admin deliberately absent, because no console shows a member''s hides; service role holds all. Gated by admission (H64-WG).';

insert into public.admin_catalogue (schema_name, table_name, admin_treatment, admin_reason, dia_treatment, dia_reason) values
  ('public', 'comment_hides', 'exempt',
   'A member''s own choice to collapse a comment; no console shows it.',
   'excluded', 'DIA reads nothing of a hide: it is the member''s own and is not a signal ruled for any suggestion.');

-- ---------------------------------------------------------------------------------------------------
-- 2. private.comment_json: 20261016120100's body with hidden, and following and messageable on the
--    author, for the caller.
-- ---------------------------------------------------------------------------------------------------

create or replace function private.comment_json(c public.comments, p_post_author uuid, p_rx jsonb)
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
    'hidden', c.deleted_at is null
              and exists (select 1 from public.comment_hides h
                          where h.comment_id = c.id and h.member_id = auth.uid()),
    'author', case
      when c.deleted_at is not null then null
      when c.author_id = auth.uid() or private.visible_to(c.author_id) then
        (select jsonb_build_object('id', m.id, 'name', m.name, 'handle', m.handle, 'avatar_path', m.avatar_path,
                                   'following', exists (select 1 from public.member_follows f
                                                        where f.follower_id = auth.uid() and f.member_id = m.id),
                                   'messageable', private.messenger_reachable(auth.uid(), m.id))
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

comment on function private.comment_json(public.comments, uuid, jsonb) is
  'One comment as the thread, the collapsed card and comment_post answer it (62-G, 1817, 1820; 62-G2): author with id, name, handle and photo only where private.visible_to admits them for the caller, else null for the client''s role, and on that author whether the caller follows them and whether private.messenger_reachable admits a message from the caller (SPEC-62 9: M.unfollow and M.message are absent where false); hidden, the caller''s own comment_hides row; the post author''s mark; the image''s media row; absolute times; the reaction summary read out of p_rx by id. A deleted comment answers deleted true and no author, body, media, hide or reactions.';

-- ---------------------------------------------------------------------------------------------------
-- 3. private.post_latest_comments_for: 20261016120100's body, the caller's hidden comments left out.
-- ---------------------------------------------------------------------------------------------------

create or replace function private.post_latest_comments_for(p_posts uuid[])
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
      and not exists (select 1 from public.comment_hides h
                      where h.comment_id = c.id and h.member_id = auth.uid())
    order by c.post_id, c.created_at desc, c.id desc
  ) x;
$$;

comment on function private.post_latest_comments_for(uuid[]) is
  'The newest comment per post for ids the posts row policy has admitted (62-G, SPEC-62 8.3): the newest the caller may read, never deleted and never one the caller hid (62-G2), with its author where private.visible_to admits them; keyed by post id, no summary, never a count (1797). Called by post_latest_comments alone.';

-- ---------------------------------------------------------------------------------------------------
-- 4. Private helpers.
-- ---------------------------------------------------------------------------------------------------

create function private.comment_edit_write(p_comment uuid, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.comments;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  select c.* into v_row from public.comments c where c.id = p_comment for update;
  if v_row.id is null or v_row.deleted_at is not null then
    raise exception 'comment_edit: no such comment' using errcode = '42501';
  end if;
  if v_row.author_id <> v_uid then
    raise exception 'not_author' using errcode = '42501';
  end if;
  if v_body is null and v_row.media_id is null then
    raise exception 'empty_comment' using errcode = '22023';
  end if;
  if v_body is not null and length(v_body) > 2000 then
    raise exception 'body_too_long' using errcode = '22023';
  end if;
  if v_body is distinct from v_row.body then
    update public.comments
    set body = v_body, edited_at = now()
    where id = p_comment
    returning * into v_row;
  end if;
  return private.comment_json(v_row, private.post_author(v_row.post_id),
                              private.comment_reaction_rows_for(array[v_row.id]));
end;
$$;

revoke all on function private.comment_edit_write(uuid, text) from public, anon;
grant execute on function private.comment_edit_write(uuid, text) to authenticated, service_role;

comment on function private.comment_edit_write(uuid, text) is
  'The one writer of a comment''s text after it is sent (62-G2, M.edit, F19 "Editing your comment", F21 "Comment edited"), called by comment_edit after the comments row policy has admitted the comment: the commenter alone; text of 1 to 2000 characters, or none where the comment carries an image; edited_at set when the text changes and only then. Returns the comment as the thread renders it, without its replies. Raises 42501 for no such comment or not_author, 22023 empty_comment or body_too_long.';

create function private.comment_delete_write(p_comment uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.comments;
  v_parent public.comments;
  v_tombstone boolean;
  n record;
begin
  select c.* into v_row from public.comments c where c.id = p_comment for update;
  if v_row.id is null or v_row.deleted_at is not null then
    raise exception 'comment_delete: no such comment' using errcode = '42501';
  end if;
  if v_row.author_id <> v_uid and private.post_author(v_row.post_id) is distinct from v_uid then
    raise exception 'not_author' using errcode = '42501';
  end if;

  v_tombstone := v_row.parent_id is null
                 and exists (select 1 from public.comments r
                             where r.parent_id = v_row.id and r.deleted_at is null);

  for n in
    select distinct x.recipient_member_id, x.kind::text as kind, x.object_kind, x.object_id
    from public.notifications x
    where x.object_kind = 'comment' and x.object_id = p_comment
      and (not v_tombstone or x.kind::text in ('intent_help', 'intent_build'))
  loop
    perform private.notification_retract(n.recipient_member_id, n.kind, n.object_kind, n.object_id);
  end loop;

  if v_tombstone then
    delete from public.comment_reactions where comment_id = p_comment;
    delete from public.comment_intents where comment_id = p_comment;
    delete from public.comment_hides where comment_id = p_comment;
    update public.comments
    set deleted_at = now(), body = null, media_id = null
    where id = p_comment;
  else
    delete from public.comments where id = p_comment;
    if v_row.parent_id is not null then
      select c.* into v_parent from public.comments c where c.id = v_row.parent_id for update;
      if v_parent.deleted_at is not null
         and not exists (select 1 from public.comments r
                         where r.parent_id = v_parent.id and r.deleted_at is null) then
        for n in
          select distinct x.recipient_member_id, x.kind::text as kind, x.object_kind, x.object_id
          from public.notifications x
          where x.object_kind = 'comment' and x.object_id = v_parent.id
        loop
          perform private.notification_retract(n.recipient_member_id, n.kind, n.object_kind, n.object_id);
        end loop;
        delete from public.comments where id = v_parent.id;
      end if;
    end if;
  end if;

  return jsonb_build_object('id', p_comment, 'tombstone', v_tombstone);
end;
$$;

revoke all on function private.comment_delete_write(uuid) from public, anon;
grant execute on function private.comment_delete_write(uuid) to authenticated, service_role;

comment on function private.comment_delete_write(uuid) is
  'The one delete of a comment (62-G2, M.delete, F15, F23), called by comment_delete after the comments row policy has admitted the comment: the commenter or the post''s author (private.post_author). A top-level comment with a reply standing under it becomes the tombstone, its text, image, reactions, intents and hides removed and its intents'' notifications retracted, and its replies stay; any other comment is removed with every notification whose object it is, and a tombstone left with no reply under it goes too, with its notifications. Returns id and whether a tombstone stays. Raises 42501 for no such comment or not_author.';

create function private.comment_hide_write(p_comment uuid, p_on boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_row public.comments;
begin
  if p_on is null then
    raise exception 'bad_state' using errcode = '22023';
  end if;
  select c.* into v_row from public.comments c where c.id = p_comment;
  if v_row.id is null or v_row.deleted_at is not null then
    raise exception 'comment_hide: no such comment' using errcode = '42501';
  end if;
  if v_row.author_id = v_uid then
    raise exception 'own_comment' using errcode = '22023';
  end if;
  if p_on then
    insert into public.comment_hides (member_id, comment_id) values (v_uid, p_comment)
    on conflict (member_id, comment_id) do nothing;
  else
    delete from public.comment_hides where member_id = v_uid and comment_id = p_comment;
  end if;
  return p_on;
end;
$$;

revoke all on function private.comment_hide_write(uuid, boolean) from public, anon;
grant execute on function private.comment_hide_write(uuid, boolean) to authenticated, service_role;

comment on function private.comment_hide_write(uuid, boolean) is
  'The one writer of public.comment_hides (62-G2, M.seeLess, M.undo), called by comment_hide and comment_unhide after the comments row policy has admitted the comment: the caller''s own row, set or removed, idempotent both ways. The caller''s own comment is not hidden (22023 own_comment). Returns the state written.';

-- ---------------------------------------------------------------------------------------------------
-- 5. Public functions.
-- ---------------------------------------------------------------------------------------------------

create function public.comment_edit(p_comment uuid, p_body text)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_edit: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_edit: no such comment' using errcode = '42501';
  end if;
  return private.comment_edit_write(v_id, p_body);
end;
$$;

revoke all on function public.comment_edit(uuid, text) from public, anon;
grant execute on function public.comment_edit(uuid, text) to authenticated, service_role;

comment on function public.comment_edit(uuid, text) is
  'The commenter''s edit of their comment''s text (62-G2, SPEC-62 9 M.edit, F19, F20 Save, F21 "Comment edited"): edited_at is set when the text changes and the comment''s meta reads Edited (F14). Returns the comment as the thread renders it. Security invoker; writes through private.comment_edit_write.';

create function public.comment_delete(p_comment uuid)
returns jsonb
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_delete: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_delete: no such comment' using errcode = '42501';
  end if;
  return private.comment_delete_write(v_id);
end;
$$;

revoke all on function public.comment_delete(uuid) from public, anon;
grant execute on function public.comment_delete(uuid) to authenticated, service_role;

comment on function public.comment_delete(uuid) is
  'Delete a comment, by its commenter or the post''s author (62-G2, SPEC-62 9 M.delete, F23, F21 "Comment deleted"): a top-level comment with replies stays as the tombstone (F15) and its replies stay; any other is removed for everyone. Returns id and tombstone. Security invoker; writes through private.comment_delete_write.';

create function public.comment_hide(p_comment uuid)
returns boolean
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_hide: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_hide: no such comment' using errcode = '42501';
  end if;
  return private.comment_hide_write(v_id, true);
end;
$$;

revoke all on function public.comment_hide(uuid) from public, anon;
grant execute on function public.comment_hide(uuid) to authenticated, service_role;

comment on function public.comment_hide(uuid) is
  'Collapse a comment the caller may read and did not write, for the caller only (62-G2, SPEC-62 9 M.seeLess "I don''t want to see this"). Returns true. Security invoker; writes through private.comment_hide_write.';

create function public.comment_unhide(p_comment uuid)
returns boolean
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_unhide: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_unhide: no such comment' using errcode = '42501';
  end if;
  return private.comment_hide_write(v_id, false);
end;
$$;

revoke all on function public.comment_unhide(uuid) from public, anon;
grant execute on function public.comment_unhide(uuid) to authenticated, service_role;

comment on function public.comment_unhide(uuid) is
  'Undo a comment''s hide (62-G2, SPEC-62 9 M.undo). Returns false, the state written. Security invoker; writes through private.comment_hide_write.';
