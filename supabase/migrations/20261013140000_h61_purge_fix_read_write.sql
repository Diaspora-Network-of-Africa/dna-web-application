-- Brief 14 Messenger, handoff H61-PURGE-FIX (G280; rulings 1343, 1405).
-- Both functions were declared stable and call private.require_uid(), which inserts the member's
-- member_messaging_settings row. PostgREST runs a stable function's RPC in a read-only transaction,
-- so every call from the delete route's sweep (src/routes/api/messages/media_.$id.ts) and from the
-- reaction picker's Recent row failed with 25006, cannot execute INSERT in a read-only transaction,
-- which the project's Postgres log carries for each call. Volatile puts the RPC in a read-write
-- transaction; the bodies are unchanged. Rehearsed by Chat on the canonical project and rolled back:
-- the listing returned twenty rows and recent reactions one, no error.
--
-- Committed before it is applied (225); applied by Chat through execute_sql (963); a new file, never
-- an amendment of the applied ones (466).

alter function public.messenger_media_marked(integer) volatile;
alter function public.messenger_recent_reactions() volatile;
