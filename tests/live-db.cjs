// The live arms that run inside the database, on one `pg` client over LIVE_DB_URL (rulings 382,
// 408, 409). The role is live_arms: membership in anon and authenticated with SET and without
// INHERIT, plus the fixture grants the r382 and Fix PR 02 migrations name, scoped by policy to the
// two ruling 218 test accounts. Every arm opens its own transaction, builds its own fixture
// (ruling 241), acts as a member by `set local role authenticated` plus transaction-local
// request.jwt.claims, exactly the way PostgREST sets them, and rolls back whatever happened
// (ruling 269: no persistent write to canonical data). Each arm carries a negative control and
// reports both results (ruling 270), and an arm that cannot run reports UNPROVEN, never a pass
// (ruling 228).
//
// Arms:
//   Hotfix 01 (rulings 374 to 376)  onboard_who accepts only the caller's registered avatar; the
//                                   fixture in tests/fixtures/hotfix01-onboard-who.sql runs byte
//                                   for byte, one statement batch, its own begin and rollback.
//   IB-18 (rulings 215, 415)         a direct insert into connection_requests as a member is
//                                   refused at the grant (42501); send_introduction still writes.
//   416                              the feed row for another member's post carries that member's
//                                   name; a Private author's name is withheld; anon has no feed.
//   435                              an attestation with accepted_at null is absent from the
//                                   member's own profile_view; once accepted it appears.
//   439                              publish_post refuses a javascript: link by name and stores an
//                                   https one.
//   442                              the ceiling plus one call to onboard_who is refused in words,
//                                   and the hits table is unreachable to a member.
//   Convene Pass 1 (521, 623)        publish_post writes a hybrid event with a link and a capacity as
//                                   the owner; the member selects the event and sees the physical
//                                   delivery row, no meeting_link row and no event_host_settings
//                                   row; the owner sees all three. Unproven until the Pass 1
//                                   migrations are on the project.
//   Brief 12 12A (1177, 1178, 1265,  the admin gate is the database: no policy cites is_admin, the
//   1266; handoff 40-A)              admin persona at aal1 holds a role and gets none, at aal2 grants
//                                   and revokes through the two audited RPCs, a member with no role
//                                   and signed out are refused, the two logs carry their append-only
//                                   triggers, and vocabularies() serves the six role kinds. The
//                                   admin persona is the id live_arms_admin_member() answers (382).
//   Brief 12 12C part 1 (1179, 1284,  the recording layer and the ledger: record_event refuses and
//   1294 to 1300; handoff 40-C)       accepts by the kind's row, a move writes one history row and
//                                   the side is read from history, is_african follows the African
//                                   Union list, the derivation is idempotent over the seeded data,
//                                   the four cron jobs are scheduled, and the catalogue is complete.
//   Brief 14 41-A (1330 to 1353,     Messenger's schema and server: a request accepted opens the
//   1368 to 1373; handoff 41-A)       pair's thread, a third member reads none of it, a blocked pair
//                                   reads zero rows, a late joiner sees nothing before joined_seq,
//                                   a send is idempotent and seq is dense, tick is 2 while receipts
//                                   are off, search stays inside scope, the 31st send in a minute
//                                   is refused, the publication stays empty, and the realtime topic
//                                   predicate grants the member's own inbox and denies another's.
//                                   The cap's refusal needs 257 member rows the project does not
//                                   hold and reports unproven (228); the trigger's presence is read.
//   Brief 14 41-B (1346, 1374; 346,  Messenger media on R2, the database half: the one writer records a
//   347, 1343, 1353; handoff 41-B)    row for each test account with the Messenger bucket and kind, an
//                                   unknown mime, a key outside the thread, audio with a size and an
//                                   object over the ceiling are each refused in a word, the access
//                                   question is true for the thread's other member and false for a
//                                   third, the locate hands the key only where access holds, and a
//                                   delete-for-everyone marks the row for the sweep that forgets it.
//   Brief 14 41-D (1341, 1384,       Messenger's held entry points: an eligible attendee joins the
//   1386, 1387, 1396; handoff 41-D)   host's event thread and a removed one does not, Recover returns
//                                   a declined request to pending, a lead or co-lead renames a group
//                                   and nobody renames an event thread, the list names a group's
//                                   last author and skips a blocked one, media reads Image or Video
//                                   to a member who does not own it, and video/quicktime records.
//                                   Addendum 1: joined_seq is the highest seq at a join and a rejoin,
//                                   and a decline or a recovery broadcasts to the recipient alone.
//   Brief 12 12B (1178, 1265, 1281,   the Overview's five projections and DIA's note cache: the gate
//   1304, 1310, 1311, 1362 to 1365;   refuses anon, no role and aal1 and answers admin and analyst
//   handoff 45-B)                     at aal2, every call logs one read, no member reaches the JSON,
//                                   a comparison before the first record is null with its reason,
//                                   weeks start Monday in the caller's zone, time to first act reads
//                                   a fixture member's days, what is not connected says so, and the
//                                   cache reads null, then what was written.
//   Handoff 55-A (1318, 1319,        the notification foundation: no function body but the writer,
//   1322, 1323, 1324, 1481, 1518,     its two siblings, the two member marks and the purge writes
//   1522)                            public.notifications; authenticated cannot execute
//                                   private.notify; an actor reads none of the rows they cause; a
//                                   recipient who blocks the actor reads none of theirs; an
//                                   introduction leaves its recipient one connection_request row and
//                                   a withdrawal none; the two dots answer booleans; vocabularies()
//                                   serves notification_kinds; the purge leaves unread rows.
//   Fix PR 10 (1483, 1621, 1613,      the Members order: with owner-test's request pending the
//   1636 to 1638; handoff 59-FIX-10   recipient's lens holds them at tier 0, withdrawn they fall
//   and addendum 1)                   back and the lens reads in ruled order, a member cannot call
//                                   the tier, and pages of two find every member once; the
//                                   reaction vocabulary agrees with the self-hosted emojibase file
//                                   outside the quick eight, which hold positions 1 to 8; a group
//                                   created with member-test picked writes one thread_invitation
//                                   row under Connect that Accept settles, the view names the
//                                   inviter to the invitee alone, and a stranger is refused before
//                                   any row.
//   H60-MEDIA (1709, 1673)           a fresh publish through publish_post has post_media.media_id
//                                   set by the trigger to the author's media row for the same
//                                   path, and null for a path no media row names; member-test reads
//                                   the media row a visible post names and not the owner's unlinked
//                                   one.
//
// Nothing here is secret: the connection string arrives from the runner and never from this file.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { runVisibilityConformance, CHECKS: CONFORMANCE } = require("./visibility-conformance.cjs");

const OWNER_HANDLE = "owner-test";
const MEMBER_HANDLE = "member-test";
/**
 * The two events that carry five or more going RSVPs, which Filling up must carry. The 1165 seed
 * (bfcc66ba-…, 01e7c23d-…) was replaced when the canonical event set was reseeded on 1 October 2026
 * (07:49 and 08:11 PDT); these are the two published future events of that seed with six going
 * registrations each, both test accounts among them, read on the canonical project in Session 55
 * (S54-1): the Johannesburg Returnee Supper and the Accra Diaspora Founders Breakfast. The arms
 * check that both still exist before reading against them, and report unproven when one does not.
 */
const SEEDED_FILLING = [
  "0a527cb8-79e3-4fae-97e0-4e12b5caff2e",
  "829b0fb7-72d5-4da5-bfe4-cc3ee9c14637",
];

/**
 * The claims PostgREST would set for a signed-in member. `aal` is the session's authenticator
 * assurance level as Supabase Auth writes it, "aal1" or "aal2"; left out, the claims carry none,
 * which the admin gate (1265) reads as not aal2.
 */
function claims(uid, aal) {
  const c = { sub: uid, role: "authenticated", aud: "authenticated" };
  if (aal) c.aal = aal;
  return JSON.stringify(c);
}

/**
 * pg's client config from LIVE_DB_URL. A password with a reserved character (#, /, @, ?) that was
 * pasted into the secret without percent-encoding makes the WHATWG URL parser inside pg throw
 * "Invalid URL" and take the whole suite down with it (run 165). So the string is parsed here
 * first, greedily up to the last @, and the parts are handed to pg explicitly; a string that fits
 * neither shape returns null and the arms report unproven rather than crashing. Never logged.
 */
function clientConfig(url) {
  const ssl = /sslmode=disable/.test(url) ? false : { rejectUnauthorized: false };
  const base = { ssl, statement_timeout: 60_000, query_timeout: 60_000 };
  try {
    const u = new URL(url);
    if (u.hostname) {
      return {
        ...base,
        host: u.hostname,
        port: u.port ? Number(u.port) : 5432,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
      };
    }
  } catch {
    /* fall through to the manual parse */
  }
  const m =
    /^postgres(?:ql)?:\/\/([^:@]+):(.*)@([^@\/:?]+)(?::(\d+))?(?:\/([^?]*))?(?:\?.*)?$/.exec(url);
  if (!m) return null;
  return {
    ...base,
    host: m[3],
    port: m[4] ? Number(m[4]) : 5432,
    user: decodeURIComponent(m[1]),
    password: m[2],
    database: m[5] ? decodeURIComponent(m[5]) : "postgres",
  };
}

/** Run one arm inside a transaction that always rolls back, on a client already connected. */
async function inTransaction(client, fn) {
  await client.query("begin");
  try {
    return await fn();
  } finally {
    await client.query("rollback").catch(() => {});
  }
}

/** Execute a statement expected to fail; returns {ok:false, code, message} or {ok:true, rows}. */
async function attempt(client, text, values) {
  await client.query("savepoint arm_step");
  try {
    const r = await client.query(text, values);
    await client.query("release savepoint arm_step");
    return { ok: true, rows: r.rows };
  } catch (e) {
    await client.query("rollback to savepoint arm_step");
    return { ok: false, code: e.code, message: e.message };
  }
}

async function actAs(client, uid, aal) {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims(uid, aal)]);
}

async function actAsSelf(client) {
  await client.query("reset role");
  await client.query("select set_config('request.jwt.claims', '', true)");
}

async function testAccounts(client) {
  const r = await client.query(
    "select id, handle, name from public.members where handle in ($1, $2)",
    [OWNER_HANDLE, MEMBER_HANDLE],
  );
  const owner = r.rows.find((m) => m.handle === OWNER_HANDLE) || null;
  const member = r.rows.find((m) => m.handle === MEMBER_HANDLE) || null;
  return { owner, member };
}

