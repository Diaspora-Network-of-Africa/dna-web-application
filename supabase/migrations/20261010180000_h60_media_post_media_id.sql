-- H60-MEDIA (ruling 1709): post_media names the media row it was uploaded as, so the Feed's one
-- read can carry the author's framing (focal_point, crop) beside the stored size. The media row is
-- the one owner of framing (1673); post_media keeps only the key, never a copy.
--
-- 1. post_media.media_id, a nullable key to public.media. Nullable because a post image published
--    before its media row existed renders through MediaBlock's own default, which is grounded.
-- 2. Backfill from storage_path, which public.media holds unique (media_storage_path_key), limited
--    to the post-media bucket and to media owned by the post's creator.
-- 3. A BEFORE INSERT trigger sets media_id from the same match, so publish_post, the one writer of
--    post_media, is left byte-for-byte as it is. A caller that supplies media_id has it checked
--    against the same rule, so no post can point at another member's media.
-- 4. A SELECT policy on public.media for a row that a visible post_media row names. post_media's
--    own policy decides visibility (it reads public.posts under the viewer's row policy, 141), so a
--    viewer reads framing for exactly the post images they can already see, and nothing else.

alter table public.post_media
  add column media_id uuid references public.media (id) on delete set null;

create index post_media_media_id_idx on public.post_media (media_id);

update public.post_media pm
   set media_id = m.id
  from public.media m, public.posts p
 where pm.media_id is null
   and p.id = pm.post_id
   and m.storage_path = pm.storage_path
   and m.bucket = 'post-media'
   and m.owner_id = p.created_by;

create or replace function private.post_media_link_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creator uuid;
  v_media uuid;
begin
  select p.created_by into v_creator from public.posts p where p.id = new.post_id;

  select m.id into v_media
    from public.media m
   where m.storage_path = new.storage_path
     and m.bucket = 'post-media'
     and m.owner_id = v_creator;

  if new.media_id is not null and new.media_id is distinct from v_media then
    raise exception 'post_media: media_id does not match this post''s upload' using errcode = '42501';
  end if;

  new.media_id := v_media;
  return new;
end;
$$;

revoke all on function private.post_media_link_media() from public, anon, authenticated;

create trigger post_media_link_media
  before insert on public.post_media
  for each row execute function private.post_media_link_media();

create policy media_post_viewer_select on public.media
  for select to authenticated
  using (
    exists (
      select 1
        from public.post_media pm
       where pm.media_id = media.id
    )
  );
