-- Handoff 62-G2 (Session 62), file 3 of 3: Report on posts and comments extends the Messenger's
-- report flow (HANDOFF-62-G "Done Means, PR 2" item 3, ruling 1844). The same reasons, read at
-- runtime from public.message_report_reasons; the same table and so the same review queue,
-- public.message_reports; the same staff read, private.report_message_view through
-- public.messenger_report_view, with its audit row. No second report table, sheet or queue. Report's
-- own build (1755, DESIGN-BRIEF-61-REPORT) is a separate item and nothing here forecloses it (1845):
-- the queue's columns are added to, never renamed or narrowed. Rulings 1349, 1350, 1352, 141, 186,
-- 1116, 1299, 1300, 225, 466, 564, 1827.
--
-- What ships:
--
--   1. public.message_reports gains what a report is about. subject_kind is message, post or
--      comment, not null with the default message, so every report on the project reads message,
--      which is what each of them is (564: the backfill is intended, and the column is not null, the
--      case the lint names). post_id and comment_id name the post or comment, each on delete set
--      null, because a report outlives what it reports as message_id already does (1352). A comment
--      report also names the comment's post. A check keeps a message report to message_id alone and
--      a post report to post_id alone. Indexes on both.
--   2. private.feed_report             the writer for a post or a comment, beside
--                                      private.message_report and in its shape: on something the
--                                      caller may read, not their own, a reason from the vocabulary,
--                                      a note of at most 500 characters; raises the same words
--                                      (bad_reason, bad_note) and own_post or own_comment.
--   3. public.post_report, public.comment_report   security invoker: each reads the post, or the
--                                      comment, under the caller's own policies first (audience and
--                                      blocks answer before anything is written), then writes
--                                      through private.feed_report.
--   4. private.report_message_view     its definition of 20261002130500 with the subject added: the
--                                      report carries subject_kind; a message report answers exactly
--                                      as before; a post report answers the post (its body, C,
--                                      audience, times and author's name) and a comment report the
--                                      comment (its text, whether it is a reply, times and author's
--                                      name) with its post's id; message is null and thread is empty,
--                                      as a purged message's report reads. The audit row is written
--                                      first, as before.
--
-- Readers of public.message_reports, each named in the PR: private.message_report (unchanged),
-- private.report_message_view (changed here), the policies message_reports_reporter_select,
-- message_reports_service_role, message_reports_live_arms_select and message_reports_admitted_gate
-- (unchanged; the reporter reads their own rows, now with the new columns). No admin surface reads
-- the table: the console's Moderation section is a placeholder with no reader. No view reads it.
--
-- This file deletes, drops and revokes nothing that exists on the project; the revokes below are on
-- the functions it creates. private.report_message_view is replaced under its own signature with
-- create or replace, which keeps its revoke and its comment is restated; its live body was read on
-- the project on 21 October 2026 and equals 20261002130500's byte for byte. Committed before it is
-- applied (225).
--
-- Admin block (1299): message_reports stays operated; a reported post or comment reaches staff
-- through the same projection as a reported message, and no console reads it yet.
-- DIA block (1300): message_reports stays excluded; DIA reads nothing of a report.

-- ---------------------------------------------------------------------------------------------------
-- 1. public.message_reports: what a report is about.
-- ---------------------------------------------------------------------------------------------------

alter table public.message_reports
  add column subject_kind text not null default 'message';
alter table public.message_reports
  add constraint message_reports_subject_kind_check check (subject_kind in ('message', 'post', 'comment'));
alter table public.message_reports
  add column post_id uuid references public.posts (id) on delete set null;
alter table public.message_reports
  add column comment_id uuid references public.comments (id) on delete set null;
alter table public.message_reports
  add constraint message_reports_subject_check check (
    (subject_kind = 'message' and post_id is null and comment_id is null)
    or (subject_kind = 'post' and message_id is null and comment_id is null)
    or (subject_kind = 'comment' and message_id is null)
  );
create index message_reports_post_idx on public.message_reports (post_id) where post_id is not null;
create index message_reports_comment_idx on public.message_reports (comment_id) where comment_id is not null;

comment on column public.message_reports.subject_kind is
  'What the report is about (62-G2, 1844): message, post or comment. Every report written before 20261021210200 is a message report.';
comment on column public.message_reports.post_id is
  'The reported post, or the reported comment''s post; null for a message report and once the post is deleted, because the report outlives it (1352).';
comment on column public.message_reports.comment_id is
  'The reported comment; null for a message or post report and once the comment is removed, because the report outlives it (1352).';

comment on table public.message_reports is
  'A member''s report of a message, a post or a comment (Brief 14, rulings 1349, 1350; 62-G2 under 1844 adds posts and comments to the one queue), with a reason from message_report_reasons and an optional note. subject_kind says which; message_id, post_id and comment_id name it and are null once it is gone (1352), because the report and its append-only audit outlive it. reporter_id is null once that account is gone. Personas (1116): reporter reads own; Space lead and event host deliberately absent; admin deliberately absent from policy, because staff read a report only through private.report_message_view, which writes message_view_audit (1350); service role all. No client role writes: private.message_report and private.feed_report are the writers.';

-- ---------------------------------------------------------------------------------------------------
-- 2. private.feed_report: private.message_report's shape for a post or a comment.
-- ---------------------------------------------------------------------------------------------------

create function private.feed_report(p_subject text, p_id uuid, p_reason text, p_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_post public.posts;
  v_comment public.comments;
  v_id uuid;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if p_subject = 'post' then
    select p.* into v_post from public.posts p where p.id = p_id;
    if v_post.id is null then
      raise exception 'feed_report: no such post' using errcode = '42501';
    end if;
    if private.post_owned(p_id) or v_post.created_by = v_uid then
      raise exception 'own_post' using errcode = '22023';
    end if;
  elsif p_subject = 'comment' then
    select c.* into v_comment from public.comments c where c.id = p_id;
    if v_comment.id is null or v_comment.deleted_at is not null then
      raise exception 'feed_report: no such comment' using errcode = '42501';
    end if;
    if v_comment.author_id = v_uid then
      raise exception 'own_comment' using errcode = '22023';
    end if;
  else
    raise exception 'bad_subject' using errcode = '22023';
  end if;
  if not exists (select 1 from public.message_report_reasons r where r.value = p_reason) then
    raise exception 'bad_reason' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'bad_note' using errcode = '22023';
  end if;
  insert into public.message_reports (subject_kind, post_id, comment_id, reporter_id, reason, note)
  values (p_subject,
          case when p_subject = 'post' then v_post.id else v_comment.post_id end,
          case when p_subject = 'comment' then v_comment.id end,
          v_uid, p_reason, v_note)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function private.feed_report(text, uuid, text, text) from public, anon;
grant execute on function private.feed_report(text, uuid, text, text) to authenticated, service_role;

comment on function private.feed_report(text, uuid, text, text) is
  'The writer of a post''s or a comment''s report into public.message_reports, the Messenger''s one queue (62-G2, 1844), in private.message_report''s shape: called by post_report and comment_report after the caller''s own row policies have admitted the post or comment; never the caller''s own (22023 own_post, own_comment), a reason from message_report_reasons (bad_reason), a note of at most 500 characters (bad_note). Returns the report''s id.';

-- ---------------------------------------------------------------------------------------------------
-- 3. Public functions.
-- ---------------------------------------------------------------------------------------------------

create function public.post_report(p_post uuid, p_reason text, p_note text default null)
returns uuid
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'post_report: not signed in' using errcode = '42501';
  end if;
  select p.id into v_id from public.posts p where p.id = p_post and p.status = 'published';
  if v_id is null then
    raise exception 'post_report: no such post' using errcode = '42501';
  end if;
  return private.feed_report('post', v_id, p_reason, p_note);
end;
$$;

revoke all on function public.post_report(uuid, text, text) from public, anon;
grant execute on function public.post_report(uuid, text, text) to authenticated, service_role;

comment on function public.post_report(uuid, text, text) is
  'Report a published post the caller may see and did not write (62-G2, F24 "Report this post", F25), with a reason from message_report_reasons and an optional note, into the Messenger''s one queue (1844). Returns the report''s id. Security invoker; writes through private.feed_report.';

create function public.comment_report(p_comment uuid, p_reason text, p_note text default null)
returns uuid
language plpgsql
volatile
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'comment_report: not signed in' using errcode = '42501';
  end if;
  select c.id into v_id
  from public.comments c join public.posts p on p.id = c.post_id
  where c.id = p_comment and c.deleted_at is null and p.status = 'published';
  if v_id is null then
    raise exception 'comment_report: no such comment' using errcode = '42501';
  end if;
  return private.feed_report('comment', v_id, p_reason, p_note);
end;
$$;

revoke all on function public.comment_report(uuid, text, text) from public, anon;
grant execute on function public.comment_report(uuid, text, text) to authenticated, service_role;

comment on function public.comment_report(uuid, text, text) is
  'Report a comment the caller may read and did not write (62-G2, SPEC-62 9 M.report, F24 "Report this comment", F25), with a reason from message_report_reasons and an optional note, into the Messenger''s one queue (1844). Returns the report''s id. Security invoker; writes through private.feed_report.';

-- ---------------------------------------------------------------------------------------------------
-- 4. private.report_message_view: 20261002130500's body with the subject added.
-- ---------------------------------------------------------------------------------------------------

create or replace function private.report_message_view(p_report uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_report public.message_reports;
  v_msg public.messages;
  v_thread public.threads;
  v_post public.posts;
  v_comment public.comments;
begin
  if v_uid is null or not private.is_admin() then
    raise exception 'not_staff' using errcode = '42501';
  end if;
  select * into v_report from public.message_reports r where r.id = p_report;
  if v_report.id is null then
    raise exception 'no_report' using errcode = '22023';
  end if;
  insert into public.message_view_audit (report_id, staff_id) values (p_report, v_uid);
  select * into v_msg from public.messages m where m.id = v_report.message_id;
  select * into v_thread from public.threads t where t.id = v_msg.thread_id;
  select * into v_post from public.posts p where p.id = v_report.post_id;
  select * into v_comment from public.comments c where c.id = v_report.comment_id;
  return jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id, 'reason', v_report.reason, 'note', v_report.note,
      'state', v_report.state, 'created_at', v_report.created_at,
      'subject_kind', v_report.subject_kind,
      'reporter', (select m.name from public.members m where m.id = v_report.reporter_id)),
    'thread', jsonb_build_object(
      'id', v_thread.id, 'kind', v_thread.kind, 'name', v_thread.name,
      'created_at', v_thread.created_at, 'last_activity_at', v_thread.last_activity_at,
      'members', (select coalesce(jsonb_agg(m.name order by m.name), '[]'::jsonb)
                  from public.thread_members tm join public.members m on m.id = tm.member_id
                  where tm.thread_id = v_thread.id and tm.state = 'active'),
      'message_count', (select count(*) from public.messages m where m.thread_id = v_thread.id)),
    'message', case when v_msg.id is null then null else jsonb_build_object(
      'id', v_msg.id, 'seq', v_msg.seq, 'kind', v_msg.kind, 'body', v_msg.body,
      'media_id', v_msg.media_id, 'created_at', v_msg.created_at,
      'edited_at', v_msg.edited_at, 'deleted_at', v_msg.deleted_at,
      'author', case when v_msg.author_deleted_at is not null then 'a former member'
                     else (select m.name from public.members m where m.id = v_msg.author_id) end) end,
    'post', case when v_post.id is null then null else jsonb_build_object(
      'id', v_post.id, 'c_category', v_post.c_category, 'body', v_post.body,
      'audience', v_post.audience, 'published_at', v_post.published_at,
      'edited_at', v_post.edited_at,
      'author', case when v_post.author_kind = 'member'
                     then (select m.name from public.members m where m.id = v_post.author_id)
                     else (select s.title from public.spaces s where s.id = v_post.author_id) end) end,
    'comment', case when v_comment.id is null then null else jsonb_build_object(
      'id', v_comment.id, 'post_id', v_comment.post_id, 'reply', v_comment.parent_id is not null,
      'body', v_comment.body, 'media_id', v_comment.media_id,
      'created_at', v_comment.created_at, 'edited_at', v_comment.edited_at,
      'deleted_at', v_comment.deleted_at,
      'author', (select m.name from public.members m where m.id = v_comment.author_id)) end);
end;
$$;

comment on function private.report_message_view(uuid) is
  'The one way staff read a reported message''s, post''s or comment''s text (Brief 14, ruling 1350; 62-G2 under 1844): an admin at aal2 (1265), one report with its subject_kind, a message_view_audit row written first; for a message, the thread''s kind, members, created, last active and an internal message count, and the one message, exactly as before; for a post, the post''s body, C, audience, times and author''s name; for a comment, its text, image id, whether it is a reply, times, author''s name and its post''s id. What is gone answers null. Reached through public.messenger_report_view; no policy grants staff a message, a post or a comment.';
