-- Handoff 62-A (Session 62), file 1 of 2: public.anchor_kind gains 'post' (rulings 1802, 1817, 1823
-- and 255). Committed before it is applied (225); applied by Chat through execute_sql (963), with its
-- supabase_migrations.schema_migrations row in the same transaction, and never by apply_migration
-- (553, 269).
--
-- Why this file stands alone. A value added by ALTER TYPE ... ADD VALUE cannot be used in the
-- transaction that adds it. 20261015120100 writes intent notifications whose object is the post
-- (private.notify's p_object_kind), and private.notification_c_for reads a post's C for the two
-- intent kinds, so this file is applied and committed in its own transaction first, and
-- 20261015120100 runs in a second, as 20260921140000 and 20261008120000 did before it.
--
-- post is the anchor an intent notification points at: the one public.posts row the row is about,
-- the way event_party is the anchor of role_invitation and thread the anchor of thread_invitation.
-- Nothing here writes a row. Nothing destructive.

alter type public.anchor_kind add value if not exists 'post';
