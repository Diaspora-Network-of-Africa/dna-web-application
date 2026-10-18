// Edited by hand on handoff H64-WG's branch for 20261018120000_h64_wg_launch_gate.sql, ahead of its
// apply, to the shape the generator will produce: `members.admitted_at` (Row, Insert, Update) and the
// function `admin_admit_all`; `onboarding_state` keeps `Json`, so its new `admitted` key moves
// nothing here. Regenerated after the apply, as 20261015120100 was (CLAUDE.md: commit, apply,
// regenerate, enforcing run, merge).
//
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff H62-G's branch (#120, the Feed card's comments), on main
// at fa4ef051 (the merge of #118), after the founder applied 20261016120000 and then 20261016120100
// through migrate.yml (1827) and Chat read the project back at 18:18 PDT on 18 October 2026: ledger
// head 20261016120100_h62g_feed_comments, md5 f6359cc818858c95a0856d84519c89ce equal to the file at
// 72d288b, and 20261016120000 at a861e3c6e565cb0a4f5927c9b44fd3cd. What it changes here: the tables
// comments, comment_reactions and comment_intents with their relationships; the functions
// comment_post, post_comments, post_latest_comments, comment_react, comment_intent,
// comment_reaction_rows, comment_reactors_visible and comment_reactors_author; and `comment` in
// anchor_kind. Nothing else moves. `export type Views` is restored by hand after every regeneration
// (CLAUDE.md).
//
// Before H62-G:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff H62-A's branch (#116, the Feed card's reactions), on
// main at efae54e (the merge of #117), after the founder applied 20261015120000 and then
// 20261015120100 through migrate.yml (apply run approved from the Actions tab under rulings 1827 and
// 1828) and Chat read the project back at 23:30 PDT on 15 October 2026: ledger head
// 20261015120100_h62a_feed_reactions, md5 a34f71d27856384f3f06bbbcc2c9f970 equal to the file. What it
// changes here: the tables member_reaction_picks, post_intents, post_reaction_glosses and
// post_reaction_kinds, the kind and emoji columns of post_reactions with the emoji relationship, the
// functions member_recent_reactions, post_intent, post_react, post_reaction_rows,
// post_reactors_author and post_reactors_visible, and `post` in anchor_kind. Nothing else moves.
// `export type Views` is restored by hand after every regeneration (CLAUDE.md).
//
// Before H62-A:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff H61-S1's branch (#112, the Account drawer), on main at
// 3725471 (the merge of #110), after the founder applied 20261013120000 by SQL Editor paste under
// 1528 and Chat read it back at 01:20 PDT on 13 October 2026 with the recorded drift md5 equal to the
// file (4dcf1a5c5fb56f35e3f99a0de6b11430); 115 rows in schema_migrations, head
// 20261013120000_h61_s1_sessions. What it changes here: `sessions_list` and `session_revoke` join
// Functions in the generator's own shape, replacing the hand edit the branch carried before the
// paste, and `PostgrestVersion` reads what the project reports. Nothing else moves. `export type
// Views` is restored by hand after every regeneration (CLAUDE.md).
//
// Before H61-S1:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff H60-NC's branch, on main at bff0906 (the merge of #108),
// after the founder applied 20261012120000 by SQL Editor paste and Chat read it back at 20:47 PDT on
// 11 October 2026 with the recorded drift md5 equal to the file (c1eb7f559903792583938a29c403f950);
// 114 rows in schema_migrations, head 20261012120000_h60_nc_notification_controls. What it changes
// here: `notification_categories` and `notification_email_modes` (Row, Insert, Update);
// `notification_kinds` and `notification_preferences` each gain the foreign key to
// `notification_email_modes`; `email_unsubscribe`, `email_unsubscribe_mint` and
// `notification_email_view` join Functions. Nothing else moves. `export type Views` is restored by
// hand after every regeneration (CLAUDE.md).
//
// Before H60-NC:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff H60-MEDIA's branch, on main at d0ac9fe (the merge of
// #106), after Chat applied 20261010180000 through execute_sql at 17:40 PDT on 10 October 2026 with
// the recorded statement md5 equal to the file (f97d7bcef5878c8d725504f73efaf096); 113 rows in
// schema_migrations, head 20261010180000_h60_media_post_media_id. What it changes here:
// `post_media` gains `media_id` (Row, Insert, Update) and its `post_media_media_id_fkey`
// relationship to `media` (1709). Nothing else moves. `export type Views` is restored by hand after
// every regeneration (CLAUDE.md).
//
// Before H60-MEDIA:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 58-12C2's branch (#105, the member app's recording), on
// main at 6ce161f (the merge of #104), after Chat applied 20261010170000 through execute_sql at 10:33
// PDT on 10 October 2026 with the recorded statement md5 equal to the file; 112 rows in
// schema_migrations, head 20261010170000_h58_12c2_recording. What it changes here:
// `surface_event_kinds` gains `anonymous` (1616) in Row, Insert and Update, appended by the generator
// in column order. The two function bodies it replaces reach no signature, so nothing else moves.
// `export type Views` is restored by hand after every regeneration (CLAUDE.md).
//
// Before 58-12C2:
// Regenerated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 44-MC-R3's branch (#104, the MemberCard port), on main at
// be8b7be (the merge of #103), after Chat applied 20261010120000 through execute_sql at 01:33 PDT on
// 10 October 2026 with the recorded statement md5 equal to the file; 111 rows in schema_migrations,
// head 20261010120000_h44_mc_mutuals_since. The migration changes two function bodies and no
// signature, so the generated body is byte-identical to the one below and nothing but this header
// moves. `export type Views` is restored by hand after every regeneration (CLAUDE.md).
//
// Before 44-MC-R3:
// Generated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on Fix PR 10's branch (#103, handoff 59-FIX-10 and addendum 1),
// on main at c264d09 (the merge of #102), after Chat applied 20261009120000, 20261009120100 and
// 20261009120200 through execute_sql at about 14:20 PDT on 9 October 2026, each ledger row read
// back at its committed file's md5; 109 rows in schema_migrations, head
// 20261009120200_fix10_invited_by_name. Taken from the project whole, never merged by hand.
//
// What Fix PR 10 changes here: `messenger_threads_view` gains `invited_by_name` (1638), appended
// last. 20261009120000 and 20261009120100 change function bodies and one vocabulary row and reach no
// signature, so nothing else moves. `export type Views` below is restored by hand after every
// regeneration, because the generator drops it (CLAUDE.md).
//
// Before Fix PR 10:
// Generated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 56-41E's branch (#102, the Messenger's second pass),
// rebased on main at 7669045 (the merge of #101), after Chat applied 20261008150000 to
// 20261008150700 (150000, 150300, 150400, 150500 and 150600 through execute_sql; 150100, 150200 and
// 150700 by the founder's SQL Editor paste under 1528, 150200 because the guard refused its two
// `drop function` statements), each ledger row read back at its committed file's raw md5; 106 rows
// in schema_migrations, head 20261008150700_b14e_retire_reaction_kinds. Taken from the project
// whole, never merged by hand; it replaces the shapes 56-41E carried by hand until the apply.
//
// What 56-41E changes here (1576, 1577, 1590 to 1593): the table `message_reaction_emoji` in place
// of `message_reaction_kinds`, which is gone with its catalogue row; `message_reactions` keyed by
// (message_id, member_id) with no relationship to a kinds table; `member_messaging_settings.reaction_skin_tone`;
// `messenger_settings_set`'s `p_skin_tone`; `messenger_recent_reactions`; the threads view's
// `invited_names` and `invited_others`; and the messages view's `media_width` and `media_height`.
// The private `message_react`, `messaging_settings_set`, `messenger_media_size` and the group
// creation's guards are absent by design, as every private function is.
//
// Before 56-41E:
// Generated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 55-A's branch (#99, the notification foundation), after
// Chat applied 20261008120000 to 20261008120500 (File A through execute_sql, B to F by SQL Editor
// paste), each ledger row's md5 equal to its committed file; 98 rows in schema_migrations, head
// 20261008120500_n39a_surface_seen. Taken from the project whole, never merged by hand; it replaces
// the shapes 55-A carried by hand until the apply.
//
// What 55-A changes here (1317 to 1324, 1518, 1522): `notifications.kind` is text against the new
// `notification_kinds` table, `c_category` a written column, and `seen_at`, `group_key`,
// `grouped_actor_ids` and `updated_at` are new; `notification_preferences` is new; the enum
// `notification_kind` is gone and `anchor_kind` gains `thread` and `message_request`; the functions
// `notifications_dot`, `notifications_mark_seen`, `notifications_mark_all_read`,
// `connect_requests_pending`, `mark_surface_seen`, `set_notification_preference`,
// `notify_deliver_token_ok`, `notify_outbox_claim`, `notify_outbox_settle` and `notify_webhook_take`
// are new. `private.notify`, its siblings, the outbox, the suppressions, the webhook ledger and
// `member_surface_seen` are absent by design, as every private object is.
//
// Before 55-A:
// Generated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 45-D's branch (#95, admin Settings), merged with main at
// dacfda0 (the merge of #94), after Chat applied 20261003120000_b12s_admin_settings through
// execute_sql and its ledger row read back at the file's drift md5 297936668967db44f601866fba8007cc;
// 91 rows in schema_migrations, head 20261003130500_b14d_request_broadcast. Taken from the project
// whole, never merged by hand; it replaces the function entries 45-D carried by hand until the apply.
//
// What 45-D changes here (1381, 1382, 1391 to 1394, 1178): the tables `admin_appearances`,
// `overview_grains`, `overview_comparisons`, `reporting_zones`, `admin_read_subjects`,
// `admin_staff_settings` and `admin_org_settings`, and the functions `admin_staff_settings_read`,
// `admin_staff_settings_save`, `admin_org_settings_read`, `admin_org_settings_save`,
// `admin_read_log`, `admin_change_history` and `admin_my_sessions`. The private gate, the zone guard,
// the replaced `overview_window` and `admin_org_actions_count` are absent by design, as every private
// function is.
//
// Before 45-D:
// Generated from the canonical Supabase project (dgspjevjoblujcoljvkn) with the Supabase MCP
// generate_typescript_types tool on handoff 41-D's branch (#94, the Messenger's held entry points),
// after Chat applied 20261003130000 to 20261003130500 through execute_sql, each ledger row's md5
// equal to its committed file; 90 rows in schema_migrations, head 20261003130500_b14d_request_broadcast.
//
// What 41-D changes here (1341, 1384, 1386, 1387, 1396; Addendum 1): the four `messenger_*` wrappers
// `messenger_event_thread_join`, `messenger_event_thread_available`, `messenger_request_recover` and
// `messenger_thread_rename`, and two `Views` columns, `messenger_threads_view.last_author_name` and
// `messenger_messages_view.media_word`. The private join, recover, rename, eligibility, availability,
// media-word and broadcast functions are absent by design, as every private function is; the
// `media_mime_check` constraint's new `video/quicktime` is not a type the generator emits.
//
// Before 41-D: the regeneration on handoff 41-C's branch (#92, the Messenger surfaces), merged with
// main at c859d54 (the merge of #90), after 20261002160000_b14c_message_media_rate was applied and
// recorded by Chat through execute_sql in the same transaction as its change and read back at the
// file's drift md5 e68a16b26de7d8777f3abaf61378602f (the file at ae1bdbc); 84 rows in
// schema_migrations.
//
// What 41-C changes here: nothing below this header. 20261002160000 replaces `private.message_send`
// whole, without its `message_media` rate check (1353), and changes no signature; the private schema
// is not exposed, so the generator returns #90's body byte for byte, and the regeneration is taken so
// the file names the project state it was read from.
//
// Before 41-C: the regeneration on handoff 45-B's branch (#90, Brief 12 12B), rebased on main at
// 0d0b79f (the merge of #91), after 20261002140000_b12b_overview was applied and recorded by Chat
// through execute_sql in the same transaction as its change and read back at the file's drift md5
// 66b013e945afee1f2291657adc07a53a (raw d1e9e26451afe9285b3f434493966eb0); 83 rows in
// schema_migrations, the latest 20261002150000_b14b_message_media. Taken from the project whole,
// never merged by hand with #91's regeneration, which it supersedes line for line.
//
// What 41-B changes here (1346, 1374): `media.width` and `media.height` nullable (audio carries
// neither), and the five `messenger_media_*` wrappers the two server routes call with the member's
// own JWT: `messenger_media_record`, `messenger_media_access`, `messenger_media_locate`,
// `messenger_media_marked` and `messenger_media_forget`. The private writer, the sweep and the
// access predicate's helpers are absent by design, as every private function is.
//
// What 20261002140000 changes here (1178, 1265, 1281, 1303, 1304, 1310, 1311, 1362 to 1365): the
// table `admin_dia_notes`; `corridors.density_threshold`; and the functions `admin_overview_window`,
// `admin_overview_mobilization`, `admin_overview_levers`, `admin_overview_network`,
// `admin_overview_company`, `admin_dia_note_read` and `admin_dia_note_write`. The private schema's
// helpers (`admin_overview_entry`, `overview_window`, `overview_buckets`, `admin_reads_count`) are
// absent by design, as before. #91's note that these objects were unexplained by its tree is closed
// by this file: the migration that explains them is now in the same tree.
//
// Nothing here is hand-written except this header and the `Views` helper at the end, which the
// generator drops and every regeneration restores (`src/lib/feed.ts` reads it). The regeneration
// waits for the apply for the reason the earlier headers give: ruling 225 commits a migration before
// it is applied, so a regeneration taken inside that window reads the project as it was and silently
// removes what the window is holding. Every version is recorded on the project, its md5 matches its
// file byte for byte, and `tests/migration-drift.cjs` reads it, so the generator returns it. Every
// object the generator returns is explained by a migration in this tree, so nothing is left out.
//
// What 41-A changes here (1330 to 1353, 1368 to 1373): the tables `threads`, `thread_members`,
// `messages`, `message_reactions`, `message_mentions`, `message_requests`, `message_reports`,
// `message_view_audit`, `member_messaging_settings`, `messenger_dia_dismissals` and the four
// vocabularies `thread_kinds`, `message_mute_durations`, `message_report_reasons` and
// `message_reaction_kinds`; `members.reachability` and `media.delete_requested_at`; the enums
// `reachability`, `thread_member_role`, `thread_member_state`, `message_kind`,
// `message_request_state` and `message_report_state`; the three `Views` entries
// `messenger_threads_view`, `messenger_messages_view` and `messenger_requests_view`; and the
// `messenger_*` wrappers, the only Messenger functions a client calls. The private write paths,
// the projections' helpers, the broadcast triggers and the purge are absent by design, as every
// private function is. `surface_events_2026_10` and `surface_events_2026_11` are still the two
// partitions that exist.
//
// What 20261002120000 changed (1179, 1280 to 1288, 1295 to 1300): the tables
// `member_profile_history`, `surface_event_kinds`, `surface_events`, `partner_acts`,
// `mobilization_ledger`, `surface_event_rollups` and `admin_catalogue`; `world_countries.is_african`;
// and the function `record_event`, the one client-callable writer. `surface_events_2026_10` and
// `surface_events_2026_11` are the two monthly partitions `private.surface_events_ensure_partitions`
// had made when this was taken: the generator lists them because they are tables in `public`, no API
// role holds a grant on them, nothing reads them by name, and a later regeneration carries whichever
// months exist then. No `Views` entry changes. The private schema's functions (`profile_at`,
// `derive_mobilization_v1`, the rollup and partition helpers) are absent by design, as before.
//
// What 20261001120000 changed (1177, 1178, 1265, 1266): the tables `platform_role_kinds`,
// `platform_roles`, `admin_actions` and `admin_reads`; the functions `admin_session_state`,
// `admin_grant_role`, `admin_revoke_role` and `live_arms_admin_member`; `editors` gone, so
// `convene_picks.picked_by` relates to `members`. Earlier regenerations' additions stand as their
// headers described them.
//
// The private functions the surfaces read are absent by design: the private schema is not exposed by
// PostgREST, so the generator does not see it and no surface may reach it.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      admin_actions: {
        Row: {
          action: string;
          actor: string | null;
          after: Json | null;
          before: Json | null;
          id: number;
          occurred_at: string;
          reason: string | null;
          role_at_time: string | null;
          target_id: string | null;
          target_kind: string;
        };
        Insert: {
          action: string;
          actor?: string | null;
          after?: Json | null;
          before?: Json | null;
          id?: never;
          occurred_at?: string;
          reason?: string | null;
          role_at_time?: string | null;
          target_id?: string | null;
          target_kind: string;
        };
        Update: {
          action?: string;
          actor?: string | null;
          after?: Json | null;
          before?: Json | null;
          id?: never;
          occurred_at?: string;
          reason?: string | null;
          role_at_time?: string | null;
          target_id?: string | null;
          target_kind?: string;
        };
        Relationships: [];
      };
      admin_appearances: {
        Row: {
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      admin_catalogue: {
        Row: {
          admin_reason: string | null;
          admin_treatment: string;
          dia_reason: string | null;
          dia_treatment: string;
          recorded_at: string;
          schema_name: string;
          table_name: string;
        };
        Insert: {
          admin_reason?: string | null;
          admin_treatment?: string;
          dia_reason?: string | null;
          dia_treatment?: string;
          recorded_at?: string;
          schema_name: string;
          table_name: string;
        };
        Update: {
          admin_reason?: string | null;
          admin_treatment?: string;
          dia_reason?: string | null;
          dia_treatment?: string;
          recorded_at?: string;
          schema_name?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      admin_dia_notes: {
        Row: {
          compare: string;
          definition_version: number;
          grain: string;
          period_start: string;
          statements: Json;
          tz: string;
          written_at: string;
        };
        Insert: {
          compare: string;
          definition_version: number;
          grain: string;
          period_start: string;
          statements?: Json;
          tz: string;
          written_at?: string;
        };
        Update: {
          compare?: string;
          definition_version?: number;
          grain?: string;
          period_start?: string;
          statements?: Json;
          tz?: string;
          written_at?: string;
        };
        Relationships: [];
      };
      admin_org_settings: {
        Row: {
          dia_note: boolean;
          id: boolean;
          reporting_zone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          dia_note?: boolean;
          id?: boolean;
          reporting_zone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          dia_note?: boolean;
          id?: boolean;
          reporting_zone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_org_settings_reporting_zone_fkey";
            columns: ["reporting_zone"];
            isOneToOne: false;
            referencedRelation: "reporting_zones";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "admin_org_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_read_subjects: {
        Row: {
          block: string | null;
          page: string;
          position: number;
          value: string;
        };
        Insert: {
          block?: string | null;
          page: string;
          position: number;
          value: string;
        };
        Update: {
          block?: string | null;
          page?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      admin_reads: {
        Row: {
          actor: string;
          id: number;
          occurred_at: string;
          projection: string;
        };
        Insert: {
          actor: string;
          id?: never;
          occurred_at?: string;
          projection: string;
        };
        Update: {
          actor?: string;
          id?: never;
          occurred_at?: string;
          projection?: string;
        };
        Relationships: [];
      };
      admin_staff_settings: {
        Row: {
          appearance: string;
          default_compare: string;
          default_grain: string;
          member_id: string;
          reading_zone: string | null;
          updated_at: string;
        };
        Insert: {
          appearance?: string;
          default_compare?: string;
          default_grain?: string;
          member_id: string;
          reading_zone?: string | null;
          updated_at?: string;
        };
        Update: {
          appearance?: string;
          default_compare?: string;
          default_grain?: string;
          member_id?: string;
          reading_zone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_staff_settings_appearance_fkey";
            columns: ["appearance"];
            isOneToOne: false;
            referencedRelation: "admin_appearances";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "admin_staff_settings_default_compare_fkey";
            columns: ["default_compare"];
            isOneToOne: false;
            referencedRelation: "overview_comparisons";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "admin_staff_settings_default_grain_fkey";
            columns: ["default_grain"];
            isOneToOne: false;
            referencedRelation: "overview_grains";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "admin_staff_settings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_staff_settings_reading_zone_fkey";
            columns: ["reading_zone"];
            isOneToOne: false;
            referencedRelation: "reporting_zones";
            referencedColumns: ["value"];
          },
        ];
      };
      attestations: {
        Row: {
          accepted_at: string | null;
          attested_at: string;
          attester_member_id: string;
          attester_role: string;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at: string;
          id: string;
          member_id: string;
          object_id: string;
          object_kind: Database["public"]["Enums"]["anchor_kind"];
        };
        Insert: {
          accepted_at?: string | null;
          attested_at?: string;
          attester_member_id: string;
          attester_role: string;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          id?: string;
          member_id: string;
          object_id: string;
          object_kind: Database["public"]["Enums"]["anchor_kind"];
        };
        Update: {
          accepted_at?: string | null;
          attested_at?: string;
          attester_member_id?: string;
          attester_role?: string;
          c_category?: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          id?: string;
          member_id?: string;
          object_id?: string;
          object_kind?: Database["public"]["Enums"]["anchor_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "attestations_attester_member_id_fkey";
            columns: ["attester_member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attestations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_intents: {
        Row: {
          comment_id: string;
          created_at: string;
          kind: string;
          line: string | null;
          member_id: string;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          kind: string;
          line?: string | null;
          member_id: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          kind?: string;
          line?: string | null;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_intents_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_intents_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "post_reaction_kinds";
            referencedColumns: ["kind"];
          },
          {
            foreignKeyName: "comment_intents_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_reactions: {
        Row: {
          comment_id: string;
          created_at: string;
          emoji: string | null;
          kind: string;
          member_id: string;
        };
        Insert: {
          comment_id: string;
          created_at?: string;
          emoji?: string | null;
          kind: string;
          member_id: string;
        };
        Update: {
          comment_id?: string;
          created_at?: string;
          emoji?: string | null;
          kind?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_reactions_emoji_fkey";
            columns: ["emoji"];
            isOneToOne: false;
            referencedRelation: "message_reaction_emoji";
            referencedColumns: ["emoji"];
          },
          {
            foreignKeyName: "comment_reactions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          media_id: string | null;
          parent_id: string | null;
          post_id: string;
        };
        Insert: {
          author_id: string;
          body?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          media_id?: string | null;
          parent_id?: string | null;
          post_id: string;
        };
        Update: {
          author_id?: string;
          body?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          media_id?: string | null;
          parent_id?: string | null;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      connection_requests: {
        Row: {
          created_at: string;
          expires_at: string | null;
          from_member_id: string;
          id: string;
          message: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["request_status"];
          to_member_id: string | null;
          to_name: string;
          why: string | null;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          from_member_id: string;
          id?: string;
          message: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          to_member_id?: string | null;
          to_name?: string;
          why?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          from_member_id?: string;
          id?: string;
          message?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          to_member_id?: string | null;
          to_name?: string;
          why?: string | null;
        };
        Relationships: [];
      };
      convene_families: {
        Row: {
          created_at: string;
          family: string;
          label: string;
          position: number;
          schema_org: string[];
        };
        Insert: {
          created_at?: string;
          family: string;
          label: string;
          position: number;
          schema_org?: string[];
        };
        Update: {
          created_at?: string;
          family?: string;
          label?: string;
          position?: number;
          schema_org?: string[];
        };
        Relationships: [];
      };
      convene_lanes: {
        Row: {
          lane: string;
          name: string;
          position: number;
        };
        Insert: {
          lane: string;
          name: string;
          position: number;
        };
        Update: {
          lane?: string;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      convene_lenses: {
        Row: {
          icon: string;
          lens: string;
          name: string;
          position: number;
          scope: string;
          short: string;
        };
        Insert: {
          icon: string;
          lens: string;
          name: string;
          position: number;
          scope: string;
          short: string;
        };
        Update: {
          icon?: string;
          lens?: string;
          name?: string;
          position?: number;
          scope?: string;
          short?: string;
        };
        Relationships: [];
      };
      convene_picks: {
        Row: {
          event_id: string;
          id: string;
          line: string;
          picked_at: string;
          picked_by: string;
          withdrawn_at: string | null;
        };
        Insert: {
          event_id: string;
          id?: string;
          line: string;
          picked_at?: string;
          picked_by: string;
          withdrawn_at?: string | null;
        };
        Update: {
          event_id?: string;
          id?: string;
          line?: string;
          picked_at?: string;
          picked_by?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "convene_picks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "convene_picks_picked_by_fkey";
            columns: ["picked_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      corridors: {
        Row: {
          continental_place: string;
          created_at: string;
          density_threshold: number | null;
          diaspora_place: string;
          id: string;
          sector: string | null;
          status: string;
        };
        Insert: {
          continental_place: string;
          created_at?: string;
          density_threshold?: number | null;
          diaspora_place: string;
          id: string;
          sector?: string | null;
          status?: string;
        };
        Update: {
          continental_place?: string;
          created_at?: string;
          density_threshold?: number | null;
          diaspora_place?: string;
          id?: string;
          sector?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      countries: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      discovery_dismissals: {
        Row: {
          created_at: string;
          event_id: string;
          member_id: string;
          section: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          member_id: string;
          section: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          member_id?: string;
          section?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_dismissals_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_dismissals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_dismissals_section_fkey";
            columns: ["section"];
            isOneToOne: false;
            referencedRelation: "convene_lanes";
            referencedColumns: ["lane"];
          },
        ];
      };
      dismissed_suggestions: {
        Row: {
          created_at: string;
          dismissed_id: string;
          member_id: string;
        };
        Insert: {
          created_at?: string;
          dismissed_id: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          dismissed_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dismissed_suggestions_dismissed_id_fkey";
            columns: ["dismissed_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dismissed_suggestions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      edges: {
        Row: {
          created_at: string;
          edge_type: Database["public"]["Enums"]["edge_type"];
          from_id: string;
          id: string;
          revoked_at: string | null;
          to_id: string;
        };
        Insert: {
          created_at?: string;
          edge_type: Database["public"]["Enums"]["edge_type"];
          from_id: string;
          id?: string;
          revoked_at?: string | null;
          to_id: string;
        };
        Update: {
          created_at?: string;
          edge_type?: Database["public"]["Enums"]["edge_type"];
          from_id?: string;
          id?: string;
          revoked_at?: string | null;
          to_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edges_from_id_fkey";
            columns: ["from_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      event_aliases: {
        Row: {
          alias: string;
          created_at: string;
          event_id: string;
          retired_at: string | null;
        };
        Insert: {
          alias: string;
          created_at?: string;
          event_id: string;
          retired_at?: string | null;
        };
        Update: {
          alias?: string;
          created_at?: string;
          event_id?: string;
          retired_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_aliases_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_block_kinds: {
        Row: {
          kind: string;
          label: string;
          position: number;
        };
        Insert: {
          kind: string;
          label: string;
          position: number;
        };
        Update: {
          kind?: string;
          label?: string;
          position?: number;
        };
        Relationships: [];
      };
      event_blocks: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          kind: string;
          payload: Json;
          position: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          kind: string;
          payload: Json;
          position: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          kind?: string;
          payload?: Json;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_blocks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_blocks_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "event_block_kinds";
            referencedColumns: ["kind"];
          },
        ];
      };
      event_delivery: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string;
          event_id: string;
          external_link: boolean;
          id: string;
          kind: Database["public"]["Enums"]["delivery_kind"];
          lat: number | null;
          lng: number | null;
          map_link: string | null;
          place_id: string | null;
          place_name: string | null;
          place_text: string | null;
          position: number;
          region: string | null;
          url: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          event_id: string;
          external_link?: boolean;
          id?: string;
          kind: Database["public"]["Enums"]["delivery_kind"];
          lat?: number | null;
          lng?: number | null;
          map_link?: string | null;
          place_id?: string | null;
          place_name?: string | null;
          place_text?: string | null;
          position?: number;
          region?: string | null;
          url?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          event_id?: string;
          external_link?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["delivery_kind"];
          lat?: number | null;
          lng?: number | null;
          map_link?: string | null;
          place_id?: string | null;
          place_name?: string | null;
          place_text?: string | null;
          position?: number;
          region?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_delivery_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_host_settings: {
        Row: {
          capacity: number | null;
          event_id: string;
          updated_at: string;
        };
        Insert: {
          capacity?: number | null;
          event_id: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          event_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_host_settings_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_parties: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          member_id: string;
          responded_at: string | null;
          role: string;
          status: Database["public"]["Enums"]["event_party_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          member_id: string;
          responded_at?: string | null;
          role: string;
          status?: Database["public"]["Enums"]["event_party_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          member_id?: string;
          responded_at?: string | null;
          role?: string;
          status?: Database["public"]["Enums"]["event_party_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_parties_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_parties_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_parties_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "event_role_kinds";
            referencedColumns: ["role"];
          },
        ];
      };
      event_registrations: {
        Row: {
          audience_override: Database["public"]["Enums"]["audience"] | null;
          contact_consent: boolean;
          conversion_offered_at: string | null;
          created_at: string;
          event_id: string;
          guest_email: string | null;
          id: string;
          member_id: string | null;
          status: Database["public"]["Enums"]["registration_status"];
          updated_at: string;
        };
        Insert: {
          audience_override?: Database["public"]["Enums"]["audience"] | null;
          contact_consent?: boolean;
          conversion_offered_at?: string | null;
          created_at?: string;
          event_id: string;
          guest_email?: string | null;
          id?: string;
          member_id?: string | null;
          status: Database["public"]["Enums"]["registration_status"];
          updated_at?: string;
        };
        Update: {
          audience_override?: Database["public"]["Enums"]["audience"] | null;
          contact_consent?: boolean;
          conversion_offered_at?: string | null;
          created_at?: string;
          event_id?: string;
          guest_email?: string | null;
          id?: string;
          member_id?: string | null;
          status?: Database["public"]["Enums"]["registration_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      event_role_kinds: {
        Row: {
          label: string;
          position: number;
          role: string;
          verb: string;
        };
        Insert: {
          label: string;
          position: number;
          role: string;
          verb: string;
        };
        Update: {
          label?: string;
          position?: number;
          role?: string;
          verb?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          attachments: Json;
          cancelled_at: string | null;
          cancelled_reason: string | null;
          created_at: string;
          custom_slug: string;
          date_confirmed: boolean;
          delivery_intent: string;
          doors_at: string | null;
          ends_at: string | null;
          expected_window_end: string | null;
          expected_window_start: string | null;
          family: string | null;
          host_member_id: string;
          id: string;
          mode: Database["public"]["Enums"]["event_mode"];
          short_code: string;
          slug: string;
          space_id: string | null;
          starts_at: string | null;
          status: Database["public"]["Enums"]["event_status"];
          ticket_kind: Database["public"]["Enums"]["ticket_kind"];
          time_confirmed: boolean;
          timezone: string | null;
          title: string;
          when_text: string;
          window_basis: string | null;
        };
        Insert: {
          attachments?: Json;
          cancelled_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          custom_slug: string;
          date_confirmed?: boolean;
          delivery_intent?: string;
          doors_at?: string | null;
          ends_at?: string | null;
          expected_window_end?: string | null;
          expected_window_start?: string | null;
          family?: string | null;
          host_member_id: string;
          id?: string;
          mode?: Database["public"]["Enums"]["event_mode"];
          short_code: string;
          slug: string;
          space_id?: string | null;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["event_status"];
          ticket_kind?: Database["public"]["Enums"]["ticket_kind"];
          time_confirmed?: boolean;
          timezone?: string | null;
          title: string;
          when_text?: string;
          window_basis?: string | null;
        };
        Update: {
          attachments?: Json;
          cancelled_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          custom_slug?: string;
          date_confirmed?: boolean;
          delivery_intent?: string;
          doors_at?: string | null;
          ends_at?: string | null;
          expected_window_end?: string | null;
          expected_window_start?: string | null;
          family?: string | null;
          host_member_id?: string;
          id?: string;
          mode?: Database["public"]["Enums"]["event_mode"];
          short_code?: string;
          slug?: string;
          space_id?: string | null;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["event_status"];
          ticket_kind?: Database["public"]["Enums"]["ticket_kind"];
          time_confirmed?: boolean;
          timezone?: string | null;
          title?: string;
          when_text?: string;
          window_basis?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_family_fkey";
            columns: ["family"];
            isOneToOne: false;
            referencedRelation: "convene_families";
            referencedColumns: ["family"];
          },
          {
            foreignKeyName: "events_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      focus_areas: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      guest_link_requests: {
        Row: {
          email_hash: string;
          event_id: string;
          id: string;
          requested_at: string;
        };
        Insert: {
          email_hash: string;
          event_id: string;
          id?: string;
          requested_at?: string;
        };
        Update: {
          email_hash?: string;
          event_id?: string;
          id?: string;
          requested_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_link_requests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      industries: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      intents: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      interests: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      languages: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      media: {
        Row: {
          bucket: string;
          byte_size: number;
          created_at: string;
          crop: Json | null;
          delete_requested_at: string | null;
          focal_point: Json | null;
          height: number | null;
          id: string;
          kind: string;
          mime: string;
          optimized: boolean;
          owner_id: string;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          bucket: string;
          byte_size: number;
          created_at?: string;
          crop?: Json | null;
          delete_requested_at?: string | null;
          focal_point?: Json | null;
          height?: number | null;
          id?: string;
          kind: string;
          mime: string;
          optimized?: boolean;
          owner_id: string;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          bucket?: string;
          byte_size?: number;
          created_at?: string;
          crop?: Json | null;
          delete_requested_at?: string | null;
          focal_point?: Json | null;
          height?: number | null;
          id?: string;
          kind?: string;
          mime?: string;
          optimized?: boolean;
          owner_id?: string;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_about: {
        Row: {
          about: string;
          member_id: string;
          updated_at: string;
        };
        Insert: {
          about: string;
          member_id: string;
          updated_at?: string;
        };
        Update: {
          about?: string;
          member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_about_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_connections: {
        Row: {
          created_at: string;
          member_id: string;
          other_id: string;
          source_request_id: string | null;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          other_id: string;
          source_request_id?: string | null;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          other_id?: string;
          source_request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_connections_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_connections_other_id_fkey";
            columns: ["other_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_connections_source_request_id_fkey";
            columns: ["source_request_id"];
            isOneToOne: false;
            referencedRelation: "connection_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      member_corridors: {
        Row: {
          corridor_id: string;
          created_at: string;
          member_id: string;
        };
        Insert: {
          corridor_id: string;
          created_at?: string;
          member_id: string;
        };
        Update: {
          corridor_id?: string;
          created_at?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_corridors_corridor_id_fkey";
            columns: ["corridor_id"];
            isOneToOne: false;
            referencedRelation: "corridors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_corridors_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_embeddings: {
        Row: {
          embedding: string;
          member_id: string;
          updated_at: string;
        };
        Insert: {
          embedding: string;
          member_id: string;
          updated_at?: string;
        };
        Update: {
          embedding?: string;
          member_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_embeddings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_focus_areas: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_focus_areas_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_focus_areas_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "focus_areas";
            referencedColumns: ["name"];
          },
        ];
      };
      member_follows: {
        Row: {
          created_at: string;
          follower_id: string;
          member_id: string;
        };
        Insert: {
          created_at?: string;
          follower_id: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          follower_id?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_follows_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_homes: {
        Row: {
          city: string;
          country: string;
          created_at: string;
          id: string;
          lat: number;
          lng: number;
          member_id: string;
          place_id: string;
          place_name: string;
          position: number;
          region: string | null;
          timezone: string;
        };
        Insert: {
          city: string;
          country: string;
          created_at?: string;
          id?: string;
          lat: number;
          lng: number;
          member_id: string;
          place_id: string;
          place_name: string;
          position?: number;
          region?: string | null;
          timezone: string;
        };
        Update: {
          city?: string;
          country?: string;
          created_at?: string;
          id?: string;
          lat?: number;
          lng?: number;
          member_id?: string;
          place_id?: string;
          place_name?: string;
          position?: number;
          region?: string | null;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_homes_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_industries: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_industries_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_industries_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["name"];
          },
        ];
      };
      member_intent: {
        Row: {
          member_id: string;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          member_id: string;
          note?: string | null;
          updated_at?: string;
        };
        Update: {
          member_id?: string;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_intent_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_intents: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_intents_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_intents_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "intents";
            referencedColumns: ["name"];
          },
        ];
      };
      member_interests: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_interests_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_interests_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "interests";
            referencedColumns: ["name"];
          },
        ];
      };
      member_lane_activity: {
        Row: {
          act: string;
          acted_at: string;
          lane: string;
          member_id: string;
        };
        Insert: {
          act: string;
          acted_at?: string;
          lane: string;
          member_id: string;
        };
        Update: {
          act?: string;
          acted_at?: string;
          lane?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_lane_activity_lane_fkey";
            columns: ["lane"];
            isOneToOne: false;
            referencedRelation: "convene_lanes";
            referencedColumns: ["lane"];
          },
          {
            foreignKeyName: "member_lane_activity_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_languages: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_languages_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_languages_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["name"];
          },
        ];
      };
      member_links: {
        Row: {
          kind: Database["public"]["Enums"]["link_kind"];
          member_id: string;
          url: string;
        };
        Insert: {
          kind: Database["public"]["Enums"]["link_kind"];
          member_id: string;
          url: string;
        };
        Update: {
          kind?: Database["public"]["Enums"]["link_kind"];
          member_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_links_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_messaging_settings: {
        Row: {
          link_previews_enabled: boolean;
          media_notice_seen_at: string | null;
          member_id: string;
          reaction_skin_tone: string | null;
          receipts_chosen_at: string | null;
          receipts_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          link_previews_enabled?: boolean;
          media_notice_seen_at?: string | null;
          member_id: string;
          reaction_skin_tone?: string | null;
          receipts_chosen_at?: string | null;
          receipts_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          link_previews_enabled?: boolean;
          media_notice_seen_at?: string | null;
          member_id?: string;
          reaction_skin_tone?: string | null;
          receipts_chosen_at?: string | null;
          receipts_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_messaging_settings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_origin: {
        Row: {
          heritage: Database["public"]["Enums"]["heritage_kind"] | null;
          member_id: string;
          pathway: Database["public"]["Enums"]["return_pathway"] | null;
          updated_at: string;
        };
        Insert: {
          heritage?: Database["public"]["Enums"]["heritage_kind"] | null;
          member_id: string;
          pathway?: Database["public"]["Enums"]["return_pathway"] | null;
          updated_at?: string;
        };
        Update: {
          heritage?: Database["public"]["Enums"]["heritage_kind"] | null;
          member_id?: string;
          pathway?: Database["public"]["Enums"]["return_pathway"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_origin_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_profile_history: {
        Row: {
          current_country: string | null;
          current_place: string | null;
          id: number;
          member_id: string;
          source: string;
          stance: Database["public"]["Enums"]["stance"];
          valid_from: string;
        };
        Insert: {
          current_country?: string | null;
          current_place?: string | null;
          id?: never;
          member_id: string;
          source: string;
          stance: Database["public"]["Enums"]["stance"];
          valid_from?: string;
        };
        Update: {
          current_country?: string | null;
          current_place?: string | null;
          id?: never;
          member_id?: string;
          source?: string;
          stance?: Database["public"]["Enums"]["stance"];
          valid_from?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_profile_history_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_rail_state: {
        Row: {
          collapsed: boolean;
          member_id: string;
          surface: string;
          updated_at: string;
          width_band: string;
        };
        Insert: {
          collapsed: boolean;
          member_id: string;
          surface: string;
          updated_at?: string;
          width_band: string;
        };
        Update: {
          collapsed?: boolean;
          member_id?: string;
          surface?: string;
          updated_at?: string;
          width_band?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_rail_state_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_reaction_picks: {
        Row: {
          emoji: string;
          member_id: string;
          picked_at: string;
        };
        Insert: {
          emoji: string;
          member_id: string;
          picked_at?: string;
        };
        Update: {
          emoji?: string;
          member_id?: string;
          picked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_reaction_picks_emoji_fkey";
            columns: ["emoji"];
            isOneToOne: false;
            referencedRelation: "message_reaction_emoji";
            referencedColumns: ["emoji"];
          },
          {
            foreignKeyName: "member_reaction_picks_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_regional_expertise: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_regional_expertise_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_regional_expertise_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "regional_expertise";
            referencedColumns: ["name"];
          },
        ];
      };
      member_skills: {
        Row: {
          member_id: string;
          name: string;
        };
        Insert: {
          member_id: string;
          name: string;
        };
        Update: {
          member_id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_skills_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_skills_name_fkey";
            columns: ["name"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["name"];
          },
        ];
      };
      member_stance_details: {
        Row: {
          base: string | null;
          member_id: string;
          needs: string | null;
          offer: string | null;
          return_timeline: Database["public"]["Enums"]["return_timeline"] | null;
          stance: Database["public"]["Enums"]["stance"];
          support: string | null;
          updated_at: string;
        };
        Insert: {
          base?: string | null;
          member_id: string;
          needs?: string | null;
          offer?: string | null;
          return_timeline?: Database["public"]["Enums"]["return_timeline"] | null;
          stance: Database["public"]["Enums"]["stance"];
          support?: string | null;
          updated_at?: string;
        };
        Update: {
          base?: string | null;
          member_id?: string;
          needs?: string | null;
          offer?: string | null;
          return_timeline?: Database["public"]["Enums"]["return_timeline"] | null;
          stance?: Database["public"]["Enums"]["stance"];
          support?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_stance_details_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_stances: {
        Row: {
          label: string;
          position: number;
          stance: Database["public"]["Enums"]["stance"];
        };
        Insert: {
          label: string;
          position: number;
          stance: Database["public"]["Enums"]["stance"];
        };
        Update: {
          label?: string;
          position?: number;
          stance?: Database["public"]["Enums"]["stance"];
        };
        Relationships: [];
      };
      member_subscriptions: {
        Row: {
          created_at: string;
          family: string | null;
          home_id: string | null;
          id: string;
          kind: string;
          member_id: string;
        };
        Insert: {
          created_at?: string;
          family?: string | null;
          home_id?: string | null;
          id?: string;
          kind: string;
          member_id: string;
        };
        Update: {
          created_at?: string;
          family?: string | null;
          home_id?: string | null;
          id?: string;
          kind?: string;
          member_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_subscriptions_family_fkey";
            columns: ["family"];
            isOneToOne: false;
            referencedRelation: "convene_families";
            referencedColumns: ["family"];
          },
          {
            foreignKeyName: "member_subscriptions_home_id_fkey";
            columns: ["home_id"];
            isOneToOne: false;
            referencedRelation: "member_homes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_subscriptions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      member_visibility: {
        Row: {
          audience: Database["public"]["Enums"]["audience"];
          member_id: string;
          section: Database["public"]["Enums"]["profile_section"];
        };
        Insert: {
          audience?: Database["public"]["Enums"]["audience"];
          member_id: string;
          section: Database["public"]["Enums"]["profile_section"];
        };
        Update: {
          audience?: Database["public"]["Enums"]["audience"];
          member_id?: string;
          section?: Database["public"]["Enums"]["profile_section"];
        };
        Relationships: [
          {
            foreignKeyName: "member_visibility_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          admitted_at: string | null;
          avatar_path: string | null;
          cover_focus: string;
          cover_path: string | null;
          created_at: string;
          current_country: string | null;
          current_place: string | null;
          handle: string;
          headline: string | null;
          id: string;
          identified_at: string | null;
          local_tz: string | null;
          name: string;
          onboarded_at: string | null;
          origin_country: string | null;
          pattern: Database["public"]["Enums"]["masthead_pattern"];
          profile_private: boolean;
          profile_shared: boolean;
          reachability: Database["public"]["Enums"]["reachability"];
          stance: Database["public"]["Enums"]["stance"];
          stance_declared_at: string | null;
          updated_at: string;
          username_changes: number;
          who_completed_at: string | null;
        };
        Insert: {
          admitted_at?: string | null;
          avatar_path?: string | null;
          cover_focus?: string;
          cover_path?: string | null;
          created_at?: string;
          current_country?: string | null;
          current_place?: string | null;
          handle: string;
          headline?: string | null;
          id: string;
          identified_at?: string | null;
          local_tz?: string | null;
          name: string;
          onboarded_at?: string | null;
          origin_country?: string | null;
          pattern?: Database["public"]["Enums"]["masthead_pattern"];
          profile_private?: boolean;
          profile_shared?: boolean;
          reachability?: Database["public"]["Enums"]["reachability"];
          stance?: Database["public"]["Enums"]["stance"];
          stance_declared_at?: string | null;
          updated_at?: string;
          username_changes?: number;
          who_completed_at?: string | null;
        };
        Update: {
          admitted_at?: string | null;
          avatar_path?: string | null;
          cover_focus?: string;
          cover_path?: string | null;
          created_at?: string;
          current_country?: string | null;
          current_place?: string | null;
          handle?: string;
          headline?: string | null;
          id?: string;
          identified_at?: string | null;
          local_tz?: string | null;
          name?: string;
          onboarded_at?: string | null;
          origin_country?: string | null;
          pattern?: Database["public"]["Enums"]["masthead_pattern"];
          profile_private?: boolean;
          profile_shared?: boolean;
          reachability?: Database["public"]["Enums"]["reachability"];
          stance?: Database["public"]["Enums"]["stance"];
          stance_declared_at?: string | null;
          updated_at?: string;
          username_changes?: number;
          who_completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_current_country_fkey";
            columns: ["current_country"];
            isOneToOne: false;
            referencedRelation: "world_countries";
            referencedColumns: ["name"];
          },
          {
            foreignKeyName: "members_origin_country_fkey";
            columns: ["origin_country"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["name"];
          },
        ];
      };
      message_mentions: {
        Row: {
          member_id: string;
          message_id: string;
        };
        Insert: {
          member_id: string;
          message_id: string;
        };
        Update: {
          member_id?: string;
          message_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_mentions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_mentions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messenger_messages_view";
            referencedColumns: ["message_id"];
          },
        ];
      };
      message_mute_durations: {
        Row: {
          duration: string | null;
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          duration?: string | null;
          label: string;
          position: number;
          value: string;
        };
        Update: {
          duration?: string | null;
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      message_reaction_emoji: {
        Row: {
          emoji: string;
          emoji_group: string;
          emojibase_version: string;
          label: string;
          quick_position: number | null;
          takes_tone: boolean;
        };
        Insert: {
          emoji: string;
          emoji_group: string;
          emojibase_version: string;
          label: string;
          quick_position?: number | null;
          takes_tone: boolean;
        };
        Update: {
          emoji?: string;
          emoji_group?: string;
          emojibase_version?: string;
          label?: string;
          quick_position?: number | null;
          takes_tone?: boolean;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          created_at: string;
          member_id: string;
          message_id: string;
          reaction: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          message_id: string;
          reaction: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          message_id?: string;
          reaction?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messenger_messages_view";
            referencedColumns: ["message_id"];
          },
        ];
      };
      message_report_reasons: {
        Row: {
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      message_reports: {
        Row: {
          created_at: string;
          id: string;
          message_id: string | null;
          note: string | null;
          reason: string;
          reporter_id: string | null;
          state: Database["public"]["Enums"]["message_report_state"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          note?: string | null;
          reason: string;
          reporter_id?: string | null;
          state?: Database["public"]["Enums"]["message_report_state"];
        };
        Update: {
          created_at?: string;
          id?: string;
          message_id?: string | null;
          note?: string | null;
          reason?: string;
          reporter_id?: string | null;
          state?: Database["public"]["Enums"]["message_report_state"];
        };
        Relationships: [
          {
            foreignKeyName: "message_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_reports_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messenger_messages_view";
            referencedColumns: ["message_id"];
          },
          {
            foreignKeyName: "message_reports_reason_fkey";
            columns: ["reason"];
            isOneToOne: false;
            referencedRelation: "message_report_reasons";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "message_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      message_requests: {
        Row: {
          body: string;
          created_at: string;
          decided_at: string | null;
          id: string;
          recipient_id: string;
          sender_id: string;
          state: Database["public"]["Enums"]["message_request_state"];
          thread_id: string | null;
        };
        Insert: {
          body: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          recipient_id: string;
          sender_id: string;
          state?: Database["public"]["Enums"]["message_request_state"];
          thread_id?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          decided_at?: string | null;
          id?: string;
          recipient_id?: string;
          sender_id?: string;
          state?: Database["public"]["Enums"]["message_request_state"];
          thread_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_requests_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_requests_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_requests_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "message_requests_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      message_view_audit: {
        Row: {
          id: number;
          report_id: string;
          staff_id: string | null;
          viewed_at: string;
        };
        Insert: {
          id?: never;
          report_id: string;
          staff_id?: string | null;
          viewed_at?: string;
        };
        Update: {
          id?: never;
          report_id?: string;
          staff_id?: string | null;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_view_audit_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "message_reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_view_audit_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          author_deleted_at: string | null;
          author_id: string | null;
          body: string | null;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          link_preview: Json | null;
          media_id: string | null;
          pinned_by: string | null;
          reply_to: string | null;
          search: unknown;
          seq: number;
          thread_id: string;
        };
        Insert: {
          author_deleted_at?: string | null;
          author_id?: string | null;
          body?: string | null;
          client_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["message_kind"];
          link_preview?: Json | null;
          media_id?: string | null;
          pinned_by?: string | null;
          reply_to?: string | null;
          search?: unknown;
          seq: number;
          thread_id: string;
        };
        Update: {
          author_deleted_at?: string | null;
          author_id?: string | null;
          body?: string | null;
          client_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["message_kind"];
          link_preview?: Json | null;
          media_id?: string | null;
          pinned_by?: string | null;
          reply_to?: string | null;
          search?: unknown;
          seq?: number;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_pinned_by_fkey";
            columns: ["pinned_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "messenger_messages_view";
            referencedColumns: ["message_id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      messenger_dia_dismissals: {
        Row: {
          dismissed_at: string;
          member_id: string;
          signal_key: string;
        };
        Insert: {
          dismissed_at?: string;
          member_id: string;
          signal_key: string;
        };
        Update: {
          dismissed_at?: string;
          member_id?: string;
          signal_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messenger_dia_dismissals_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      mobilization_ledger: {
        Row: {
          act_key: string;
          bridging: boolean;
          c_category: Database["public"]["Enums"]["c_category"];
          corridor_ids: string[];
          counterparty_id: string | null;
          counterparty_side: string | null;
          counterparty_stance: Database["public"]["Enums"]["stance"] | null;
          definition_version: number;
          depth: string;
          derived_at: string;
          direction: string | null;
          member_id: string;
          member_side: string;
          member_stance: Database["public"]["Enums"]["stance"];
          occurred_at: string;
          source: string;
        };
        Insert: {
          act_key: string;
          bridging?: boolean;
          c_category: Database["public"]["Enums"]["c_category"];
          corridor_ids?: string[];
          counterparty_id?: string | null;
          counterparty_side?: string | null;
          counterparty_stance?: Database["public"]["Enums"]["stance"] | null;
          definition_version: number;
          depth: string;
          derived_at?: string;
          direction?: string | null;
          member_id: string;
          member_side: string;
          member_stance: Database["public"]["Enums"]["stance"];
          occurred_at: string;
          source: string;
        };
        Update: {
          act_key?: string;
          bridging?: boolean;
          c_category?: Database["public"]["Enums"]["c_category"];
          corridor_ids?: string[];
          counterparty_id?: string | null;
          counterparty_side?: string | null;
          counterparty_stance?: Database["public"]["Enums"]["stance"] | null;
          definition_version?: number;
          depth?: string;
          derived_at?: string;
          direction?: string | null;
          member_id?: string;
          member_side?: string;
          member_stance?: Database["public"]["Enums"]["stance"];
          occurred_at?: string;
          source?: string;
        };
        Relationships: [];
      };
      notification_categories: {
        Row: {
          label: string;
          position: number;
          value: Database["public"]["Enums"]["c_category"];
        };
        Insert: {
          label: string;
          position: number;
          value: Database["public"]["Enums"]["c_category"];
        };
        Update: {
          label?: string;
          position?: number;
          value?: Database["public"]["Enums"]["c_category"];
        };
        Relationships: [];
      };
      notification_email_modes: {
        Row: {
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      notification_kinds: {
        Row: {
          c: Database["public"]["Enums"]["c_category"] | null;
          c_from_object: boolean;
          destination: string | null;
          email_default: string;
          email_line: string | null;
          email_subject: string | null;
          group_window: string | null;
          groups: boolean;
          kind: string;
          position: number;
          renders: boolean;
          transactional: boolean;
        };
        Insert: {
          c?: Database["public"]["Enums"]["c_category"] | null;
          c_from_object?: boolean;
          destination?: string | null;
          email_default?: string;
          email_line?: string | null;
          email_subject?: string | null;
          group_window?: string | null;
          groups?: boolean;
          kind: string;
          position: number;
          renders?: boolean;
          transactional?: boolean;
        };
        Update: {
          c?: Database["public"]["Enums"]["c_category"] | null;
          c_from_object?: boolean;
          destination?: string | null;
          email_default?: string;
          email_line?: string | null;
          email_subject?: string | null;
          group_window?: string | null;
          groups?: boolean;
          kind?: string;
          position?: number;
          renders?: boolean;
          transactional?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notification_kinds_email_default_fkey";
            columns: ["email_default"];
            isOneToOne: false;
            referencedRelation: "notification_email_modes";
            referencedColumns: ["value"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          c: Database["public"]["Enums"]["c_category"];
          channel: string;
          member_id: string;
          mode: string;
          updated_at: string;
        };
        Insert: {
          c: Database["public"]["Enums"]["c_category"];
          channel: string;
          member_id: string;
          mode: string;
          updated_at?: string;
        };
        Update: {
          c?: Database["public"]["Enums"]["c_category"];
          channel?: string;
          member_id?: string;
          mode?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_mode_fkey";
            columns: ["mode"];
            isOneToOne: false;
            referencedRelation: "notification_email_modes";
            referencedColumns: ["value"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          actor_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at: string;
          group_key: string | null;
          grouped_actor_ids: string[];
          id: string;
          kind: string;
          object_id: string | null;
          object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          read_at: string | null;
          recipient_member_id: string;
          seen_at: string | null;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          group_key?: string | null;
          grouped_actor_ids?: string[];
          id?: string;
          kind: string;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          read_at?: string | null;
          recipient_member_id: string;
          seen_at?: string | null;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          actor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          c_category?: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          group_key?: string | null;
          grouped_actor_ids?: string[];
          id?: string;
          kind?: string;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          read_at?: string | null;
          recipient_member_id?: string;
          seen_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "notification_kinds";
            referencedColumns: ["kind"];
          },
        ];
      };
      opportunities: {
        Row: {
          by_date: string | null;
          by_text: string;
          created_at: string;
          event_id: string | null;
          id: string;
          instrument: Database["public"]["Enums"]["contribute_instrument"];
          need: string | null;
          receiver_member_id: string;
          space_id: string | null;
          title: string;
        };
        Insert: {
          by_date?: string | null;
          by_text?: string;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          instrument: Database["public"]["Enums"]["contribute_instrument"];
          need?: string | null;
          receiver_member_id: string;
          space_id?: string | null;
          title: string;
        };
        Update: {
          by_date?: string | null;
          by_text?: string;
          created_at?: string;
          event_id?: string | null;
          id?: string;
          instrument?: Database["public"]["Enums"]["contribute_instrument"];
          need?: string | null;
          receiver_member_id?: string;
          space_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "opportunities_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      overview_comparisons: {
        Row: {
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      overview_grains: {
        Row: {
          label: string;
          position: number;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      partner_acts: {
        Row: {
          c_category: Database["public"]["Enums"]["c_category"];
          confirmed_by: string | null;
          created_at: string;
          depth: string;
          id: string;
          member_id: string;
          occurred_at: string;
          source: string;
          source_ref: string;
        };
        Insert: {
          c_category: Database["public"]["Enums"]["c_category"];
          confirmed_by?: string | null;
          created_at?: string;
          depth: string;
          id?: string;
          member_id: string;
          occurred_at: string;
          source: string;
          source_ref: string;
        };
        Update: {
          c_category?: Database["public"]["Enums"]["c_category"];
          confirmed_by?: string | null;
          created_at?: string;
          depth?: string;
          id?: string;
          member_id?: string;
          occurred_at?: string;
          source?: string;
          source_ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_acts_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_role_kinds: {
        Row: {
          label: string;
          position: number;
          role: string;
        };
        Insert: {
          label: string;
          position: number;
          role: string;
        };
        Update: {
          label?: string;
          position?: number;
          role?: string;
        };
        Relationships: [];
      };
      platform_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          id: string;
          member_id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          member_id: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          member_id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_roles_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_roles_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_roles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "platform_role_kinds";
            referencedColumns: ["role"];
          },
        ];
      };
      post_dia: {
        Row: {
          accepted: boolean;
          confidence: number | null;
          created_at: string;
          id: string;
          latency_ms: number | null;
          member_overrode: boolean;
          post_id: string;
          proposed_fields: Json;
          verb: Database["public"]["Enums"]["c_category"] | null;
        };
        Insert: {
          accepted?: boolean;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          latency_ms?: number | null;
          member_overrode?: boolean;
          post_id: string;
          proposed_fields?: Json;
          verb?: Database["public"]["Enums"]["c_category"] | null;
        };
        Update: {
          accepted?: boolean;
          confidence?: number | null;
          created_at?: string;
          id?: string;
          latency_ms?: number | null;
          member_overrode?: boolean;
          post_id?: string;
          proposed_fields?: Json;
          verb?: Database["public"]["Enums"]["c_category"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_dia_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_dia_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_drafts: {
        Row: {
          created_at: string;
          host_context: string;
          id: string;
          member_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          host_context: string;
          id?: string;
          member_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          host_context?: string;
          id?: string;
          member_id?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_intents: {
        Row: {
          created_at: string;
          kind: string;
          line: string | null;
          member_id: string;
          post_id: string;
        };
        Insert: {
          created_at?: string;
          kind: string;
          line?: string | null;
          member_id: string;
          post_id: string;
        };
        Update: {
          created_at?: string;
          kind?: string;
          line?: string | null;
          member_id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_intents_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "post_reaction_kinds";
            referencedColumns: ["kind"];
          },
          {
            foreignKeyName: "post_intents_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_intents_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_intents_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_links: {
        Row: {
          created_at: string;
          description: string | null;
          fetched_at: string | null;
          id: string;
          image_url: string | null;
          post_id: string;
          title: string | null;
          url: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          fetched_at?: string | null;
          id?: string;
          image_url?: string | null;
          post_id: string;
          title?: string | null;
          url: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          fetched_at?: string | null;
          id?: string;
          image_url?: string | null;
          post_id?: string;
          title?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_links_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_links_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: true;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: {
          created_at: string;
          height: number;
          id: string;
          media_id: string | null;
          position: number;
          post_id: string;
          storage_path: string;
          width: number;
        };
        Insert: {
          created_at?: string;
          height: number;
          id?: string;
          media_id?: string | null;
          position?: number;
          post_id: string;
          storage_path: string;
          width: number;
        };
        Update: {
          created_at?: string;
          height?: number;
          id?: string;
          media_id?: string | null;
          position?: number;
          post_id?: string;
          storage_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reaction_glosses: {
        Row: {
          gloss: string;
          kind: string;
          language: string;
        };
        Insert: {
          gloss: string;
          kind: string;
          language: string;
        };
        Update: {
          gloss?: string;
          kind?: string;
          language?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reaction_glosses_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "post_reaction_kinds";
            referencedColumns: ["kind"];
          },
        ];
      };
      post_reaction_kinds: {
        Row: {
          class: string;
          emoji: string;
          kind: string;
          label: string;
          position: number;
        };
        Insert: {
          class: string;
          emoji: string;
          kind: string;
          label: string;
          position: number;
        };
        Update: {
          class?: string;
          emoji?: string;
          kind?: string;
          label?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_reaction_kinds_emoji_fkey";
            columns: ["emoji"];
            isOneToOne: true;
            referencedRelation: "message_reaction_emoji";
            referencedColumns: ["emoji"];
          },
        ];
      };
      post_reactions: {
        Row: {
          created_at: string;
          emoji: string | null;
          kind: string;
          member_id: string;
          post_id: string;
        };
        Insert: {
          created_at?: string;
          emoji?: string | null;
          kind?: string;
          member_id: string;
          post_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string | null;
          kind?: string;
          member_id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_emoji_fkey";
            columns: ["emoji"];
            isOneToOne: false;
            referencedRelation: "message_reaction_emoji";
            referencedColumns: ["emoji"];
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_saves: {
        Row: {
          created_at: string;
          member_id: string;
          post_id: string;
        };
        Insert: {
          created_at?: string;
          member_id: string;
          post_id: string;
        };
        Update: {
          created_at?: string;
          member_id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "feed";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_saves_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          anchor_id: string | null;
          anchor_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          audience: Database["public"]["Enums"]["audience"];
          author_id: string;
          author_kind: Database["public"]["Enums"]["anchor_kind"];
          body: string;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at: string;
          created_by: string;
          created_object_id: string | null;
          created_object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          id: string;
          published_at: string | null;
          status: Database["public"]["Enums"]["post_status"];
        };
        Insert: {
          anchor_id?: string | null;
          anchor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          audience?: Database["public"]["Enums"]["audience"];
          author_id: string;
          author_kind: Database["public"]["Enums"]["anchor_kind"];
          body: string;
          c_category: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          created_by: string;
          created_object_id?: string | null;
          created_object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          id?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
        };
        Update: {
          anchor_id?: string | null;
          anchor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          audience?: Database["public"]["Enums"]["audience"];
          author_id?: string;
          author_kind?: Database["public"]["Enums"]["anchor_kind"];
          body?: string;
          c_category?: Database["public"]["Enums"]["c_category"];
          created_at?: string;
          created_by?: string;
          created_object_id?: string | null;
          created_object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          id?: string;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
        };
        Relationships: [];
      };
      regional_expertise: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      reporting_zones: {
        Row: {
          abbreviation: string;
          city: string;
          name: string;
          position: number;
          value: string;
        };
        Insert: {
          abbreviation: string;
          city: string;
          name: string;
          position: number;
          value: string;
        };
        Update: {
          abbreviation?: string;
          city?: string;
          name?: string;
          position?: number;
          value?: string;
        };
        Relationships: [];
      };
      reserved_link_words: {
        Row: {
          created_at: string;
          word: string;
        };
        Insert: {
          created_at?: string;
          word: string;
        };
        Update: {
          created_at?: string;
          word?: string;
        };
        Relationships: [];
      };
      second_degree: {
        Row: {
          fof_id: string;
          member_id: string;
          refreshed_at: string;
          sample_via_ids: string[];
          via_count: number;
        };
        Insert: {
          fof_id: string;
          member_id: string;
          refreshed_at?: string;
          sample_via_ids?: string[];
          via_count: number;
        };
        Update: {
          fof_id?: string;
          member_id?: string;
          refreshed_at?: string;
          sample_via_ids?: string[];
          via_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "second_degree_fof_id_fkey";
            columns: ["fof_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "second_degree_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      skills: {
        Row: {
          name: string;
          position: number;
        };
        Insert: {
          name: string;
          position: number;
        };
        Update: {
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
      space_roles: {
        Row: {
          created_at: string;
          id: string;
          member_id: string;
          role: Database["public"]["Enums"]["space_role"];
          space_id: string;
          status: Database["public"]["Enums"]["space_role_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          member_id: string;
          role?: Database["public"]["Enums"]["space_role"];
          space_id: string;
          status?: Database["public"]["Enums"]["space_role_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          member_id?: string;
          role?: Database["public"]["Enums"]["space_role"];
          space_id?: string;
          status?: Database["public"]["Enums"]["space_role_status"];
        };
        Relationships: [
          {
            foreignKeyName: "space_roles_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          owner_member_id: string;
          roles_sought: Json;
          status: Database["public"]["Enums"]["space_status"];
          title: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_member_id: string;
          roles_sought?: Json;
          status?: Database["public"]["Enums"]["space_status"];
          title: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          owner_member_id?: string;
          roles_sought?: Json;
          status?: Database["public"]["Enums"]["space_status"];
          title?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          author_member_id: string;
          body: string;
          created_at: string;
          id: string;
          origin_id: string | null;
          origin_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          title: string;
        };
        Insert: {
          author_member_id: string;
          body: string;
          created_at?: string;
          id?: string;
          origin_id?: string | null;
          origin_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          title: string;
        };
        Update: {
          author_member_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          origin_id?: string | null;
          origin_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          title?: string;
        };
        Relationships: [];
      };
      surface_event_kinds: {
        Row: {
          allowed_props: string[];
          anonymous: boolean;
          area: string;
          feeds: string;
          kind: string;
          position: number;
          public: boolean;
        };
        Insert: {
          allowed_props?: string[];
          anonymous?: boolean;
          area: string;
          feeds: string;
          kind: string;
          position: number;
          public?: boolean;
        };
        Update: {
          allowed_props?: string[];
          anonymous?: boolean;
          area?: string;
          feeds?: string;
          kind?: string;
          position?: number;
          public?: boolean;
        };
        Relationships: [];
      };
      surface_event_rollups: {
        Row: {
          app: string;
          events: number;
          hour: string;
          kind: string;
          members: number;
          rolled_at: string;
          sessions: number;
          surface: string;
        };
        Insert: {
          app: string;
          events: number;
          hour: string;
          kind: string;
          members: number;
          rolled_at?: string;
          sessions: number;
          surface: string;
        };
        Update: {
          app?: string;
          events?: number;
          hour?: string;
          kind?: string;
          members?: number;
          rolled_at?: string;
          sessions?: number;
          surface?: string;
        };
        Relationships: [];
      };
      surface_events: {
        Row: {
          app: string;
          c_category: Database["public"]["Enums"]["c_category"] | null;
          id: number;
          kind: string;
          member_id: string | null;
          object_id: string | null;
          object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at: string;
          props: Json;
          referrer_surface: string | null;
          session_id: string;
          surface: string;
          viewport: string | null;
        };
        Insert: {
          app: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id: string;
          surface: string;
          viewport?: string | null;
        };
        Update: {
          app?: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind?: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id?: string;
          surface?: string;
          viewport?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "surface_events_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "surface_event_kinds";
            referencedColumns: ["kind"];
          },
        ];
      };
      surface_events_2026_10: {
        Row: {
          app: string;
          c_category: Database["public"]["Enums"]["c_category"] | null;
          id: number;
          kind: string;
          member_id: string | null;
          object_id: string | null;
          object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at: string;
          props: Json;
          referrer_surface: string | null;
          session_id: string;
          surface: string;
          viewport: string | null;
        };
        Insert: {
          app: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id: string;
          surface: string;
          viewport?: string | null;
        };
        Update: {
          app?: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind?: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id?: string;
          surface?: string;
          viewport?: string | null;
        };
        Relationships: [];
      };
      surface_events_2026_11: {
        Row: {
          app: string;
          c_category: Database["public"]["Enums"]["c_category"] | null;
          id: number;
          kind: string;
          member_id: string | null;
          object_id: string | null;
          object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at: string;
          props: Json;
          referrer_surface: string | null;
          session_id: string;
          surface: string;
          viewport: string | null;
        };
        Insert: {
          app: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id: string;
          surface: string;
          viewport?: string | null;
        };
        Update: {
          app?: string;
          c_category?: Database["public"]["Enums"]["c_category"] | null;
          id?: never;
          kind?: string;
          member_id?: string | null;
          object_id?: string | null;
          object_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          occurred_at?: string;
          props?: Json;
          referrer_surface?: string | null;
          session_id?: string;
          surface?: string;
          viewport?: string | null;
        };
        Relationships: [];
      };
      thread_kinds: {
        Row: {
          label: string;
          position: number;
          surfaced: boolean;
          value: string;
        };
        Insert: {
          label: string;
          position: number;
          surfaced: boolean;
          value: string;
        };
        Update: {
          label?: string;
          position?: number;
          surfaced?: boolean;
          value?: string;
        };
        Relationships: [];
      };
      thread_members: {
        Row: {
          archived_at: string | null;
          delivered_seq: number;
          invited_by: string | null;
          joined_at: string | null;
          joined_seq: number;
          last_opened_at: string | null;
          member_id: string;
          muted_until: string | null;
          pinned_at: string | null;
          read_seq: number;
          role: Database["public"]["Enums"]["thread_member_role"];
          state: Database["public"]["Enums"]["thread_member_state"];
          thread_id: string;
        };
        Insert: {
          archived_at?: string | null;
          delivered_seq?: number;
          invited_by?: string | null;
          joined_at?: string | null;
          joined_seq?: number;
          last_opened_at?: string | null;
          member_id: string;
          muted_until?: string | null;
          pinned_at?: string | null;
          read_seq?: number;
          role?: Database["public"]["Enums"]["thread_member_role"];
          state?: Database["public"]["Enums"]["thread_member_state"];
          thread_id: string;
        };
        Update: {
          archived_at?: string | null;
          delivered_seq?: number;
          invited_by?: string | null;
          joined_at?: string | null;
          joined_seq?: number;
          last_opened_at?: string | null;
          member_id?: string;
          muted_until?: string | null;
          pinned_at?: string | null;
          read_seq?: number;
          role?: Database["public"]["Enums"]["thread_member_role"];
          state?: Database["public"]["Enums"]["thread_member_state"];
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_members_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_members_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "thread_members_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          anchor_id: string | null;
          anchor_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          created_at: string;
          created_by: string | null;
          history_visible_to_new: boolean;
          id: string;
          kind: string;
          last_activity_at: string;
          name: string | null;
          pair_key: string | null;
          parent_thread_id: string | null;
        };
        Insert: {
          anchor_id?: string | null;
          anchor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          created_at?: string;
          created_by?: string | null;
          history_visible_to_new?: boolean;
          id?: string;
          kind: string;
          last_activity_at?: string;
          name?: string | null;
          pair_key?: string | null;
          parent_thread_id?: string | null;
        };
        Update: {
          anchor_id?: string | null;
          anchor_kind?: Database["public"]["Enums"]["anchor_kind"] | null;
          created_at?: string;
          created_by?: string | null;
          history_visible_to_new?: boolean;
          id?: string;
          kind?: string;
          last_activity_at?: string;
          name?: string | null;
          pair_key?: string | null;
          parent_thread_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "threads_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "thread_kinds";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "threads_parent_thread_id_fkey";
            columns: ["parent_thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "threads_parent_thread_id_fkey";
            columns: ["parent_thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      world_countries: {
        Row: {
          is_african: boolean;
          name: string;
          position: number;
        };
        Insert: {
          is_african?: boolean;
          name: string;
          position: number;
        };
        Update: {
          is_african?: boolean;
          name?: string;
          position?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      feed: {
        Row: {
          anchor_id: string | null;
          anchor_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          audience: Database["public"]["Enums"]["audience"] | null;
          author_avatar_path: string | null;
          author_handle: string | null;
          author_id: string | null;
          author_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          author_name: string | null;
          body: string | null;
          c_category: Database["public"]["Enums"]["c_category"] | null;
          created_at: string | null;
          created_by: string | null;
          created_object_id: string | null;
          created_object_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          id: string | null;
          published_at: string | null;
          status: Database["public"]["Enums"]["post_status"] | null;
        };
        Relationships: [];
      };
      messenger_messages_view: {
        Row: {
          author_avatar_path: string | null;
          author_id: string | null;
          author_name: string | null;
          blocked: boolean | null;
          body: string | null;
          created_at: string | null;
          deleted: boolean | null;
          edited: boolean | null;
          edited_at: string | null;
          former_member: boolean | null;
          kind: Database["public"]["Enums"]["message_kind"] | null;
          link_preview: Json | null;
          media_height: number | null;
          media_id: string | null;
          media_width: number | null;
          media_word: string | null;
          mentions: string[] | null;
          message_id: string | null;
          own: boolean | null;
          pinned: boolean | null;
          reactions: Json | null;
          read_by: Json | null;
          read_by_others: boolean | null;
          reply_to: Json | null;
          seq: number | null;
          thread_id: string | null;
          tick: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      messenger_requests_view: {
        Row: {
          body: string | null;
          created_at: string | null;
          decided_at: string | null;
          mutual_names: Json | null;
          mutual_others: boolean | null;
          request_id: string | null;
          sender_avatar_path: string | null;
          sender_handle: string | null;
          sender_headline: string | null;
          sender_id: string | null;
          sender_name: string | null;
          sender_stance: string | null;
          shared_space_names: Json | null;
          shared_space_others: boolean | null;
          state: Database["public"]["Enums"]["message_request_state"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_requests_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      messenger_threads_view: {
        Row: {
          anchor_id: string | null;
          anchor_kind: Database["public"]["Enums"]["anchor_kind"] | null;
          archived: boolean | null;
          avatar_path: string | null;
          created_at: string | null;
          delivered_seq: number | null;
          headline: string | null;
          history_visible_to_new: boolean | null;
          invited: boolean | null;
          invited_by_name: string | null;
          invited_names: Json | null;
          invited_others: boolean | null;
          kind: string | null;
          last_activity_at: string | null;
          last_author_id: string | null;
          last_author_name: string | null;
          last_kind: Database["public"]["Enums"]["message_kind"] | null;
          last_line: string | null;
          last_seq: number | null;
          member_names: Json | null;
          muted: boolean | null;
          name: string | null;
          other_member_id: string | null;
          others: boolean | null;
          parent_thread_id: string | null;
          pinned: boolean | null;
          pinned_at: string | null;
          read_seq: number | null;
          role: Database["public"]["Enums"]["thread_member_role"] | null;
          state: Database["public"]["Enums"]["thread_member_state"] | null;
          thread_id: string | null;
          unread: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey";
            columns: ["last_author_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "threads_kind_fkey";
            columns: ["kind"];
            isOneToOne: false;
            referencedRelation: "thread_kinds";
            referencedColumns: ["value"];
          },
          {
            foreignKeyName: "threads_parent_thread_id_fkey";
            columns: ["parent_thread_id"];
            isOneToOne: false;
            referencedRelation: "messenger_threads_view";
            referencedColumns: ["thread_id"];
          },
          {
            foreignKeyName: "threads_parent_thread_id_fkey";
            columns: ["parent_thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_admit_all: { Args: { p_reason: string }; Returns: number };
      admin_change_history: {
        Args: { p_before?: number; p_limit?: number };
        Returns: Json;
      };
      admin_dia_note_read: {
        Args: { p_compare: string; p_grain: string; p_tz: string };
        Returns: Json;
      };
      admin_dia_note_write: {
        Args: {
          p_compare: string;
          p_grain: string;
          p_statements: Json;
          p_tz: string;
        };
        Returns: undefined;
      };
      admin_grant_role: {
        Args: { p_member: string; p_reason: string; p_role: string };
        Returns: number;
      };
      admin_my_sessions: { Args: never; Returns: Json };
      admin_org_settings_read: { Args: never; Returns: Json };
      admin_org_settings_save: { Args: { p_patch: Json }; Returns: Json };
      admin_overview_company: { Args: never; Returns: Json };
      admin_overview_levers: {
        Args: { p_compare: string; p_grain: string; p_tz: string };
        Returns: Json;
      };
      admin_overview_mobilization: {
        Args: { p_compare: string; p_grain: string; p_tz: string };
        Returns: Json;
      };
      admin_overview_network: { Args: { p_tz: string }; Returns: Json };
      admin_overview_window: {
        Args: { p_compare: string; p_grain: string; p_tz: string };
        Returns: Json;
      };
      admin_read_log: {
        Args: { p_before?: number; p_limit?: number };
        Returns: Json;
      };
      admin_revoke_role: {
        Args: { p_member: string; p_reason: string; p_role: string };
        Returns: number;
      };
      admin_session_state: { Args: never; Returns: Json };
      admin_staff_settings_read: { Args: never; Returns: Json };
      admin_staff_settings_save: { Args: { p_patch: Json }; Returns: Json };
      claim_guest_registrations: { Args: never; Returns: Json };
      comment_intent: {
        Args: {
          p_comment: string;
          p_kind: string;
          p_line?: string;
          p_on: boolean;
        };
        Returns: Json;
      };
      comment_post: {
        Args: {
          p_body?: string;
          p_media?: string;
          p_parent?: string;
          p_post: string;
        };
        Returns: Json;
      };
      comment_react: {
        Args: {
          p_comment: string;
          p_emoji?: string;
          p_kind: string;
          p_picked?: boolean;
        };
        Returns: Json;
      };
      comment_reaction_rows: { Args: { p_comments: string[] }; Returns: Json };
      comment_reactors_author: { Args: { p_comment: string }; Returns: Json };
      comment_reactors_visible: { Args: { p_comment: string }; Returns: Json };
      connect_cards: {
        Args: {
          p_cursor?: string;
          p_filters?: Json;
          p_lens: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      connect_filter_options: { Args: never; Returns: Json };
      connect_requests_pending: { Args: never; Returns: boolean };
      connect_where: { Args: never; Returns: Json };
      connection_request_intros: {
        Args: { p_ids: string[] };
        Returns: {
          created_at: string;
          from_member_id: string;
          id: string;
          message: string;
          to_member_id: string;
          to_name: string;
          why: string;
        }[];
      };
      convene_discovery: {
        Args: {
          p_families?: string[];
          p_format?: string[];
          p_home?: string;
          p_home_rung?: string;
          p_lens?: string;
          p_places?: string[];
          p_price?: string[];
          p_q?: string;
          p_when?: string;
          p_without?: string;
        };
        Returns: Json;
      };
      convene_places: { Args: never; Returns: Json };
      dismiss_discovery_item: {
        Args: { p_event: string; p_section: string };
        Returns: undefined;
      };
      dismiss_suggestion: { Args: { p_target: string }; Returns: undefined };
      email_unsubscribe: { Args: { p_token: string }; Returns: string };
      email_unsubscribe_mint: { Args: { p_outbox_id: string }; Returns: string };
      event_alias_check: {
        Args: { p_alias: string; p_event: string };
        Returns: string;
      };
      event_going_names: { Args: { p_events: string[] }; Returns: Json };
      event_media_object: {
        Args: { p_key: string; p_kind: string; p_slug: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      event_page: { Args: { p_event: string }; Returns: Json };
      event_presenters: { Args: { p_events: string[] }; Returns: Json };
      event_public_page: { Args: { p_slug: string }; Returns: Json };
      event_speakers: {
        Args: { p_events: string[] };
        Returns: {
          avatar_path: string;
          event_id: string;
          handle: string;
          label: string;
          member_id: string;
          name: string;
          party_id: string;
          role: string;
        }[];
      };
      guest_link_request: {
        Args: { p_email: string; p_slug: string };
        Returns: Json;
      };
      guest_rsvp: {
        Args: { p_action: string; p_email: string; p_event: string };
        Returns: Json;
      };
      invite_event_party: {
        Args: { p_event: string; p_member: string; p_role: string };
        Returns: Json;
      };
      live_arms_admin_member: { Args: never; Returns: string };
      mark_surface_seen: { Args: { p_surface: string }; Returns: undefined };
      member_recent_reactions: { Args: never; Returns: string[] };
      messenger_archive: { Args: { p_thread: string }; Returns: undefined };
      messenger_delete: { Args: { p_message: string }; Returns: Json };
      messenger_delivered_to: {
        Args: { p_seq: number; p_thread: string };
        Returns: undefined;
      };
      messenger_dia_dismiss: { Args: { p_key: string }; Returns: undefined };
      messenger_dia_signals: {
        Args: never;
        Returns: {
          line: string;
          request_id: string;
          signal_key: string;
          thread_id: string;
        }[];
      };
      messenger_edit: {
        Args: { p_body: string; p_message: string };
        Returns: {
          author_deleted_at: string | null;
          author_id: string | null;
          body: string | null;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          link_preview: Json | null;
          media_id: string | null;
          pinned_by: string | null;
          reply_to: string | null;
          search: unknown;
          seq: number;
          thread_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_event_thread_available: {
        Args: { p_event: string };
        Returns: boolean;
      };
      messenger_event_thread_join: {
        Args: { p_event: string };
        Returns: string;
      };
      messenger_event_thread_open: {
        Args: { p_event: string };
        Returns: string;
      };
      messenger_mark_unread: { Args: { p_thread: string }; Returns: undefined };
      messenger_media_access: { Args: { p_media: string }; Returns: boolean };
      messenger_media_forget: { Args: { p_media: string }; Returns: boolean };
      messenger_media_locate: {
        Args: { p_media: string };
        Returns: {
          allowed: boolean;
          byte_size: number;
          mime: string;
          storage_path: string;
        }[];
      };
      messenger_media_marked: {
        Args: { p_limit?: number };
        Returns: {
          media_id: string;
          storage_path: string;
        }[];
      };
      messenger_media_record: {
        Args: {
          p_byte_size: number;
          p_height?: number;
          p_mime: string;
          p_storage_path: string;
          p_thread: string;
          p_width?: number;
        };
        Returns: {
          bucket: string;
          byte_size: number;
          created_at: string;
          crop: Json | null;
          delete_requested_at: string | null;
          focal_point: Json | null;
          height: number | null;
          id: string;
          kind: string;
          mime: string;
          optimized: boolean;
          owner_id: string;
          storage_path: string;
          width: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "media";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_mute: {
        Args: { p_duration?: string; p_thread: string };
        Returns: undefined;
      };
      messenger_open_one_to_one: { Args: { p_other: string }; Returns: string };
      messenger_pin_message: { Args: { p_message: string }; Returns: undefined };
      messenger_pin_thread: { Args: { p_thread: string }; Returns: undefined };
      messenger_react: {
        Args: { p_message: string; p_reaction: string };
        Returns: undefined;
      };
      messenger_read_to: {
        Args: { p_seq: number; p_thread: string };
        Returns: undefined;
      };
      messenger_recent_reactions: { Args: never; Returns: string[] };
      messenger_report: {
        Args: { p_message: string; p_note?: string; p_reason: string };
        Returns: string;
      };
      messenger_report_view: { Args: { p_report: string }; Returns: Json };
      messenger_request_accept: { Args: { p_request: string }; Returns: string };
      messenger_request_block: {
        Args: { p_request: string };
        Returns: undefined;
      };
      messenger_request_decline: {
        Args: { p_request: string };
        Returns: undefined;
      };
      messenger_request_recover: {
        Args: { p_request: string };
        Returns: undefined;
      };
      messenger_request_send: {
        Args: { p_body: string; p_recipient: string };
        Returns: {
          body: string;
          created_at: string;
          decided_at: string | null;
          id: string;
          recipient_id: string;
          sender_id: string;
          state: Database["public"]["Enums"]["message_request_state"];
          thread_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "message_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_search: {
        Args: {
          p_after?: string;
          p_before?: string;
          p_member?: string;
          p_query: string;
          p_thread?: string;
        };
        Returns: {
          created_at: string;
          headline: string;
          message_id: string;
          seq: number;
          thread_id: string;
        }[];
      };
      messenger_send: {
        Args: {
          p_body?: string;
          p_client_id: string;
          p_kind?: Database["public"]["Enums"]["message_kind"];
          p_link_preview?: Json;
          p_media?: string;
          p_mentions?: string[];
          p_reply_to?: string;
          p_thread: string;
        };
        Returns: {
          author_deleted_at: string | null;
          author_id: string | null;
          body: string | null;
          client_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          link_preview: Json | null;
          media_id: string | null;
          pinned_by: string | null;
          reply_to: string | null;
          search: unknown;
          seq: number;
          thread_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "messages";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_settings: {
        Args: never;
        Returns: {
          link_previews_enabled: boolean;
          media_notice_seen_at: string | null;
          member_id: string;
          reaction_skin_tone: string | null;
          receipts_chosen_at: string | null;
          receipts_enabled: boolean;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "member_messaging_settings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_settings_set: {
        Args: {
          p_link_previews?: boolean;
          p_media_notice_seen?: boolean;
          p_receipts?: boolean;
          p_skin_tone?: string;
        };
        Returns: {
          link_previews_enabled: boolean;
          media_notice_seen_at: string | null;
          member_id: string;
          reaction_skin_tone: string | null;
          receipts_chosen_at: string | null;
          receipts_enabled: boolean;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "member_messaging_settings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      messenger_space_thread_sync: {
        Args: { p_space: string };
        Returns: string;
      };
      messenger_thread_create_group: {
        Args: { p_member_ids: string[]; p_name: string };
        Returns: string;
      };
      messenger_thread_invite: {
        Args: { p_member: string; p_thread: string };
        Returns: undefined;
      };
      messenger_thread_invite_accept: {
        Args: { p_thread: string };
        Returns: undefined;
      };
      messenger_thread_invite_decline: {
        Args: { p_thread: string };
        Returns: undefined;
      };
      messenger_thread_leave: { Args: { p_thread: string }; Returns: undefined };
      messenger_thread_remove: {
        Args: { p_member: string; p_thread: string };
        Returns: undefined;
      };
      messenger_thread_rename: {
        Args: { p_name: string; p_thread: string };
        Returns: undefined;
      };
      messenger_thread_set_history: {
        Args: { p_thread: string; p_visible: boolean };
        Returns: undefined;
      };
      messenger_thread_set_role: {
        Args: {
          p_member: string;
          p_role: Database["public"]["Enums"]["thread_member_role"];
          p_thread: string;
        };
        Returns: undefined;
      };
      messenger_unarchive: { Args: { p_thread: string }; Returns: undefined };
      messenger_unpin_message: {
        Args: { p_message: string };
        Returns: undefined;
      };
      messenger_unpin_thread: { Args: { p_thread: string }; Returns: undefined };
      messenger_unreact: {
        Args: { p_message: string; p_reaction: string };
        Returns: undefined;
      };
      note_lane_act: {
        Args: { p_act: string; p_lane: string };
        Returns: undefined;
      };
      notification_email_view: { Args: never; Returns: Json };
      notifications_dot: { Args: never; Returns: boolean };
      notifications_mark_all_read: { Args: never; Returns: undefined };
      notifications_mark_seen: { Args: never; Returns: undefined };
      notify_deliver_token_ok: { Args: { p_token: string }; Returns: boolean };
      notify_outbox_claim: { Args: { p_limit?: number }; Returns: Json };
      notify_outbox_settle: {
        Args: {
          p_error?: string;
          p_id: string;
          p_resend_id?: string;
          p_state: string;
        };
        Returns: undefined;
      };
      notify_webhook_take: {
        Args: {
          p_email: string;
          p_event_id: string;
          p_reason: string;
          p_resend_id: string;
          p_type: string;
        };
        Returns: boolean;
      };
      onboard_relationship: {
        Args: {
          p_stance: Database["public"]["Enums"]["stance"];
          p_touched: boolean;
        };
        Returns: Json;
      };
      onboard_where: {
        Args: { p_city: string; p_country: string };
        Returns: Json;
      };
      onboard_who: {
        Args: { p_avatar_path?: string; p_name: string; p_username?: string };
        Returns: Json;
      };
      onboarding_state: { Args: never; Returns: Json };
      post_comments: {
        Args: {
          p_after?: string;
          p_after_id?: string;
          p_limit?: number;
          p_post: string;
        };
        Returns: Json;
      };
      post_intent: {
        Args: { p_kind: string; p_line?: string; p_on: boolean; p_post: string };
        Returns: Json;
      };
      post_latest_comments: { Args: { p_posts: string[] }; Returns: Json };
      post_react: {
        Args: {
          p_emoji?: string;
          p_kind: string;
          p_picked?: boolean;
          p_post: string;
        };
        Returns: Json;
      };
      post_reaction_rows: { Args: { p_posts: string[] }; Returns: Json };
      post_reactors_author: { Args: { p_post: string }; Returns: Json };
      post_reactors_visible: { Args: { p_post: string }; Returns: Json };
      profile_view: {
        Args: { p_as_public?: boolean; p_handle?: string };
        Returns: Json;
      };
      public_attestations: { Args: never; Returns: Json };
      publish_post: { Args: { payload: Json }; Returns: string };
      rate_limit_check: { Args: { p_action: string }; Returns: boolean };
      record_event: {
        Args: {
          p_app: string;
          p_kind: string;
          p_object_id: string;
          p_object_kind: Database["public"]["Enums"]["anchor_kind"];
          p_props: Json;
          p_referrer: string;
          p_session: string;
          p_surface: string;
          p_viewport: string;
        };
        Returns: undefined;
      };
      remove_event_party: { Args: { p_party: string }; Returns: Json };
      resolve_event_link: {
        Args: { p_kind: string; p_segment: string };
        Returns: string;
      };
      respond_to_event_role: {
        Args: { p_accept: boolean; p_party: string };
        Returns: Json;
      };
      respond_to_request: {
        Args: { p_accept: boolean; p_sender: string };
        Returns: undefined;
      };
      rsvp_event: {
        Args: {
          p_audience_override?: Database["public"]["Enums"]["audience"];
          p_contact_consent?: boolean;
          p_event: string;
          p_status: Database["public"]["Enums"]["registration_status"];
        };
        Returns: Json;
      };
      save_event_blocks: {
        Args: { p_blocks: Json; p_event: string };
        Returns: Json;
      };
      save_profile_section: {
        Args: { payload: Json; section: string };
        Returns: undefined;
      };
      send_introduction: {
        Args: { p_message: string; p_recipient: string };
        Returns: string;
      };
      session_revoke: { Args: { p_session_id: string }; Returns: undefined };
      sessions_list: {
        Args: never;
        Returns: {
          id: string;
          is_current: boolean;
          last_active_at: string;
          user_agent: string;
        }[];
      };
      set_follow: {
        Args: { p_on: boolean; p_target: string };
        Returns: undefined;
      };
      set_notification_preference: {
        Args: {
          p_c: Database["public"]["Enums"]["c_category"];
          p_channel: string;
          p_mode: string;
        };
        Returns: undefined;
      };
      set_subscription: {
        Args: { p_family: string; p_on: boolean };
        Returns: undefined;
      };
      vocabularies: { Args: never; Returns: Json };
      withdraw_request: { Args: { p_recipient: string }; Returns: undefined };
    };
    Enums: {
      anchor_kind:
        | "member"
        | "space"
        | "event"
        | "opportunity"
        | "connection_request"
        | "story"
        | "event_party"
        | "thread"
        | "message_request"
        | "post"
        | "comment";
      audience: "everyone" | "connections" | "anchored";
      c_category: "connect" | "convene" | "collaborate" | "contribute" | "convey" | "system";
      contribute_instrument: "time" | "skills" | "in_kind";
      delivery_kind: "physical" | "meeting_link" | "to_be_announced";
      edge_type:
        | "connect"
        | "follow"
        | "event_rsvp"
        | "event_attested"
        | "space_role"
        | "space_role_completed"
        | "contribution_fulfilled"
        | "story_about"
        | "authored";
      event_mode: "in_person" | "virtual" | "hybrid";
      event_party_status: "invited" | "accepted" | "declined";
      event_status: "draft" | "published" | "cancelled";
      heritage_kind:
        "First generation" | "Second generation" | "Third generation or later" | "Continental";
      link_kind: "website" | "linkedin" | "x" | "instagram";
      masthead_pattern: "kente" | "adinkra" | "mudcloth";
      message_kind: "text" | "voice" | "media" | "system";
      message_report_state: "open" | "reviewed" | "dismissed";
      message_request_state: "pending" | "accepted" | "declined" | "blocked";
      post_status: "draft" | "published";
      profile_section:
        | "about"
        | "stance"
        | "origin"
        | "where"
        | "work"
        | "skills"
        | "languages"
        | "intent"
        | "links"
        | "convene"
        | "collaborate"
        | "contribute"
        | "convey"
        | "badges";
      reachability: "open" | "connections_of_connections" | "off";
      registration_status: "going" | "not_going";
      request_status: "pending" | "accepted" | "declined" | "withdrawn";
      return_pathway:
        | "Already returned"
        | "Planning a return"
        | "Circular, both places"
        | "Not planning a return";
      return_timeline:
        "Already back" | "Within a year" | "One to three years" | "Someday, not fixed";
      space_role: "lead" | "member";
      space_role_status: "active" | "invited" | "left";
      space_status: "active" | "paused" | "completed";
      stance: "returnee" | "kin" | "anchor" | "ally" | "exploring";
      thread_member_role: "lead" | "co_lead" | "member";
      thread_member_state: "invited" | "active" | "left" | "removed";
      ticket_kind: "free" | "paid" | "donation";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      anchor_kind: [
        "member",
        "space",
        "event",
        "opportunity",
        "connection_request",
        "story",
        "event_party",
        "thread",
        "message_request",
        "post",
        "comment",
      ],
      audience: ["everyone", "connections", "anchored"],
      c_category: ["connect", "convene", "collaborate", "contribute", "convey", "system"],
      contribute_instrument: ["time", "skills", "in_kind"],
      delivery_kind: ["physical", "meeting_link", "to_be_announced"],
      edge_type: [
        "connect",
        "follow",
        "event_rsvp",
        "event_attested",
        "space_role",
        "space_role_completed",
        "contribution_fulfilled",
        "story_about",
        "authored",
      ],
      event_mode: ["in_person", "virtual", "hybrid"],
      event_party_status: ["invited", "accepted", "declined"],
      event_status: ["draft", "published", "cancelled"],
      heritage_kind: [
        "First generation",
        "Second generation",
        "Third generation or later",
        "Continental",
      ],
      link_kind: ["website", "linkedin", "x", "instagram"],
      masthead_pattern: ["kente", "adinkra", "mudcloth"],
      message_kind: ["text", "voice", "media", "system"],
      message_report_state: ["open", "reviewed", "dismissed"],
      message_request_state: ["pending", "accepted", "declined", "blocked"],
      post_status: ["draft", "published"],
      profile_section: [
        "about",
        "stance",
        "origin",
        "where",
        "work",
        "skills",
        "languages",
        "intent",
        "links",
        "convene",
        "collaborate",
        "contribute",
        "convey",
        "badges",
      ],
      reachability: ["open", "connections_of_connections", "off"],
      registration_status: ["going", "not_going"],
      request_status: ["pending", "accepted", "declined", "withdrawn"],
      return_pathway: [
        "Already returned",
        "Planning a return",
        "Circular, both places",
        "Not planning a return",
      ],
      return_timeline: [
        "Already back",
        "Within a year",
        "One to three years",
        "Someday, not fixed",
      ],
      space_role: ["lead", "member"],
      space_role_status: ["active", "invited", "left"],
      space_status: ["active", "paused", "completed"],
      stance: ["returnee", "kin", "anchor", "ally", "exploring"],
      thread_member_role: ["lead", "co_lead", "member"],
      thread_member_state: ["invited", "active", "left", "removed"],
      ticket_kind: ["free", "paid", "donation"],
    },
  },
} as const;

export type Views<T extends keyof DefaultSchema["Views"]> = DefaultSchema["Views"][T]["Row"];