async function runLiveDbArms({ record, skip }) {
  const url = process.env.LIVE_DB_URL;
  const names = {
    hotfix: "Hotfix 01: onboard_who accepts only the caller's registered avatar (H1a, H1b, H1c)",
    ib18: "IB-18 (ruling 415): connection_requests has one writer at the API",
    feed: "ruling 416: the feed carries the author's name under can_see_core",
    accepted: "ruling 435: an attestation renders only once accepted",
    url: "ruling 439: publish_post refuses a link without an http or https scheme",
    rate: "ruling 442: the ceiling plus one call to onboard_who is refused in words",
    onboarded: "ruling 459 (W49): connect_cards excludes an account that has not onboarded",
    delivery:
      "Convene Pass 1 (521, 623): a second member reads the physical delivery row and neither the meeting link nor the host settings",
    attend:
      "Brief 10 (1030): a first going answer writes the convene default with no override, and a later answer writes an override only",
    guest:
      "Handoff 30-D (1026, 1034): a link request is normalized and throttled, the address is stored as a hash only, and guest_rsvp opens once, withdraws and goes again with no edge on a guest row (1002)",
    claim:
      "Handoff 30-D (1033): a confirmed member claims their guest row with its edge, the drift function stays at zero, and a second claim does nothing",
    discovery:
      "Handoff 34-A (1160): the owner's answer names every lane in lane_order and carries its lanes in that order, curated among them",
    attendPresenters:
      "Addendum 4 item 1 (1121): event_presenters answers an event's presenter and host exactly as event_page does",
    attendPublic:
      "Brief 10 (680, 1028): the signed-out page carries no registrant name, no going list, no viewer block and no meeting link",
    attendMemberRefused: "Brief 10 (1023): signed out cannot call the member projection",
    attendPresentersAnon: "Addendum 4 item 1 (1121): signed out cannot call event_presenters",
    attendMedia: "Brief 10 (1029): a client role may not call event_media_object",
    discoveryPick: "Brief 9 (1040): a pick renders as the editor's name and line",
    discoverySearch:
      "Handoff 34-A (1124, 1159): a search keeps the pick it names, one that matches nothing drops every lane, and past 100 characters it is refused with 22023",
    discoverySeed:
      "S54-1 (1165): both seeded Filling up events exist as published, future, uncancelled events",
    discoverySearchOne:
      "Handoff 34-A addendum (1173): a search whose matches sit one to a lane returns the lane: the seeded event's title returns Filling up holding it",
    discoveryBrowse:
      "Handoff 34-A addendum (1172): no section is browse or carries tiles, and lane_order names the ten lanes",
    discoveryFilling:
      "Handoff 34-A (1157, 1165): Filling up carries both seeded events, and event_going_names gives each three first names, none the viewer's own",
    discoveryNoCount: "Brief 9 (581, 632): the answer carries no count key",
    discoveryTaste:
      "Brief 9 (658, 1039): after set_subscription('culture_arts'), the taste lens carries that family",
    discoveryFormat: "Brief 9 (586, 693): an in-person facet drops the online lane",
    discoverySubInsert: "Brief 9 (1039): a direct insert into member_subscriptions is refused",
    discoveryThresholds: "Brief 9 (1045): a member cannot read private.convene_thresholds",
    discoveryRoles: "Brief 12 12A (1177): a member cannot read public.platform_roles",
    discoveryRetired:
      "Brief 9 (1041, 1093): events and the retired soon, online and near lenses are refused with 22023",
    discoveryDismissAll: "Brief 9 (1044): a dismissal in all is refused with 22023",
    discoveryDonation: "Handoff 32-B (1095): a price of donation is refused with 22023",
    discoveryPlaces:
      "Handoff 32-B (1095): convene_places() answers grounded places by kind; a city narrows and Near reads the place; a malformed place is refused",
    discoveryRungs:
      "Handoff 32-B (1110): each rung of a home answers; a rung without a home or an unknown rung is refused with 22023",
    discoveryForeignHome: "Brief 9 (1042): another member's home is refused as a facet with 22023",
    discoveryRail:
      "Handoff 32-B (1111): a member writes their own rail row; another member reads none of it and cannot write it",
    discoveryLaneAct:
      "Handoff 34-A (1160): note_lane_act refuses an unknown lane or act with 22023, and a noted act moves its lane first in lane_order",
    discoveryLaneInsert:
      "Handoff 34-A (1160): a direct insert into member_lane_activity is refused for a member, and another member reads none of the owner's rows",
    discoveryAliases:
      "Handoff 32-B (1080, 1100): a member cannot read event_aliases or reserved_link_words",
    discoveryVocab:
      "Handoff 34-A (1037, 1093, 1105, 1124, 1172): vocabularies() serves the nine families, the five lenses with their short words and the ten lanes in their base order",
    discoverySignedOut:
      "Brief 9 (662): signed out cannot call convene_discovery or convene_places, or read a rail row",
    discoveryGoingSignedOut:
      "Handoff 34-A (1128, 1160): signed out cannot call event_going_names or note_lane_act",
    discoveryWithout:
      "Handoff 35-A (1174): a read of All with p_without => 'follow' carries none of the events the follow lens returns",
    discoveryWithoutLens:
      "Handoff 35-A (1174): p_without with a lens other than All is refused with 22023",
    discoveryWithoutAll: "Handoff 35-A (1174): p_without => 'all' is refused with 22023",
    grants:
      "G61 (Session 35): no table in public carries TRUNCATE, REFERENCES, TRIGGER or MAINTAIN for anon or authenticated, and the default ACL for postgres in public grants none of them",
    discoveryDismiss:
      "Brief 9 (1044, 1105): a dismissal in curated empties that lane and is keyed on the lane alone",
    blocksNotHost:
      "Handoff 37-A (1186): a member who is not the event's host is refused by save_event_blocks with 42501",
    blocksSignedOut:
      "Handoff 37-A (1186): signed out cannot execute save_event_blocks and cannot select from event_blocks",
    blocksSave:
      "Handoff 37-A (1186, 1189): the host's save of one note block returns it, event_page shows it as the host, and event_public_page shows it for an event with a public page",
    blocksRefused:
      "Handoff 37-A (1186): a save with a programme payload missing its line is refused with 22023 and leaves the earlier blocks in place, and an empty list clears them",
    presenterKeys:
      "Handoff 37-C (1196, 1225): event_page carries event.family, viewer.subscribed and the presenter's headline and links, read as the event's host",
    presenterPublic:
      "Handoff 37-C (1196, 1225): event_public_page carries the presenter's headline and links and no family, read signed out",
    presenterSubscribe:
      "Handoff 37-C (1039, 1196): set_subscription flips viewer.subscribed on event_page for the event's family",
    admin: "Brief 12 12A (1266): no row in pg_policies cites is_admin",
    adminAal1:
      "Brief 12 12A (1265): the admin persona at aal1 reads holds_role true and roles empty and is refused admin_grant_role with 42501; at aal2 the same call is answered",
    adminGrant:
      "Brief 12 12A (1177, 1178): the admin persona at aal2 grants analyst to member-test, who then reads holds_role true with analyst among roles; the revocation returns them to holds_role false",
    adminRefused:
      "Brief 12 12A (1265, 1266): member-test at aal2 with no role is refused admin_grant_role with 42501, and a direct select on platform_roles, admin_actions and admin_reads is refused with 42501",
    adminLastAdmin:
      "Brief 12 12A: the admin persona revoking its own admin row is refused with 22023 while it is the only live admin",
    adminAppendOnly:
      "Brief 12 12A (1178): pg_trigger shows the update, delete and truncate triggers on admin_actions and admin_reads (the service-role refusal itself is not exercisable by live_arms and is not claimed)",
    adminSignedOut:
      "Brief 12 12A: signed out cannot execute admin_session_state, admin_grant_role or admin_revoke_role (42501)",
    adminVocab:
      "Brief 12 12A (1177): vocabularies() carries platform_role_kinds as the six roles in order",
    mobil:
      "Brief 12 12C (1179, 1297, 1298): record_event refuses an unknown kind, a disallowed prop, a member object and a signed-out non-public kind with 22023, accepts a signed-in feed_viewed and a signed-out event_page_viewed, and a member cannot read surface_events",
    mobilAnonymous:
      "Brief 12 12C part 2 (1361, 1616): an anonymous kind recorded while signed in writes a null member_id; the three access kinds are accepted signed out with a session id, their one allowed prop and nothing else; and a non-public kind signed out is still refused with 22023",
    mobilHistory:
      "Brief 12 12C (1295): a change of current_country writes one member_profile_history row, a save that changes none of the three writes none, and the table refuses update and delete",
    mobilAfrican:
      "Brief 12 12C (1295): every African Union member world_countries carries reads is_african true, and the United States reads false",
    mobilDerive:
      "Brief 12 12C (1284, 1294, 1296): the ledger holds Engaging rows for the accepted introductions on the seeded data and none for any RSVP, follow, save or heart, and re-running the derivation adds nothing",
    mobilSide:
      "Brief 12 12C (1295): a member living in Accra reads continent side with their own stance, and after a move to London reads diaspora while a moment before the move still reads continent",
    mobilCron: "Brief 12 12C (1179): the four cron jobs exist with their schedules",
    mobilCatalogue:
      "Brief 12 12C (1299, 1300): every table the migration created has a catalogue row with a treatment other than unreviewed, and no table in public is without a row",
    messenger:
      "Brief 14 41-A (1330, 1341): owner-test's request to member-test is pending, accept opens the pair's thread with the request text as seq 1, both rows active, and the sender then opens the same thread",
    messengerThird:
      "Brief 14 41-A (1116, 1349): a third member selects none of the thread's messages and lists no thread",
    messengerBlocked:
      "Brief 14 41-A (1349): after member-test blocks owner-test, the one_to_one select returns zero rows to the blocked member and a send is refused with blocked",
    messengerHistory:
      "Brief 14 41-A (1342): in a group of three with history off, the late joiner reads nothing before joined_seq and reads the message sent after",
    messengerIdempotent:
      "Brief 14 41-A (1351): a second send with the same client_id returns the first row unchanged",
    messengerSeq:
      "Brief 14 41-A (1351): two sends in sequence take seq 2 and 3 under the lock on the thread row (true concurrency needs two connections on a committed fixture, which 269 forbids; sequential density is what is proven)",
    messengerCap:
      "Brief 14 41-A (1332): the 257th active community_group member is refused with group_full",
    messengerCapTrigger:
      "Brief 14 41-A (1332): on_thread_members_cap is a before insert or update trigger on thread_members and its function names the ceiling internally",
    messengerTick:
      "Brief 14 41-A (1345): the author's own message reads tick 2 after the recipient reads it with receipts off, and 3 once both have receipts on",
    messengerSearch:
      "Brief 14 41-A (1338, 1347): search returns the row inside scope and excludes a thread the caller left",
    messengerRate:
      "Brief 14 41-A (1353): rate_limit_check('message_send') answers thirty times and refuses the 31st in a minute",
    messengerPublication: "Brief 14 41-A (1351): the supabase_realtime publication holds no table",
    messengerRealtime:
      "Brief 14 41-A (1351): the realtime.messages policy's predicate grants inbox:{self}, denies inbox:{other}, no client role holds an insert policy on realtime.messages, and a client insert does not land",
    messengerVocab:
      "Brief 14 41-A (1331, 1348, 1349, 1370): vocabularies() carries the seven thread kinds, three mute durations, six report reasons and five reaction words",
    messengerGrants:
      "Brief 14 41-A (1116): no client role holds insert, update or delete on any table 41-A created, and every one of them has a catalogue row",
    messengerEmojiOne:
      "Brief 14 41-E (1577, 1590): a member's reaction is one row that a second glyph replaces, the projection lists it once with own true, unreact removes it, and one of the five words is refused with bad_reaction",
    messengerEmojiTone:
      "Brief 14 41-E (1576, 1577): a modifier is stored on a hand, with and without the base's variation selector, and refused on a face with bad_reaction",
    messengerSkinTone:
      "Brief 14 41-E (1576, 1405): messenger_settings_set(p_skin_tone) stores a modifier, 'none' clears it, another character is refused, and messenger_recent_reactions answers the member's distinct emoji newest first",
    messengerCreateWords:
      "Brief 14 41-E (1581): messenger_thread_create_group raises bad_name, no_members, group_full, bad_member (self, an unknown id, a blocked member) and not_your_connection, each by the wrapper",
    messengerCreateInvited:
      "Brief 14 41-E (1580, 1592): a group's picked connection is in state invited with the creator its active lead, invited_names carries their name and member_names none, and the invited member's row reads invited",
    messengerRenameSystem:
      "Brief 14 41-E (1591): a rename writes one system row with body renamed and the renamer as author on the next seq, search does not return it, the list's last line skips it, and a pin of it is refused with bad_kind",
    r2mediaRecord:
      "Brief 14 41-B (1346, 1374): messenger_media_record writes a Messenger row for each test account, bucket r2:message-media, kind message, optimized for an image and not for audio",
    r2mediaMime:
      "Brief 14 41-B (1374): an unknown mime, audio with a size, an image without one and an object over 104857600 bytes are each refused in a word",
    r2mediaPath:
      "Brief 14 41-B (1374): a key outside the thread's own prefix and a key over 240 characters are refused",
    r2mediaAccess:
      "Brief 14 41-B (1346, 1349): messenger_media_access is true for the thread's other member once the message carries the object, false for a third member, and messenger_media_locate hands the key only where access holds",
    r2mediaSweep:
      "Brief 14 41-B (1343, F4): a delete-for-everyone marks the row, messenger_media_marked lists it, messenger_media_forget drops it once and not twice, and access is false from the mark on",
    r2mediaOnce:
      "Brief 14 41-C (M13, 1353): a media message counts once against message_media: with one slot left under the ceiling, the record takes it and the send that carries the object is not refused",
    msgd: "Brief 14 41-D (1384): before the host opens the event thread an attendee reads available false and join raises no_thread; after it a going registrant reads true and joins, a second join answers the same thread, an accepted named party joins, a member who is neither raises not_going, a member who left rejoins and a removed member raises not_a_member; a first join and a rejoin each set joined_seq to the thread's highest seq at that moment (Addendum 1, G199)",
    msgdBroadcast:
      "Brief 14 41-D Addendum 1 (157, G197): a request's insert reaches both inboxes, its decline and its recovery reach the recipient's inbox only, and its accept reaches both, read from realtime.messages as each member",
    msgdRecover:
      "Brief 14 41-D (1341): Recover returns a declined request to pending with decided_at null, a pending one raises not_declined and another member's raises not_your_request",
    msgdRename:
      "Brief 14 41-D (1387): the lead and a co-lead rename a group, the name is trimmed, a member raises not_a_lead, an event thread raises not_renamable and 81 characters raise bad_name",
    msgdView:
      "Brief 14 41-D (held item 4; 1386): a group row carries last_author_name for the last author, and once the viewer blocks that author the last line is the previous author's and unread ignores the blocked message",
    msgdWord:
      "Brief 14 41-D (held item 5): a member who does not own the media reads Image and Video in last_line, a reply's line and media_word, and a non-member reads null from private.messenger_media_word",
    msgdQuicktime:
      "Brief 14 41-D (1396): messenger_media_record accepts video/quicktime and still refuses a mime outside the list",
    overview:
      "Brief 12 12B (SPEC arm 1; 1265, 1311): every Overview projection refuses anon, member-test with no role at aal2 and the admin persona at aal1 with 42501, and answers the admin persona and an analyst at aal2",
    overviewLog:
      "Brief 12 12B (SPEC arm 2; 1178): every projection call writes exactly one admin_reads row naming its projection",
    overviewNoMember:
      "Brief 12 12B (SPEC arm 3; 1281): no projection's JSON carries a member id, handle or name, and no key names one",
    overviewComparison:
      "Brief 12 12B (SPEC arm 4; 1310): a comparison window with no recorded activity answers comparison null with before_first_record and first_record, and this week against last answers a window",
    overviewWeek:
      "Brief 12 12B (SPEC arm 5; 1304, 1305): a week in America/Los_Angeles starts Monday 00:00 Pacific, the same call in Africa/Accra starts Monday 00:00 GMT, and an unknown zone is refused with 22023",
    overviewFirstAct:
      "Brief 12 12B (arm B-a; 1365): a member onboarded in the window with a ledger act after it gives Time to first act that member's days, and with no act the value is null",
    overviewNotConnected:
      "Brief 12 12B (arm B-b; 1362 to 1364, 1615): Admitted, Invites, Story-led, partner and DNA system sources and the four company lines answer null with not_connected, and Onboarding Started and drop-off answer connected",
    overviewOnboarding:
      "Brief 12 12C part 2 (1364, 1615): admin_overview_levers answers Started from members.created_at and the drop-off by step as onboarding_state() reads it, on two test accounts seeded inside the transaction, one on who and one on relationship, under the year grain",
    overviewCache:
      "Brief 12 12B (SPEC Part D item 4): DIA's note cache reads null before a write, answers the statements after it, and refuses a non-array with 22023",
    settings:
      "Brief 12 Settings (handoff 45-D arm 1; 1392): vocabularies() returns the appearances, the seven grains, the two comparisons and the reporting zones, every zone one pg_timezone_names knows, and a zone row with an unknown identifier is refused with 22023",
    settingsPersonal:
      "Brief 12 Settings (handoff 45-D arm 2; 1265, 1382): a staff member at aal2 reads and changes only their own row; at aal1, with no role, and as anon every read and write is refused with 42501",
    settingsOrg:
      "Brief 12 Settings (handoff 45-D arm 3; 1391): any staff role at aal2 reads the company settings; only admin writes; each change writes exactly one admin_actions row with its before and after, and a no-change write writes none",
    settingsLogs:
      "Brief 12 Settings (handoff 45-D arm 4; 1178): the read log and the change history each write one admin_reads row naming themselves, and the read log's newest entry is that read, labelled Settings, Your read log",
    settingsSessions:
      "Brief 12 Settings (handoff 45-D arm 4): the sessions read carries no IP address and marks as current exactly the session the JWT's session_id names",
    notif:
      "Handoff 55-A (1319): no function body but private.notify, private.notification_retract, private.notification_settle, notifications_mark_seen, notifications_mark_all_read and private.purge_read_notifications (1324) writes public.notifications",
    notifExecute: "Handoff 55-A (1319): authenticated cannot execute private.notify (42501)",
    notifIntro:
      "Handoff 55-A (461, 471, N1): send_introduction from owner-test leaves member-test one connection_request row, and withdrawing it leaves none",
    notifActor:
      "Handoff 55-A (1323, N9): the actor reads none of the rows they caused, while the recipient reads theirs",
    notifBlock:
      "Handoff 55-A (1518, N10): a recipient who blocks the actor reads no row from them, having read one before the block",
    notifDots:
      "Handoff 55-A (82, 1322, 1522): notifications_dot and connect_requests_pending answer booleans, true for the recipient of a fresh request, with no count",
    notifSeen:
      "Handoff 55-A (1322, 1522): notifications_mark_seen clears the dot while the row stays unread, and mark_surface_seen('my_network') clears the pending dot",
    notifVocab:
      "Handoff 55-A (1318): vocabularies() serves notification_kinds, connection_request among them with renders true and its destination in words",
    notifPurge:
      "Handoff 55-A (1324, N12): private.purge_read_notifications deletes a row read 200 days ago and leaves an unread row",
    members:
      "Fix PR 10 item 2 (1483, 241, 270): with owner-test's request pending, member-test's Members lens holds owner-test at tier 0 with no member of a later tier before them; withdrawn, owner-test falls back and both reads are in (tier, name, id) order, so the assertion discriminates",
    membersTier:
      "Fix PR 10 item 2 (1483, 212): private.members_order_tier is revoked from authenticated and answers 0 for the recipient of a pending request and not 0 once it is withdrawn",
    membersPaging:
      "Fix PR 10 W94 (1483, 241, 270): paging member-test's Members lens two at a time finds every member the one-page read finds, each exactly once, so no page boundary skips a member",
    invite:
      "Fix PR 10 item 8 (1637, 1636, 1623): a group created with member-test picked leaves member-test one thread_invitation row with c_category connect, and Accept settles it",
    inviteName:
      "Fix PR 10 item 9 (1638): messenger_threads_view carries invited_by_name as the inviter's name on the invited member's row and null on the inviter's",
    inviteRefused:
      "Fix PR 10 item 8 (1581): a group picking a member who is not a connection is refused with not_your_connection before any thread or row is written",
    mediaLink:
      "H60-MEDIA (1709): a fresh publish has post_media.media_id set by the trigger to the author's media row for the same path, and null where no media row names the path",
    mediaRead:
      "H60-MEDIA (1709, 141): member-test reads the media row a visible post's image names, and not an unlinked media row of another member",
    emojiAgree:
      "Fix PR 10 item 3 (1621, 1613): every message_reaction_emoji row outside the quick eight carries emojibase 17.0.0's English label capitalised as src/lib/emoji.ts capitalises it, and the eight quick rows hold positions 1 to 8",
    nc: "Handoff 60-NC (1554, Finding 1): set_notification_preference refuses a mode outside notification_email_modes with 22023 and takes one inside it, and the two check constraints are foreign keys to the vocabulary",
    ncCategories:
      "Handoff 60-NC (1555, Finding 2): notification_categories' keys are c_category's labels, every one, in the enum's order, and vocabularies() serves both email vocabularies",
    ncView:
      "Handoff 60-NC (1553, 1560): with connection_request given copy, notification_email_view answers Connect with copy and the shared default off and no other category with copy, and a mode saved through set_notification_preference reads back",
    ncToken:
      "Handoff 60-NC (G245, 1529, 1572): a token email_unsubscribe_mint returns for the outbox row a notification enqueued turns every category off for its member on email_unsubscribe as anon, and the same token a second time answers expired and changes nothing",
    ncTokenAged:
      "Handoff 60-NC (G245, 1572): a token 61 days old answers expired and leaves the member's modes as they were",
    vt: "H61-VT (1747): before the block, each account reads the other's everyone section: row present both ways",
    vtEveryone:
      "H61-VT (1747): a blocked party reads an everyone section of the blocker: row present",
    vtConnections:
      "H61-VT (1747): a blocked party reads a connections section of the blocker: no row",
    vtAnchored:
      "H61-VT (1747): a blocked party who shares an anchor reads an anchored section of the blocker: no row",
    vtAnchoredControl:
      "H61-VT control (1747): the same anchored read with no block: row present, both ways",
    vtReverseEveryone:
      "H61-VT (1747): the blocker reads the blocked party's everyone section: row present",
    vtReverseConnections:
      "H61-VT (1747): the blocker reads the blocked party's connections section: no row",
    vtReverseAnchored:
      "H61-VT (1747): the blocker reads the blocked party's anchored section across the shared anchor: no row",
    h62a: "H62-A (1817): post_react sets Asante, changes it to Celebrate, and removes it when the held kind is chosen again; one row throughout",
    h62aOther:
      "H62-A (1821, 1818): post_react with other and a picker emoji stores the vocabulary base, and a seventh distinct reaction from one member still yields one row",
    h62aOtherRefused:
      "H62-A control: other with a character the vocabulary does not hold is refused with 22023",
    h62aIntent:
      "H62-A (1798, 1802): post_intent turns I can help on with a line, stores the line trimmed, and off removes the row",
    h62aReaderKeys:
      "H62-A (1797, 1799): a reader's summary carries exactly intents, kinds, more, other, own and people, and the reader's sheet carries no intent, no line and no figure",
    h62aAuthorRefused:
      "H62-A (1799): post_reactors_author raises 42501 for a member who did not author the post",
    h62aAuthor:
      "H62-A control (1799): the author reads exact figures per kind with every row named",
    h62aNotify:
      "H62-A (1802, 1317, 1316): an intent writes one intent_help row for the author under the post's C with a group key per post, a second on after an off folds into it rather than adding one, and the public reactions wrote none",
    h62aBlocked:
      "H62-A (186, 198): across a block the author's list carries no name for the blocked member and the blocked member reads no post at all",
    h62aPrivate:
      "H62-A (141, 1734): a reactor private.visible_to does not admit for the author reaches the author's list with no name, handle or photo",
    h62aCarry:
      "H62-A (1826): every post_reactions row that predates 20261015120100 reads asante with no emoji",
    h62g: "H62-G (1796, 1820): comment_post writes a comment the thread answers with its author named, oldest first by (created_at, id), and the post author's own comment carries the Author mark",
    h62gReply:
      "H62-G (1677): a reply to a top-level comment lands under it in post_comments, and a reply to a reply is refused with 22023 reply_to_reply",
    h62gRefused:
      "H62-G (141): a comment on a post the caller may not see is refused with 42501, and goes once the post is readable again",
    h62gBlocked:
      "H62-G (186, 198): across a block the post's author reads no comment by the blocked member and no name of theirs, and the blocked member reads no thread at all",
    h62gReact:
      "H62-G (1817, 1822): comment_react sets Asante and removes it when the held kind is chosen again, read through comment_reaction_rows; comment_intent stores its line trimmed for the commenter's sheet, which refuses a member who did not write the comment",
    h62gNotify:
      "H62-G (1849, 1817, 1316): a comment writes one comment_on_post row for the post's author with the post as object, a reply one reply_to_comment row for the commenter with the comment as object, an intent on a comment one intent_help row with the comment as object, the author's own comment writes none, and the reactions wrote none",
    // The conformance arm's checks (tests/visibility-conformance.cjs), listed here so that a run
    // that cannot connect reports each of them UNPROVEN by name (G143, 228).
    ...Object.fromEntries(Object.entries(CONFORMANCE).map(([k, v]) => ["conformance" + k, v])),
  };
  // G143: a block that opens with a presence probe carries every arm it holds in `names`, under one key
  // prefix, so a probe that fails reports each of them UNPROVEN and the job's total does not fall with
  // the coverage it lost. A key added here joins its block's list by its prefix.
  const armsOf = (prefix) =>
    Object.keys(names)
      .filter((k) => k.startsWith(prefix))
      .map((k) => names[k]);
  const unreachedIn = (prefix, why) => {
    for (const n of armsOf(prefix).filter((n) => n !== names[prefix])) skip(n, why);
  };
  if (process.env.SKIP_REST) {
    for (const n of Object.values(names)) skip(n, "SKIP_REST");
    return;
  }
  if (!url) {
    for (const n of Object.values(names)) skip(n, "set LIVE_DB_URL (ruling 382)");
    return;
  }
  let pg;
  try {
    pg = require("pg");
  } catch {
    for (const n of Object.values(names)) skip(n, "the pg package is not installed");
    return;
  }
  const config = clientConfig(url);
  if (!config) {
    for (const n of Object.values(names))
      skip(n, "LIVE_DB_URL is not a postgres:// connection string this arm can parse");
    return;
  }
  let client;
  try {
    client = new pg.Client(config);
    await client.connect();
  } catch (e) {
    for (const n of Object.values(names)) skip(n, "could not connect: " + String(e.message || e));
    return;
  }
  try {
    const who = await client.query("select current_user as u");
    record(
      "ruling 382: the arms connect as live_arms and nothing broader",
      who.rows[0] && who.rows[0].u === "live_arms",
      "current_user " + (who.rows[0] && who.rows[0].u),
    );

    // ------------------------------------------------------------------------------------------
    // H61-VT (1734, 1747): the conformance arm, on this client, as live_arms, before any fixture.
    // It reads the catalog only. A throw here is reported on every check it holds, by name.
    // ------------------------------------------------------------------------------------------
    try {
      await runVisibilityConformance({ client, record, skip });
    } catch (e) {
      await client.query("rollback").catch(() => {});
      unreachedIn("conformance", "the conformance arm threw: " + String(e.message || e));
    }

    // ------------------------------------------------------------------------------------------
    // Hotfix 01: the fixture file, byte for byte. It opens and rolls back its own transaction.
    // ------------------------------------------------------------------------------------------
    {
      const sql = fs.readFileSync(
        path.join(__dirname, "fixtures/hotfix01-onboard-who.sql"),
        "utf8",
      );
      let rows = null;
      try {
        const results = await client.query(sql);
        const list = Array.isArray(results) ? results : [results];
        const withRows = list.find((r) => r && Array.isArray(r.rows) && r.rows.length);
        rows = withRows ? withRows.rows : [];
      } catch (e) {
        await client.query("rollback").catch(() => {});
        skip(names.hotfix, "the fixture batch failed: " + String(e.message || e));
      }
      if (rows) {
        const byOrd = new Map(rows.map((row) => [row.ord, row]));
        for (const row of rows.filter((x) => x.ord === 0)) {
          record("Hotfix 01: " + row.step, !!row.ok, "expected " + row.expect + "; got " + row.got);
        }
        for (const [ord, label] of [
          [1, "H1a: a registered avatar path is accepted"],
          [2, "H1b: an unregistered path under the caller's folder is refused"],
          [3, "H1c: a registered path owned by another member is refused"],
        ]) {
          const row = byOrd.get(ord);
          if (!row) skip("Hotfix 01: " + label, "no result row; the fixture did not reach it");
          else
            record(
              "Hotfix 01: " + row.step,
              !!row.ok,
              "expected " + row.expect + "; got " + row.got,
            );
        }
      }
    }

    const { owner, member } = await testAccounts(client);
    if (!owner || !member) {
      for (const n of [
        names.ib18,
        names.feed,
        names.accepted,
        names.url,
        names.rate,
        names.onboarded,
        names.mediaLink,
        names.mediaRead,
      ])
        skip(n, "owner-test and member-test are not both present");
      return;
    }

    // ------------------------------------------------------------------------------------------
    // IB-18. The negative control is the one path that still writes: send_introduction.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAs(client, member.id);
      const direct = await attempt(
        client,
        "insert into public.connection_requests (from_member_id, to_member_id, to_name, status) values ($1, $2, $3, 'pending')",
        [member.id, owner.id, owner.name],
      );
      record(
        "IB-18 (ruling 415): a direct insert into connection_requests as a member is refused at the grant",
        !direct.ok && direct.code === "42501",
        direct.ok ? "the insert was accepted" : direct.code + " " + direct.message,
      );
      const viaPath = await attempt(client, "select public.send_introduction($1, $2) as id", [
        owner.id,
        "Ruling 415 arm. Rolled back by the same run.",
      ]);
      if (!viaPath.ok && /not available/.test(viaPath.message)) {
        skip(
          "IB-18 control: send_introduction as the same member still writes",
          "the two test accounts are not strangers (a request is pending, they are connected, or one blocks the other), so the one path refuses by design",
        );
      } else {
        record(
          "IB-18 control: send_introduction as the same member still writes",
          viaPath.ok && !!viaPath.rows[0] && !!viaPath.rows[0].id,
          viaPath.ok ? "request " + viaPath.rows[0].id : viaPath.code + " " + viaPath.message,
        );
      }
    });

    // ------------------------------------------------------------------------------------------
    // 416. The owner's post (published by the arm if they have none), read as the other member.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAs(client, owner.id);
      let post = await client.query(
        "select id from public.feed where author_kind = 'member' and author_id = $1 limit 1",
        [owner.id],
      );
      let postId = post.rows[0] ? post.rows[0].id : null;
      if (!postId) {
        const pub = await attempt(client, "select public.publish_post($1::jsonb) as id", [
          JSON.stringify({
            body: "Ruling 416 feed author arm. Rolled back by the same run.",
            author_kind: "member",
            author_id: owner.id,
            audience: "everyone",
            host_context: "live-checks",
          }),
        ]);
        postId = pub.ok ? pub.rows[0].id : null;
        record(
          "ruling 416: the arm publishes a post as the owner so there is a row to read",
          !!postId,
          pub.ok ? "post " + postId : pub.code + " " + pub.message,
        );
      }
      if (!postId) {
        skip(names.feed, "no post by the owner could be read or published");
        return;
      }
      await actAs(client, member.id);
      const asMember = await client.query(
        "select author_name, author_handle from public.feed where id = $1",
        [postId],
      );
      const row = asMember.rows[0];
      record(
        "ruling 416: the feed row for the other member's post carries their name and handle",
        !!row && row.author_name === owner.name && row.author_handle === owner.handle,
        row ? "author_name " + JSON.stringify(row.author_name) : "no row",
      );
      // Control: the owner turns Private. can_see_core then refuses a stranger, so the name is
      // withheld: either the row still comes back with author_name null, or the row is gone.
      await actAs(client, owner.id);
      const priv = await attempt(
        client,
        "update public.members set profile_private = true where id = $1",
        [owner.id],
      );
      await actAs(client, member.id);
      const afterPriv = await client.query("select author_name from public.feed where id = $1", [
        postId,
      ]);
      const r2 = afterPriv.rows[0];
      record(
        "ruling 416 control: a Private author's name is withheld from a stranger",
        priv.ok && (!r2 || r2.author_name === null),
        !priv.ok
          ? "could not set Private: " + priv.message
          : r2
            ? "row present, author_name " + JSON.stringify(r2.author_name)
            : "row absent",
      );
      await client.query("set local role anon");
      const anon = await attempt(client, "select id from public.feed limit 1");
      record(
        "ruling 416 control: anon has no feed",
        !anon.ok && anon.code === "42501",
        anon.ok ? "anon read the feed" : anon.code,
      );
    });

    // ------------------------------------------------------------------------------------------
    // 435. One attestation on the owner, unaccepted; the owner's own projection omits it.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const ins = await attempt(
        client,
        `insert into public.attestations (member_id, c_category, object_kind, object_id, attester_member_id, attester_role, accepted_at)
         values ($1, 'collaborate', 'space', gen_random_uuid(), $2, 'Space lead', null) returning id`,
        [owner.id, member.id],
      );
      if (!ins.ok) {
        skip(
          names.accepted,
          "the fixture row could not be inserted: " + ins.code + " " + ins.message,
        );
        return;
      }
      const attId = ins.rows[0].id;
      const badgesOf = async () => {
        await actAs(client, owner.id);
        const v = await client.query("select public.profile_view() as v");
        const body = v.rows[0] ? v.rows[0].v : null;
        const items = [];
        for (const g of (body && body.badges) || []) for (const it of g.items || []) items.push(it);
        return { tier: body && body.member && body.member.tier, items };
      };
      const before = await badgesOf();
      record(
        "ruling 435: an attestation with accepted_at null is absent from the member's own profile_view",
        !before.items.some((it) => it.attester === member.name && it.object === "Attested") &&
          before.tier !== "attested",
        "badges " + before.items.length + " tier " + before.tier,
      );
      await actAsSelf(client);
      const acc = await attempt(
        client,
        "update public.attestations set accepted_at = now() where id = $1",
        [attId],
      );
      const after = await badgesOf();
      record(
        "ruling 435 control: the same row appears once accepted, and the tier reads attested",
        acc.ok &&
          after.items.some((it) => it.attester === member.name && it.object === "Attested") &&
          after.tier === "attested",
        acc.ok
          ? "badges " + after.items.length + " tier " + after.tier
          : acc.code + " " + acc.message,
      );
    });

    // ------------------------------------------------------------------------------------------
    // 439. A javascript: link is refused by name; an https link publishes and is stored.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAs(client, owner.id);
      const payload = (url) =>
        JSON.stringify({
          body: "Ruling 439 link arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          link: { url },
        });
      const bad = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        payload("javascript:alert(1)"),
      ]);
      record(
        "ruling 439: a publish carrying javascript:alert(1) is refused by name",
        !bad.ok && /must start with http:\/\/ or https:\/\//.test(bad.message),
        bad.ok ? "the publish was accepted" : bad.code + " " + bad.message,
      );
      const good = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        payload("https://example.com/"),
      ]);
      let stored = null;
      if (good.ok) {
        const l = await client.query("select url from public.post_links where post_id = $1", [
          good.rows[0].id,
        ]);
        stored = l.rows[0] ? l.rows[0].url : null;
      }
      record(
        "ruling 439 control: an https link publishes and is stored as given",
        good.ok && stored === "https://example.com/",
        good.ok ? "stored " + JSON.stringify(stored) : good.code + " " + good.message,
      );
    });

    // ------------------------------------------------------------------------------------------
    // H60-MEDIA (1709). Two media rows for owner-test, written as live_arms under its fixture insert
    // policy (no returning: live_arms holds insert alone), one named by the post and one not. The
    // owner publishes through publish_post, the one writer of post_media, with the named path and
    // a path no media row holds (the control: the trigger links nothing for it). member-test then
    // reads the linked row through media_post_viewer_select and not the loose one. Rolled back.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const linked = crypto.randomUUID();
      const loose = crypto.randomUUID();
      const named = owner.id + "/h60-arm/" + linked + ".jpg";
      const unnamed = owner.id + "/h60-arm/" + crypto.randomUUID() + ".jpg";
      const ins = await attempt(
        client,
        "insert into public.media (id, owner_id, bucket, kind, storage_path, mime, byte_size, width, height, focal_point) values " +
          "($1, $3, 'post-media', 'post', $4, 'image/jpeg', 1024, 1200, 1600, '{\"x\": 0.5, \"y\": 0.2}'::jsonb), " +
          "($2, $3, 'post-media', 'post', $5, 'image/jpeg', 1024, 1600, 1200, null)",
        [linked, loose, owner.id, named, owner.id + "/h60-arm/" + loose + ".jpg"],
      );
      if (!ins.ok) {
        const why = "the fixture media rows could not be written: " + ins.code + " " + ins.message;
        skip(names.mediaLink, why);
        skip(names.mediaRead, why);
        return;
      }
      await actAs(client, owner.id);
      const pub = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        JSON.stringify({
          body: "H60-MEDIA media_id arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          media: [
            { storage_path: named, width: 1200, height: 1600, position: 0 },
            { storage_path: unnamed, width: 1600, height: 1200, position: 1 },
          ],
        }),
      ]);
      if (!pub.ok) {
        const why = "publish_post refused: " + pub.code + " " + pub.message;
        skip(names.mediaLink, why);
        skip(names.mediaRead, why);
        return;
      }
      const postId = pub.rows[0].id;
      const rows = (
        await client.query(
          "select storage_path, media_id from public.post_media where post_id = $1 order by position",
          [postId],
        )
      ).rows;
      const first = rows[0];
      const second = rows[1];
      record(
        names.mediaLink,
        rows.length === 2 &&
          !!first &&
          first.media_id === linked &&
          !!second &&
          second.media_id === null,
        JSON.stringify(rows.map((r) => (r.media_id === linked ? "linked" : r.media_id))),
      );
      await actAs(client, member.id);
      const seen = (
        await client.query("select id from public.post_media where post_id = $1", [postId])
      ).rows.length;
      const read = (
        await client.query("select id, focal_point from public.media where id = any($1::uuid[])", [
          [linked, loose],
        ])
      ).rows;
      const got = read.find((r) => r.id === linked);
      record(
        names.mediaRead,
        seen === 2 &&
          !!got &&
          !!got.focal_point &&
          Number(got.focal_point.y) === 0.2 &&
          !read.some((r) => r.id === loose),
        JSON.stringify({
          postMediaSeen: seen,
          linked: !!got,
          focal: got ? got.focal_point : null,
          loose: read.some((r) => r.id === loose),
        }),
      );
    });

    // ------------------------------------------------------------------------------------------
    // 442. onboard_who ten times with a username that cannot be written (invalid, no write), then
    // the eleventh. The owner's onboarding stamps are cleared first, as the Hotfix 01 fixture does,
    // so the function reaches its checks; everything rolls back.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      await client.query(
        "update public.members set onboarded_at = null, who_completed_at = null where id = $1",
        [owner.id],
      );
      await actAs(client, owner.id);
      const CEILING = 10;
      let under = 0;
      let last = null;
      for (let i = 0; i < CEILING; i++) {
        const r = await attempt(client, "select public.onboard_who($1, $2, null) as out", [
          owner.name,
          "x",
        ]);
        last = r;
        if (r.ok && r.rows[0] && r.rows[0].out && r.rows[0].out.status === "invalid") under++;
      }
      record(
        "ruling 442 control: calls under the ceiling are answered",
        under === CEILING,
        under + " of " + CEILING + " answered" + (last && !last.ok ? "; last " + last.message : ""),
      );
      const over = await attempt(client, "select public.onboard_who($1, $2, null) as out", [
        owner.name,
        "x",
      ]);
      record(
        "ruling 442: the ceiling plus one call to onboard_who is refused in words",
        !over.ok && /Too many attempts/.test(over.message),
        over.ok ? "the call was answered" : over.code + " " + over.message,
      );
      const peek = await attempt(client, "select count(*) from private.rate_limit_hits");
      record(
        "ruling 442: the hits table is unreachable to a member",
        !peek.ok && peek.code === "42501",
        peek.ok ? "a member read the table" : peek.code,
      );
    });

    // ------------------------------------------------------------------------------------------
    // 459 (W49). The arm builds its own fixture (ruling 241): it sets Member Test's onboarded_at
    // inside the transaction, measures the projections and the write path with it set, then clears
    // it and measures the same three again. The pair with onboarded_at set is the negative control
    // ruling 270 asks for, so each refusal is read against the behaviour it reverts to and not
    // against nothing. The control write is taken inside a savepoint and rolled back, so the
    // request row it creates cannot be the reason the gated attempt is refused.
    //
    // connect_where is the country mosaic, not a list of members: it returns the country names that
    // hold at least private.setting_int('where_floor', 5) admitted members, so one member entering
    // or leaving it is observable only at that boundary. The arm reads it both ways and states
    // which case it met rather than asserting an absence that would pass for the wrong reason.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      const seen = async () => {
        await actAs(client, owner.id);
        const cards = await attempt(
          client,
          "select public.connect_cards('members', '{}'::jsonb, null, 200) as out",
        );
        const where = await attempt(client, "select public.connect_where() as out");
        const text = (r) => JSON.stringify(r.ok && r.rows[0] ? r.rows[0].out : null);
        const mosaic = where.ok && where.rows[0] ? where.rows[0].out : null;
        return {
          inCards: cards.ok && text(cards).includes(member.id),
          where: where.ok ? text(where) : null,
          tiles: mosaic ? (mosaic.continent || []).length + (mosaic.diaspora || []).length : 0,
          err: cards.ok ? (where.ok ? null : where.message) : cards.message,
        };
      };
      const intro = async () => {
        await actAs(client, owner.id);
        await client.query("savepoint r459_intro");
        const r = await attempt(client, "select public.send_introduction($1, $2) as id", [
          member.id,
          "Ruling 459 arm. Rolled back by the same run.",
        ]);
        await client.query("rollback to savepoint r459_intro");
        return r;
      };

      await actAsSelf(client);
      await client.query("update public.members set onboarded_at = now() where id = $1", [
        member.id,
      ]);
      const control = await seen();
      const controlIntro = await intro();

      await actAsSelf(client);
      await client.query("update public.members set onboarded_at = null where id = $1", [
        member.id,
      ]);
      const gated = await seen();
      const gatedIntro = await intro();

      if (!control.inCards) {
        skip(
          names.onboarded,
          control.err
            ? "a projection could not be read: " + control.err
            : "the onboarded member is not in connect_cards to begin with, so their absence proves nothing",
        );
      } else {
        record(
          names.onboarded,
          !gated.inCards,
          gated.err ? "a projection could not be read: " + gated.err : "in connect_cards true",
        );
        record(
          "ruling 459 control: the same member is in connect_cards while onboarded_at is set",
          true,
          "in connect_cards true",
        );
      }

      const emptyMosaic = control.where === null || control.tiles === 0;
      if (emptyMosaic || control.where === gated.where) {
        skip(
          "ruling 459: connect_where excludes an account that has not onboarded",
          emptyMosaic
            ? "the mosaic names a country only once it holds five admitted members and no country on this project reaches that floor, so one member entering or leaving it changes nothing to measure"
            : "the member's country holds more than the floor with or without them, so the tile stands either way and the difference is not observable",
        );
      } else {
        record(
          "ruling 459: connect_where excludes an account that has not onboarded",
          true,
          "mosaic with " + control.where + "; without " + gated.where,
        );
      }

      if (!controlIntro.ok && /not available/.test(controlIntro.message || "")) {
        skip(
          "ruling 459: send_introduction refuses a recipient who has not onboarded",
          "the two test accounts are not strangers (a request is pending, they are connected, or one blocks the other), so the one write path refuses either way",
        );
      } else {
        record(
          "ruling 459: send_introduction refuses a recipient who has not onboarded",
          !gatedIntro.ok && /send_introduction: not available/.test(gatedIntro.message || ""),
          gatedIntro.ok ? "the write was accepted" : gatedIntro.code + " " + gatedIntro.message,
        );
        record(
          "ruling 459 control: the same introduction is accepted while onboarded_at is set",
          controlIntro.ok && !!controlIntro.rows[0] && !!controlIntro.rows[0].id,
          controlIntro.ok
            ? "request " + controlIntro.rows[0].id + ", rolled back"
            : controlIntro.code + " " + controlIntro.message,
        );
      }
    });

    // ------------------------------------------------------------------------------------------
    // H61-VT (1734, 1747). A block lowers what either party can see of the other, in every section,
    // through private.visible_to. The fixture is the two test accounts, each with an about row
    // written through save_profile_section (the one writer) and its audience set through the same
    // path; the shared anchor is one accepted event attestation between them, inserted as live_arms
    // under the r382 grant the 435 arm already uses (one accepted attestation on an event, with one
    // account on each side, is what private.shares_anchor reads). member-test blocks owner-test
    // through the owner insert policy, the app's own path (216). Owner-test is then the blocked
    // party and member-test the blocker; both directions are read at each audience, through the
    // member_about viewer policy, and every answer is printed. The anchored reads carry their own
    // control: the block is torn down (the owner delete policy) and the same read answers present,
    // or the absence under the block is reported unproven rather than passing for the wrong reason
    // (228, 270). Everything rolls back.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      const blocked = owner;
      const blocker = member;
      const readAbout = async (asId, ofId) => {
        await actAs(client, asId);
        const r = await attempt(
          client,
          "select count(*)::int as n from public.member_about where member_id = $1::uuid",
          [ofId],
        );
        return r.ok ? r.rows[0].n : null;
      };
      const both = async () => ({
        // The blocked party reads the blocker, and the blocker reads the blocked party.
        blocked: await readAbout(blocked.id, blocker.id),
        blocker: await readAbout(blocker.id, blocked.id),
      });
      const show = (x) => "blocked party reads " + x.blocked + ", blocker reads " + x.blocker;
      const setAudience = async (id, audience) => {
        await actAs(client, id);
        return attempt(client, "select public.save_profile_section('visibility', $1::jsonb)", [
          JSON.stringify({ section: "about", audience }),
        ]);
      };
      const problems = [];
      for (const who of [blocked, blocker]) {
        await actAs(client, who.id);
        const open = await attempt(
          client,
          "update public.members set profile_private = false where id = $1::uuid",
          [who.id],
        );
        const about = await attempt(
          client,
          "select public.save_profile_section('about', $1::jsonb)",
          [JSON.stringify({ about: "H61-VT fixture, rolled back by the same run." })],
        );
        const aud = await setAudience(who.id, "everyone");
        for (const [what, r] of [
          ["profile_private", open],
          ["about", about],
          ["audience", aud],
        ])
          if (!r.ok) problems.push(who.handle + " " + what + ": " + r.code + " " + r.message);
      }
      await actAsSelf(client);
      const anchor = await attempt(
        client,
        `insert into public.attestations (member_id, c_category, object_kind, object_id, attester_member_id, attester_role, accepted_at)
         values ($1::uuid, 'collaborate', 'event', gen_random_uuid(), $2::uuid, 'Host', now()) returning id`,
        [blocked.id, blocker.id],
      );
      if (!anchor.ok) problems.push("anchor: " + anchor.code + " " + anchor.message);
      if (problems.length) {
        unreachedIn("vt", "the fixture could not be built: " + problems.join("; "));
        skip(names.vt, "the fixture could not be built: " + problems.join("; "));
        return;
      }
      const before = await both();
      record(names.vt, before.blocked === 1 && before.blocker === 1, show(before));

      await actAs(client, blocker.id);
      const block = await attempt(
        client,
        "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
        [blocker.id, blocked.id],
      );
      if (!block.ok) {
        unreachedIn("vt", "the block could not be written: " + block.code + " " + block.message);
        return;
      }
      const everyone = await both();
      record(names.vtEveryone, everyone.blocked === 1, show(everyone));
      record(names.vtReverseEveryone, everyone.blocker === 1, show(everyone));

      await setAudience(blocked.id, "connections");
      await setAudience(blocker.id, "connections");
      const connections = await both();
      record(names.vtConnections, connections.blocked === 0, show(connections));
      record(names.vtReverseConnections, connections.blocker === 0, show(connections));

      await setAudience(blocked.id, "anchored");
      await setAudience(blocker.id, "anchored");
      const anchored = await both();

      // The control: the same anchored read with no block. The blocker removes their own row.
      await actAs(client, blocker.id);
      const unblock = await attempt(
        client,
        "delete from public.member_blocks where blocker_id = $1::uuid and blocked_id = $2::uuid",
        [blocker.id, blocked.id],
      );
      const control = await both();
      const controlOk = unblock.ok && control.blocked === 1 && control.blocker === 1;
      record(
        names.vtAnchoredControl,
        controlOk,
        (unblock.ok ? "" : "unblock " + unblock.code + "; ") + show(control),
      );
      if (!controlOk) {
        const why =
          "the shared anchor did not admit the anchored section without the block (" +
          show(control) +
          "), so the absence under the block proves nothing";
        skip(names.vtAnchored, why);
        skip(names.vtReverseAnchored, why);
      } else {
        record(names.vtAnchored, anchored.blocked === 0, show(anchored));
        record(names.vtReverseAnchored, anchored.blocker === 0, show(anchored));
      }
    });

    // ------------------------------------------------------------------------------------------
    // H62-A (1796 to 1826). The reaction layer's two writers and three projections, in one rolled
    // back transaction: the owner publishes a post (or the arm finds one of theirs); the member
    // reacts, changes, removes, reacts with a picker emoji, toggles an intent with a line; the
    // reader's answers are checked for their keys and never a figure; the author's list raises
    // for the member and carries exact figures for the owner; the intent's notification row is
    // read as the owner; then the member blocks the owner (the app's own path, 216) and the
    // owner turns the member Private, each with its control. Nothing here reads post_reactions
    // directly except the 1826 carry-over count, which runs as live_arms and reports unproven
    // where the grant refuses (228).
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regclass('public.post_intents') is not null and to_regproc('public.post_react') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        unreachedIn("h62a", "20261015120100_h62a_feed_reactions.sql is not on the project yet");
        skip(names.h62a, "20261015120100_h62a_feed_reactions.sql is not on the project yet");
        return;
      }
      const carry = await attempt(
        client,
        "select count(*)::int as n, count(*) filter (where kind = 'asante' and emoji is null)::int as asante from public.post_reactions where created_at < '2026-10-16'",
      );
      if (carry.ok)
        record(
          names.h62aCarry,
          carry.rows[0].n === carry.rows[0].asante,
          carry.rows[0].asante + " of " + carry.rows[0].n + " rows read asante",
        );
      else
        skip(
          names.h62aCarry,
          "live_arms cannot read post_reactions as itself: " + carry.code + " " + carry.message,
        );

      await actAs(client, owner.id);
      let post = await client.query(
        "select id from public.feed where author_kind = 'member' and author_id = $1 and status = 'published' limit 1",
        [owner.id],
      );
      let postId = post.rows[0] ? post.rows[0].id : null;
      if (!postId) {
        const pub = await attempt(client, "select public.publish_post($1::jsonb) as id", [
          JSON.stringify({
            body: "H62-A reactions arm. Rolled back by the same run.",
            author_kind: "member",
            author_id: owner.id,
            audience: "everyone",
            host_context: "live-checks",
          }),
        ]);
        postId = pub.ok ? pub.rows[0].id : null;
      }
      if (!postId) {
        unreachedIn("h62a", "no post by the owner could be read or published");
        skip(names.h62a, "no post by the owner could be read or published");
        return;
      }
      const react = async (kind, emoji, picked) =>
        attempt(client, "select public.post_react($1::uuid, $2, $3, $4) as r", [
          postId,
          kind,
          emoji ?? null,
          !!picked,
        ]);
      const summaryOf = async () => {
        const r = await attempt(client, "select public.post_reaction_rows(array[$1::uuid]) as s", [
          postId,
        ]);
        return r.ok ? r.rows[0].s[postId] || null : null;
      };
      const show = (x) => JSON.stringify(x);

      // 1. React, change, remove. The post may carry other members' reactions (the 36 carried
      //    rows among them) and the member may already hold one: the arm clears the member's own
      //    first and reads the member's `own` throughout, never the post's whole kind list.
      await actAs(client, member.id);
      const s0 = await summaryOf();
      if (s0 && s0.own) await react(s0.own.kind, s0.own.emoji);
      const a1 = await react("asante");
      const s1 = await summaryOf();
      const a2 = await react("celebrate");
      const s2 = await summaryOf();
      const a3 = await react("celebrate");
      const s3 = await summaryOf();
      record(
        names.h62a,
        a1.ok &&
          a1.rows[0].r &&
          a1.rows[0].r.kind === "asante" &&
          !!s1 &&
          s1.own &&
          s1.own.kind === "asante" &&
          s1.kinds.includes("asante") &&
          a2.ok &&
          a2.rows[0].r &&
          a2.rows[0].r.kind === "celebrate" &&
          !!s2 &&
          s2.own &&
          s2.own.kind === "celebrate" &&
          s2.kinds.includes("celebrate") &&
          a3.ok &&
          a3.rows[0].r === null &&
          !!s3 &&
          s3.own === null,
        "held before: " +
          show(s0 && s0.own) +
          " | " +
          [a1, a2, a3]
            .map((x) => (x.ok ? show(x.rows[0].r) : x.code + " " + x.message))
            .join(" | ") +
          " | own after: " +
          show(s3 && s3.own),
      );

      // 2. other with a picker emoji (the dataset's thumbs up carries U+FE0F; the toned form drops
      //    it), then five more distinct reactions: still one row, read through the summary.
      const o1 = await react("other", "\u{1F44D}\u{1F3FD}", true);
      const base = o1.ok && o1.rows[0].r ? o1.rows[0].r.emoji : null;
      for (const k of ["learned", "standing", "asante", "celebrate", "learned"]) await react(k);
      const s4 = await summaryOf();
      record(
        names.h62aOther,
        o1.ok &&
          !!base &&
          /^\u{1F44D}\uFE0F?$/u.test(base) &&
          !!s4 &&
          s4.own &&
          s4.own.kind === "learned" &&
          s4.kinds.includes("learned") &&
          s4.own.emoji === null,
        (o1.ok ? "stored " + show(base) : o1.code + " " + o1.message) +
          "; after six more: " +
          show(s4 && s4.own) +
          " kinds " +
          show(s4 && s4.kinds),
      );
      const bad = await react("other", "not an emoji");
      record(
        names.h62aOtherRefused,
        !bad.ok && bad.code === "22023",
        bad.ok ? "accepted" : bad.code + " " + bad.message,
      );

      // 3. Intent on with a line, read back by the author, then off.
      const i1 = await attempt(
        client,
        "select public.post_intent($1::uuid, 'help', true, $2) as r",
        [postId, "  I can introduce you to two people.  "],
      );
      await actAs(client, owner.id);
      const au1 = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      const intentRow = au1.ok
        ? (au1.rows[0].r.rows || []).find((x) => x.class === "intent" && x.kind === "help")
        : null;
      await actAs(client, member.id);
      const i2 = await attempt(client, "select public.post_intent($1::uuid, 'help', false) as r", [
        postId,
      ]);
      const s5 = await summaryOf();
      record(
        names.h62aIntent,
        i1.ok &&
          Array.isArray(i1.rows[0].r) &&
          i1.rows[0].r.includes("help") &&
          !!intentRow &&
          intentRow.line === "I can introduce you to two people." &&
          i2.ok &&
          Array.isArray(i2.rows[0].r) &&
          !i2.rows[0].r.includes("help") &&
          !!s5 &&
          Array.isArray(s5.intents) &&
          s5.intents.length === 0,
        (i1.ok ? "on " + show(i1.rows[0].r) : i1.code + " " + i1.message) +
          "; line " +
          show(intentRow && intentRow.line) +
          "; off " +
          (i2.ok ? show(i2.rows[0].r) : i2.code),
      );

      // 4. The reader's keys: the summary and the sheet, as the member, with the intent on again.
      await attempt(client, "select public.post_intent($1::uuid, 'build', true) as r", [postId]);
      const s6 = await summaryOf();
      const vis = await attempt(client, "select public.post_reactors_visible($1::uuid) as r", [
        postId,
      ]);
      const visRows = vis.ok && Array.isArray(vis.rows[0].r) ? vis.rows[0].r : [];
      const keysOk =
        !!s6 && Object.keys(s6).sort().join() === "intents,kinds,more,other,own,people";
      const rowKeys = visRows.length ? Object.keys(visRows[0]).sort().join() : "";
      record(
        names.h62aReaderKeys,
        keysOk &&
          vis.ok &&
          visRows.length >= 1 &&
          rowKeys === "avatar_path,emoji,handle,headline,id,kind,name,relationship,through,you" &&
          !visRows.some((x) => x.kind === "help" || x.kind === "build") &&
          !JSON.stringify(visRows).match(/"(line|class|figures|count|n)":/),
        "summary keys " + show(s6 && Object.keys(s6).sort()) + "; row keys " + rowKeys,
      );

      // 5. The author's list: refused for the member, exact for the owner.
      const auMember = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      record(
        names.h62aAuthorRefused,
        !auMember.ok && auMember.code === "42501",
        auMember.ok ? "answered" : auMember.code + " " + auMember.message,
      );
      await actAs(client, owner.id);
      const au2 = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      const fig = au2.ok ? au2.rows[0].r.figures : null;
      const memberRows = au2.ok ? (au2.rows[0].r.rows || []).filter((x) => x.id === member.id) : [];
      record(
        names.h62aAuthor,
        au2.ok &&
          !!fig &&
          fig.learned === 1 &&
          fig.build === 1 &&
          fig.help === 0 &&
          fig.all >= 2 &&
          memberRows.length === 2 &&
          memberRows.every((x) => x.name === member.name && x.handle === member.handle),
        au2.ok
          ? "figures " + show(fig) + "; member rows " + memberRows.length
          : au2.code + " " + au2.message,
      );

      // 6. The notification: one intent_build row under the post's C with the group key, folded on
      //    a second on after an off; the public reactions wrote none.
      const n1 = await client.query(
        "select kind, c_category, object_kind::text as object_kind, object_id, group_key, grouped_actor_ids from public.notifications where recipient_member_id = $1 and object_id = $2 and kind like 'intent_%' order by created_at",
        [owner.id, postId],
      );
      await actAs(client, member.id);
      await attempt(client, "select public.post_intent($1::uuid, 'build', false) as r", [postId]);
      await attempt(client, "select public.post_intent($1::uuid, 'build', true) as r", [postId]);
      await actAs(client, owner.id);
      const n2 = await client.query(
        "select kind from public.notifications where recipient_member_id = $1 and object_id = $2 and kind = 'intent_build'",
        [owner.id, postId],
      );
      const n3 = await client.query(
        "select count(*)::int as n from public.notifications where recipient_member_id = $1 and object_id = $2 and kind not like 'intent_%'",
        [owner.id, postId],
      );
      const postC = await client.query(
        "select c_category::text as c from public.feed where id = $1",
        [postId],
      );
      const buildRow = n1.rows.find((r) => r.kind === "intent_build");
      record(
        names.h62aNotify,
        !!buildRow &&
          buildRow.object_kind === "post" &&
          buildRow.object_id === postId &&
          buildRow.group_key === "post:" + postId &&
          buildRow.c_category === (postC.rows[0] && postC.rows[0].c) &&
          n2.rows.length === 1 &&
          n3.rows[0].n === 0,
        "intent rows " +
          show(n1.rows.map((r) => [r.kind, r.group_key])) +
          "; build rows after off and on " +
          n2.rows.length +
          "; non-intent rows " +
          n3.rows[0].n,
      );

      // 7. The block: the member blocks the owner (the owner insert policy), then the owner's list
      //    carries no row for the member and the member reads no post; unblocked, both return.
      await actAs(client, member.id);
      const block = await attempt(
        client,
        "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
        [member.id, owner.id],
      );
      const visBlocked = await attempt(
        client,
        "select public.post_reactors_visible($1::uuid) as r",
        [postId],
      );
      await actAs(client, owner.id);
      const auBlocked = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      const blockedRows = auBlocked.ok
        ? (auBlocked.rows[0].r.rows || []).filter(
            (x) => x.id === member.id || x.name === member.name,
          )
        : [];
      await actAs(client, member.id);
      const unblock = await attempt(
        client,
        "delete from public.member_blocks where blocker_id = $1::uuid and blocked_id = $2::uuid",
        [member.id, owner.id],
      );
      await actAs(client, owner.id);
      const auAfter = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      const afterRows = auAfter.ok
        ? (auAfter.rows[0].r.rows || []).filter((x) => x.id === member.id)
        : [];
      record(
        names.h62aBlocked,
        block.ok &&
          !visBlocked.ok &&
          visBlocked.code === "42501" &&
          auBlocked.ok &&
          blockedRows.length === 0 &&
          unblock.ok &&
          afterRows.length >= 1,
        (block.ok ? "" : "block " + block.code + "; ") +
          "member reads " +
          (visBlocked.ok ? "rows" : visBlocked.code) +
          "; author's rows naming the member under the block " +
          blockedRows.length +
          ", after " +
          afterRows.length,
      );

      // 8. Private: the member turns Private; unless the two accounts are connected (where
      //    visible_to admits a private member), the author's list carries the row with no name.
      await actAs(client, member.id);
      const priv = await attempt(
        client,
        "update public.members set profile_private = true where id = $1",
        [member.id],
      );
      await actAs(client, owner.id);
      const auPriv = await attempt(client, "select public.post_reactors_author($1::uuid) as r", [
        postId,
      ]);
      const privRows = auPriv.ok ? auPriv.rows[0].r.rows || [] : [];
      const namedStill = privRows.some((x) => x.id === member.id);
      const roleRows = privRows.filter(
        (x) => x.id === null && x.name === null && x.handle === null && x.avatar_path === null,
      );
      const connected = await attempt(
        client,
        "select exists (select 1 from public.member_connections c where c.member_id = $1 and c.other_id = $2) as ok",
        [owner.id, member.id],
      );
      if (namedStill && connected.ok && connected.rows[0].ok === true)
        skip(
          names.h62aPrivate,
          "owner-test and member-test are connected, so visible_to admits the private member by design",
        );
      else
        record(
          names.h62aPrivate,
          priv.ok && auPriv.ok && !namedStill && roleRows.length >= 1,
          (priv.ok ? "" : "private " + priv.code + "; ") +
            "named " +
            namedStill +
            "; role rows " +
            roleRows.length,
        );
    });

    // ------------------------------------------------------------------------------------------
    // H62-G (1677, 1796, 1817, 1820, 1849, 141, 186). The comment layer's writers and projections in
    // one rolled back transaction: the member comments on the owner's post, the owner comments on
    // their own and replies to the member; the thread is read as both; a reply to a reply and a
    // comment across a block are refused; the member reacts to and sends an intent on the owner's
    // comment; the notification rows are read as each recipient. Every row in one transaction
    // shares one created_at, so order is read as the function orders, (created_at, id).
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regclass('public.comments') is not null and to_regproc('public.comment_post') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        unreachedIn("h62g", "20261016120100_h62g_feed_comments.sql is not on the project yet");
        skip(names.h62g, "20261016120100_h62g_feed_comments.sql is not on the project yet");
        return;
      }
      await actAs(client, owner.id);
      let post = await client.query(
        "select id from public.feed where author_kind = 'member' and author_id = $1 and status = 'published' and audience = 'everyone' limit 1",
        [owner.id],
      );
      let postId = post.rows[0] ? post.rows[0].id : null;
      if (!postId) {
        const pub = await attempt(client, "select public.publish_post($1::jsonb) as id", [
          JSON.stringify({
            body: "H62-G comments arm. Rolled back by the same run.",
            author_kind: "member",
            author_id: owner.id,
            audience: "everyone",
            host_context: "live-checks",
          }),
        ]);
        postId = pub.ok ? pub.rows[0].id : null;
      }
      if (!postId) {
        unreachedIn("h62g", "no post by the owner could be read or published");
        skip(names.h62g, "no post by the owner could be read or published");
        return;
      }
      const show = (x) => JSON.stringify(x);
      const comment = (parent, body) =>
        attempt(client, "select public.comment_post($1::uuid, $2::uuid, $3) as c", [
          postId,
          parent,
          body,
        ]);
      const thread = async () => {
        const r = await attempt(client, "select public.post_comments($1::uuid) as t", [postId]);
        return r.ok ? r.rows[0].t : null;
      };
      const summaryOf = async (cid) => {
        const r = await attempt(
          client,
          "select public.comment_reaction_rows(array[$1::uuid]) as s",
          [cid],
        );
        return r.ok ? r.rows[0].s[cid] || null : null;
      };

      // 1. The member comments; the owner comments on their own post and replies to the member.
      await actAs(client, member.id);
      const c1 = await comment(null, "  First, from the member.  ");
      const c1Id = c1.ok ? c1.rows[0].c.id : null;
      await actAs(client, owner.id);
      const c2 = await comment(null, "The author's own word.");
      const c2Id = c2.ok ? c2.rows[0].c.id : null;
      const r1 = c1Id ? await comment(c1Id, "A reply from the author.") : { ok: false };
      await actAs(client, member.id);
      const t1 = await thread();
      const tops = t1 ? t1.comments : [];
      const findTop = (id) => tops.find((x) => x.id === id);
      const ordered =
        tops.length >= 2 &&
        tops.every(
          (x, i) =>
            i === 0 ||
            tops[i - 1].created_at < x.created_at ||
            (tops[i - 1].created_at === x.created_at && tops[i - 1].id < x.id),
        );
      record(
        names.h62g,
        c1.ok &&
          c1.rows[0].c.body === "First, from the member." &&
          c1.rows[0].c.author &&
          c1.rows[0].c.author.handle === member.handle &&
          c1.rows[0].c.you === true &&
          c2.ok &&
          !!findTop(c1Id) &&
          !!findTop(c2Id) &&
          findTop(c2Id).is_post_author === true &&
          findTop(c1Id).is_post_author === false &&
          findTop(c1Id).author &&
          findTop(c1Id).author.name === member.name &&
          ordered &&
          !t1.more &&
          !("count" in (t1 || {})),
        (c1.ok ? "c1 " + show(c1.rows[0].c.author) : "c1 " + c1.code + " " + c1.message) +
          "; tops " +
          show(
            tops.map((x) => [x.id === c1Id ? "c1" : x.id === c2Id ? "c2" : x.id, x.is_post_author]),
          ) +
          "; ordered " +
          ordered,
      );

      // 2. The reply under its parent; a reply to the reply refused.
      const r1Id = r1.ok ? r1.rows[0].c.id : null;
      const under = findTop(c1Id) ? findTop(c1Id).replies || [] : [];
      const nested = r1Id ? await comment(r1Id, "nested") : { ok: true };
      record(
        names.h62gReply,
        r1.ok &&
          r1.rows[0].c.parent_id === c1Id &&
          under.length === 1 &&
          under[0].id === r1Id &&
          under[0].is_post_author === true &&
          !nested.ok &&
          nested.code === "22023" &&
          /reply_to_reply/.test(nested.message || ""),
        (r1.ok ? "reply under c1: " + under.length : "reply " + r1.code + " " + r1.message) +
          "; nested " +
          (nested.ok ? "accepted" : nested.code + " " + nested.message),
      );

      // 3. React, remove, intent and the commenter's sheet, on the owner's comment.
      const a1 = await attempt(client, "select public.comment_react($1::uuid, 'asante') as r", [
        c2Id,
      ]);
      const s1 = await summaryOf(c2Id);
      const a2 = await attempt(client, "select public.comment_react($1::uuid, 'asante') as r", [
        c2Id,
      ]);
      const s2 = await summaryOf(c2Id);
      const i1 = await attempt(
        client,
        "select public.comment_intent($1::uuid, 'help', true, $2) as r",
        [c2Id, "  I can introduce you.  "],
      );
      const auMember = await attempt(
        client,
        "select public.comment_reactors_author($1::uuid) as r",
        [c2Id],
      );
      await actAs(client, owner.id);
      const auOwner = await attempt(
        client,
        "select public.comment_reactors_author($1::uuid) as r",
        [c2Id],
      );
      const intentRow = auOwner.ok
        ? (auOwner.rows[0].r.rows || []).find((x) => x.class === "intent" && x.kind === "help")
        : null;
      record(
        names.h62gReact,
        a1.ok &&
          a1.rows[0].r &&
          a1.rows[0].r.kind === "asante" &&
          !!s1 &&
          s1.own &&
          s1.own.kind === "asante" &&
          s1.kinds.includes("asante") &&
          a2.ok &&
          a2.rows[0].r === null &&
          !!s2 &&
          s2.own === null &&
          i1.ok &&
          Array.isArray(i1.rows[0].r) &&
          i1.rows[0].r.includes("help") &&
          !auMember.ok &&
          auMember.code === "42501" &&
          auOwner.ok &&
          !!intentRow &&
          intentRow.line === "I can introduce you." &&
          intentRow.id === member.id,
        [a1, a2, i1].map((x) => (x.ok ? show(x.rows[0].r) : x.code + " " + x.message)).join(" | ") +
          "; own after remove " +
          show(s2 && s2.own) +
          "; member's author read " +
          (auMember.ok ? "answered" : auMember.code) +
          "; line " +
          show(intentRow && intentRow.line),
      );

      // 4. The notification rows, as each recipient.
      const ownerRows = await client.query(
        "select kind, object_kind::text as object_kind, object_id, group_key, actor_id, c_category::text as c from public.notifications where recipient_member_id = $1 and (object_id = $2 or object_id = $3) order by created_at",
        [owner.id, postId, c2Id],
      );
      await actAs(client, member.id);
      const memberRows = await client.query(
        "select kind, object_kind::text as object_kind, object_id, group_key, actor_id from public.notifications where recipient_member_id = $1 and object_id = $2 order by created_at",
        [member.id, c1Id],
      );
      const postC = await client.query(
        "select c_category::text as c from public.feed where id = $1",
        [postId],
      );
      const commentRow = ownerRows.rows.find((r) => r.kind === "comment_on_post");
      const intentRows = ownerRows.rows.filter((r) => r.kind === "intent_help");
      const replyRow = memberRows.rows.find((r) => r.kind === "reply_to_comment");
      record(
        names.h62gNotify,
        !!commentRow &&
          commentRow.object_kind === "post" &&
          commentRow.object_id === postId &&
          commentRow.group_key === "post:" + postId &&
          commentRow.actor_id === member.id &&
          commentRow.c === (postC.rows[0] && postC.rows[0].c) &&
          ownerRows.rows.filter((r) => r.kind === "comment_on_post").length === 1 &&
          intentRows.length === 1 &&
          intentRows[0].object_kind === "comment" &&
          intentRows[0].object_id === c2Id &&
          intentRows[0].group_key === "comment:" + c2Id &&
          ownerRows.rows.every((r) => ["comment_on_post", "intent_help"].includes(r.kind)) &&
          !!replyRow &&
          replyRow.object_kind === "comment" &&
          replyRow.object_id === c1Id &&
          replyRow.group_key === "comment:" + c1Id &&
          replyRow.actor_id === owner.id &&
          memberRows.rows.length === 1,
        "owner rows " +
          show(ownerRows.rows.map((r) => [r.kind, r.object_kind])) +
          "; member rows " +
          show(memberRows.rows.map((r) => [r.kind, r.object_kind])),
      );

      // 5. The block: the member blocks the owner (216's path). The member may not see the post,
      //    so a comment is refused and the thread is no post to them; the owner reads no comment by
      //    the member and no name of theirs. Unblocked, both return.
      const block = await attempt(
        client,
        "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
        [member.id, owner.id],
      );
      const refused = await comment(null, "across the block");
      const tBlockedMember = await attempt(client, "select public.post_comments($1::uuid) as t", [
        postId,
      ]);
      await actAs(client, owner.id);
      const tBlockedOwner = await thread();
      const blockedTops = tBlockedOwner ? tBlockedOwner.comments : null;
      const namesSeen = (t) =>
        JSON.stringify(t || {}).includes('"' + member.name + '"') ||
        JSON.stringify(t || {}).includes('"' + member.handle + '"');
      const latestBlocked = await attempt(
        client,
        "select public.post_latest_comments(array[$1::uuid]) as l",
        [postId],
      );
      await actAs(client, member.id);
      const unblock = await attempt(
        client,
        "delete from public.member_blocks where blocker_id = $1::uuid and blocked_id = $2::uuid",
        [member.id, owner.id],
      );
      const again = await comment(null, "after the block");
      await actAs(client, owner.id);
      const tAfter = await thread();
      record(
        names.h62gBlocked,
        block.ok &&
          !tBlockedMember.ok &&
          tBlockedMember.code === "42501" &&
          !!blockedTops &&
          !blockedTops.some((x) => x.id === c1Id) &&
          !namesSeen(tBlockedOwner) &&
          latestBlocked.ok &&
          !namesSeen(latestBlocked.rows[0].l) &&
          unblock.ok &&
          !!tAfter &&
          tAfter.comments.some((x) => x.id === c1Id),
        (block.ok ? "" : "block " + block.code + "; ") +
          "member reads thread " +
          (tBlockedMember.ok ? "rows" : tBlockedMember.code) +
          "; owner sees c1 under the block " +
          (blockedTops ? blockedTops.some((x) => x.id === c1Id) : "no thread") +
          "; member named " +
          namesSeen(tBlockedOwner) +
          "; after unblock c1 back " +
          (tAfter ? tAfter.comments.some((x) => x.id === c1Id) : "no thread"),
      );
      record(
        names.h62gRefused,
        !refused.ok && refused.code === "42501" && again.ok && !!again.rows[0].c.id,
        "under the block " +
          (refused.ok ? "accepted" : refused.code + " " + refused.message) +
          "; after " +
          (again.ok ? "accepted" : again.code + " " + again.message),
      );
    });

    // ------------------------------------------------------------------------------------------
    // Convene Pass 1 (P1-SPEC section 6, row policy; rulings 521, 623). The owner publishes a
    // hybrid event through publish_post with the namespaced convene.* keys: a resolved place, a
    // meeting link and a capacity. The member (a reader of the event through its published post)
    // selects the delivery rows and the host settings: the physical row is theirs to read, the
    // meeting_link row and the capacity are not. The owner, as host, reads all three: that pair is
    // ruling 270's control. Everything rolls back. Before the Pass 1 migrations reach the project
    // the tables do not exist and the arm reports unproven (228), never a pass.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      // Presence by name, not by privilege: information_schema.tables lists only the tables the
      // current role holds a privilege on, and live_arms holds none on these (the grants are to
      // authenticated and service_role), so it read zero on a project that had them. The reads
      // below run as authenticated through set role, where the grants and the policies apply.
      const present = await client.query(
        "select (to_regclass('public.event_delivery') is not null and to_regclass('public.event_host_settings') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        skip(
          names.delivery,
          "20260916120100_p1_convene_place_columns.sql is not on the project yet",
        );
        return;
      }
      await actAs(client, owner.id);
      const starts = new Date(Date.now() + 14 * 86400e3);
      starts.setUTCHours(19, 0, 0, 0);
      const payload = JSON.stringify({
        verb: "convene",
        body: "Convene Pass 1 row-policy arm. Rolled back by the same run.",
        author_kind: "member",
        author_id: owner.id,
        audience: "everyone",
        host_context: "live-checks",
        fields: {
          "convene.title": "Row policy supper",
          "convene.format": "hybrid",
          "convene.when": "in two weeks at 19:00",
          "convene.starts_at": starts.toISOString(),
          "convene.timezone": "Africa/Accra",
          "convene.place_id": "live-arms-place",
          "convene.place_name": "Front Room",
          "convene.city": "Accra",
          "convene.country": "Ghana",
          "convene.lng": "-0.1747",
          "convene.lat": "5.5559",
          "convene.link": "https://meet.example/row-policy",
          "convene.price_nature": "free",
          "convene.capacity": "40",
          "convene.delivery_intent":
            "In person at Front Room, Accra and Online, link with your ticket.",
        },
      });
      const published = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        payload,
      ]);
      if (!published.ok) {
        record(
          names.delivery,
          false,
          "publish_post refused: " + published.code + " " + published.message,
        );
        return;
      }
      // The host reads their own post for the event id (posts_member_select). live_arms holds no
      // grant on posts, so this read stays as the owner rather than resetting the role; and every
      // read from here goes through attempt(), so a refusal records a FAIL with its code instead of
      // escaping the arm and ending the suite.
      const ev = await attempt(
        client,
        "select created_object_id as id from public.posts where id = $1",
        [published.rows[0].id],
      );
      const eventId = ev.ok && ev.rows[0] ? ev.rows[0].id : null;
      if (!eventId) {
        record(
          names.delivery,
          false,
          "the published post carries no event id: " +
            (ev.ok ? "no row" : ev.code + " " + ev.message),
        );
        return;
      }
      const readAs = async (uid) => {
        await actAs(client, uid);
        const e = await attempt(client, "select id from public.events where id = $1", [eventId]);
        const d = await attempt(
          client,
          "select kind from public.event_delivery where event_id = $1 order by position",
          [eventId],
        );
        const h = await attempt(
          client,
          "select capacity from public.event_host_settings where event_id = $1",
          [eventId],
        );
        const refused = [e, d, h].find((r) => !r.ok);
        return {
          error: refused ? refused.code + " " + refused.message : null,
          event: e.ok ? e.rows.length : -1,
          kinds: d.ok ? d.rows.map((r) => r.kind) : [],
          settings: h.ok ? h.rows.length : -1,
        };
      };
      const asMember = await readAs(member.id);
      const asOwner = await readAs(owner.id);
      if (asMember.error || asOwner.error) {
        record(names.delivery, false, "a read was refused: " + (asMember.error || asOwner.error));
        return;
      }
      record(
        names.delivery,
        asMember.event === 1 &&
          asMember.kinds.length === 1 &&
          asMember.kinds[0] === "physical" &&
          asMember.settings === 0,
        "member sees event " +
          asMember.event +
          ", rows " +
          JSON.stringify(asMember.kinds) +
          ", settings " +
          asMember.settings,
      );
      record(
        "Convene Pass 1 control: the host reads the physical row, the meeting link and the capacity",
        asOwner.event === 1 &&
          asOwner.kinds.length === 2 &&
          asOwner.kinds.includes("physical") &&
          asOwner.kinds.includes("meeting_link") &&
          asOwner.settings === 1,
        "owner sees event " +
          asOwner.event +
          ", rows " +
          JSON.stringify(asOwner.kinds) +
          ", settings " +
          asOwner.settings,
      );
    });
    // ------------------------------------------------------------------------------------------
    // Brief 10 (handoff 30-C; rulings 680, 1023, 1028, 1029, 1030). The owner publishes a free
    // in-person event to everyone; the member's convene default is cleared inside this transaction
    // so the first case is reachable whatever the account holds, then the member answers going
    // twice: the first answer sets the default and stores no override (1030), the second stores an
    // override alone. The member's own projection carries the answer. Signed out, the public
    // projection answers for the slug with no registrant, no going list, no viewer block and no
    // meeting link (680, 1028), the member projection is refused (1023), and no client role may
    // call the media lookup (1029). Everything rolls back.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regprocedure('public.event_page(uuid)') is not null and to_regprocedure('public.event_public_page(text)') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("attend"))
          skip(n, "20260921160100_p2_event_page.sql is not on the project yet");
        return;
      }
      await actAs(client, owner.id);
      const starts = new Date(Date.now() + 21 * 86400e3);
      starts.setUTCHours(19, 0, 0, 0);
      const published = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        JSON.stringify({
          verb: "convene",
          body: "Brief 10 attend arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          fields: {
            "convene.title": "Attend arm supper",
            "convene.format": "in_person",
            "convene.when": "in three weeks at 19:00",
            "convene.starts_at": starts.toISOString(),
            "convene.timezone": "Africa/Accra",
            "convene.place_id": "live-arms-place",
            "convene.place_name": "Front Room",
            "convene.city": "Accra",
            "convene.country": "Ghana",
            "convene.lng": "-0.1747",
            "convene.lat": "5.5559",
            "convene.price_nature": "free",
            "convene.delivery_intent": "In the room, at a long table.",
          },
        }),
      ]);
      if (!published.ok) {
        record(
          names.attend,
          false,
          "publish_post refused: " + published.code + " " + published.message,
        );
        unreachedIn("attend", "no event was published to read, so this arm did not run");
        return;
      }
      const ev = await attempt(
        client,
        "select e.id, e.slug from public.posts p join public.events e on e.id = p.created_object_id where p.id = $1",
        [published.rows[0].id],
      );
      const eventId = ev.ok && ev.rows[0] ? ev.rows[0].id : null;
      const slug = ev.ok && ev.rows[0] ? ev.rows[0].slug : null;
      if (!eventId || !slug) {
        record(
          names.attend,
          false,
          "the published post carries no event with a slug: " +
            (ev.ok ? "no row" : ev.code + " " + ev.message),
        );
        unreachedIn(
          "attend",
          "the published post carries no event with a slug, so this arm did not run",
        );
        return;
      }
      await actAs(client, member.id);
      await attempt(
        client,
        "delete from public.member_visibility where member_id = $1 and section = 'convene'",
        [member.id],
      );
      const first = await attempt(
        client,
        "select public.rsvp_event($1::uuid, 'going', 'everyone') as r",
        [eventId],
      );
      const second = await attempt(
        client,
        "select public.rsvp_event($1::uuid, 'going', 'anchored') as r",
        [eventId],
      );
      const mine = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      const r1 = first.ok ? first.rows[0].r : null;
      const r2 = second.ok ? second.rows[0].r : null;
      const page = mine.ok ? mine.rows[0].p : null;
      record(
        names.attend,
        !!r1 &&
          r1.default_set === true &&
          r1.audience_override === null &&
          !!r2 &&
          r2.default_set === false &&
          r2.audience_override === "anchored" &&
          !!page &&
          page.viewer &&
          page.viewer.registration &&
          page.viewer.registration.status === "going" &&
          page.viewer.registration.audience_override === "anchored" &&
          page.viewer.has_default === true &&
          page.viewer.default_audience === "everyone",
        "first " +
          (first.ok ? JSON.stringify(r1) : first.code + " " + first.message) +
          " second " +
          (second.ok ? JSON.stringify(r2) : second.code + " " + second.message) +
          " page " +
          (mine.ok ? JSON.stringify(page && page.viewer) : mine.code + " " + mine.message),
      );
      // Addendum 4 item 1 (1121): the presenter line for a list of events is the pane's own. The
      // member reads it for the event they just answered, beside event_page's own two values.
      const presenters = await attempt(
        client,
        "select public.event_presenters(array[$1::uuid]) as p",
        [eventId],
      );
      const line = presenters.ok && presenters.rows[0].p ? presenters.rows[0].p[eventId] : null;
      record(
        names.attendPresenters,
        !!page &&
          !!line &&
          !!line.presented_by &&
          // 20260929120000 adds the presenter's headline and links to event_page's presented_by (1225);
          // event_presenters is the card's name line and carries neither, so the two are compared
          // on what both serve.
          JSON.stringify(line.presented_by) ===
            JSON.stringify(
              Object.fromEntries(
                Object.entries(page.presented_by).filter(
                  ([k]) => k !== "headline" && k !== "links",
                ),
              ),
            ) &&
          JSON.stringify(line.host) === JSON.stringify(page.host),
        presenters.ok
          ? JSON.stringify({
              line,
              page: page && { presented_by: page.presented_by, host: page.host },
            })
          : presenters.code + " " + presenters.message,
      );
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', '', true)");
      const pub = await attempt(client, "select public.event_public_page($1) as p", [slug]);
      const pp = pub.ok ? pub.rows[0].p : null;
      const text = pp ? JSON.stringify(pp) : "";
      record(
        names.attendPublic,
        !!pp &&
          pp.event &&
          pp.event.slug === slug &&
          !("going" in pp) &&
          !("viewer" in pp) &&
          !("meeting_url" in pp) &&
          !("invitations" in pp) &&
          !text.includes(member.name) &&
          !text.includes(member.id),
        pub.ok ? "keys " + Object.keys(pp || {}).join(",") : pub.code + " " + pub.message,
      );
      const refused = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      record(
        names.attendMemberRefused,
        !refused.ok && refused.code === "42501",
        refused.ok ? "answered" : refused.code + " " + refused.message,
      );
      const anonPresenters = await attempt(
        client,
        "select public.event_presenters(array[$1::uuid]) as p",
        [eventId],
      );
      record(
        names.attendPresentersAnon,
        !anonPresenters.ok && anonPresenters.code === "42501",
        anonPresenters.ok ? "answered" : anonPresenters.code + " " + anonPresenters.message,
      );
      await actAs(client, member.id);
      const media = await attempt(
        client,
        "select * from public.event_media_object($1, 'media', '0')",
        [slug],
      );
      record(
        names.attendMedia,
        !media.ok && media.code === "42501",
        media.ok ? "answered " + media.rows.length + " row(s)" : media.code + " " + media.message,
      );
    });
    // ------------------------------------------------------------------------------------------
    // Handoff 37-A (rulings 1186, 1189; 20260928120000). The owner publishes a free public event and
    // becomes its host. The member's save is refused as not the host (42501); signed out can neither
    // execute the write nor read the table (42501); the host's save of one note block comes back
    // as the block with its kind's label, event_page carries it for the host and event_public_page
    // carries it for the slug; a save whose programme block has no line is refused with 22023 and
    // the note block is still there when read back, never counted in advance; and an empty list
    // clears the page through the same function, so the arm leaves no row before the rollback.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regprocedure('public.save_event_blocks(uuid, jsonb)') is not null and to_regclass('public.event_blocks') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("blocks"))
          skip(n, "20260928120000_p2_event_blocks.sql is not on the project yet");
        return;
      }
      await actAs(client, owner.id);
      const starts = new Date(Date.now() + 28 * 86400e3);
      starts.setUTCHours(18, 30, 0, 0);
      const published = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        JSON.stringify({
          verb: "convene",
          body: "Handoff 37-A blocks arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          fields: {
            "convene.title": "Blocks arm reading",
            "convene.format": "in_person",
            "convene.when": "in four weeks at 18:30",
            "convene.starts_at": starts.toISOString(),
            "convene.timezone": "Africa/Accra",
            "convene.place_id": "live-arms-place",
            "convene.place_name": "Front Room",
            "convene.city": "Accra",
            "convene.country": "Ghana",
            "convene.lng": "-0.1747",
            "convene.lat": "5.5559",
            "convene.price_nature": "free",
            "convene.delivery_intent": "In the room, with the programme on the page.",
          },
        }),
      ]);
      const ev = published.ok
        ? await attempt(
            client,
            "select e.id, e.slug from public.posts p join public.events e on e.id = p.created_object_id where p.id = $1",
            [published.rows[0].id],
          )
        : null;
      const eventId = ev && ev.ok && ev.rows[0] ? ev.rows[0].id : null;
      const slug = ev && ev.ok && ev.rows[0] ? ev.rows[0].slug : null;
      if (!eventId || !slug) {
        const why = !published.ok
          ? "publish_post refused: " + published.code + " " + published.message
          : "the published post carries no event with a slug";
        for (const n of armsOf("blocks")) skip(n, why + ", so this arm did not run");
        return;
      }
      const NOTE = "Doors open at six. The reading starts when the room is full.";
      const one = JSON.stringify([{ kind: "note", payload: { text: NOTE } }]);

      // (a) The member, who is not the host, is refused before any row is touched.
      await actAs(client, member.id);
      const notHost = await attempt(
        client,
        "select public.save_event_blocks($1::uuid, $2::jsonb) as b",
        [eventId, one],
      );
      record(
        names.blocksNotHost,
        !notHost.ok && notHost.code === "42501",
        notHost.ok ? "the save was accepted" : notHost.code + " " + notHost.message,
      );

      // (b) Signed out holds no execute on the write and no select on the table.
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', '', true)");
      const anonSave = await attempt(
        client,
        "select public.save_event_blocks($1::uuid, $2::jsonb) as b",
        [eventId, one],
      );
      const anonRead = await attempt(
        client,
        "select b.id from public.event_blocks b where b.event_id = $1",
        [eventId],
      );
      record(
        names.blocksSignedOut,
        !anonSave.ok && anonSave.code === "42501" && !anonRead.ok && anonRead.code === "42501",
        "save " +
          (anonSave.ok ? "accepted" : anonSave.code) +
          " read " +
          (anonRead.ok ? "answered " + anonRead.rows.length + " row(s)" : anonRead.code),
      );

      // (c) The host's save returns the block with its kind's label, and both reads carry it.
      await actAs(client, owner.id);
      const saved = await attempt(
        client,
        "select public.save_event_blocks($1::uuid, $2::jsonb) as b",
        [eventId, one],
      );
      const mine = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      const page = mine.ok ? mine.rows[0].p : null;
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', '', true)");
      const pub = await attempt(client, "select public.event_public_page($1) as p", [slug]);
      const pp = pub.ok ? pub.rows[0].p : null;
      const isNote = (list) =>
        Array.isArray(list) &&
        list.length === 1 &&
        list[0].kind === "note" &&
        list[0].label === "Good to know" &&
        !!list[0].payload &&
        list[0].payload.text === NOTE;
      record(
        names.blocksSave,
        saved.ok &&
          isNote(saved.rows[0].b) &&
          !!page &&
          page.viewer &&
          page.viewer.is_host === true &&
          isNote(page.blocks) &&
          !!pp &&
          isNote(pp.blocks),
        "save " +
          (saved.ok ? JSON.stringify(saved.rows[0].b) : saved.code + " " + saved.message) +
          " page " +
          (mine.ok ? JSON.stringify(page && page.blocks) : mine.code + " " + mine.message) +
          " public " +
          (pub.ok ? JSON.stringify(pp && pp.blocks) : pub.code + " " + pub.message),
      );

      // (d) A programme block without its line is refused as a whole, the note is still there when
      // read back, and an empty list clears the page through the same function.
      await actAs(client, owner.id);
      const refused = await attempt(
        client,
        "select public.save_event_blocks($1::uuid, $2::jsonb) as b",
        [
          eventId,
          JSON.stringify([
            { kind: "note", payload: { text: NOTE } },
            { kind: "programme", payload: { at: "18:30" } },
          ]),
        ],
      );
      const after = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      const kept = after.ok && after.rows[0].p ? after.rows[0].p.blocks : null;
      const cleared = await attempt(
        client,
        "select public.save_event_blocks($1::uuid, '[]'::jsonb) as b",
        [eventId],
      );
      const none = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      const left = none.ok && none.rows[0].p ? none.rows[0].p.blocks : null;
      record(
        names.blocksRefused,
        !refused.ok &&
          refused.code === "22023" &&
          isNote(kept) &&
          cleared.ok &&
          Array.isArray(cleared.rows[0].b) &&
          cleared.rows[0].b.length === 0 &&
          Array.isArray(left) &&
          left.length === 0,
        "refusal " +
          (refused.ok ? "accepted" : refused.code + " " + refused.message) +
          " kept " +
          (after.ok ? JSON.stringify(kept) : after.code + " " + after.message) +
          " cleared " +
          (cleared.ok ? JSON.stringify(cleared.rows[0].b) : cleared.code + " " + cleared.message) +
          " left " +
          (none.ok ? JSON.stringify(left) : none.code + " " + none.message),
      );
    });
    // ------------------------------------------------------------------------------------------
    // Handoff 37-C (20260929120000; rulings 1196, 1225). The two reads carry the presenter's line and
    // links, event_page carries the event's family and whether the viewer subscribes to it, and the
    // public read carries no family. Read on the project's own stand-in events (every event carries a
    // family) rather than a published one, so the arm writes only the owner's subscription, which
    // rolls back with the transaction.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('private.event_presenter_profile(jsonb, boolean)') is not null as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("presenter"))
          skip(n, "20260929120000_p2_event_presenter_topic.sql is not on the project yet");
        return;
      }
      await actAs(client, owner.id);
      const cand = await client.query(
        "select e.id, e.slug, e.family, e.host_member_id from public.events e where e.family is not null and e.status = 'published' order by e.created_at, e.id limit 25",
      );
      let target = null;
      for (const row of cand.rows) {
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const probe = await attempt(client, "select public.event_public_page($1) as p", [row.slug]);
        await actAs(client, owner.id);
        if (probe.ok && probe.rows[0].p) {
          target = { ...row, pub: probe.rows[0].p };
          break;
        }
      }
      if (!target) {
        for (const n of armsOf("presenter"))
          skip(
            n,
            "no published event with a family and a public page on the project, so this arm did not run",
          );
        return;
      }
      const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
      const shaped = (pb) => pb === null || (has(pb, "headline") && Array.isArray(pb.links));

      await actAs(client, target.host_member_id);
      const asHost = await attempt(client, "select public.event_page($1::uuid) as p", [target.id]);
      const hp = asHost.ok ? asHost.rows[0].p : null;
      record(
        names.presenterKeys,
        !!hp &&
          hp.event.family === target.family &&
          typeof hp.viewer.subscribed === "boolean" &&
          shaped(hp.presented_by),
        asHost.ok
          ? "family " +
              hp.event.family +
              " subscribed " +
              hp.viewer.subscribed +
              " presented_by " +
              JSON.stringify(hp.presented_by)
          : asHost.code + " " + asHost.message,
      );

      const pp = target.pub;
      record(
        names.presenterPublic,
        shaped(pp.presented_by) && !has(pp.event, "family") && !has(pp, "viewer"),
        "presented_by " +
          JSON.stringify(pp.presented_by) +
          " event keys " +
          Object.keys(pp.event).join(","),
      );

      await actAs(client, owner.id);
      const off = await attempt(client, "select public.set_subscription($1, false)", [
        target.family,
      ]);
      const before = await attempt(client, "select public.event_page($1::uuid) as p", [target.id]);
      const on = await attempt(client, "select public.set_subscription($1, true)", [target.family]);
      const after = await attempt(client, "select public.event_page($1::uuid) as p", [target.id]);
      record(
        names.presenterSubscribe,
        off.ok &&
          on.ok &&
          before.ok &&
          after.ok &&
          before.rows[0].p.viewer.subscribed === false &&
          after.rows[0].p.viewer.subscribed === true,
        "before " +
          (before.ok ? before.rows[0].p.viewer.subscribed : before.code) +
          " after " +
          (after.ok ? after.rows[0].p.viewer.subscribed : after.code),
      );
    });
    // ------------------------------------------------------------------------------------------
    // Handoff 30-D (rulings 1002, 1026, 1033, 1034; item 14.1). The owner publishes a free public
    // event; then, as the arm's own role, the two service-role functions are driven the way the
    // guest-rsvp Edge Function drives them: a link request is normalized and answered send once
    // and throttled on the second ask, a bad address and a slug with no public page are refused in
    // the database's own words, and the table that records the ask has no column for the address
    // at all, only a 64-hex hash. guest_rsvp's open writes going once with the offer made once,
    // reports the row after, withdraws and goes again, and the drift function counts no guest row
    // (a guest row carries no edge). Then the member, whose address auth.users holds confirmed,
    // has a guest row written for that address, claims it with its edge, and a second claim does
    // nothing. Everything rolls back. The functions are executable by service_role alone (1026),
    // so the arm reports itself unproven, never passing, when the arm's role holds no execute on
    // them (ruling 228): the grant is a migration of Chat's under 382.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regprocedure('public.guest_link_request(text,text)') is not null and to_regprocedure('public.guest_rsvp(uuid,text,text)') is not null and to_regprocedure('public.claim_guest_registrations()') is not null) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        skip(names.guest, "20260922120000_p2_guest_path.sql is not on the project yet");
        skip(names.claim, "20260922120000_p2_guest_path.sql is not on the project yet");
        return;
      }
      const may = await client.query(
        "select has_function_privilege(current_user, 'public.guest_link_request(text,text)', 'execute') as link, has_function_privilege(current_user, 'public.guest_rsvp(uuid,text,text)', 'execute') as rsvp, current_user as who",
      );
      if (!may.rows[0] || !may.rows[0].link || !may.rows[0].rsvp) {
        const why =
          (may.rows[0] ? may.rows[0].who : "the arm's role") +
          " holds no execute on guest_link_request and guest_rsvp, which are service_role's alone (1026); the arm runs once a migration grants them to live_arms (382)";
        skip(names.guest, why);
        skip(names.claim, why);
        return;
      }
      await actAs(client, owner.id);
      const starts = new Date(Date.now() + 28 * 86400e3);
      starts.setUTCHours(18, 30, 0, 0);
      const published = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        JSON.stringify({
          verb: "convene",
          body: "Handoff 30-D guest arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          fields: {
            "convene.title": "Guest arm supper",
            "convene.format": "in_person",
            "convene.when": "in four weeks at 18:30",
            "convene.starts_at": starts.toISOString(),
            "convene.timezone": "Africa/Accra",
            "convene.place_id": "live-arms-place",
            "convene.place_name": "Front Room",
            "convene.city": "Accra",
            "convene.country": "Ghana",
            "convene.lng": "-0.1747",
            "convene.lat": "5.5559",
            "convene.price_nature": "free",
            "convene.delivery_intent": "In the room, at a long table.",
          },
        }),
      ]);
      if (!published.ok) {
        record(
          names.guest,
          false,
          "publish_post refused: " + published.code + " " + published.message,
        );
        skip(names.claim, "no event to claim against");
        return;
      }
      const ev = await attempt(
        client,
        "select e.id, e.slug from public.posts p join public.events e on e.id = p.created_object_id where p.id = $1",
        [published.rows[0].id],
      );
      const eventId = ev.ok && ev.rows[0] ? ev.rows[0].id : null;
      const slug = ev.ok && ev.rows[0] ? ev.rows[0].slug : null;
      if (!eventId || !slug) {
        record(names.guest, false, "the published post carries no event with a slug");
        skip(names.claim, "no event to claim against");
        return;
      }

      // The link request, as the function calls it (the arm's own role, not a client role).
      await actAsSelf(client);
      const typed = "  Guest.Arm@Example.Invalid ";
      const normalized = "guest.arm@example.invalid";
      const first = await attempt(client, "select public.guest_link_request($1, $2) as r", [
        slug,
        typed,
      ]);
      const second = await attempt(client, "select public.guest_link_request($1, $2) as r", [
        slug,
        normalized,
      ]);
      const badAddress = await attempt(client, "select public.guest_link_request($1, $2) as r", [
        slug,
        "not-an-address",
      ]);
      const noPage = await attempt(client, "select public.guest_link_request($1, $2) as r", [
        "this-slug-has-no-public-page-000000",
        normalized,
      ]);
      // pg_attribute rather than information_schema.columns: the view shows a column only to a
      // role with some privilege on its table, and live_arms holds none on guest_link_requests by
      // design (no client role reads or writes it), so the view answered nothing on a8fc5b0.
      const columns = await client.query(
        "select array_agg(a.attname::text order by a.attname) as cols from pg_catalog.pg_attribute a where a.attrelid = 'public.guest_link_requests'::regclass and a.attnum > 0 and not a.attisdropped",
      );
      const constraint = await client.query(
        "select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'guest_link_requests_hash_check'",
      );
      const cols = (columns.rows[0] && columns.rows[0].cols) || [];
      const r1 = first.ok ? first.rows[0].r : null;
      const r2 = second.ok ? second.rows[0].r : null;
      const linkOk =
        !!r1 &&
        r1.send === true &&
        r1.email === normalized &&
        !!r1.facts &&
        r1.facts.slug === slug &&
        !("meeting_url" in r1.facts && r1.facts.meeting_url) &&
        !!r2 &&
        r2.send === false &&
        !badAddress.ok &&
        badAddress.code === "22023" &&
        !noPage.ok &&
        noPage.code === "22023" &&
        cols.join(",") === "email_hash,event_id,id,requested_at" &&
        !!constraint.rows[0] &&
        /\[0-9a-f\]\{64\}/.test(constraint.rows[0].def);

      // The guest's answers: open once, reported after, withdraw, go again; no edge on a guest row.
      const open1 = await attempt(client, "select public.guest_rsvp($1::uuid, $2, 'open') as r", [
        eventId,
        normalized,
      ]);
      const open2 = await attempt(client, "select public.guest_rsvp($1::uuid, $2, 'open') as r", [
        eventId,
        normalized,
      ]);
      const withdraw = await attempt(
        client,
        "select public.guest_rsvp($1::uuid, $2, 'not_going') as r",
        [eventId, normalized],
      );
      const again = await attempt(client, "select public.guest_rsvp($1::uuid, $2, 'going') as r", [
        eventId,
        normalized,
      ]);
      const drift1 = await attempt(client, "select * from private.rsvp_edge_drift()", []);
      const o1 = open1.ok ? open1.rows[0].r : null;
      const o2 = open2.ok ? open2.rows[0].r : null;
      const w = withdraw.ok ? withdraw.rows[0].r : null;
      const a = again.ok ? again.rows[0].r : null;
      const rsvpOk =
        !!o1 &&
        o1.state === "returned" &&
        o1.status === "going" &&
        o1.offer_conversion === true &&
        !!o2 &&
        o2.state === "existing" &&
        o2.status === "going" &&
        o2.offer_conversion === false &&
        !!w &&
        w.state === "answered" &&
        w.status === "not_going" &&
        !!a &&
        a.state === "answered" &&
        a.status === "going" &&
        a.offer_conversion === false &&
        drift1.ok &&
        drift1.rows.length === 0;
      record(
        names.guest,
        linkOk && rsvpOk,
        "link first " +
          (first.ok
            ? JSON.stringify({ send: r1.send, email: r1.email })
            : first.code + " " + first.message) +
          " second " +
          (second.ok ? JSON.stringify(r2.send) : second.code + " " + second.message) +
          " bad " +
          (badAddress.ok ? "answered" : badAddress.code) +
          " noPage " +
          (noPage.ok ? "answered" : noPage.code) +
          " cols " +
          cols.join(",") +
          " | open " +
          (open1.ok
            ? JSON.stringify([o1.state, o1.status, o1.offer_conversion])
            : open1.code + " " + open1.message) +
          " again " +
          (open2.ok ? JSON.stringify([o2.state, o2.offer_conversion]) : open2.code) +
          " withdraw " +
          (withdraw.ok ? w.status : withdraw.code) +
          " going " +
          (again.ok ? JSON.stringify([a.status, a.offer_conversion]) : again.code) +
          " drift " +
          (drift1.ok ? drift1.rows.length : drift1.code + " " + drift1.message),
      );

      // The claim: the member test account's address. MEMBER_EMAIL is what the ruling 218
      // sign-in arm in tests/live-checks.cjs signs that account in with, so it is the address
      // auth.users holds and the one the claim reads; auth.users itself is not readable by the
      // arm's role (42501 on a8fc5b0), and is tried only when the variable is absent. The claim
      // function checks the confirmation itself: a zero claim against a seeded row is the failure.
      let memberEmail = (process.env.MEMBER_EMAIL || "").trim().toLowerCase() || null;
      let whoNote = "MEMBER_EMAIL";
      if (!memberEmail) {
        const who = await attempt(
          client,
          "select lower(btrim(u.email)) as email from auth.users u where u.id = $1 and u.email_confirmed_at is not null",
          [member.id],
        );
        memberEmail = who.ok && who.rows[0] ? who.rows[0].email : null;
        whoNote = who.ok ? "auth.users" : "auth.users refused " + who.code;
      }
      if (!memberEmail) {
        skip(
          names.claim,
          "no address for the member test account: MEMBER_EMAIL is not set and " +
            whoNote +
            ", so no guest row can be written for the member's own address",
        );
        return;
      }

      const seeded = await attempt(client, "select public.guest_rsvp($1::uuid, $2, 'going') as r", [
        eventId,
        memberEmail,
      ]);
      await actAs(client, member.id);
      const claim1 = await attempt(client, "select public.claim_guest_registrations() as r", []);
      const mine = await attempt(client, "select public.event_page($1::uuid) as p", [eventId]);
      const claim2 = await attempt(client, "select public.claim_guest_registrations() as r", []);
      await actAsSelf(client);
      const drift2 = await attempt(client, "select * from private.rsvp_edge_drift()", []);
      const c1 = claim1.ok ? claim1.rows[0].r : null;
      const c2 = claim2.ok ? claim2.rows[0].r : null;
      const pg = mine.ok ? mine.rows[0].p : null;
      record(
        names.claim,
        seeded.ok &&
          !!c1 &&
          c1.claimed === 1 &&
          !!pg &&
          pg.viewer &&
          pg.viewer.registration &&
          pg.viewer.registration.status === "going" &&
          !!c2 &&
          c2.claimed === 0 &&
          c2.kept === 0 &&
          drift2.ok &&
          drift2.rows.length === 0,
        "address from " +
          whoNote +
          " seed " +
          (seeded.ok ? "ok" : seeded.code + " " + seeded.message) +
          " claim " +
          (claim1.ok ? JSON.stringify(c1) : claim1.code + " " + claim1.message) +
          " page " +
          (mine.ok ? JSON.stringify(pg && pg.viewer && pg.viewer.registration) : mine.code) +
          " again " +
          (claim2.ok ? JSON.stringify(c2) : claim2.code) +
          " drift " +
          (drift2.ok ? drift2.rows.length : drift2.code + " " + drift2.message),
      );
    });
    // ------------------------------------------------------------------------------------------
    // Brief 9 (handoff 31-A; rulings 581, 631, 632, 650, 658, 693, 1037 to 1045), as handoff 32-B
    // and its Addenda leave it (1092 to 1095, 1105, 1110, 1111). Chat's behaviour proof, replayed as
    // the owner on the project's stand-in data (every event carries a family, the owner is an editor
    // with one live pick, the owner's homes are Los Angeles then Accra). The owner subscribes to
    // culture_arts, dismisses the picked event from curated and writes a rail row inside this
    // transaction; all of it rolls back. The refusals are read at the grant (42501) and at the
    // projection's own checks (22023), and signed out is refused the projection outright (662).
    // Handoff 34-A adds the search, Filling up with the going names on Chat's seed (1165), and the
    // learned order's one writer, note_lane_act, each also rolled back; its addendum withdraws Browse
    // (1172) and lifts the floors under a search (1173).
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      // 20260927120000 drops the nine-argument projection and creates it again with p_without, so the
      // probe names the ten-argument signature and that version's recorded row. Before it:
      // 20260926170300 drops the eight-argument projection and creates it again with p_q, so the
      // probe named the nine-argument signature; 20260926170400 keeps that signature and takes the
      // browse row out of convene_lanes, so the probe reads that version's recorded row, as the drift
      // arm reads it (444, 553: a paste records its version in the transaction that runs its DDL).
      // The probe runs as live_arms, which holds select on supabase_migrations.schema_migrations
      // (20260912090557) and none on convene_lanes: run 384's probe read the table itself, threw
      // 42501 and took the whole live step down before its count (G143 names what a failed probe
      // costs).
      const present = await client.query(
        "select to_regprocedure('public.convene_discovery(text, text[], text[], text, text[], uuid, text[], text, text, text)') is not null and exists (select 1 from supabase_migrations.schema_migrations where version = '20260927120000') as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("discovery"))
          skip(
            n,
            "20260927120000 is not on the project yet (Chat applies 35-A's two migrations before its enforcing run)",
          );
        return;
      }
      const ask = async (sql, values) => {
        const r = await attempt(client, sql, values);
        return r.ok ? { ok: true, d: r.rows[0] && r.rows[0].d } : r;
      };
      const failed = (r) => r.code + " " + r.message;
      const section = (d, id) => ((d && d.sections) || []).find((s) => s.section === id) || null;
      const sectionIds = (d) => ((d && d.sections) || []).map((s) => s.section);

      // As the owner: live_arms holds no EXECUTE on vocabularies() (ruling 382), authenticated does.
      await actAs(client, owner.id);
      const vocab = await ask("select public.vocabularies() as d");
      const families =
        vocab.ok && Array.isArray(vocab.d.convene_families) ? vocab.d.convene_families : [];
      const lenses =
        vocab.ok && Array.isArray(vocab.d.convene_lenses) ? vocab.d.convene_lenses : [];
      const lanes = vocab.ok && Array.isArray(vocab.d.convene_lanes) ? vocab.d.convene_lanes : [];
      const laneIds = lanes.map((l) => l.value);

      // 1160: the order is the member's own, so the answer is read against its own lane_order,
      // which names every lane, and never against the table's base order.
      const all = await ask("select public.convene_discovery('all') as d");
      const ids = all.ok ? sectionIds(all.d) : [];
      const laneOrder = all.ok && all.d && Array.isArray(all.d.lane_order) ? all.d.lane_order : [];
      const wholeOrder =
        laneOrder.length === laneIds.length && laneIds.every((id) => laneOrder.includes(id));
      const inOrder = ids.every(
        (id, i) =>
          laneOrder.includes(id) &&
          (i === 0 || laneOrder.indexOf(ids[i - 1]) < laneOrder.indexOf(id)),
      );
      record(
        names.discovery,
        all.ok && ids.length > 0 && wholeOrder && inOrder && ids.includes("curated"),
        all.ok
          ? "sections " + JSON.stringify(ids) + " lane_order " + JSON.stringify(laneOrder)
          : failed(all),
      );

      const curatedItem =
        all.ok && section(all.d, "curated") ? section(all.d, "curated").items[0] : null;
      const pick = curatedItem && curatedItem.reason;
      record(
        names.discoveryPick,
        !!pick &&
          pick.kind === "curated" &&
          !!pick.editor &&
          pick.editor.id === owner.id &&
          pick.editor.name === owner.name &&
          typeof pick.line === "string" &&
          pick.line.trim() !== "",
        pick ? JSON.stringify(pick) : "no curated item in the owner's answer",
      );

      // 1124, 1159: the search narrows the corpus before the lanes form. The pick's own title keeps
      // the pick in Curated; a search that matches nothing drops every lane; 100 characters are
      // taken and 101 refused with 22023. Read before the dismissal below empties Curated inside
      // this transaction.
      const Q =
        "select public.convene_discovery('all', null, null, null, null, null, null, null, $1) as d";
      const titled = curatedItem
        ? await attempt(client, "select title from public.events where id = $1::uuid", [
            curatedItem.event_id,
          ])
        : null;
      const pickTitle = titled && titled.ok && titled.rows[0] ? titled.rows[0].title : null;
      const found = pickTitle ? await ask(Q, [pickTitle]) : null;
      const foundCurated = found && found.ok ? section(found.d, "curated") : null;
      const kept =
        !!foundCurated && foundCurated.items.some((i) => i.event_id === curatedItem.event_id);
      const nothing = await ask(Q, ["zq live arm matches no event 7c1"]);
      const hundred = await attempt(client, Q, ["x".repeat(100)]);
      const tooLong = await attempt(client, Q, ["x".repeat(101)]);
      record(
        names.discoverySearch,
        kept &&
          nothing.ok &&
          sectionIds(nothing.d).length === 0 &&
          hundred.ok &&
          !tooLong.ok &&
          tooLong.code === "22023",
        (pickTitle
          ? "found " + (found.ok ? JSON.stringify(sectionIds(found.d)) : failed(found))
          : "no pick title to search for") +
          " kept " +
          kept +
          " nothing " +
          (nothing.ok ? JSON.stringify(sectionIds(nothing.d)) : failed(nothing)) +
          " 100 " +
          (hundred.ok ? "answered" : failed(hundred)) +
          " 101 " +
          (tooLong.ok ? "answered" : tooLong.code),
      );

      // S54-1: the two arms below read against the seed by id, so the seed is read first and recorded
      // on its own. A missing seed reports both arms unproven (228), never failed: what is absent is
      // the fixture, not the behaviour they prove.
      const seedRead = await attempt(
        client,
        "select id::text as id from public.events where id = any($1::uuid[]) and status = 'published' and starts_at > now() and cancelled_at is null",
        [SEEDED_FILLING],
      );
      const seedFound = seedRead.ok ? seedRead.rows.map((r) => r.id) : [];
      const seedMissing = SEEDED_FILLING.filter((id) => !seedFound.includes(id));
      const seedOk = seedRead.ok && seedMissing.length === 0;
      const seedWhy = seedRead.ok
        ? "seed missing: " + seedMissing.join(", ")
        : "seed read refused: " + failed(seedRead);
      record(names.discoverySeed, seedOk, seedOk ? "both present" : seedWhy);

      // 1173: under a search the floors do not apply. One seeded event's title (1165) names that event,
      // and Filling up, whose floor is two, comes back holding it: a search whose matches sit one to
      // a lane returns the lane. Read as the owner, before the dismissal below.
      const seededTitle = await attempt(
        client,
        "select title from public.events where id = $1::uuid",
        [SEEDED_FILLING[0]],
      );
      const title = seededTitle.ok && seededTitle.rows[0] ? seededTitle.rows[0].title : null;
      const one = title ? await ask(Q, [title]) : null;
      const oneFilling = one && one.ok ? section(one.d, "filling") : null;
      const oneIds = one && one.ok ? sectionIds(one.d) : [];
      if (!seedOk) skip(names.discoverySearchOne, seedWhy);
      else
        record(
          names.discoverySearchOne,
          !!one &&
            one.ok &&
            oneIds.length >= 1 &&
            !!oneFilling &&
            oneFilling.items.some((i) => i.event_id === SEEDED_FILLING[0]),
          (title ? "title found" : "no title for the seeded event") +
            " lanes " +
            (one ? (one.ok ? JSON.stringify(oneIds) : failed(one)) : "not read") +
            " filling " +
            (oneFilling ? oneFilling.items.length + " item(s)" : "absent"),
        );

      // 1172: the Browse lane is withdrawn. No section is browse, no section carries tiles, and
      // lane_order is the ten lanes.
      const tiled = all.ok ? ((all.d && all.d.sections) || []).filter((x) => "tiles" in x) : [];
      record(
        names.discoveryBrowse,
        all.ok && !section(all.d, "browse") && tiled.length === 0 && laneOrder.length === 10,
        all.ok
          ? "browse " +
              (section(all.d, "browse") ? "present" : "absent") +
              " tiled " +
              tiled.length +
              " lane_order " +
              laneOrder.length
          : failed(all),
      );

      // 1157, 1165: Chat seeded five going RSVPs on each of two events. Filling up carries both, as
      // the owner's row policy counts them, and event_going_names gives each three first names, never
      // the viewer's own (1128, 1138, 1158). The seed is canonical data, read and never written here.
      const filling = all.ok ? section(all.d, "filling") : null;
      const fillingIds = filling ? filling.items.map((i) => i.event_id) : [];
      const going = await ask("select public.event_going_names($1::uuid[]) as d", [SEEDED_FILLING]);
      const ownFirst = String(owner.name || "")
        .trim()
        .split(" ")[0];
      const named = going.ok && going.d ? SEEDED_FILLING.map((id) => going.d[id]) : [];
      if (!seedOk) skip(names.discoveryFilling, seedWhy);
      else
        record(
          names.discoveryFilling,
          !!filling &&
            SEEDED_FILLING.every((id) => fillingIds.includes(id)) &&
            going.ok &&
            named.length === SEEDED_FILLING.length &&
            named.every(
              (n) =>
                Array.isArray(n) &&
                n.length === 3 &&
                n.every((x) => typeof x === "string" && x !== "" && x !== ownFirst),
            ),
          "filling " +
            JSON.stringify(fillingIds) +
            " names " +
            (going.ok ? JSON.stringify(named) : failed(going)),
        );

      const noCount = [];
      const walk = (v, at) => {
        if (Array.isArray(v)) v.forEach((x, i) => walk(x, at + "[" + i + "]"));
        else if (v && typeof v === "object")
          for (const [k, x] of Object.entries(v)) {
            if (/(^|_)(count|counts|total|n)$/i.test(k)) noCount.push(at + "." + k);
            walk(x, at + "." + k);
          }
      };
      if (all.ok) walk(all.d, "answer");
      record(
        names.discoveryNoCount,
        all.ok && noCount.length === 0,
        all.ok ? (noCount.length ? "keys " + noCount.join(",") : "none") : failed(all),
      );

      const sub = await attempt(client, "select public.set_subscription('culture_arts', true)");
      const taste = sub.ok ? await ask("select public.convene_discovery('taste') as d") : sub;
      const tasteItems =
        taste.ok && section(taste.d, "taste") ? section(taste.d, "taste").items : [];
      record(
        names.discoveryTaste,
        taste.ok &&
          tasteItems.length > 0 &&
          tasteItems.every((i) => i.reason && i.reason.family === "culture_arts"),
        taste.ok
          ? "families " + JSON.stringify([...new Set(tasteItems.map((i) => i.reason.family))])
          : failed(taste),
      );

      if (curatedItem) {
        const eventId = curatedItem.event_id;
        // The owner may hold committed dismissals of this event in other lanes from the app, so
        // the arm reads what this dismissal added, not what the owner holds.
        const sectionsOf = async () => {
          const r = await attempt(
            client,
            "select section from public.discovery_dismissals where event_id = $1::uuid",
            [eventId],
          );
          return r.ok ? r.rows.map((x) => x.section) : null;
        };
        const before = await sectionsOf();
        const dismissed = await attempt(
          client,
          "select public.dismiss_discovery_item($1::uuid, 'curated')",
          [eventId],
        );
        const curated = dismissed.ok
          ? await ask("select public.convene_discovery('curated') as d")
          : dismissed;
        const after = await sectionsOf();
        const curatedSection = curated.ok ? section(curated.d, "curated") : null;
        const added = before && after ? after.filter((x) => !before.includes(x)) : null;
        record(
          names.discoveryDismiss,
          !!curatedSection &&
            curatedSection.items.length === 0 &&
            !!added &&
            added.length === 1 &&
            added[0] === "curated",
          (curated.ok ? "curated " + JSON.stringify(curated.d.sections) : failed(curated)) +
            " added " +
            JSON.stringify(added),
        );
      } else record(names.discoveryDismiss, false, "no curated item to dismiss");

      const inPerson = await ask("select public.convene_discovery('all', array['in_person']) as d");
      const inPersonIds = inPerson.ok ? sectionIds(inPerson.d) : [];
      record(
        names.discoveryFormat,
        inPerson.ok && !inPersonIds.includes("online"),
        inPerson.ok ? "sections " + JSON.stringify(inPersonIds) : failed(inPerson),
      );

      const insert = await attempt(
        client,
        "insert into public.member_subscriptions (member_id, kind, family) values ($1, 'family', 'sport_wellness')",
        [owner.id],
      );
      record(
        names.discoverySubInsert,
        !insert.ok && insert.code === "42501",
        insert.ok ? "inserted" : failed(insert),
      );
      const floors = await attempt(client, "select * from private.convene_thresholds");
      record(
        names.discoveryThresholds,
        !floors.ok && floors.code === "42501",
        floors.ok ? "read " + floors.rows.length + " row(s)" : failed(floors),
      );
      // 1177: public.editors is folded into platform_roles, which has no client grant either.
      const roles = await attempt(client, "select * from public.platform_roles");
      record(
        names.discoveryRoles,
        !roles.ok && roles.code === "42501",
        roles.ok ? "read " + roles.rows.length + " row(s)" : failed(roles),
      );

      // 1093: the lens set is five, so events and the three retired lenses are all refused.
      const refusedLenses = [];
      for (const l of ["events", "soon", "online", "near"]) {
        const r = await attempt(client, "select public.convene_discovery($1)", [l]);
        if (r.ok || r.code !== "22023")
          refusedLenses.push(l + " " + (r.ok ? "answered" : failed(r)));
      }
      record(
        names.discoveryRetired,
        refusedLenses.length === 0,
        refusedLenses.join("; ") || "all four refused",
      );
      const badSection = await attempt(
        client,
        "select public.dismiss_discovery_item($1::uuid, 'all')",
        [curatedItem ? curatedItem.event_id : "00000000-0000-0000-0000-000000000000"],
      );
      record(
        names.discoveryDismissAll,
        !badSection.ok && badSection.code === "22023",
        badSection.ok ? "accepted" : failed(badSection),
      );
      // 1095: Donation is gone; the projection refuses it as any unknown price.
      const donation = await attempt(
        client,
        "select public.convene_discovery('all', null, array['donation'])",
      );
      record(
        names.discoveryDonation,
        !donation.ok && donation.code === "22023",
        donation.ok ? "answered" : failed(donation),
      );
      // 1174 (handoff 35-A): p_without leaves a lens's events out of a read of All before the floors
      // apply. The follow lens's ids are read as the owner, then All without them, and none may
      // appear in any lane; the arm reads nothing if the follow lens holds no event, since an empty
      // lens leaves nothing to leave out (UNPROVEN, never a pass).
      const followLens = await ask("select public.convene_discovery('follow') as d");
      const followIds = new Set(
        followLens.ok ? (section(followLens.d, "follow")?.items.map((i) => i.event_id) ?? []) : [],
      );
      const without = await ask(
        "select public.convene_discovery('all', p_without => 'follow') as d",
      );
      const leaked = without.ok
        ? ((without.d && without.d.sections) || []).flatMap((s) =>
            s.items
              .filter((i) => followIds.has(i.event_id))
              .map((i) => s.section + ":" + i.event_id),
          )
        : [];
      if (followLens.ok && followIds.size === 0)
        skip(names.discoveryWithout, "the owner's follow lens holds no event to leave out");
      else
        record(
          names.discoveryWithout,
          followLens.ok && without.ok && leaked.length === 0,
          !followLens.ok
            ? failed(followLens)
            : without.ok
              ? followIds.size +
                " follow event(s) left out, sections " +
                JSON.stringify(sectionIds(without.d)) +
                " leaked " +
                JSON.stringify(leaked)
              : failed(without),
        );
      const withoutLens = await attempt(
        client,
        "select public.convene_discovery('follow', p_without => 'curated')",
      );
      record(
        names.discoveryWithoutLens,
        !withoutLens.ok && withoutLens.code === "22023",
        withoutLens.ok ? "answered" : failed(withoutLens),
      );
      const withoutAll = await attempt(
        client,
        "select public.convene_discovery('all', p_without => 'all')",
      );
      record(
        names.discoveryWithoutAll,
        !withoutAll.ok && withoutAll.code === "22023",
        withoutAll.ok ? "answered" : failed(withoutAll),
      );
      // 1095: Place's options are grounded places, and the projection takes one and refuses a
      // malformed id. The project's own upcoming events carry no city (run 349 read one option,
      // `country|ghana`), so the owner publishes in-person events in Accra under a savepoint, as
      // Convene Pass 1 does, and the arm rolls back to that savepoint after its reads, so every
      // later check reads the project as it is. Two events, because 20260924100000 sets Near's floor
      // to 2: with one, the city's narrowing answered no lanes and Near was never read (G117).
      await client.query("savepoint places_fixture");
      const placeEvent = async (title, days, hour, when) => {
        const starts = new Date(Date.now() + days * 86400e3);
        starts.setUTCHours(hour, 0, 0, 0);
        return attempt(client, "select public.publish_post($1::jsonb) as id", [
          JSON.stringify({
            verb: "convene",
            body: "Place arm (1095). Rolled back by the same run.",
            author_kind: "member",
            author_id: owner.id,
            audience: "everyone",
            host_context: "live-checks",
            fields: {
              "convene.title": title,
              "convene.format": "in_person",
              "convene.when": when,
              "convene.starts_at": starts.toISOString(),
              "convene.timezone": "Africa/Accra",
              "convene.place_id": "live-arms-place",
              "convene.place_name": "Front Room",
              "convene.city": "Accra",
              "convene.region": "Greater Accra",
              "convene.country": "Ghana",
              "convene.lng": "-0.1747",
              "convene.lat": "5.5559",
              "convene.price_nature": "free",
              "convene.delivery_intent": "In person at Front Room, Accra.",
            },
          }),
        ]);
      };
      const fixtures = [
        await placeEvent("Place arm supper", 10, 18, "in ten days at 18:00"),
        await placeEvent("Place arm breakfast", 11, 8, "in eleven days at 08:00"),
      ];
      const refused = fixtures.find((f) => !f.ok);
      const places = await ask("select public.convene_places() as d");
      const opts = places.ok && Array.isArray(places.d) ? places.d : [];
      const wellFormed = opts.every((o) => {
        const parts = String(o.id).split("|");
        return (
          ["city", "region", "country"].includes(o.kind) &&
          parts[0] === o.kind &&
          parts.length === (o.kind === "country" ? 2 : 3) &&
          o.id === o.id.toLowerCase() &&
          typeof o.name === "string" &&
          o.name !== ""
        );
      });
      // The fixture's own city, not whichever city sorts first, so the lane read is the one the
      // fixture filled.
      const city = opts.find((o) => o.id === "city|ghana|accra");
      const narrowed = city
        ? await ask(
            "select public.convene_discovery('all', null, null, null, null, null, array[$1]) as d",
            [city.id],
          )
        : null;
      // Near must be there to be read: a lane under its floor is absent, and an absent lane proves
      // nothing about its reasons (228).
      const near = narrowed && narrowed.ok ? section(narrowed.d, "near") : null;
      const nearPlace =
        !!near &&
        near.items.length > 0 &&
        near.items.every(
          (i) =>
            i.reason &&
            i.reason.place &&
            String(i.reason.place.city || "").toLowerCase() === "accra",
        );
      const malformed = await attempt(
        client,
        "select public.convene_discovery('all', null, null, null, null, null, array['town|x'])",
      );
      await client.query("rollback to savepoint places_fixture");
      record(
        names.discoveryPlaces,
        !refused &&
          places.ok &&
          opts.length > 0 &&
          wellFormed &&
          !!narrowed &&
          narrowed.ok &&
          nearPlace &&
          !malformed.ok &&
          malformed.code === "22023",
        (refused ? "publish_post refused: " + failed(refused) + "; " : "") +
          (places.ok
            ? opts.length + " option(s), city " + JSON.stringify(city || null)
            : failed(places)) +
          " narrowed " +
          (narrowed
            ? narrowed.ok
              ? JSON.stringify(sectionIds(narrowed.d))
              : failed(narrowed)
            : "no city") +
          " near " +
          (near ? near.items.length + " item(s)" : "absent") +
          " malformed " +
          (malformed.ok ? "answered" : malformed.code),
      );
      // 1110: every rung of the owner's first home answers; a rung with no home, or an unknown rung,
      // is refused.
      const ownerHome = all.ok && all.d.homes && all.d.homes[0] ? all.d.homes[0].id : null;
      const rungNotes = [];
      if (ownerHome)
        for (const rung of ["in", "around", "region", "country"]) {
          const r = await attempt(
            client,
            "select public.convene_discovery('all', null, null, null, null, $1::uuid, null, $2)",
            [ownerHome, rung],
          );
          if (!r.ok) rungNotes.push(rung + " " + failed(r));
        }
      const lonely = await attempt(
        client,
        "select public.convene_discovery('all', null, null, null, null, null, null, 'around')",
      );
      const far = ownerHome
        ? await attempt(
            client,
            "select public.convene_discovery('all', null, null, null, null, $1::uuid, null, 'far')",
            [ownerHome],
          )
        : { ok: true };
      record(
        names.discoveryRungs,
        !!ownerHome &&
          rungNotes.length === 0 &&
          !lonely.ok &&
          lonely.code === "22023" &&
          !far.ok &&
          far.code === "22023",
        (ownerHome ? rungNotes.join("; ") || "four rungs answered" : "the owner has no home") +
          " lonely " +
          (lonely.ok ? "answered" : lonely.code) +
          " far " +
          (far.ok ? "answered" : far.code),
      );
      if (ownerHome) {
        await actAs(client, member.id);
        const foreign = await attempt(
          client,
          "select public.convene_discovery('all', null, null, null, null, $1::uuid)",
          [ownerHome],
        );
        record(
          names.discoveryForeignHome,
          !foreign.ok && foreign.code === "22023",
          foreign.ok ? "answered" : failed(foreign),
        );
      } else {
        record(
          names.discoveryForeignHome,
          false,
          "the owner's answer carries no home to offer another member",
        );
      }

      // 1111: the rail's memory is the member's own row; another member neither reads nor writes it.
      await actAs(client, owner.id);
      const own = await attempt(
        client,
        // Idempotent against a row the owner committed from the app, through the owner's insert and
        // update policies both.
        "insert into public.member_rail_state (member_id, surface, width_band, collapsed) values ($1, 'discovery', 'wide', false) on conflict (member_id, surface, width_band) do update set collapsed = excluded.collapsed, updated_at = now()",
        [owner.id],
      );
      await actAs(client, member.id);
      const peek = await attempt(
        client,
        "select collapsed from public.member_rail_state where member_id = $1::uuid",
        [owner.id],
      );
      const forge = await attempt(
        client,
        "insert into public.member_rail_state (member_id, surface, width_band, collapsed) values ($1, 'discovery', 'medium', true)",
        [owner.id],
      );
      record(
        names.discoveryRail,
        own.ok && peek.ok && peek.rows.length === 0 && !forge.ok && forge.code === "42501",
        "own " +
          (own.ok ? "written" : failed(own)) +
          " peek " +
          (peek.ok ? peek.rows.length + " row(s)" : failed(peek)) +
          " forge " +
          (forge.ok ? "written" : failed(forge)),
      );

      // 1160: note_lane_act is the one writer of the learned order. It refuses a lane or an act it
      // does not know with 22023; a noted act puts its lane first in the member's lane_order, and the
      // owner reads their own row. A member's direct insert is refused at the grant (42501), and
      // another member reads none of the owner's rows. The owner's committed rows, from the app, are
      // left as they are: the noted act is an upsert and rolls back with the transaction.
      await actAs(client, owner.id);
      const badLane = await attempt(client, "select public.note_lane_act('nope', 'open')");
      const badAct = await attempt(client, "select public.note_lane_act('soon', 'look')");
      const noted = await attempt(client, "select public.note_lane_act('network', 'open')");
      const reordered = noted.ok ? await ask("select public.convene_discovery('all') as d") : noted;
      const firstLane =
        reordered.ok && reordered.d && Array.isArray(reordered.d.lane_order)
          ? reordered.d.lane_order[0]
          : null;
      const ownActs = await attempt(
        client,
        "select lane, act from public.member_lane_activity where member_id = $1::uuid",
        [owner.id],
      );
      record(
        names.discoveryLaneAct,
        !badLane.ok &&
          badLane.code === "22023" &&
          !badAct.ok &&
          badAct.code === "22023" &&
          noted.ok &&
          firstLane === "network" &&
          ownActs.ok &&
          ownActs.rows.some((r) => r.lane === "network" && r.act === "open"),
        "lane " +
          (badLane.ok ? "accepted" : badLane.code) +
          " act " +
          (badAct.ok ? "accepted" : badAct.code) +
          " noted " +
          (noted.ok ? "written" : failed(noted)) +
          " first " +
          firstLane +
          " own " +
          (ownActs.ok ? JSON.stringify(ownActs.rows) : failed(ownActs)),
      );
      await actAs(client, member.id);
      const forgeAct = await attempt(
        client,
        "insert into public.member_lane_activity (member_id, lane, act) values ($1, 'soon', 'open')",
        [member.id],
      );
      const peekActs = await attempt(
        client,
        "select lane from public.member_lane_activity where member_id = $1::uuid",
        [owner.id],
      );
      record(
        names.discoveryLaneInsert,
        !forgeAct.ok && forgeAct.code === "42501" && peekActs.ok && peekActs.rows.length === 0,
        "insert " +
          (forgeAct.ok ? "written" : failed(forgeAct)) +
          " peek " +
          (peekActs.ok ? peekActs.rows.length + " row(s)" : failed(peekActs)),
      );

      // 1080, 1081: the alias history and the reserved words are the database's alone.
      const aliases = await attempt(client, "select alias from public.event_aliases limit 1");
      const words = await attempt(client, "select word from public.reserved_link_words limit 1");
      record(
        names.discoveryAliases,
        !aliases.ok && aliases.code === "42501" && !words.ok && words.code === "42501",
        "aliases " +
          (aliases.ok ? "read" : aliases.code) +
          " words " +
          (words.ok ? "read" : words.code),
      );

      record(
        names.discoveryVocab,
        families.length === 9 &&
          lenses.map((l) => l.value).join(",") === "all,follow,taste,curated,network" &&
          lenses.every((l) => typeof l.short === "string" && l.short.trim() !== "") &&
          laneIds.join(",") ===
            "soon,weekend,online,filling,fresh,curated,follow,taste,near,network" &&
          lanes.every((l) => typeof l.name === "string" && l.name.trim() !== ""),
        vocab.ok
          ? "lenses " +
              JSON.stringify(lenses.map((l) => l.value + ":" + l.short)) +
              " lanes " +
              JSON.stringify(laneIds)
          : failed(vocab),
      );

      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', '', true)");
      const anon = await attempt(client, "select public.convene_discovery('all')");
      const anonPlaces = await attempt(client, "select public.convene_places()");
      const anonRail = await attempt(client, "select * from public.member_rail_state");
      const anonGoing = await attempt(client, "select public.event_going_names($1::uuid[])", [
        SEEDED_FILLING,
      ]);
      const anonAct = await attempt(client, "select public.note_lane_act('soon', 'open')");
      record(
        names.discoverySignedOut,
        !anon.ok &&
          anon.code === "42501" &&
          !anonPlaces.ok &&
          anonPlaces.code === "42501" &&
          !anonRail.ok &&
          anonRail.code === "42501",
        "discovery " +
          (anon.ok ? "answered" : anon.code) +
          " places " +
          (anonPlaces.ok ? "answered" : anonPlaces.code) +
          " rail " +
          (anonRail.ok ? "read" : anonRail.code),
      );
      // The control is the owner's own call above, which answered.
      record(
        names.discoveryGoingSignedOut,
        !anonGoing.ok && anonGoing.code === "42501" && !anonAct.ok && anonAct.code === "42501",
        "going " +
          (anonGoing.ok ? "answered" : anonGoing.code) +
          " act " +
          (anonAct.ok ? "written" : anonAct.code),
      );
    });

    // ------------------------------------------------------------------------------------------
    // G61 (Session 35, 20260927120100): TRUNCATE, REFERENCES, TRIGGER and MAINTAIN, which Supabase's
    // default privileges hand anon and authenticated on every table postgres creates in public, are
    // revoked from every table and from the default. Read from pg_class.relacl through aclexplode and
    // from pg_default_acl, never from information_schema.role_table_grants: that view lists only the
    // grants where the reading role is grantor or grantee, so as live_arms it would read zero whatever
    // the truth. Both catalogues are readable by every role.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      await actAsSelf(client);
      const held = await attempt(
        client,
        `select
           (select coalesce(jsonb_agg(distinct c.relname || ':' || r.rolname || ':' || a.privilege_type), '[]'::jsonb)
            from pg_class c
            cross join lateral aclexplode(c.relacl) a
            join pg_roles r on r.oid = a.grantee
            where c.relnamespace = 'public'::regnamespace
              and c.relkind in ('r', 'p')
              and r.rolname in ('anon', 'authenticated')
              and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')) as tables,
           (select coalesce(jsonb_agg(distinct r.rolname || ':' || a.privilege_type), '[]'::jsonb)
            from pg_default_acl d
            cross join lateral aclexplode(d.defaclacl) a
            join pg_roles r on r.oid = a.grantee
            where d.defaclnamespace = 'public'::regnamespace
              and d.defaclrole = 'postgres'::regrole
              and d.defaclobjtype = 'r'
              and r.rolname in ('anon', 'authenticated')
              and a.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')) as defaults`,
      );
      const row = held.ok ? held.rows[0] : null;
      record(
        names.grants,
        !!row && row.tables.length === 0 && row.defaults.length === 0,
        row
          ? "tables " +
              JSON.stringify(row.tables.slice(0, 5)) +
              " (" +
              row.tables.length +
              ") default ACL " +
              JSON.stringify(row.defaults)
          : held.code + " " + held.message,
      );
    });

    // ------------------------------------------------------------------------------------------
    // Brief 12 12A (rulings 1177, 1178, 1265, 1266; 20261001120000; handoff 40-A). The admin gate is
    // the database. Every arm opens with the same presence probe so that before the apply the block
    // reports UNPROVEN as a whole (G143, 228). The admin persona is the member id
    // live_arms_admin_member() answers, read as live_arms itself (382); the arms then act as that
    // member with an aal claim of their choosing, exactly as Supabase Auth would set it. Each arm is
    // its own rolled-back transaction, so a grant one arm makes is gone before the next begins.
    // ------------------------------------------------------------------------------------------
    const adminPresent = async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('public.admin_session_state()') is not null as ok",
      );
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    const adminMember = async () => {
      await actAsSelf(client);
      const r = await attempt(client, "select public.live_arms_admin_member() as id");
      return r.ok && r.rows[0] ? r.rows[0].id : null;
    };
    const stateAs = async (uid, aal) => {
      await actAs(client, uid, aal);
      const r = await attempt(client, "select public.admin_session_state() as s");
      return r.ok ? { ok: true, s: r.rows[0] && r.rows[0].s } : r;
    };
    const roleList = (st) => (st.ok && st.s && Array.isArray(st.s.roles) ? st.s.roles : null);
    const fmt = (r) => (r.ok ? "answered" : r.code + " " + r.message);
    if (!(await adminPresent())) {
      for (const n of armsOf("admin"))
        skip(n, "20261001120000_b12a_access_audit.sql is not on the project yet");
    } else {
      // 1. No policy anywhere cites is_admin (1266). pg_policies is readable by every role.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const cites = await attempt(
          client,
          "select schemaname || '.' || tablename || '.' || policyname as p from pg_policies where qual ilike '%is_admin%' or with_check ilike '%is_admin%' order by 1",
        );
        record(
          names.admin,
          cites.ok && cites.rows.length === 0,
          cites.ok
            ? cites.rows.length
              ? cites.rows.map((r) => r.p).join(", ")
              : "none"
            : fmt(cites),
        );
      });

      // 2. The admin persona at aal1: a role holder with no admin reach; at aal2 the same call answers.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.adminAal1, "live_arms_admin_member() answered no admin");
          return;
        }
        const at1 = await stateAs(adminId, "aal1");
        const roles1 = roleList(at1);
        const grant1 = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: aal1 control') as id",
          [adminId === member.id ? owner.id : member.id],
        );
        const at2 = await stateAs(adminId, "aal2");
        const roles2 = roleList(at2);
        const grant2 = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: aal2 control') as id",
          [adminId === member.id ? owner.id : member.id],
        );
        record(
          names.adminAal1,
          at1.ok &&
            at1.s.holds_role === true &&
            Array.isArray(roles1) &&
            roles1.length === 0 &&
            !grant1.ok &&
            grant1.code === "42501" &&
            at2.ok &&
            Array.isArray(roles2) &&
            roles2.includes("admin") &&
            grant2.ok,
          "aal1 " +
            (at1.ok ? JSON.stringify(at1.s) : fmt(at1)) +
            " grant " +
            fmt(grant1) +
            "; aal2 roles " +
            JSON.stringify(roles2) +
            " grant " +
            fmt(grant2),
        );
      });

      // 3. Grant, read as the grantee, revoke, read again (1177, 1178).
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId || adminId === member.id) {
          skip(names.adminGrant, adminId ? "the admin persona is member-test" : "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const granted = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: grant analyst to member-test') as id",
          [member.id],
        );
        const holding = await stateAs(member.id, "aal2");
        const held = roleList(holding);
        await actAs(client, adminId, "aal2");
        const revoked = await attempt(
          client,
          "select public.admin_revoke_role($1::uuid, 'analyst', 'live arm: revoke analyst from member-test') as id",
          [member.id],
        );
        const after = await stateAs(member.id, "aal2");
        record(
          names.adminGrant,
          granted.ok &&
            typeof granted.rows[0].id !== "undefined" &&
            holding.ok &&
            holding.s.holds_role === true &&
            Array.isArray(held) &&
            held.includes("analyst") &&
            revoked.ok &&
            after.ok &&
            after.s.holds_role === false &&
            Array.isArray(roleList(after)) &&
            roleList(after).length === 0,
          "grant " +
            fmt(granted) +
            " then " +
            (holding.ok ? JSON.stringify(holding.s) : fmt(holding)) +
            "; revoke " +
            fmt(revoked) +
            " then " +
            (after.ok ? JSON.stringify(after.s) : fmt(after)),
        );
      });

      // 4. A member with no role: refused the write, and refused every direct read (1265, 1266).
      await inTransaction(client, async () => {
        await actAs(client, member.id, "aal2");
        const grant = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: a member grants') as id",
          [owner.id],
        );
        const reads = [];
        for (const t of ["platform_roles", "admin_actions", "admin_reads"]) {
          const r = await attempt(client, "select * from public." + t + " limit 1");
          if (r.ok || r.code !== "42501") reads.push(t + " " + fmt(r));
        }
        record(
          names.adminRefused,
          !grant.ok && grant.code === "42501" && reads.length === 0,
          "grant " +
            fmt(grant) +
            (reads.length ? "; reads " + reads.join(", ") : "; all three reads refused"),
        );
      });

      // 5. The last live admin cannot revoke itself (22023), so the company cannot lock itself out.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.adminLastAdmin, "live_arms_admin_member() answered no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const self = await attempt(
          client,
          "select public.admin_revoke_role($1::uuid, 'admin', 'live arm: the last admin revokes itself') as id",
          [adminId],
        );
        record(
          names.adminLastAdmin,
          !self.ok && self.code === "22023",
          self.ok
            ? "revoked: either a second live admin exists or the guard did not hold"
            : fmt(self),
        );
      });

      // 6. The append-only triggers are on both logs (1178). live_arms holds no write on either
      // table, so the refusal itself is read from the catalog and not exercised; the arm says so.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const trg = await attempt(
          client,
          "select tgrelid::regclass::text || ':' || tgname as t from pg_trigger where not tgisinternal and tgrelid in ('public.admin_actions'::regclass, 'public.admin_reads'::regclass) order by 1",
        );
        const want = [
          "admin_actions:admin_actions_append_only",
          "admin_actions:admin_actions_no_truncate",
          "admin_reads:admin_reads_append_only",
          "admin_reads:admin_reads_no_truncate",
        ];
        const have = trg.ok ? trg.rows.map((r) => r.t) : [];
        record(
          names.adminAppendOnly,
          trg.ok && want.every((w) => have.includes(w)),
          (trg.ok ? have.join(", ") : fmt(trg)) +
            "; catalog only, the service-role refusal is not exercisable as live_arms",
        );
      });

      // 7. Signed out holds no execute on any of the three.
      await inTransaction(client, async () => {
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const calls = [];
        for (const [n, sql] of [
          ["admin_session_state", "select public.admin_session_state()"],
          ["admin_grant_role", "select public.admin_grant_role($1::uuid, 'analyst', 'x')"],
          ["admin_revoke_role", "select public.admin_revoke_role($1::uuid, 'analyst', 'x')"],
        ]) {
          const r = await attempt(client, sql, sql.includes("$1") ? [member.id] : undefined);
          if (r.ok || r.code !== "42501") calls.push(n + " " + fmt(r));
        }
        record(names.adminSignedOut, calls.length === 0, calls.join("; ") || "all three refused");
      });

      // 8. The vocabulary serves the six roles in their one order (1177).
      await inTransaction(client, async () => {
        await actAs(client, member.id, "aal2");
        const v = await attempt(
          client,
          "select public.vocabularies() -> 'platform_role_kinds' as k",
        );
        const kinds = v.ok && Array.isArray(v.rows[0].k) ? v.rows[0].k.map((k) => k.value) : null;
        const want = ["admin", "editor", "moderator", "support", "finance", "analyst"];
        record(
          names.adminVocab,
          !!kinds && JSON.stringify(kinds) === JSON.stringify(want),
          v.ok ? JSON.stringify(kinds) : fmt(v),
        );
      });
    }

    // ------------------------------------------------------------------------------------------
    // Brief 12 12C part 1 (rulings 1179, 1284, 1294 to 1300; 20261002120000; handoff 40-C). The
    // recording layer and the mobilization ledger. Every arm opens with the same presence probe so
    // that before the apply the block reports UNPROVEN as a whole (G143, 228). live_arms reads the
    // history, the log and the ledger under policies confined to the two test accounts, reads the
    // catalogue whole, and executes profile_at, member_side, derive_mobilization_v1 and
    // mobilization_jobs (382). Each arm is its own rolled-back transaction: a row record_event
    // writes, a history row a move writes and a derivation's upsert are all gone before the next
    // arm begins (269).
    // ------------------------------------------------------------------------------------------
    const RECORD_EVENT =
      "public.record_event(text, text, uuid, text, text, public.anchor_kind, uuid, jsonb, text)";
    const mobilPresent = async () => {
      await actAsSelf(client);
      const present = await client.query("select to_regprocedure($1) is not null as ok", [
        RECORD_EVENT,
      ]);
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    /** record_event with the envelope the app will send; props and object default to none. */
    const recordEvent = (kind, opts = {}) =>
      attempt(
        client,
        "select public.record_event($1, 'app', $2::uuid, $3, null, $4::public.anchor_kind, $5::uuid, $6::jsonb, 'wide')",
        [
          kind,
          opts.session,
          opts.surface || "/",
          opts.objectKind || null,
          opts.objectId || null,
          JSON.stringify(opts.props || {}),
        ],
      );
    const newUuid = async () => {
      await actAsSelf(client);
      const r = await client.query("select gen_random_uuid()::text as u");
      return r.rows[0].u;
    };
    if (!(await mobilPresent())) {
      for (const n of armsOf("mobil"))
        skip(n, "20261002120000_b12c_recording_ledger.sql is not on the project yet");
    } else {
      // 1. The one writer refuses what the kind does not allow and accepts what it does (1179, 1297,
      // 1298). The accepted calls are proven by the row they leave, read back as live_arms under its
      // test-account policy; a member reading the table directly is refused at the grant.
      await inTransaction(client, async () => {
        const session = await newUuid();
        await actAs(client, member.id);
        const unknown = await recordEvent("no_such_kind", { session });
        const badProp = await recordEvent("feed_viewed", {
          session,
          props: { lens: "all", ip: "x" },
        });
        const memberObject = await recordEvent("profile_viewed", {
          session,
          objectKind: "member",
          objectId: owner.id,
        });
        const accepted = await recordEvent("feed_viewed", { session, props: { lens: "all" } });
        const memberRead = await attempt(client, "select id from public.surface_events limit 1");
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const signedOutPrivate = await recordEvent("feed_viewed", {
          session,
          props: { lens: "all" },
        });
        const signedOutPublic = await recordEvent("event_page_viewed", {
          session,
          surface: "/e/x",
          objectKind: "event",
          objectId: session,
        });
        await actAsSelf(client);
        const rows = await attempt(
          client,
          "select kind, member_id is null as anon from public.surface_events where session_id = $1::uuid order by id",
          [session],
        );
        const written = rows.ok ? rows.rows.map((r) => r.kind + (r.anon ? "(anon)" : "")) : null;
        const refused = (r) => !r.ok && r.code === "22023";
        record(
          names.mobil,
          refused(unknown) &&
            refused(badProp) &&
            refused(memberObject) &&
            refused(signedOutPrivate) &&
            accepted.ok &&
            signedOutPublic.ok &&
            !memberRead.ok &&
            memberRead.code === "42501" &&
            JSON.stringify(written) === JSON.stringify(["feed_viewed", "event_page_viewed(anon)"]),
          "unknown " +
            fmt(unknown) +
            "; prop " +
            fmt(badProp) +
            "; member object " +
            fmt(memberObject) +
            "; signed-out feed_viewed " +
            fmt(signedOutPrivate) +
            "; signed-in feed_viewed " +
            fmt(accepted) +
            "; signed-out event_page_viewed " +
            fmt(signedOutPublic) +
            "; member read " +
            fmt(memberRead) +
            "; rows " +
            (rows.ok ? JSON.stringify(written) : fmt(rows)),
        );
      });

      // 1b. 12C part 2 (1361, 1616): an anonymous kind writes no member even with a session; the
      // three access kinds are public and anonymous, so signed out they are accepted with the
      // session id, their one allowed prop and nothing else; a non-public kind signed out is still
      // refused. Proven by the rows read back as live_arms, then rolled back.
      await inTransaction(client, async () => {
        const session = await newUuid();
        // Read from the catalog, not information_schema: that view hides the columns of a table the
        // role holds no privilege on, and live_arms holds none on surface_event_kinds (it reads the
        // kinds through record_event, a definer).
        const column = await attempt(
          client,
          "select count(*)::int as n from pg_attribute where attrelid = 'public.surface_event_kinds'::regclass and attname = 'anonymous' and not attisdropped",
        );
        if (!column.ok || column.rows[0].n !== 1) {
          skip(
            names.mobilAnonymous,
            "20261010170000_h58_12c2_recording.sql is not on the project yet",
          );
          return;
        }
        await actAs(client, member.id);
        const signedInAnonymous = await recordEvent("password_reset_completed", { session });
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const failed = await recordEvent("sign_in_failed", {
          session,
          surface: "/sign-in",
          props: { reason_class: "wrong_credentials" },
        });
        const requested = await recordEvent("password_reset_requested", {
          session,
          surface: "/reset",
        });
        const completed = await recordEvent("password_reset_completed", {
          session,
          surface: "/reset/new",
        });
        const stillPrivate = await recordEvent("feed_viewed", { session, props: { lens: "all" } });
        await actAsSelf(client);
        const rows = await attempt(
          client,
          "select kind, member_id is null as anon, object_kind is null as no_object, props from public.surface_events where session_id = $1::uuid order by id",
          [session],
        );
        const written = rows.ok
          ? rows.rows.map(
              (r) =>
                r.kind +
                (r.anon ? "(anon)" : "(member)") +
                (r.no_object ? "" : "(object)") +
                " " +
                JSON.stringify(r.props),
            )
          : null;
        const refused = (r) => !r.ok && r.code === "22023";
        record(
          names.mobilAnonymous,
          signedInAnonymous.ok &&
            failed.ok &&
            requested.ok &&
            completed.ok &&
            refused(stillPrivate) &&
            JSON.stringify(written) ===
              JSON.stringify([
                "password_reset_completed(anon) {}",
                'sign_in_failed(anon) {"reason_class":"wrong_credentials"}',
                "password_reset_requested(anon) {}",
                "password_reset_completed(anon) {}",
              ]),
          "signed-in anonymous " +
            fmt(signedInAnonymous) +
            "; signed-out failed " +
            fmt(failed) +
            "; requested " +
            fmt(requested) +
            "; completed " +
            fmt(completed) +
            "; signed-out feed_viewed " +
            fmt(stillPrivate) +
            "; rows " +
            (rows.ok ? JSON.stringify(written) : fmt(rows)),
        );
      });

      // 2. History: one row per change of the three columns, none for a save that changes none of
      // them, and no update or delete (1295). live_arms holds select only, so the refusal it meets is
      // the grant's; the append-only triggers are read from the catalog.
      await inTransaction(client, async () => {
        const count = async () => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select count(*)::int as n from public.member_profile_history where member_id = $1::uuid",
            [member.id],
          );
          return r.ok ? r.rows[0].n : null;
        };
        const before = await count();
        await actAs(client, member.id);
        const move = await attempt(
          client,
          "update public.members set current_country = 'Kenya', current_place = 'Nairobi' where id = $1::uuid",
          [member.id],
        );
        const afterMove = await count();
        await actAs(client, member.id);
        const same = await attempt(
          client,
          "update public.members set headline = coalesce(headline, '') where id = $1::uuid",
          [member.id],
        );
        const afterSame = await count();
        await actAsSelf(client);
        const upd = await attempt(
          client,
          "update public.member_profile_history set source = 'change' where member_id = $1::uuid",
          [member.id],
        );
        const del = await attempt(
          client,
          "delete from public.member_profile_history where member_id = $1::uuid",
          [member.id],
        );
        const trg = await attempt(
          client,
          "select tgname from pg_trigger where not tgisinternal and tgrelid = 'public.member_profile_history'::regclass order by 1",
        );
        const have = trg.ok ? trg.rows.map((r) => r.tgname) : [];
        record(
          names.mobilHistory,
          move.ok &&
            same.ok &&
            before !== null &&
            afterMove === before + 1 &&
            afterSame === afterMove &&
            !upd.ok &&
            upd.code === "42501" &&
            !del.ok &&
            del.code === "42501" &&
            have.includes("member_profile_history_append_only") &&
            have.includes("member_profile_history_no_truncate"),
          "rows " +
            before +
            " -> " +
            afterMove +
            " after the move -> " +
            afterSame +
            " after a same-value save; update " +
            fmt(upd) +
            "; delete " +
            fmt(del) +
            "; triggers " +
            (trg.ok ? have.join(", ") : fmt(trg)),
        );
      });

      // 3. Which countries are African (1295): every public.countries name that world_countries
      // carries reads true, and a non-member reads false. Both tables are the member's to read.
      await inTransaction(client, async () => {
        await actAs(client, member.id);
        const au = await attempt(
          client,
          "select count(*)::int as members, count(*) filter (where w.is_african)::int as flagged, string_agg(c.name, ', ') filter (where not w.is_african) as missed from public.countries c join public.world_countries w on w.name = c.name",
        );
        const us = await attempt(
          client,
          "select is_african from public.world_countries where name = 'United States'",
        );
        const flagged = await attempt(
          client,
          "select count(*)::int as n from public.world_countries where is_african",
        );
        const r = au.ok ? au.rows[0] : null;
        record(
          names.mobilAfrican,
          !!r &&
            r.members === 54 &&
            r.flagged === 54 &&
            us.ok &&
            us.rows[0] &&
            us.rows[0].is_african === false &&
            flagged.ok &&
            flagged.rows[0].n === 54,
          (r
            ? r.flagged +
              " of " +
              r.members +
              " matched members flagged" +
              (r.missed ? ", missed " + r.missed : "")
            : fmt(au)) +
            "; United States " +
            (us.ok && us.rows[0] ? String(us.rows[0].is_african) : fmt(us)) +
            "; flagged in all " +
            (flagged.ok ? flagged.rows[0].n : fmt(flagged)) +
            " (the Sahrawi Arab Democratic Republic has no world_countries row under ruling 142)",
        );
      });

      // 4. The derivation on the seeded data (1284, 1294, 1296): Engaging intro rows for the test
      // accounts' accepted introductions, nothing keyed on an RSVP, follow, save or heart, and a
      // re-run that writes or changes nothing.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const read = async () =>
          attempt(
            client,
            "select act_key, depth, source, member_side, member_stance::text as member_stance, counterparty_side, direction, bridging from public.mobilization_ledger where definition_version = 1 order by act_key",
          );
        const before = await read();
        const rerun = await attempt(
          client,
          "select private.derive_mobilization_v1(null::timestamptz, null::timestamptz) as n",
        );
        const after = await read();
        const rows = before.ok ? before.rows : [];
        const intros = rows.filter((r) => r.act_key.startsWith("intro:"));
        const forbidden = rows.filter((r) => /^(rsvp|follow|save|heart|reaction):/.test(r.act_key));
        const prefixes = [...new Set(rows.map((r) => r.act_key.split(":")[0]))];
        record(
          names.mobilDerive,
          before.ok &&
            intros.length > 0 &&
            intros.every(
              (r) =>
                r.depth === "engaging" &&
                r.source === "counterparty" &&
                r.member_side &&
                r.member_stance &&
                r.counterparty_side &&
                r.direction &&
                typeof r.bridging === "boolean",
            ) &&
            forbidden.length === 0 &&
            rerun.ok &&
            rerun.rows[0].n === 0 &&
            after.ok &&
            JSON.stringify(after.rows) === JSON.stringify(rows),
          (before.ok
            ? rows.length +
              " row(s) on the test accounts, prefixes " +
              JSON.stringify(prefixes) +
              ", intro rows " +
              intros.length
            : fmt(before)) +
            "; re-run wrote " +
            (rerun.ok ? rerun.rows[0].n : fmt(rerun)) +
            (after.ok && before.ok && JSON.stringify(after.rows) !== JSON.stringify(rows)
              ? "; rows changed"
              : ""),
        );
      });

      // 5. Side and stance as they were (1295): member-test lives in Accra, so continent with their
      // own stance; after a move to London the same moment reads diaspora, and a moment before the
      // move still reads continent, because the side is read from the history and not from the row.
      await inTransaction(client, async () => {
        const sideAt = async (at) => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select private.member_side($1::uuid, " +
              at +
              ") as side, (private.profile_at($1::uuid, " +
              at +
              ")).stance::text as stance, (private.profile_at($1::uuid, " +
              at +
              ")).current_place as place",
            [member.id],
          );
          return r.ok ? r.rows[0] : r;
        };
        // The member's own stance and place come from profile_view, the one read projection: since
        // Fix PR 01 (212 to 216) authenticated holds no column select on members for any of the three.
        await actAs(client, member.id);
        const own = await attempt(client, "select public.profile_view() -> 'member' as m");
        const home = own.ok && own.rows[0] && own.rows[0].m ? own.rows[0].m : null;
        const accra = await sideAt("now()");
        await actAs(client, member.id);
        const move = await attempt(
          client,
          "update public.members set current_country = 'United Kingdom', current_place = 'London' where id = $1::uuid",
          [member.id],
        );
        const london = await sideAt("now()");
        const earlier = await sideAt("now() - interval '1 minute'");
        record(
          names.mobilSide,
          !!home &&
            home.current_place === "Accra" &&
            accra.side === "continent" &&
            accra.stance === home.stance &&
            move.ok &&
            london.side === "diaspora" &&
            london.stance === home.stance &&
            earlier.side === "continent",
          "home " +
            (home
              ? home.current_place + ", " + home.current_country + ", " + home.stance
              : fmt(own)) +
            "; now " +
            JSON.stringify(accra) +
            "; after the move " +
            JSON.stringify(london) +
            "; a minute before " +
            JSON.stringify(earlier),
        );
      });

      // 6. The four jobs with their schedules (1179), through the definer the migration grants
      // live_arms, because cron.job is supabase_admin's.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const jobs = await attempt(
          client,
          "select jobname, schedule, active from private.mobilization_jobs() order by jobname",
        );
        const want = {
          dna_mobilization_derive_hourly: "7 * * * *",
          dna_surface_events_partition_monthly: "10 2 20 * *",
          dna_surface_events_retention_daily: "35 3 * * *",
          dna_surface_events_rollup_hourly: "12 * * * *",
        };
        const have = jobs.ok
          ? Object.fromEntries(jobs.rows.map((j) => [j.jobname, j.schedule]))
          : {};
        record(
          names.mobilCron,
          jobs.ok &&
            jobs.rows.length === 4 &&
            Object.entries(want).every(([n, s]) => have[n] === s) &&
            jobs.rows.every((j) => j.active === true),
          jobs.ok
            ? jobs.rows
                .map((j) => j.jobname + " " + j.schedule + (j.active ? "" : " (inactive)"))
                .join("; ")
            : fmt(jobs),
        );
      });

      // 7. The catalogue (1299, 1300): the seven tables this migration made carry a real treatment,
      // and every table in public, partitions excepted, has a row.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const made = [
          "admin_catalogue",
          "member_profile_history",
          "mobilization_ledger",
          "partner_acts",
          "surface_event_kinds",
          "surface_event_rollups",
          "surface_events",
        ];
        const rows = await attempt(
          client,
          "select table_name, admin_treatment, dia_treatment from public.admin_catalogue where schema_name = 'public' and table_name = any($1::text[]) order by table_name",
          [made],
        );
        const missing = await attempt(
          client,
          "select string_agg(c.relname, ', ' order by c.relname) as t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition and not exists (select 1 from public.admin_catalogue a where a.schema_name = 'public' and a.table_name = c.relname)",
        );
        const treated = rows.ok ? rows.rows : [];
        record(
          names.mobilCatalogue,
          rows.ok &&
            treated.length === made.length &&
            treated.every((r) => r.admin_treatment !== "unreviewed") &&
            missing.ok &&
            missing.rows[0].t === null,
          (rows.ok
            ? treated
                .map((r) => r.table_name + ":" + r.admin_treatment + "/" + r.dia_treatment)
                .join(", ")
            : fmt(rows)) +
            "; without a row: " +
            (missing.ok ? missing.rows[0].t || "none" : fmt(missing)),
        );
      });
    }

    // ------------------------------------------------------------------------------------------
    // Brief 14 41-A (rulings 1330 to 1353, 1368 to 1373; 20261002130000 to 20261002130800; handoff
    // 41-A). Messenger's schema and server. Every arm opens with the same presence probe so that
    // before the apply the block reports UNPROVEN as a whole (G143, 228). The arms act as the two
    // test accounts and, for a third member, as the admin persona live_arms_admin_member() answers
    // (382), through the public.messenger_* wrappers a client calls; live_arms reads threads,
    // thread_members, messages and requests under policies confined to the test accounts. Each arm
    // is its own rolled-back transaction (269): the request, the thread, the block, the group and
    // the rate-limit hits are all gone before the next arm begins.
    // ------------------------------------------------------------------------------------------
    const MESSENGER_SEND =
      "public.messenger_send(uuid, uuid, text, public.message_kind, uuid, uuid, uuid[], jsonb)";
    const messengerPresent = async () => {
      await actAsSelf(client);
      const present = await client.query("select to_regprocedure($1) is not null as ok", [
        MESSENGER_SEND,
      ]);
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    // A client id minted here, as the app mints it, so no arm has to leave the member's role for it.
    const uuid = () => crypto.randomUUID();
    const send = (thread, clientId, body) =>
      attempt(client, "select id, seq, body from public.messenger_send($1::uuid, $2::uuid, $3)", [
        thread,
        clientId,
        body,
      ]);
    /** owner-test asks member-test, member-test accepts; answers the thread id or the refusal. */
    const openPair = async () => {
      await actAs(client, owner.id);
      const req = await attempt(
        client,
        "select id, state from public.messenger_request_send($1::uuid, $2)",
        [member.id, "A request from the live arms"],
      );
      if (!req.ok) return { ok: false, step: "request", r: req };
      await actAs(client, member.id);
      const acc = await attempt(client, "select public.messenger_request_accept($1::uuid) as t", [
        req.rows[0].id,
      ]);
      if (!acc.ok) return { ok: false, step: "accept", r: acc };
      return { ok: true, thread: acc.rows[0].t, request: req.rows[0] };
    };
    /**
     * 41-E (1581): a group takes the creator's connections only, so an arm that creates one connects
     * its members first, through the canonical path: `a` introduces themselves to `b` and `b`
     * accepts, or the other way round when the first direction is refused (a non-onboarded sender
     * may still be introduced to). Answers ok, or the refusal to name in a skip.
     */
    const connect = async (a, b) => {
      const note = "Live arms connection. Rolled back by the same run.";
      for (const [from, to] of [
        [a, b],
        [b, a],
      ]) {
        await actAs(client, from);
        const intro = await attempt(client, "select public.send_introduction($1, $2) as id", [
          to,
          note,
        ]);
        if (!intro.ok) continue;
        await actAs(client, to);
        const acc = await attempt(client, "select public.respond_to_request($1, true)", [from]);
        return acc.ok ? { ok: true } : { ok: false, why: "accept " + fmt(acc) };
      }
      await actAsSelf(client);
      const already = await attempt(
        client,
        "select private.is_connected($1::uuid, $2::uuid) as ok",
        [a, b],
      );
      if (already.ok && already.rows[0].ok === true) return { ok: true };
      return { ok: false, why: "send_introduction refused in both directions" };
    };
    const emojiPresent = async () => {
      await actAsSelf(client);
      const r = await client.query(
        "select to_regclass('public.message_reaction_emoji') is not null as ok",
      );
      return !!r.rows[0] && r.rows[0].ok === true;
    };
    if (!(await messengerPresent())) {
      for (const n of armsOf("messenger"))
        skip(
          n,
          "the 41-A migrations (20261002130000 to 20261002130800) are not on the project yet",
        );
    } else {
      const withEmoji = await emojiPresent();
      // 1. The request and the accept (1330, 1341).
      await inTransaction(client, async () => {
        const pair = await openPair();
        let detail = pair.ok ? "accepted" : pair.step + " " + fmt(pair.r);
        let ok = false;
        if (pair.ok) {
          const first = await attempt(
            client,
            "select seq, body, author_name from public.messenger_messages_view where thread_id = $1::uuid order by seq",
            [pair.thread],
          );
          await actAs(client, owner.id);
          const again = await attempt(
            client,
            "select public.messenger_open_one_to_one($1::uuid) as t",
            [member.id],
          );
          await actAsSelf(client);
          const rows = await attempt(
            client,
            "select member_id, state from public.thread_members where thread_id = $1::uuid order by member_id",
            [pair.thread],
          );
          const active = rows.ok ? rows.rows.filter((r) => r.state === "active").length : -1;
          ok =
            pair.request.state === "pending" &&
            first.ok &&
            first.rows.length === 1 &&
            Number(first.rows[0].seq) === 1 &&
            first.rows[0].body === "A request from the live arms" &&
            first.rows[0].author_name === owner.name &&
            again.ok &&
            again.rows[0].t === pair.thread &&
            active === 2;
          detail +=
            "; seq 1 " +
            (first.ok ? JSON.stringify(first.rows[0]) : fmt(first)) +
            "; reopen " +
            (again.ok
              ? again.rows[0].t === pair.thread
                ? "same thread"
                : "other thread"
              : fmt(again)) +
            "; active rows " +
            active;
        }
        record(names.messenger, ok, detail);
      });

      // 2. A third member reads none of it (1116, 1349).
      await inTransaction(client, async () => {
        const third = await attempt(client, "select public.live_arms_admin_member() as id");
        const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
        if (!thirdId) {
          skip(names.messengerThird, "live_arms_admin_member() answered no third member");
          return;
        }
        const pair = await openPair();
        if (!pair.ok) {
          record(names.messengerThird, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        await send(pair.thread, uuid(), "Only for the pair");
        await actAs(client, thirdId);
        const msgs = await attempt(
          client,
          "select count(*)::int as n from public.messages where thread_id = $1::uuid",
          [pair.thread],
        );
        const list = await attempt(
          client,
          "select count(*)::int as n from public.messenger_threads_view where thread_id = $1::uuid",
          [pair.thread],
        );
        await actAs(client, member.id);
        const own = await attempt(
          client,
          "select count(*)::int as n from public.messages where thread_id = $1::uuid",
          [pair.thread],
        );
        record(
          names.messengerThird,
          msgs.ok &&
            msgs.rows[0].n === 0 &&
            list.ok &&
            list.rows[0].n === 0 &&
            own.ok &&
            own.rows[0].n === 2,
          "third reads " +
            (msgs.ok ? msgs.rows[0].n : fmt(msgs)) +
            " messages and lists " +
            (list.ok ? list.rows[0].n : fmt(list)) +
            "; member-test reads " +
            (own.ok ? own.rows[0].n : fmt(own)),
        );
      });

      // 3. A block closes the pair's thread both ways (1349).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.messengerBlocked, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        await send(pair.thread, uuid(), "Before the block");
        await actAs(client, member.id);
        const before = await attempt(
          client,
          "select count(*)::int as n from public.messages where thread_id = $1::uuid",
          [pair.thread],
        );
        const block = await attempt(
          client,
          "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
          [member.id, owner.id],
        );
        await actAs(client, owner.id);
        const after = await attempt(
          client,
          "select count(*)::int as n from public.messages where thread_id = $1::uuid",
          [pair.thread],
        );
        const refused = await send(pair.thread, uuid(), "After the block");
        record(
          names.messengerBlocked,
          before.ok &&
            before.rows[0].n === 2 &&
            block.ok &&
            after.ok &&
            after.rows[0].n === 0 &&
            !refused.ok &&
            refused.message === "blocked",
          "before " +
            (before.ok ? before.rows[0].n : fmt(before)) +
            "; block " +
            fmt(block) +
            "; after " +
            (after.ok ? after.rows[0].n : fmt(after)) +
            "; send " +
            fmt(refused),
        );
      });

      // 4. History off: the late joiner sees nothing before joined_seq (1342).
      await inTransaction(client, async () => {
        const third = await attempt(client, "select public.live_arms_admin_member() as id");
        const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
        if (!thirdId) {
          skip(names.messengerHistory, "live_arms_admin_member() answered no third member");
          return;
        }
        for (const other of [member.id, thirdId]) {
          const c = await connect(owner.id, other);
          if (!c.ok) {
            skip(names.messengerHistory, "could not connect the group's members (1581): " + c.why);
            return;
          }
        }
        await actAs(client, owner.id);
        const group = await attempt(
          client,
          "select public.messenger_thread_create_group($1, array[$2::uuid, $3::uuid]) as t",
          ["Live arms group", member.id, thirdId],
        );
        if (!group.ok) {
          record(names.messengerHistory, false, "create " + fmt(group));
          return;
        }
        const g = group.rows[0].t;
        await actAs(client, member.id);
        const acceptEarly = await attempt(
          client,
          "select public.messenger_thread_invite_accept($1::uuid)",
          [g],
        );
        await actAs(client, owner.id);
        const early = await send(g, uuid(), "Before the third joined");
        await actAs(client, thirdId);
        const invited = await attempt(
          client,
          "select invited from public.messenger_threads_view where thread_id = $1::uuid",
          [g],
        );
        const acceptLate = await attempt(
          client,
          "select public.messenger_thread_invite_accept($1::uuid)",
          [g],
        );
        const none = await attempt(
          client,
          "select count(*)::int as n from public.messenger_messages_view where thread_id = $1::uuid",
          [g],
        );
        await actAs(client, owner.id);
        const late = await send(g, uuid(), "After the third joined");
        await actAs(client, thirdId);
        const one = await attempt(
          client,
          "select seq from public.messenger_messages_view where thread_id = $1::uuid order by seq",
          [g],
        );
        await actAs(client, member.id);
        const both = await attempt(
          client,
          "select count(*)::int as n from public.messenger_messages_view where thread_id = $1::uuid",
          [g],
        );
        record(
          names.messengerHistory,
          acceptEarly.ok &&
            early.ok &&
            invited.ok &&
            invited.rows.length === 1 &&
            invited.rows[0].invited === true &&
            acceptLate.ok &&
            none.ok &&
            none.rows[0].n === 0 &&
            late.ok &&
            one.ok &&
            one.rows.length === 1 &&
            Number(one.rows[0].seq) === 2 &&
            both.ok &&
            both.rows[0].n === 2,
          "invited " +
            (invited.ok ? JSON.stringify(invited.rows) : fmt(invited)) +
            "; late joiner before " +
            (none.ok ? none.rows[0].n : fmt(none)) +
            ", after " +
            (one.ok ? JSON.stringify(one.rows.map((r) => Number(r.seq))) : fmt(one)) +
            "; early member " +
            (both.ok ? both.rows[0].n : fmt(both)),
        );
      });

      // 5. Idempotent send, and dense seq (1351).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.messengerIdempotent, false, pair.step + " " + fmt(pair.r));
          record(names.messengerSeq, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const cid = uuid();
        const first = await send(pair.thread, cid, "First body");
        const again = await send(pair.thread, cid, "A replay with another body");
        const next = await send(pair.thread, uuid(), "Second body");
        record(
          names.messengerIdempotent,
          first.ok &&
            again.ok &&
            first.rows[0].id === again.rows[0].id &&
            again.rows[0].body === "First body",
          "first " +
            fmt(first) +
            "; replay " +
            (again.ok ? JSON.stringify(again.rows[0]) : fmt(again)),
        );
        record(
          names.messengerSeq,
          first.ok && next.ok && Number(first.rows[0].seq) === 2 && Number(next.rows[0].seq) === 3,
          "seq " +
            (first.ok ? first.rows[0].seq : fmt(first)) +
            " then " +
            (next.ok ? next.rows[0].seq : fmt(next)),
        );
      });

      // 6. The cap (1332). The refusal needs 256 active members and the project holds far fewer, so
      // it is unproven here (228) and was exercised on a local replay of the chain; what the
      // project can prove is the trigger's presence and shape.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const members = await attempt(client, "select count(*)::int as n from public.members");
        const n = members.ok ? members.rows[0].n : null;
        skip(
          names.messengerCap,
          "live_arms reads " +
            (n === null ? "an unknown number of" : n) +
            " member rows (its policy admits the two test accounts) and the refusal needs 257 distinct members a rolled-back fixture cannot mint (241, 269); exercised on a local replay of the chain instead",
        );
        const trig = await attempt(
          client,
          "select t.tgname, t.tgtype, p.proname, position('256' in p.prosrc) > 0 as names_cap from pg_trigger t join pg_proc p on p.oid = t.tgfoid where t.tgrelid = 'public.thread_members'::regclass and t.tgname = 'on_thread_members_cap' and not t.tgisinternal",
        );
        const row = trig.ok && trig.rows[0];
        // tgtype bit 1 is row, bit 2 is before, bit 4 is insert, bit 16 is update.
        const type = row ? Number(row.tgtype) : 0;
        record(
          names.messengerCapTrigger,
          !!row &&
            (type & 1) === 1 &&
            (type & 2) === 2 &&
            (type & 4) === 4 &&
            (type & 16) === 16 &&
            row.proname === "thread_members_cap" &&
            row.names_cap === true,
          row ? row.tgname + " type " + type + " -> " + row.proname : fmt(trig),
        );
      });

      // 7. Ticks (1345).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.messengerTick, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const sent = await send(pair.thread, uuid(), "Tick me");
        const tick = (label) =>
          attempt(
            client,
            "select tick from public.messenger_messages_view where message_id = $1::uuid",
            [sent.ok ? sent.rows[0].id : null],
          ).then((r) => ({ label, v: r.ok && r.rows[0] ? Number(r.rows[0].tick) : fmt(r) }));
        await actAs(client, owner.id);
        const stored = await tick("stored");
        await actAs(client, member.id);
        await attempt(client, "select public.messenger_read_to($1::uuid, $2::bigint)", [
          pair.thread,
          2,
        ]);
        await actAs(client, owner.id);
        const readOff = await tick("read with receipts off");
        await attempt(client, "select public.messenger_settings_set(true, null, null)");
        const oneOn = await tick("only the author on");
        await actAs(client, member.id);
        await attempt(client, "select public.messenger_settings_set(true, null, null)");
        await actAs(client, owner.id);
        const bothOn = await tick("both on");
        record(
          names.messengerTick,
          sent.ok && stored.v === 1 && readOff.v === 2 && oneOn.v === 2 && bothOn.v === 3,
          [stored, readOff, oneOn, bothOn].map((t) => t.label + " " + t.v).join("; "),
        );
      });

      // 8. Search inside scope (1338, 1347).
      await inTransaction(client, async () => {
        const third = await attempt(client, "select public.live_arms_admin_member() as id");
        const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
        if (!thirdId) {
          skip(names.messengerSearch, "live_arms_admin_member() answered no third member");
          return;
        }
        for (const other of [member.id, thirdId]) {
          const c = await connect(owner.id, other);
          if (!c.ok) {
            skip(names.messengerSearch, "could not connect the group's members (1581): " + c.why);
            return;
          }
        }
        await actAs(client, owner.id);
        const group = await attempt(
          client,
          "select public.messenger_thread_create_group($1, array[$2::uuid, $3::uuid]) as t",
          ["Search group", member.id, thirdId],
        );
        if (!group.ok) {
          record(names.messengerSearch, false, "create " + fmt(group));
          return;
        }
        const g = group.rows[0].t;
        await actAs(client, member.id);
        await attempt(client, "select public.messenger_thread_invite_accept($1::uuid)", [g]);
        await actAs(client, owner.id);
        await send(g, uuid(), "The quokka word appears here");
        await actAs(client, member.id);
        const found = await attempt(
          client,
          "select thread_id, seq, headline from public.messenger_search($1)",
          ["quokka"],
        );
        await actAs(client, thirdId);
        const outside = await attempt(
          client,
          "select count(*)::int as n from public.messenger_search($1)",
          ["quokka"],
        );
        await actAs(client, member.id);
        await attempt(client, "select public.messenger_thread_leave($1::uuid)", [g]);
        const gone = await attempt(
          client,
          "select count(*)::int as n from public.messenger_search($1)",
          ["quokka"],
        );
        record(
          names.messengerSearch,
          found.ok &&
            found.rows.length === 1 &&
            found.rows[0].thread_id === g &&
            Number(found.rows[0].seq) === 1 &&
            outside.ok &&
            outside.rows[0].n === 0 &&
            gone.ok &&
            gone.rows[0].n === 0,
          "member " +
            (found.ok
              ? JSON.stringify(found.rows.map((r) => [Number(r.seq), r.headline]))
              : fmt(found)) +
            "; invited third " +
            (outside.ok ? outside.rows[0].n : fmt(outside)) +
            "; after leaving " +
            (gone.ok ? gone.rows[0].n : fmt(gone)),
        );
      });

      // 9. The ceiling (1353): thirty answered, the 31st refused, inside one rolled-back minute.
      await inTransaction(client, async () => {
        await actAs(client, member.id);
        const answers = [];
        for (let i = 0; i < 31; i++) {
          const r = await attempt(client, "select public.rate_limit_check('message_send') as ok");
          answers.push(r.ok ? r.rows[0].ok : fmt(r));
        }
        const first30 = answers.slice(0, 30).every((a) => a === true);
        record(
          names.messengerRate,
          first30 && answers[30] === false,
          "first thirty " +
            (first30 ? "answered" : JSON.stringify(answers.slice(0, 30))) +
            "; 31st " +
            answers[30],
        );
      });

      // 10. The publication stays empty (1351).
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const pub = await attempt(
          client,
          "select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime'",
        );
        record(
          names.messengerPublication,
          pub.ok && pub.rows[0].n === 0,
          pub.ok ? "tables " + pub.rows[0].n : fmt(pub),
        );
      });

      // 11. The realtime.messages policy's predicate, and the insert refusal (1351). realtime.messages
      // is partitioned by day on the project, and a row for a day with no partition is refused by
      // tuple routing (23514) before row security is consulted, so the refusal is proven two ways:
      // the catalog holds no insert policy for a client role, and the insert itself does not land,
      // whichever of the two refusals answers first.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const policy = await attempt(
          client,
          "select qual from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'messenger_topics_select'",
        );
        const writers = await attempt(
          client,
          "select count(*)::int as n from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd in ('INSERT', 'ALL') and (roles::text[] && array['anon', 'authenticated', 'public'])",
        );
        await actAs(client, owner.id);
        const self = await attempt(client, "select private.messenger_topic_allowed($1) as ok", [
          "inbox:" + owner.id,
        ]);
        const other = await attempt(client, "select private.messenger_topic_allowed($1) as ok", [
          "inbox:" + member.id,
        ]);
        const insert = await attempt(
          client,
          "insert into realtime.messages (topic, extension, payload, event, private) values ($1, 'broadcast', '{}'::jsonb, 'x', true)",
          ["inbox:" + owner.id],
        );
        record(
          names.messengerRealtime,
          policy.ok &&
            policy.rows.length === 1 &&
            /messenger_topic_allowed/.test(policy.rows[0].qual) &&
            self.ok &&
            self.rows[0].ok === true &&
            other.ok &&
            other.rows[0].ok === false &&
            writers.ok &&
            writers.rows[0].n === 0 &&
            !insert.ok &&
            (insert.code === "42501" || insert.code === "23514"),
          "policy " +
            (policy.ok ? policy.rows.length + " row(s)" : fmt(policy)) +
            "; client insert policies " +
            (writers.ok ? writers.rows[0].n : fmt(writers)) +
            "; self " +
            (self.ok ? self.rows[0].ok : fmt(self)) +
            "; other " +
            (other.ok ? other.rows[0].ok : fmt(other)) +
            "; insert " +
            fmt(insert),
        );
      });

      // 12. The four vocabularies (1331, 1348, 1349, 1370).
      await inTransaction(client, async () => {
        await actAs(client, member.id);
        const v = await attempt(client, "select public.vocabularies() as v");
        const j = v.ok ? v.rows[0].v : null;
        const len = (k) => (j && Array.isArray(j[k]) ? j[k].length : -1);
        const values = (k) => (j && Array.isArray(j[k]) ? j[k].map((x) => x.value) : []);
        // 41-E (1398, 1403): once 20261008150700 is on the project the five words are gone and the
        // quick eight stand in their place, in 1403's order.
        const QUICK = [
          "\u{1F44D}\uFE0F",
          "\u2764\uFE0F",
          "\u{1F64F}",
          "\u{1F44F}",
          "\u{1F389}",
          "\u{1F602}",
          "\u{1F62E}",
          "\u{1F622}",
        ];
        const reactionsOk = withEmoji
          ? j &&
            !("message_reaction_kinds" in j) &&
            JSON.stringify(values("message_reaction_quick")) === JSON.stringify(QUICK)
          : len("message_reaction_kinds") === 5 &&
            JSON.stringify(values("message_reaction_kinds")) ===
              JSON.stringify(["agree", "thanks", "noted", "well_done", "sorry_to_hear"]);
        record(
          names.messengerVocab,
          len("thread_kinds") === 7 &&
            len("message_mute_durations") === 3 &&
            len("message_report_reasons") === 6 &&
            reactionsOk,
          v.ok
            ? "thread_kinds " +
                len("thread_kinds") +
                ", mute " +
                len("message_mute_durations") +
                ", reasons " +
                len("message_report_reasons") +
                ", reactions " +
                (withEmoji
                  ? values("message_reaction_quick").join(" ")
                  : values("message_reaction_kinds").join(" "))
            : fmt(v),
        );
      });

      // 13. No client write grant on any new table, and every one in the catalogue (1116, 1299).
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const made = [
          "threads",
          "thread_members",
          "messages",
          "message_reactions",
          "message_mentions",
          "message_requests",
          "message_reports",
          "message_view_audit",
          "member_messaging_settings",
          "messenger_dia_dismissals",
          "thread_kinds",
          "message_mute_durations",
          "message_report_reasons",
          // 41-E: message_reaction_emoji replaces message_reaction_kinds (20261008150000, 20261008150700).
          withEmoji ? "message_reaction_emoji" : "message_reaction_kinds",
        ];
        const grants = await attempt(
          client,
          "select string_agg(table_name || ':' || grantee || ':' || privilege_type, ', ') as g from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE') and table_name = any($1::text[])",
          [made],
        );
        const rows = await attempt(
          client,
          "select count(*)::int as n from public.admin_catalogue where schema_name = 'public' and table_name = any($1::text[])",
          [made],
        );
        record(
          names.messengerGrants,
          grants.ok && grants.rows[0].g === null && rows.ok && rows.rows[0].n === made.length,
          "write grants " +
            (grants.ok ? grants.rows[0].g || "none" : fmt(grants)) +
            "; catalogue rows " +
            (rows.ok ? rows.rows[0].n + "/" + made.length : fmt(rows)),
        );
      });

      // ----------------------------------------------------------------------------------------
      // Handoff 56-41E (rulings 1576, 1577, 1580, 1581, 1590 to 1592): emoji reactions, the skin
      // tone, Start a group's words and its invited members, the rename's system line. Unproven
      // as a whole until Chat applies 20261008150000 to 20261008150700 (228).
      // ----------------------------------------------------------------------------------------
      const E = ["messengerEmoji", "messengerSkin", "messengerCreate", "messengerRename"];
      if (!withEmoji) {
        for (const prefix of E)
          for (const n of armsOf(prefix))
            skip(n, "20261008150000 to 20261008150700 are not on the project yet");
      } else {
        const HANDS = "\u{1F64F}";
        const THUMB = "\u{1F44D}\uFE0F";
        const MEDIUM = "\u{1F3FD}";
        const MEDIUM_DARK = "\u{1F3FE}";
        const react = (message, emoji) =>
          attempt(client, "select public.messenger_react($1::uuid, $2)", [message, emoji]);
        const rowsOf = (message, uid) =>
          attempt(
            client,
            "select reaction from public.message_reactions where message_id = $1::uuid and member_id = $2::uuid order by reaction",
            [message, uid],
          );

        // 14. One reaction per member (1577, 1590).
        await inTransaction(client, async () => {
          const pair = await openPair();
          if (!pair.ok) {
            record(names.messengerEmojiOne, false, pair.step + " " + fmt(pair.r));
            return;
          }
          await actAs(client, owner.id);
          const sent = await send(pair.thread, uuid(), "React to this");
          if (!sent.ok) {
            record(names.messengerEmojiOne, false, "send " + fmt(sent));
            return;
          }
          const mid = sent.rows[0].id;
          await actAs(client, member.id);
          const r1 = await react(mid, HANDS);
          const r2 = await react(mid, THUMB);
          const rows = await rowsOf(mid, member.id);
          const view = await attempt(
            client,
            "select reactions from public.messenger_messages_view where message_id = $1::uuid",
            [mid],
          );
          const list = view.ok && view.rows[0] ? view.rows[0].reactions : null;
          const word = await react(mid, "agree");
          const un = await attempt(client, "select public.messenger_unreact($1::uuid, $2)", [
            mid,
            THUMB,
          ]);
          const after = await rowsOf(mid, member.id);
          record(
            names.messengerEmojiOne,
            r1.ok &&
              r2.ok &&
              rows.ok &&
              rows.rows.length === 1 &&
              rows.rows[0].reaction === THUMB &&
              Array.isArray(list) &&
              list.length === 1 &&
              list[0].reaction === THUMB &&
              list[0].own === true &&
              !word.ok &&
              /bad_reaction/.test(word.message || "") &&
              un.ok &&
              after.ok &&
              after.rows.length === 0,
            "rows " +
              (rows.ok ? JSON.stringify(rows.rows) : fmt(rows)) +
              "; view " +
              JSON.stringify(list) +
              "; word " +
              fmt(word) +
              "; after unreact " +
              (after.ok ? after.rows.length : fmt(after)),
          );
        });

        // 15. The modifier (1576, 1577).
        await inTransaction(client, async () => {
          const pair = await openPair();
          if (!pair.ok) {
            record(names.messengerEmojiTone, false, pair.step + " " + fmt(pair.r));
            return;
          }
          await actAs(client, owner.id);
          const sent = await send(pair.thread, uuid(), "A hand and a face");
          if (!sent.ok) {
            record(names.messengerEmojiTone, false, "send " + fmt(sent));
            return;
          }
          const mid = sent.rows[0].id;
          await actAs(client, member.id);
          const hand = await react(mid, HANDS + MEDIUM_DARK);
          const stored = await rowsOf(mid, member.id);
          // The thumb's base carries U+FE0F in the seed; its toned form does not (1F44D 1F3FE).
          const thumb = await react(mid, "\u{1F44D}" + MEDIUM_DARK);
          const storedThumb = await rowsOf(mid, member.id);
          const face = await react(mid, "\u{1F602}" + MEDIUM_DARK);
          const two = await react(mid, HANDS + MEDIUM_DARK + MEDIUM);
          record(
            names.messengerEmojiTone,
            hand.ok &&
              stored.ok &&
              stored.rows.length === 1 &&
              stored.rows[0].reaction === HANDS + MEDIUM_DARK &&
              thumb.ok &&
              storedThumb.ok &&
              storedThumb.rows[0].reaction === "\u{1F44D}" + MEDIUM_DARK &&
              !face.ok &&
              /bad_reaction/.test(face.message || "") &&
              !two.ok &&
              /bad_reaction/.test(two.message || ""),
            "hand " +
              (stored.ok ? JSON.stringify(stored.rows) : fmt(stored)) +
              "; thumb " +
              (storedThumb.ok ? JSON.stringify(storedThumb.rows) : fmt(storedThumb)) +
              "; face " +
              fmt(face) +
              "; two modifiers " +
              fmt(two),
          );
        });

        // 16. The skin tone setting and the recent emoji (1576, 1405).
        await inTransaction(client, async () => {
          await actAs(client, member.id);
          const set = await attempt(
            client,
            "select reaction_skin_tone from public.messenger_settings_set(null, null, null, $1)",
            [MEDIUM],
          );
          const kept = await attempt(
            client,
            "select reaction_skin_tone from public.messenger_settings_set(null, null, null, null)",
          );
          const cleared = await attempt(
            client,
            "select reaction_skin_tone from public.messenger_settings_set(null, null, null, 'none')",
          );
          const bad = await attempt(
            client,
            "select reaction_skin_tone from public.messenger_settings_set(null, null, null, 'x')",
          );
          const read = await attempt(
            client,
            "select reaction_skin_tone from public.messenger_settings()",
          );
          const pair = await openPair();
          let recent = { ok: false, message: pair.ok ? "" : pair.step + " " + fmt(pair.r) };
          if (pair.ok) {
            await actAs(client, owner.id);
            const a = await send(pair.thread, uuid(), "First");
            const b = await send(pair.thread, uuid(), "Second");
            if (a.ok && b.ok) {
              await actAs(client, member.id);
              await react(a.rows[0].id, HANDS);
              await react(b.rows[0].id, THUMB);
              recent = await attempt(client, "select public.messenger_recent_reactions() as r");
            }
          }
          const list = recent.ok && recent.rows[0] ? recent.rows[0].r : null;
          record(
            names.messengerSkinTone,
            set.ok &&
              set.rows[0].reaction_skin_tone === MEDIUM &&
              kept.ok &&
              kept.rows[0].reaction_skin_tone === MEDIUM &&
              cleared.ok &&
              cleared.rows[0].reaction_skin_tone === null &&
              !bad.ok &&
              /bad_skin_tone/.test(bad.message || "") &&
              read.ok &&
              read.rows[0].reaction_skin_tone === null &&
              Array.isArray(list) &&
              JSON.stringify(list) === JSON.stringify([THUMB, HANDS]),
            "set " +
              (set.ok ? JSON.stringify(set.rows[0]) : fmt(set)) +
              "; null keeps " +
              (kept.ok ? JSON.stringify(kept.rows[0]) : fmt(kept)) +
              "; none clears " +
              (cleared.ok ? JSON.stringify(cleared.rows[0]) : fmt(cleared)) +
              "; x " +
              fmt(bad) +
              "; recent " +
              (recent.ok ? JSON.stringify(list) : fmt(recent)),
          );
        });

        // 17. The create words (1581), each by the wrapper.
        await inTransaction(client, async () => {
          const third = await attempt(client, "select public.live_arms_admin_member() as id");
          const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
          await actAs(client, owner.id);
          const create = (name, ids) =>
            attempt(client, "select public.messenger_thread_create_group($1, $2::uuid[]) as t", [
              name,
              ids,
            ]);
          const wordOf = (r) =>
            r.ok
              ? "ok"
              : String(r.message || "")
                  .trim()
                  .split(/\s/)[0];
          const badName = wordOf(await create("   ", [member.id]));
          const noMembersNull = wordOf(await create("Group", null));
          const noMembersEmpty = wordOf(await create("Group", []));
          const full = wordOf(
            await create(
              "Group",
              Array.from({ length: 256 }, () => uuid()),
            ),
          );
          const self = wordOf(await create("Group", [owner.id]));
          const unknown = wordOf(await create("Group", [uuid()]));
          // A stranger: the third member, with whom owner-test holds no connection in this transaction.
          const stranger = thirdId ? wordOf(await create("Group", [thirdId])) : "no third member";
          // A blocked connection is bad_member before not_your_connection: connect, then block.
          const c = await connect(owner.id, member.id);
          let blocked = "could not connect: " + (c.ok ? "" : c.why);
          if (c.ok) {
            await actAs(client, member.id);
            const block = await attempt(
              client,
              "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
              [member.id, owner.id],
            );
            await actAs(client, owner.id);
            blocked = block.ok ? wordOf(await create("Group", [member.id])) : "block " + fmt(block);
          }
          record(
            names.messengerCreateWords,
            badName === "bad_name" &&
              noMembersNull === "no_members" &&
              noMembersEmpty === "no_members" &&
              full === "group_full" &&
              self === "bad_member" &&
              unknown === "bad_member" &&
              stranger === "not_your_connection" &&
              blocked === "bad_member",
            JSON.stringify({
              badName,
              noMembersNull,
              noMembersEmpty,
              full,
              self,
              unknown,
              stranger,
              blocked,
            }),
          );
        });

        // 18. The invited members (1580, 1592).
        await inTransaction(client, async () => {
          const c = await connect(owner.id, member.id);
          if (!c.ok) {
            skip(names.messengerCreateInvited, "could not connect the pair (1581): " + c.why);
            return;
          }
          await actAs(client, owner.id);
          const group = await attempt(
            client,
            "select public.messenger_thread_create_group($1, array[$2::uuid]) as t",
            ["Invited group", member.id],
          );
          if (!group.ok) {
            record(names.messengerCreateInvited, false, "create " + fmt(group));
            return;
          }
          const g = group.rows[0].t;
          const asOwner = await attempt(
            client,
            "select invited_names, invited_others, member_names, others, role, state from public.messenger_threads_view where thread_id = $1::uuid",
            [g],
          );
          await actAs(client, member.id);
          const asMember = await attempt(
            client,
            "select invited, state from public.messenger_threads_view where thread_id = $1::uuid",
            [g],
          );
          await actAsSelf(client);
          const rows = await attempt(
            client,
            "select member_id, role, state from public.thread_members where thread_id = $1::uuid order by member_id",
            [g],
          );
          const o = asOwner.ok ? asOwner.rows[0] : null;
          const m = asMember.ok ? asMember.rows[0] : null;
          record(
            names.messengerCreateInvited,
            !!o &&
              JSON.stringify(o.invited_names) === JSON.stringify([member.name]) &&
              o.invited_others === false &&
              JSON.stringify(o.member_names) === JSON.stringify([]) &&
              o.role === "lead" &&
              o.state === "active" &&
              !!m &&
              m.invited === true &&
              m.state === "invited" &&
              rows.ok &&
              rows.rows.length === 2 &&
              rows.rows.every((r) =>
                r.member_id === owner.id
                  ? r.role === "lead" && r.state === "active"
                  : r.member_id === member.id && r.state === "invited",
              ),
            "owner " +
              (asOwner.ok ? JSON.stringify(o) : fmt(asOwner)) +
              "; member " +
              (asMember.ok ? JSON.stringify(m) : fmt(asMember)) +
              "; rows " +
              (rows.ok ? JSON.stringify(rows.rows) : fmt(rows)),
          );
        });

        // 19. The rename's system line (1591).
        await inTransaction(client, async () => {
          const c = await connect(owner.id, member.id);
          if (!c.ok) {
            skip(names.messengerRenameSystem, "could not connect the pair (1581): " + c.why);
            return;
          }
          await actAs(client, owner.id);
          const group = await attempt(
            client,
            "select public.messenger_thread_create_group($1, array[$2::uuid]) as t",
            ["Before the rename", member.id],
          );
          if (!group.ok) {
            record(names.messengerRenameSystem, false, "create " + fmt(group));
            return;
          }
          const g = group.rows[0].t;
          await actAs(client, member.id);
          await attempt(client, "select public.messenger_thread_invite_accept($1::uuid)", [g]);
          await actAs(client, owner.id);
          const hello = await send(g, uuid(), "Hello before the renamed word");
          const renamed = await attempt(
            client,
            "select public.messenger_thread_rename($1::uuid, $2)",
            [g, "After the rename"],
          );
          const log = await attempt(
            client,
            "select seq, kind, body, author_id, author_name from public.messenger_messages_view where thread_id = $1::uuid order by seq",
            [g],
          );
          // The text row's body carries the search word on purpose: search answers that row and
          // never the system row, so a search that found nothing at all would also be wrong.
          const search = await attempt(
            client,
            "select seq from public.messenger_search($1) where thread_id = $2::uuid order by seq",
            ["renamed", g],
          );
          const row = await attempt(
            client,
            "select name, last_seq, last_line, last_kind, unread from public.messenger_threads_view where thread_id = $1::uuid",
            [g],
          );
          const sys = log.ok ? log.rows.find((r) => r.kind === "system") : null;
          const pin = sys
            ? await attempt(
                client,
                "select public.messenger_pin_message(m.id) from public.messages m where m.thread_id = $1::uuid and m.seq = $2::bigint",
                [g, sys.seq],
              )
            : { ok: false, message: "no system row" };
          record(
            names.messengerRenameSystem,
            hello.ok &&
              renamed.ok &&
              log.ok &&
              log.rows.length === 2 &&
              !!sys &&
              Number(sys.seq) === 2 &&
              sys.body === "renamed" &&
              sys.author_id === owner.id &&
              sys.author_name === owner.name &&
              search.ok &&
              search.rows.length === 1 &&
              Number(search.rows[0].seq) === 1 &&
              row.ok &&
              row.rows[0].name === "After the rename" &&
              Number(row.rows[0].last_seq) === 1 &&
              row.rows[0].last_kind === "text" &&
              !pin.ok &&
              /bad_kind/.test(pin.message || ""),
            "log " +
              (log.ok
                ? JSON.stringify(log.rows.map((r) => [Number(r.seq), r.kind, r.body]))
                : fmt(log)) +
              "; search " +
              (search.ok ? JSON.stringify(search.rows.map((r) => Number(r.seq))) : fmt(search)) +
              "; row " +
              (row.ok ? JSON.stringify(row.rows[0]) : fmt(row)) +
              "; pin " +
              fmt(pin),
          );
        });
      }
    }

    // ------------------------------------------------------------------------------------------
    // Brief 14 41-B (rulings 1346, 1374; 346, 347; 1343, 1353; 20261002150000; handoff 41-B).
    // Messenger media on R2, the database half: the functions the two server routes call, acted
    // as the two test accounts through the public.messenger_media_* wrappers, with the pair's
    // thread opened the way the 41-A arms open it. Every arm is its own rolled-back transaction
    // (269): the request, the thread, the media rows and the message are gone before the next
    // begins. The R2 object itself is the route's and is proven by tests/messenger-media.cjs on
    // the deployed URL; nothing here reaches a bucket. One presence probe gates the block (G143).
    // ------------------------------------------------------------------------------------------
    const MEDIA_RECORD =
      "public.messenger_media_record(uuid, text, text, integer, integer, integer)";
    const mediaPresent = async () => {
      await actAsSelf(client);
      const present = await client.query("select to_regprocedure($1) is not null as ok", [
        MEDIA_RECORD,
      ]);
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    /** A key under the thread's own prefix, as the route mints it: thread/client_id/object. */
    const mediaKey = (thread) => thread + "/" + uuid() + "/" + uuid();
    const recordMedia = (thread, key, mime, size, w, h) =>
      attempt(
        client,
        "select id, owner_id, bucket, kind, mime, width, height, byte_size, optimized, delete_requested_at from public.messenger_media_record($1::uuid, $2, $3, $4::int, $5::int, $6::int)",
        [thread, key, mime, size, w, h],
      );
    const access = (id) =>
      attempt(client, "select public.messenger_media_access($1::uuid) as ok", [id]);
    const locate = (id) =>
      attempt(
        client,
        "select allowed, storage_path, mime, byte_size from public.messenger_media_locate($1::uuid)",
        [id],
      );
    if (!(await mediaPresent())) {
      for (const n of armsOf("r2media"))
        skip(n, "the 41-B migration (20261002150000) is not on the project yet");
    } else {
      // 1. The writer, for both test accounts (1374: one insert path).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaRecord, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const image = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "image/jpeg",
          1024,
          10,
          10,
        );
        await actAs(client, member.id);
        const audio = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "audio/webm",
          2048,
          null,
          null,
        );
        const i = image.ok ? image.rows[0] : null;
        const a = audio.ok ? audio.rows[0] : null;
        record(
          names.r2mediaRecord,
          !!i &&
            !!a &&
            i.owner_id === owner.id &&
            a.owner_id === member.id &&
            i.bucket === "r2:message-media" &&
            a.bucket === "r2:message-media" &&
            i.kind === "message" &&
            a.kind === "message" &&
            i.mime === "image/jpeg" &&
            a.mime === "audio/webm" &&
            i.width === 10 &&
            i.height === 10 &&
            a.width === null &&
            a.height === null &&
            i.byte_size === 1024 &&
            a.byte_size === 2048 &&
            i.optimized === true &&
            a.optimized === false &&
            i.delete_requested_at === null,
          "image " +
            (image.ok ? JSON.stringify(i) : fmt(image)) +
            "; audio " +
            (audio.ok ? JSON.stringify(a) : fmt(audio)),
        );
      });

      // 2. The refusals by mime and size (1374), each a word with its code.
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaMime, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const pdf = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "application/pdf",
          1024,
          10,
          10,
        );
        const audioSized = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "audio/mp4",
          1024,
          10,
          10,
        );
        const imageUnsized = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "image/png",
          1024,
          null,
          null,
        );
        const over = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "video/mp4",
          104857601,
          10,
          10,
        );
        const atCeiling = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "video/mp4",
          104857600,
          10,
          10,
        );
        const refusedAs = (r, word) => !r.ok && r.code === "22023" && r.message === word;
        record(
          names.r2mediaMime,
          refusedAs(pdf, "bad_media") &&
            refusedAs(audioSized, "bad_media") &&
            refusedAs(imageUnsized, "bad_media") &&
            refusedAs(over, "too_large") &&
            atCeiling.ok &&
            atCeiling.rows[0].byte_size === 104857600,
          "pdf " +
            fmt(pdf) +
            "; audio with a size " +
            fmt(audioSized) +
            "; image without one " +
            fmt(imageUnsized) +
            "; over " +
            fmt(over) +
            "; at the ceiling " +
            fmt(atCeiling),
        );
      });

      // 3. The key must sit under the thread's own prefix and within 240 characters (1374).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaPath, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const outside = await recordMedia(
          pair.thread,
          mediaKey(uuid()),
          "image/jpeg",
          1024,
          10,
          10,
        );
        const bare = await recordMedia(pair.thread, pair.thread + "/", "image/jpeg", 1024, 10, 10);
        const long = await recordMedia(
          pair.thread,
          pair.thread + "/" + "x".repeat(240),
          "image/jpeg",
          1024,
          10,
          10,
        );
        const notMember = await (async () => {
          const third = await attempt(client, "select public.live_arms_admin_member() as id");
          const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
          if (!thirdId) return { ok: false, code: "skip", message: "no third member" };
          await actAs(client, thirdId);
          return recordMedia(pair.thread, mediaKey(pair.thread), "image/jpeg", 1024, 10, 10);
        })();
        record(
          names.r2mediaPath,
          !outside.ok &&
            outside.code === "22023" &&
            outside.message === "bad_media" &&
            !bare.ok &&
            bare.code === "22023" &&
            !long.ok &&
            long.code === "22023" &&
            !notMember.ok &&
            (notMember.code === "skip" ||
              (notMember.code === "42501" && notMember.message === "not_a_member")),
          "outside " +
            fmt(outside) +
            "; bare " +
            fmt(bare) +
            "; long " +
            fmt(long) +
            "; a third member " +
            fmt(notMember),
        );
      });

      // 4. Access and locate (1346, 1349): the owner before any message, the other member once the
      //    message carries it, and a third member never.
      await inTransaction(client, async () => {
        const third = await attempt(client, "select public.live_arms_admin_member() as id");
        const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
        if (!thirdId) {
          skip(names.r2mediaAccess, "live_arms_admin_member() answered no third member");
          return;
        }
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaAccess, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const key = mediaKey(pair.thread);
        const made = await recordMedia(pair.thread, key, "image/jpeg", 1024, 10, 10);
        if (!made.ok) {
          record(names.r2mediaAccess, false, "record " + fmt(made));
          return;
        }
        const id = made.rows[0].id;
        const ownerBefore = await access(id);
        await actAs(client, member.id);
        const memberBefore = await access(id);
        const memberLocateBefore = await locate(id);
        await actAs(client, owner.id);
        const sent = await attempt(
          client,
          "select id from public.messenger_send($1::uuid, $2::uuid, null, 'media', null, $3::uuid)",
          [pair.thread, uuid(), id],
        );
        await actAs(client, member.id);
        const memberAfter = await access(id);
        const memberLocate = await locate(id);
        await actAs(client, thirdId);
        const thirdAfter = await access(id);
        const thirdLocate = await locate(id);
        const absent = await locate(uuid());
        await actAsSelf(client);
        const signedOut = await access(id);
        const ml = memberLocate.ok ? memberLocate.rows[0] : null;
        const tl = thirdLocate.ok ? thirdLocate.rows[0] : null;
        const mb = memberLocateBefore.ok ? memberLocateBefore.rows[0] : null;
        record(
          names.r2mediaAccess,
          ownerBefore.ok &&
            ownerBefore.rows[0].ok === true &&
            memberBefore.ok &&
            memberBefore.rows[0].ok === false &&
            !!mb &&
            mb.allowed === false &&
            mb.storage_path === null &&
            sent.ok &&
            memberAfter.ok &&
            memberAfter.rows[0].ok === true &&
            !!ml &&
            ml.allowed === true &&
            ml.storage_path === key &&
            ml.mime === "image/jpeg" &&
            ml.byte_size === 1024 &&
            thirdAfter.ok &&
            thirdAfter.rows[0].ok === false &&
            !!tl &&
            tl.allowed === false &&
            tl.storage_path === null &&
            absent.ok &&
            absent.rows.length === 0 &&
            // Signed out there is no grant to execute the function at all (revoked from public and
            // anon), so the refusal is 42501 and not a false; either is the answer the route never
            // reaches, because memberFromRequest refuses first.
            (signedOut.ok ? signedOut.rows[0].ok === false : signedOut.code === "42501"),
          "owner before send " +
            (ownerBefore.ok ? ownerBefore.rows[0].ok : fmt(ownerBefore)) +
            "; member before " +
            (memberBefore.ok ? memberBefore.rows[0].ok : fmt(memberBefore)) +
            "; send " +
            fmt(sent) +
            "; member after " +
            (memberAfter.ok ? memberAfter.rows[0].ok : fmt(memberAfter)) +
            "; member locate " +
            (ml ? JSON.stringify(ml) : fmt(memberLocate)) +
            "; third " +
            (thirdAfter.ok ? thirdAfter.rows[0].ok : fmt(thirdAfter)) +
            "; third locate " +
            (tl ? JSON.stringify(tl) : fmt(thirdLocate)) +
            "; absent rows " +
            (absent.ok ? absent.rows.length : fmt(absent)) +
            "; signed out " +
            (signedOut.ok ? signedOut.rows[0].ok : "refused " + fmt(signedOut)),
        );
      });

      // 5. The mark and the sweep (1343, F4).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaSweep, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const key = mediaKey(pair.thread);
        const made = await recordMedia(pair.thread, key, "video/webm", 4096, 16, 9);
        if (!made.ok) {
          record(names.r2mediaSweep, false, "record " + fmt(made));
          return;
        }
        const id = made.rows[0].id;
        const sent = await attempt(
          client,
          "select id from public.messenger_send($1::uuid, $2::uuid, null, 'media', null, $3::uuid)",
          [pair.thread, uuid(), id],
        );
        const markedBefore = await attempt(
          client,
          "select count(*)::int as n from public.messenger_media_marked(100) where media_id = $1::uuid",
          [id],
        );
        const del = sent.ok
          ? await attempt(client, "select public.messenger_delete($1::uuid) as j", [
              sent.rows[0].id,
            ])
          : { ok: false, code: "skip", message: "no message" };
        const marked = await attempt(
          client,
          "select media_id, storage_path from public.messenger_media_marked(100) where media_id = $1::uuid",
          [id],
        );
        const accessMarked = await access(id);
        const forgot = await attempt(
          client,
          "select public.messenger_media_forget($1::uuid) as ok",
          [id],
        );
        const again = await attempt(
          client,
          "select public.messenger_media_forget($1::uuid) as ok",
          [id],
        );
        const gone = await attempt(
          client,
          "select count(*)::int as n from public.messenger_media_marked(100) where media_id = $1::uuid",
          [id],
        );
        const unmarkedForget = await (async () => {
          const other = await recordMedia(
            pair.thread,
            mediaKey(pair.thread),
            "image/webp",
            512,
            4,
            4,
          );
          if (!other.ok) return other;
          return attempt(client, "select public.messenger_media_forget($1::uuid) as ok", [
            other.rows[0].id,
          ]);
        })();
        record(
          names.r2mediaSweep,
          sent.ok &&
            markedBefore.ok &&
            markedBefore.rows[0].n === 0 &&
            del.ok &&
            del.rows[0].j &&
            del.rows[0].j.storage_path === key &&
            marked.ok &&
            marked.rows.length === 1 &&
            marked.rows[0].storage_path === key &&
            accessMarked.ok &&
            accessMarked.rows[0].ok === false &&
            forgot.ok &&
            forgot.rows[0].ok === true &&
            again.ok &&
            again.rows[0].ok === false &&
            gone.ok &&
            gone.rows[0].n === 0 &&
            unmarkedForget.ok &&
            unmarkedForget.rows[0].ok === false,
          "send " +
            fmt(sent) +
            "; marked before " +
            (markedBefore.ok ? markedBefore.rows[0].n : fmt(markedBefore)) +
            "; delete " +
            (del.ok ? JSON.stringify(del.rows[0].j) : fmt(del)) +
            "; marked " +
            (marked.ok ? marked.rows.length : fmt(marked)) +
            "; access once marked " +
            (accessMarked.ok ? accessMarked.rows[0].ok : fmt(accessMarked)) +
            "; forget " +
            (forgot.ok ? forgot.rows[0].ok : fmt(forgot)) +
            "; again " +
            (again.ok ? again.rows[0].ok : fmt(again)) +
            "; gone " +
            (gone.ok ? gone.rows[0].n : fmt(gone)) +
            "; forget of an unmarked row " +
            (unmarkedForget.ok ? unmarkedForget.rows[0].ok : fmt(unmarkedForget)),
        );
      });

      // 6. M13 (handoff 41-C, SPEC 41-14 Part D; 1353): private.message_send no longer asks the
      // message_media ceiling, because message_media_record already counted the upload. Read in
      // the function's own definition first: before Chat applies 20261002160000 the branch is still
      // there and the arm is unproven by name (228), never failed for a window ruling 225 opens on
      // purpose. Then, in one rolled-back transaction: the ceiling is walked to its edge under a
      // savepoint to learn how many slots the owner has left (real uploads from 41-B's browser arm
      // can hold some), rolled back, and walked again to leave exactly one; the record takes it, the
      // send carrying the object is answered, and the ceiling then refuses, so the send counted
      // nothing.
      await inTransaction(client, async () => {
        await actAsSelf(client);
        const def = await attempt(
          client,
          "select position('message_media' in pg_get_functiondef('private.message_send(uuid, uuid, text, public.message_kind, uuid, uuid, uuid[], jsonb)'::regprocedure)) = 0 as applied",
        );
        if (!def.ok || !def.rows[0].applied) {
          skip(
            names.r2mediaOnce,
            def.ok
              ? "20261002160000_b14c_message_media_rate is not on the project yet: private.message_send still asks the message_media ceiling"
              : "private.message_send's definition could not be read: " + fmt(def),
          );
          return;
        }
        const pair = await openPair();
        if (!pair.ok) {
          record(names.r2mediaOnce, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const ask = async () => {
          const r = await attempt(client, "select public.rate_limit_check('message_media') as ok");
          return r.ok && r.rows[0].ok === true;
        };
        await client.query("savepoint m13_probe");
        let free = 0;
        while (free < 41 && (await ask())) free += 1;
        await client.query("rollback to savepoint m13_probe");
        if (free < 1) {
          skip(
            names.r2mediaOnce,
            "owner-test holds no message_media slot this hour (uploads from the deployment's arms), so one count cannot be told from two",
          );
          return;
        }
        for (let i = 0; i < free - 1; i += 1) await ask();
        const made = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "image/jpeg",
          1024,
          10,
          10,
        );
        const sent = made.ok
          ? await attempt(
              client,
              "select id from public.messenger_send($1::uuid, $2::uuid, null, 'media', null, $3::uuid)",
              [pair.thread, uuid(), made.rows[0].id],
            )
          : { ok: false, code: "-", message: "no media row" };
        const after = await ask();
        record(
          names.r2mediaOnce,
          made.ok && sent.ok && after === false,
          "slots left " +
            free +
            "; record " +
            (made.ok ? "answered" : fmt(made)) +
            "; send " +
            (sent.ok ? "answered" : fmt(sent)) +
            "; ceiling after " +
            (after ? "still answering" : "refusing"),
        );
      });
    }

    // Brief 14 41-D (rulings 1341, 1384, 1386, 1387, 1396; 20261003130000 to 20261003130400;
    // handoff 41-D). The held entry points: the event thread's join, Recover, Rename, the list's
    // last author and media word, and .mov. One presence probe gates the block (G143, 228), so
    // before the apply every arm reports UNPROVEN. The arms act as the two test accounts and the
    // admin persona as the third member, through the public wrappers a client calls; each is its
    // own rolled-back transaction (269).
    // ------------------------------------------------------------------------------------------
    // The probe reads pg_attribute and never information_schema, which lists only the columns the
    // connecting role holds a privilege on; live_arms holds none on the views, so on c4795b8 the
    // probe read false with all six migrations applied and every 41-D arm reported UNPROVEN.
    const msgdPresent = async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select (to_regprocedure('public.messenger_event_thread_join(uuid)') is not null and to_regprocedure('public.messenger_request_recover(uuid)') is not null and to_regprocedure('public.messenger_thread_rename(uuid, text)') is not null and to_regprocedure('private.messenger_media_word(uuid)') is not null and exists (select 1 from pg_attribute where attrelid = 'public.messenger_threads_view'::regclass and attname = 'last_author_name' and not attisdropped) and exists (select 1 from pg_constraint where conname = 'media_mime_check' and pg_get_constraintdef(oid) like '%video/quicktime%') and pg_get_functiondef('private.message_requests_broadcast()'::regprocedure) like '%tg_op%') as ok",
      );
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    const thirdMember = async () => {
      await actAsSelf(client);
      const third = await attempt(client, "select public.live_arms_admin_member() as id");
      return third.ok && third.rows[0] ? third.rows[0].id : null;
    };
    /** owner-test publishes a free in-person event and answers its id, or null. */
    const publishEvent = async (title) => {
      await actAs(client, owner.id);
      const starts = new Date(Date.now() + 21 * 86400e3);
      starts.setUTCHours(19, 0, 0, 0);
      const published = await attempt(client, "select public.publish_post($1::jsonb) as id", [
        JSON.stringify({
          verb: "convene",
          body: "Brief 14 41-D event thread arm. Rolled back by the same run.",
          author_kind: "member",
          author_id: owner.id,
          audience: "everyone",
          host_context: "live-checks",
          fields: {
            "convene.title": title,
            "convene.format": "in_person",
            "convene.when": "in three weeks at 19:00",
            "convene.starts_at": starts.toISOString(),
            "convene.timezone": "Africa/Accra",
            "convene.place_id": "live-arms-place",
            "convene.place_name": "Front Room",
            "convene.city": "Accra",
            "convene.country": "Ghana",
            "convene.lng": "-0.1747",
            "convene.lat": "5.5559",
            "convene.price_nature": "free",
            "convene.delivery_intent": "In the room, at a long table.",
          },
        }),
      ]);
      if (!published.ok) return { ok: false, r: published };
      const ev = await attempt(
        client,
        "select e.id from public.posts p join public.events e on e.id = p.created_object_id where p.id = $1",
        [published.rows[0].id],
      );
      if (!ev.ok || !ev.rows[0])
        return { ok: false, r: ev.ok ? { ok: false, code: "-", message: "no event" } : ev };
      return { ok: true, id: ev.rows[0].id };
    };
    /** owner-test makes a group with member-test and the third, both of whom accept. */
    const openGroup = async (thirdId, name) => {
      // 1581 (20261008150400): a group is started from the creator's connections only, so the
      // creator is connected to each member first through the canonical path; a pair that cannot
      // be connected is answered as a reason to skip, never recorded as the group's failure.
      for (const who of [member.id, thirdId]) {
        const c = await connect(owner.id, who);
        if (!c.ok) return { ok: false, step: "connect", why: c.why };
      }
      await actAs(client, owner.id);
      const group = await attempt(
        client,
        "select public.messenger_thread_create_group($1, array[$2::uuid, $3::uuid]) as t",
        [name, member.id, thirdId],
      );
      if (!group.ok) return { ok: false, step: "create", r: group };
      const g = group.rows[0].t;
      for (const who of [member.id, thirdId]) {
        await actAs(client, who);
        const acc = await attempt(
          client,
          "select public.messenger_thread_invite_accept($1::uuid)",
          [g],
        );
        if (!acc.ok) return { ok: false, step: "accept", r: acc };
      }
      return { ok: true, thread: g };
    };
    const available = (event) =>
      attempt(client, "select public.messenger_event_thread_available($1::uuid) as ok", [event]);
    const join = (event) =>
      attempt(client, "select public.messenger_event_thread_join($1::uuid) as t", [event]);
    const word = (r) => (r.ok ? JSON.stringify(r.rows[0]) : r.code + " " + r.message);
    if (!(await msgdPresent())) {
      for (const n of armsOf("msgd"))
        skip(
          n,
          "the 41-D migrations (20261003130000 to 20261003130500) are not on the project yet",
        );
    } else {
      // 1. The event thread's join (1384).
      await inTransaction(client, async () => {
        const thirdId = await thirdMember();
        if (!thirdId) {
          skip(names.msgd, "live_arms_admin_member() answered no third member");
          return;
        }
        const ev = await publishEvent("41-D event thread arm");
        if (!ev.ok) {
          record(names.msgd, false, "publish " + fmt(ev.r));
          return;
        }
        await actAs(client, member.id);
        const going = await attempt(
          client,
          "select public.rsvp_event($1::uuid, 'going', 'everyone') as r",
          [ev.id],
        );
        const availBefore = await available(ev.id);
        const joinBefore = await join(ev.id);
        await actAs(client, owner.id);
        const opened = await attempt(
          client,
          "select public.messenger_event_thread_open($1::uuid) as t",
          [ev.id],
        );
        const thread = opened.ok ? opened.rows[0].t : null;
        // Addendum 1 (G199): joined_seq is the thread's highest seq at the moment of joining, on a
        // first join and on a rejoin. The host writes before each join so the highest seq is never
        // 0, and the arm reads it, then the row, as live_arms under the thread's live-arms policy.
        const hostWrites = async (body) => {
          await actAs(client, owner.id);
          return send(thread, uuid(), body);
        };
        const highest = async () => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select coalesce(max(seq), 0)::int as n from public.messages where thread_id = $1::uuid",
            [thread],
          );
          return r.ok ? r.rows[0].n : null;
        };
        const joinedSeq = async (who) => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select joined_seq::int as n from public.thread_members where thread_id = $1::uuid and member_id = $2::uuid",
            [thread, who],
          );
          return r.ok && r.rows[0] ? r.rows[0].n : null;
        };
        const firstWrite = thread ? await hostWrites("Before member-test joins") : opened;
        const maxGoing = await highest();
        await actAs(client, member.id);
        const availGoing = await available(ev.id);
        const joinGoing = await join(ev.id);
        const joinAgain = await join(ev.id);
        const seqGoing = await joinedSeq(member.id);
        await actAs(client, thirdId);
        const availNeither = await available(ev.id);
        const joinNeither = await join(ev.id);
        await actAs(client, owner.id);
        const invited = await attempt(
          client,
          "select public.invite_event_party($1::uuid, $2::uuid, 'speaker') as p",
          [ev.id, thirdId],
        );
        await actAs(client, thirdId);
        const accepted = invited.ok
          ? await attempt(client, "select public.respond_to_event_role($1::uuid, true) as p", [
              invited.rows[0].p.id,
            ])
          : invited;
        const secondWrite = await hostWrites("Before the named party joins");
        const maxParty = await highest();
        await actAs(client, thirdId);
        const joinParty = await join(ev.id);
        const seqParty = await joinedSeq(thirdId);
        await actAs(client, thirdId);
        const left = await attempt(client, "select public.messenger_thread_leave($1::uuid)", [
          thread,
        ]);
        const thirdWrite = await hostWrites("While the named party is away");
        const maxBack = await highest();
        await actAs(client, thirdId);
        const joinBack = await join(ev.id);
        const seqBack = await joinedSeq(thirdId);
        await actAs(client, owner.id);
        const removed = await attempt(
          client,
          "select public.messenger_thread_remove($1::uuid, $2::uuid)",
          [thread, member.id],
        );
        await actAs(client, member.id);
        const availRemoved = await available(ev.id);
        const joinRemoved = await join(ev.id);
        record(
          names.msgd,
          going.ok &&
            availBefore.ok &&
            availBefore.rows[0].ok === false &&
            !joinBefore.ok &&
            joinBefore.message === "no_thread" &&
            !!thread &&
            availGoing.ok &&
            availGoing.rows[0].ok === true &&
            joinGoing.ok &&
            joinGoing.rows[0].t === thread &&
            joinAgain.ok &&
            joinAgain.rows[0].t === thread &&
            availNeither.ok &&
            availNeither.rows[0].ok === false &&
            !joinNeither.ok &&
            joinNeither.message === "not_going" &&
            accepted.ok &&
            joinParty.ok &&
            joinParty.rows[0].t === thread &&
            left.ok &&
            joinBack.ok &&
            joinBack.rows[0].t === thread &&
            firstWrite.ok &&
            secondWrite.ok &&
            thirdWrite.ok &&
            maxGoing > 0 &&
            seqGoing === maxGoing &&
            maxParty > maxGoing &&
            seqParty === maxParty &&
            maxBack > maxParty &&
            seqBack === maxBack &&
            removed.ok &&
            availRemoved.ok &&
            availRemoved.rows[0].ok === false &&
            !joinRemoved.ok &&
            joinRemoved.message === "not_a_member",
          "rsvp " +
            fmt(going) +
            "; before open: available " +
            word(availBefore) +
            ", join " +
            fmt(joinBefore) +
            "; open " +
            fmt(opened) +
            "; going: available " +
            word(availGoing) +
            ", join " +
            (joinGoing.ok ? (joinGoing.rows[0].t === thread ? "same" : "other") : fmt(joinGoing)) +
            ", again " +
            (joinAgain.ok ? (joinAgain.rows[0].t === thread ? "same" : "other") : fmt(joinAgain)) +
            "; neither: available " +
            word(availNeither) +
            ", join " +
            fmt(joinNeither) +
            "; party " +
            fmt(accepted) +
            ", join " +
            fmt(joinParty) +
            "; leave " +
            fmt(left) +
            ", rejoin " +
            fmt(joinBack) +
            "; joined_seq against the highest seq: going " +
            seqGoing +
            "/" +
            maxGoing +
            ", party " +
            seqParty +
            "/" +
            maxParty +
            ", rejoin " +
            seqBack +
            "/" +
            maxBack +
            " (host writes " +
            [firstWrite, secondWrite, thirdWrite].map(fmt).join(", ") +
            ")" +
            "; remove " +
            fmt(removed) +
            ", available " +
            word(availRemoved) +
            ", join " +
            fmt(joinRemoved),
        );
      });

      // 2. Recover (1341).
      await inTransaction(client, async () => {
        const thirdId = await thirdMember();
        if (!thirdId) {
          skip(names.msgdRecover, "live_arms_admin_member() answered no third member");
          return;
        }
        await actAs(client, owner.id);
        const req = await attempt(
          client,
          "select id from public.messenger_request_send($1::uuid, $2)",
          [member.id, "A request the live arms decline and recover"],
        );
        if (!req.ok) {
          record(names.msgdRecover, false, "request " + fmt(req));
          return;
        }
        const id = req.rows[0].id;
        const read = async () => {
          await actAsSelf(client);
          return attempt(
            client,
            "select state, decided_at from public.message_requests where id = $1::uuid",
            [id],
          );
        };
        await actAs(client, member.id);
        const declined = await attempt(
          client,
          "select public.messenger_request_decline($1::uuid)",
          [id],
        );
        const before = await read();
        await actAs(client, thirdId);
        const foreign = await attempt(client, "select public.messenger_request_recover($1::uuid)", [
          id,
        ]);
        await actAs(client, member.id);
        const recovered = await attempt(
          client,
          "select public.messenger_request_recover($1::uuid)",
          [id],
        );
        const after = await read();
        await actAs(client, member.id);
        const again = await attempt(client, "select public.messenger_request_recover($1::uuid)", [
          id,
        ]);
        record(
          names.msgdRecover,
          declined.ok &&
            before.ok &&
            before.rows[0].state === "declined" &&
            before.rows[0].decided_at !== null &&
            !foreign.ok &&
            foreign.message === "not_your_request" &&
            recovered.ok &&
            after.ok &&
            after.rows[0].state === "pending" &&
            after.rows[0].decided_at === null &&
            !again.ok &&
            again.message === "not_declined",
          "decline " +
            fmt(declined) +
            "; before " +
            word(before) +
            "; third " +
            fmt(foreign) +
            "; recover " +
            fmt(recovered) +
            "; after " +
            word(after) +
            "; again " +
            fmt(again),
        );
      });

      // 3. Rename (1387).
      await inTransaction(client, async () => {
        const thirdId = await thirdMember();
        if (!thirdId) {
          skip(names.msgdRename, "live_arms_admin_member() answered no third member");
          return;
        }
        const group = await openGroup(thirdId, "Live arms rename");
        if (!group.ok) {
          if (group.step === "connect")
            skip(names.msgdRename, "could not connect the group's members (1581): " + group.why);
          else record(names.msgdRename, false, group.step + " " + fmt(group.r));
          return;
        }
        const g = group.thread;
        const rename = (thread, name) =>
          attempt(client, "select public.messenger_thread_rename($1::uuid, $2)", [thread, name]);
        const nameOf = () =>
          attempt(
            client,
            "select name from public.messenger_threads_view where thread_id = $1::uuid",
            [g],
          );
        await actAs(client, owner.id);
        const role = await attempt(
          client,
          "select public.messenger_thread_set_role($1::uuid, $2::uuid, 'co_lead')",
          [g, member.id],
        );
        const byLead = await rename(g, "  Renamed by the lead  ");
        const leadName = await nameOf();
        const long = await rename(g, "x".repeat(81));
        await actAs(client, member.id);
        const byCoLead = await rename(g, "Renamed by the co-lead");
        const coLeadName = await nameOf();
        await actAs(client, thirdId);
        const byMember = await rename(g, "Renamed by a member");
        const ev = await publishEvent("41-D rename arm");
        let byEvent = { ok: false, code: "-", message: "no event" };
        if (ev.ok) {
          const opened = await attempt(
            client,
            "select public.messenger_event_thread_open($1::uuid) as t",
            [ev.id],
          );
          byEvent = opened.ok ? await rename(opened.rows[0].t, "An event thread") : opened;
        }
        record(
          names.msgdRename,
          role.ok &&
            byLead.ok &&
            leadName.ok &&
            leadName.rows[0].name === "Renamed by the lead" &&
            byCoLead.ok &&
            coLeadName.ok &&
            coLeadName.rows[0].name === "Renamed by the co-lead" &&
            !byMember.ok &&
            byMember.message === "not_a_lead" &&
            !long.ok &&
            long.message === "bad_name" &&
            !byEvent.ok &&
            byEvent.message === "not_renamable",
          "co_lead " +
            fmt(role) +
            "; lead " +
            fmt(byLead) +
            " reads " +
            word(leadName) +
            "; 81 " +
            fmt(long) +
            "; co-lead " +
            fmt(byCoLead) +
            " reads " +
            word(coLeadName) +
            "; member " +
            fmt(byMember) +
            "; event thread " +
            fmt(byEvent),
        );
      });

      // 4. The list's last author, and a blocked one skipped (held item 4; 1386).
      await inTransaction(client, async () => {
        const thirdId = await thirdMember();
        if (!thirdId) {
          skip(names.msgdView, "live_arms_admin_member() answered no third member");
          return;
        }
        const group = await openGroup(thirdId, "Live arms last line");
        if (!group.ok) {
          if (group.step === "connect")
            skip(names.msgdView, "could not connect the group's members (1581): " + group.why);
          else record(names.msgdView, false, group.step + " " + fmt(group.r));
          return;
        }
        const g = group.thread;
        await actAs(client, owner.id);
        const fromOwner = await send(g, uuid(), "From the owner");
        await actAs(client, thirdId);
        const fromThird = await send(g, uuid(), "From the third");
        const row = () =>
          attempt(
            client,
            "select last_line, last_author_id, last_author_name, unread from public.messenger_threads_view where thread_id = $1::uuid",
            [g],
          );
        await actAs(client, member.id);
        const read = fromOwner.ok
          ? await attempt(client, "select public.messenger_read_to($1::uuid, $2::bigint)", [
              g,
              fromOwner.rows[0].seq,
            ])
          : fromOwner;
        const names3 = await attempt(
          client,
          "select author_id, author_name from public.messenger_messages_view where thread_id = $1::uuid and author_id in ($2::uuid, $3::uuid)",
          [g, owner.id, thirdId],
        );
        const nameFor = (id) =>
          names3.ok ? (names3.rows.find((r) => r.author_id === id) || {}).author_name : undefined;
        const before = await row();
        const block = await attempt(
          client,
          "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
          [member.id, thirdId],
        );
        const after = await row();
        const b = before.ok ? before.rows[0] : null;
        const a = after.ok ? after.rows[0] : null;
        record(
          names.msgdView,
          fromOwner.ok &&
            fromThird.ok &&
            read.ok &&
            !!b &&
            b.last_line === "From the third" &&
            b.last_author_id === thirdId &&
            !!nameFor(thirdId) &&
            b.last_author_name === nameFor(thirdId) &&
            b.unread === true &&
            block.ok &&
            !!a &&
            a.last_line === "From the owner" &&
            a.last_author_id === owner.id &&
            a.last_author_name === nameFor(owner.id) &&
            a.unread === false,
          "sends " +
            fmt(fromOwner) +
            ", " +
            fmt(fromThird) +
            "; read_to " +
            fmt(read) +
            "; before " +
            word(before) +
            "; block " +
            fmt(block) +
            "; after " +
            word(after),
        );
      });

      // 5. Media words for a member who does not own the media (held item 5).
      await inTransaction(client, async () => {
        const thirdId = await thirdMember();
        if (!thirdId) {
          skip(names.msgdWord, "live_arms_admin_member() answered no third member");
          return;
        }
        const pair = await openPair();
        if (!pair.ok) {
          record(names.msgdWord, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const image = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "image/jpeg",
          1024,
          10,
          10,
        );
        const video = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "video/mp4",
          4096,
          16,
          9,
        );
        const sendMedia = (media) =>
          attempt(
            client,
            "select id from public.messenger_send($1::uuid, $2::uuid, null, 'media', null, $3::uuid)",
            [pair.thread, uuid(), media],
          );
        const imageMsg = image.ok ? await sendMedia(image.rows[0].id) : image;
        const reply = imageMsg.ok
          ? await attempt(
              client,
              "select id from public.messenger_send($1::uuid, $2::uuid, 'A reply to the image', 'text', $3::uuid)",
              [pair.thread, uuid(), imageMsg.rows[0].id],
            )
          : imageMsg;
        const videoMsg = video.ok ? await sendMedia(video.rows[0].id) : video;
        await actAs(client, member.id);
        const list = await attempt(
          client,
          "select last_line from public.messenger_threads_view where thread_id = $1::uuid",
          [pair.thread],
        );
        const msgs = await attempt(
          client,
          "select message_id, media_word, reply_to from public.messenger_messages_view where thread_id = $1::uuid",
          [pair.thread],
        );
        const byId = (id) => (msgs.ok ? msgs.rows.find((r) => r.message_id === id) : undefined);
        const im = imageMsg.ok ? byId(imageMsg.rows[0].id) : undefined;
        const vm = videoMsg.ok ? byId(videoMsg.rows[0].id) : undefined;
        const rp = reply.ok ? byId(reply.rows[0].id) : undefined;
        await actAs(client, thirdId);
        const outside = image.ok
          ? await attempt(client, "select private.messenger_media_word($1::uuid) as w", [
              image.rows[0].id,
            ])
          : image;
        record(
          names.msgdWord,
          videoMsg.ok &&
            list.ok &&
            list.rows[0].last_line === "Video" &&
            !!im &&
            im.media_word === "Image" &&
            !!vm &&
            vm.media_word === "Video" &&
            !!rp &&
            rp.media_word === null &&
            !!rp.reply_to &&
            rp.reply_to.line === "Image" &&
            outside.ok &&
            outside.rows[0].w === null,
          "list " +
            word(list) +
            "; image " +
            JSON.stringify(im && im.media_word) +
            "; video " +
            JSON.stringify(vm && vm.media_word) +
            "; reply line " +
            JSON.stringify(rp && rp.reply_to && rp.reply_to.line) +
            "; non-member " +
            word(outside),
        );
      });

      // 6. video/quicktime records (1396).
      await inTransaction(client, async () => {
        const pair = await openPair();
        if (!pair.ok) {
          record(names.msgdQuicktime, false, pair.step + " " + fmt(pair.r));
          return;
        }
        await actAs(client, owner.id);
        const mov = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "video/quicktime",
          4096,
          1920,
          1080,
        );
        const avi = await recordMedia(
          pair.thread,
          mediaKey(pair.thread),
          "video/x-msvideo",
          4096,
          1920,
          1080,
        );
        record(
          names.msgdQuicktime,
          mov.ok &&
            mov.rows[0].mime === "video/quicktime" &&
            mov.rows[0].optimized === false &&
            !avi.ok &&
            avi.message === "bad_media",
          "quicktime " +
            (mov.ok ? JSON.stringify(mov.rows[0].mime) : fmt(mov)) +
            "; avi " +
            fmt(avi),
        );
      });

      // 7. The request broadcast (Addendum 1, A6; 157, G197). private.message_requests_broadcast
      // writes through realtime.send into realtime.messages, which is partitioned by day and which
      // a member reads under messenger_topics_select for the topic the session names in
      // realtime.topic. So the arm reads each inbox as its own member, inside the transaction that
      // wrote the rows, and observes the sends themselves rather than the function's text. The
      // accept is the positive control: the sender's inbox does receive a broadcast.
      await inTransaction(client, async () => {
        await actAs(client, owner.id);
        const req = await attempt(
          client,
          "select id from public.messenger_request_send($1::uuid, $2)",
          [member.id, "A request the live arms decline, recover and accept"],
        );
        if (!req.ok) {
          record(names.msgdBroadcast, false, "request " + fmt(req));
          return;
        }
        const id = req.rows[0].id;
        await actAs(client, member.id);
        const declined = await attempt(
          client,
          "select public.messenger_request_decline($1::uuid)",
          [id],
        );
        const recovered = await attempt(
          client,
          "select public.messenger_request_recover($1::uuid)",
          [id],
        );
        const accepted = await attempt(client, "select public.messenger_request_accept($1::uuid)", [
          id,
        ]);
        /** The states the request's broadcasts carried on one inbox, read as that inbox's member and sorted, since every row in one transaction shares inserted_at. */
        const inbox = async (who) => {
          await actAs(client, who);
          await client.query("select set_config('realtime.topic', $1, true)", ["inbox:" + who]);
          const r = await attempt(
            client,
            "select payload->>'state' as state from realtime.messages where topic = $1 and event = 'request' and payload->>'id' = $2 order by 1",
            ["inbox:" + who, id],
          );
          return r.ok ? r.rows.map((x) => x.state) : fmt(r);
        };
        const toRecipient = await inbox(member.id);
        const toSender = await inbox(owner.id);
        // The accept writes the request row more than once, so the arm counts the states that carry
        // the ruling rather than the rows: the recipient sees the decline and both pendings (the
        // insert and the recovery); the sender sees one pending (the insert), never a decline, and the
        // accept as the positive control.
        const count = (a, state) => (Array.isArray(a) ? a.filter((x) => x === state).length : -1);
        record(
          names.msgdBroadcast,
          declined.ok &&
            recovered.ok &&
            accepted.ok &&
            count(toRecipient, "declined") === 1 &&
            count(toRecipient, "pending") === 2 &&
            count(toRecipient, "accepted") >= 1 &&
            count(toSender, "declined") === 0 &&
            count(toSender, "pending") === 1 &&
            count(toSender, "accepted") >= 1,
          "decline " +
            fmt(declined) +
            "; recover " +
            fmt(recovered) +
            "; accept " +
            fmt(accepted) +
            "; recipient's inbox " +
            JSON.stringify(toRecipient) +
            "; sender's inbox " +
            JSON.stringify(toSender),
        );
      });
    }

    // Brief 12 12B (SPEC-40-12B Part B, handoff 45-B; 20261002140000). The Overview's five
    // projections and DIA's note cache. Every arm opens with the same presence probe so that before
    // the apply the block reports UNPROVEN as a whole (G143, 228). The projections are executable by
    // authenticated, which the arms set as the admin persona at aal2 exactly as the 12A arms do; the
    // read log is read only as a count through private.admin_reads_count (382). Each arm is its own
    // rolled-back transaction, so a grant, a fixture row or a cached note is gone before the next.
    // ------------------------------------------------------------------------------------------
    const WINDOW_FN = "public.admin_overview_window(text, text, text)";
    const overviewPresent = async () => {
      await actAsSelf(client);
      const present = await client.query("select to_regprocedure($1) is not null as ok", [
        WINDOW_FN,
      ]);
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    // Each projection with the arguments it takes: the period ones take grain, comparison and zone;
    // the network takes the zone alone; the company lines take nothing.
    const PROJECTIONS = [
      ["admin_overview_window", "select public.admin_overview_window($1, $2, $3) as j", 3],
      [
        "admin_overview_mobilization",
        "select public.admin_overview_mobilization($1, $2, $3) as j",
        3,
      ],
      ["admin_overview_levers", "select public.admin_overview_levers($1, $2, $3) as j", 3],
      ["admin_overview_network", "select public.admin_overview_network($1) as j", 1],
      ["admin_overview_company", "select public.admin_overview_company() as j", 0],
    ];
    const WEEK = ["week", "previous", "America/Los_Angeles"];
    const callAll = async (args = WEEK) => {
      const out = {};
      for (const [name, sql, arity] of PROJECTIONS)
        out[name] = await attempt(client, sql, arity === 3 ? args : arity === 1 ? [args[2]] : []);
      return out;
    };
    const readsCount = async (actor, projection) => {
      const r = await client.query("select private.admin_reads_count($1::uuid, $2) as n", [
        actor,
        projection,
      ]);
      return r.rows[0].n;
    };
    /** The parts of a moment in a zone, as the viewer's clock would show them. */
    const inZone = (iso, tz) => {
      const parts = {};
      for (const p of new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(iso)))
        parts[p.type] = p.value;
      return parts.weekday + " " + parts.hour + ":" + parts.minute;
    };
    if (!(await overviewPresent())) {
      for (const n of armsOf("overview"))
        skip(n, "20261002140000_b12b_overview.sql is not on the project yet");
    } else {
      // 1. The gate (SPEC arm 1): anon, a member with no role at aal2, the admin at aal1 are refused;
      // the admin at aal2 and an analyst at aal2 are answered. The analyst is member-test, granted
      // the role by the admin inside this transaction (1177) and released by the rollback.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId || adminId === member.id) {
          skip(names.overview, adminId ? "the admin persona is member-test" : "no admin");
          return;
        }
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const anonAll = await callAll();
        await actAs(client, member.id, "aal2");
        const noRoleAll = await callAll();
        await actAs(client, adminId, "aal1");
        const aal1All = await callAll();
        await actAs(client, adminId, "aal2");
        const adminAll = await callAll();
        const granted = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: analyst opens the Overview (1311)') as id",
          [member.id],
        );
        await actAs(client, member.id, "aal2");
        const analystAll = await callAll();
        const refusedWith = (all) =>
          PROJECTIONS.every(([n]) => !all[n].ok && all[n].code === "42501");
        const answered = (all) =>
          PROJECTIONS.every(([n]) => all[n].ok && all[n].rows[0] && all[n].rows[0].j);
        const say = (label, all) =>
          label +
          " " +
          PROJECTIONS.map(([n]) => n.replace("admin_overview_", "") + ":" + fmt(all[n])).join(",");
        record(
          names.overview,
          refusedWith(anonAll) &&
            refusedWith(noRoleAll) &&
            refusedWith(aal1All) &&
            answered(adminAll) &&
            granted.ok &&
            answered(analystAll),
          [
            say("anon", anonAll),
            say("no role aal2", noRoleAll),
            say("admin aal1", aal1All),
            say("admin aal2", adminAll),
            "grant " + fmt(granted),
            say("analyst aal2", analystAll),
          ].join("; "),
        );
      });

      // 2. The log (SPEC arm 2, 1178): one admin_reads row per call, naming the projection.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewLog, "no admin");
          return;
        }
        await actAsSelf(client);
        const before = {};
        for (const [n] of PROJECTIONS) before[n] = await readsCount(adminId, n);
        await actAs(client, adminId, "aal2");
        const all = await callAll();
        await actAsSelf(client);
        const after = {};
        for (const [n] of PROJECTIONS) after[n] = await readsCount(adminId, n);
        const deltas = PROJECTIONS.map(([n]) => [n, after[n] - before[n]]);
        record(
          names.overviewLog,
          PROJECTIONS.every(([n]) => all[n].ok) && deltas.every(([, d]) => d === 1),
          deltas.map(([n, d]) => n.replace("admin_overview_", "") + " +" + d).join(", "),
        );
      });

      // 3. No member (SPEC arm 3, 1281): the JSON of every projection, at two grains, carries no
      // uuid, no test-account handle or name, and no key that names a person.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewNoMember, "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const week = await callAll();
        const year = await callAll(["year", "last_year", "Africa/Accra"]);
        const text = JSON.stringify([week, year]);
        const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const people = [owner.handle, member.handle, owner.name, member.name].filter(Boolean);
        const named = people.filter((p) => text.includes(p));
        const keys = new Set();
        const walk = (v) => {
          if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === "object")
            for (const [k, x] of Object.entries(v)) {
              keys.add(k);
              walk(x);
            }
        };
        for (const all of [week, year])
          for (const [n] of PROJECTIONS) if (all[n].ok) walk(all[n].rows[0].j);
        const personKeys = [...keys].filter((k) =>
          /member_id|handle|avatar|^name$|display_name|email/i.test(k),
        );
        record(
          names.overviewNoMember,
          PROJECTIONS.every(([n]) => week[n].ok && year[n].ok) &&
            !uuid.test(text) &&
            named.length === 0 &&
            personKeys.length === 0,
          "uuid " +
            (uuid.test(text) ? "found" : "none") +
            "; names " +
            (named.length ? named.join(",") : "none") +
            "; person keys " +
            (personKeys.length ? personKeys.join(",") : "none") +
            "; " +
            keys.size +
            " distinct keys read",
        );
      });

      // 4. Whether a comparison exists is computed (SPEC arm 4, 1310): the same period last year ends
      // before the network's first record and answers null with the reason and the moment; this week
      // against last week answers a window.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewComparison, "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const ly = await attempt(
          client,
          "select public.admin_overview_window('week', 'last_year', 'America/Los_Angeles') as j",
        );
        const prev = await attempt(
          client,
          "select public.admin_overview_window('week', 'previous', 'America/Los_Angeles') as j",
        );
        const lyJ = ly.ok ? ly.rows[0].j : {};
        const prevJ = prev.ok ? prev.rows[0].j : {};
        record(
          names.overviewComparison,
          ly.ok &&
            lyJ.comparison === null &&
            lyJ.comparison_reason === "before_first_record" &&
            typeof lyJ.first_record === "string" &&
            prev.ok &&
            prevJ.comparison &&
            typeof prevJ.comparison.start === "string" &&
            prevJ.comparison_reason === null &&
            new Date(prevJ.comparison.end) > new Date(prevJ.first_record),
          "last year: " +
            (ly.ok
              ? JSON.stringify(lyJ.comparison) +
                " " +
                lyJ.comparison_reason +
                " first " +
                lyJ.first_record
              : fmt(ly)) +
            "; previous: " +
            (prev.ok ? JSON.stringify(prevJ.comparison) : fmt(prev)),
        );
      });

      // 5. Weeks start Monday 00:00 in the zone (SPEC arm 5, 1304, 1305), and an unknown zone is 22023.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewWeek, "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const la = await attempt(
          client,
          "select public.admin_overview_window('week', 'previous', 'America/Los_Angeles') as j",
        );
        const accra = await attempt(
          client,
          "select public.admin_overview_window('week', 'previous', 'Africa/Accra') as j",
        );
        const bad = await attempt(
          client,
          "select public.admin_overview_window('week', 'previous', 'Mars/Olympus_Mons') as j",
        );
        const laStart = la.ok ? la.rows[0].j.period.start : null;
        const accraStart = accra.ok ? accra.rows[0].j.period.start : null;
        record(
          names.overviewWeek,
          la.ok &&
            accra.ok &&
            inZone(laStart, "America/Los_Angeles") === "Mon 00:00" &&
            inZone(accraStart, "Africa/Accra") === "Mon 00:00" &&
            laStart !== accraStart &&
            !bad.ok &&
            bad.code === "22023",
          "LA " +
            (la.ok
              ? laStart + " = " + inZone(laStart, "America/Los_Angeles") + " Pacific"
              : fmt(la)) +
            "; Accra " +
            (accra.ok
              ? accraStart + " = " + inZone(accraStart, "Africa/Accra") + " GMT"
              : fmt(accra)) +
            "; unknown zone " +
            fmt(bad),
        );
      });

      // B-a (1365). member-test is onboarded 45 minutes ago (live_arms may update onboarded_at on
      // the test accounts, r382); with no act since, the trailing hour's Time to first act is null
      // and counts nobody. An event attestation accepted now, derived into the ledger by the
      // derivation the arms may run, is the member's first act, and the median reads that member's
      // days: under one, so 0.0 at the projection's tenth of a day.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId || adminId === member.id) {
          skip(names.overviewFirstAct, adminId ? "the admin persona is member-test" : "no admin");
          return;
        }
        await actAsSelf(client);
        const onboarded = await attempt(
          client,
          "update public.members set onboarded_at = now() - interval '45 minutes' where id = $1::uuid",
          [member.id],
        );
        const read = async () => {
          await actAs(client, adminId, "aal2");
          const r = await attempt(
            client,
            "select public.admin_overview_levers('now', 'previous', 'America/Los_Angeles') -> 'time_to_first_act' as t",
          );
          await actAsSelf(client);
          return r.ok ? r.rows[0].t : r;
        };
        const noAct = await read();
        const ins = await attempt(
          client,
          `insert into public.attestations (member_id, c_category, object_kind, object_id, attester_member_id, attester_role, accepted_at)
           values ($1, 'convene', 'event', gen_random_uuid(), $2, 'host', now()) returning id`,
          [member.id, owner.id],
        );
        const derived = await attempt(
          client,
          "select private.derive_mobilization_v1(now() - interval '5 minutes', now() + interval '5 minutes') as n",
        );
        const withAct = await read();
        record(
          names.overviewFirstAct,
          onboarded.ok &&
            noAct &&
            noAct.value === null &&
            noAct.members_counted === 0 &&
            ins.ok &&
            derived.ok &&
            withAct &&
            withAct.value === 0 &&
            withAct.members_counted >= 1,
          "no act: " +
            JSON.stringify(noAct) +
            "; attestation " +
            fmt(ins) +
            "; derive " +
            (derived.ok ? derived.rows[0].n + " rows" : fmt(derived)) +
            "; with act: " +
            JSON.stringify(withAct),
        );
      });

      // B-b (1362 to 1364): what is not connected answers null with not_connected, never a figure.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewNotConnected, "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const all = await callAll();
        const lev = all.admin_overview_levers.ok ? all.admin_overview_levers.rows[0].j : {};
        const net = all.admin_overview_network.ok ? all.admin_overview_network.rows[0].j : {};
        const mob = all.admin_overview_mobilization.ok
          ? all.admin_overview_mobilization.rows[0].j
          : {};
        const co = all.admin_overview_company.ok ? all.admin_overview_company.rows[0].j : {};
        const nc = (x) => !!x && x.value === null && x.status === "not_connected";
        const src = (k) => (mob.source || []).find((s) => s.key === k);
        const ob = lev.onboarding || {};
        const steps = ["who", "where", "relationship"];
        const checks = {
          invites: nc(lev.invites),
          story_led: nc(lev.story_led),
          // 1615: Started and the drop-off are connected now, from members and never from the log.
          onboarding_started:
            !!ob.started &&
            ob.started.status === "connected" &&
            typeof ob.started.value === "number" &&
            Array.isArray(ob.started.series),
          onboarding_drop_off:
            !!ob.drop_off &&
            ob.drop_off.status === "connected" &&
            !!ob.drop_off.by_step &&
            steps.every((s) => typeof ob.drop_off.by_step[s] === "number"),
          admitted: nc(net.admitted),
          source_partner: nc(src("partner")),
          source_dna_system: nc(src("dna_system")),
          company: ["partnerships", "newsletter", "revenue", "chapters"].every(
            (k) => co[k] && co[k].status === "not_connected",
          ),
          time_to_first_act_connected:
            !!lev.time_to_first_act && lev.time_to_first_act.status === "connected",
        };
        const failedChecks = Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([k]) => k);
        record(
          names.overviewNotConnected,
          PROJECTIONS.every(([n]) => all[n].ok) && failedChecks.length === 0,
          failedChecks.length
            ? "not as ruled: " + failedChecks.join(", ")
            : Object.keys(checks).length + " checks as ruled",
        );
      });

      // 12C part 2 (1364, 1615): Started and the drop-off on seeded rows. live_arms may update
      // members.onboarded_at and who_completed_at and nothing else (its column grants), so the seed
      // is made with those two: member-test loses both and is on `who`, owner-test loses
      // onboarded_at and is on `relationship`. Both were created this year, so under the year grain
      // both count as started, and the drop-off's who and relationship each rise by one against a
      // read taken before the seed. The rollback returns both accounts to where they were.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewOnboarding, "no admin");
          return;
        }
        const readOnboarding = async () => {
          await actAs(client, adminId, "aal2");
          const r = await attempt(
            client,
            "select public.admin_overview_levers('year', 'previous', 'America/Los_Angeles') -> 'onboarding' as o",
          );
          await actAsSelf(client);
          return r.ok ? r.rows[0].o : r;
        };
        const before = await readOnboarding();
        const seedWho = await attempt(
          client,
          "update public.members set who_completed_at = null, onboarded_at = null where id = $1::uuid",
          [member.id],
        );
        const seedRelationship = await attempt(
          client,
          "update public.members set onboarded_at = null where id = $1::uuid",
          [owner.id],
        );
        const after = await readOnboarding();
        const step = (o, s) =>
          o && o.drop_off && o.drop_off.by_step ? o.drop_off.by_step[s] : null;
        const started = after && after.started ? after.started : null;
        const drop = after && after.drop_off ? after.drop_off : null;
        record(
          names.overviewOnboarding,
          seedWho.ok &&
            seedRelationship.ok &&
            !!before &&
            !!started &&
            started.status === "connected" &&
            started.value >= 2 &&
            Array.isArray(started.series) &&
            !!drop &&
            drop.status === "connected" &&
            step(after, "who") === step(before, "who") + 1 &&
            step(after, "relationship") === step(before, "relationship") + 1 &&
            typeof step(after, "where") === "number",
          "seed who " +
            fmt(seedWho) +
            "; seed relationship " +
            fmt(seedRelationship) +
            "; before " +
            JSON.stringify(before && before.drop_off ? before.drop_off : before) +
            "; after started " +
            JSON.stringify(started && { value: started.value, status: started.status }) +
            " drop_off " +
            JSON.stringify(drop),
        );
      });

      // DIA's cache (SPEC Part D item 4): null, then the statements written, then a refusal.
      // Keyed on its own zone (handoff 45-C): the cache key carries the zone string, and
      // Etc/GMT+12 is the zone of no inhabited place, so no device reports it and no viewer's
      // Overview ever writes under it. A founder visit caches under their own zone and cannot make
      // the miss read a note; the arm's own write is rolled back with the transaction.
      const ARM_TZ = "Etc/GMT+12";
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.overviewCache, "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const miss = await attempt(
          client,
          "select public.admin_dia_note_read('week', 'previous', $1) as j",
          [ARM_TZ],
        );
        const statements = [{ text: "Mobilized members rose this period.", block: "Mobilization" }];
        const wrote = await attempt(
          client,
          "select public.admin_dia_note_write('week', 'previous', $1, $2::jsonb)",
          [ARM_TZ, JSON.stringify(statements)],
        );
        const hit = await attempt(
          client,
          "select public.admin_dia_note_read('week', 'previous', $1) as j",
          [ARM_TZ],
        );
        const bad = await attempt(
          client,
          "select public.admin_dia_note_write('week', 'previous', $1, $2::jsonb)",
          [ARM_TZ, JSON.stringify({ x: 1 })],
        );
        const direct = await attempt(client, "select count(*) from public.admin_dia_notes");
        record(
          names.overviewCache,
          miss.ok &&
            miss.rows[0].j === null &&
            wrote.ok &&
            hit.ok &&
            hit.rows[0].j &&
            JSON.stringify(hit.rows[0].j.statements) === JSON.stringify(statements) &&
            !bad.ok &&
            bad.code === "22023" &&
            !direct.ok &&
            direct.code === "42501",
          "miss " +
            (miss.ok ? JSON.stringify(miss.rows[0].j) : fmt(miss)) +
            "; write " +
            fmt(wrote) +
            "; hit " +
            (hit.ok ? JSON.stringify(hit.rows[0].j && hit.rows[0].j.statements) : fmt(hit)) +
            "; non-array " +
            fmt(bad) +
            "; direct select " +
            fmt(direct),
        );
      });
    }

    // Brief 12 Settings (handoff 45-D Part A; 20261003120000). The vocabularies, the staff member's
    // own row, the company's row with its admin_actions trail, the two logged reads and the sessions
    // read. One presence probe for the block, so before the apply every arm reports UNPROVEN (G143,
    // 228). Each arm is its own rolled-back transaction; the admin_actions trail is read only as a
    // count through private.admin_org_actions_count (382), as the read log is through
    // private.admin_reads_count.
    // ------------------------------------------------------------------------------------------
    const settingsPresent = async () => {
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('public.admin_staff_settings_read()') is not null as ok",
      );
      return !!present.rows[0] && present.rows[0].ok === true;
    };
    /** actAs, with the session_id claim Supabase Auth writes into every access token. */
    const actWithSession = async (uid, aal, sessionId) => {
      await client.query("set local role authenticated");
      const c = { sub: uid, role: "authenticated", aud: "authenticated", aal };
      if (sessionId) c.session_id = sessionId;
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(c)]);
    };
    const orgCount = async (setting) => {
      await actAsSelf(client);
      const r = await client.query("select private.admin_org_actions_count($1) as n", [setting]);
      return r.rows[0].n;
    };
    if (!(await settingsPresent())) {
      for (const n of armsOf("settings"))
        skip(n, "20261003120000_b12s_admin_settings.sql is not on the project yet");
    } else {
      // 1. The vocabularies and the zone guard.
      await inTransaction(client, async () => {
        await actAs(client, member.id, "aal1");
        const v = await attempt(client, "select public.vocabularies() as v");
        const voc = v.ok ? v.rows[0].v : {};
        const values = (k) => (Array.isArray(voc[k]) ? voc[k].map((r) => r.value) : []);
        const zones = Array.isArray(voc.reporting_zones) ? voc.reporting_zones : [];
        await actAsSelf(client);
        const known = await client.query(
          "select count(*)::int as n from pg_catalog.pg_timezone_names where name = any($1::text[])",
          [zones.map((z) => z.value)],
        );
        const bad = await attempt(
          client,
          "insert into public.reporting_zones (value, name, city, abbreviation, position) values ('Mars/Olympus_Mons', 'Mars time', 'Olympus Mons', 'MT', 32000)",
        );
        record(
          names.settings,
          v.ok &&
            values("admin_appearances").join(",") === "system,light,dark" &&
            values("overview_grains").join(",") === "now,hour,day,week,month,quarter,year" &&
            values("overview_comparisons").join(",") === "previous,last_year" &&
            zones.length >= 7 &&
            zones.every((z) => z.name && z.city && z.abbreviation) &&
            known.rows[0].n === zones.length &&
            !bad.ok &&
            bad.code === "22023",
          [
            "appearances " + values("admin_appearances").join(","),
            "grains " + values("overview_grains").join(","),
            "comparisons " + values("overview_comparisons").join(","),
            "zones " + zones.map((z) => z.value).join(","),
            "known " + known.rows[0].n,
            "unknown zone " + fmt(bad),
          ].join("; "),
        );
      });

      // 2. The staff member's own row: read, change, and nobody else's; refusals otherwise.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId || adminId === member.id) {
          skip(names.settingsPersonal, adminId ? "the admin persona is member-test" : "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const granted = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: Settings, a second staff member') as id",
          [member.id],
        );
        // The analyst's row first, so the admin's change below can be shown not to reach it.
        await actAs(client, member.id, "aal2");
        const otherBefore = await attempt(client, "select public.admin_staff_settings_read() as j");
        await actAs(client, adminId, "aal2");
        const read = await attempt(client, "select public.admin_staff_settings_read() as j");
        const saved = await attempt(
          client,
          "select public.admin_staff_settings_save($1::jsonb) as j",
          [
            JSON.stringify({
              appearance: "dark",
              reading_zone: "Africa/Lagos",
              default_grain: "month",
            }),
          ],
        );
        const back = await attempt(client, "select public.admin_staff_settings_read() as j");
        const badZone = await attempt(
          client,
          "select public.admin_staff_settings_save($1::jsonb) as j",
          [JSON.stringify({ reading_zone: "Mars/Olympus_Mons" })],
        );
        await actAs(client, member.id, "aal2");
        const otherAfter = await attempt(client, "select public.admin_staff_settings_read() as j");
        await actAs(client, adminId, "aal1");
        const aal1 = await attempt(client, "select public.admin_staff_settings_read() as j");
        await actAs(client, adminId, "aal1");
        const aal1Save = await attempt(
          client,
          'select public.admin_staff_settings_save(\'{"appearance":"light"}\'::jsonb) as j',
        );
        // member-test with no role: the grant above is revoked again inside this transaction.
        await actAs(client, adminId, "aal2");
        const revoked = await attempt(
          client,
          "select public.admin_revoke_role($1::uuid, 'analyst', 'live arm: back to no role') as id",
          [member.id],
        );
        await actAs(client, member.id, "aal2");
        const noRole = await attempt(client, "select public.admin_staff_settings_read() as j");
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', '', true)");
        const anon = await attempt(client, "select public.admin_staff_settings_read() as j");
        await actAs(client, adminId, "aal2");
        const table = await attempt(client, "select count(*) from public.admin_staff_settings");
        const j = (r) => (r.ok && r.rows[0] ? r.rows[0].j : null);
        const refused = (r) => !r.ok && r.code === "42501";
        record(
          names.settingsPersonal,
          granted.ok &&
            !!j(read) &&
            j(saved) &&
            j(saved).appearance === "dark" &&
            j(saved).reading_zone === "Africa/Lagos" &&
            j(saved).default_grain === "month" &&
            j(back) &&
            j(back).appearance === "dark" &&
            !badZone.ok &&
            badZone.code === "22023" &&
            JSON.stringify(j(otherBefore)) === JSON.stringify(j(otherAfter)) &&
            refused(aal1) &&
            refused(aal1Save) &&
            revoked.ok &&
            refused(noRole) &&
            refused(anon) &&
            refused(table),
          [
            "admin read " + JSON.stringify(j(read)),
            "saved " + JSON.stringify(j(saved)),
            "unknown zone " + fmt(badZone),
            "other staff before " +
              JSON.stringify(j(otherBefore)) +
              " after " +
              JSON.stringify(j(otherAfter)),
            "aal1 read " + fmt(aal1) + " save " + fmt(aal1Save),
            "no role " + fmt(noRole),
            "anon " + fmt(anon),
            "direct select " + fmt(table),
          ].join("; "),
        );
      });

      // 3. The company's row: every staff role reads; admin alone writes; one admin_actions row per
      // change with its before and after; none for a write that changes nothing.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId || adminId === member.id) {
          skip(names.settingsOrg, adminId ? "the admin persona is member-test" : "no admin");
          return;
        }
        await actAs(client, adminId, "aal2");
        const before = await attempt(client, "select public.admin_org_settings_read() as j");
        const granted = await attempt(
          client,
          "select public.admin_grant_role($1::uuid, 'analyst', 'live arm: Settings, an analyst reads') as id",
          [member.id],
        );
        await actAs(client, member.id, "aal2");
        const analystRead = await attempt(client, "select public.admin_org_settings_read() as j");
        const analystWrite = await attempt(
          client,
          "select public.admin_org_settings_save('{\"dia_note\":false}'::jsonb) as j",
        );
        const b = before.ok ? before.rows[0].j : null;
        const target = b && b.reporting_zone === "Africa/Accra" ? "Africa/Nairobi" : "Africa/Accra";
        const z0 = await orgCount("reporting_zone");
        const d0 = await orgCount("dia_note");
        await actAs(client, adminId, "aal2");
        const changed = await attempt(
          client,
          "select public.admin_org_settings_save($1::jsonb) as j",
          [JSON.stringify({ reporting_zone: target })],
        );
        const z1 = await orgCount("reporting_zone");
        await actAs(client, adminId, "aal2");
        const same = await attempt(
          client,
          "select public.admin_org_settings_save($1::jsonb) as j",
          [JSON.stringify({ reporting_zone: target, dia_note: b ? b.dia_note : true })],
        );
        const z2 = await orgCount("reporting_zone");
        const d2 = await orgCount("dia_note");
        // The row the change wrote, read through the change history as the admin.
        await actAs(client, adminId, "aal2");
        const hist = await attempt(client, "select public.admin_change_history(null, 5) as j");
        const top = hist.ok && hist.rows[0].j ? hist.rows[0].j.entries[0] : null;
        record(
          names.settingsOrg,
          before.ok &&
            granted.ok &&
            analystRead.ok &&
            !analystWrite.ok &&
            analystWrite.code === "42501" &&
            changed.ok &&
            changed.rows[0].j.reporting_zone === target &&
            z1 === z0 + 1 &&
            same.ok &&
            z2 === z1 &&
            d2 === d0 &&
            !!top &&
            top.setting === "reporting_zone" &&
            top.before === (b && b.reporting_zone) &&
            top.after === target &&
            typeof top.by === "string",
          [
            "before " + JSON.stringify(b),
            "analyst read " + fmt(analystRead) + " write " + fmt(analystWrite),
            "change to " +
              target +
              " " +
              fmt(changed) +
              ", reporting_zone rows " +
              z0 +
              " -> " +
              z1,
            "no-change write " +
              fmt(same) +
              ", rows " +
              z1 +
              " -> " +
              z2 +
              ", dia_note " +
              d0 +
              " -> " +
              d2,
            "history top " + JSON.stringify(top),
          ].join("; "),
        );
      });

      // 4a. The two logged reads.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.settingsLogs, "no admin");
          return;
        }
        await actAsSelf(client);
        const l0 = await readsCount(adminId, "admin_read_log");
        const h0 = await readsCount(adminId, "admin_change_history");
        await actAs(client, adminId, "aal2");
        const log = await attempt(client, "select public.admin_read_log(null, 3) as j");
        await actAs(client, adminId, "aal2");
        const hist = await attempt(client, "select public.admin_change_history(null, 3) as j");
        await actAsSelf(client);
        const l1 = await readsCount(adminId, "admin_read_log");
        const h1 = await readsCount(adminId, "admin_change_history");
        const newest = log.ok && log.rows[0].j ? log.rows[0].j.entries[0] : null;
        record(
          names.settingsLogs,
          log.ok &&
            hist.ok &&
            l1 === l0 + 1 &&
            h1 === h0 + 1 &&
            !!newest &&
            newest.projection === "admin_read_log" &&
            newest.page === "Settings" &&
            newest.block === "Your read log",
          "read log +" +
            (l1 - l0) +
            ", history +" +
            (h1 - h0) +
            "; newest " +
            JSON.stringify(newest),
        );
      });

      // 4b. The sessions read: no IP, and current is the JWT's session_id.
      await inTransaction(client, async () => {
        const adminId = await adminMember();
        if (!adminId) {
          skip(names.settingsSessions, "no admin");
          return;
        }
        await actWithSession(adminId, "aal2", null);
        const plain = await attempt(client, "select public.admin_my_sessions() as j");
        const rows = plain.ok && Array.isArray(plain.rows[0].j) ? plain.rows[0].j : [];
        if (!rows.length) {
          skip(names.settingsSessions, "the admin persona has no active session to mark");
          return;
        }
        const pick = rows[rows.length - 1].id;
        await actWithSession(adminId, "aal2", pick);
        const marked = await attempt(client, "select public.admin_my_sessions() as j");
        const mrows = marked.ok && Array.isArray(marked.rows[0].j) ? marked.rows[0].j : [];
        const keys = new Set(mrows.flatMap((r) => Object.keys(r)));
        const text = JSON.stringify(mrows);
        record(
          names.settingsSessions,
          rows.every((r) => r.current === false) &&
            mrows.filter((r) => r.current).length === 1 &&
            mrows.find((r) => r.current).id === pick &&
            !keys.has("ip") &&
            !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(text) &&
            [...keys].every((k) => ["id", "user_agent", "last_active_at", "current"].includes(k)),
          "rows " + mrows.length + "; keys " + [...keys].sort().join(",") + "; current " + pick,
        );
      });
    }
    // ------------------------------------------------------------------------------------------
    // Handoff 55-A (39-A): the notification foundation (20261008120000 to 20261008120500). One
    // presence probe for the block, so before Chat's apply every arm reports UNPROVEN (G143, 228).
    // Every arm is its own rolled-back transaction and acts as the two test accounts; the purge runs
    // as live_arms, which File E grants execute on it, inside the transaction that rolls it back.
    // ------------------------------------------------------------------------------------------
    {
      const nfmt = (r) => (r.ok ? "answered" : r.code + " " + r.message);
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('private.notify(uuid, text, public.anchor_kind, uuid, public.anchor_kind, uuid, text)') is not null and exists (select 1 from supabase_migrations.schema_migrations where version = '20261008120500') as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("notif"))
          skip(
            n,
            "20261008120500 is not on the project yet (Chat applies 55-A's six migrations before its enforcing run)",
          );
      } else {
        /** owner-test introduces themselves to member-test; null when the pair are not strangers. */
        const introduce = async () => {
          await actAs(client, owner.id);
          const r = await attempt(client, "select public.send_introduction($1, $2) as id", [
            member.id,
            "Handoff 55-A live arm. Rolled back by the same run.",
          ]);
          return r.ok && r.rows[0] ? { ok: true, id: r.rows[0].id } : { ok: false, r };
        };
        const strangers =
          "the two test accounts are not strangers (a request is pending, they are connected, or one blocks the other), so send_introduction refuses by design";
        const countAs = async (uid, where, values) => {
          await actAs(client, uid);
          const r = await attempt(
            client,
            "select count(*)::int as n from public.notifications where " + where,
            values,
          );
          return r.ok ? r.rows[0].n : null;
        };

        // 1. The one writer (1319). pg_proc is readable by every role.
        await inTransaction(client, async () => {
          const r = await attempt(
            client,
            "select p.oid::regprocedure::text as sig from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.prosrc ~* '(insert\\s+into|update|delete\\s+from)\\s+public\\.notifications\\M' order by 1",
          );
          const allowed = [
            "private.notify(uuid,text,anchor_kind,uuid,anchor_kind,uuid,text)",
            "private.notification_retract(uuid,text,anchor_kind,uuid)",
            "private.notification_settle(uuid,text,anchor_kind,uuid)",
            "notifications_mark_seen()",
            "notifications_mark_all_read()",
            "private.purge_read_notifications()",
          ];
          const sigs = r.ok ? r.rows.map((x) => x.sig) : [];
          const extra = sigs.filter((x) => !allowed.includes(x));
          record(
            names.notif,
            r.ok && extra.length === 0 && sigs.includes(allowed[0]),
            r.ok ? "writers " + JSON.stringify(sigs) : nfmt(r),
          );
        });

        // 2. authenticated cannot execute the writer.
        await inTransaction(client, async () => {
          await actAs(client, owner.id);
          const r = await attempt(
            client,
            "select private.notify($1::uuid, 'connection_request', 'member', $2::uuid, 'connection_request', gen_random_uuid())",
            [member.id, owner.id],
          );
          record(names.notifExecute, !r.ok && r.code === "42501", nfmt(r));
        });

        // 3. An introduction and its withdrawal; the actor's read; the two dots and the marks.
        await inTransaction(client, async () => {
          const intro = await introduce();
          if (!intro.ok) {
            const why = /not available/.test(intro.r.message || "") ? strangers : nfmt(intro.r);
            for (const n of [names.notifIntro, names.notifActor, names.notifDots, names.notifSeen])
              skip(n, why);
            return;
          }
          const where = "kind = 'connection_request' and object_id = $1::uuid";
          const memberReads = await countAs(member.id, where, [intro.id]);
          const ownerReads = await countAs(owner.id, "object_id = $1::uuid", [intro.id]);
          record(
            names.notifActor,
            memberReads === 1 && ownerReads === 0,
            "recipient " + memberReads + ", actor " + ownerReads,
          );

          await actAs(client, member.id);
          const dots = await attempt(
            client,
            "select public.notifications_dot() as d, public.connect_requests_pending() as p",
          );
          const d = dots.ok ? dots.rows[0] : {};
          record(
            names.notifDots,
            dots.ok && d.d === true && d.p === true,
            dots.ok
              ? "dot " + JSON.stringify(d.d) + ", pending " + JSON.stringify(d.p)
              : nfmt(dots),
          );

          const marked = await attempt(
            client,
            "select public.notifications_mark_seen(), public.mark_surface_seen('my_network')",
          );
          const after = await attempt(
            client,
            "select public.notifications_dot() as d, public.connect_requests_pending() as p, (select read_at is null from public.notifications where object_id = $1::uuid) as unread",
            [intro.id],
          );
          const a = after.ok ? after.rows[0] : {};
          record(
            names.notifSeen,
            marked.ok && after.ok && a.d === false && a.p === false && a.unread === true,
            marked.ok ? (after.ok ? JSON.stringify(a) : nfmt(after)) : nfmt(marked),
          );

          await actAs(client, owner.id);
          const withdrawn = await attempt(client, "select public.withdraw_request($1)", [
            member.id,
          ]);
          const left = await countAs(member.id, where, [intro.id]);
          record(
            names.notifIntro,
            memberReads === 1 && withdrawn.ok && left === 0,
            "after the introduction " +
              memberReads +
              ", withdraw " +
              nfmt(withdrawn) +
              ", after " +
              left,
          );
        });

        // 4. A block, read as row policy (1518).
        await inTransaction(client, async () => {
          const intro = await introduce();
          if (!intro.ok) {
            skip(
              names.notifBlock,
              /not available/.test(intro.r.message || "") ? strangers : nfmt(intro.r),
            );
            return;
          }
          const before = await countAs(member.id, "actor_id = $1::uuid", [owner.id]);
          await actAs(client, member.id);
          const block = await attempt(
            client,
            "insert into public.member_blocks (blocker_id, blocked_id) values ($1::uuid, $2::uuid)",
            [member.id, owner.id],
          );
          const afterBlock = await countAs(member.id, "actor_id = $1::uuid", [owner.id]);
          record(
            names.notifBlock,
            before >= 1 && block.ok && afterBlock === 0,
            "before " + before + ", block " + nfmt(block) + ", after " + afterBlock,
          );
        });

        // 5. The vocabulary.
        await inTransaction(client, async () => {
          await actAs(client, owner.id);
          const v = await attempt(
            client,
            "select public.vocabularies() -> 'notification_kinds' as k",
          );
          const kinds = v.ok && Array.isArray(v.rows[0].k) ? v.rows[0].k : [];
          const req = kinds.find((k) => k.value === "connection_request");
          record(
            names.notifVocab,
            !!req &&
              req.renders === true &&
              typeof req.destination === "string" &&
              req.destination !== "",
            v.ok ? JSON.stringify(kinds.map((k) => k.value + (k.renders ? "*" : ""))) : nfmt(v),
          );
        });

        // 6. The purge (1324): accepting settles member-test's request row and writes owner-test's
        //    unread connection_accepted row; the settled row is dated 200 days back by its own
        //    recipient (the read_at grant), then the purge runs as live_arms.
        await inTransaction(client, async () => {
          const intro = await introduce();
          if (!intro.ok) {
            skip(
              names.notifPurge,
              /not available/.test(intro.r.message || "") ? strangers : nfmt(intro.r),
            );
            return;
          }
          await actAs(client, member.id);
          const accepted = await attempt(client, "select public.respond_to_request($1, true)", [
            owner.id,
          ]);
          const aged = await attempt(
            client,
            "update public.notifications set read_at = now() - interval '200 days' where kind = 'connection_request' and object_id = $1::uuid",
            [intro.id],
          );
          const unreadBefore = await countAs(
            owner.id,
            "kind = 'connection_accepted' and object_id = $1::uuid and read_at is null",
            [intro.id],
          );
          await actAsSelf(client);
          const purged = await attempt(client, "select private.purge_read_notifications() as n");
          const readLeft = await countAs(
            member.id,
            "kind = 'connection_request' and object_id = $1::uuid",
            [intro.id],
          );
          const unreadLeft = await countAs(
            owner.id,
            "kind = 'connection_accepted' and object_id = $1::uuid and read_at is null",
            [intro.id],
          );
          record(
            names.notifPurge,
            accepted.ok &&
              aged.ok &&
              purged.ok &&
              unreadBefore === 1 &&
              readLeft === 0 &&
              unreadLeft === 1,
            "accept " +
              nfmt(accepted) +
              ", purge " +
              (purged.ok ? purged.rows[0].n + " row(s)" : nfmt(purged)) +
              ", read row left " +
              readLeft +
              ", unread row " +
              unreadBefore +
              " then " +
              unreadLeft,
          );
        });
      }
    }
    // ------------------------------------------------------------------------------------------
    // Handoff 60-NC (20261012120000): the email vocabularies, the email view's read, and the
    // one-click token from mint to use. One presence probe for the block, so before the apply every
    // arm reports UNPROVEN (G143, 228). Every arm is its own rolled-back transaction (269); the
    // fixtures go through the canonical paths: copy on connection_request through live_arms' column
    // grant, the member's mode through set_notification_preference, the notification and its outbox
    // row through send_introduction and private.notify, the token through email_unsubscribe_mint.
    // ------------------------------------------------------------------------------------------
    {
      const cfmt = (r) => (r.ok ? "answered" : r.code + " " + r.message);
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('public.email_unsubscribe(text)') is not null and exists (select 1 from supabase_migrations.schema_migrations where version = '20261012120000') as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("nc"))
          skip(
            n,
            "20261012120000 is not on the project yet (Chat applies it before the enforcing run)",
          );
      } else {
        const strangers =
          "the two test accounts are not strangers, so send_introduction refuses by design";
        const giveCopy = async () => {
          await actAsSelf(client);
          return attempt(
            client,
            "update public.notification_kinds set email_subject = 'Live arm subject', email_line = 'Live arm line.' where kind = 'connection_request'",
          );
        };
        const setMode = async (c, mode) => {
          await actAs(client, member.id);
          return attempt(client, "select public.set_notification_preference($1, 'email', $2)", [
            c,
            mode,
          ]);
        };
        const modesOf = async () => {
          await actAs(client, member.id);
          const r = await attempt(
            client,
            "select c::text as c, mode from public.notification_preferences where member_id = $1::uuid and channel = 'email' order by c",
            [member.id],
          );
          return r.ok ? Object.fromEntries(r.rows.map((x) => [x.c, x.mode])) : null;
        };
        /** The member's connect mode immediate, then owner-test's introduction: one outbox row. */
        const enqueue = async () => {
          const copy = await giveCopy();
          const mode = await setMode("connect", "immediate");
          await actAs(client, owner.id);
          const intro = await attempt(client, "select public.send_introduction($1, $2) as id", [
            member.id,
            "Handoff 60-NC live arm. Rolled back by the same run.",
          ]);
          if (!copy.ok || !mode.ok || !intro.ok) return { ok: false, copy, mode, intro };
          await actAsSelf(client);
          const row = await attempt(
            client,
            "select o.id from private.notification_outbox o where o.member_id = $1::uuid and o.mode = 'immediate' order by o.id limit 1",
            [member.id],
          );
          return row.ok && row.rows[0]
            ? { ok: true, outbox: row.rows[0].id }
            : { ok: false, copy, mode, intro, row };
        };
        const mint = async (outbox) => {
          await actAsSelf(client);
          return attempt(client, "select public.email_unsubscribe_mint($1::uuid) as t", [outbox]);
        };
        const consume = async (token) => {
          await actAsSelf(client);
          await client.query("set local role anon");
          const r = await attempt(client, "select public.email_unsubscribe($1) as s", [token]);
          await actAsSelf(client);
          return r;
        };
        const enqueueWhy = (e) =>
          e.intro && !e.intro.ok && /not available/.test(e.intro.message || "")
            ? strangers
            : "fixture: copy " +
              cfmt(e.copy) +
              ", mode " +
              cfmt(e.mode) +
              ", introduction " +
              cfmt(e.intro) +
              (e.row ? ", outbox " + (e.row.ok ? "no row" : cfmt(e.row)) : "");

        // 1. One owner of the mode set (Finding 1).
        await inTransaction(client, async () => {
          const bad = await setMode("connect", "weekly");
          const good = await setMode("connect", "digest");
          const after = await modesOf();
          await actAsSelf(client);
          const keys = await attempt(
            client,
            "select conname::text as n from pg_constraint where conname in ('notification_preferences_mode_check', 'notification_kinds_email_default_check', 'notification_preferences_mode_fkey', 'notification_kinds_email_default_fkey') order by 1",
          );
          const found = keys.ok ? keys.rows.map((x) => x.n) : [];
          record(
            names.nc,
            !bad.ok &&
              bad.code === "22023" &&
              good.ok &&
              after &&
              after.connect === "digest" &&
              found.join() ===
                "notification_kinds_email_default_fkey,notification_preferences_mode_fkey",
            "weekly " +
              cfmt(bad) +
              ", digest " +
              cfmt(good) +
              ", constraints " +
              JSON.stringify(found),
          );
        });

        // 2. The categories are the enum (Finding 2), and vocabularies() serves both.
        await inTransaction(client, async () => {
          await actAs(client, member.id);
          const r = await attempt(
            client,
            "select (select array_agg(c.value::text order by c.position) from public.notification_categories c) as keys, (select array_agg(x::text order by x) from unnest(enum_range(null::public.c_category)) x) as labels, (select count(*)::int from public.notification_categories c where c.value::text not in (select unnest(enum_range(null::public.c_category))::text)) as outside, public.vocabularies() -> 'notification_email_modes' as modes, public.vocabularies() -> 'notification_categories' as cats",
          );
          const row = r.ok ? r.rows[0] : {};
          record(
            names.ncCategories,
            r.ok &&
              JSON.stringify(row.keys) === JSON.stringify(row.labels) &&
              row.outside === 0 &&
              Array.isArray(row.modes) &&
              row.modes.map((m) => m.value).join() === "off,immediate,digest" &&
              Array.isArray(row.cats) &&
              row.cats.map((m) => m.value).join() === (row.labels || []).join(),
            r.ok
              ? "keys " +
                  JSON.stringify(row.keys) +
                  ", enum " +
                  JSON.stringify(row.labels) +
                  ", outside " +
                  row.outside +
                  ", modes " +
                  JSON.stringify((row.modes || []).map((m) => m.label))
              : cfmt(r),
          );
        });

        // 3. The email view's one read and its write read back (1553, 1560, 1552).
        await inTransaction(client, async () => {
          await actAs(client, member.id);
          const before = await attempt(client, "select public.notification_email_view() as v");
          const copy = await giveCopy();
          await actAs(client, member.id);
          const seeded = await attempt(client, "select public.notification_email_view() as v");
          const saved = await setMode("connect", "digest");
          await actAs(client, member.id);
          const after = await attempt(client, "select public.notification_email_view() as v");
          await client.query("set local role anon");
          const anon = await attempt(client, "select public.notification_email_view() as v");
          await actAsSelf(client);
          const byC = (r) =>
            r.ok && Array.isArray(r.rows[0].v)
              ? Object.fromEntries(r.rows[0].v.map((e) => [e.c, e]))
              : {};
          const b = byC(before);
          const s1 = byC(seeded);
          const a = byC(after);
          const withCopy = (m) =>
            Object.values(m)
              .filter((e) => e.has_copy)
              .map((e) => e.c);
          record(
            names.ncView,
            copy.ok &&
              Object.keys(s1).length === 6 &&
              withCopy(b).length === 0 &&
              withCopy(s1).join() === "connect" &&
              s1.connect.email_default === "off" &&
              s1.connect.mode === null &&
              saved.ok &&
              a.connect &&
              a.connect.mode === "digest" &&
              !anon.ok &&
              anon.code === "42501",
            "before " +
              JSON.stringify(withCopy(b)) +
              ", seeded " +
              JSON.stringify(s1.connect || null) +
              ", saved " +
              cfmt(saved) +
              ", after " +
              JSON.stringify(a.connect || null) +
              ", anon " +
              cfmt(anon),
          );
        });

        // 4. Mint, use, use again.
        await inTransaction(client, async () => {
          const e = await enqueue();
          if (!e.ok) return skip(names.ncToken, enqueueWhy(e));
          const m = await mint(e.outbox);
          const token = m.ok ? m.rows[0].t : null;
          const first = token ? await consume(token) : null;
          const modes = await modesOf();
          const second = token ? await consume(token) : null;
          const after = await modesOf();
          await actAsSelf(client);
          const row = await attempt(
            client,
            "select used_at is not null as used, expires_at = created_at + interval '60 days' as sixty from private.email_unsubscribe_tokens where outbox_id = $1::uuid",
            [e.outbox],
          );
          const allOff =
            !!modes &&
            ["collaborate", "connect", "contribute", "convene", "convey", "system"].every(
              (c) => modes[c] === "off",
            );
          record(
            names.ncToken,
            !!token &&
              /^[0-9a-f]{64}$/.test(token) &&
              first &&
              first.ok &&
              first.rows[0].s === "done" &&
              allOff &&
              second &&
              second.ok &&
              second.rows[0].s === "expired" &&
              JSON.stringify(after) === JSON.stringify(modes) &&
              row.ok &&
              row.rows[0] &&
              row.rows[0].used === true &&
              row.rows[0].sixty === true,
            "mint " +
              cfmt(m) +
              ", first " +
              (first ? (first.ok ? first.rows[0].s : cfmt(first)) : "none") +
              ", modes " +
              JSON.stringify(modes) +
              ", second " +
              (second ? (second.ok ? second.rows[0].s : cfmt(second)) : "none") +
              ", row " +
              JSON.stringify(row.ok ? row.rows[0] : cfmt(row)),
          );
        });

        // 5. A token 61 days old, the negative control for 4 (270).
        await inTransaction(client, async () => {
          const e = await enqueue();
          if (!e.ok) return skip(names.ncTokenAged, enqueueWhy(e));
          const m = await mint(e.outbox);
          const token = m.ok ? m.rows[0].t : null;
          await actAsSelf(client);
          const aged = await attempt(
            client,
            "update private.email_unsubscribe_tokens set created_at = now() - interval '61 days', expires_at = now() - interval '1 day' where outbox_id = $1::uuid",
            [e.outbox],
          );
          const before = await modesOf();
          const r = token ? await consume(token) : null;
          const after = await modesOf();
          record(
            names.ncTokenAged,
            !!token &&
              aged.ok &&
              r &&
              r.ok &&
              r.rows[0].s === "expired" &&
              before &&
              before.connect === "immediate" &&
              JSON.stringify(after) === JSON.stringify(before),
            "mint " +
              cfmt(m) +
              ", age " +
              cfmt(aged) +
              ", answer " +
              (r ? (r.ok ? r.rows[0].s : cfmt(r)) : "none") +
              ", modes " +
              JSON.stringify(before) +
              " then " +
              JSON.stringify(after),
          );
        });
      }
    }
    // ------------------------------------------------------------------------------------------
    // Fix PR 10 item 2 (handoff 59-FIX-10; ruling 1483 under 241 and 270): the Members order. One
    // presence probe for the block, so before Chat's apply of 20261009120000 both arms report
    // UNPROVEN (G143, 228). The fixture is a request from owner-test to member-test through
    // send_introduction, the one writer (415), inside the transaction that rolls it back.
    // ------------------------------------------------------------------------------------------
    {
      const mfmt = (r) => (r.ok ? "answered" : r.code + " " + r.message);
      await actAsSelf(client);
      const present = await client.query(
        "select to_regprocedure('private.members_order_tier(uuid, uuid)') is not null and exists (select 1 from supabase_migrations.schema_migrations where version = '20261009120000') as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("members"))
          skip(
            n,
            "20261009120000 is not on the project yet (Chat applies Fix PR 10's migration before its enforcing run)",
          );
      } else {
        /** member-test's Members lens, as the projection answers it: the rows in order, or the error. */
        const lensRows = async () => {
          await actAs(client, member.id);
          const r = await attempt(
            client,
            "select public.connect_cards('members', '{}'::jsonb, null, 200) as out",
          );
          const items = r.ok && r.rows[0] && r.rows[0].out ? r.rows[0].out.items || [] : [];
          return {
            ok: r.ok,
            ids: items.map((i) => i.id),
            names: items.map((i) => i.name),
            err: r.ok ? null : mfmt(r),
          };
        };
        /**
         * The lens's own rows in the order the rules give them, asked of the database rather than
         * sorted here, over the ids and names the lens returned: live_arms reads only the two test
         * accounts in public.members, so the names come from the projection, never from a join.
         */
        const ruled = async (rows) => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select u.id from unnest($1::uuid[], $2::text[]) u(id, name) order by private.members_order_tier($3::uuid, u.id), u.name, u.id",
            [rows.ids, rows.names, member.id],
          );
          return r.ok ? r.rows.map((x) => x.id) : null;
        };
        /** Each listed member's tier for member-test, keyed by id. */
        const tiersOf = async (ids) => {
          await actAsSelf(client);
          const r = await attempt(
            client,
            "select u.id, private.members_order_tier($2::uuid, u.id) as t from unnest($1::uuid[]) u(id)",
            [ids, member.id],
          );
          return r.ok ? new Map(r.rows.map((x) => [x.id, x.t])) : null;
        };
        const tierOf = async () => {
          const m = await tiersOf([owner.id]);
          return m ? (m.get(owner.id) ?? null) : null;
        };
        const inRuledOrder = async (rows) => {
          const expected = rows.ok && rows.ids.length ? await ruled(rows) : null;
          return expected !== null && JSON.stringify(rows.ids) === JSON.stringify(expected);
        };
        await inTransaction(client, async () => {
          await actAs(client, owner.id);
          const intro = await attempt(client, "select public.send_introduction($1, $2) as id", [
            member.id,
            "Fix PR 10 live arm. Rolled back by the same run.",
          ]);
          if (!intro.ok) {
            const why = /not available/.test(intro.message || "")
              ? "the two test accounts are not strangers (a request is pending, they are connected, or one blocks the other), so send_introduction refuses by design"
              : mfmt(intro);
            for (const n of armsOf("members")) skip(n, why);
            return;
          }
          const pending = await lensRows();
          const pendingOrdered = await inRuledOrder(pending);
          const pendingTiers = pending.ok ? await tiersOf(pending.ids) : null;
          const pendingTier = pendingTiers ? (pendingTiers.get(owner.id) ?? null) : null;
          // Another member with a request waiting on member-test may precede owner-test by name;
          // what 1483 fixes is that nobody of a later tier does.
          const ownerAt = pending.ids.indexOf(owner.id);
          const before = ownerAt > 0 ? pending.ids.slice(0, ownerAt) : [];
          const laterBefore = pendingTiers
            ? before.filter((id) => pendingTiers.get(id) !== 0)
            : before;
          // The arm as authenticated: the tier is internal and a member cannot call it (212).
          await actAs(client, member.id);
          const direct = await attempt(
            client,
            "select private.members_order_tier($1::uuid, $2::uuid) as t",
            [member.id, owner.id],
          );
          await actAs(client, owner.id);
          const withdrawn = await attempt(client, "select public.withdraw_request($1)", [
            member.id,
          ]);
          const after = await lensRows();
          const afterOrdered = await inRuledOrder(after);
          const afterTier = await tierOf();
          if (!pending.ok || ownerAt < 0) {
            skip(
              names.members,
              pending.err
                ? "the Members lens could not be read: " + pending.err
                : "owner-test is not in member-test's Members lens at all, so their place in it proves nothing",
            );
          } else {
            record(
              names.members,
              pendingTier === 0 &&
                laterBefore.length === 0 &&
                pendingOrdered &&
                withdrawn.ok &&
                after.ok &&
                after.ids.includes(owner.id) &&
                afterOrdered &&
                after.ids.indexOf(owner.id) >= ownerAt,
              "pending: owner-test at index " +
                ownerAt +
                " of " +
                pending.ids.length +
                " with " +
                before.length +
                " tier-0 member(s) before them and " +
                laterBefore.length +
                " of a later tier, list in ruled order " +
                pendingOrdered +
                "; withdraw " +
                mfmt(withdrawn) +
                "; withdrawn: owner-test at index " +
                after.ids.indexOf(owner.id) +
                ", list in ruled order " +
                afterOrdered,
            );
          }
          record(
            names.membersTier,
            !direct.ok &&
              direct.code === "42501" &&
              pendingTier === 0 &&
              afterTier !== null &&
              afterTier !== 0,
            "as authenticated " +
              mfmt(direct) +
              "; pending tier " +
              pendingTier +
              "; withdrawn tier " +
              afterTier,
          );
        });

        // W94: the cursor is the last emitted row's key (20261009120300). Pages of two cross a
        // boundary every other member; the one-page read at the cap is the control. A cursor taken
        // from the row at limit + 1 loses a member at every boundary, so the two reads differ.
        await inTransaction(client, async () => {
          await actAsSelf(client);
          const applied = await client.query(
            "select exists (select 1 from supabase_migrations.schema_migrations where version = '20261009120300') as ok",
          );
          if (!applied.rows[0] || applied.rows[0].ok !== true) {
            skip(
              names.membersPaging,
              "20261009120300 is not on the project yet (Chat applies Fix PR 10's cursor migration before its enforcing run)",
            );
            return;
          }
          const pageAll = async (limit) => {
            await actAs(client, member.id);
            const ids = [];
            let cursor = null;
            let pages = 0;
            let err = null;
            for (;;) {
              const r = await attempt(
                client,
                "select public.connect_cards('members', '{}'::jsonb, $1, $2) as out",
                [cursor, limit],
              );
              if (!r.ok) {
                err = mfmt(r);
                break;
              }
              pages++;
              const out = (r.rows[0] && r.rows[0].out) || {};
              for (const i of out.items || []) ids.push(i.id);
              cursor = typeof out.next_cursor === "string" ? out.next_cursor : null;
              if (cursor === null || pages > 200) break;
            }
            return { ids, pages, err };
          };
          const two = await pageAll(2);
          const forty = await pageAll(40);
          const sorted = (a) => JSON.stringify(a.slice().sort());
          const dupes = two.ids.filter((id, i) => two.ids.indexOf(id) !== i);
          if (two.err || forty.err) {
            skip(
              names.membersPaging,
              "the Members lens could not be read: " + (two.err || forty.err),
            );
          } else if (forty.ids.length < 3) {
            skip(
              names.membersPaging,
              "member-test's lens admits " +
                forty.ids.length +
                " member(s), so pages of two cross no boundary and the cursor is not exercised",
            );
          } else {
            record(
              names.membersPaging,
              dupes.length === 0 && sorted(two.ids) === sorted(forty.ids),
              "two at a time: " +
                two.ids.length +
                " ids over " +
                two.pages +
                " page(s), " +
                dupes.length +
                " duplicate(s); forty at a time: " +
                forty.ids.length +
                " ids over " +
                forty.pages +
                " page(s)",
            );
          }
        });
      }
    }
    // ------------------------------------------------------------------------------------------
    // Fix PR 10 items 8 and 9 (addendum 1; rulings 1636, 1637, 1638, 1581, 241, 270): the group
    // invitation signal and the invitee's lines. One presence probe for the block, on migrations A
    // and B (20261009120100, 20261009120200), so before the apply every arm reports UNPROVEN (G143,
    // 228). The fixture connects the two test accounts inside the transaction, as the 41-E group
    // arm does, and creates a group with member-test picked.
    // ------------------------------------------------------------------------------------------
    {
      const ifmt = (r) => (r.ok ? "answered" : r.code + " " + r.message);
      await actAsSelf(client);
      const present = await client.query(
        "select exists (select 1 from supabase_migrations.schema_migrations where version = '20261009120100') and exists (select 1 from supabase_migrations.schema_migrations where version = '20261009120200') and exists (select 1 from pg_attribute a where a.attrelid = 'public.messenger_threads_view'::regclass and a.attname = 'invited_by_name' and not a.attisdropped) as ok",
      );
      if (!present.rows[0] || present.rows[0].ok !== true) {
        for (const n of armsOf("invite"))
          skip(
            n,
            "20261009120100 and 20261009120200 are not on the project yet (Chat applies Fix PR 10's migrations before its enforcing run)",
          );
      } else {
        const createGroup = async (name, ids) => {
          await actAs(client, owner.id);
          return attempt(
            client,
            "select public.messenger_thread_create_group($1, $2::uuid[]) as id",
            [name, ids],
          );
        };
        const invitedBy = async (uid, thread) => {
          await actAs(client, uid);
          const r = await attempt(
            client,
            "select invited_by_name, state from public.messenger_threads_view where thread_id = $1::uuid",
            [thread],
          );
          return r.ok ? (r.rows[0] ?? null) : { err: ifmt(r) };
        };
        const invitationRow = async (thread) => {
          await actAs(client, member.id);
          const r = await attempt(
            client,
            "select c_category, read_at is not null as read, seen_at is not null as seen from public.notifications where recipient_member_id = $1::uuid and kind = 'thread_invitation' and object_kind = 'thread' and object_id = $2::uuid",
            [member.id, thread],
          );
          return r.ok ? r.rows : { err: ifmt(r) };
        };
        await inTransaction(client, async () => {
          const c = await connect(owner.id, member.id);
          if (!c.ok) {
            for (const n of [names.invite, names.inviteName])
              skip(n, "the two test accounts could not be connected in this transaction: " + c.why);
            return;
          }
          const created = await createGroup("Fix PR 10 live arm", [member.id]);
          if (!created.ok) {
            for (const n of [names.invite, names.inviteName])
              skip(n, "messenger_thread_create_group refused: " + ifmt(created));
            return;
          }
          const thread = created.rows[0].id;
          const before = await invitationRow(thread);
          const asMember = await invitedBy(member.id, thread);
          const asOwner = await invitedBy(owner.id, thread);
          await actAs(client, member.id);
          const accepted = await attempt(
            client,
            "select public.messenger_thread_invite_accept($1::uuid)",
            [thread],
          );
          const after = await invitationRow(thread);
          const afterName = await invitedBy(member.id, thread);
          record(
            names.invite,
            Array.isArray(before) &&
              before.length === 1 &&
              before[0].c_category === "connect" &&
              before[0].read === false &&
              accepted.ok &&
              Array.isArray(after) &&
              after.length === 1 &&
              after[0].read === true &&
              after[0].seen === true,
            "before accept " +
              JSON.stringify(before) +
              "; accept " +
              ifmt(accepted) +
              "; after " +
              JSON.stringify(after),
          );
          record(
            names.inviteName,
            !!asMember &&
              asMember.state === "invited" &&
              asMember.invited_by_name === owner.name &&
              !!asOwner &&
              asOwner.invited_by_name === null &&
              !!afterName &&
              afterName.state === "active" &&
              afterName.invited_by_name === null,
            "invited member reads " +
              JSON.stringify(asMember) +
              "; inviter reads " +
              JSON.stringify(asOwner) +
              "; accepted member reads " +
              JSON.stringify(afterName),
          );
        });
        await inTransaction(client, async () => {
          await actAsSelf(client);
          const third = await attempt(client, "select public.live_arms_admin_member() as id");
          const thirdId = third.ok && third.rows[0] ? third.rows[0].id : null;
          if (!thirdId) {
            skip(names.inviteRefused, "no third member: " + ifmt(third));
            return;
          }
          await actAsSelf(client);
          const connected = await attempt(
            client,
            "select private.is_connected($1::uuid, $2::uuid) as ok",
            [owner.id, thirdId],
          );
          if (connected.ok && connected.rows[0].ok === true) {
            skip(
              names.inviteRefused,
              "owner-test and the third member are connected, so there is no stranger to pick",
            );
            return;
          }
          const refused = await createGroup("Fix PR 10 refused group", [thirdId]);
          await actAsSelf(client);
          const threads = await attempt(
            client,
            "select count(*)::int as n from public.threads where name = 'Fix PR 10 refused group'",
          );
          record(
            names.inviteRefused,
            !refused.ok &&
              refused.code === "42501" &&
              /not_your_connection/.test(refused.message || "") &&
              threads.ok &&
              threads.rows[0].n === 0,
            "create " +
              ifmt(refused) +
              "; threads written " +
              (threads.ok ? threads.rows[0].n : ifmt(threads)),
          );
        });
      }
    }
    // ------------------------------------------------------------------------------------------
    // Fix PR 10 item 3 (rulings 1621, 1613): the vocabulary and the self-hosted data agree. The seed
    // (20261008150000) keyed every row by the character as emojibase writes it, variation selector
    // included, and capitalised the first letter of the English label; the eight quick rows carry
    // E9's names instead and are checked by position alone.
    // ------------------------------------------------------------------------------------------
    await inTransaction(client, async () => {
      let file;
      try {
        file = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "..", "public", "emojibase", "17.0.0", "en", "data.json"),
            "utf8",
          ),
        );
      } catch (e) {
        skip(
          names.emojiAgree,
          "public/emojibase/17.0.0/en/data.json could not be read: " + e.message,
        );
        return;
      }
      const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      const labels = new Map();
      for (const e of file)
        if (typeof e.group === "number") labels.set(e.emoji, capitalise(e.label));
      await actAs(client, owner.id);
      const rows = await attempt(
        client,
        "select emoji, label, quick_position from public.message_reaction_emoji order by quick_position nulls last, emoji",
      );
      if (!rows.ok) {
        skip(
          names.emojiAgree,
          "message_reaction_emoji could not be read: " + rows.code + " " + rows.message,
        );
        return;
      }
      const quick = rows.rows.filter((r) => r.quick_position !== null).map((r) => r.quick_position);
      const wrong = [];
      let compared = 0;
      for (const r of rows.rows) {
        if (r.quick_position !== null) continue;
        compared++;
        const want = labels.get(r.emoji);
        if (want !== r.label)
          wrong.push(
            r.emoji + " " + JSON.stringify(r.label) + " vs " + JSON.stringify(want ?? null),
          );
      }
      record(
        names.emojiAgree,
        compared > 0 &&
          wrong.length === 0 &&
          JSON.stringify(quick.slice().sort((a, b) => a - b)) === "[1,2,3,4,5,6,7,8]",
        "compared " +
          compared +
          ", quick positions " +
          JSON.stringify(quick) +
          (wrong.length ? "; " + wrong.slice(0, 5).join("; ") : ""),
      );
    });
  } finally {
    await client.end().catch(() => {});
  }
}

module.exports = { runLiveDbArms, clientConfig };
