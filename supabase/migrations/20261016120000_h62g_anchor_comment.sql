-- Handoff 62-G (Session 62), PR 1, file 1 of 2: public.anchor_kind gains 'comment' (rulings 1844,
-- 1848, 1849; 1817 and 255). Committed before it is applied (225); applied through migrate.yml,
-- rehearse then apply, each approved by the founder (1827), with its supabase_migrations row in the
-- same transaction, and never by apply_migration (553).
--
-- Why this file stands alone. A value added by ALTER TYPE ... ADD VALUE cannot be used in the
-- transaction that adds it. 20261016120100 writes reply notifications whose object is the comment
-- (private.notify's p_object_kind), writes intent notifications on a comment under 1817 with the same
-- object, and private.notification_c_for reads a comment's post's C for all three kinds, so this
-- file is applied and committed in its own transaction first, and 20261016120100 runs in a second,
-- as 20261015120000 and 20261015120100 did before it.
--
-- comment is the anchor a reply_to_comment notification points at, and the object of an intent on a
-- comment (1817): the one public.comments row the row is about, the way post is the anchor of
-- comment_on_post and of an intent on a post. Nothing here writes a row. Nothing destructive.

alter type public.anchor_kind add value if not exists 'comment';
