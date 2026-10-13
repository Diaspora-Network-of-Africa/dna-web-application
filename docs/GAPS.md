# Gap notes

Things the build knows are missing, with the ruling that put them here. A gap is not a defect: it is
work that was deliberately not done, recorded so it is not rediscovered by accident. Notion is the
source of truth for the Gap Register; this file is the repo's working copy, and it carries only gaps
a reader of this codebase would otherwise have to infer from an absence.

Phase posture (ruling 140): the canonical project holds no real member data, so visibility, RLS and
consent findings are recorded with a severity and tracked. None of them blocks a merge. They are
invite-boundary gates, to close before the first real member invite.

## G1. Report has no surface, and block has one place only (ruling 186)

**Severity: high at the invite boundary. Not a merge blocker (ruling 140). Narrowed 10 September
2026 by Brief 4A, which built the block control on the profile.**

`public.member_blocks` is written by the app now, from one surface: the overflow on Profile's
Visitor action row (`src/components/dna/ProfileBlockControl.tsx`, `src/lib/blocks.ts`, B4A-SPEC.md).
Ruling 208 puts unblock in the same place, and ruling 198 keeps `/m/:handle` loading for both
parties, so there is no list and no settings dependency to build. Report is untouched and the rest
of the chassis still has no block affordance.

Ruling 50 places block and report in the chassis, on every surface. The chassis shipped without a
block store, so `member_blocks` was created inside Brief 4 to give Connect's projections something
to filter on. Ruling 186 moves its ownership out of Connect and corrects the register: block and
report were **not** built in the chassis.

What exists:

- The table, with RLS: the blocker selects, inserts and deletes their own rows; the blocked member
  never learns the row exists; admin may select and delete; service role has full access.
- `private.is_blocked(a, b)`, symmetric, applied as an absolute filter on every projection that
  returns a member (see the audit below).
- Block and unblock on Profile, from Brief 4A: one overflow item and one confirm sheet in two
  variants, on the signed-in Visitor view. The writes are a plain insert and delete on
  `member_blocks` under the blocker's own RLS, so the ruling 198 trigger carries every consequence
  and there is no second place for the semantics to live. Fix PR 02 (ruling 442) adds a second
  trigger on the same insert, `on_member_block_rate_limit`, which bounds how many blocks one member
  may write in an hour through `private.rate_limit`; the ceiling is internal and the refusal is
  words. The insert stays a plain insert, and the live arms that prove it run as `live_arms` on
  `LIVE_DB_URL` (ruling 382), never on a Management API token.

What is still missing:

- Block anywhere else. No Block action on a member card, a post, a thread, an event or a Space, so
  a member who meets someone outside `/m/:handle` has to reach their profile to act. Ruling 50 puts
  block on every surface; Brief 4A gave it one, which is the one that also carries unblock.
- Report entirely: no report object, no reason vocabulary, no queue, no admin surface. Ruling 115's
  human review queue has no inbox. Ruling 207 defers it deliberately: a report needs a moderation
  destination, which is the System Admin brief, and a report that goes nowhere promises someone is
  reading.

**Correction, ruling 216.** This entry used to say the table "can only ever hold rows put there by
hand". That is true of the app and false of the API, and PASS-01's F8 proved it live: the
`authenticated` grant carries `INSERT` and `DELETE` on `member_blocks` and an ordinary member
inserted a block row over PostgREST. The gap is the missing surface, not a missing writer, and the
distinction matters because the ruling-198 trigger fires on that insert whoever wrote it. The
security pass's own re-test of F4 uses that path, and so does the standing block arm in
`tests/live-checks.cjs` (ruling 218).

F8 also flagged the irreversibility that follows: deleting the block row does not restore the
connection or the follow, because the trigger **revokes** edges rather than deleting them. That is
intended and ruling 211 says so — unblocking restores nothing and a revoked edge is re-made
deliberately. F8 was written before 211 existed. Nothing to fix; the block surface's brief inherits
it.

Where it belongs: the chassis, not an engine. Convene, Collaborate, Contribute and Messaging all
filter on the same table (ruling 186), so the surface is written once and every engine inherits it.
Its brief also has to settle what a block does to work already shared between the two members, which
is a product question no ruling has yet answered.

What that brief no longer has to settle: what a block does to a profile and to the relationship.
Ruling 198 answered both, and the enforcement sits in `profile_view` and in a trigger on
`member_blocks`, not in a write path, so every writer inherits the semantics rather than restating
them. Brief 4A is the first writer and it inherits them exactly: it writes the row and re-reads.

**Brief 4A, 10 September 2026.** What it settled beyond building the control. B4A section 6 made the
audience-scope drop directional, which ruling 198 always was in words and the r198 implementation
was not: `private.is_blocked` stays symmetric because discovery and contact are symmetric, but only
the party who was blocked falls to the anonymous rule. The blocker keeps their own viewer, so ruling
220's anchor still admits Anchored sections to them and their mutuals, shared Spaces and DIA line
survive, while the revoked edge removes Connections sections from both sides. `profile_view` gains
one key, `viewer_blocked`, which is the caller's own block and never the converse.

One thing Brief 4A leaves open and did not create. A member with the Private switch on returns null
from `profile_view` to anyone who is not an existing connection (ruling 213), and a block revokes the
connection, so a blocked party loses the page for a Private member rather than seeing it at the
lowest scope. That is ruling 213 reaching them first, not a disclosure: ending a connection without
any block does the same thing. B4A section 7's enumeration assumes a profile that loads, so it does
not describe this case, and no ruling covers the interaction. It belongs with the chassis brief.

## G2. What a block means on a profile — closed (ruling 198)

**Closed 9 September 2026. The gap was a missing decision, not missing code, which is why PR #10 was
right to report it rather than patch it.**

The finding: with a block in place, `profile_view('<blocker>')` called by the blocked member returned
the full profile. Every projection inside the payload behaved; the subject itself was unfiltered.

Ruling 198 settles it. A block removes discovery and contact, drops the blocked party to the lowest
audience scope, and revokes the relationship in both directions. It does not hide the profile.

- Audience scope: the blocked viewer gets the public projection, enforced in `profile_view` as row
  policy through the same `private.admit_section` predicate every other viewer goes through, given a
  null viewer. No connections-scoped section, no anchored-scoped section, no mutual name, no shared
  Space, no anchored qualification, no DIA line, and third parties as roles rather than names.
- Actions: no relationship object at all, so the surface renders no Connect and no Follow, in either
  direction. `private.is_blocked` is symmetric and so is this.
- The relationship itself: the connect and follow edges are revoked (not deleted, so the history
  stays auditable) and the adjacency and follow rows removed, by a trigger on `member_blocks` rather
  than by a write path, so every future writer of that table inherits the semantics.
- The profile shell still loads. Hiding it discloses the block — a page that opened yesterday and
  fails today says exactly what happened — and is circumvented by signing out, so hiding is both
  leaky and legible. This is neither. The answer this file previously called "the stronger reading"
  was rejected for that reason.

Accepted cost, recorded so it is not reopened by accident: a member who blocks someone will find the
blocked person can still read their public page, and that will feel like the block did less than they
asked for.

Verified live on 9 September 2026 with a real block in place, both directions, as a member rather
than by reading the SQL, and the database returned to its prior state afterwards. What was not
changed and is not a defect: a pending `connection_requests` row between a blocked pair is left as it
stands. Neither party can see it — every projection filters the pair, and the sender has no direct
read on the table (ruling 157) — and withdrawing it would be a status change nobody asked for.

## G3. Multi-select filters on Connect (ruling 163)

**Severity: low. Deliberate scope cut, not a defect.**

Filters are single-value at launch, one value per axis across ten axes. Multi-select on skill, focus
area and industry was logged rather than built, because it turns the chip row, the URL scheme and
the empty-state copy into their own design problem. `docs/connect/SPEC.md` §13 refers to this as the
"logged gap"; this is where it is logged.

## G4. Hardcoded vocabularies in merged surfaces — closed (rulings 193, 194)

**Closed 9 September 2026. Recorded rather than deleted, because the shape is worth remembering.**

Ruling 187's work turned up that Profile had been reading segment labels from two hardcoded maps in
`SegmentBlock.tsx` since Brief 3 merged (ruling 145), against the standing rule that fixed
vocabularies are database tables read at runtime. Those went with ruling 187. The sweep of the other
merged surfaces found three more, and rulings 193 and 194 closed all three:

- `src/components/strand/SegmentBlock.tsx`, `SEG.returnee.fields[0].options` — the four
  `return_timeline` values, sitting beside `timelineOptions` as its fallback, so the literal shadowed
  the live source rather than being replaced by it. Surface: Profile (Brief 3). Removed; the select
  reads `vocabularies().timeline` or renders no options.
- `src/components/strand/verb-schema.ts`, the Contribute verb's `instrument` options
  (`["Time", "Skills", "In-kind"]`). Surface: Composer (Brief 1). Removed; the options arrive as
  `fieldOptions.instrument` from the same projection.
- `src/lib/feed.ts`, `INSTRUMENT_LABEL`. Surface: Feed (Brief 2). Removed; the labels come from the
  projection, and a Need whose vocabulary did not load renders no instrument row.

The open question the earlier entry left — whether an enum counts, when CLAUDE.md's absolute names
tables — was answered by ruling 193 on the precedent already in the code: `heritage_kind`,
`return_pathway` and `return_timeline` are enums and were already served at runtime through
`enum_range`. `contribute_instrument` now goes the same way. Its labels are derived from its values
in the projection rather than listed, because a list in SQL is the same anti-pattern relocated.

`public.profile_vocabularies()` is now `public.vocabularies()`: the projection serves three surfaces,
so it is no longer Profile's, and ruling 193 says rename the path rather than add a second one. The
old name was dropped in the same migration, not kept as an alias.

Deliberately not findings, listed so the sweep is not re-run over them (the G4 exclusions, ratified
by ruling 193): the five Cs and their labels, glyphs and copy (`cmeta.ts`, `cinfo.ts`, `VerbChip`,
`BadgeRow`, `Composer`'s DIA lines), audience labels and section titles (`ProfileSurface`),
notification kinds (`NotificationListItem`), lens ids (`lens.ts`, `connect.ts`), relationship states
(`MemberCard`), and the generated enum constants in `src/lib/database.types.ts`. These are structure,
doctrine or UI copy, not vocabularies members choose values from, and none can drift from the
database because the database does not own them. Convene's `ticket_kind` (`["Free", "Paid"]` in
`verb-schema.ts`) is the one adjacent case this PR left alone: it is a Brief 5 surface's vocabulary,
not one of the three sites the audit found, and widening the sweep into it was ruled out.

## Audit: `member_blocks` as an absolute filter (ruling 186, item 4)

Run against the canonical project on 9 September 2026, as a real member with real blocks, not by
reading the SQL. A block was inserted, every projection that returns a member was called from both
sides, and the database was returned to its prior state (zero block rows, `where_floor` back to 5).

| Projection                                                          | Blocker's view                                                   | Blocked party's view     | Result                              |
| ------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------ | ----------------------------------- |
| `connect_cards('members')`                                          | blocked member absent                                            | blocker absent           | pass, both directions               |
| `connect_cards('suggested')`                                        | blocked member absent                                            | blocker absent           | pass, both directions               |
| `connect_cards('network')` (connections, requests, sent, following) | blocked member absent                                            | blocker absent           | pass, both directions               |
| Mutual names (`connect_card`, `profile_view.mutuals`)               | mutual emptied                                                   | mutual emptied           | pass, both directions               |
| DIA rail rows (`connect-suggest`)                                   | inherits `connect_cards('suggested')` under the member's own JWT | same                     | pass, both directions               |
| `connect_where()` underlying counts                                 | country tile disappeared                                         | country tile disappeared | pass, both directions               |
| `connection_request_intros(ids)`                                    | **returned the other party's name**                              | **same**                 | **failed; fixed in this PR**        |
| `profile_view(handle)` subject                                      | returned the profile                                             | returned the profile     | **failed; logged as G2, not fixed** |

The `connect_where` rows sit below the floor of five on real data, so that line was proved by
dropping `where_floor` to 1 for the two calls and restoring it to 5 immediately after.

## G5. The WebKit web-process crash on the Profile surface (ruling 200)

**Severity: medium. Open, root-caused to a named class and anchored to exact library offsets, not
fixed. The fault is in engine code, so under ruling 200's guardrail it is reported rather than
changed.**

### The finding

A **SIGSEGV in WebKit's compositing thread**, `ThreadedCompositor`, in the `WPEWebProcess` of
Playwright's WPE build of WebKit 26.6 (`webkit-2359`). The thread is servicing a scheduled update
dispatched from `g_main_context_dispatch` when it walks a structure recursively — three functions
cycling about eight or nine levels — completes the walk, calls into a function far outside that
cluster, and faults there.

Frames, as offsets into `libWPEWebKit-2.0.so.1`:

| Frame     | Offset                                                            |                                                 |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| #0        | `+0x588b98a`                                                      | **fault site**, far outside the cycle's cluster |
| #1        | `+0x27b6be4`                                                      |                                                 |
| #2 … #26  | `+0x27b76f4` → `+0x27b23f1` → `+0x27b555f`                        | the cycle, 9x / 8x / 8x                         |
| #27       | `+0x27b1885`                                                      | the recursion is entered here                   |
| #28 … #32 | `+0x7607e1`, `+0x75f51a`, `+0x7659a9`, `+0x1d3726b`, `+0x1d356e6` |                                                 |
| #33, #34  | glib, `g_main_context_dispatch`                                   |                                                 |
| #35 … #38 | `+0x1d35d51`, `+0x1d36067`, `+0x1cd2ac3`, `+0x1d3bd46`            |                                                 |
| #39, #40  | `start_thread`, `clone3`                                          |                                                 |

Two crashes forty minutes apart, in different processes with different ASLR bases, produce
byte-identical offsets. The crash has one path, not several. No function is named because the build
ships no debug info and gdb prints `??` for these frames; a nearest-exported-symbol guess would name
a function that is not the one in the frame. The offsets are exact against this build and visibly
useless against another, which is what makes them safe to hand on.

### What it explains, and what it dissolves

Ruling 200 asked for a cause explaining three facts: every sighting dark, every sighting the Profile
owner flow, Chromium never. The finding explains all three, and two of them by showing they were
never facts.

- **Dark.** Broken by evidence before the cause was found: run 62's second attempt crashed at
  `webkit-1536x960-light`. Compositing is not theme-dependent.
- **Owner flow.** Broken too: a `profile visitor stranger` flow crashed on plain `page.goto`.
  Compositing runs on every view.
- **Viewport.** Never a variable. Six viewports have now produced it (430, 744, 820, 1280, 1366,
  1536), and the DOM census is identical at every one.
- **Chromium never.** Chromium has no `ThreadedCompositor`; it paints through Skia in its own
  process architecture. The one engine-specific fact is the one that held.

What survives as constant is **WebKit, and the Profile surface at `/m/:handle`**. The crash lands
during whatever the flow happens to be doing — a section save, `edit-done`, a navigation — because
the compositor is servicing a _scheduled_ update, not responding to the action.

### Whose defect

Every frame is inside `libWPEWebKit-2.0.so.1` or glib. None is DNA's, and none could be: no
application has code on that thread. That does not by itself make it WebKit's bug, because a page
can hand the compositor a layer tree that trips a latent fault in it. Establishing which of those it
is needs the symbolised frames, which needs a debug build.

Nothing in `src/` was touched, and no test was weakened, skipped, retried or quarantined.

### Two wrong answers, recorded because they were wrong

This entry named a cause twice before the evidence arrived, and both were refuted.

1. **`color-scheme: dark` on native form controls.** Reached by measuring that `color-scheme` is the
   only computed-style difference between the themes anywhere in the surface — which is true, and
   which read forward actually _predicts_ the light sighting that killed it. In light,
   `color-scheme` resolves to `normal` and the dark control path is never taken; the crash happened
   anyway.
2. **Native-appearance form controls, theme-independent.** Reached by measuring that they are the
   only element class present in the owner view and absent from every other — also true. Refuted by
   a crash in the visitor view, which mounts none of them, and again by the faulting thread being
   the compositor rather than any form-control paint path.

Both were reached by elimination on a small sample, both looked strong, and both were coincidences
of exactly the kind ruling 200 warned about. The guardrail that kept `src/` untouched is the only
reason neither shipped as a fix for a defect that lives in the engine.

Ruled out along the way, each by measurement rather than inspection: pattern and Adinkra SVG masks,
`backdrop-filter`, `mix-blend-mode`, dark-only `color-mix` / `oklch` / relative colour, DOM-size
cliffs, page nesting depth, stack exhaustion, and a remount storm at the section saves.

### Ruling 152, and ruling 200's own premise

**Ruling 152 is corrected.** It characterised this as a navigation-timing race that moves each run.
The condition is static: present from the first paint, unchanged by navigation, unchanged by the
saves. What 152 read as movement is sampling across identical at-risk cases.

**Ruling 200's premise is corrected too.** It replaced 152's one moving variable with three
constants. Two of the three broke on their own evidence within hours. A constant asserted from four
samples is a description of the sample.

### Reproducing it

Dispatch `matrix.yml` with a `loop` input (170 iterations fits the job timeout) to run
`tests/webkit-crash-loop.cjs`, which drives `tests/profile.cjs`'s own `runOwner` so the flow under
test is the matrix's flow. Core dumps, gdb frames, offset resolution and the library build id are
captured automatically.

**A single clean loop run proves nothing.** Four of five confirmed loop runs crashed, about one
crash per 210 iterations, so roughly one run in five comes back clean with nothing changed. Any
probe needs several runs per arm and a control arm run at the same time on the same head. The
`appearance` probe arm is the cautionary case: five clean runs there looked like a result and were a
coincidence.

The `compositing` probe arm (`WEBKIT_DISABLE_COMPOSITING_MODE=1`) is **not** evidence and should not
be read as any: whether this WPE build honours that variable was never verified, and the pass-count
test proposed for checking it was withdrawn as non-discriminating.

### The next step

Take the offsets above to a WebKit 26.6 debug build, or to the matching source, and symbolise
`+0x27b1885` (the recursion's entry), the cycle at `+0x27b76f4` / `+0x27b23f1` / `+0x27b555f`, and
`+0x588b98a` (the fault). That names the walk and the function that faults, and it is the one step
that decides whether the trigger is a layer tree the Profile surface builds or a latent fault in the
engine. Everything before it is done.

### Ruling 201, and where the evidence since corrects it

Ruling 201 corrects ruling 200's evidence: the crash is **intermittent, not deterministic once the
viewport is fixed**. It was absent from runs 53, 57, 59, 60 and 63, every one of which exercised
WebKit dark at all nine viewports, against three sightings at the time it was written.

**That correction is right, and the work in this entry measures it.** The crash rate is about one
per six full profile matrix runs, and about one per 210 owner-flow iterations in the loop. A given
viewport in a given theme passes far more often than it fails, exactly as 201 says. 201's practical
advice follows from the same number and is worth keeping verbatim: prioritise capturing a crash log
over bisecting, and treat a clean local loop as uninformative rather than as evidence there is
nothing there. Quantified: fifty loop iterations carry roughly a one-in-five chance of firing, so a
clean fifty-loop run is close to meaningless.

That advice was followed and it was the right call. The crash log settled the cause in one step;
every bisect-shaped line of attack in this entry produced a wrong answer.

**Two points in 201's evidence are superseded by primary evidence gathered afterwards**, both read
from job logs rather than inferred, and both recorded above:

- **Not every sighting is dark.** Run 62's _second attempt_ (`34314303037`, job `102354990849`)
  failed one check of 5990: `FAIL: webkit-1536x960-light profile owner flow WEB PROCESS CRASHED`.
  Ruling 200's table records run 62 as `webkit-820x1180-dark`, which was attempt 1. Both are run 62.
- **Not every sighting is the owner flow.** A `profile visitor stranger` flow crashed on plain
  `page.goto` (`34321583032`, job `102369208850`), in a view that mounts no form controls at all.

So the envelope 201 describes — WebKit, dark, Profile owner flow — is narrower than the defect. The
envelope that survives all sampling is **WebKit, and the Profile surface**. This matters for method
rather than priority: an investigator who restricts sampling to dark and to the owner flow halves
the at-risk population per run for no reason, and may read a clean light or visitor run as
exonerating when it is not.

**On 201's reading that intermittency within a narrow envelope means a race inside that envelope.**
The captured stack says otherwise, and says something more specific. The fault is a SIGSEGV on
WebKit's compositing thread while it services a _scheduled_ update dispatched from
`g_main_context_dispatch`. That is asynchronous with respect to whatever the flow is doing, which is
why the crash lands at a section save in one sighting, at `edit-done` in another and at `page.goto`
in a third, and why it looks like a race against the flow when it is not one. Ruling 152 called it a
navigation-timing race and offered the moving viewport as evidence; 201 is right that the viewport
is the only thing that varies and so evidences nothing. Both readings are superseded by the stack:
the timing that matters is the compositor's own scheduling, not the navigation's.

### How this was reached, in order

The sections below are the working record, kept in the order it happened, including the two wrong
answers, the withdrawn test, and four defects in this investigation's own instrumentation. A reader
who only wants the answer has it above.

### Update, 07:23: the owner constant breaks too, and the experiment is confounded

The probe arm produced a crash, and not the one it was looking for. Run 12
(`34321583032`, job `102369208850`, env `RULING200_PROBE: appearance` confirmed in the log):

```
3533/3534 checks passed
FAIL: webkit-820x1180-dark profile visitor stranger flow Error: page.goto: Page crashed
  - navigating to ".../m/thandiwe-dube", waiting until "networkidle"
  | state unavailable: Error: page.evaluate: Target crashed
```

**`profile visitor stranger`**, dying during `page.goto` on plain navigation, before any
interaction. The visitor view mounts zero form controls (the census above: 0 selects, 0 options, 0
native-appearance controls). So if this is the same defect, native form controls cannot be its cause,
and the surviving suspect is refuted along with the first one.

The arms as they stand, counting owner cases only:

| Arm                  | Owner cases | Owner crashes                         | Other crashes                                     |
| -------------------- | ----------- | ------------------------------------- | ------------------------------------------------- |
| Control              | 90          | 2 (`744x1133-dark`, `1536x960-light`) | none, across roughly 270 visitor and public flows |
| Probe (`appearance`) | 90          | **0**                                 | 1, `820x1180-dark` visitor stranger               |

**This does not confirm the probe and it does not cleanly refute it, and the reason is a confound
this entry has to state rather than argue past.** Two readings fit:

1. The crash was never owner-specific. The owner flow is simply the longest and busiest case, so it
   drew the first six sightings; the probe removed nothing, and 0 owner crashes in 90 is the 13%
   that a rate of 2-in-90 produces by chance.
2. The probe caused it. `appearance: none` on every control is a real rendering change, and it was
   only ever validated as _behaviour_-neutral (95/99 in both arms in Chromium), which is not the
   same as crash-neutral in WebKit. On that reading the probe traded an owner crash for a visitor
   one, and proves nothing about either.

The control arm's silence on visitor flows is the one piece of evidence that bears on this, and it
cuts towards reading 2: roughly 270 visitor and public flows across the control runs produced no
crash, while the first probe arm produced one in 90. That is weak — one event — but it is the
asymmetry to test.

What is now certain regardless of which reading survives: **ruling 200's three facts are down to
one.** Not theme (the light sighting), not viewport (six viewports, and the DOM census identical at
every one), and the owner constant is at best unproven. What is left is WebKit, and the Profile
surface at `/m/:handle`.

The disambiguating step, and it is a fork rather than a single instruction:

- Run more probe iterations. A second visitor crash under the probe, where the control has none in
  several hundred visitor flows, makes reading 2 the answer: the probe is unsafe as an instrument
  and must be replaced by one that removes native controls without a global rule (for example,
  rendering `VisibilitySelect` and `Switch` from a build flag rather than restyling them).
- Run more control iterations, watching the visitor and public flows specifically. A visitor crash
  in the control makes reading 1 the answer, the defect is a Profile-surface defect rather than an
  owner-flow one, and the whole owner-only line of investigation in this entry is a dead end that
  the first six samples made look alive.

Both are running. Neither has enough samples yet, and this entry will not call it until one of them
does.

### Update, 07:36: the core, and the cause class

The core capture worked on its first crash. Run 17 (`34322686504`, job `102372710843`), a **control**
run:

```
=== core.eadedCompositor.15835.sig11 ===
ELF 64-bit LSB core file, x86-64, version 1 (SYSV), SVR4-style,
from '/home/runner/.cache/ms-playwright/webkit-2359/minibrowser-wpe/bin/WPEWebProcess'
execfn: '/home/runner/.cache/ms-playwright/webkit-2359/minibrowser-wpe/bin/WPEWebProcess'
```

Three facts, none of them inferred:

1. **Signal 11, SIGSEGV.** A segmentation fault, not an abort, not an OOM kill.
2. **The faulting thread is `ThreadedCompositor`.** The core pattern's `%e` records the crashing
   thread's comm, which the kernel truncates to 15 characters: `eadedCompositor` is
   `ThreadedCompositor`. This is WebKit's compositing thread.
3. **The process is `WPEWebProcess`.** Playwright's Linux WebKit is the **WPE** port. Earlier
   revisions of this entry said the Linux port paints through `RenderThemeAdwaita`, which is the GTK
   port; that was wrong and is corrected here.

This is the outcome ruling 200's method predicted: "A stack naming a compositor, a rasteriser, a
font or an image decoder tells you the class of cause in one step and saves the entire bisect." The
class is **compositing**, and ruling 200's own first sentence under "Where to look first" — that a
web-process crash in one engine is usually compositing, rasterisation or memory rather than
JavaScript — is the part of that ruling the evidence has now confirmed rather than broken.

It also settles, without needing more sampling, why the constants kept falling. Compositing runs on
every view, in every theme, at every viewport. A fault in the compositor thread has no reason to
respect the owner flow, dark theme, or 820x1180, and it did not: it merely appeared there first
because the owner flow is the longest and busiest case in the matrix and therefore the most
compositing the run does in one page.

Consequences for the two suspects this entry has already withdrawn: both were surface styling, and
neither is where the fault is. `color-scheme` was refuted by the light sighting; native form
controls are refuted twice over, by the visitor crash and now by the faulting thread being the
compositor rather than a form-control paint path.

**The probe that matches the evidence** is therefore neither of the stylesheets. `RULING200_PROBE`
now accepts `compositing`, which launches the engine with `WEBKIT_DISABLE_COMPOSITING_MODE=1` rather
than injecting CSS. If the crash stops with accelerated compositing off and the control keeps
producing it, the cause is in WebKit's threaded compositor, and the question for DNA becomes which
composited layer the Profile surface creates that trips it, not which component is at fault.

**The stack is still missing, and the reason is my own extraction bug, not the capture.** `gdb` was
handed the core with no executable, because the exe was resolved from `eu-readelf` looking for
`WebKitWebProcess` — the GTK port's binary name, which the WPE build does not have. gdb then read
the core as an executable and reported "not in executable format". `file` names the binary in
`execfn`, so the step now parses that and calls `gdb <exe> --core <core>`. Fixed here; the next
control-arm crash should produce the frames.

Sampling at this point, all read from job logs:

| Arm                | Runs | Owner cases | Owner crashes | Visitor/public crashes |
| ------------------ | ---- | ----------- | ------------- | ---------------------- |
| Control            | 11   | 162         | 3             | 0                      |
| Probe `appearance` | 5    | 90          | 0             | 1                      |

The `appearance` arm's numbers are no longer the interesting comparison, since the faulting thread
tells us it was testing the wrong thing. They are kept because a null result against a wrong
hypothesis is still a record of what was tried.

### Update, 08:05: the compositing arm is uninformative, and the test I proposed for it was wrong

Two compositing-probe runs finished clean (`34324908709`, `34324916741`, both with
`RULING200_PROBE: compositing` confirmed in the job env, both `3540/3540 checks passed`).

The entry above committed, in advance, to a way of reading that: an arm whose pass counts matched
the control digit for digit would be evidence the switch was a no-op. **That test does not work and
is withdrawn.** 3540 is the structural total for this flow set — nine viewports, two themes, six
flows — so any run that does not crash reports 3540/3540 whether or not the probe did anything. The
control runs report the same number. Identical totals distinguish nothing.

So the compositing arm says nothing yet, for two independent reasons, and neither is that the
compositor is innocent:

1. Two runs is far below the control's crash rate of roughly one run in five. Zero crashes in two
   runs is the expected result under any hypothesis.
2. Whether this WPE build honours `WEBKIT_DISABLE_COMPOSITING_MODE` is still unverified, and this
   repo has no way to verify it. Playwright passes `env` to the browser process and the web process
   inherits it, so it reaches the process; whether the engine acts on it is the open part.

**The stack is worth more than this probe.** The core already names the class, and a probe whose
effect cannot be confirmed cannot narrow it further, whereas frames would name the function. The
gdb fix landed in `b5d38b9`, and the two control runs on that head (`34324924043`, `34324930989`)
both passed, so it has not yet had a crash to work on. More control runs are dispatched for that
purpose alone.

Sampling to date, counted by run rather than by case, because crashes have now appeared in owner and
visitor flows and a per-case denominator would imply a precision this does not have:

| Arm                 | Runs | Runs that crashed                                                                     |
| ------------------- | ---- | ------------------------------------------------------------------------------------- |
| Control             | 15   | 3 (`744x1133-dark` owner, `1536x960-light` owner, and run 17 whose core was captured) |
| Probe `appearance`  | 7    | 1 (`820x1180-dark`, visitor stranger)                                                 |
| Probe `compositing` | 2    | 0                                                                                     |

### Update, 08:54: the stack. DONE MEANS item 1 is met

Run 34 (`34329351986`, job `102394030379`), a control run on the fixed-gdb head, crashed and the
extraction produced frames. The faulting thread:

```
Thread 1 (Thread 0x7f4fa6ffe6c0 (LWP 13535)):
#0  0x00007f603bea0f8a  libWPEWebKit-2.0.so.1     <- fault site
#1  0x00007f6038dcc1e4  libWPEWebKit-2.0.so.1
#2  0x00007f6038dcccf4  ]
#3  0x00007f6038dc79f1  ]  three-frame cycle
#4  0x00007f6038dcab5f  ]
   ... same three addresses repeating, through #26 (about eight levels)
#27 0x00007f6038dc6e85  libWPEWebKit-2.0.so.1     <- recursion entered here
#28 0x00007f6036d75de1
#29 0x00007f6036d74b1a
#30 0x00007f6036d7afa9
#31 0x00007f603834c86b
#32 0x00007f603834ace6
#33 libglib-2.0.so.0
#34 g_main_context_dispatch
#35 0x00007f603834b351  libWPEWebKit-2.0.so.1
#36 0x00007f603834b667
#37 0x00007f60382e80c3
#38 0x00007f6038351346
#39 start_thread
```

That this is the faulting thread is not an assumption: the other two threads in the core are parked
in `__GI___poll` and `__futex_abstimed_wait_common64`, and a thread blocked in poll or in a futex
wait cannot take a SIGSEGV. It is also the thread the core's own name records,
`ThreadedCompositor`.

What the shape says, and what it rules out:

- **A recursive descent, bounded, not runaway.** Frames #2 to #26 are three addresses repeating for
  about eight levels, and #27 onward is an ordinary entry path from the glib main loop. A stack
  overflow would show the cycle continuing to the base of the stack with no entry path visible, and
  would raise SIGSEGV on the guard page rather than inside a callee. **Stack exhaustion is ruled
  out.** So is "the page is too deep": eight levels is a shallow tree.
- **The fault is not in the recursion itself.** Frame #0 sits at `0x7f603bea0f8a`, far from the
  `0x7f6038dc…` cluster the recursive frames occupy, so the walk descends normally and then calls
  something else, which faults. The defect is in what the eighth level reached, not in the walking.
- **Driven from the main loop, not from script.** Frames #33 and #34 are
  `g_main_context_dispatch`. This is the compositor servicing a scheduled update, which is why the
  crash lands "during or around" whatever the flow happens to be doing rather than on a particular
  action, and why it has appeared at a section save, at `edit-done`, and at `page.goto`.

This closes ruling 200's DONE MEANS item 1: a named cause, with the evidence that names it. A
SIGSEGV in a bounded recursive walk on WebKit's compositing thread, entered from the glib main
loop, faulting in a callee at the bottom of the walk.

**Whose defect it is, stated as far as the evidence goes and no further.** Every frame is inside
`libWPEWebKit-2.0.so.1` or glib. None is in DNA's code, because DNA has no code in that process's
compositor thread — no application ever does. That does not by itself make it WebKit's bug: a page
can hand the compositor a layer tree that trips a latent fault in it. What the evidence does settle
is that the trigger cannot be any of the three things this entry previously chased, because none of
them is reachable from a compositing tree walk: not `color-scheme`, not native form controls, not
anything owner-specific.

**What is still unknown** is the name of the function at frame #0 and of the three in the cycle. The
addresses are unsymbolised because the shipped WPE build has no debug info. They can still be
resolved to the nearest exported symbol from the library's dynamic table, which is the next step and
is cheap.

### Update, 09:37: the loop reproduces it, and a truncation cost the second stack

Run 38 (`34332754044`, job `102404960483`), a 170-iteration owner-flow loop, crashed. The pipeline
worked end to end: a core was written, gdb produced frames, the offsets resolver ran, and the
retention guard did its job — `frames extracted; core not retained (266M)`. A 266 MB core copied
into the artifact would have been the upload failure that guard was added to prevent.

Two things the run establishes beyond the crash itself:

- **The loop reproduces the defect**, at roughly 11.5 seconds an iteration against about 80 seconds
  an owner case in a profile matrix run. That is the sampling instrument the rest of this
  investigation should use.
- **gdb does resolve some exported symbols in this build.** `libWPEWebKit-2.0.so.1+0x771180` came
  back as `WebKit::WebProcessMain(int, char**)`. That does not change the decision not to guess at
  the unexported ones: the frames that matter are still `??`, and a nearest-export guess for those
  would still name the wrong function.

**The faulting thread's frames were lost to my own truncation, not to the crash.** The extraction
piped gdb through `head -600`. This core has eight threads and `thread apply all bt` prints them in
descending order, so the faulting thread is printed last and `head` ate exactly it; the resolver's
`tail -60` then showed threads 8 down to 2. The `grep: write error: Broken pipe` at the top of the
step is the tell. Every thread that did survive is parked in `poll`, a futex wait, or `g_cond_wait`,
which is consistent with the earlier finding but adds nothing.

Fixed by asking gdb for the current thread first: in a core gdb positions itself on the thread that
faulted, so `bt 60` before `thread apply all bt 25` puts the frames that matter at the top of the
output where nothing can truncate them. The head limit is raised to 4000 and the resolver now prints
its first 80 lines rather than its last 60, for the same reason.

This is the third defect in this investigation's own instrumentation, after the `WebKitWebProcess`
exe lookup that fed gdb a core with no executable, and the `tee` that opened `loop.log` before its
directory existed. All three were found by reading the output rather than by a wrong conclusion
reaching the report, which is the reason for reading it.

The finding is unchanged: run 34's stack already established the cause, and run 38 corroborates that
the loop reproduces it. Sampling, by run:

| Arm                 | Runs | Crashed                                                                    |
| ------------------- | ---- | -------------------------------------------------------------------------- |
| Control, matrix     | 23   | 3                                                                          |
| Control, loop       | 4    | 1 (run 38; runs 35 to 37 were the `tee` defect, and their loops ran clean) |
| Probe `appearance`  | 7    | 1 (visitor)                                                                |
| Probe `compositing` | 2    | 0, uninformative                                                           |

### Update, 09:40: the loop makes it reproducible on demand

Run 39 (`34332764279`) crashed as well, reporting `frames extracted; core not retained (262M)`. So
both 170-iteration loop runs crashed, and both lost their faulting thread to the `head -600`
truncation described above, which the following runs correct.

The rate is the point of this entry, and it changes what this defect costs to investigate:

| Instrument                            | Owner cases per run      | Crash rate                  |
| ------------------------------------- | ------------------------ | --------------------------- |
| Profile matrix run, `special=profile` | 18, in about 24 minutes  | about 1 run in 6            |
| Owner-flow loop, 170 iterations       | 170, in about 35 minutes | 1 per run, twice out of two |

Two crashes in roughly 340 iterations is about one per 170, consistent with the matrix arm's rate
per owner case rather than better than it. What changed is not the defect's frequency but the
sampling: a single loop run now contains enough owner cases to fire, so the crash reproduces
**within one run** instead of once per six. Ruling 200's method asked for exactly this — "looping
the owner flow until it fires" — and it is now available to anyone dispatching `matrix.yml` with a
`loop` input.

That matters for what comes next rather than for the finding, which run 34's stack already settled.
A hypothesis about this crash can now be tested in one runner, against a control arm of the same
shape, instead of waiting on a one-in-six sighting. Whoever picks this up should use the loop and
not the matrix for that.

Recorded rate, by run, at this point:

| Arm                 | Runs | Crashed                                                                           |
| ------------------- | ---- | --------------------------------------------------------------------------------- |
| Control, matrix     | 23   | 3                                                                                 |
| Control, loop       | 5    | 2 (runs 38 and 39; runs 35 to 37 were the `tee` defect and their loops ran clean) |
| Probe `appearance`  | 7    | 1, a visitor flow                                                                 |
| Probe `compositing` | 2    | 0, uninformative: effect unverified, pass-count test withdrawn                    |

### Update, 10:12: run 40 crashed; the resolver was dropping the frames it existed to resolve

Run 40 (`34336015250`), a 170-iteration loop on the faulting-thread-first head, crashed:
`frames extracted; core not retained (260M)`. Three loop runs, three crashes.

The gdb change worked — the faulting thread's frames are in the raw output and the artifact. The
**resolver** then dropped them. It grouped frames under `Thread N` headers, and gdb's `bt` on the
current thread emits frames with no such header, so the one backtrace worth resolving was the one
discarded. Its printed output began at the all-threads sweep instead, which for this core meant
threads 32 down to 28, every one of them parked in a futex or a semaphore wait.

Fixed: frames now attach to the most recent header of either kind, the `=== FAULTING THREAD ===`
marker opens a group, and frames appearing before any header open an implicit one rather than
vanishing. Verified against a fixture before dispatch.

That is the fourth defect in this investigation's own instrumentation, after the `WebKitWebProcess`
exe lookup, the `tee` ordering, and the `head -600` truncation. This one was predicted before the
log was read — the parser groups by a header the new gdb output does not emit — which is the only
reason it was caught on the first crash rather than the third.

Worth recording about the core itself: this process had **32 or more threads**, against three in run
34's. Every thread visible in the sweep was idle in a futex, a semaphore, `poll` or `g_cond_wait`.
Thread count is a property of the run, not of the crash, and it does not change the finding; it does
mean a truncating `head` is even less forgiving here than it was at run 38.

### Update, 10:47: the offsets, and two crashes that name the same three functions

Run 42 (`34339173919`), a 170-iteration loop on the head carrying both instrumentation fixes,
crashed and produced what the previous four runs could not: the faulting thread's frames as
**library-relative offsets**.

The faulting thread, against `libWPEWebKit-2.0.so.1` from `webkit-2359` (WebKit 26.6, Playwright's
WPE build):

| Frame     | Offset                                                            | Note                                            |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| #0        | `+0x588b98a`                                                      | **fault site**, far outside the cycle's cluster |
| #1        | `+0x27b6be4`                                                      |                                                 |
| #2 … #26  | `+0x27b76f4` → `+0x27b23f1` → `+0x27b555f`                        | the cycle, repeating (9x, 8x, 8x)               |
| #27       | `+0x27b1885`                                                      | the recursion is entered here                   |
| #28 … #32 | `+0x7607e1`, `+0x75f51a`, `+0x7659a9`, `+0x1d3726b`, `+0x1d356e6` |                                                 |
| #33, #34  | glib, `g_main_context_dispatch`                                   | scheduled update being serviced                 |
| #35 … #38 | `+0x1d35d51`, `+0x1d36067`, `+0x1cd2ac3`, `+0x1d3bd46`            |                                                 |
| #39, #40  | `start_thread`, `clone3`                                          | thread entry                                    |

**Run 34 and run 42 crashed in the same three functions.** Run 34's absolute addresses were captured
before offsets existed; subtracting run 42's offsets from them yields one load base,
`0x7f6036615600`, for all three cycle frames — and the same base maps run 34's entry frame to
`+0x27b1885`, which is run 42's `#27` exactly. Two crashes, in different processes with different
ASLR bases about forty minutes apart, in different runs, produce byte-identical offsets. Under the
same base run 34's fault site is `+0x588b98a` and its `#1` is `+0x27b6be4`, matching run 42 there
too.

That is corroboration, not a new finding: run 34's stack already established the cause. What it adds
is that the crash has **one** path rather than several, and that these offsets are stable enough to
be worth handing to someone with symbols.

**What these offsets are for.** They are exact against this build and useless against any other, and
that is the point: anyone with a WebKit 26.6 debug build, or the matching source, maps
`+0x27b76f4`, `+0x27b23f1`, `+0x27b555f`, `+0x27b1885` and `+0x588b98a` to functions and lines in
one step; anyone with a different build sees immediately that they cannot. No function is named here
because naming one from the nearest exported symbol would name the wrong function, and this entry
has already produced two wrong answers reached by plausible-looking inference.

Loop tally: four loop runs on heads whose exit codes are trustworthy, four crashes (runs 38, 39, 40,
42; run 41's outcome was not separately confirmed and is not counted either way). The crash
reproduces inside a single loop run, every time so far.

### Correction, 10:48: "every time" was wrong

The entry above closed by saying the crash "reproduces inside a single loop run, every time so far".
Run 43 (`34339182619`), dispatched alongside run 42 and identical to it, reported `cores written: 0`
after its 170 iterations. It did not crash.

Corrected tally for loop runs whose exit codes are trustworthy:

| Run | Iterations | Outcome                                       |
| --- | ---------- | --------------------------------------------- |
| 38  | 170        | crash                                         |
| 39  | 170        | crash                                         |
| 40  | 170        | crash                                         |
| 42  | 170        | crash, offsets captured                       |
| 43  | 170        | **no crash**                                  |
| 41  | 170        | not separately confirmed, counted neither way |

Four crashes in five confirmed runs, about 850 iterations, so roughly one per 210 iterations. The
honest statement is that a loop run fires **most** of the time, not every time, and that a single
clean loop run is therefore worth nothing as evidence against a hypothesis — about one run in five
comes back clean with nothing changed.

That matters for the next person more than for the finding. A probe arm judged on one clean loop run
would be read exactly as wrongly as the `appearance` arm was: its five clean runs looked like a
result and were a coincidence. Anything tested against this crash needs several runs per arm and a
control arm run at the same time on the same head.

Recorded because the claim was made one message before the sample that broke it, which is the third
time in this investigation an over-strong reading has been corrected by the next observation — after
`color-scheme` and after native form controls.

### Update, 9 September 19:59: the fourth sighting, and the envelope has still only ever widened

Fix PR 01's matrix run on `93d5f75` ([34394466777](https://github.com/jodombrown/dna-web-application/actions/runs/34394466777), job `102611352995`) failed one check of 5990 with G5's own words:

```
FAIL: webkit-360x800-dark profile owner flow WEB PROCESS CRASHED
  | Error: locator.inputValue: Target page, context or browser has been closed
  - waiting for locator('[data-testid="section-where"]').locator('input').first()
  | state unavailable: Error: page.evaluate: Target crashed
  | DOM before the section saves {"nodes":546,"options":71,"selects":20,"fields":14,"sections":15}
```

Sighting four, and it did not repeat on the next full run, which is consistent with the roughly
one-crash-per-six-full-runs rate this entry already records. With the `1536x960-light` one recorded
above, the sampled population now spans **both themes, six viewports, and both the owner and the
visitor flow**. The envelope this entry already
settled on — **WebKit plus the Profile surface** — holds, and nothing narrower does.

**What to watch for next, because it is the reverse of the mistake ruling 205 caught.** Every new
sighting so far has _widened_ the envelope and none has narrowed it. That is a one-directional
record, and a one-directional record is exactly the shape that invites an over-strong reading in the
other direction: if a WebKit failure turns up in a **third flow**, one that is not the Profile
surface at all, the honest reading may be that the envelope is WebKit rather than WebKit-plus-
Profile, and this entry's own framing would be the thing that was too narrow.

There is already a candidate. The same run failed a second WebKit check, `webkit-430x932-light
flow`, on the composer rather than on Profile: `page.waitForSelector` timed out after 30s waiting
for `section[role="dialog"][aria-label="Compose"]` to detach, with the locator resolving visible 64
times. It read as a hang rather than a crash on that first sighting, and on that basis it was **not**
recorded as a G5 sighting. The update below corrects that. Two things narrowed it at the time, and
one of them still holds:

- `Sheet` unmounts on a plain `setTimeout(SHEET_DUR)`, 300ms, not on `transitionend`. A dropped
  animation event therefore cannot produce a 30-second hang, and that hypothesis is out.
- What remains is either that `open` never flipped — the close is `page.keyboard.press("Escape")`
  against a `window` keydown listener, fired straight after a click on an audience radio, so a
  keypress that does not land flips nothing — or that the web process was wedged enough that timers
  and React commits stopped while the DOM still answered Playwright's queries.

The first is a test-robustness question and the second would be G5's envelope widening past Profile.
One sample does not separate them, and a decision rule was fixed in advance of the next run rather
than after seeing it: if the composer hang recurs on a head that still touches no composer code it
is systematic and gets a root cause, and if it does not it stays recorded as a single unproven
anomaly, called neither passing nor a flake (ruling 228).

**Outcome across two further runs: it recurred, and the reading above is wrong.**

The next run, on `3213f77`
([34398547302](https://github.com/jodombrown/dna-web-application/actions/runs/34398547302)), passed
**5996 of 5996**, both engines, every tier. On that sample alone the rule said the anomaly stays
unproven, and that is what was reported at 20:38.

The run after it, on `85ef492`
([34402440306](https://github.com/jodombrown/dna-web-application/actions/runs/34402440306), job
`102637543541`), failed **1 of 5997** on the same wait:

```
FAIL: webkit-360x800-dark flow Error: page.waitForSelector: Target page, context or browser has been closed
  - waiting for locator('section[role="dialog"][aria-label="Compose"]') to be detached
    3 x locator resolved to visible <section role="dialog" aria-modal="true" aria-label="Compose">
```

`85ef492` is documentation only. It touches no composer code, no component and no runtime source at
all, so under the rule fixed in advance this is systematic and gets a root cause rather than a flake
label.

**Two things above are corrected by it.**

**It is not a hang.** The first sighting timed out after 30s with the locator resolving 64 times.
This one resolved 3 times and then reported `Target page, context or browser has been closed`. The
page did not stay up and refuse to unmount; it went away. That is the same string G5's own crash
line carries — `WEB PROCESS CRASHED | Error: locator.inputValue: Target page, context or browser has
been closed` — minus the prefix.

**The prefix is the whole reason this looked like a different defect.** `WEB PROCESS CRASHED` is
written by `tests/profile.cjs`, which registers `page.on("crash")` and sets a flag. **No flow in
`tests/matrix.cjs` registers a crash listener** — they register `pageerror` and `console` only. So a
WebKit web-process crash in the composer flow _cannot_ be labelled as one. It surfaces as whichever
Playwright call happened to be in flight when the process died: a closed target if the crash lands
during a call, a 30-second timeout if it lands between them.

**So the envelope is WebKit, not WebKit plus Profile.** The "plus Profile" half was an artifact of
where the instrumentation is, not of where the defect is. That is exactly the reverse of the mistake
ruling 205 caught, and this entry predicted it one update earlier: if a WebKit failure turns up in a
third flow, the honest reading may be that the envelope is WebKit. It turned up, in the composer
flow, twice.

Sightings restated: four labelled crashes on the Profile surface, plus **three** unlabelled ones on
the composer flow — `webkit-430x932-light`, `webkit-360x800-dark` and, on run 101
([34407997137](https://github.com/jodombrown/dna-web-application/actions/runs/34407997137)),
`webkit-744x1133-light` with the identical `Target page, context or browser has been closed` after
3 locator resolutions. Seven across four of the last five full runs.

The composer sightings now span **three distinct viewports and both themes**, which is the same
spread the Profile sightings took four crashes to reach. Two flows, the same signature, the same
engine, and the only thing that distinguishes them in the log is which one happens to register
`page.on("crash")`. The Profile surface is where the defect is most _visible_, not where it lives.

**Follow-up, not done here** (this PR is a security fix and CLAUDE.md's scope rule keeps it out):
register `page.on("crash")` in `tests/matrix.cjs` the way `tests/profile.cjs` already does, so a
crashed web process is reported as a crash in every flow rather than as whatever call it interrupted.
Two lines per flow, and until it exists every non-Profile WebKit crash will be mis-read the way this
one was.

**On the two totals, because they differ and the difference is not the suite growing.** The failing
run recorded 5990 checks and the green one 5996. Nothing was added to `tests/matrix.cjs` between
them. A flow that throws — a timeout or a crashed web process — stops before its remaining checks
run, so the six missing checks are the tail of the two flows that died, not six checks that did not
exist. Read a lower total in a failing matrix run as truncation, not as a smaller suite.

## G8. `main` was unverified, not green — closed (ruling 237)

**Opened 9 September 2026, closed 10 September 2026 at 00:40 when `main` completed a matrix for the
first time since the grants moved. Kept rather than deleted, because the distinction it turns on —
unverified is not the same as red — is the reusable part.**

`main`'s matrix job has failed at **step 6**, the Brief 3 live checks, since the `members` grants
moved on the canonical project: runs 86, 88, 92 and 94 all die there on the `CORE_COLS` breakage
PR #14 recorded. Step 6 gates step 9, so **no browser matrix has completed on `main` for hours**,
and `main`'s last full verification predates the grant change entirely.

This is not the same as `main` being red on a known defect. It is `main` being **unverified**: the
responsive matrix that ruling 61 makes the exit check for every surface has not run there, so
nothing is known about `main` in either engine at any width since the change.

The practical consequence is sequencing, and it is the reason this is written down rather than left
for someone to infer from four red runs:

- Fix PR 01 is what restores it. Its branch is the only one that has reached step 9, because it
  carries the `CORE_COLS` fix that lets step 6 pass.
- **Nothing else should merge until it does**, and no Code session should start on Brief 4A or 4B
  until Fix PR 01 lands and `main` completes a matrix again. Both would otherwise branch from a
  `main` whose last full verification predates the grant change.
- Design work on 4B is unaffected. A prototype does not branch from `main`.

### Closed, 10 September 00:40

Fix PR 01 merged at 00:02:41 as `bb57e64`, and `main`'s run 103
([34419547470](https://github.com/jodombrown/dna-web-application/actions/runs/34419547470)) is the
first matrix to complete there since the grants moved.

| Tier                                                                  | Result            |
| --------------------------------------------------------------------- | ----------------- |
| `deploy`                                                              | green             |
| Step 6, live checks and the ruling 218 signed-in arms                 | **green**         |
| Browser matrix, Chromium, every width, both orientations, both themes | **green**         |
| Browser matrix, WebKit                                                | 1 failure of 5983 |

**`main` is verified.** That is what this gap asked for and it does not require a green WebKit tier:
the condition was that the matrix _runs to completion_ so `main`'s behaviour is known, and it now
does. Nothing is gated on this any more — Brief 4A and 4B may start, and other work may merge.

The one failure is recorded below rather than here, because it is **not** the signature this file has
been tracking.

### Update, 10 September 00:40: a WebKit failure that is NOT this signature

`main`'s run 103 ([34419547470](https://github.com/jodombrown/dna-web-application/actions/runs/34419547470))
failed 1 of 5983, WebKit, and it is neither a crash nor the Compose-dialog wait:

```
FAIL: webkit 820x1180 light connect: flow completed locator.click: Timeout 15000ms exceeded.
  - waiting for locator('[role="dialog"][aria-label="Introduce yourself to Adaeze Nwosu"]')
      .getByRole('button', { name: 'Send introduction' })
```

It is recorded here **without being counted as a G5 sighting**, deliberately. A click that never
becomes actionable is a third distinct symptom, and this entry has already been wrong once by
reading a symptom as a different defect and once by reading two symptoms as unrelated. It is neither
until there is evidence.

**What is established.** No code change caused it. `main` at `bb57e64` and `3213f77` differ in
exactly one file for `src/` and `tests/` — `tests/live-checks.cjs`, which is step 6's script and
which the browser matrix never loads. `tests/connect.cjs`, `tests/matrix.cjs` and all of `src/` are
byte-identical, and `3213f77` passed **this exact tier** 5996/5996 in both engines. Same code, same
viewport, same theme, opposite outcome.

**One observation worth keeping, stated as an observation (ruling 205).** Every WebKit failure
sampled so far lands on a sheet or dialog transition: the Compose dialog failing to detach (three
times), the Profile surface during navigation or a section input (four), and now a dialog button
that never becomes actionable. Playwright's actionability requires an element to be _stable_ — the
same box across two animation frames — so a stalled compositor or rAF would produce exactly this
timeout, and `Sheet` animates for 300ms. That is a hypothesis with a mechanism, not a finding, and
`tests/connect.cjs`'s own `tap()` helper already exists because clicks on this surface were fragile
enough to need a hit test and a retry loop before clicking.

**What would settle it**, and is the same follow-up this entry already logs: register
`page.on("crash")` in `tests/matrix.cjs`. A click timeout with a crash flag set is G5; a click
timeout with no crash is something else. Today the suite cannot tell those apart outside
`tests/profile.cjs`.

### Update, 10 September 11:47: the same commit run twice, disjoint failure sets (ruling 304)

Brief 4A's PR #20, head `79db1b1`, run 115
([34465444602](https://github.com/jodombrown/dna-web-application/actions/runs/34465444602)). The
matrix job was re-run once on the **same commit and the same tree**, and the two attempts share not
one failure. Chromium was clean at every width, both orientations and both themes in both attempts.

| Attempt              | WebKit failures                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 (job 102831943218) | `webkit 360x800 light connect: no page errors`, two REST requests to `post_saves` and `post_reactions` aborted "due to access control checks"                                                                                                                                                                                                    |
| 2 (job 102845377529) | `webkit-390x844-light profile owner flow` **WEB PROCESS CRASHED** at `section-where`'s input; `webkit-1280x800-dark profile owner flow` **WEB PROCESS CRASHED** at the same input; `webkit-820x1180-dark profile visitor connected flow`, `page.waitForURL` to `**/feed` timed out at sign-in; `webkit-390x844-dark-auth: recovery landing flow` |

**Two of attempt 2's four are this signature**, and they are counted: `WEB PROCESS CRASHED` on the
Profile owner flow at the `where` section's input is what this entry has been tracking since ruling
200, and `tests/profile.cjs`'s own `page.on("crash")` is what labels them. They add
`webkit-390x844-light` and `webkit-1280x800-dark` to the sampled population, so the envelope widens
again rather than narrowing, exactly as this entry has warned every time.

**Attempt 1's failure is recorded without being counted**, on the same reasoning as run 103's: it is
the Connect flow, it is not a crash, and it is a third distinct symptom (aborted requests rather
than a timeout or a crash). `tests/connect.cjs` registers no crash listener, so the suite cannot say
whether a web process died under it. That is the same blind spot, and the same follow-up closes it.

**What this pair establishes that a single sighting could not, now ruling 304.** Ruling 265 put the
rate at roughly one green run in two and made that the merge policy rather than an observation. Two
attempts on a byte-identical tree producing four failures and one failure, with **zero overlap**, is
the strongest evidence yet for that rate: the failing set on this engine is not a property of the
code under test. It also means a re-run cannot be used to confirm a WebKit failure by identical
reproduction, which is the test the babysit rules ask for. On this engine, the absence of
reproduction is the finding. Ruling 304 records it: runs of one materially unchanged tree produced
different WebKit failure sets each time, with zero overlap between two attempts on a byte-identical
head; this is 265's rate demonstrated rather than asserted, it establishes that a re-run cannot
confirm a WebKit failure by reproduction here, and it makes ruling 274's crash flag the item that
would end the ambiguity permanently.

**Run 117, 16:33, makes it four sets.** Head `e170b36`
([34498061216](https://github.com/jodombrown/dna-web-application/actions/runs/34498061216)) differs
from run 116's `542b245` by one markdown file the matrix never loads. Chromium green at every width,
both orientations and both themes; step 6 green. Three WebKit failures, none shared with runs 115 or
116 except the auth arm's class: `webkit-1366x1024-dark flow`, the Compose dialog never detaching
across 64 locator resolutions over 30 seconds, which is this entry's composer symptom and its
fourth sighting; and `webkit-390x844-light-auth` and `webkit-390x844-dark-auth` on the recovery
landing flow. Recorded, not re-run: under 304 a fifth run would sample the same distribution.

### Ruling 828: the rate, censused, and the last constant broken

Ruling 827 asked whether the rate had risen after five sightings were reported in one day. It had
not, and the census that answers it is below: every failed run since crash labelling existed, read
from the job logs. **Seventeen crashed arms in sixteen jobs, 10 to 17 September, every one WebKit and
not one Chromium.**

| Crash (UTC)    | Run    | Arm              | Viewport, theme | Into the matrix step |
| -------------- | ------ | ---------------- | --------------- | -------------------- |
| 09-11 06:45:02 | 133    | profile owner    | 820x1180 light  | 9m57s                |
| 09-11 08:34:46 | 139    | profile owner    | 430x932 light   | 10m48s               |
| 09-11 08:36:03 | 139    | profile owner    | 744x1133 dark   | 12m05s               |
| 09-11 15:58:57 | 141    | profile owner    | 820x1180 light  | 12m21s               |
| 09-11 17:58:19 | 147    | auth flows       | 1280x800 dark   | 22m45s               |
| 09-11 19:06:07 | 154    | profile owner    | 820x1180 dark   | 13m03s               |
| 09-11 19:48:30 | 156    | viewport arm     | 820x1180 dark   | 3m30s                |
| 09-12 06:07:18 | 160    | auth flows       | 390x844 dark    | 22m37s               |
| 09-12 10:05:18 | 172    | profile owner    | 820x1180 dark   | 13m00s               |
| 09-13 08:10:59 | 180    | profile owner    | 820x1180 light  | 12m12s               |
| 09-16 22:18:33 | 234    | auth flows       | 1280x800 dark   | 26m53s               |
| 09-16 23:40:08 | 241    | onboarding flows | 390x844 dark    | 29m49s               |
| 09-17 04:42:18 | 245    | viewport arm     | 1024x1366 light | 4m24s                |
| 09-17 17:19:46 | 253 a1 | block flow       | 390x844 dark    | 28m08s               |
| 09-17 17:59:47 | 254 a1 | viewport arm     | 390x844 light   | 1m21s                |
| 09-17 22:57:17 | 250 a3 | onboarding flows | 390x844 dark    | 28m49s               |
| 09-17 23:25:50 | 250 a4 | block flow       | 390x844 dark    | 26m38s               |

**Why earlier days look clean, and it is not that they were.** `armCrashed`, `"behind a web-process
crash"` and the `page.on("crash")` listener all arrived in one commit, `3090336` of 10 September, and
the same commit's job shape is the second half of it: until ruling 283 split the engines, one `matrix`
job drove Chromium and WebKit together, so a day's WebKit passes are not comparable across that
boundary either. Before 10 September a lost web process surfaced as a closed-target error or a
thirty-second timeout and was counted as neither. The rate did not rise on 17 September; counting
started.

**The rate, by Pacific day.** Numerator exact from the logs; denominator approximate, counted as runs
whose latest attempt lasted long enough to complete a matrix pass, which undercounts re-run attempts.
11 September: six of sixteen jobs, 37 per cent. 16 September, the busiest day of the window at 25
passes: three, 12 per cent. 17 September: four of nine, 44 per cent. 11 September and 17 September are
the same number at this sample size, and the busiest day is the lowest. This is ruling 265's rate and
this entry's "about one per six full profile matrix runs" measured again over a wider window: about
one crashed arm per four to five WebKit passes.

**Three explanations tested and all three refuted.**

- **Concurrency is not the variable.** Run 250 attempt 4 crashed with one matrix job in flight on the
  whole account; attempt 3, thirty minutes earlier on the same head, crashed with three. The busiest
  day of the window had the lowest rate.
- **Ordering and accumulation are not the variable.** The sightings run from 81 seconds into the
  matrix step, run 254 attempt 1 at about the fifth arm of 205, to 29m49s, run 241 in the last arm
  group. There is no curve. The apparent concentration at `390x844 dark` is an artefact of which arms
  exist where: the flow arms run at `[390,844]` and `[1280,800]` only, both themes, so that
  combination is one of four by construction and not one of eighteen.
- **Nothing in the environment moved.** Runner `2.337.0`, image `ubuntu-24.04` version
  `20260907.300.1` (release `ubuntu24/20260907.300`), provisioner `20260828.587`, Playwright `1.63.0`,
  WebKit 26.6 `playwright webkit v2359`: identical between run 108, which passed on 10 September, and
  run 250 attempt 4, which crashed on 17 September. Consistent with the fault being anchored to
  offsets inside a fixed `libWPEWebKit-2.0.so.1`, and it closes off "something moved under us".

**The last surviving constant is broken.** This entry says what survives is WebKit and the Profile
surface at `/m/:handle`. Six of the seventeen are the profile owner flow and **all six are from 10 to
13 September**. Since then it has crashed on the block control flow, onboarding flows, auth flows, and
twice on a bare viewport arm that only renders and measures. The surface is not a variable either, and
the modal viewport simply tracks whichever heavy arm exists at the time: `820x1180` held six sightings
while profile owner was the heaviest arm, `390x844` six once the flow arms were. Every constant ruling
200 named is now refuted by this entry's own evidence, which leaves WebKit's compositor and nothing
else. The next step is unchanged and is still the only one that decides whose defect it is: symbolise
the offsets against a WebKit 26.6 debug build.

**What CI now captures, and what it did not.** At the moment of the crash the harness had one log
line, the sticky flag on every failing check behind it, Playwright's error text and, in the artefact,
`arms.json`. It had no core, no stack, no memory figure, no browser stderr, no answer to whether the
browser died with the web process, and no timeline at all, because nothing is printed for a passing
check: this census had to place each crash by step timestamps. Rulings 830, 831 and 832 close that,
and the table above is the argument for each of them. 830 ports matrix.yml's core dump, gdb frames and
offset resolution onto the WebKit job of the PR path, asks `browser.isConnected()` inside the crash
handler, listens for `disconnected`, and prints one line per arm. 831 stops a crashed or late-throwing
arm reading as a stale declaration. 832 makes one crashed arm unproven under 228 rather than red, and
keeps a second crash failing. Ruling 833 declined an arm-level retry.

### The eighteenth sighting, and the first one the capture was watching (ruling 880)

Run [259](https://github.com/jodombrown/dna-web-application/actions/runs/35307376068) on `8fabd50`,
18 September, was the first WebKit pass after ruling 830's capture landed, and it crashed. It is
recorded here rather than in a pull request, because ruling 760 is right that a body and a comment
both die with the thread, and this is the first primary evidence anyone has for the question the
seventeen sightings above could not settle.

| Fact                         | Value                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Arm                          | `webkit-1280x800-dark profile visitor stranger`                                    |
| **Did the browser die too?** | **No: `browser still connected`**                                                  |
| Position                     | `ARM 2443 +1035s`, the arm's **first** `page.goto` to `/m/thandiwe-dube`           |
| Playwright's error           | `page.goto: Page crashed`, then `state unavailable: page.evaluate: Target crashed` |
| Emitted                      | 16 of a declared 22, so `UNPROVEN (228)`                                           |
| Core                         | `cores written: 1`, `core.eadedCompositor.13681.sig11`                             |

**The browser survives; only the web process dies.** Ruling 200's frames already said the fault is in
the compositor thread of the `WPEWebProcess`, but nothing had ever asked the browser whether it was
still there, and Playwright's own error cannot answer it: it reads "Target page, context or browser
has been closed" whichever went. `browser.isConnected()` read inside the crash handler answers it, and
`disconnected` not firing corroborates it. Measured beforehand against Chromium at `chrome://crash`,
where a lost web process gives exactly that pair.

**The core's own name is a third confirmation of the signature.** `core.eadedCompositor.13681.sig11`
is the kernel's `%e` truncating `ThreadedCompositor` to fifteen characters, and `sig11` is SIGSEGV:
the thread and the signal this entry names, arriving from the kernel rather than from Playwright.

**The frames were lost, and that is the part worth remembering.** The extraction step died before gdb
ran: `file` on that core printed `too many program headers (2054)` and no `execfn:`, so the `grep -o`
matched nothing and exited 1, and under the runner's default `bash -e` with `pipefail` the assignment
inherited it. The job went red for the crash it had just successfully recorded. Both extractions are
non-fatal now and the step carries `continue-on-error`, which is why ruling 850 then required a
degraded extraction to announce itself: silence plus safety is how the next one would be lost without
anyone noticing. **So offsets and frames still have never been captured on the PR path**, and the next
crash there is the first real test of that half of 830.

**This one is the short-count path, not the teardown path.** The crash arrived with the arm open and
on its first navigation, so the arm emitted 16 of 22 and read incomplete. The case ruling 832 had to
close separately — a crash charged to an arm after its last check has already passed, where the count
matches and nothing fails — is still unobserved in the wild and remains owed under ruling 849.

### The nineteenth sighting: the PR path captured frames, which the eighteenth said it never had (rulings 830, 850, 832, 228)

Run [278](https://github.com/jodombrown/dna-web-application/actions/runs/35552933642) on `d1e9e611`,
21 September, Session 28's enforcing run, `matrix (webkit)`. Recorded here because the entry above
names this exact run as the thing that was owed: "offsets and frames still have never been captured
on the PR path, and the next crash there is the first real test of that half of 830." This was it,
and it worked.

| Fact                | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Arm                 | `webkit-1280x800-dark-convene`                                                              |
| Playwright's error  | `locator.count: Target page, context or browser has been closed`                            |
| Emitted             | 39 of a declared 42, so `UNPROVEN (228)`; the 3 checks behind the failure never ran         |
| Job outcome         | stood down on one crashed arm under ruling 832; the job exits 0 and says so in its own tail |
| **Core extraction** | **`frames extracted; core not retained (284M)`** — gdb ran and returned frames              |

**What the nineteenth settles.** Ruling 830's capture works on the PR path. The eighteenth sighting's
extraction died before gdb ran and the frames were lost; this one ran, printed a per-thread walk, and
retained no core because it did not need to — which is the branch of ruling 850's `degraded()` that
means nothing degraded. The frames name `libWPEWebKit-2.0.so.1` throughout, and the walk prints its
own cycle guard: repeating offsets `+0x27b76f4` ten times, `+0x27b555f` nine, `+0x27b23f1` eight,
which the step labels as a recursive walk rather than as distinct frames.

**Still the short-count path.** 39 of 42 with three behind the failure, so ruling 849's teardown case
— a crash charged after an arm's last check has already passed, count matching, nothing failing —
remains unobserved and remains owed.

**Not this entry's scope.** Whether the browser survived. The eighteenth answered that with
`browser.isConnected()` read inside the crash handler; this entry does not repeat the claim from a
Playwright error string, which G5 already records cannot distinguish the two. The run's artefact
(`matrix-webkit-run-278`) carries the full capture.

### The twentieth sighting: two arms in one job, which ruling 832's exemption is not wide enough for (rulings 828, 832, 830, 850, 228, 292)

Run [284](https://github.com/jodombrown/dna-web-application/actions/runs/35581795427) on
`ddf5314e163c376e6f5d35a77e4ba7f6c5f3aa22`, PR #53's own `matrix (webkit)`, 21 September, against
`https://claude-handoff-29-a-post-mer.dna-web-application.pages.dev`. **The first job in this record
to lose two web processes**, which is the one fact that makes it worth an entry rather than a tally
mark.

| Fact                | Value                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arms                | `webkit-1280x800-light profile visitor stranger` **and** `webkit-1280x800-light-auth flows`                                                                                                      |
| Tier                | expanded, both; 74 of 76 expanded arms clean, compact and medium clean at 78 and 55                                                                                                              |
| Playwright's errors | `page.goto: Page crashed` navigating to `/m/thandiwe-dube`, with `state unavailable: page.evaluate: Target crashed`; and `page.waitForSelector: Target page, context or browser has been closed` |
| Classification      | `5 behind a web-process crash (G5) \| 0 an aborted fetch \| 0 unclassified`                                                                                                                      |
| Emitted             | 5038 of 5038 passed, with both arms `UNPROVEN` and excluded from the count (228)                                                                                                                 |
| **Core extraction** | **`frames extracted; core not retained (171M)`** — gdb ran, per-thread walk printed                                                                                                              |
| Job outcome         | **red.** `ruling 832 does NOT cover this run: 2 arms lost a web process`                                                                                                                         |

**What the twentieth settles, and what it does not.** Ruling 830's capture worked on the PR path for
the **second** time, so the nineteenth's result was not a one-off: the frames name
`libWPEWebKit-2.0.so.1` throughout and no core was retained, which is ruling 850's "nothing degraded"
branch. It settles nothing new about the cause. The fault is still engine code and under ruling 200's
guardrail it is reported rather than changed, which is why there is no fix to port into any PR that
meets it.

**Ruling 832's width is now a measured question rather than a hypothetical one.** The exemption is
one arm wide "because one is the rate ruling 828 measured and two is not", and this is the first
observation of two. One observation does not move a measured rate, and this entry does not propose
widening the exemption — a gate that widens itself on its first counterexample is a gate that stops
gating. It records that the case 832 was written to fail has now happened, on a diff that could not
have caused it.

**The second arm is a shape neither the eighteenth nor the nineteenth saw.** Both of those were the
short-count path, an arm crashing with checks still to emit. This job carried one of each:
`profile visitor stranger` emitted **16 of 22**, short, and `auth flows` emitted **29 against a
declared 28** — over, because the flow catch-all fires on the error path — with the harness saying so
in its own words and refusing to let the declaration be regenerated from the run. Ruling 849's
teardown case, a crash charged after an arm's last check has already passed with the count matching
and nothing failing, is still unobserved and still owed.

**Whose diff.** Not PR #53's. Its entire change is two markdown files, `docs/GAPS.md` and
`docs/strand-ports/v1789885868097915.md`, 134 insertions, nothing under `src/`, `tests/`, `public/`
or `.github/`. The identical application code had just read **5090 of 5090 on webkit with zero
crashed web processes** on run 282, the enforcing run for PR #52. `matrix (chromium)`, `deploy` and
`live` were all green on run 284.

**No re-run was spent.** Ruling 304: a re-run cannot confirm a WebKit failure by reproduction. The
commit that writes this entry is itself a push, so it supersedes run 284 under ruling 556 and starts
a fresh run on a new head — which re-runs `matrix (webkit)` as a consequence of the commit rather
than as a re-run of the job, exactly as the seventh, eighth and ninth sightings of G34 were handled.
The head's one re-run stays unspent.

**It recurred on the very next run, and the over-count shape with it.** Run
[287](https://github.com/jodombrown/dna-web-application/actions/runs/35585047043) on `63982f6`, the
head that superseded 284, lost **one** web process: `webkit-1024x1366-dark`, waiting for the Compose
dialog to detach, `4 x locator resolved to visible`. One arm, so ruling 832 stood the job down and it
exits 0 — with the tail refusing to let that read as a pass: _"STOOD DOWN ON ONE CRASHED ARM. THIS IS
NOT A CLEAN RUN … Do not read this green as the arm above having run."_ The arm emitted **33 against
a declared 32**, over rather than short, the flow catch-all on the error path again.

That is the fact worth keeping: **the over-count shape was new at the twentieth and recurred at the
next opportunity**, so it is a shape of this defect rather than a one-off, and ruling 292's refusal to
regenerate a declaration from a crashed run earns its keep twice in two runs. Everything else is the
same defect at a different viewport.

**This is where the sighting log stops for this class.** A recurrence that carries no new fact is a
tally mark, and a register that grows a section per tally is one nobody reads to the end. Recording
each one would also mean a push per sighting, each push starting the run that produces the next — so
from here a G5 crash is recorded only when it changes something: a new shape, a new count, a job that
ruling 832 cannot stand down, or ruling 849's teardown case, which is still unobserved and still owed.

### Update, 24 September 2026: a sighting outside the Profile surface

`pages.yml` run 329 (job `107762099627`, head `de65851`, handoff 32-A) lost a web process in
`webkit-390x844-light-guest`, the public event page's guest flow, waiting for GuestSheet's "Check your
email" dialog. The extracted frames carry this entry's cycle, `+0x27b76f4`, `+0x27b555f` and
`+0x27b23f1`, dispatched from `g_main_context_dispatch`. The harness classified it behind G5 and
counted the arm UNPROVEN (228). The envelope widens again: WebKit, and not only the Profile surface.

### Update, 24 September 2026: runs 333 and 58 on `59974b2`, and the ten probe dispatches

Recorded under handoff 32-B Addendum 3 item F, because both runs change something: the same arm
crashed twice on one head at two different steps, and the frames carry a shape this entry's table
does not.

`pages.yml` run 333 (id `36055890815`, job `107823150434`, head `59974b2`, handoff 32-A's second PR)
lost a web process in `webkit-390x844-light-event-flows` about 29 minutes into the WebKit matrix,
waiting for the role-invitation sheet (`Moderate Corridor Suppers: Accra?`) to detach; the arm emitted
16 of 19. `matrix.yml` run 58 (id `36061266246`, job `107840500715`, the same head, `ENGINE=webkit`,
`SPECIAL=event`, `ONLY=[390,844]`, `THEME=light`) lost it in the same arm nine seconds in, waiting for
the Withdrawn toast, one step after the going-toast wait `59974b2` added; 9 of 19. Both were the short
count, both with the browser still connected, and in both ruling 832 stood the job down on one
crashed arm, so neither job failed. Each wrote one core (`core.eadedCompositor.*.sig11`), extracted and
not retained, with no ruling 850 degradation.

The frames are this entry's defect: fault site `+0x588b98a`, `#1 +0x27b6be4`, the cycle `+0x27b76f4`,
`+0x27b555f`, `+0x27b23f1`, entered at `+0x27b1885`, dispatched from `g_main_context_dispatch`. They
differ from the table above in one respect: the cycle is interrupted by four frames, `+0x27bd55a`,
`+0x27b8ccd`, `+0x27b7762`, `+0x27b23d5`, which run 42's 41 frames do not carry. Run 329's stack and
run 333's are identical frame for frame (47 frames, the interlude at `#9` to `#12`); run 58's is one
turn deeper (50 frames, 11/10/9, the interlude at `#12` to `#15`). Both workflows cap the backtrace at
`bt 60`, so a stack ten frames deeper than run 58's would lose the entry frame and the main-loop path
from the extraction.

The ten probe dispatches followed: `matrix.yml` runs 59 to 68, all `ENGINE=webkit`, `SPECIAL=event`,
`ONLY=[390,844]`, `THEME=light`, against `59974b2`'s deployment, five on `59974b2`'s tests and five on
`7326ff7`'s. **Zero crashes and zero cores in ten**; every `event-flows` arm passed. So on `59974b2`
the arm crashed in two runs of two and then passed five of five. Run 59 went red for a reason that is
not this one (`webkit-390x844-light-guest`, "Send me a link" disabled for 30s, no core), recorded as
its own gap below.

### Update, 25 September 2026: run 347 on `76af944`, the second job ruling 832 could not stand down

Recorded under this entry's own rule, because it is a job ruling 832 cannot stand down. `pages.yml` run
347 (id `36075579873`, job `107886270269`, head `76af944`, handoff 32-B) lost two web processes in
`matrix (webkit)`: `webkit-390x844-dark-auth flows` and `webkit-1280x800-light-auth flows`, both in the
sign-up flow waiting for `[data-testid="check-email"]`, both the over-count shape (29 against a declared
28, the flow catch-all on the error path), both UNPROVEN under 228 and excluded from the count. The tail
read `ruling 832 does NOT cover this run: 2 arms lost a web process`, the twentieth sighting's case a
second time. Two cores (`core.eadedCompositor.*.sig11`, 155M and 174M), each extracted and not retained,
no ruling 850 degradation, and both faulting threads are the table's path one turn shallower: fault
`+0x588b98a`, `#1 +0x27b6be4`, the cycle `+0x27b76f4`, `+0x27b23f1`, `+0x27b555f` at 8x, 7x and 7x,
entered at `+0x27b1885`, the table's frames from there to `clone3`, and none of the interlude runs 329,
333 and 58 carried. Not the branch's: 32-B
touches nothing in the auth flow or its arm. The job was red on its own account as well, for 25 failures
that were the branch's (G115, G116), so the push that fixes those starts the next run and no re-run was
spent.

### Update, 30 September 2026: run 419, recorded and not hunted (rulings 1234, 1235, 1237)

`pages.yml` run 419 (id `36648678693`, attempt 2, job `109692136301`, head `af5a3f1`, handoff 37-C's
branch) lost a web process in `webkit-390x844-light-event-flows`, waiting for the role-invitation sheet
(`Moderate Corridor Suppers: Accra?`) to detach after invitation-accept had closed it over the member
event page: 16 of 19 emitted, the browser still connected, and ruling 832 stood the job down on the one
arm. One core (`257M`), extracted and not retained, no ruling 850 degradation. The stack, read from the
job's own log (the extraction step printed it in full, so the artefact `matrix-webkit-run-419` was not
opened): fault `+0x588b98a`, `#1 +0x27b6be4`, the cycle `+0x27b76f4`, `+0x27b23f1`, `+0x27b555f` at 10x,
9x and 8x, with the interlude `+0x27bd55a`, `+0x27b8ccd`, `+0x27b7762`, `+0x27b23d5` at `#9` to `#12`,
entered at `#33 +0x27b1885`, then `+0x7607e1`, `+0x75f51a`, `+0x7659a9`, `+0x1d3726b`, `+0x1d356e6`,
`g_main_context_dispatch`, `+0x1d35d51`, `+0x1d36067`, `+0x1cd2ac3`, `+0x1d3bd46`, `start_thread`,
`clone3`: 47 frames, identical frame for frame to runs 329 and 333 above. **They are not new frames**
(D1336, corrected in Session 38): the interlude is the one this entry already lists from those runs, one
turn shallower than run 58's. Attempt 1 of the same run (job `109677764743`) lost no web process; it was
red for G154's reason.

**Ruling 1234 closes this entry's sighting list.** G5 is a Linux WPE compositor defect that Safari does
not run; it is recorded, not hunted, and it is handled rather than fixed: ruling 1235 puts the WebKit
result that gates a merge on a macOS runner (`pages.yml`'s `webkit-macos` job, handoff 37-F), where this
compositor does not exist, and ruling 1237 runs an arm that loses its web process again once, alone, in a
fresh browser, and fails the run on a second crash, in place of 832's stand-down. A further sighting on
the Linux job is a tally mark, and a crash there alone no longer blocks a merge.

## G6. Withdraw separated the two states ruling 214 joined — closed (ruling 229)

**Opened and closed 9 September 2026, both inside Fix PR 01. Ruling 227 stated the requirement,
ruling 229 chose option 1 of the three the gap set out. Kept here rather than deleted, because the
rejected options are the reason the chosen one costs what it costs.**

Ruling 214 joined `window` to `sent`: a decline inside the window and a request still waiting return
byte-identical payloads from every projection, so the sender cannot tell them apart by reading.
Verified live in that PR, on the Members card, on the Sent row and on `profile_view.relationship`.

The action is not joined. On Profile a `sent` relationship renders a **Request sent** button wired to
`withdraw_request`. `withdraw_request` updates a `pending` row and nothing else, so:

| The sender's state          | What Request sent does                                  | What the surface then shows   |
| --------------------------- | ------------------------------------------------------- | ----------------------------- |
| Pending request             | the row becomes `withdrawn`, the pair returns to `none` | the Connect action comes back |
| Declined, inside the window | nothing; the update matches no row                      | the button stays              |

One click separates the two, which is the thing ruling 157 exists to prevent. The payload half of
ruling 214 holds; the transition half was never stated.

Three answers were defensible and the gap recorded them rather than guessing, in the shape G2 had
before ruling 198: keep the button and hold the display at Pending; remove the button from Profile
so nothing is clickable; or remember the press so both land on `none`.

**Ruling 229 chose the first.** `private.relationship_display` maps a withdrawn request to `sent`
for the rest of the decline window, exactly as it already maps `window` to `sent`. Server behaviour
inside the window is untouched and stays a literal no-op, there is no schema change, and because no
Connect action comes back in either case the sender cannot re-send from the surface.

The button was not the only surface, and the other three are closed with it:

| Surface                       | Before                                                              | After                                       |
| ----------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Profile's Request sent button | pending → `none`, window → `sent`                                   | both stay `sent`                            |
| Members card `rel`            | pending `sent`, window `sent`, withdrawn `none`                     | all three `sent`                            |
| My Network → Sent             | row vanishes on withdrawal, stays for the window                    | row stays for both, for the window's length |
| Suggested                     | a withdrawn candidate reappears, a window one does not              | neither reappears                           |
| `send_introduction`           | accepts a re-send from the withdrawn sender, refuses the window one | refuses both, one message                   |

**Accepted cost, recorded rather than discovered.** A sender who withdraws a genuine pending request
does not get the Connect action back for that member until the window elapses, even though the
withdrawal really happened and the recipient's Requests row really did leave. They gave up their
turn. Verified live: a withdrawal older than `decline_window_days` releases, and the pair returns to
`none` on every surface.

## G7. My Network's Sent section has no withdraw affordance

**Severity: low. Not a merge blocker. Opened 9 September 2026 while closing G6. A Connect
increment, deliberately not built in Fix PR 01.**

`src/lib/connect.ts` exports `withdrawIntroduction`, and no component calls it. The only withdraw a
member can reach is Profile's **Request sent** button, so withdrawing a request means navigating to
the recipient's profile rather than acting on the Sent row that shows the request.

Ruling 229's display rule is already in place for it: a Sent row reads `sent` whether the request is
pending, inside the window, or withdrawn inside the window, so an affordance added there inherits
the rule rather than restating it. What the increment has to decide is only what the control looks
like on a card that has no primary action slot, which is a Connect surface question and belongs to a
Connect brief.

## G9. Strand has no show-password affordance, no eye icon and no loading button (Brief 4B) — two of three closed (Design pass 01)

**Severity: low. Not a merge blocker. Opened 10 September 2026 building Brief 4B, and recorded in
the handoff (section 4) as gaps to be raised in Strand rather than patched locally. Two of the three
closed on 13 September 2026 by Design pass 01: `PasswordField` and the two eye icons landed
(rulings 392, 491), and `AuthHead` plus `AuthColumn` took the logo-and-heading pattern out of the
page compositions (rulings 377, 390, 487, 491). The Show passwords checkbox is gone from
`/reset/new` and `/password`; the eye toggle is inside each field. `Button` still has no `loading`
prop, and the separator, the provider buttons and the focusable alert are still page-level
compositions.**

Three parts the auth surfaces needed and Strand does not carry. All three are worked around at page
level in this build, and the workaround is what the handoff says to keep in Code:

- `Input` has no show-password affordance, and no `eye` icon exists in `public/strand/icons/`.
  `/reset/new` and `/password` use a Strand `Checkbox` labelled "Show passwords" and swap the input
  `type` themselves.
- `Button` has no `loading` prop. Every auth submit uses `disabled` plus a label swap ("Sign in" to
  "Signing in", "Send reset link" to "Sending", and so on).
- The "or" separator, the provider-button pattern and the focusable alert block are page-level
  compositions of Strand parts, in `src/components/dna/AuthSurface.tsx`. They are staged in Strand's
  own `STRAND-HANDOFF.md` if Strand wants them as components.

A fourth part was missing from the repo rather than from Strand: `Checkbox` is shipped in Strand but
had never been ported here, so `src/components/strand/Checkbox.tsx` is a port in the same idiom as
`Switch`, not a new component. Nothing reads shadcn's checkbox (rulings 70, 72).

## G10. The provider marks are placeholders, and LinkedIn's wording is unconfirmed (ruling 233)

**Severity: medium at the invite boundary. Not a merge blocker (ruling 140). Opened 10 September
2026 building Brief 4B.**

`public/strand/marks/google.svg` and `public/strand/marks/linkedin.svg` are neutral grey glyphs
drawn as placeholders. They are deliberately not imitations of either trademark. Before the first
real member invite:

- Replace `google.svg` with the official "G" from the Sign in with Google branding guidelines.
- Replace `linkedin.svg` with the official "in" logo from the LinkedIn brand downloads.
- Confirm the button wording against LinkedIn's terms. The build ships "Continue with Google", which
  Google permits, and "Sign in with LinkedIn" on both the sign-in and the sign-up surface, because
  LinkedIn's terms favour that wording and offer no sign-up variant. If LinkedIn's current terms
  permit "Continue with LinkedIn", the label is one string in
  `PROVIDER_BUTTON_LABEL` (`src/lib/auth-flow.ts`).

Both marks resolve by path and are never imported as a module, so the swap is a file overwrite in
one directory with no component edited. Ruling 232 holds either way: a provider mark appears on its
own button and nowhere else.

## G11. Ruling 234's identity-linking arms cannot run unattended

**Severity: medium at the invite boundary. Not a merge blocker (ruling 140). Opened 10 September
2026 building Brief 4B. Reported UNPROVEN, never as passing (ruling 228).**

Ruling 234 asks that one address arriving by two providers be tested rather than assumed. No browser
can drive a real Google or LinkedIn consent screen, so `tests/auth-identity.cjs` checks the state the
round trip leaves behind instead: exactly one `auth.users` row for the address, every provider
identity on that one user id, and exactly one `public.members` row for it.

The arms need `SUPABASE_SERVICE_ROLE_KEY` and an `IDENTITY_EMAIL` that a human has signed in to by
both providers at least once. Neither is available to a CI run today, so all three arms report
UNPROVEN and are counted apart from the passes. They close when a human does the two sign-ins once
against the canonical project and the key is added as a repository secret.

## G12. The manual publish unblock left one image filed under a consumed post id

**Severity: low at the invite boundary. Not a merge blocker (ruling 140). Opened 10 September 2026
closing the publish path defects (rulings 287 and 288).**

Founder account `5099248b-7c3e-4d50-ab61-3a13b9826bca` was wedged by D2: a draft carrying an already
consumed `post_id` failed `posts_pkey` on every retry, and the rollback restored the draft each time.
The unblock, done out of band on 10 September and before this fix, rewrote that draft's `post_id`
from `5425de85-e25b-4634-be8d-2fad7a62b751` to `35c0b123-2228-49cc-b76e-bc71d8df8a90`. The attached
image was already uploaded and stays at
`5099248b-…/5425de85-…/7d73ea0d-….jpg`, under the previous post's folder, because storage paths are
written at upload time and the rewrite touched only the draft row.

The consequence is one object whose read is gated on the wrong post id:
`post_media_objects_member_select` resolves the folder segment to
`5425de85-e25b-4634-be8d-2fad7a62b751`, which is a different published post from the one the image
now belongs to.

Accepted risk, low: both posts are `audience = 'everyone'`, so the mismatched gate admits exactly the
audience the correct gate would have admitted and nothing is withheld from or disclosed to anyone.

It closes by moving the object to the folder for the post that now owns it, or by leaving it and
letting the member re-attach; either is a data touch on one row, not a code change. The guard shipped
in `20260910065849_publish_path_defects.sql` means no further draft can reach this state.

## G13. The reset landing overwrote its own completion (ruling 318, superseding 301)

**Severity: medium. A product defect in Brief 4B's `/reset/new` route, not a harness fault. Opened
11 September 2026 from PR #21's first run carrying ruling 301's diagnostic. Fixed in the PR that
opens this entry; recorded so the history of the arm reads correctly.**

Ruling 301 held that the auth recovery arm was the failure most likely to be mistaken for a real
one, and instrumented it so the next firing could be classified rather than guessed at. Run 120
([34537723787](https://github.com/jodombrown/dna-web-application/actions/runs/34537723787)), the
first run carrying that diagnostic, `matrix (webkit)`:

```
FAIL [no crash] webkit-390x844-dark-auth: recovery landing flow completed TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[data-testid="reset-done"]') to be visible
 | {"url":"https://claude-dna-page-crash-regist.dna-web-application.pages.dev/reset/new","rendered":["reset-new"],"alert":"","busy":"false"} | updateUser calls 1 | logout scopes ["others"]
```

Read in order: not a lost web process, so not G5. The password update reached the mock and was
answered. The scoped sign-out ran. `aria-busy` is false, so `submit()`'s `finally` ran. No alert,
so nothing was rejected. And the form is still the rendered stage. The surface completed the
password change, signed other devices out, and stayed on the form.

The cause is in `src/routes/reset_.new.tsx`. `submit()` ends with `clearRecovery()` and
`setStage("done")`. The `[ready, session]` effect ends with `setStage("form")`. `updateUser` and the
scoped sign-out both replace the session object the effect depends on, so the effect re-runs after
the submit resolves; by then the recovery flag has been cleared and the session is live, which is
the `form` branch, and it overwrites `done`. Whether the effect lands before or after the `done`
set is scheduling, which is why it showed only in WebKit and moved between viewport and theme
pairs: runs 113, 115 attempt 2, 116, 117, 119, 120, 122 and 123, never twice at the same pair, and
never in Chromium.

**Ruling 301 is superseded by 318 because the arm was never unstable.** It was reporting a real
defect the harness could not previously distinguish from noise; the flake reading rested on failures
that recorded nothing but the selector they timed out on. The instrumentation ruling 301 added was
correct and stays; its premise that the fault was probably in the arm was wrong, and one classified
firing settled it.

The fix is the smallest change the arm can prove: both `setStage` calls in that effect become
functional updaters that leave a `done` stage alone. No route restructuring, no new arm, timeout not
raised. The existing recovery arm is the proof, because it already fails in the engine that shows
the defect and passes in the one that does not.

## G14. Brief 5 landed its schema first and its surface second (rulings 90, 225, 334 to 336)

**Severity: none open. Recorded 11 September 2026 so the two-step landing is legible in the tree.**

`onboarding/SPEC.md` did not arrive with the first Brief 5 handoff, so PR #23's first commit carried
only what the handoff governs on its own: `20260911090000_b5_stance_onboarding.sql`, the four
onboarding functions, the `onboarding` Edge Function and the stance rename in the client. The SPEC
arrived with register revision 6, and the second commit built the three screens, the gate in the
root route and the split matrix arm to it. The SPEC is committed at `docs/onboarding/SPEC.md`.

The migration was held until the surface existed, because applying it renames the wire keys
`main`'s deployed client reads. It was rehearsed against the canonical project inside a rolled-back
transaction first, then applied with the surface, still committed before applied (ruling 225).

Rulings 334 to 336 confirm the decisions the first commit had to take against the live schema:
username is three to forty characters, enforced in `onboard_who`; a later stance change on Profile
stamps `stance_declared_at` by trigger; `members.handle` is the username and `who_completed_at`
marks screen one. Profile's visible label still reads Segment and is corrected under 300 in the
Profile spec as a follow-up, not here (ruling 336).

The ruling 218 test accounts completed onboarding once through the real surface, by
the Responsive matrix workflow dispatched with `onboard=1`, which runs
`tests/onboard-test-accounts.cjs` against the deployment: Owner Test touched a card, Member Test did not, and the live arms in
`tests/live-checks.cjs` read that difference every run rather than bypassing the gate.

## G15. A name that folds to nothing gets no username suggestion, and the hint still promises one (ruling 343)

**Severity: low. Not a merge blocker. Recorded 11 September 2026 with the transliterating fold.**

Ruling 343 made the username derivation transliterate rather than delete: trim, NFKD, strip
combining marks, then SPEC section 9's rules, the same fold in `private.derive_username` and
`deriveUsername` in `src/lib/onboarding.ts`. "Jaûne" derives `jaune` where it derived `jane`.

Two shapes still derive nothing, measured against the canonical project before the change was
written (ruling 242):

- A name in a non-Latin script (王小明, Кирилл, أحمد) has no compatibility decomposition to ASCII,
  folds to nothing, and leaves the username field empty. The `'member'` placeholder both readers
  used to substitute is gone: the server returns a null suggestion, `onboard_who` refuses an empty
  username as invalid, and the member types one. Screen one's hint still reads "We'll suggest one
  from your name.", which is not true for them; the copy needs a fallback line for the empty
  field, and it is copy, so it waits on a ruling rather than being invented here.
- Four Latin letters have no decomposition either and still fall to the ASCII filter: Ø (Søren
  Ødegård derives `sren-degard`), ß (`strae`), Ł (`ukasz`) and Æ (`sir`). A transliteration table
  (Ø to o, ß to ss, Ł to l, Æ to ae, and the Icelandic Þ and Ð) would close these; it is a second
  fold rule on both sides and waits on the same ruling.

The fold on both sides was checked against sixteen names, identical output on all sixteen; the
matrix's onboarding-flows arm proves the client half on "Jaûne Ñoño-Ålund".

## G16. The mosaic cannot show the ruling 459 exclusion at five members (rulings 459, 228)

**Severity: low. Not a merge blocker. Recorded 13 September 2026 with the W49 amendment.**

Ruling 459 excludes an account that has not finished onboarding from `connect_cards` in every lens,
from `connect_where` and from `send_introduction`. Two of the three are measured on the deployment:
the live arm clears `onboarded_at` inside a rolled-back transaction, reads `connect_cards` and calls
`send_introduction`, and measures both against the same calls with `onboarded_at` set (ruling 270).

`connect_where` cannot be measured the same way. It is the country mosaic, not a list of members: it
returns the names of countries holding at least `private.setting_int('where_floor', 5)` admitted
members, so it carries no member id and one member entering or leaving a country is observable only
at that floor. The canonical project holds twelve members across two countries, four in the largest,
so the mosaic is empty for every viewer and stays empty either way. The arm reads it both ways,
reports that half UNPROVEN with that reason, and never folds it into the passing count (ruling 228).
It becomes measurable once any country holds five members whose profiles admit the viewer; the arm
already records a pass in that case without a change.

What is proven meanwhile: `public.connect_where` reads `private.is_onboarded` in both its counting
arms, asserted by the migration itself (`20260913072642`), and the predicate is the same one the
measured `connect_cards` filters on.

**Ruling 559 makes this a cold-start gap rather than a standing asterisk.** The arm reports UNPROVEN
because the cohort is too small for the mosaic to name any country, which is correct under ruling 228
but means the surface stays unexercised until the corridor fills. The close condition is five members
sharing a country whose profiles admit the viewer — not a code change, and specifically not lowering
`private.connect_settings` key `where_floor` to make the arm run, which would change product behaviour
to make a test pass. Recorded as 559 so that a permanently unproven arm is read as a cold start rather
than as noise.

## G17. The migration tree records the project's history and no longer replays from zero (rulings 466, 444, 225)

**Severity: medium for a new environment. Not a merge blocker, and not a defect on the canonical
project. Recorded 13 September 2026 with the drift repair.**

The second amendment restored the seventeen amended migration files to the statements the project
recorded, byte for byte, so the tree and `supabase_migrations.schema_migrations` now agree row for
row and the drift arm is green. The amendments that were removed had been carrying one change: the
seven RLS helpers moved from `public` to `private` after `b1_rls` was applied. That change is now
its own migration, `20260913065215_r466_private_helpers_recorded`, which necessarily sorts last.

So a replay from an empty database in version order fails: `20260907010622_b2_notifications` creates
policies calling `private.is_admin()`, which nothing before it creates, and nine further files down
to `fix_pr_02` reference the same seven helpers in `private` before the migration that puts them
there. `supabase db reset` against a local stack stops at the first of them.

Both ways out are decisions, not repairs to take unasked:

- a back-dated migration that creates the seven helpers in `private` immediately after `b1_rls`,
  which puts a version in the tree that the project never recorded, exactly the divergence ruling
  444's arm exists to catch; or
- a squashed baseline: one migration holding the schema as it stands, with the history behind it
  archived, which makes the tree replayable and ends the row-for-row correspondence with the
  project's recorded history.

Until one is taken, the canonical project is the only environment the tree describes, and a new
environment is built by restoring from it rather than by replaying migrations.

**Ruling 563 adds one requirement to whichever way out is taken: the baseline must be dumped after the
14 September correction.** It has to capture `public.connection_requests` with a null `expires_at` on
all ten rows, not the single timestamp the column default wrote through the catalog's missing value
(G23). A dump taken before that correction would bake the defect into the one artefact a new
environment is built from, and the false header in `20260913220000` would then be describing the
baseline as well as the file. Ruling 544 keeps the baseline itself out of Fix PR 03's line of work, so
this is the requirement recorded rather than the dump performed.

---

## G18. Design pass 01 arrived without `EXTRACTION.md`, so four system-page strings are unwritten

**Severity: low. Not a merge blocker. Opened 13 September 2026 building Design pass 01
(rulings 90, 495, 496).**

The pass was handed over as `HANDOFF.md`, `STRAND-CHANGES.md`, `STRAND-HANDOFF.md`, `APP-SPEC.md`
and the register. `design-pass-01/EXTRACTION.md`, `design-pass-01/DP01-Design-Pass-01.dc.html` and
`design-pass-01/strand-patch/*` did not. The divergence list is what Code builds from and it arrived
with real content, so ruling 90's stop-and-report applies only to what is genuinely absent rather
than to the pass:

- **B10 item 5.** "Copy, new, awaiting a ruling: reset sent, 404, 500 and stub page lines are in
  `EXTRACTION.md` under 'New copy'." Ruling 496 requires the new strings verbatim, so they were not
  invented. Those four pages carry their existing copy on the pass's layout: one `AuthHead`, one 480
  column, centred with auto margins, one act and a footer line. Items 1, 2, 3, 4 and 6 of B10 are
  built; item 5 is the only one outstanding, and it is a copy change with no code shape behind it.
- **The prototype page.** `DP01-Design-Pass-01.dc.html` is the exit check's visual reference
  (handoff section D). Every state was built to the divergence list and the surface's own approved
  page instead. A state-by-state probe against the prototype is owed once it lands.
- **`strand-patch/*.jsx`.** The Strand parts were written from `STRAND-CHANGES.md`, which specifies
  each one in prose, into this repo's TypeScript. Nothing was reconstructed from ruling summaries.

## G19. Three notification kinds name a destination that has no surface yet

**Severity: low. Not a merge blocker. Opened 13 September 2026 building Design pass 01 B17
(rulings 462, 490).**

Every row now names its destination in words before the tap. Two of the five have somewhere to go:
`connection_accepted` opens the other member's profile and `connection_request` opens My Network's
Requests. `attestation_received`, `space_role_approved` and `event_reminder` name "Opens the
contribution", "Opens the Space" and "Opens the event"; none of those objects has a route, because
Convene is Brief 6 and Collaborate and Contribute follow it. Those rows mark read on open and go
nowhere. Grounded-or-empty applies to a route as much as to a count, so nothing is faked; the
navigation lands with the engine that owns the object.

Two related notes on the same rows:

- `connection_request` is not yet in the `notification_kind` enum. Ruling 461 adds it and is Fix PR
  03's scope, not this pass's; no migration was written here. The client carries the kind, its copy
  and its destination, so the row renders correctly the moment the enum lands.
- "Opens the event" is Code's wording. The handoff names four destinations verbatim (B17 item 1) and
  `event_reminder` is not among them, so its line is written to the same shape and flagged here
  rather than presented as ruling 496 copy.

**Addendum, Fix PR 03 (ruling 547).** The three kinds are now suppressed from the registry rather
than rendered with a destination that leads nowhere. `NOTIFICATION_REGISTRY` in
`src/components/strand/NotificationListItem.tsx` holds only `connection_accepted` and
`connection_request`; `loadNotifications` drops a row whose kind the registry does not hold and
`hasUnread` will not raise the bell's dot for one, so a member is never sent to a list with nothing
in it. `tests/notifications.cjs` asserts the contract and names the suppressed kinds on every run, so
the register does not become the only place they are recorded. Ruling 547's reason for suppressing
rather than exempting: an exemption list is a second place where the contract lives and it outlives
the reason it was written.

The three kinds keep their approved words here until their surface ships and they rejoin the
registry: `attestation_received` is "Opens the contribution", `space_role_approved` is "Opens the
Space", `event_reminder` is "Opens the event" (the last still Code's wording, per the note above).
Two consequences worth naming rather than fixing here:

- `connection_request` is still absent from the `notification_kind` enum. The note above records it as
  Fix PR 03's scope, but the Fix PR 03 handoff's twelve items do not name it and DONE MEANS allows no
  schema beyond what the scope names, so no migration was written. `tests/notifications.cjs` prints
  it as "in the registry, not yet in the database enum" on every run. It needs a ruling that puts it
  in a PR, not a decision taken inside one.
- The notification list's empty state still says rows appear "when a member accepts your connection
  request, attests a contribution, approves your Space role, or an event you joined is near". Two of
  those four can no longer appear. It is approved copy and no ruling supplies a replacement, so it
  was left exactly as it is (G18's lesson); it needs a ruling, not a rewrite.

## G20. The branch's first Pages preview served static files and 404ed every route — closed, one-off

**Severity: medium while it stood, and it blocked the exit check rather than the build. Opened and
closed 13 September 2026 during Design pass 01 (rulings 61, 217). Closed by the next push: Pages run
182 deployed the same branch, ruling 217's gate passed, and the live job ran its checks against the
deployment. The deployment path is sound and the failure below was one bad deployment, not a
reproducible fault. Left recorded because the symptom is worth recognising on sight and because the
next occurrence has somewhere to start.**

Pages run 181 deployed `8c41028` successfully and returned the alias
`https://claude-dna-design-pass-01-wp.dna-web-application.pages.dev`. Ruling 217's gate then polled
that deployment for seventeen minutes and got 404 on every route it opens (`/sign-in`, `/connect`,
`/reset`, `/reset/new`, `/password`, `/welcome`, `/where`, `/relationship`,
`/.well-known/security.txt`) while every static asset answered 200 (`/strand/logo.png`,
`/favicon.png`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`,
`/manifest.webmanifest`, `/strand/adinkra/mate-masie.svg`). Static files serving while every
dynamic route 404s is the shape of a deployment whose worker is not being invoked, not of an
application error, and all three jobs (chromium, webkit, live) failed at that gate with nothing
tested.

The build is not the cause, and that was measured rather than assumed. The same `dist/` was served
locally through `wrangler pages dev` on the deployment's own compatibility date and flags, and every
one of those paths answered 200, the new icons included. The tree also passes lint, `tsc`, the
contact parity and no-literal scan and the token check.

Two facts narrow it. The run immediately before it, run 180 on `claude/pr-02-dna-core-ewcqod`,
deployed to the same Pages project eleven minutes earlier and its own gate passed, so the project
itself was serving. And Cloudflare truncated this branch's alias to twenty-eight characters
(`claude-dna-design-pass-01-wp` from `claude/dna-design-pass-01-wpwb8a`), which is the same length
as that branch's alias; the aliases differ, but the truncation is worth ruling out before anything
else.

The redeploy settled it. The push carrying the Sheet and onboarding corrections triggered run 182 on
the same branch and the same alias, and the gate passed on the first poll of every path. So: one bad
deployment, not the branch, not the alias truncation, and not the build. If it recurs, redeploy
first, and only if a second deployment 404s the same way pass `matrix.yml`'s `base_url` the
deployment URL (`https://<hash>.dna-web-application.pages.dev`) instead of the alias.

It recurred on 25 September on run 361, across two deployments of one build, and cleared on its
own. G126 records it.

**Amended 26 September 2026 by handoff 33-B (1141).** The instruction above, to pass `matrix.yml`'s
`base_url` the deployment URL only once a second deployment 404s, is superseded. Every
push-triggered test job now reads the deployment its own run uploaded, at that deployment's own
URL, and a dispatch of `matrix.yml` or `webkit-crash.yml` without `base_url` is refused by name. The
deployment URL is what every push reads and what every dispatch must name. G126 records the change.

---

## G21. WebKit runs only in CI, and design pass 01 proved that costs defects

This container carries Chromium and no WebKit, so a local `node tests/matrix.cjs` proves the
Chromium half of ruling 61's matrix and nothing else. Under ruling 228 every WebKit arm is therefore
**unproven until the CI run reports it**, and a local green is never the exit check.

That is not a theoretical cost. Run 183 on `128fff0` was green on Chromium — 76, 55 and 74 arms with
no failing check, every failure ruling 292 count drift — and red on WebKit with two defects that
Chromium could not have shown, each systematic rather than a flake:

**The onboarding explainer's focus.** Eighteen arms, every viewport and both themes:
`focus lands on the sheet heading (ruling 222)`. `ExplainerSheet` kept a private focus timer and a
private Tab trap from before the pass rewrote `Sheet`, so two mechanisms competed for the same
focus: the Sheet focuses on a frame after the dialog enters the top layer, the local copy focused on
a 30ms timer, and whichever landed last won. Chromium's rAF fires inside 30ms and the heading won;
WebKit's rAF inside a freshly opened `<dialog>` runs later, so the Sheet's fallback control won and
focus never reached the heading. Fixed by deleting all three local copies — the timer, the trap and
a hand-rolled focus restore — and marking the heading `data-sheet-heading`, which is the wiring the
Sheet already reads. This is ruling 480 and 499's "one Sheet" holding: a second copy of the focus
contract is not redundancy, it is a race.

**The composer measured mid-slide.** One arm, `webkit-360x800-light publish within viewport`: the
publish row sat at y 934 in an 800-tall viewport, on a panel whose top was 189px below its resting
place. Not a layout defect — the harness waited a fixed 500ms for a 300ms slide, which holds on
Chromium and loses on WebKit, where the transform starts a frame later and runs slower under CI
load. The sibling check passed in the same breath because a translate does not change height. Fixed
with `sheetSettled()`, which polls for the panel's resting `transform: none` instead of sleeping.

**A fill against a moving sheet, run 184.** With both of those fixed, run 184's WebKit job came back
4827 of 4831 with two arms incomplete: `webkit-1280x800-dark-publish` timed out waiting for DIA's
line, and `webkit-1280x800-dark-guards` found Publish still disabled after thirty seconds. Publish
is gated on `has` (text, media, link or a field), not on DIA, so a disabled button after a `fill()`
means the text never reached React state; the same cause starves DIA, which is why one push produced
both. The discriminator is not the engine, the viewport or the theme: the base arm at that same
viewport, theme and engine passed in the same job, exercising the same composer and the same DIA.
The one difference is that the base arm had just been given `sheetSettled()` and these two had not,
so they filled the textarea while the sheet was still sliding — and Playwright's `fill()` checks
visible, enabled and editable, but not stable. Both flows now settle the sheet before the first
fill, and a DIA wait that fails reports what the textarea actually held and what the line actually
showed, so a recurrence names its limb instead of timing out mutely.

Confidence in that reading is **moderate, not proven**: WebKit cannot run here, so the mechanism is
inferred from which arms passed rather than reproduced. The change is strictly safer either way, and
the reporter is there precisely because the next occurrence should not need this reasoning again.

The method note: a fixed sleep before a geometric assertion, a duplicated focus contract, and a fill
against a moving element are all engine-dependent races. Each reads as green on the engine that
happens to win. None is visible without the WebKit job.

## G22. Ruling 410's auth mail templates are console work whose copy the repo does not carry

**Severity: low. Not a merge blocker. Opened 13 September 2026 building Fix PR 03 item 12
(rulings 410, 496, 548).**

The code half is already standing. `src/lib/contact.ts` exports `AUTH_SENDER` as `accounts@` with
Reply-To `support@` and a display name of DNA, mirrored value-for-value at
`supabase/functions/_shared/contact.ts`, and `tests/contact.cjs` fails the build if either address
appears anywhere else. There is nothing to change in the repository: Supabase Auth's templates and its
SMTP sender live in the Supabase console, which is why the handoff calls this "console plus template
work, no code seam".

What is outstanding, and why it was not written here:

- **The sender pair.** Set the Auth SMTP sender and its Reply-To to exactly the two addresses
  `AUTH_SENDER` declares, with its display name. Read them from `src/lib/contact.ts`
  (`CONTACT.authSender.address` and `CONTACT.support.address`); they are not repeated here, because
  the ruling 387 absolute bars an address literal from a document as much as from a surface, and the
  scan arm of `tests/contact.cjs` enforces it. Mechanical: ruling 387 already decided both values.
- **The three copy changes (W6, W21, W24): the reset footer, the password-changed heading once rather
  than twice, and a support line on every template.** These are member-facing strings and the Fix PR
  03 handoff does not carry ruling 410's approved text. Ruling 496 requires approved strings verbatim,
  so they were not invented; G18 records what happened the one time a string was needed and no ruling
  supplied it. This needs ruling 410's text pasted into the console, not a draft from here.

Nothing in the deployed app changes when this lands, so no arm can prove it from the repository. The
proof is a reset mail received from the `authSender` address, replied to, and arriving at the
`support` one.

**Status, 13 September 2026.** Drafts for all three strings now exist and are awaiting the founder's
approval by number under ruling 496; they are deliberately not quoted here, because copy that has not
been approved should not sit in the repository looking as though it has. Two notes carried with them:

- The draft footer omits the reset link's expiry duration on purpose. Nobody has read the value
  configured in Supabase, and a number written into approved copy without reading it off the console is
  the same failure this gap exists to record. If it is wanted in the line, the configured value comes
  first and the line is redrafted after.
- The support line necessarily contains an address. It is approved and pasted into the Supabase console,
  which the ruling 387 scan does not read — but it must never be quoted into a repository file, including
  this one. `tests/contact.cjs` fails the build if it is, which is the absolute working rather than an
  inconvenience: the addresses live in `src/lib/contact.ts` and its Deno mirror, and nowhere else.

## G23. The introduction expiry window is a seeded default, not a ruled number

**Severity: low. Not a merge blocker. Opened 13 September 2026 building Fix PR 03 item 7
(rulings 482, 485); applied and amended with ruling 563 on 14 September 2026.**

Fix PR 03's item 7 asks for "the `expires_at` purge". At `b4b21ab` no table in `public` or `private`
carried an `expires_at` column and nothing in the schema treated a pending introduction as expiring;
the only trace of ruling 482 in the tree was the Sent empty state, which already tells a member their
introductions wait "until they are accepted, or until they quietly expire".
`supabase/migrations/20260913220000_r482_485_introduction_expiry_purge.sql` is what makes that true:
the column, a nightly `pg_cron` job, and `private.purge_expired_introductions()`, which deletes the
pending rows past their window. Deletion is ruling 482's silence — no declined row, so no decline
window starts and the pair returns to `none`, which is what reopens requesting immediately — and it
needed no read projection to change, which is what kept it out of Fix PR 05's territory.

**Applied.** `supabase db push` recorded it on the canonical project on 14 September 2026 under the
file's own version, and ruling 444's drift arm reads `37 matched, 0 drift, 2 empty`. Ruling 553 records
why the CLI and never the MCP: applying this same file through `apply_migration` on a throwaway branch
recorded the statements byte-identically, md5 `a10dc390598f7ebcb660c32852f56089` on both sides, but
under the version the tool minted for itself, `20260913220047`, which trades one drift row for two.

**The window is a seeded default, and ruling 557 keeps it at 30.** No ruling in the handoff supplied a
number, so it is `private.connect_settings` key `introduction_expiry_days` rather than a constant in a
predicate: `update private.connect_settings set value_int = <days> where key =
'introduction_expiry_days';` changes it, with no migration. Thirty is deliberately shorter than the
90-day decline window, because silence should clear faster than a refusal blocks. Ruling 557 settles it
on a narrower argument than that: expiry is silence (ruling 482), the sender is never told it happened
and simply regains the ability to ask, so the whole cost of a longer window falls on the sender's
patience and produces no signal to anyone, while a shorter one mostly raises the rate at which a
recipient who is deliberately not answering gets asked again.

One consequence of the asymmetry below is worth stating with it: a recipient who declines buys 90 days
of quiet, and one who ignores buys 30. Under ruling 157 the sender cannot tell the two apart, so
declining is strictly the better move for a recipient who wants to stop being asked, and it costs them
nothing socially. The asymmetry nudges toward the cheaper, signal-free action rather than toward
silence.

**Changing the number is forward-only, unlike the decline window.** The two settings live in the same
table and are read through the same helper, and they behave in opposite ways:

| Setting                         | Read                                                | Effect of changing it                                                     |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `decline_window_days` (90)      | per call, inside the RPCs, against `responded_at`   | retroactive: every existing declined pair is re-windowed at once          |
| `introduction_expiry_days` (30) | once, at insert, as the `expires_at` column default | forward only: rows already pending keep the window they were stamped with |

`private.purge_expired_introductions()` compares the stored `expires_at`, never a recomputed window,
which is what makes that so, and the semantics are right this way round: the Sent empty state promises
a member their introductions wait "until they are accepted, or until they quietly expire", and a live
predicate would move that promise under them whenever the setting moved. But a wrong guess is then
correctable only going forward, and re-windowing rows already in flight would be a data `update` on
`public.connection_requests` rather than a settings change. Thirty was free to revise until the first
introduction was sent after the push, because every row that existed then carried a null `expires_at`.

### Ruling 563: the column default reached every pre-existing row, and this migration's header says it does not

`alter table public.connection_requests add column expires_at timestamptz default (now() +
make_interval(...))` does not leave existing rows alone. Since Postgres 11 a default that is not
volatile takes the fast path instead of rewriting the table: the expression is evaluated **once** and
stored as the column's missing value, which every pre-existing row then reads back. `now()` is STABLE,
not volatile, so that is the path taken, and the effect is indistinguishable from a backfill.

Read from the catalog after the push, `pg_attribute` for the column showed `atthasmissing = true` and
`attmissingval = {"2026-10-14 02:35:25.485652+00"}`: one timestamp, read by all ten rows, across
`pending`, `accepted`, `declined` and `withdrawn` alike.

**What it would have cost.** The four pending rows the live arms depend on would have been deleted by
the nightly purge on 14 October, and a published Connect post rendering through
`connection_request_intros` would have quietly lost the who and why it shows (ruling 157) — the exact
outcome the paragraph below says the nullable column exists to prevent.

**Corrected, and verified.** The rows were restored to null by hand in the SQL Editor on 14 September
2026; reading the project afterwards gives 10 rows, **0 carrying an `expires_at`**, 4 pending, 0
pending with an expiry. The update writes a real null into every tuple, so the missing value is
unreachable rather than merely overridden: it stays in the catalog until some later table rewrite, and
no new row can read it, because an insert stores the default's evaluated value in the tuple itself.

**The file cannot be fixed, which is why this is written here.** Its header says "the column is
nullable with no backfill, so every row written before this migration has a null `expires_at` and can
never be purged". Ruling 466 forbids amending an applied migration. The claim's conclusion now holds,
but only because 563 was found and corrected, not because the migration left those rows alone.

**A clean replay is safe, by ordering rather than by design.** No migration seeds rows into
`connection_requests`: every `insert into public.connection_requests` in the tree sits inside a
function body. So on a fresh replay the table is empty when this migration runs, and the missing value
has no tuple to reach. That is the whole reason an un-amendable file with a false header is survivable
here, and it is fragile in one specific way — anyone who later adds a seed migration with an earlier
version arms the trap without touching the file. Ruling 564 puts the general rule in
`tests/migration-lint.cjs`: in a new migration, `add column` on a nullable column carrying a `default`
is flagged unless it is split into two statements or carries an explicit marker comment declaring that
reaching existing rows is intended. `not null default` is exempt, because reaching every row is what
makes that constraint hold.

**What was always deliberate, and still is.** Rows written before the column existed carry a null
`expires_at` and are never purged. Ruling 400 removed Connect from the composer, so the only
`connection_requests` a published Feed post can point at are older ones, and purging those would empty
the who and why such a card renders through `connection_request_intros` (ruling 157).

## G24. Warm-on-open is unbuilt, and the composer's cold path is accepted silence until it is

**Severity: low. Not a merge blocker. Opened 15 September 2026 under ruling 637, filed under ruling
597, from the ruling 74 measurement (PR #38).**

**What ruling 637 decided.** The composer's cold path is accepted at launch as designed silence under
rulings 52 and 54. A DIA read that does not resolve inside the budget renders nothing and the composer
stays as it was; that is the behaviour ruling 54 specified and ruling 52 requires, not a failure of it.
So the cold path is recorded here as accepted rather than as a defect, and **warm-on-open is not built
now**.

**What was measured, so the acceptance rests on numbers rather than on an estimate.** Dispatched runs
[53](https://github.com/jodombrown/dna-web-application/actions/runs/34932032166) and
[54](https://github.com/jodombrown/dna-web-application/actions/runs/34933023641) of `matrix.yml`, job
`dia-latency`, against the deployed `dia-compose-read` (version 11) on `claude-sonnet-5`:

|                                       | n   | p50  | p95  | max  |
| ------------------------------------- | --- | ---- | ---- | ---- |
| the function's own `latency_ms`, warm | 77  | 2045 | 2672 | 3009 |
| client wall, warm                     | 77  | 2242 | 2851 | 3189 |

Warm, nothing came near the 3400 ms abort: 728 ms of headroom at p95 server-side, 649 ms under the
composer's 3500 ms budget. Cold is the whole of the exposure. Run 53's first three calls were 3411,
3405 and 3403 ms and returned null; run 54's first was 3108 ms and returned an inference. Three
breaches in 83 calls, every one an opening call against a cold isolate, and the ephemeral prompt cache
had expired between the two runs. So the cold path sits at the edge of the budget and crosses it
sometimes, which is a different thing to decide about than a deterministic breach — and what a member
sees when it crosses is one DIA line that never appears.

**The mechanism to prove before density, and why it is deferred rather than dismissed.** Warm-on-open
is the candidate: a request issued when the composer mounts, so the isolate is booted and the system
prompt is in the ephemeral cache by the time the member's first 700 ms debounce fires. It is deferred
because the cost curve runs the right way. An isolate retires after a short idle, so at launch volumes
most composes start cold; as composing traffic rises the isolate is already warm and the opening-call
penalty is paid by fewer and fewer members. Density makes this cheaper, not dearer, which is why
building it now would be paying for a problem that shrinks on its own.

**Unasserted until the arm is re-run against it (ruling 228).** `tests/dia-latency.cjs` proves nothing
about warm-on-open today: no run has ever exercised it, because it does not exist. Whoever builds it
owes the same arm re-run against a genuinely cold isolate — dispatch `matrix.yml` with
`dia_latency: "1"` after a long enough idle — showing the opening call inside the 3400 ms abort. Until
that run exists, no claim that warm-on-open closes this may appear in a report, a ruling summary or
this file.

## G25. Every ruling 74 number was measured from North America, and the West African edge is unmeasured

**Severity: medium at the continental invite boundary. Not a merge blocker. Opened 15 September 2026
under ruling 637, filed under ruling 597.**

**Proof owed: the same arm, unchanged, run from the closest available West African region, before
invites reach the continental side.**

**What the existing sample does and does not cover.** The two dispatched runs measured two different
edge regions, and neither is near a member the continental invites are for. Run 53 was served from
`us-east-2` (`cf-ray …-ORD`, runner in Azure `eastus`); run 54, eight minutes later against the same
deployment and the same function, from `us-west-1` (`cf-ray …-LAX`, runner in `westus3`). That pair is
the finding: the region follows the caller, so `us-east-2` is where run 53's calls ran and not a
property of the function.

Two consequences, stated separately because they have different causes:

- **The client wall figure does not travel.** It carries the caller-to-edge leg, so the 649 ms of
  headroom under the composer's 3500 ms budget is headroom for a North American caller. A member in
  Accra or Lagos has less, by an amount nobody here has measured.
- **The server-side figure may not travel either.** `latency_ms` is the Anthropic hop measured inside
  the function, which is independent of the caller's distance but not of the edge region the call runs
  in. Both samples measured that hop from North America. Which region Supabase routes a West African
  caller to is unmeasured, and this file does not guess at it: the arm prints `x-sb-edge-region` from
  the response for exactly this reason, so the run names the region rather than the reader assuming
  one.

**What the run needs, and the one open question in it.** `tests/dia-latency.cjs` takes `BASE` and the
ruling 218 credentials from the environment and needs nothing else, so it runs anywhere with Node 20
or later and egress to the deployment. What it does not have is a vantage point: GitHub-hosted runners
offer no West African region, so this needs a host in or near the region — a self-hosted runner, or a
single attended run from a machine there — and choosing which is a decision rather than a task. The
arm itself does not change; if it did, the comparison with runs 53 and 54 would be worth less than the
new numbers.

**What it settles when it lands.** Whether the 3.5 s client budget holds for a continental member with
their own leg included, and which edge region their calls are served from. Until then, ruling 74's
budget is proven for North American callers and unproven for the members the continental invites are
addressed to.

## G26. `CardFade` takes an optional scroller and falls back to `window`, which never scrolls

**Severity: low, latent. Not a merge blocker. Opened 15 September 2026 under ruling 595, filed under
ruling 597.**

**What ruling 595 requires.** A component that takes a scroller never defaults to `window`, and a
scroll-driven effect with no scroller throws rather than attaching to something that will not fire.

**What the tree does instead, read rather than assumed.** `src/components/strand/CardFade.tsx` declares
`scroller?: HTMLElement | null | undefined` and its own doc comment says "Omitted means the page";
`groupFor` then does `const target: EventTarget = scroller ?? window` and attaches the shared rAF
loop's `scroll` listener to that target. Under ruling 104 the shell owns one scroller per tier and the
document never scrolls inside it, so `window` is precisely the target whose `scroll` event never fires.
The failure is silent by construction: a card registered against `window` keeps whatever opacity it was
first given instead of raising anything.

**Both call sites pass a scroller, so this is a signature rather than a sighting.** `ConnectSurface`
(the `CardFade` around `MemberCard`) and `FeedSurface` (the one around the post cards) both pass
`scroller={scrollerRef.current}`. What makes the default reachable anyway is that `scrollerRef.current`
is null until the shell's scroller mounts, and the effect is keyed on `[scroller]` — a ref's `.current`
changing does not re-render the parent, so a first registration made while it is still null persists
until the parent re-renders for some other reason. No misattached card has been observed on the
deployment, and this entry does not claim one; it records the signature ruling 595 forbids and the
reason the forbidding is not academic.

**What is owed.** Make `scroller` required and throw when it is absent, in that one file. The two call
sites already pass it, so the cost is the file plus whatever the throw surfaces about the null window
between mount and scroller — which is the point of throwing.

## G27. Ruling 597's own instance: the ruling 74 follow-ups were comments before they were gaps

**Severity: none as a defect; recorded as the register's own audit trail. Opened 15 September 2026 under
ruling 597.**

**The rule.** A follow-up found during a PR earns a G number, not a comment. Ruling 638 completes it: a
G number is assigned only by writing the entry into this file, never reserved in a PR body, a report or
a chat message.

**The instance, which is this one.** The ruling 74 measurement (PR #38, merged as `23c2979`) produced
two follow-ups — warm-on-open and the West African edge measurement — and both were first written as
comments on that PR, where they read as finished thoughts about a merged change. They became gaps only
when ruling 637 sent them here as G24 and G25. Nothing was lost, because the same session wrote both;
the failure mode is the one where it is not the same session, and a merged PR's comment thread is not
where anyone looks for the register.

**Why a comment cannot stand in for an entry.** A PR comment is addressed to that PR's reviewers and
dies with the thread; a gap entry is addressed to whoever reads this codebase next and has to survive
the PR entirely. The two artefacts also fail differently: a comment nobody reads costs nothing visible,
while a missing gap entry is rediscovered as a surprise, which is the cost this file exists to avoid.
So the test for "does this need a G number" is not severity — G24 is severity low and G27 is not a
defect at all — but whether an absence would otherwise have to be inferred.

## G28. The session-open commit check is a discipline with no arm, and its shape is an id allowlist

**Severity: medium. Not a merge blocker. Opened 15 September 2026 under ruling 598, filed under ruling 597.**

**The shape, which ruling 598 fixes.** The check is an allowlist of GitHub account and app ids, never a
denylist of names. The ids are `214720153` (`jodombrown`), `81847` (`claude`) and `319149162`
(`region17gh`, the Region 17 seat under ruling 369). The reasoning is ruling 379's: a git author name or
email is free text that the committer sets, so a denylist of names fails open on exactly the identity
nobody anticipated, while an allowlist of ids read from the API fails closed on anything unrecognised
and names it.

**What the repository does not have.** Nothing in `tests/`, `scripts/` or `.github/` references any of
those ids, or app id `159125892`. The check is performed by a session reading `main`'s recent commits
through the API at session open and reporting what it finds; a session that skips it fails nothing, and
no run records that it happened. That is the gap. It was performed for PR #38 and the result written
into that PR's body, which under G27's own reasoning is the weaker of the two places to put it.

**One question this entry did not settle, settled 19 September 2026 (rulings 920, 921).** CLAUDE.md's
permitted-identity list also carries `gpt-engineer-app[bot]`, app id `159125892` (rulings 146, 286),
which is Lovable committing straight to `main` and which ruling 146 requires be reported and rebased
onto rather than merely tolerated. Ruling 598's allowlist names three ids and not that one. The
answer is that it stays outside: the allowlist answers whether an identity may commit here at all,
and 146 answers what is done about a Lovable commit once it has — expected, reported by SHA and by
paths, rebased onto, the founder's visual change kept on conflict. Folding the app id into the
allowlist would make a Lovable commit read as unremarkable, which is the one thing 146 says it is
not. Ruling 920 also moves the check's primary axis: commits are classified by **how they landed**
rather than by who authored them, a merge commit from a `claude/*` branch is Code's, anything else
is reported by SHA and by paths, any change under `.lovable/` is reported by name, and the id check
stays as a second net that is never run alone. One consequence worth recording, found at the Session
27 open: the committer id on a merge made through the GitHub button is `19864447`, `web-flow`, which
is in no allowlist and never will be, and which under 920 classifies by how it landed — `2bcb8e3`,
the merge of #49, is Code's.

**What stays open: the missing arm, which is the half this entry was opened for.** Nothing in
`tests/`, `scripts/` or `.github/` reads any of these ids, and 920's landing-based classification has
no arm either. A session that skips the check still fails nothing.

## G29. `tests/auth.cjs` section 7 waits fifteen seconds on a render instead of on the mock

**Severity: low. Not a merge blocker. Opened 15 September 2026 under ruling 574, filed under ruling 597.**

**The arm and the wait.** Section 7 of `tests/auth.cjs` proves that sign-up's "Check your email" state
is byte-identical whether or not the address already has an account (rulings 432, 384). It fills the
form, clicks submit, and then does `page.waitForSelector('[data-testid="check-email"]', { timeout:
15000 })` — fifteen seconds of patience for a rendered state, with no signal that the request it depends
on was even served. Ruling 574 records that it fails roughly one WebKit run in eighteen. That rate is
574's figure and was not re-measured here.

**The fix ruling 574 names.** Key the wait off a signal from the mock rather than off the render.
`mockAuth` in the same file already intercepts `**/<project-ref>/auth/v1/**` and fulfils the sign-up
call itself, so the arm can wait for that response — or for a flag the route handler sets when it serves
it — and only then assert the state. A wait that resolves on a response the test itself produced cannot
be slow for a reason the test does not control, which is what makes fifteen seconds unnecessary rather
than merely generous.

**The same shape appears fourteen times in the file, and that is not this gap's scope.** Every
`waitForSelector` in `tests/auth.cjs` carries `timeout: 15000`. Ruling 574 names section 7's, which is
the one with a measured failure rate; the others are the same pattern and become work when one of them
earns it.

## G30. Ruling 605's Sheet migration is unstarted, and its mapping leaves one question open

**Severity: medium at the invite boundary. Not a merge blocker, by ruling 605. Opened 15 September 2026,
filed under ruling 597.**

**What ruling 605 asks for.** `variant` and `width` out of Strand's `Sheet`, `tier` and `size` in, with
`variant="sheet"` becoming `tier="compact"` and `variant="drawer"` becoming `tier="medium"`.

**What the repository carries now.** `src/components/strand/Sheet.tsx` declares
`variant?: "sheet" | "drawer"` defaulting to `"sheet"`, and `width?: number | string`, used as
`const sheet = variant === "sheet"` and `const w = sheet ? "100%" : len(width ?? SHEET_WIDTH)` against
`SHEET_WIDTH = "40%"` and `COMPOSER_SHEET_WIDTH = "50%"`. Seven Strand call sites pass `variant`:
`ProfileSurface`, `OnboardingSurface`, `IntroSheet`, `ConnectSurface` (through its own `sheetVariant`),
`ProfileBlockControl`, `NotificationPanel` and `Composer`. Exactly one passes `width`: the composer, at
`COMPOSER_SHEET_WIDTH`.

**The migration is mostly the deletion of a conversion the call sites already perform.** Every one of
the seven computes the variant from a tier it is already holding — `compact ? "sheet" : "drawer"`, or
`tier === "compact" ? "sheet" : "drawer"` in the composer and the notification panel. Ruling 605 lets
them pass the tier they have instead of converting it down and letting `Sheet` convert it back.

**The open question, which is why this is not a mechanical rename.** The shell's tier vocabulary is
three values, `compact | medium | expanded`, and the call sites' own prop types say so. Ruling 605's
mapping is two-to-two: `"drawer"` covers both medium and expanded today and maps to `tier="medium"`. So
either `Sheet`'s `tier` takes all three values and the expanded call sites pass `"expanded"` — which
needs a decision about whether expanded behaves as medium does — or it takes two and its name collides
with the shell's three-value tier, which is the kind of one-flag-two-meanings collision ruling 590 was
written about. `size` has the smaller version of the same question: only the composer needs a
non-default today, so the vocabulary has to cover the canonical 40 percent and the composer's 50 and
nothing else until something asks.

**Not in scope when it lands.** `src/components/ui/sheet.tsx` and `src/components/ui/sidebar.tsx` are a
different, shadcn `Sheet` with a `side` prop, untouched by this and its own question under rulings 70
and 72.

**A second prop the mapping has to answer, found 21 September 2026 porting `FacetRail` (handoff 29-A
item 3, ruling 851).** Below `--tier-medium` Strand's compiled `FacetRail` renders through Strand's
`Sheet` as `{ open, onClose, tier: "compact", title, contained }`. `tier: "compact"` maps cleanly to
`variant="sheet"` under ruling 618. **`title` has nowhere to go.** This repository's `Sheet` has no
`title` and renders no heading of its own: it focuses `[data-sheet-heading]` when a caller supplies
one (`Sheet.tsx:158`), and all five callers that draw a heading — `ConnectSurface`,
`NotificationPanel`, `ConveneForm`, `OnboardingSurface`, `ProfileBlockControl` — supply it themselves.
Strand's `Sheet` draws it from the prop. So the two parts disagree about who owns the heading, and
ruling 605's migration has to say which: either `tier` and `size` arrive and `title` does not, and
every caller keeps drawing its own, or `title` arrives too and the five existing headings become
duplicates. `src/components/strand/FacetRail.tsx` passes `label` and draws its own heading in the
meantime, which is the repository's convention and not the compile's. No second sheet was added and
`Sheet` was not rewritten (handoff 29-A item 3's instruction).

**Amended 24 September 2026 by handoff 32-A.** Correction 25's FacetRail keeps its compact form
"unchanged" because Strand's Sheet pins a title above a scrolling body (`div[data-sheet-body]`, flex 1,
overflow-y auto) and draws a Close control. This repository's Sheet has neither, so FacetRail draws its
own heading (480) and, from this PR, its own scrolling body under a heading row that does not scroll,
as this repository's other Sheet callers with a scroller do. At `92fbdc3` the Browse sheet had none,
and with the Home axis present it sat past the sheet's bottom at 360 (194px) and 390 (71px) with
nothing to scroll to it, the Sheet's wheel handler finding no scroller; correction 24 §2's taller chips
would have pushed it to 235 and 104, and 34 at 430. The body makes it reachable at all three, measured,
and the mount arms read the last axis in reach at 390. The pinned header's own geometry and the Close
control stay this migration's.

## G31. A chromium sighting on the public profile at 1280 by 800, seen once and not reproduced

**Severity: none as a defect; recorded as a sighting, so that a second one has a first to sit beside.
Opened 15 September 2026, filed under ruling 597.**

**What was seen.** Run
[207](https://github.com/jodombrown/dna-web-application/actions/runs/34935945656) of `pages.yml`,
attempt 1, job `matrix (chromium)` on `ee05a0b`, failed two arms and only two, both at 1280x800 and both
the signed-out public profile. `chromium-1280x800-light profile public` threw `page.goto: Timeout
30000ms exceeded` navigating to `/m/thandiwe-dube` on the branch preview under `waitUntil: "networkidle"`,
and `chromium-1280x800-dark profile public` threw `page.waitForSelector: Timeout 20000ms exceeded`
waiting for `[data-testid="profile"]:not([data-view="loading"])` at the same path. Both landed in
`runPublic`'s catch in `tests/profile.cjs` as one `profile public flow` record each, and the page state
the catch dumps with them reads `view: null` — the profile element was not in the document at all, rather
than present and still loading.

**The other four failures are ruling 292's accounting, not four more defects.** The job reported 4930 of
4936 checks, over 76 compact arms clean, 55 medium clean, 72 of 74 expanded clean, 0 that lost a web
process and 6 unclassified. Four of the six are INCOMPLETE records: `profile public` emitted 1 of 16 in
each theme, which is the catch's own record and nothing else, and `profile owner` emitted 32 of 33 in
each theme. The owner arm's missing check is a coupling rather than a second failure, and it is worth
naming because the log does not. Its thirty-third record is "View as public matches the signed-out page
section for section (check 5)", which `tests/profile.cjs` guards with `if (pubRun !== undefined)` against
the section list the public arm stores in `seenPublic`; the public arm timed out before it reached that
`set`, so the comparison was skipped rather than failed. One arm's failure shortens another arm's
declared count, silently but for 292.

**Why it is recorded as transient.** Attempt 2 of the same run re-ran the chromium job alone and reported
4968 of 4968 with 74 of 74 expanded arms clean and 0 unclassified. 4968 − 4936 = 32 is exactly the
15 + 1 + 15 + 1 checks the four INCOMPLETE records name, so the two attempts differ by the failure and
its consequences and by nothing else. The re-run drove the same head and the same artefact: GitHub re-ran
only the failed job, `deploy` did not re-execute (its attempt 2 record carries attempt 1's 06:13:12 to
06:13:54 timestamps), and both attempts read the same branch preview from the same `BASE`. WebKit drove
the same widths in the same run's attempt 1 and was clean at 1280x800 in both themes, and run
[208](https://github.com/jodombrown/dna-web-application/actions/runs/34941026322) drove the same tree on
`main` after the merge and was green. Under ruling 228 it is attempt 2, not attempt 1's pass count, that
proves those 32 checks on that head.

**Ruling 554 is not the explanation, and that was checked rather than assumed.** 554's signature is a push
landing under running arms and retiring the preview's hashed assets. Nothing was pushed to the branch
between `ee05a0b` at 06:12:49, the push that created run 207, and the merge at 07:18:20, which created
run 208. Attempt 1's arms ran 06:14:22 to 06:41:05 and attempt 2's 06:51:15 to 07:17:29, both inside that
window, and the branch's only deploy finished at 06:13:51 before either. So the cause is unattributed,
which is the whole of what this entry claims.

**What is owed.** Nothing, unless it recurs. Both failures are on the navigation leg to the deployed
preview rather than inside an assertion, so there is nothing in a surface or an arm to fix from one
sighting, and a fix guessed from one is a change nobody can later attribute. A second sighting is what
would earn the work, and the first is recorded here because the pair is the evidence, not either half:
run 207's artefacts `matrix-chromium-run-207` hold both attempts, attempt 1 as artifact 10384635140 and
attempt 2 as 10385176388, with the arm's screenshots.

## G32. The composer's `created_object` assembly against the namespaced store is flat, dotted keys; the app assembles none

**Severity: low, a contract note. Not a merge blocker. Opened 16 September 2026 by the Convene Pass
1 handoff (section 0, G32 owed), filed under ruling 638: the number is assigned by this entry.**

**What the handoff says.** Pass 1's host "builds the card from `created_object.convene.*`" (3.2), and
the prototype's `publishedCard` does exactly that. The handoff asked Code to confirm the assembly
before PR 3 built on it.

**What the bundle does, read rather than assumed.** Strand's Composer at `v1789537371639386`
assembles `post.created_object` as
`Object.fromEntries(Object.entries(fv).map(([k, v]) => [k, v.value]))` whenever a verb is active. It
is the whole field store flattened: every key of every verb that ever held a value, with the supplied
form's keys under their dotted names (`"convene.title"`, `"convene.meta"`, `"convene.place_query"`),
not nested under `convene`. Nothing in the bundle nests, filters by the active verb, or drops the
preview-only keys. `created_object.convene.*` in the handoff therefore means "the entries whose key
starts with `convene.`", which is how the prototype reads it (`k.startsWith('convene.')`), and not a
`created_object.convene` object.

**What the app does instead.** The app's Composer hands the host `ComposerState.fields`, the store
itself, and assembles no `created_object`. `src/lib/publish.ts` flattens that store into
`payload.fields` for `publish_post`, dotted keys included, and the function is the only reader of
them (20260916120200). The published card is not built by the host from the store at all: on
`onClose('published')` the shell invalidates the Feed read and the card renders from the rows the
one projection returns, which is what the one-read-projection absolute asks for and what the
prototype's timer-based `publish` stood in for. So there is no host-side assembly for PR 3 to build
on, and none is needed: the meta line the prototype computed from `created_object` is the same line
`src/lib/feed.ts` computes from `events` and `event_delivery`.

**What is owed.** Nothing in code. If a later surface needs the Composer to hand over an assembled
object rather than the store, it takes the bundle's shape: flat, dotted, unfiltered, and the host
filters by prefix. This entry exists so the next reader does not look for a nested object the bundle
never produces.

## G33. Two `live` jobs on different branches share one project and two test accounts, and one run's fixture can be read by the other's arm

**Severity: low, a harness gap. Not a merge blocker. Opened 16 September 2026 during Convene Pass 1's
PR 1, filed under ruling 597: a follow-up found during a PR earns a G number, not a PR comment. The
number is assigned by this entry (ruling 638).**

**What was seen.** Pages run 223 on `1e34082` (PR 1) and run 224 on `85fadea` (PR 2) started within a
minute of each other after a merge forward. Their `live` jobs ran against the same canonical project
with the same OWNER and MEMBER test accounts. PR 2's F3 arm set the owner's Private switch at
19:40:08.96 UTC and restored it at 19:40:09.47, both committed through REST. PR 1's ruling 416 arm
read the owner's post from `public.feed` as the member at 19:40:09.37, inside that window, and got
`author_name null`: `private.can_see_core` reads `members.profile_private`, which the other run had
just set. The arm recorded `FAIL ruling 416` (98 of 99) on a head whose diff was two policy lines in a
migration file. PR 2's own run, five seconds later, read 99 of 99, and every run before it that day
read 99 of 99 on the same arm.

**Why the transaction wrapper does not cover it.** `tests/live-db.cjs` runs its arms on one pg client
inside a transaction it rolls back, so nothing an arm writes reaches another run. `tests/live-checks.cjs`
F3 and F4 are REST arms: they change the owner's switches and the block row through PostgREST as the
signed-in accounts, commit, and restore a moment later. The restore is part of the same run's sequence,
not of the database's isolation, so a concurrent reader on another branch sees the interim state.
`pages.yml`'s `concurrency` group is per ref, which serialises runs of one branch and nothing across
branches, and the stacked Convene PRs push three branches at once by design.

**What it costs.** A red `live` job that is nobody's, on whichever branch's arm happened to read during
another branch's fixture window, at a rate set by how often two branches push together. Under the CI
rules it is a re-run once identified, and a re-run passes; the cost is the identification, which took
reading two logs side by side, and a red check on a PR that was green.

**Second sighting.** Pages runs 250 (PR 42, `e6e35f2`) and 251 (PR 44, `19b1087`), both `live` jobs pushed
a minute apart and running their arms at 05:09:58 and 05:09:59 UTC on 17 September. Run 250's F4 fixture
held the block while run 251 inserted it (`F4: the viewer blocks the other member` read 409, `23505`),
then tore it down under run 251's reads (`B4A section 4` read `viewer_blocked false`, `B4A section 7`
read `relationship present`). Three arms red on a head whose diff touches none of them; the fix below
is unchanged, and until it lands two `live` jobs are never re-run together.

**The fix this entry names.** One of two shapes, and not both. Either the REST fixtures move inside the
same rolled-back transaction as the live-db arms (F3's switch and F4's block are one `update` and one
`insert` under the caller's role, which `actAs` already provides), so no run commits fixture state at
all; or the `live` job takes a cross-branch concurrency group (`live-${{ github.repository }}`, not
cancelling in progress), so two runs never overlap the project. The first removes the window; the
second only serialises it, and the first is the one that also holds for a founder's own test on the
project during a run.

**Not this gap's scope.** The arms' assertions and counts stay as they are; the 416 arm was right to
read null, since the owner was Private at that instant.

**What confirmed the cause, 17 September 2026.** Run 252 on PR 3, whose `live` job ran with no other
branch's `live` job anywhere near it, read all three arms green on the same assertions and the same
fixtures that had failed on run 251 twenty minutes earlier. Nothing in the diff between the two heads
touches F3, F4 or B4A. Overlap is the whole of it, which is why the two re-runs after the
`place-resolve` redeploy at 16:08 UTC were fired one after the other, PR 2's first and PR 3's only
once PR 2's had finished, and both came back green.

## G34. The draft-restore check in `tests/matrix.cjs` waits a fixed 300 ms after `Continue your draft`, not on the restore

**Severity: low, a harness gap in G29's shape. Not a merge blocker. Opened 16 September 2026 during
Convene Pass 1's PR 3, filed under ruling 597. The number is assigned by this entry (ruling 638).**

**What was seen.** Pages run 228 on `c1d6811`, `matrix (webkit)`, one check on the `webkit-1536x960-dark`
arm:

```
FAIL [no crash] webkit-1536x960-dark Continue your draft restores it, and Draft saved is still the only trace
0 behind a web-process crash (G5) | 0 an aborted fetch on mocked REST | 1 unclassified
5035 of 5036 checks passed
```

No crash, no aborted fetch, no network error in the job, and the same code green on WebKit at
5036 of 5036 in runs 216, 218 and 222 that day: the branch's diff since run 222 is two policy lines
in a migration file and a `docs/GAPS.md` entry, neither of which the composer loads.

**The wait.** The check clicks `[data-testid="continue-draft"]`, then `await page.waitForTimeout(300)`,
then asserts three things at once: the textarea's value begins with the draft's words, the
`continue-draft` control is gone, and `Draft saved` appears exactly once. Three hundred milliseconds
is a guess at how long the restore takes on a loaded WebKit; when the guess is short, the first or
second assertion reads the pre-restore state and the check fails with nothing wrong in the app.

**The fix this entry names.** Wait on the signal the restore produces rather than on the clock:
`await dialog.locator('[data-testid="continue-draft"]').waitFor({ state: "detached" })` and
`await expect(ta).toHaveValue(/^(Three intros|We need a volunteer)/)` (or a `waitForFunction` on the
value), then assert the `Draft saved` count. A wait that resolves on the state the assertion needs
cannot be short. The same fixed-wait shape appears elsewhere in the file (`waitForTimeout(150)` after
clicks in the Convene arm, added in Pass 1) and is not this gap's scope until one of them earns it.

**Second sighting.** Pages run 235 on `402e708`, `matrix (webkit)`, first attempt, at
`webkit-1366x1024-light`: the same check, the same shape, one viewport over from the first. Two sightings
in one day at two widths on two heads whose composer code is the same is a timing that the fixed wait
loses often enough to name it a recurring cost, not a one-off.

**Third sighting.** Pages run 244 on `da0e7da` (PR 45, the LensBar fix), `matrix (webkit)`, first attempt,
at `webkit-430x932-dark`: the same check, the same shape, on a head whose composer code is `main`'s. Its
one re-run passed 4981 of 4981. Three sightings on three heads at three widths, all WebKit, none with a
crash; recorded here at PR 3's next code push rather than as a doc-only push to the branch it was seen on
(ruling 556).

**Fourth sighting, and the fix, 17 September 2026.** Pages run 253 on `7270755` (PR 3, the 807 dedupe),
`matrix (webkit)`, the re-run, at `webkit-1536x960-dark`: the same check, the same shape, 5060 of 5061,
no crash. Four sightings on four heads at four widths, all WebKit. That re-run was the head's one, and the
first attempt had already been spent on a G5 crash on `webkit-390x844-dark-block-flow`, so the choice was
a red head the founder cannot merge or the fix this entry has named since it was opened. The fix is in:
the check now waits for `continue-draft` to detach and then for the textarea to actually hold the draft's
words, each with its own timeout and its own failure sentence, rather than for 300 ms. The assertions and
the arm's declared count are unchanged, so a real regression still fails exactly as before. The other
fixed waits in the file (`waitForTimeout(150)` in the Convene arm) have not earned the same treatment and
are left alone.

**Fifth sighting, 18 September 2026, and the first against the fixed wait.** Pages run 261 on
`7522504` (PR 46, the crash harness), `matrix (webkit)`, first attempt, at `webkit-1536x960-dark`: the
same check, the same arm and the same width as the fourth, 5078 of 5080, no crash. But the failure
mode has changed, and that is the point of recording it. The first four read the pre-restore state
because 300 ms was a guess. This one waited on the signal, for ten seconds, and the signal never came:
`locator.waitFor: Timeout 10000ms exceeded ... waiting for [data-testid="continue-draft"] to be
detached, 24 × locator resolved to visible`. So "the guess was short" no longer covers it. Either the
restore genuinely does not complete on that arm on that run, or ten seconds is still short for WebKit
at 1536x960 under load. **Open, and deliberately not fixed from one sighting**: a remedy chosen from a
single observation is the shape ruling 200's guardrail exists to refuse, and this entry has already
recorded two causes it named confidently and had to withdraw.

**Sixth sighting, the same day, and the one that earned this entry's own clause.** Run 261's second
attempt, at `webkit-1280x800-dark-convene-zone`, 5080 of 5081, no crash: `choosing a zone opens the
door and the line reads it, from the country (821)`. Not the draft-restore check, but the same family
and a worse instance of it, because it had **no wait at all**:

```js
await zone().selectOption("America/New_York");
record(
  tag + " choosing a zone opens the door …",
  (await dialog.locator('[data-convene="country-tz-line"]').textContent()) === "…" &&
    !(await pub().isDisabled()),
);
```

`selectOption` resolves when the change event is dispatched, not when React has re-rendered the line
and re-evaluated the door. **The app was not wrong, and the same run proves it**: the next check in
that arm passed, so the payload did carry `America/New_York` and the door did open. The arm won that
race on every run before this one.

This is what the paragraph above meant by "not this gap's scope until one of them earns it". One
earned it, so it is recorded here rather than under a new number, which is what ruling 638 exists to
prevent. **Fixed** in the shape the fourth sighting's fix uses: an in-page poll on the two signals the
assertion needs, with its own bail and its own sentence, then the assertion unchanged. The arm's
declared count is unchanged, so a real regression still fails exactly as before. Proven locally
against `wrangler pages dev` on Chromium at 96 of 96 for the four Convene arms; WebKit is not
installed in that environment, so the engine the sighting came from is proven only by CI.

**Seventh sighting, 18 September 2026: the sixth's twin, in the arm the fix did not reach.** Pages run
265 on `a11529f` (PR 48, Handoff 26-A, a doc-and-comment-only head), `matrix (webkit)`, first attempt,
at `webkit-1280x800-dark-convene`: `and the zone the host chooses opens the door and reads from the
country (821)`, 5064 of 5065, no crash, and the run's classifier reads `1 unclassified` because this
is neither a G5 crash nor ruling 357's aborted fetch. The one crashed arm in that job,
`webkit-390x844-light-block-flow`, is separate and was correctly reported UNPROVEN and excluded under
rulings 228 and 832; one crashed arm does not fail the job, and this check is what did.

The 821 gate is asserted in **two** arms, not one. Ruling 821's own commit, `e3392e5`, wrote both: the
new `-convene-zone` arm's and the existing `-convene` arm's, the second being the "wrong country"
check extended to assert the gate and then open it the way a host would. The sixth sighting fixed
`runConveneZone`'s instance and left this one, still as `e3392e5` wrote it, at
`tests/matrix.cjs:2817` to `2824` (`git blame` on those lines names that commit):

```js
await dialog
  .locator('select[data-convene="country-tz"]')
  .selectOption("America/New_York", { timeout: 5000 });
record(
  tag + " and the zone the host chooses opens the door and reads from the country (821)",
  (await dialog.locator('[data-convene="country-tz-line"]').textContent()) ===
    "Time zone America/New_York, from the country." && !(await pub().isDisabled()),
);
```

Byte for byte the shape the sixth sighting names: the `{ timeout: 5000 }` bounds how long
`selectOption` waits for the control, not how long React takes to re-render the line and re-evaluate
the door, so the two signals are read on the next tick with no wait at all. The fix went into the arm
the failure was seen in and the twin was left, which is why this entry now has the same defect in it
twice and why the sighting is recorded rather than folded into the sixth.

**The app was not wrong here either, and this run proves it the same way.** The check's detail is
empty, so the assertion's boolean was false rather than a locator throwing. Every other check in that
arm passed, including the Ghana check immediately after it, which reads a resolved row and its zone
from the same form, and the tier line reports `expanded: 76 arms | 75 with no failing check | 1 with
at least one`, so this arm's single failure is this check. The same run's `deploy`, `live` and
`matrix (chromium)` were all green on that head, and the head is a doc-and-comment diff that reaches
no test and no surface, so nothing in it could reach this arm.

**Not fixed there, and the patch was named so the next code session applies it in one step.** PR 48
is doc, comment and register only under ruling 759's handoff, so a harness change was outside its
scope and was not smuggled in under a green-CI argument. The patch is the sixth sighting's, moved:
the same in-page poll on the same two signals, its own bail and its own sentence, inserted between
the `selectOption` at `:2819` and the `record` at `:2820`, with the assertion and the arm's declared
count left alone so `tests/expected-counts.json` stays untouched (ruling 292). Nothing else in the
file has earned it: the remaining fixed wait in the Convene arm is `waitForTimeout(150)` and it has
still not been seen to fail.

**Fixed, 18 September 2026, as Convene Pass 4's first commit.** The named patch is in, byte for byte
the sixth sighting's shape, and it is this build's first commit rather than a PR of its own so that
Pass 4's own enforcing run is not a coin flip on the one check that has been red on a head that could
not have caused it. `record()` calls in the file: 170 before, 170 after, so
`tests/expected-counts.json` is untouched and a real regression still fails exactly as before. Both
instances of the 821 gate now wait on the state they assert, which is what the sixth sighting should
have carried and what left this entry with the same defect in it twice.

No re-run was spent on this. The push that carried this entry superseded run 265 and started a fresh
run on the new head, which re-runs `matrix (webkit)` as a consequence of the commit rather than as a
re-run of the job, so the head's one re-run under ruling 304 remains unspent.

**Ruling 304, demonstrated again.** Run 261's two attempts on a byte-identical head failed one check
each, in two different arms at two different widths, with **zero overlap**. That is 304's finding
exactly: on this engine a re-run cannot confirm a WebKit failure by reproduction, so the single re-run
neither confirmed the fifth sighting nor cleared it, and the head's one re-run bought a different red
rather than a green.

**Eighth sighting, 20 September 2026: the fifth's mode, a second time, with the evidence the fifth
was missing.** Pages run 274 on `5481522` (PR 50, Session 27's types regeneration), `matrix (webkit)`,
first attempt, at `webkit-1536x960-dark` — the same check, the same arm and the same width as the
fifth, and the same message to the character:

```
FAIL [no crash] webkit-1536x960-dark flow TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  - waiting for locator('…[data-testid="continue-draft"]') to be detached
    24 × locator resolved to visible <button type="button" data-testid="continue-draft">Continue your dr
```

The fifth sighting is the only other instance against the fixed wait, and it closed by naming two
possible causes and refusing to choose between them from one observation. This is the second
observation, and it carries something the fifth could not: **the same job lost three web processes** —
`webkit-820x1180-dark`, `webkit 744x1133 dark connect` and `webkit-1280x800-light-auth flows`, with
the classifier reading `7 behind a web-process crash (G5) | 0 an aborted fetch on mocked REST | 2
unclassified` and 4969 of 4971. Ruling 828 measured G5 at about one crashed arm per four to five
WebKit passes; three in one job is roughly three times that rate, which is not a healthy runner. That
discriminates between the fifth's two candidates and favours the second: ten seconds is still short
for WebKit at 1536x960 **under load**, rather than the restore genuinely never completing. It does not
prove it, and this entry is not going to claim it does.

**It is not the PR's, and that is checkable rather than asserted.** The immediately preceding head,
`17b3102`, read `matrix (webkit)` at 5090 of 5090 with zero crashes and zero unclassified — this arm
among them. The whole diff between that head and `5481522` is two files: `src/lib/database.types.ts`,
which is generated types that erase at compile plus an `export const Constants` that nothing under
`src/` imports and whose only change is key ordering, and `tests/live-checks.cjs`, which
`tests/matrix.cjs` does not reference at all. The failing arm ran byte-identical application code on
the run where it was green.

**Still open, still not fixed, and now for a second reason.** Raising the ten seconds is the guess the
fifth sighting refused, and this entry has already named two causes confidently and withdrawn both. A
second sighting is not a diagnosis. What would settle it is a reading that separates load from
behaviour — the restore's own elapsed time recorded on a healthy run and on a degraded one, so the
question becomes how long the restore takes rather than whether ten seconds is enough. That is a
harness change worth making deliberately, not on the way past.

**No re-run was spent on this either.** The push that carries this entry supersedes run 274 and starts
a fresh run on the new head, which re-runs `matrix (webkit)` as a consequence of the commit rather
than as a re-run of the job — the same route the seventh sighting took, and for the same reason: under
ruling 304 a re-run cannot confirm a WebKit failure by reproduction, so spending one buys little.

**Ninth sighting, 21 September 2026: the fifth's mode a third time, on a healthy runner, which is
what the eighth was missing.** Pages run
[279](https://github.com/jodombrown/dna-web-application/actions/runs/35554896651) on `6ca7d623`
(PR 51, Session 28), `matrix (webkit)`, first attempt, at `webkit-1366x1024-light` — the second
sighting's width, the fifth and eighth sighting's mode, and the same message to the character:

```
FAIL [no crash] webkit-1366x1024-light flow TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  - waiting for locator('…[data-testid="continue-draft"]') to be detached
    24 × locator resolved to visible <button type="button" data-testid="continue-draft">Continue your dr
```

5087 of 5089, `emitted 31 of 32`, and the classifier reads
`0 behind a web-process crash (G5) | 0 an aborted fetch on mocked REST | 2 unclassified`.

**The runner was healthy, and that is the whole value of this sighting.** The eighth had three
crashed web processes in the one job — roughly three times ruling 828's measured rate — and used that
to favour the second of the fifth sighting's two candidates: ten seconds is still short for WebKit
**under load**, rather than the restore never completing. This job lost **zero** web processes, at
every tier: `compact: 78 arms … 0 that lost a web process`, `medium: 55 … 0`, `expanded: 76 … 0`. So
the load reading does not cover this one, and the eighth's tentative preference between the two
candidates does not survive a healthy runner producing the identical failure. Neither candidate is
established; what has changed is that the eighth's discriminator has been withdrawn by the next
observation, which is the third time this entry has had to give back a cause it leaned towards.

**It is not the PR's, and this is the cleanest instance of that the entry has.** The immediately
preceding head, `d1e9e611`, read this arm green on run 278. The entire diff between that head and
`6ca7d623` is **one file, `docs/GAPS.md`** — markdown that reaches no test, no surface and no build
output. The failing arm ran byte-identical application code and byte-identical harness code on the
run where it was green, one run earlier.

**Still open, still not fixed, and the reading the eighth asked for is now the only way forward.**
What would settle it is the restore's own elapsed time recorded on a healthy run and on a degraded
one, so the question becomes how long the restore takes rather than whether ten seconds is enough.
This sighting supplies the healthy half of that comparison as a bare fact — it failed — without the
timing that would make it useful, because the harness does not record it. That is the harness change
worth making deliberately.

**No re-run was spent on this one either**, for the third time and the same reason: the push that
carries this entry supersedes run 279 and starts a fresh run on the new head, which re-runs
`matrix (webkit)` as a consequence of the commit rather than as a re-run of the job. Under ruling 304
a re-run cannot confirm a WebKit failure by reproduction, so the head's one re-run stays unspent and
is available if the next head reds on this same check.

**Tenth sighting, 26 September 2026, at the fifth and eighth sightings' width, on a healthy runner
again.** Pages run 377 (`36268454297`) on `37d98d7` (PR 69, handoff 33-D), `matrix (webkit)`, first
attempt, at `webkit-1536x960-light`, with the same message to the character. 6875 of 6879,
`emitted 31 of 32`, and `0 behind a web-process crash (G5) | 0 an aborted fetch on mocked REST |
4 unclassified`. The other three are this arm's ruling 292 line and `discovery-pane-tools`' two G128
checks, a harness condition the next head narrows (G138). No web process was lost at any tier, so
this is the ninth's shape. The arm's ERROR screenshot shows the composer open, the offer standing, the
text area empty and no tooltip on screen.

**What the branch changed on this path.** In `Composer.tsx`, only the Remove image IconButton's
placement, which renders once per attached image (G136), and the flow attaches none before the offer.
The offer, `continueDraft` and `ComposerShell`'s draft load are `f452140`'s. Every IconButton now
wraps itself in a Tooltip, the composer's own included, but the continue control is a `Button`, and
the flow's last pointer action before it, the audience pill, is not an IconButton. Chromium read
6880 of 6880 on the same head. **Not fixed, and no re-run spent**: the push that carries this entry
supersedes run 377 and starts a fresh run on the new head, so the head's one re-run under ruling 304
stays unspent.

**Not this gap's scope.** The check's assertions and the arms' declared counts stay as they are.

## G35. Mapbox Search Box carries no POI for Ghana, Kenya or Nigeria, so a Convene host there always falls to their words

**Severity: medium for the surface, none for the code. Not a merge blocker. Opened 16 September
2026 during Convene Pass 1's place-anchoring correction (Session 23), filed under ruling 597. The
number is assigned by this entry (ruling 638).**

**What was seen.** The founder typed `Front Room Osu Accra` on PR 3's preview and got nothing; `Front
Room` alone returned a Front Room in Bangkok. The correction read that as an anchoring fault, and the
anchoring fault was real (the call carried no `proximity`, so Search Box anchored on the Edge node's
IP). But anchoring is not what emptied the Ghana answer. Through Mapbox's own Search Box tooling,
with `country=GH`: `Kempinski Hotel Gold Coast City`, `Labadi Beach Hotel`, `Alliance Française
Accra`, `Kotoka International Airport`, `Accra Mall`, `Makola Market` and `University of Ghana` return
no `poi` feature at all; what comes back, when anything does, is a `place`, `locality` or `country`
feature (Accra, Abura, Ola, Ghana), which the function's `types=poi,address` never asks for. With
`proximity` at Accra and no country, `Kotoka International Airport` returns cafés and car hire in
Saudi Arabia and Oman with `distance` in the millions of metres: the nearest POI Mapbox knows for
those words is on another continent. Kenya (`Alliance Française Nairobi`, `Sarit Centre` under
`country=KE`) and Nigeria (`country=NG`, `types=poi`) behave the same. South Africa and the United
Kingdom return POIs and streets. Every POI that did come back anywhere carried
`external_ids.dataplor`, which is the one POI source Search Box exposes here.

**What it means for the surface.** Case 2 of the anchoring rule (no home, stated country) is correct
and does what it says: `Front Room` under `country=GH` is `none`, which is Mapbox's own zero and reads
as `No place found for that. It is kept as you wrote it.` That sentence is now true, where before the
correction it was not, and the event publishes with the words in `place_text`. But a host in Accra,
Nairobi or Lagos will read it for every venue they own, and the resolved row (place, coordinates, a
zone from the place) never forms for them; the zone then comes from the host's browser, because words
carry none, not from the venue. The market the surface is built for is the one the provider does not cover.

**The fix this entry names.** A decision before code. Either a second POI source for the African
footprint behind the same `place-resolve` contract (the function's four states and the row's shape
do not change; the provider behind `suggest` and `retrieve` does), or DNA's own venue vocabulary that
members grow, read at runtime as every fixed vocabulary is, with Search Box as the fallback for the
rest of the world. Both are a ruling and a brief, not a patch. Until then the four states and the
hints are honest, and `docs/` should say plainly that a Ghana venue will not resolve.

**Not this gap's scope.** The unavailable state, the anchoring rule and the live arms are Session
23's and are in; the Ghana arm in `tests/live-checks.cjs` asserts what is true (a Mapbox answer with
nothing outside Ghana), and the country filter itself is proven on the United Kingdom.

**Addendum, 17 September 2026 (ruling 810), and why this is not a new number.** Ruling 810 asks for
the Ghana coverage fact to be written into the register so it is not investigated a third time. It is
already here, opened a day earlier under 597, and a second entry for one fact is what 638's
"the number is assigned by the entry" exists to prevent: the next reader opens the register and finds
two, and neither says which is current. So this stands as G35 and no G38 was minted. What 810 adds,
recorded here: the founder, composing from California against PR 3's preview on the redeployed
function, typed `Labadi Beach` and got nothing, and `Labadi` returned the area it sits in, which is
the same shape as the `Front Room` evidence above and the first time it was read on the anchored
build rather than the IP-anchored one. The interim answer is ruling 784's: the member's words stand
beside a resolved area, so a Ghana host publishes their venue words with the area's name, city, point
and zone, and the card reads them back. The third named fix, beside the two above, is a host-placed
pin under ruling 790, which is Pass 4's answer if one is wanted; it needs no provider at all. None of
this is a defect and none of it blocks the merge.

**Addendum, 18 September 2026 (P4-SPEC sections 3 to 5), and why this entry stays open.** Pass 4
landed the third named fix and the surface around it: the host-placed pin under 790, the rewritten
zero-results hint under 814, and the `Why is my venue not here?` control whose panel says the gap is
the map's coverage and not the host's typing. A host in Accra, Nairobi or Lagos is now told what is
happening and given something to do about it, which is what this entry said was owed to the surface.
What it does not do is close the entry: the two named fixes above — a second POI source behind the
same `place-resolve` contract, or DNA's own venue vocabulary read at runtime — are still a ruling and
a brief, and neither has been decided. The words are honest and the affordance exists; the coverage
does not. See G44 for what the panel can and cannot truthfully say while that is so.

## G36. The lens bar could never fall back to icon-first on the Feed, its fit test did not match its layout, and no check read the layout it produced

**Severity: medium for the surface, and it reached production: PR 0's correction 14 is on `main`. Opened
16 September 2026 during Session 23, filed under ruling 597. The number is assigned by this entry (ruling
638).**

**What was seen.** The founder, on an iPhone in Safari at 390 wide against PR 3's preview, read a lens label
painted over the neighbouring lens's icon. Both matrix engines had passed every arm on the same build at 390.

**What it was.** Three things, established in this order on the branch that fixes them, and none of them
iOS.

1. **The Feed's lens set could never switch.** Correction 14's rule is that a set with a lens lacking an icon
   never renders icon-first, because that lens would have nothing to fall back to. `src/lib/lens.ts`
   shipped `all` without an icon, so `canSwitch` was false, no probe was rendered, `fit` was set true
   and the bar rendered labels at every width on every engine. The first form of the shell check on this
   branch read the bar as `mode: labels` at 360, 390 and 430 with no probe in the document, which is what
   made this visible. `all` now carries `globe`, the set's icon for everything a member can see.
2. **The fit test did not match the layout it decided for.** The track gives the active tab its content
   width (`flex: none`) and every other tab an equal share of what is left (`flex: 1 1 0`), so a label
   fits only if it fits its share. The test compared the sum of the labels' natural widths against the
   track, which passes while a long label overflows a short share: run 239 on this branch read
   `network` at 86px of content inside a 72px share at 390 with the sum test satisfied. The test now
   takes the widest label as an active tab plus the widest as an inactive tab times the others, with
   the gaps and the track's padding, against the track.
3. **Nothing re-measured after the web font arrived.** The measurement ran once at mount and again only
   on track resize, and the fonts are self-hosted with `font-display: swap`; a swap after hydration
   widens every label with no re-measure. Fixed alongside (re-measure on `document.fonts.ready` and on
   every later font load), and the probe no longer sits in a zero-size clipped box read through
   `scrollWidth`, which was the reading the correction arrived with; neither of those two was the cause
   of what the founder saw, and both could have been the next one.

**Why the matrix did not see it.** It had no assertion on the bar's layout. It checked the bar's presence,
its lenses, the active lens and the URL, and never that a label sat inside its tab. The shell arm now
does, at every viewport on both engines, after `document.fonts.ready`: no tab's content exceeds its box
and the track does not scroll, whichever mode the bar chose. With that one check in place the defect
reproduced on Chromium on the first run, which is the whole point of the check.

**What the matrix still cannot do.** Ruling 61 names Safari, and the matrix runs Playwright's WebKit on
Linux, which shares WebCore with Safari and not its iOS text, font-loading or scrolling behaviour. The
founder's iPhone is the only iOS check this project has. This time iOS was where a person happened to
look, not what was different; the next time it may be the other way round, and a real-device pass
(BrowserStack, or a Playwright run on a macOS runner with an iOS simulator) is the fix this half names.

**Not this gap's scope.** Connect's lens bar carries its own set and is not read by the shell check; if
its set ever loses an icon it fails the same way, silently, until a check reads it.

### Addendum, 21 September 2026: point 1 is closed by ruling 997, and ruling 999 says where the constraint lives (997, 999, 636, 638)

**No new G number. This is G36's own point 1**, and it is recorded here under 638 rather than in a
report or a PR comment, because the register is what the next reader opens.

**Point 1 is closed by 997.** The combination is refused: a lens set that cannot render icon-first
never enters a compact bar. That closes the hole this entry's point 1 named — a set the fit test can
never rescue, rendering labels at a width where they do not fit — as a rule, rather than by the one
repair that removed the Feed's instance of it (`all` gained `globe`).

**999 withdrew 997's data half, and that changes nothing here.** There is no lens vocabulary table,
lenses do not enter `public.vocabularies()`, and `src/lib/lens.ts` is not a breach of the
fixed-vocabularies absolute: lenses are navigation, not a content vocabulary. `CLAUDE.md`'s absolute
now carries that clause. No migration was written for this and none is owed.

**999's consequence, which is the part still open.** The constraint lives on the array's contents,
not on the type. Read in the tree today: `Lens.icon` is `icon?: string | undefined`, so `Lens[]`
cannot require an icon on every member, and `LensBar` has no refusal — `canSwitch` is
`!labels && lenses.length > 0 && lenses.every((l) => !!l.icon)`, and when it is false the bar sets
`fit` true and renders labels at every width, `compact` included. So 997's refusal is today a rule a
caller keeps rather than a shape the compiler or the part enforces, and a set that breaches it still
renders exactly the way this gap opened. Whether `Lens[]` can express the constraint in a form
`compact` can require — a variant of the type whose `icon` is required, or a `compact` that will not
accept a set without one — is Strand's under 636, not this repository's.

## G37. With the fit test corrected, the medium tier reads icon-first for a 3px shortfall that `main` hid inside a label's padding

**Severity: low, a Design decision rather than a defect. Opened 17 September 2026 during Session 23 on
PR 45, filed under ruling 597. The number is assigned by this entry (ruling 638). Explained on 18
September 2026 under ruling 902 and its closure condition corrected under ruling 903, in Session 26's
doc-only PR; the reading that closes it is owed and is recorded as owed below.**

**What was measured.** The G36 fix's shell check, run on Chromium against `wrangler pages dev dist` of
`458e285` and of `main` at `1eb7ab8`, at the same widths:

| Build     | 390 by 844 (track 358)                               | 744 by 1133 and 1024 by 768 (track 616)       | 1280 by 800 (track 760) |
| --------- | ---------------------------------------------------- | --------------------------------------------- | ----------------------- |
| `main`    | labels, `network` at 86px of content in a 72px share | labels, nothing over its box by more than 1px | labels                  |
| `458e285` | icon-first                                           | icon-first                                    | labels                  |

The corrected test needs 619px for labels on the Feed's set: the track's 8px of padding, four 2px gaps,
the widest label as the active tab (131px, "My Network") and the widest as an inactive tab (118px)
times the four others. At 616px the four inactive tabs get a 117.25px share each, so the widest label's
118px does not fit by 0.75px, and the bar renders icon-first at every medium-tier width. On `main` that
same 0.75px was clipped out of the label's 8px side padding, under the check's 1px tolerance and below
anything an eye could see; the medium tier read labels and looked right.

**Why it is logged and not fixed here.** Correction 14's rule is binary, labels fit or they do not, and
the test now answers it exactly. Making the tier read labels again is one of three choices, none of
them the PR's to make: a tolerance in the test (which hides a real overlap the next time a label is a
pixel wider), 1px less side padding on inactive tabs (8 becomes 7, saving 8px, and the tier fits with
5px to spare), or a wider column at the medium tier. The founder owns the lens bar; the choice goes to
Design with these numbers.

**Why the two fit tests disagreed (ruling 902).** The disagreement is structural, it is in the side
padding, and it is neither in the labels nor in the column. Strand prices a tab by formula: active at
`W + 32` and inactive at `W + 30`, from `PAD_ON 16` and `PAD_OFF 15`. This repo does not price a tab;
it measures one. `src/components/strand/LensBar.tsx:106` to `117` reads a hidden probe through
`getBoundingClientRect()` and needs `8 + others * 2 + activeMax + others * inactiveMax`, where the
probe tab renders at `padding: 0 14px` active and `0 8px` inactive (line 209), `fontSize: 15` (210),
`gap: 8` beside a 20px icon box (208, 217). The leading 8 is the track's own `padding: 4` and the 2 is
its `gap: 2` (lines 235, 236); both are identical in the two formulas, so both cancel.

The side padding does not cancel. Against `W`, the content inside the padding, Strand asks 32 on an
active tab where this repo asks 28, and 30 on an inactive tab where this repo asks 16. On the Feed's
five lenses, one active and four inactive, that is `5W + 168` against `5W + 108`: a structural 60px,
Strand higher, before a label is measured and before any column enters. It is the dominant term of the
91px the two tests disagreed by, and the 2px the G37 question was about is inside it.

**A correction to that arithmetic, read in the tree.** `W + 28` and `W + 16` are the padding alone.
The probe tab also carries `border: "1px solid transparent"` under `boxSizing: "border-box"`
(`LensBar.tsx:212`, `213`), and `getBoundingClientRect()` returns the border box, so what this repo
measures is `W + 30` active and `W + 18` inactive and its five-lens price is `5W + 118`, not
`5W + 108`. The 60px therefore holds only if Strand's own tabs carry the same 1px border that its
formula omits, in which case the term cancels on both sides; against Strand's formula exactly as
written the structural difference is 50px. Which of the two is right cannot be settled from here,
because ruling 663 keeps Strand's source out of this repo. It changes nothing about the finding: the
term is structural, it is fixed before any label or column width enters, and it is the dominant one
either way.

**Strand's candidate cause, the column term, is refuted.** The difference above is in what each test
charges for a tab. It is the same number at every track width, so it is present whatever column either
test is run against, and a column term cannot explain a constant. Strand could not test this itself:
663 keeps this repo's shell out of Strand, so the column it would have had to measure is here and not
there. The tracks this repo measured are in the table above: 358 at 390, 616 at 744 and 1024, and
760 at 1280.

**Strand's own rejection of the icon term was right, and for the right reason.** The icon is a 20px
box with an 8px gap beside it (`LensBar.tsx:208`, `217`), so 28px per tab and 140px across five
lenses. That overshoots the 91px it would have to account for, and a term larger than the whole
disagreement cannot be the disagreement.

**What the G37 question actually was.** Porting `PAD_OFF 15` against this repo's 8, framed as 15px
against 16px, is 2px per tab, one pixel a side. It was sitting inside a 12px-per-tab difference on the
same inactive tab. The question was real and it was six times smaller than the difference it sat
inside.

**The closure condition, corrected (ruling 903).** This repo keeps `0 14px` active and `0 8px`
inactive, and Strand's fit test is corrected to price them, so G37 no longer closes on a 15px port.
Nor does it close on either of the other two choices above; 903 settles the question they were raised
against. It closes on the deployed Feed at the medium tier reading labels, read on the deployed URL
and on no fixture, because `wrangler pages dev dist` is not the environment ruling 61's exit criterion
names.

**The reading is still owed.** Session 26's PR was to take that reading and record it here, and it
could not. This session's egress policy denied `CONNECT` with a 403 to
`dna-web-application.pages.dev`, to `main.dna-web-application.pages.dev` and to
`app.diasporanetwork.africa`, and to the Actions artifact host
(`productionresultssa19.blob.core.windows.net`) that carries `matrix-out/results.json`. Ruling 371's
clause is what was applied: stop and report, never route around a block through another tool.

Two in-policy channels were checked first and neither carries the answer. The CI instrument does read
the mode on the deployed URL: `tests/matrix.cjs:3811` to `3830` records `data-lensbar` with the track
width, the overflow list and the probe's own measurements for every shell arm, and 820 by 1180 is one
of them. But `record()` prints a check's detail only when the check fails (`tests/matrix.cjs:1725`),
so on a green run that JSON reaches `results.json` inside the artifact and never the job log. And no
other arm encodes the mode in its pass or its failure: the width arm's lens check counts five tabs and
reads which one is selected (`tests/matrix.cjs:2254` to `2260`) and asserts nothing about labels.

So this entry does not say what the medium tier shows, because this session did not see it. The
arithmetic above is why the port was refused; it is not evidence about the deployed surface, and it is
deliberately not read as a prediction of one. G37 stays open. One step closes it: the founder reading
the deployed Feed at 820 in a browser, or the `chromium-820x1180-shell lens bar` record inside a
`matrix-chromium-run-<n>` artifact, whose detail carries `mode`, `track`, `overflowing` and the probe
widths for that run's own deployed preview. `main` at `3a6bd94` has one already, artifact
`matrix-chromium-run-263` of run
[35360154318](https://github.com/jodombrown/dna-web-application/actions/runs/35360154318).
**Not this gap's scope.** The compact tier is the founder's screenshot and reads icon-first correctly;
the expanded tier fits with 141px to spare.

## G38. A published in-person event with no resolved place carried the host's browser zone, not the country's

**Severity: high for the surface, and it reached the stored row rather than only the rendering.
Opened 17 September 2026 during Convene Pass 1's PR 3, filed under ruling 597. The number is assigned
by this entry (ruling 638). Fixed on the same branch under rulings 813, 817 and 821; this entry
stands as the record of what it was and how it was read.**

**What decided it.** `src/components/dna/ConveneForm.tsx:204` to `210`, as it stood:

```ts
const tz: string | null = !format
  ? null
  : physical
    ? knownZone(placeTz)
      ? placeTz
      : browserTz
    : browserTz;
```

`placeTz` is written only by `pick()` from a resolved place. With no resolution the field is empty
and the zone fell to `browserTz`, the host's own; the payload carried it as `convene.timezone` and
`20260916120200_p1_publish_post_convene.sql:175` read it into `events.timezone`. A Ghana event
composed from California was stored `America/Los_Angeles`.

**The part that was worse than the label.** `zoneForInstants` is the same value, and
`startsAt = instantFor(date, time, zoneForInstants)`, so the zone interpreted the host's typed time
rather than only labelling it. A host in California typing `7pm` for an Accra event stored 03:00 the
following day in Accra, and every viewer read that instant. Ghana is where it was found because
Mapbox resolves no venue there (G35), which makes the words-only path the normal path for exactly the
market the surface is built for.

**Why it survived the founder's test.** The composer never showed the browser zone in words in that
state: `whenSuffix` reads `, time zone from the place once it is set`, and the `Time zone …, from the
place.` line renders only when a place resolved. The wrong value was stored, never displayed.

**What the fix turned out to cost, and why this entry was rewritten.** As first written this entry
named four pieces and the first was a migration, because no country-to-zone source existed in the
repo: `public.world_countries` is `(name text primary key, position smallint not null unique)` with
no alpha-2 and no zone, and the only name-to-code fold lives server-side in `place-resolve`. Ruling
817 asked whether the runtime could answer instead, and it can. Through that same fold and ICU's
Intl Locale Info API, all 195 stored names return at least one IANA zone with no Mapbox call:
`GH` one, `CD` two, `US` 29, and 168 of the 195 exactly one. So `anchor` returns `zones` beside the
code, the form takes the single zone silently, asks only for the 27 that carry several (821), and
falls back to its previous behaviour where a runtime cannot say. No column, no table, no migration,
and no hardcoded array: the zones are a runtime vocabulary from the function, like every other.

**The two-shape read is load-bearing, and only the deployment could show it.** The Intl Locale Info
API ships in two shapes, a getter `locale.timeZones` and a method `locale.getTimeZones()`, and
`zonesFor` reads `(l.getTimeZones?.() ?? l.timeZones)` for that reason. That looked like ordinary
defensiveness when it was written and it is not: **the deployed Deno runtime answers through
`getTimeZones()`, while the Node 22.22 probe that scoped ruling 817 carries only the getter.** Written
to either shape alone, `anchor` would have returned `zones: null` for all 195 countries on one of the
two runtimes, the form would have fallen back to the host's browser zone exactly as before, and
nothing would have failed: the fix would have shipped inert. What proved it is `zones_via` in the
response, which names the shape that answered, and the live arm reading it back from the deployed
function rather than from a local run. The general lesson is ruling 545's again, one layer down: a
capability probed in one runtime is a fact about that runtime, and the only environment that settles
an Edge Function's ICU is the one the function runs in.

**Not this gap.** The resolved-place path was correct throughout: a place that resolves carries its
own zone from its own point. Online events keep the host's browser zone by ruling 824, which has no
country to derive from. The seven already published events are not backfilled (823). The `whenSuffix`
copy still reads `, time zone from the place once it is set` while a country-derived zone is already
in force, which is G40.

## G39. A whole `matrix (webkit)` job can fail on TLS resets against the Pages preview, and every arm behind the first navigation reads as a defect

**Severity: medium for the harness, none for the app. Not a merge blocker. Opened 17 September 2026
during Convene Pass 1's PR 3, filed under ruling 597. The number is assigned by this entry (ruling
638).**

**What was seen.** Pages run 254 on `0848c79`, `matrix (webkit)`, the head's one re-run, at 18:57
UTC: a dozen arms failed at their first navigation with

```
FAIL [no crash] webkit-1280x800-dark profile owner flow Error: page.goto: Peer failed to perform TLS handshake: Error sending data: Connection reset by peer
  - navigating to "https://claude-dna-web-handoff-jlhuy-fdod.dna-web-application.pages.dev/sign-in", waiting until "networkidle"
```

and the ruling 292 tail then read `INCOMPLETE: emitted 1 of 33`, `emitted 2 of 32`, `emitted 1 of 10`
for arms whose checks never ran. `matrix (chromium)` on the same head and the same preview was 5061
of 5061 on its first attempt, and `live` was 118 of 118, so the deployment was serving; the resets
were to one runner over one window.

**Why it matters beyond one run.** The failure reads, in the job summary and in the wake event, as a
dozen arms failing on surfaces the diff never touched, which is indistinguishable at a glance from a
real regression. It also consumed the head's one re-run, which is what forced G34's fix to be taken
rather than re-run. A reachability failure is not an arm's result and should not be reported as one.

**The fix this entry names.** Two halves, and the first is the one that pays. The harness already has
a reachability step before the matrix (`The deployment serves every path the suites open`, ruling
217); a navigation that fails with a transport error rather than an HTTP status should be retried
once against the same URL and, if it fails again, should end the job as a reachability failure by
name rather than emitting per-arm failures — the arms did not run. The second half is the classifier:
`tests/matrix.cjs` classifies a lost web process (G5) and a WebKit aborted fetch (357) and calls
everything else unclassified, so a transport error joins those two as a named class and stays out of
the arm counts (ruling 228's shape: an arm that cannot run is unproven, never failing).

**Not this gap's scope.** The preview URL itself is not in question: it is read from the deploy job's
own wrangler output and was correct on that run.

## G40. The composer still says the zone comes from the place once one is set, after the country has already set it — closed (Convene Pass 4)

**Closed 18 September 2026 by Convene Pass 4, which is where this entry said it would close. P4-SPEC
section 1 carries the four ratified cases and the two further readings, and the string this entry was
opened about appears nowhere in the tree. Kept rather than deleted, because the reason it was not
fixed in a code session is the reusable part: a line in a ratified block is a Design and Chat
decision, and waiting cost nothing but a sentence that was wrong for a day.**

**Severity: low, copy only. Not a merge blocker. Opened 17 September 2026 during Convene Pass 1's PR
3, filed under ruling 597. The number is assigned by this entry (ruling 638).**

**What it is.** `src/components/dna/ConveneForm.tsx` composes `whenSuffix` from `tzFromPlace`: with a
resolved place it reads `, the time at the place`, and for any other in-person state
`, time zone from the place once it is set`. Since rulings 813 and 821 a words-only event already
carries a zone, the country's, so that sentence now describes a state the form is no longer in: it
promises a zone that is already decided. It was accurate before the fix only in the sense that the
zone was wrong anyway.

**Why it is not fixed here.** The copy in the place block is ratified per surface and Pass 4 redraws
the block with the zone control in it (821). Inventing a replacement sentence in a code session is
exactly what ruling 62's visual contract exists to prevent. The line to write is a Design and Chat
decision, not this session's.

**Not this gap's scope.** The `Time zone {zone}, from the country.` line under the control and the
`Time zone GMT, from the place.` line under a resolved row are both ratified and correct as built.

**Correction, ruling 898.** Half of the paragraph above did not survive. The country line is
untouched and P4-SPEC section 2 says so in as many words. The second half is wrong: `GMT` is a
display abbreviation, and for any zone that observes daylight saving it is a computed offset that
moves twice a year, so one stored instant reads `EDT` on one surface and `America/New_York` on
another. It read clean in the drawn frames only because Africa/Accra is GMT all year, which is
exactly the trap — the one country the whole of Convene was drawn in is the one country where the
defect is invisible. 898 extends 821's IANA-only rule from the zone control to every member-facing
Convene surface, and Pass 4 carried it to the resolved row, the composer's derived label, the card's
meta line, the cancelled card's `Was set for` and the rail. `zoneAbbr` survives in
`src/lib/when.ts` with no caller and a docstring saying what it is no longer for.

## G41. The C brand rung is painted under small text on five surfaces, and the worst of them bypasses the ink rung written to prevent exactly that

**Severity: high for Contribute, medium for Collaborate and Convene, light theme only; Convey is the
one dark-theme case. Not a merge blocker, and not a ruling 140 finding: this is rule 10's AA target
(610 per 480), not visibility, RLS or consent. Opened 18 September 2026 during Session 26's doc-only
PR, filed under ruling 597, and carrying ruling 874's contrast read, which has never had a G number
because Strand keeps no Gap register and 638 assigns the number by the entry that is written. The
number is assigned by this entry (ruling 638). State, 19 September 2026 (ruling 917, Session 27's
PR): the narrow remedy is taken. `Button`'s `primary` variant reads the C's own ink rung when a `c`
is passed, so a **Contribute fill** carries `--ink` at 8.29:1 instead of `--on-fill` at 2.10:1. That
closes the first row of the table below for Contribute and nothing else. The entry stays OPEN on
three counts, and it is worth being exact about which, because 917's change is narrower than "G41 is
fixed for Contribute":

1. **Collaborate (3.75:1) and Convene (3.79:1) on their own fills.** Their ink rungs are themselves
   `--on-fill`, so reading the rung moves nothing. Below AA for text under 18.66px bold or 24px
   regular, above the 3:1 large-text floor. The remedy is darkening the two fills, a D092 brand
   change and the founder's and Design's.
2. **Every `secondary` and `ghost` label, Contribute included, which is the fourth and fifth rows of
   the table.** 917 changes `primary` only. `Button`'s `secondary` and `ghost` paint the label in the
   bare brand rung off `cVar` (`Button.tsx:50`, `:53`), so `SectionCard`'s empty-section act
   (`SectionCard.tsx:133`, `variant="secondary"` with the section's `c`) still reads
   **2.10:1** for Contribute on `--surface`, unchanged by this PR. Handoff 27-A's proof owed for
   this item asks for a Contribute `SectionCard` act to be read at 360 and 1280; the reading is that
   it did not move, and under the change 917 specifies it could not have. The remedy here is not an
   ink rung at all — the ink rung is for text on a fill — but the text rung, `--c-contribute-text`
   `#7E6000`, which is the third candidate this entry named when it was opened and is equally
   Design's.
3. **`VerbChip` and `CBadge`**, the brand rung as text on its own tint, untouched and unaddressed by
   917.**

**The read (ruling 874).** A 15px label on Collaborate teal, `--c-collaborate: #30909C`, fails rule
10's AA target for text below 18.66px bold or 24px regular. `src/styles/strand.css:142` carries the
same read on the same colour, in its own comment: `--c-collaborate-ink: #ffffff; /* 3.9:1, large text
and icons only on teal fills */`. Strand's `tokens/colors.css` carries it identically. The read is
right and this entry is not a rebuttal of it; what follows is where it lands in this repo.

**The 3.9:1 does not reproduce. 3.75:1 does, and nothing the annotation concludes moves.** White on
`#30909C` is 3.75:1 by the WCAG 2 relative-luminance formula, not 3.9:1, computed on the sRGB
coefficients with the 0.05 offsets. Both numbers fail 4.5:1 and both clear the 3:1 floor for large
text and non-text, so the annotation's conclusion stands exactly as written. It is recorded because a
number sitting in a token comment is the number the next reader quotes, and because ruling 891 asks
that a claim about a measurement be verified before it is restated.

**The mitigation is real, and it is the three-rung contract rather than a per-component habit.**
`src/styles/strand.css:130` states it: brand (`--c-<c>`) is for fills, glyphs and the 3px accent
stroke, locked hex, never used as small text; `text` is the contrast-safe rung, AA as text on `--bg`;
`tint` is the wash behind badges and chips. The text rung holds by construction on the light ground:
Connect `#1E5A3C` 7.61:1, Convey 8.17:1, Convene 6.40:1, Collaborate 5.96:1, Contribute 5.52:1, all
on `--bg: #FAF7F2`. `LensBar` follows it: the active lens takes the brand rung on its **icon** only
(`src/components/strand/LensBar.tsx:155`, `299`), its label is `--ink`, and the pill under both is
`--surface`. So a surface that follows the contract cannot reach the read at all.

**What was still open was whether any surface paints small text on a C rung anyway. Five do.**
Measured light-theme ratios, one row per pairing:

| Pairing                                          | Connect | Convene  | Collaborate | Contribute | Convey |
| ------------------------------------------------ | ------- | -------- | ----------- | ---------- | ------ |
| `--on-fill` `#FFFFFF` on `--c-<c>`               | 6.39    | **3.79** | **3.75**    | **2.10**   | 8.73   |
| `--c-<c>-ink` on `--c-<c>` (the rung as written) | 6.39    | **3.79** | **3.75**    | 8.29       | 8.73   |
| `--c-<c>` as text on `--c-<c>-tint`              | 5.42    | **3.19** | **3.17**    | **1.84**   | 6.97   |
| `--c-<c>` as text on `--surface` `#FFFFFF`       | 6.39    | **3.79** | **3.75**    | **2.10**   | 8.73   |
| `--c-<c>` as text on `--bg` `#FAF7F2`            | 5.98    | **3.55** | **3.51**    | **1.97**   | 8.17   |

- `src/components/strand/Composer.tsx:1166` to `1175`, Publish. 17px, weight 500, `--on-fill` on the
  active verb's fill through `Button`'s primary variant (`src/components/strand/Button.tsx:29`, `47`).
  The verb is whatever the member is composing, so Contribute reads 2.10:1 and Collaborate 3.75:1.
- `src/components/dna/PostCardRouter.tsx:101`, the post's own act in its own C (rule 3). 15px, weight
  500, the same pairing. `src/components/strand/verb-schema.ts` gives an action to Collaborate ("Join
  the Space"), Contribute ("Offer to help") and Convey ("Read the story"), and none to Convene, so two
  of the three rendered are below the target and one of those is below the 3:1 floor as well.
- `src/components/strand/VerbChip.tsx:66` to `71`, the composer's verb row, selected state. 15px,
  weight 500, the brand rung as text on its own tint. This is the case the contract line names in so
  many words. Dark theme is not clean here either: Convey reads 3.57:1.
- `src/components/strand/CBadge.tsx:49` to `53`, the badge's optional label below 48px. 13px, weight
  500, uppercase, the brand rung on the tint, the same column as the row above.
- `src/components/strand/SectionCard.tsx:133`, the empty section's act on the owner's own profile.
  15px, weight 500, `variant="secondary"`, whose label colour is the bare brand rung
  (`src/components/strand/Button.tsx:50`; `ghost` is the same at `53`), on the card's `--surface`
  ground (`SectionCard.tsx:90`). Its `c` runs over `ProfileSurface.tsx:122` to `127`'s four activity
  Cs through `:1681`, `:1691` and `:1700`, so Contribute's "Post or fulfil a Need" reads 2.10:1,
  Collaborate's 3.75:1 and Convene's 3.79:1, and only Convey clears the target. The first and fourth
  rows of the table carry the same numbers because `--on-fill` and `--surface` are both `#FFFFFF` on
  the light theme: it is one pair read from both sides, once as ink on a fill and once as a fill
  under ink.

**The worst of it bypasses the rung that exists to stop it, and one component carries both halves.**
`Button` is in three of the five: its `primary` variant paints the fill and its `secondary` and
`ghost` variants paint the label in the bare rung, off the same `cVar` at `Button.tsx:5`. And it never
reads a `-ink` token: `primary` and `danger` both set `color: "var(--on-fill)"`, a flat `#FFFFFF` in
light theme. So `--c-contribute-ink: var(--ink)` at `src/styles/strand.css:146`, whose comment says
gold is too light for white ink, is inert on every primary button, and the Publish button on a
Contribute post is
white on `#D4AF37` at 2.10:1 — under the 3:1 floor that even an icon has to clear. `Chip.tsx:19` is
the one place in the tree that reads a `-ink` rung, and no caller passes it a `c`, so the one correct
consumer of the rung renders nowhere. Dark theme escapes all of this by coincidence rather than by
design: `--on-fill` there is `#141412`, which is the value every dark `-ink` rung already holds, and
its ratios clear 4.5:1 for four Cs and reach 4.22:1 for Convey.

**Why no gate caught it.** `scripts/token-check.mjs` proves that every token a surface cites resolves
in both themes (ruling 485); it is static, it reads declarations against citations, and it has no
opinion about what a pairing measures. Nothing in the harness reads contrast at all, which is why
874's read had nowhere to land until this entry.

**Why nothing was changed when this was opened, and what changed since.** Session 26's PR was doc,
comment and register only under ruling 903's re-sync. Three remedies were named: `Button`'s primary
could read `--c-<c>-ink` instead of `--on-fill`, which fixes Contribute and leaves Collaborate and
Convene where they are; the Collaborate and Convene fills could darken, which is a D092 change and a
brand one; or the small-text-on-brand pairings could be moved to the text rung on a tint. Ruling 917
took the first, in Session 27's PR, as `src/components/strand/Button.tsx`'s `onColor`: `primary` with
a `c` reads that C's ink rung, `danger` keeps `--on-fill` because `--error` is not a C and has no
rung, and `primary` with no `c` keeps it because the fill is `--ink` and white is correct on it. It
is a rendered-pixel change on every primary button that carries a C, and Contribute's Publish is the
one that visibly moves. Its `SectionCard` act does **not**: that is a `secondary` button and the
first remedy does not reach `secondary` or `ghost`, which is the state note above. The second and
third remedies are both still open and both belong to Design and the founder.

**Not this gap's scope.** The text rung, which is AA on the ground for all five Cs and is what almost
every surface uses. `CBadge`'s glyph and `AppShell`'s compose tab, which paint the brand rung and the
ink rung on graphics rather than text (`src/components/dna/AppShell.tsx:445`, `446`). The dark theme,
except for the two Convey readings named above. And the 3px accent stroke and every border and frame
that takes the brand rung, none of which is text.

## G42. Four C tokens are declared and read by nothing, and the system category's colours are written inline instead — the system half closed (Session 27)

**Severity: low, tidiness with one real consequence. Not a merge blocker. Opened 18 September 2026
during Session 26's doc-only PR, as a follow-up found while sweeping the C rungs for G41, filed under
ruling 597. The number is assigned by this entry (ruling 638).**

**What it is.** `src/styles/strand.css` declares `--c-stroke` (`:151`) and the system category's three
rungs, `--c-system`, `--c-system-tint` and `--c-system-ink` (`:153` to `:155`). No surface reads any
of the four: `var(--c-stroke)`, `var(--c-system)`, `var(--c-system-tint)` and `var(--c-system-ink)`
return nothing across `src/` and `public/`. `--c-stroke` is the 3px accent stroke width the token
block's own contract line names, and every border that draws it writes its own width.

The consequence is in the system category, and it is not only duplication.
`src/components/strand/PostCard.tsx:118` and `:119` handle a post DIA could not type by branching on
`c === "system"` and writing two literals inline. The frame agrees with the token by accident:
`"var(--line-strong)"` is exactly what `--c-system` holds. The label does not: the card writes
`"var(--ink-3)"`, `#77736C`, where `--c-system-ink` is `var(--ink)`, `#1A1A18`. So the declared
palette and the shipped card disagree about the system category's text colour, and the token is the
one nothing renders. The next surface that draws a system post either writes the same two literals or
reads the tokens, and gets a different colour depending on which it picks.

**Why no gate caught it.** `scripts/token-check.mjs` reads declarations against citations to prove
every cited token resolves (ruling 485). It is deliberately one-directional: a token declared and
never cited is not a broken reference and the check has nothing to say about it.

**Closed 19 September 2026, in Session 27's PR, which is the next PR that touched the card.**
`src/components/strand/PostCard.tsx` now reads `var(--c-system)` for the frame and
`var(--c-system-ink)` for the label. The frame's resolved colour is unchanged, because
`--c-system` holds `--line-strong` and that is what the literal said. The label's is not: a system
post's C line goes from `#77736C` to `#1A1A18` in light theme, and in dark from `#9B958A` to
`#F2EDE5`, because `--c-system-ink` is `var(--ink)` and follows the theme where the literal did not.
That is the rendered-pixel change Session 26's doc-only PR could not make, and it is the correction
rather than a side effect: the declared palette and the shipped card no longer disagree about what
colour the system category's text is. `scripts/token-check.mjs` reads clean on both new citations.

**Why it was not fixed when it was opened.** Session 26's PR was doc, comment and register only
under ruling 903's re-sync, and pointing `PostCard` at the tokens changes a rendered value's
provenance even where the resolved colour is identical, which was the one thing that PR could not do.

**What stays open under this number: nothing.** `--c-stroke` is still declared and read by nothing,
and that is the D092 question below rather than an open half of this entry.

**Not this gap's scope.** Whether `--c-stroke` should exist at all, which is a D092 question. The
`-ink` rung, which has a consumer (`src/components/strand/Chip.tsx:19`) even though no caller reaches
it today; that is G41's.

## G43. The map plate carries no projection, so the host's own point is not a coordinate and does not travel with the event

**Severity: medium for the surface, none for the code. Not a merge blocker. Opened 18 September 2026
during Convene Pass 4, filed under ruling 597. The number is assigned by this entry (ruling 638).
State, 19 September 2026 (ruling 929, Session 27's PR): the host-placed pin is withdrawn from the
build. What this entry described as "a surface that reads correctly and stores nothing" no longer
renders — the plate, the pointer and keyboard placement, the act, the copper dot, the host readings
of the chip, and `pin_x` and `pin_y` in the composer's store are all gone, and 897's panel line no
longer says the pin travels. The plate, the area chip and the map's own point stay. The entry stays
OPEN, because what it names as the fix is unchanged: the pin returns when the plate has tiles and
therefore a projection, and that pass is still owed.**

**What it is.** P4-SPEC section 5 orders a map plate and two pin kinds, and its own guardrail 3 says
the plate "renders no tiles and no invented geography in this build". Both were built:
`src/components/dna/ConvenePlate.tsx` draws a hairline grid on `--bg-sunken` with the matched area in
a chip, the host's point is a copper dot inside a dashed `--c-convene` ring and the map's own point is
an ink dot with a `--line` hairline, and they never read the same. What the two clauses cannot both
deliver is a coordinate. **A plate with no tiles carries no projection, so a position on it is a
position on a plate and not a place on the earth.**

**What was built instead, and why it is not a workaround.** The host's point is held as a fraction of
the plate in each axis, in the composer's own `pin_x` and `pin_y`. The payload carries them,
`publish_post` reads neither, and an unread key is dropped — which is what makes the omission provable
rather than promised. Writing that fraction into `event_delivery.lng` and `.lat` would have satisfied
the frames and put invented geography into the database, where every later read would treat it as a
real point: the worst available version of the thing guardrail 3 refuses. The map's own point does
have a coordinate behind it, written by `place-resolve`, and it renders at the plate's centre as the
token for "the map holds a point" and never as where that point is.

**What this costs, stated plainly.** The panel's second line, ratified in P4-SPEC section 3, reads
`Type the venue as you say it, then place the pin where it is. Both travel with the event.` The words
travel, in `place_text`. The pin does not. The sentence is true of the built surface the spec
describes and is not yet true of this build, and a host in Ghana who places a pin will not find it on
the event. That is the gap, and it is named here rather than softened in the copy, because the copy is
ratified and the shortfall is the code's.

**The fix this entry names.** The pass that gives the plate real tiles from the provider — which is
what the plate's own unplaced line already promises — gives the same control a projection, and the
host's point becomes a coordinate at that moment. It needs two columns on `event_delivery` beside the
existing `lng` and `lat`, because P4-SPEC section 5 draws a host-placed point standing beside a
resolver-derived one and one pair cannot hold both, and it needs a ruling on which provider and which
token reaches the client. Until then the pin is a surface that reads correctly and stores nothing.

**Not this gap's scope.** The two pin kinds, the chip's four readings, the instruction by state and by
input mode, and the act by state are all built and all proven in the harness. Nothing about how the
pins read is in question here; only what is behind one of them.

## G44. The info panel says the map holds no venues for a country, and nothing in the tree knows which countries that is true of

**Severity: medium for the surface, none for the code. Not a merge blocker. Opened 18 September 2026
during Convene Pass 4, filed under ruling 597. The number is assigned by this entry (ruling 638).**

**What it is.** P4-SPEC section 3 draws the `Why is my venue not here?` control in the state
`Country chosen, place empty`, and says of its panel: "The country name in the title and body is the
country the host chose. The claim is about that country's coverage and renders only where it is
true." The claim is a coverage fact. This tree holds no coverage fact about any country.
`place-resolve` answers `one`, `several`, `none` or `unavailable` and carries no coverage signal, and
`public.world_countries` is two columns, `name` and `position`. The two ways to render the drawn state
exactly are a hardcoded list of countries, which the fixed-vocabularies absolute forbids by name, and
a coverage column on the vocabulary that nobody has ratified and that would need its own migration,
its own RLS reading and its own source of truth.

**What was built instead.** The control waits for grounds. It renders once the country the host chose
has answered a lookup with nothing at least once in this composing session, which is the map's own
zero and the only true thing the surface can say about that country's coverage. With the field then
cleared, the form is in the drawn state and the claim is grounded. A host in France, where the map
does hold venues, never sees a panel telling them it does not.

**What this costs.** The control appears one step later than the frames draw it: after the first
empty answer rather than on choosing the country. A host who chooses Ghana and never types anything
is not offered the explanation. Against that, the alternative was a sentence that is false for most
of the world's countries, rendered on the strength of a list this repository is forbidden to hold.

**The fix this entry names.** G35's decision, and the same one: a coverage fact has to come from
somewhere before a surface can assert it. Either the second POI source makes the claim unnecessary
for the countries it covers, or DNA's own venue vocabulary carries coverage as a property of the
vocabulary, read at runtime as every fixed vocabulary is. Either way the control can then render on
the country alone, as drawn.

**Not this gap's scope.** The three panel strings are ratified and render verbatim, the panel is
Strand's `Sheet` under ruling 901, and the rewritten zero-results hint under P4-SPEC section 4 makes
the same claim in the state where it has always been grounded. Only the moment the control appears is
in question.

## G45. Pass 4's event-page half has no event page to land on

**Severity: medium for the brief, none for the code. Not a merge blocker. Opened 18 September 2026
during Convene Pass 4, filed under ruling 597. The number is assigned by this entry (ruling 638).**

**What it is.** P4-SPEC section 7's second half and section 10 are both on the event page: the
attendee's reading of the host's map link (`Open the host's map link`, with its note), and `Get
directions` through the viewer's own handler in its three states. Section 6's third chip reading,
`Placed by the host`, is the attendee's too. **There is no event page in this tree.** The routes are
`__root`, `_shell`, `_shell/$c`, `_shell/connect`, `_shell/feed`, `_shell/m.$handle`,
`_shell/password`, `_shell/posts.$id`, `index`, `relationship`, `reset`, `reset_.new`, `sign-in`,
`welcome` and `where`; `/posts/$id` is ruling 105's expanded card as page content and not an event
page; and `Get directions` returns zero hits repository-wide. P1-SPEC-R5 section 5a carried all three
to Pass 4 by name, and Pass 4's own Done Means does not name any of them.

**Why it was not built anyway.** An event page is a surface, and ruling 62 says no surface is built
without an approved prototype and that the extraction and SPEC are its visual contract. P4-EXTRACTION
draws four event-page _states_ at four tiers, which ratifies that copy; it draws no page — no
masthead, no order, no route, no data contract, nothing a builder could lay out without inventing it.
Building one from four states is exactly the reconstruction ruling 90 refuses.

**What was built.** The four chip readings live in one component and are selected by a `viewer` prop,
so `Placed by the host` is written, is one prop away, and has nowhere to mount. The composer mounts it
as the host. The map link is stored (P4-SPEC section 7's first half) and no read path selects it.

**The fix this entry names.** A drawn event page, or a ruling that the expanded card is the event
surface and the three affordances belong on it. The second is cheap and may be right — `/posts/$id`
already renders the expanded card as page content — but it is a ruling, because P4-EXTRACTION's frames
draw the card without a plate, without a link row and without directions, and adding them to the card
is a card change nobody has approved.

## G46. The info panel opens a second `dialog` inside the composer's, and the tree has no nested-sheet precedent

**Severity: low. Not a merge blocker. Opened 18 September 2026 during Convene Pass 4, filed under
ruling 597. The number is assigned by this entry (ruling 638).**

**What it is.** `ConveneForm` renders inside the Composer's own `Sheet`, so P4-SPEC section 3's panel
nests a second `Sheet` — a second `dialog` opened with `showModal()`, a second `aria-modal` panel and a
second Tab trap — inside the first. Every one of the seven other `Sheet` callers in the tree mounts at
surface level, so there is no precedent to copy and nothing that has been exercised twice.

**What was checked.** Escape does not double-close: the outer sheet's `cancel` handler is on its own
dialog and `cancel` does not bubble, so the top-layer dialog takes it. The harness opens the panel,
reads its three strings and closes it with Escape at both tiers, and the composer is still open on the
next check. What is not checked is the Tab trap: the outer sheet's focusable list is computed from its
own panel, which now contains the inner sheet's controls, so Tab inside the panel is governed by two
traps at once. No misbehaviour was observed; nothing proves there is none.

**Two things the spec asked for that this build did not take, and why.** P4-SPEC section 3 says the
panel is a `Sheet` "`contained`, with `tier` passed per frame", at "390 bottom-anchored, 820
side-anchored, 1280 and 1440 centred, which is 584's geometry". Strand as ported has neither. `Sheet`
takes no `tier` and has no centred geometry: it implements ruling 492, whose own header calls it
"canonical and not overridable per surface" — a bottom sheet on compact, a 40 percent side sheet on
medium and expanded — and all seven callers pass `variant={tier === "compact" ? "sheet" : "drawer"}`.
Taking the drawn anchor would mean a per-surface geometry override, which is the thing 492 forbids and
the thing "one part, no variant" is asking for. And `contained` is the prototype's scaled-frame
affordance: `ComposerShell` never passes it, so in the app it is undefined, and passing it would trade
`showModal()` for a bare `open` attribute and give up the browser-owned top layer and inert
background that ruling 499 chose. So the panel is the one part, with the geometry the part has.

**The fix this entry names.** A ruling on which is canonical — 584's centred expanded geometry or
492's side sheet — and, if 584, a change to `Sheet` itself rather than to this caller, because every
sheet on the platform mounts that one component. Separately, if nesting is to be a pattern rather than
one surface's accident, `Sheet` should know it is inside another and hand the trap over; that is a
Strand ask, not a repo patch.

## G47. The composer's Date picker is displayed and then ignored whenever the When words parsed to a date

**Severity: high for the surface, none for the register's own subject. Not a merge blocker. Opened
18 September 2026 during Convene Pass 4, filed under ruling 597. The number is assigned by this
entry (ruling 638). Pre-existing: `git log -S` puts the line in `b29ab90`, Convene Pass 1's PR 3, so
Pass 4 found it rather than caused it and did not fix it — a follow-up found during a PR earns a
number, not a patch.**

**What it is.** `src/components/dna/ConveneForm.tsx` reads the moment as
`const date = parsed?.date ?? (v("when_date") || null)`, which prefers the parse over the picker.
The picker is mounted only in the state where `parseFailed` is true, and `parseFailed` is
`whenWords.trim() !== "" && !(parsed && parsed.time)` — words that parsed to a date but carried no
time. So the one state the picker exists for is a state where `parsed?.date` is non-null and takes
precedence over everything the host types into it. The Date input renders
`value={v("when_date") || parsed?.date || ""}`, so the host's own edit is displayed back to them and
then discarded.

**The failing input.** With `now` at 18 September 2026, the host types `16 October` into When.
`parseWhen` returns `{ date: "2026-10-16", time: null }`, the hint reads `That did not read as a
date and time. Pick them below.` and the pickers mount pre-filled with 2026-10-16. The host corrects
the Date to 2026-10-17 and sets the Time to 19:00. The field shows 17 October. `date` is still
`"2026-10-16"`, so `startsAt` is the sixteenth, `convene.starts_at` is the sixteenth, and the event
is stored for the sixteenth. The read-back line beneath the field also reads the sixteenth, so the
form contradicts itself on screen rather than failing silently — which is the one mercy in it.

**Why the Time field does not have the same defect.** `time` reads
`parsed?.time ?? (v("when_time") || null)`, and in this state `parsed.time` is null by construction,
so the picker's value is what is used. The asymmetry is the whole bug: the same expression is
correct for one field and wrong for the other, because only one of the two is guaranteed null in the
state that mounts them.

**The fix this entry names.** The picker is the later statement and should win: read the picker's
value first and fall back to the parse, `v("when_date") || parsed?.date || null`, matching how the
host experiences the two controls. It is one line, and it wants a check of its own in the Convene
arm — the arm already drives this exact state at `failed parse: the hint and a date and time picker,
Publish off` and then fills only the Time, which is why five passes over the file have not caught it.

**Not this gap's scope.** Pass 4's section 9 is unaffected. The weekday contradiction names
`dateLine(startDate, …)`, which is derived from the same `date`, so the sentence names the instant
that is actually stored and stays true whatever this entry decides.

## G48. Selecting a lens re-divides the track, so every seat moves under the finger that chose it

**Severity: high for the surface, and it is shipping to members today on every surface that mounts
the part. Not a merge blocker under ruling 140 — this is not a visibility, RLS or consent finding —
but it is the one item on Session 27's list that is live rather than latent. Opened 19 September
2026 during Session 27 under ruling 952, filed under ruling 597. The number is assigned by this
entry (ruling 638). Fixed in the same PR that opens it; the entry stays because 638 assigns the
number by the entry and because the mechanism outlives this fix.**

**The read.** `src/components/strand/LensBar.tsx` gives the active tab `flex: on ? "none" : "1 1 0"`
and every other tab an equal share of what is left. Selection is therefore a layout input: when it
moves, the outgoing tab collapses from its content width to a share and the incoming one does the
reverse, and every seat between and beside them changes x. The member's next tap lands on the seat
that has slid under their finger rather than the one they aimed at, which on a four-lens bar is
usually the neighbour.

**Where it ships.** Three mounts, all on `main`: the Feed (`src/components/dna/FeedSurface.tsx:549`),
Connect (`src/components/dna/ConnectSurface.tsx:880`) and the header's dense rendering
(`src/components/strand/AppHeader.tsx:130`), which is the compact and medium tiers once the member
has scrolled into the list. It is not Brief 9's, it is not the bundle's, and no surface opts out of
it: the distribution rule is the part's own.

**The prototype reaches it by the same mechanism.** Handoff 27-A records the reading taken on
Strand's own part at compact: seats at 4-81, 83-127, 129-173 and 175-219 with `All` active, and
4-48, 50-94 and 96-219 with the third lens active, up to 79px of shift. That reading is carried here
as the prototype's and not as this repo's: it is quoted from the handoff rather than re-measured,
and its second row lists three seats where the first lists four, so the transcription is not exact
even though the mechanism it describes is the one in this tree. The repo's own reading is the
harness check named below, which measures seat x on the deployed build rather than in a prototype.

**Ruling 936's reflow is a different one.** 936 measures 12px at a tier boundary, where the bar's
rendering changes because the tier changed. This one needs no resize and no tier change: it fires on
a plain selection at a fixed width, and its magnitude is the difference between a label's content
width and an equal share rather than a padding step.

**Why no gate caught it.** The shell arm has read the bar's layout since G36 (`tests/matrix.cjs`, the
`lensFit` check): it asserts that no tab's content exceeds its box and that the track does not
scroll. Both of those are true of a bar whose seats move, because they are read once, in one
selection state. Nothing in the harness had ever read the same seat twice, and a check that never
compares two states cannot see a state change. The check this entry adds does exactly that and
nothing more.

**The fix, and the constraint it had to clear.** Every tab now takes `flex: "1 1 0"`, so the track is
divided equally and selection is no longer a layout input. Ruling 488's constraint holds: the active
tab's own background is still the indicator, painted on the first frame, and nothing returns to a
measured absolute chip moved by transform, which is W34 and which 488 removed. `--target-min` and
the 44 floor are untouched. Ruling 723's labels-fit switch still decides labels against icon-first on
the same probe, re-measured on resize and on font load; its arithmetic follows the layout it decides
for, as the part's own comment requires, so the per-seat requirement it tests is now a seat of the
track's equal division rather than the active tab's content width plus the others' shares.

**What that arithmetic costs, stated plainly.** Equal seats are a stricter fit test than content-sized
active plus equal inactive, because the widest label has to fit one seat rather than the whole track
minus the others' shares. At widths where the old test answered "fits" by a few pixels the bar now
renders icon-first, which is G37's band and G37's question. This entry does not decide it; it records
that the boundary moved and why.

**Not this gap's scope.** Ruling 905's 44px seat, whose mechanism is pending Design and which nothing
here implements. G37's icon-first threshold at the medium tier. The labels-fit switch itself, which
is G36's and is unchanged in substance. And `docs/shell/LENS_BAR_SPEC.md`'s Distribution line, which
named the superseded mechanism and is corrected in the same PR rather than left to be rebuilt from.

## G49. The ruling 919 focus-ring sweep: an inline `all: unset` outranks every focus rule in the stylesheet, and 41 of 42 sites carry one

**Severity: high for keyboard accessibility, both themes, every tier. Not a merge blocker and not a
ruling 140 finding. Opened 19 September 2026 during Session 27 under ruling 919, filed under ruling 597. The number is assigned by this entry (ruling 638). Recorded, not fixed: the remedy is 41 sites
across 29 files and a decision about which mechanism gives the ring back, which is Design's and the
founder's rather than a code session's.**

**Why the sweep exists.** Session 26 recorded a ring with nowhere to draw and the finding lived in a
session's prose. A finding in prose cannot be re-run, so this entry carries the scope, the hits and
the sites the sweep cleared. A sweep that records only its hits cannot be checked against its own
scope by the next reader, which is the whole reason 919 asks for an entry.

**The mechanism, measured rather than reasoned (ruling 891).** `src/styles/strand.css:368` declares
the ring globally, `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`, and
`src/components/strand/LensBar.tsx:171` injects its own copy for the tabs. Both are author stylesheet
rules. An inline `style` declaration outranks an author stylesheet rule that carries no `!important`,
and `all: unset` sets every longhand to its initial value, which for `outline-style` is `none`.
So an element with an inline `all: unset` matches `:focus-visible`, is focused, and computes
`outline-style: none`. Read in Chromium on a synthetic page: the `all: unset` tab reads
`focusVisible: true, outlineStyle: "none", outlineWidth: "0px"` while the plain tab beside it under
the same two rules reads `solid 2px rgb(74, 141, 119)`.

**And measured on the running app, not only on a probe.** `/sign-in` at 390, every focusable control,
each focused in turn and its computed outline read:

| Control                 | Part                      | Computed outline when focused |
| ----------------------- | ------------------------- | ----------------------------- |
| `Sign in`               | `Button`                  | `solid 2px rgb(74, 141, 119)` |
| `Continue with Google`  | `Button`                  | `solid 2px rgb(74, 141, 119)` |
| `Sign in with LinkedIn` | `Button`                  | `solid 2px rgb(74, 141, 119)` |
| `Show password`         | `PasswordField.tsx:79`    | `none 0px`                    |
| `Forgot your password?` | `sign-in.tsx` text button | `none 0px`                    |
| `Create an account`     | `sign-in.tsx:247`         | `none 0px`                    |

`Button` does not use `all: unset` and its ring draws. The three that do not draw are the three that
do. One surface, one reading, both halves of the rule in the same screenshot.

**The scope, so it can be re-run.** Every inline `all: "unset"` under `src/`, walked back to the JSX
tag or the shared style constant that owns it: 42 sites in 29 files.
`grep -rn 'all: "unset"' src/` is the whole scope and the count is the check.

**The hits: 41 sites.** Four in `AppShell.tsx` (`:488`, `:546`, `:569`, `:592`), two each in
`FeedSurface.tsx` (`:430`, `:478`), `AppHeader.tsx` (`:118`, `:145`, `:190`, `:216` — four),
`ConveneForm.tsx` (`:90`'s shared `TEXTBTN`, `:989`), `OnboardingSurface.tsx` (`:223`, `:494`,
`:826` — three), `ProfileSurface.tsx` (`:271`'s shared `LINK_STYLE`, `:683`, `:1120` — three) and
`PostCard.tsx` (`:129`'s `linkStyle`, `:459`), and one each in `AuthSurface.tsx:284`,
`NotificationPanel.tsx:169`, `ProfileBlockControl.tsx:53` (`ITEM`, the overflow menu item),
`Rails.tsx:70`, `AudienceSelect.tsx:46`, `BackRow.tsx:30`, `BadgeRow.tsx:54`, `Chip.tsx:53`,
`DiaLine.tsx:61`, `LensBar.tsx:272`, `MediaBlock.tsx:188`, `NotificationListItem.tsx:115`,
`PasswordField.tsx:79`, `PatternPicker.tsx:44`, `ProfileHeader.tsx:333`, `PulseDock.tsx:100`,
`Segment.tsx:43`, `Toast.tsx:37`, `VerbChip.tsx:54`, `VocabularyPicker.tsx:51` and
`src/routes/sign-in.tsx:247`. Every one is a focusable control or a style constant spread onto one.

**`LensBar` is the sharpest case and is the ring with nowhere to draw.** The part injects
`.strand-lens [role=tab]:focus-visible{outline:2px solid var(--focus);outline-offset:2px}` — a rule
written for these tabs and these tabs only — and then sets `all: "unset"` inline on each tab, which
outranks it. The rule matches, the element is focused, and the outline computes to none. The spec
asks for it in so many words (`docs/shell/LENS_BAR_SPEC.md`: "Focus: 2px `--focus` (emerald) outline,
2px offset, on every lens, both themes"), so this is a shortfall against a ratified contract and not
a design question.

**The sites the sweep cleared.** One of the 42: `src/components/strand/Composer.tsx:924`, a
`fieldset` that sets `outlineStyle: "dashed"` in the same inline object, so the shorthand's reset is
overwritten by a later longhand on the same element. It is a decoration rather than a focus ring and
the fieldset is not focusable, so it is cleared for two reasons and neither of them generalises.
Cleared outside the `all: unset` set, and named so the next sweep knows they were looked at:
`MemberCard`'s name button (`.strand-mc-name`, `strand.css:404`) and `PlaceTile`
(`.strand-placetile`, `:409`), which take the ring from the stylesheet with nothing inline to beat
it; `Button`, `Input`, `Select` and `PasswordField`'s own field, which either carry no `all: unset`
or replace the ring with a drawn border of their own; and every `outline: "none"` in the tree
(`Input.tsx:54`, `Select.tsx:40`, `AuthHead.tsx:63`, `Composer.tsx:1031` and `:1121`,
`OnboardingSurface.tsx:666` and `:936`, `AuthSurface.tsx:69` and `:117`,
`ProfileBlockControl.tsx:169`), which are deliberate suppressions on fields that draw a focus border
instead and are not this sweep's subject.

**Why no gate caught it.** `scripts/token-check.mjs` proves every cited token resolves in both themes
(ruling 485); `--focus` resolves, and it is cited, and the check has no opinion about whether the
declaration that cites it wins its cascade. Nothing in the harness focuses a control and reads its
computed outline. The matrix's `block-focus` arms read focus _order_ and not focus _paint_, which is
why nine of them pass on every run while the ring is absent.

**The fix this entry names.** One decision, then a mechanical change: either stop using `all: unset`
on focusable elements in favour of a narrower reset, or give the ring back where the reset removed
it — a shared `:focus-visible` rule carrying `!important`, or the outline restored inline in each
part. The first is correct and large; the second is small and is the kind of thing that decays. The
choice is Design's with the founder, and it wants a harness arm that focuses one control per part and
reads `outlineStyle`, because this is a defect that a screenshot of a passing run does not show.

**Not this gap's scope.** The ring's colour, offset and radius, all of which the spec settles and
none of which is in question. The `outline: "none"` suppressions on fields, listed above as cleared.
Focus order, roving tabindex and the dialog focus traps, which the block-focus and keyboard arms
already read.

**Amended 24 September 2026 by handoff 32-A.** The Strand ports add four `all: "unset"` sites, so
the check reads 52 where it read 48 at `92fbdc3`: FacetRail's checklist row, Menu's item, and PostCard's
discovery-face title and presenter buttons. Each is the compile's own inline style and is ported as
drawn; none of them is bound by a page yet. The cleared field suppressions above now sit at
`Input.tsx:131` and `Select.tsx:71`. The port adds one `outline: "none"`, `Menu.tsx:321` on Menu's
item, and it is not cleared: the item draws focus as its hot ground rather than a border, which is
this gap's class (G87 item 13).

## G50. Sixteen files are not prettier-clean, and CI enforces prettier on every file type except theirs

**Severity: low, tidiness with one decision behind it. Not a merge blocker. Opened 19 September 2026
during Session 27, filed under ruling 597. The number is assigned by this entry (ruling 638). Not
fixed here on purpose: a whitespace diff across sixteen files would bury every other change in
Session 27's PR, which is the reason the handoff asks for a number rather than a reformat.**

**What it is.** `npx prettier --check .` reports sixteen files:

`.claude/settings.json`, `docs/audit/CONFORMANCE-01.md`, `docs/audit/FIX-PR-03.md`,
`docs/composer/SPEC.md`, `docs/connect/SPEC.md`, `docs/convene/P1-EXTRACTION.md`,
`docs/convene/P1-SPEC-R5.md`, `docs/convene/P1-SPEC.md`, `docs/onboarding/SPEC.md`,
`docs/profile/B4A-SPEC.md`, `docs/profile/SPEC.md`, `docs/security/PASS-01.md`,
`docs/security/PASS-02.md`, `docs/shell/SPEC.md`, `src/styles/strand.css`, `wrangler.jsonc`.

**Whether the repo enforces prettier in CI: it does, and that is what makes the sixteen readable as
a set rather than as an accident.** `pages.yml:39` runs `bun run lint`, which is `eslint .`, and
`eslint.config.js` ends with `eslintPluginPrettier` from `eslint-plugin-prettier/recommended`, so a
prettier violation is an eslint **error** and fails the job. What it does not do is reach these
files. Flat config lints `**/*.js`, `**/*.cjs` and `**/*.mjs` by default and the one `files` block
adds `**/*.{ts,tsx}`; nothing adds `.md`, `.json`, `.jsonc` or `.css`. Every one of the sixteen is
one of those four extensions, and every `.ts`, `.tsx` and `.cjs` file in the tree is clean. The
sixteen are not sixteen files that slipped past a gate; they are the exact complement of the gate's
reach.

**The decision this entry exists to surface.** Two coherent answers and the repo currently states
neither. Add `npx prettier --check .` as its own step in `pages.yml` beside `bun run lint` and
reformat the sixteen in a PR that does nothing else — which makes the formatter's authority match
its configuration, at the cost of one whitespace commit across the docs. Or narrow prettier's own
scope with a `.prettierignore` that names what is not enforced, so `--check` and CI agree and a
contributor running `bun run format` does not produce a diff CI never asked for. What should not
stand is the present state, where `bun run format` rewrites sixteen files that no gate will ever
complain about and no reader can tell whether that is policy or drift.

**Why no gate caught it.** It is not a gate's miss: the gate is doing exactly what it is configured
to do, over exactly the files it is configured to see. This is a scope question, which is why it is
an entry and not a fix.

**Not this gap's scope.** `.claude/settings.json`'s contents. An agent never writes its own
permission rules at any scope (ruling 378), so that file is named here as one of the sixteen and is
not touched, and whoever takes the reformat decision should note that it is the founder's file
whichever answer they pick.

## G51. The design-system bundle's runtime errors were fixed at cause in correction 21, and this repository holds no record of what they were — closed (Session 29, compile `v1789885868097915`)

**Severity: low for this repository's own code, which loads none of the bundle; medium for the
register, because a defect class closed with no written symptom cannot be checked off when the
compile that closed it arrives. Opened 21 September 2026 during Session 28 from handoff 28-A item 7,
filed under ruling 597. The number is assigned by this entry (ruling 638).**

**Why the entry exists at all.** The number is owed. 638 says a G number is assigned by writing the
entry into this file and is never reserved in a report, a PR body or a chat message, so the number
is written here with the description missing rather than promised somewhere the next reader will not
look.

**What this repository carries, read today.** `docs/strand/` holds exactly one compile,
`v1789720800167997`, which its own `README-EXPORT.md` names as correction 17. Its rules are in
`docs/strand/README.md`: one directory per compile, named from the bundle's own
`@ds-compile-id`; a directory is never overwritten and never deleted; nothing here is built into the
app or served to visitors, so no module imports the bundle, no route serves it and no build step
reads it. `LENSBAR-CHANGES-14-16.md` carries corrections 14, 16 and 17 and nothing later.

**What the tree does not carry, and this is the gap.** Correction 21 appears nowhere in this
repository: not in `docs/`, not in `CLAUDE.md`, not in any commit message on any branch. Neither do
corrections 18 to 20. No file here describes a runtime error raised by the bundle — not which error,
not where it was raised, not on which compile, not what correction 21 changed at cause. The entry is
therefore opened with its symptom record blank on purpose. Reconstructing a mechanism nobody read in
the tree is what rulings 943, 955, 957, 958 and 960 were written about, and ruling 555 says a
mechanism a handoff asserts is a lead to verify and never a fact to build on.

**What was owed, and from whom.** From Design or the founder: which errors the bundle raised, on which
compile, in which host, and what correction 21 changed at cause. That is four sentences from someone
who watched them, and it is the whole of what this entry needed to become useful.

## The symptom record, written from the artifact (21 September 2026, handoff 29-A item 6)

The compile carrying correction 21 landed in this tree as `docs/strand/v1789885868097915/`, and it
answers all four. Quoted rather than paraphrased, because a paraphrase of a defect is a mechanism
nobody read.

**Which errors, and where.** `docs/strand/v1789885868097915/STRAND-CORRECTION-21-EXTRACTION.md` §1(c):

> **(c) Item 11 is three errors, not five.** `NS.__errors` holds three entries: one React #299 in
> `ui_kits/dna/app.jsx`, one in `ui_kits/dna/composer/proto.jsx`, and `Can't find variable: IMG` in
> `ui_kits/dna/connect.jsx`. Not two and two and one. The correction's reading of the count is the
> only thing that changes; every cause it names is real and all three are fixed.

So: **three**, not the five the correction reported. Two React #299 (a `createRoot` with no container)
and one `ReferenceError` on an undefined binding.

**On which compile they were raised, and on which they are gone.** The pre-fix state is correction
20's `v1789787827785362`. `STRAND-CORRECTION-21-EXTRACTION.md` §0 tabulates it against the loaded
pre-fix bundle, with `the bundle's own demo errors` reading **3**, and the compile stamp in the same
file records the after side as `BUNDLE_ERRORS: "none"` at `v1789885868097915`. `README-EXPORT.md`'s
"Fixed" section states it plainly:

> **The bundle's `__errors` array is empty.** It held **three** entries — one React #299 in
> `app.jsx`, one in `composer/proto.jsx`, one `Can't find variable: IMG` in `connect.jsx`. Both
> mounts now check for `#root`; `connect.jsx` defines its own asset constant instead of reading one
> `shell.jsx` assigns after it has already been evaluated. No demo was removed.

**In which host.** The artifact names no browser, and it does not need to: each component in
`_ds_bundle.js` is wrapped in its own `try { … } catch (e) { __ds_ns.__errors.push({ path, error }) }`,
so `__errors` collects throws at module-evaluation time and the three entries are three demo pages of
Strand's own kit failing to evaluate — not a rendering that differs by engine. The host is therefore
any page that loads the bundle without the `#root` the two mounts assumed, which is what the fix
addresses. That is the honest answer to the fourth question and it is read off the artifact rather
than supplied by a witness.

**What correction 21 changed at cause.** `STRAND-CORRECTION-21-EXTRACTION.md` §3, "Item 11 — the
bundle's own errors":

> All three fixed at cause: both `createRoot` calls mount only when a `#root` exists, and
> `connect.jsx` defines its own `DEMO_IMG` rather than reading a binding `shell.jsx` assigns to
> `window` after `connect.jsx` has already been evaluated. No demo is removed. **`feed.jsx` has the
> same `IMG` pattern and does not error**, because its references are inside function bodies rather
> than at module scope; it is not one of the three and is left alone.

**Status: closed.** The record is what this entry was opened without, and the compile that closed it is
in the tree at a path that is never overwritten and never deleted (907). Two things are deliberately
not claimed. The closure rests on the artifact's own statement about itself, which is the shape ruling
891 refuses for a claim a harness could check — so this entry closes on a **record**, not on a check:
nothing in `src/` loads the bundle, no arm here can read `__errors`, and building one would mean
serving an artifact this tree deliberately does not serve. And `feed.jsx` carrying the same pattern
without erroring is recorded above because it is the kind of detail a later reader would otherwise
re-derive.

**Still not this gap's scope.** The app project's bound `_adherence.oxlintrc.json` and which compile it
belongs to; see the paragraph below, which is unchanged.

**Why it matters here even though nothing in `src/` loads the bundle.** Rulings 888 and 907 bind the
app Design project to a named artifact in this tree, and 855 and 858 bind a ratification to that
named artifact, which is why 18 lands beside 17 and never on top of it. When the compile carrying
correction 21 is exported into `docs/strand/`, this entry is where its fix is checked off and
closed; without the symptom record there is nothing to check it off against, and the closure would
rest on the export's own prose about itself, which is the shape ruling 891 refuses.

**Not this gap's scope.** The app project's bound `_adherence.oxlintrc.json` and which compile it
belongs to (handoff 28-A item 1, ruling 996). That is held on a statement from the founder or from
Design and is a separate question: this repository carries no adherence config at all, at root, in
`scripts/` or in `tests/`.

## G52. At the medium tier the lens bar's recorded mode disagrees with the lens bar's own recorded measurement, on the same run, in the same evaluate — closed (Session 29, handoff 29-A item 7)

**Severity: low as a rendering outcome — icon-first is a legible bar and nothing overflows, every
`lensFit` check on the run passed — and medium as a measurement problem, because a mode that does
not follow from the numbers printed beside it makes ruling 916's record unusable for pricing Brief
9's redraw, which is the job ruling 975 promoted the baseline to a gate for. Opened 21 September
2026 during Session 28, from handoff 28-A item 8's re-read, filed under ruling 597. The number is
assigned by this entry (ruling 638). Not fixed here: item 8 says a re-read that disagrees with 981
is reported and not reconciled, and no cause has been established.**

**Where the numbers come from.** `main` at `f36df8b9`, `matrix.yml` run 56, `special: shell`, against
`https://dna-web-application.pages.dev`. 596 of 596 checks passed, 18 arms, no crashed web process.
The mode, the track and the probe are all read in the one `page.evaluate` at `tests/matrix.cjs:4076`,
after `document.fonts.ready`, so they are the same moment by construction.

**The price, from `src/components/strand/LensBar.tsx` as it stands on that head.** Ruling 981: under
fill packing the price is `n × seat(widest)`, which the file spells
`need = 8 + others * 2 + n * seat`, with `seat = Math.max(activeMax, inactiveMax)` and labels chosen
when `Math.ceil(need) <= track.clientWidth`. On the Feed's five lenses that is
`need = 16 + 5 × seat`, so labels require `seat <= (track - 16) / 5`. At the medium tier the track is
616 at every width, so the threshold is **seat ≤ 120.0**.

**What run 56 recorded at 744, 820 and 1024.** Both engines measured below the threshold at all six
readings, and four of the six rendered icon-first anyway.

| Engine   | seat (widest probe) | `need` | track | price says | mode recorded                             |
| -------- | ------------------- | ------ | ----- | ---------- | ----------------------------------------- |
| chromium | 118                 | 606    | 616   | labels     | icon-first at 744, 820, 1024              |
| webkit   | 119                 | 611    | 616   | labels     | icon-first at 744; labels at 820 and 1024 |

The probe rounds to whole pixels in the harness, so chromium's seat is in `[117.5, 118.5)` and
webkit's in `[118.5, 119.5)`; the whole of both intervals sits under 120.0, so rounding does not
reach the disagreement. Nor does the engines' own spread: they differ by one pixel and land on
opposite answers at 820.

**Where the price and the mode do agree.** Everywhere else on the run. At the compact tier the
thresholds are seat ≤ 62.4 (track 328, 360 wide), ≤ 68.4 (358, 390) and ≤ 76.4 (398, 430), every
measured seat is 118 or 119, and all six compact readings are icon-first, as priced. At the expanded
tier `FeedSurface` passes `labels={expandedTier}`, so `canSwitch` is false, the bar never measures
and no probe is rendered — which the record shows as three chromium and three webkit lines carrying
a mode and a track and no probe at all. The disagreement is the medium tier and nothing else.

**What this is not.** It is not ruling 981 being wrong, and it is not the arithmetic being wrong:
apply the file's own expression to the file's own measurement and it answers labels. It is that the
mode the bar was rendering when the check read it does not follow from the measurement the same check
read. The two must therefore have come from different moments — the bar's `fit` is state, set by a
`measure()` that runs in a layout effect at mount and again on `ResizeObserver` and on the font
events, while the probe and the track are read once at check time. Anything more than that is a
guess, and this entry does not make one.

**What is worth knowing when it is picked up.** `useTier` starts at `compact` and corrects in an
effect, so every medium-tier mount lays out twice and the track's width changes underneath the bar.
And this repository's port carries no equivalent of the Strand bundle's correction 16 item 16, the
zero-measurement guard that keeps the rendering it has and retries rather than treating a zero as an
answer — `LENSBAR-CHANGES-14-16.md` in `docs/strand/v1789720800167997/` describes it and
`LensBar.tsx` does not have it. Both are places to look. Neither is established as the cause.

**The branch's own enforcing run moved the mode without moving the measurement, which is the
strongest thing this entry has.** Run
[278](https://github.com/jodombrown/dna-web-application/actions/runs/35552933642) on `d1e9e611`,
against the branch preview, read webkit as **icon-first at 744, 820 and 1024** where run 56 on `main`
read **labels at 820 and 1024**. The probe is byte-identical across the two runs
(`a63 i62 a90 i89 a119 i118 a77 i76 a82 i81`) and so is the track (616). Chromium's nine lines are
byte-identical between the two runs as well. So the same engine, given the same measurement against
the same track, answered differently on two runs: the mode is not a function of the measurement, and
what separates 820 on `main` from 820 on the branch is timing rather than pixels. The cross-engine
split the table above records is the same phenomenon caught once; this is it caught twice.

**Session 28's diff cannot account for it (confidence: high).** Ruling 1000 removed `dense`, which
was read in exactly two places: `ico` at render time in `LensBar`, and `AppHeader`'s bell predicate.
It never entered `canSwitch`, `measure()`, the probe's markup or the track, and the probe rendered
its 20px icon spacer with or without it, so the fit computation is the same code on both heads. The
shell arm also reads the Feed's own in-column bar, not the compact header bar, because it runs before
any scroll. That leaves the race (confidence: moderate to high) rather than the change.

**One consequence worth stating plainly.** On run 278 all six medium readings are icon-first on both
engines, so the disagreement with the price is uniform there rather than split. That is a tidier
record and not a better one: it is six readings the arithmetic says should have been labels.

**A third reading, and it is a third answer.** Run
[279](https://github.com/jodombrown/dna-web-application/actions/runs/35554896651) on `6ca7d623` — a
head whose only difference from `d1e9e611` is this file — read webkit's medium tier as **labels at
744**, icon-first at 820 and icon-first at 1024. So webkit's three medium widths have now produced
three different triples on three runs, on two heads whose fit code is identical and against a probe
and a track that never moved:

| Run                  | Head       | 744        | 820        | 1024       |
| -------------------- | ---------- | ---------- | ---------- | ---------- |
| 56 (`main` baseline) | `f36df8b9` | icon-first | labels     | labels     |
| 278                  | `d1e9e611` | icon-first | icon-first | icon-first |
| 279                  | `6ca7d623` | labels     | icon-first | icon-first |

Every one of those nine readings carries the same probe
(`a63 i62 a90 i89 a119 i118 a77 i76 a82 i81`) and the same 616 track, and the price says labels for
all nine. 744 has now answered both ways. This is no longer a split to be attributed to an engine or
to a head: within one engine, one measurement and one track, the mode is settled per run and per
width by something the record does not capture.

**What it costs elsewhere.** G37 is about this tier and its numbers are older than the code: its
table prices the widest label as an active tab at 131px under the pre-952 probe, which rendered
`padding: 0 14px` active against `0 8px` inactive, and its 619 comes from the pre-952 expression
`8 + others * 2 + activeMax + others * inactiveMax`. Ruling 952 made the probe's side padding uniform
and made every seat equal, and run 56 measures that same label at 118 (chromium) and 119 (webkit).
G37's finding may still stand; its arithmetic no longer describes the file, and that is recorded here
rather than edited into G37, which is not this PR's to reopen.

## Closed: the mode now follows from the measurement, on three readings and two engines (21 September 2026)

**Handoff 29-A item 7, the named proof, taken after the enforcing run on the final head (ruling 556)
and recorded here in a post-merge commit because a PR body dies with the thread (597). Readings are
CI's, never Code's (916).** The subject is `claude/handoff-29-a-8h9ozv` at
`496c4cbd85fca1382e1658664c6e524bd083075b`, merged to `main` as `1a71ee8`, against
`https://claude-handoff-29-a-8h9ozv.dna-web-application.pages.dev`.

**(a) Reproducibility.** The enforcing matrix, `pages.yml` run
[282](https://github.com/jodombrown/dna-web-application/actions/runs/35578165589) — 5090 of 5090 on
chromium and 5090 of 5090 on webkit, 209 arms each, no crashed web process, no unclassified failure —
and one further `matrix.yml` dispatch, run
[57](https://github.com/jodombrown/dna-web-application/actions/runs/35581148853) with `special: shell`
on the same head and the same `base_url`, 596 of 596. The two agree **line for line at every width on
both engines: mode, track and probe.**

| width | track | chromium probe                            | webkit probe                              | mode, runs 282 and 57 |
| ----- | ----- | ----------------------------------------- | ----------------------------------------- | --------------------- |
| 360   | 328   | `a17 i17 a43 i43 a72 i72 a31 i31 a36 i36` | `a17 i16 a44 i43 a73 i72 a31 i30 a36 i35` | icon-first            |
| 390   | 358   | same                                      | same                                      | icon-first            |
| 430   | 398   | same                                      | same                                      | icon-first            |
| 744   | 616   | same                                      | same                                      | icon-first            |
| 820   | 616   | same                                      | same                                      | icon-first            |
| 1024  | 616   | same                                      | same                                      | icon-first            |
| 1366  | 760   | no probe                                  | no probe                                  | labels                |
| 1280  | 760   | no probe                                  | no probe                                  | labels                |
| 1536  | 748   | no probe                                  | no probe                                  | labels                |

The three expanded lines carry no probe because `FeedSurface` passes `labels={expandedTier}`, so
`canSwitch` is false and the bar never measures — the same shape run 56 recorded on `main`.

**(b) Agreement with the price.** The bar names its packing now (`width="fill"` at every call site,
change-list item 24) and the test prices the packing it decides for (ruling 981, item 57). With
`icons` set, `seat(w) = max(44, w + 2·14 + 2·1 + 20 + 8)` and
`need = 2(TRACK_PAD) + GAP(n−1) + n · seat(widest)` on five lenses:

- chromium: widest 72, `seat = 130`, `need = 8 + 8 + 5 × 130 = 666`.
- webkit: widest 73, `seat = 131`, `need = 8 + 8 + 5 × 131 = 671`.

666 and 671 are above every track the bar measures against — 328, 358, 398 and 616 — so the price says
icon-first at all six widths on both engines, and icon-first is what all twelve lines rendered, twice.
**Every line's mode equals its own line's price.** That is what this entry recorded as not holding.

**The counterfactual (984).** The packing is doing the work, and naming it is what makes the answer
legible rather than lucky. Under `content` the price would be `Σ seat(wᵢ)`: chromium
`75 + 101 + 130 + 89 + 94 = 489`, plus 16, is **505**; webkit `75 + 102 + 131 + 89 + 94 = 491`, plus
16, is **507**. Both sit under the 616 medium track, so a `content`-packed bar would render labels
there. It does not, because this track stretches and divides equally under ruling 952, which is `fill`,
and `fill` is what all three call sites name.

**(c) Against run 56's `main` baseline (975), with the arithmetic for every line that changed.**

|                        | run 56 (`f36df8b9`)                                        | runs 282 and 57 (`496c4cb`)               |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| chromium probe         | `a63 i63 a89 i89 a118 i118 a77 i77 a82 i82`                | `a17 i17 a43 i43 a72 i72 a31 i31 a36 i36` |
| webkit probe           | `a63 i62 a90 i89 a119 i118 a77 i76 a82 i81`                | `a17 i16 a44 i43 a73 i72 a31 i30 a36 i35` |
| chromium medium        | icon-first, icon-first, icon-first — price said **labels** | icon-first ×3 — price says icon-first     |
| webkit medium          | icon-first, **labels**, **labels** — price said labels ×3  | icon-first ×3 — price says icon-first     |
| compact, both engines  | icon-first ×6, priced icon-first                           | icon-first ×6, priced icon-first          |
| expanded, both engines | labels ×6, no probe                                        | labels ×6, no probe                       |

**Every one of the twenty probe readings moved by exactly −46**, on both engines and in both the
active and the inactive shape. That is the whole of the change and it is arithmetic, not measurement:
the probe span used to carry the seat's glyph (20), its gap (8), its side padding (16) and its border
(2) inside its own markup, and those 46 pixels now live in `seat()` instead, so the probe reports the
label and nothing else. The seat's own price rose by 12 at the same time, because the bar's side
padding went 8 to `PAD` 14 (item 47, ruling 973). Net on the Feed's five lenses at medium: the old
price was `8 + 8 + 5 × 118 = 606` against a 616 track, which said labels; the new price is 666, which
says icon-first.

**The two lines that changed mode are webkit at 820 and at 1024**, labels to icon-first. Both were
lines where the old price said labels and the old rendering said labels on run 56 but icon-first on
runs 278 and 279 — the instability this entry exists for. They are now icon-first with the price
agreeing, on two independent runs.

**Why this closes rather than merely improves.** The entry's finding was never that icon-first was
wrong; it was that "the mode the bar was rendering when the check read it does not follow from the
measurement the same check read", and that three runs on two heads produced three different triples
from one probe and one track. Two things in handoff 29-A's item 2 reach that directly. The
zero-measurement guard (correction 16 item 16) was this entry's own second candidate, named in "what is
worth knowing when it is picked up", and it is now ported: a measurement of zero keeps the rendering
the bar has and retries on a frame and on a 120ms timer, bounded, rather than collapsing `need` below
any column. The scale normalisation (item 17) landed with it. And the price moved 60px clear of the
616 track, where it had been 10px under it, so a race that lands on either side of a 10px margin no
longer has a boundary to land on. The first is a cause the entry had already named; the second is why
the margin that made it visible is gone.

**A third reading, on a third deployment, taken the same day.** Run
[284](https://github.com/jodombrown/dna-web-application/actions/runs/35581795427), PR #53's own
`matrix (webkit)` against a different Pages preview
(`claude-handoff-29-a-post-mer.dna-web-application.pages.dev`), read the bar at all nine viewports
**byte-identically to runs 282 and 57**: `a17 i16 a44 i43 a73 i72 a31 i30 a36 i35` on tracks of 328,
358, 398, 616, 616 and 616, icon-first at every one, and labels with no probe at 760, 760 and 748.
That job went red on G5's twentieth sighting, two crashed web processes at 1280x800 in unrelated
arms; its lens record is untouched by that and is recorded here because a third agreement on a third
deployment is what this entry spent three runs failing to get.

**What is not claimed.** `useTier` starting at `compact`, this entry's first candidate, is unchanged —
handoff 29-A item 7 holds it out as shell-wide with its own blast radius. So the race is not proven
absent; it is proven not to change this bar's answer at any width in ruling 61's matrix, twice, on both
engines. If a future reading disagrees with its own line's price, that is a new sighting and this entry
is where it starts, reopened rather than rewritten.

## G53. The Lens Bar's visual contract now describes a bar this repository does not build, and the header's two centre-slot states no longer share a height

**Severity: low as a rendering — every frame the code produces is the one the compile governs — and
medium as a contract, because ruling 62 makes SPEC.md the visual contract and a contract that
disagrees with the build is read as the build being wrong. Opened 21 September 2026 during handoff
29-A's Strand re-sync, filed under ruling 597. The number is assigned by this entry (ruling 638). Not
fixed here: 29-A's scope is the re-sync, and a SPEC is Design's document under rulings 62, 663 and 129.**

**What moved.** The re-sync to compile `v1789885868097915` took the geometry from the compile, under
ruling 844 carrying 618's lesson. Four lines of `docs/shell/LENS_BAR_SPEC.md` no longer describe
`src/components/strand/LensBar.tsx`:

| LENS_BAR_SPEC says                                                                               | the build now does                                                  | why                                   |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------- |
| Track "44 tall at every breakpoint"                                                              | 52, composed 4 + 44 + 4                                             | ruling 918, change-list item 35       |
| Seats "min 44 wide, 36 tall"                                                                     | 44 wide and 44 tall                                                 | ruling 918, items 35 and 54a          |
| Compact variant "inactive lenses min `--target-min`"                                             | 44, in every mode                                                   | rulings 905 and 498, items 50 and 54a |
| "Active content: icon 20 plus label ... at every breakpoint except the compact-tier header slot" | in icon-first every seat is one 44px glyph, the active one included | R1, ruling 936, item 40               |

`docs/shell/SPEC.md` line 15 is stale on the same control for an older reason: it still describes the
header slot as `dense` with "the active lens shows its name in place of its icon" and seats at "36
tall" and "32 min". Ruling 1000 retired `dense` before this PR and the prop no longer exists.

**The second half, which is a real consequence and not only a document.** LENS_BAR_SPEC's "Composer
entry, same language" says the composer entry "shares the track's shape, not a pill: `--bg-sunken`,
`--radius-m`, 44 tall". `AppHeader` builds it at `minHeight: 44` and the header row is 56 tall at
compact and medium. The two states of that one centre slot are now 44 (composer entry) and 52
(LensBar track). Both fit the row and they never render at the same time — `data-centre` is `lens` or
`compose` — so nothing clips and nothing overflows. But the slot's two states no longer share a
height, and the sentence that said they share a shape is the sentence that made them one control in
two states.

**What closing it needs.** A Design decision on one question — does the composer entry follow the
track to 52, or do the two states stop sharing a height — and then one pass over `LENS_BAR_SPEC.md`
and `SPEC.md` line 15 against compile `v1789885868097915`. Neither is code this PR may write: the
extraction and SPEC.md are the visual contract (ruling 62) and Strand does not open the app project
(663).

**Amended 24 September 2026 by handoff 32-A.** The severity line's "every frame the code produces is
the one the compile governs" does not hold for the descriptor's size and spacing, the track's and the
seat's radii, the track hairline or the chip's shadow; G82 carries the descriptor, which is the one of
those 844 reaches.
Since G82 closed, the descriptor's size is the compile's 13; its 12 below the track stays, under 405.

## G54. `width="content"` is reachable and this bar's active seat is bolder than its inactive one, so that packing would re-lay the row on every selection

**Severity: low, because no caller passes it — `FeedSurface`, `ConnectSurface` and `AppHeader` all
name `fill` — and medium if one ever does, because the failure is G48's exactly and G48 is closed.
Opened 21 September 2026 during handoff 29-A's Strand re-sync, filed under ruling 597. The number is
assigned by this entry (ruling 638). Not fixed here: the fix is a decision about the active seat's
weight, which is LENS_BAR_SPEC's and therefore Design's (rulings 62, 663).**

**The mechanism, read in the tree.** Change-list item 24 adds `width`, and ruling 981's fit test
prices the packing it names. Under `fill` every seat takes `flex: 1 1 0` and every seat is the same
width whichever lens is active, which is ruling 952 and what closed G48. Under `content` the compiled
part leaves `flex` undefined and each seat sizes to its own label — which is safe in Strand, because
Strand's `TAB` carries `fontWeight: 500` for every seat and a label is the same width selected or
not.

**This bar is not Strand's on that one point.** `LENS_BAR_SPEC.md` specifies "Active content: icon 20
plus label 15/700" against "Inactive lenses ... icon plus label 15/500", and
`src/components/strand/LensBar.tsx` renders `fontWeight: on ? 700 : 500`. Under `content` packing the
selected seat would therefore be wider than the same seat unselected, every other seat would move to
make room, and selecting a lens would slide the row under the finger that chose it. That is G48's
defect, in a packing G48's fix does not reach, because the fix was equal flex rather than equal
content.

**Why the prop exists anyway.** Handoff 29-A Done Means 3 requires every call site to name its
packing, precisely so the compile's `content` default cannot change a page silently; all three name
`fill`. The measurement already handles `content` correctly — it prices `Σ seat(wᵢ)` from each lens's
own widest measured shape, so the fit verdict would be right even where the rendering reflows.

**What closing it needs, and the two ways out.** Either the active seat's weight stops varying, which
is what Strand did and what would make `content` safe here as it is there, or `width="content"` is
refused by the type until it does. Both are one line; neither is this PR's to choose, because the
15/700 active label is the visual contract's (ruling 62) and this handoff's scope is the re-sync.

**Amended 24 September 2026 by handoff 32-A.** Correction 25's `trailing` seat makes a `content`
tablist `flex: 0 1 auto` with the seat at `margin-left: auto`, so the reflow this entry describes would
also slide the seat. No caller passes `trailing` or `content`.

**Amended 26 September 2026 by handoff 33-A Addendum 2 (1145).** A caller now passes `content`, so
the reflow this entry predicts is live, and the severity line's "low, because no caller passes it"
does not hold: by that line's own clause the entry is **medium**. It has been since handoff 32-B
gave Discovery's compact bar `content` (G104), which is also when 32-A's "No caller passes ...
`content`" stopped being true; B9-SPEC Revision 5's Lens bar line now makes it `width="content"` at
every tier, the bar centred in the shell's lens row at medium and expanded. Measured in Chromium at
820 and 1280, selecting Communities from All makes its seat 1.19 wider and All's 0.55 narrower, so
the bar grows 0.64 and, being centred, moves both its edges: every seat shifts, Communities' start
by 0.86, where on `f19af1f` the same selection moved no seat at either width. At 390 it moves
Communities' start by 0.55 and every seat after it, and the bar's end, by 0.64, the same on
`f19af1f` as after this change. The size is recorded beside the severity and does not lower it: the
slide is under 1.2 with these five words, against the up to 79 G48 quotes from the prototype, but
the mechanism is G48's, selection as a layout input, and it grows with the active label's length.
The two ways out above are unchanged and still not the caller's: a constant active weight is
LENS_BAR_SPEC's, and `LensBar.tsx` is a Strand part (844). Its comments at lines 42, 156 and 366
still say every caller passes `fill` and none passes `content`; that has been false at compact since
32-B and is now false at every tier, and it is left for the part's next change under 844.

## G55. Nothing in the harness proves that a file under `public/strand/icons/` serves from the deployment

**Severity: low. No icon is missing today and every surface that draws one renders correctly across
ruling 61's matrix. It is recorded because it is the reason a proof this session owed could not be
taken. Opened 21 September 2026 during handoff 29-A, filed under ruling 597. The number is assigned by
this entry (ruling 638).**

**What was owed and what was taken.** Handoff 29-A item 5 asks that the two new glyphs,
`panel-left-close.svg` and `chevron-left.svg`, hash identically to their copies under
`docs/strand/v1789885868097915/assets/icons/` **and that each resolves on the deployed preview**. The
hashes were taken and match (`d4e8abae…4bbd0` and `40cff7c3…4f758`), and both served 200 from
`wrangler pages dev dist` of the built worker. The deployed half was not taken and is reported unproven
rather than passing (ruling 228).

**Why it could not be taken, and why that is the gap rather than the session's problem.** The session
that would have fetched them had no egress to `*.pages.dev` — the proxy answered 403 to CONNECT — so it
fell to the harness, and the harness does not ask. `scripts/deployment-serves.sh` polls every path the
suites open plus ruling 184's asset contract: `/strand/logo.png`, `/favicon.png`,
`/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/manifest.webmanifest` and exactly one
Adinkra mark, `/strand/adinkra/mate-masie.svg`. **No path under `/strand/icons/` is in it**, and
`Icon.tsx` draws every glyph as a CSS mask, which paints nothing and raises nothing when the URL 404s.
So an icon that failed to ship would be invisible to CI and visible only to a person looking at the
page.

**What closing it needs.** One decision and one line. The decision is scope: ruling 184's block is an
asset _contract_, a named table, and forty-four icons are not that — so either the two or three glyphs
a rail collapse control will bind get named alongside the contract, or the check learns to walk
`public/strand/icons/` and poll what it finds. The second is the honest one and it is the one that
cannot rot, because a glyph added later is covered without anyone remembering. Either is a line in
`scripts/deployment-serves.sh`, which the `deploy`, `live` and both `matrix` jobs already run.

## G56. Three rows the build already derives by trigger, which is the shape ruling 1002's absolute now forbids

**Severity: low today, medium at the next change to any of the three. Opened 21 September 2026
during handoff 29-B, filed under ruling 597. The number is assigned by this entry (ruling 638). Not
fixed here: the handoff names item 3 as record and change none of them, and two of the three are
held in place by rulings that point the other way.**

**The rule, read forwards.** Ruling 1002 puts the absolute in `CLAUDE.md`: a derived row, one table
restating a fact whose truth lives in another, is written by its source's write path in the same
transaction that writes the source, and never by a trigger. Convene Pass 2 is built to it —
`public.event_registrations` is the truth, `private.rsvp_write` writes the `event_rsvp` edge beside
it, and `private.rsvp_edge_drift()` plus `tests/rsvp-drift.cjs` enforce the derivation rather than
asserting it. Read backwards, the rule is a question about the rows already here. Three answer to it.

**1. The accept derives four rows by trigger.** `private.on_connection_accepted()`
(`20260908233543_b4_connect_rls.sql:88`), on `on_connection_request_accepted_graph`, fires after an
update of `status` on `public.connection_requests` and inserts two `connect` rows into `public.edges`
and two rows into `public.member_connections`. The source's write path is
`public.respond_to_request` (`20260908233909_b4_connect_rpcs.sql:478`), which writes the status and
nothing else. Under 1002 those four inserts belong inside `respond_to_request`, and nothing measures
the agreement: there is no `connect_edge_drift`, so a request accepted by any path the trigger does
not see leaves the graph short an edge and nobody learns of it. This is the nearest kin to the RSVP
derivation and the one a drift function would be cheapest to add to.

**2. Second degree is maintained by trigger on a derived table.**
`private.second_degree_on_connect()` (`:114`), on `on_member_connection_second_degree`, fires after
an insert on `public.member_connections` — itself a row written by the trigger above — and writes
`public.second_degree`. So it is a derivation of a derivation, two triggers deep from the write path.
**This one is doctrine, not drift.** `CLAUDE.md`'s Connection Engine section carries ruling 111's
words: second degree is "served from a materialized set, refreshed incrementally on new connections
and fully overnight". 1002 and 111 point in different directions here, and which wins is a decision
rather than a repair. The nightly `private.refresh_second_degree()` is already the drift correction
1002 would otherwise ask for, which is the argument for leaving it exactly where it is.

**3. The follow mirror, the lead the handoff named, and it is real.**
`private.mirror_follow_edge()` (`:197`), on `on_edge_follow_mirror`, fires after an insert or an
update of `revoked_at` on `public.edges` and mirrors a live `follow` edge into
`public.member_follows`, deleting the mirror when the edge is revoked. The source's write path is
`public.set_follow` (`20260908233909_b4_connect_rpcs.sql:514`), which writes the edge and nothing
else. Under 1002 the mirror belongs inside `set_follow`, in the same transaction, with a drift
function beside it. Of the three this is the plainest breach: the mirror restates the edge and
nothing else, exactly as the `event_rsvp` edge restates the registration.

**Considered and excluded, with the reason, so the next reader does not re-derive them.**

- `private.notify_connection_accepted()` (`20260908142054_b3_rulings_141_142_144.sql:269`), on
  `on_connection_request_accepted`, inserts a `public.notifications` row on accept. A notification is
  a consequence with a life of its own — it is read, it is dismissed — not a second statement of the
  source's fact, and no drift function could compare the two once that life begins. Ruling 144 is
  what puts it there.
- `private.on_member_blocked()` (`20260909051055_r198_block_semantics.sql:33`) revokes edges and
  deletes adjacency and mirror rows on a block. It removes derived rows rather than writing them, and
  `CLAUDE.md` already names "the ruling 198 trigger carries every consequence". Worth recording all
  the same: `public.member_blocks` has **no write path function at all** — ruling 216's control
  inserts the row directly under RLS through `src/lib/blocks.ts` — so there is no write path for
  those consequences to move into. It is the one place in the tree where 1002's absolute has no
  landing site, and closing it would mean giving block a write path first.
- `private.handle_new_user()` (`20260908072031_b3_profile_rpcs.sql:42`) derives the `public.members`
  row from `auth.users`. The source is written by GoTrue and we own no write path on it, so a trigger
  is the only mechanism there is.
- `private.stance_declared()` (`20260911052909_b5_stance_onboarding.sql:111`) is a BEFORE trigger
  setting `stance_declared_at` on the row being written. Same row, same statement; no second table.
- `private.edges_purge_member()` (`20260908233543_b4_connect_rls.sql:219`) deletes inbound edges on
  member delete, standing in for the foreign key `edges.to_id` cannot carry because it is
  polymorphic. Cleanup, not derivation.
- `private.enforce_vocab_cap()` (the seven `member_*_cap` triggers) and `on_member_block_rate_limit`
  (`20260912090557_fix_pr_02_rulings_408_444.sql:143`) raise or refuse. They write no row at all.

**What closing it needs.** Item 3 for the follow mirror: move the `member_follows` write into
`set_follow` and add a drift function and an arm in `rsvp-drift.cjs`'s shape. Item 1 the same, inside
`respond_to_request`, and it is the larger of the two because four rows across two tables move at
once. Item 2 needs a ruling that says which of 1002 and 111 governs a set that is already rebuilt
nightly, and that is the founder's, not a PR's.

**Ruling 1017 (Session 30) answers item 2's question.** 111 decides what `second_degree` is, a
materialized set refreshed incrementally on new connections and fully overnight, and 1002 decides how
it is written: by the source's write path, in the same transaction, never by a trigger. The two do not
compete. So the incremental refresh moves into `public.respond_to_request` when that path is next
touched, the other two trigger rows (items 1 and 3) move the same way at the same time, and nothing
changes now.

## G57. The RSVP drift arm cannot state the denominator its own PASS line is specified to carry

**Severity: low. The agreement is measured whole either way; what is missing is the number standing
behind it. Opened 21 September 2026 during handoff 29-B, filed under ruling 597. The number is
assigned by this entry (ruling 638). Not fixed in 29-B: the fix belongs in a migration file, which
under rulings 466 and 225 has to come from the file's author. Corrected and closed by ruling 1022 in
handoff 30-A: see the closing paragraph, which replaces the grant this entry first proposed.**

**The mechanism, read in the tree.** Handoff 29-B item 2 specifies the arm's passing outcome as "a
`PASS` that states how many going member registrations it measured", and in the same paragraph
specifies the role it connects as: "the second file grants that role `USAGE` on `private` and
`EXECUTE` on the function and nothing else". Both are true of
`20260921120100_p2_event_registrations.sql` as written — lines 283 and 284 make exactly those two
grants — and together they do not admit the count. `private.rsvp_edge_drift()` returns disagreements
only, never a total, and `live_arms` holds no `select` on `public.event_registrations`: the file
revokes all from `anon` and `authenticated`, grants `select` to `authenticated` and `all` to
`service_role`, and names `live_arms` nowhere on the table. Switching into `authenticated` does not
reach it either, because `live_arms` holds that role with `inherit false` and `auth.uid()` is null
under it, so `event_registrations_member_select` admits no row.

**What the arm does instead.** `tests/rsvp-drift.cjs` reads the count in its own statement, outside
the drift read, and prints the number when the connecting role can see it and the reason when it
cannot. The PASS line therefore states the agreement — every going member registration carries one
live `event_rsvp` edge and every live edge carries a going registration, which
`private.rsvp_edge_drift()` measures whole because it is SECURITY DEFINER — and names this gap where
the denominator would be. The moment a later migration grants the select, the number appears with no
edit to the arm.

**What closing it needed, corrected (handoff 30-A).** This entry first proposed a column grant,
`grant select (event_id, member_id, status) on table public.event_registrations to live_arms;`, as the
narrowest fix. It would have read zero. `live_arms` does not bypass row security (ruling 382), and
every policy on `public.event_registrations` is to `authenticated` or `service_role`, so under that
grant the count succeeds and returns 0 whatever the table holds; and a policy admitting `live_arms`
would show it real members' rows, which is what 382 exists to refuse. Ruling 1022 closes it the other
way: `private.rsvp_going_member_count()` in `20260921140100_p2_event_parties.sql`, SECURITY DEFINER,
returning the number of going member registrations and nothing else, with EXECUTE granted to
`service_role` and `live_arms`. `tests/rsvp-drift.cjs` calls it in place of the direct count and names
its two failures apart: `42883`, the function not on the project, is the state between commit and
apply and the PASS says the count function is not applied yet; `42501`, the function present and not
executable by this role, is drift of the kind the arm already calls a FAIL for `rsvp_edge_drift()`,
because the same file grants it. After the apply the PASS line states the number, zero included.

**Closed** on run 294 (35681550980), the enforcing run on `3d1e430`, the head that carries the
regenerated types (handoff 30-A item 7) and the first on which the function is both committed and
applied. Green on all four jobs; its `live` job printed 0 going member registrations from
`private.rsvp_going_member_count()`. The number could not be written here by that same head, because
a run number exists only once the run starts and ruling 556 commits nothing to the branch after the
enforcing run starts; PR #55 reported it, and handoff 30-B wrote it into this paragraph.

## G58. Ruling 225's ordering turns the drift arm red on the branch that obeys it, and the doctrine records only the other direction

**Severity: low in effect, medium in cost to the next reader — the whole `live` job reads red for the
length of the window, so a real failure arriving beside it is easy to miss. Opened 21 September 2026
during handoff 29-B, filed under ruling 597. The number is assigned by this entry (ruling 638). Not
fixed here: the two ways to clear it are Chat's apply and a change to the arm, and neither belongs in
this PR.**

**The mechanism, measured rather than reasoned.** Run 285 on `claude/handoff-29-b-dna-web-7k9lf7`,
head `3a14918`, job `live`, step 8:

```
FAIL 20260921120000 r1004_1010_audience_helpers: in the tree as 20260921120000_r1004_1010_audience_helpers.sql, not recorded on the project
FAIL 20260921120100 p2_event_registrations: in the tree as 20260921120100_p2_event_registrations.sql, not recorded on the project
```

That is `tests/migration-drift.cjs`'s second loop — the one that walks the repo map and fails any
version the project did not return — and it fires on exactly the state ruling 225 mandates. 225 says
a migration is committed before the state it describes is applied. From the commit until Chat's
apply, the branch carries a file the project has no row for, and the arm calls that drift, because
from inside the arm the two directions are indistinguishable: it cannot tell a migration waiting to
be applied from one that was applied and then lost its row.

**`CLAUDE.md` analyses the mirror case only.** Its paragraph on the paste window works through
`recorded on the project, no file in the tree` in detail — that the FAIL is latent on `main` because
no workflow here carries a `schedule` and the merge is itself the triggering push, that **the
exposure is every other branch**, and that the remedy is to paste immediately before merging and cut
nothing in between. Every word of that is about the direction that opens _after_ the apply. The
direction that opens _before_ it, on the PR branch itself, is not written down anywhere, and it is
the longer of the two whenever a handoff puts a relay between the commit and the apply, as 29-B does:
PR #52 had to merge, then the founder relays, then Chat applies.

**Why it matters beyond the noise.** Step 8 failing fails the whole `live` job, and the job carries
the ruling 218 arms, the migration drift and now the RSVP drift. A reader seeing `live` red on a
migration PR learns nothing about which of those is speaking without opening the log. On this run
step 7 read `120/120` and step 9 read its intended UNPROVEN, so the red was step 8 alone — but that
had to be read out of the log rather than off the job.

**What closing it needs, and the two shapes it could take.** Either a fourth outcome in the arm —
a version in the tree with no row on the project, and no row for any _later_ version either, is
`PENDING` rather than `FAIL`, which distinguishes a migration waiting to be applied from one whose
row was lost, since a lost row would sit behind versions that did apply — or a line in `CLAUDE.md`
stating plainly that a migration PR's own `live` job is red between commit and apply, so the next
reader stops at the log instead of at the diff. The first is the better guardrail and the one that
needs a ruling, because `PENDING` is a hole in a gate and the argument for it is that 225 puts the
hole there deliberately. The second is a sentence and could ride any PR.

## G59. First sighting: the vocabulary arm's 5 s attach wait timed out once on WebKit, and did not reproduce

**Severity: low. One sighting, not reproduced, on an arm whose subject is a deliberately empty
control. Opened 21 September 2026 during handoff 29-B, filed under ruling 597. The number is assigned
by this entry (ruling 638). Not fixed here: one sighting is not a pattern, and `tests/matrix.cjs`
says plainly that a class is added to the ruling 357 list "when a sighting is understood, never to
make a tail read cleaner".**

**What failed.** Run 286 attempt 1, `matrix (webkit)`, head `1e63c04`, 5087 of 5089 checks passing:

```
FAIL [no crash] webkit-390x844-dark-vocab-failed: flow completed TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('section[role="dialog"][aria-label="Compose"]').locator('[role="radiogroup"][aria-label="Instrument"]')

FAIL [no crash] ruling 292 | webkit-390x844-dark-vocab-failed: emitted every check it declares UNPROVEN (228): emitted 3 of 4; the 1 checks behind the failure never ran
```

The second is ruling 292's consequence arm reporting the check the timeout swallowed. One finding.

**The arm, read in the tree.** `tests/vocabulary.cjs:92` to `98`, the `vocab-failed` variant of
rulings 193 and 194, where the `vocabularies()` read is forced to fail so a flow can check the
controls behave. It opens the composer, waits up to 10 s for the Compose dialog, clicks the "Post a
Need (Contribute)" radio, then waits for the Instrument radiogroup with
`waitFor({ state: "attached", timeout: 5000 })`. The wait is for attachment rather than visibility on
purpose — the file's own comment says "a radiogroup with no options has no box, which is the point",
because under the forced failure the group renders empty. So the 5 s is the budget for the composer
to mount the group after the failing vocabulary request settles.

**Why it reads as a flake rather than a defect.** Four readings, none of them the arm's own:

- `matrix (chromium)` passed on the **same head**, `1e63c04`.
- `matrix (webkit)` was green on `main` at `1a71ee8`.
- The re-run of the same job, same head, same deployment, passed.
- Within the failing job, compact was 77 of 78 clean and medium and expanded were 55 of 55 and 76 of 76. Ruling 554's tell: a real defect in that radiogroup would fail the arm at every viewport, in
  both themes and on both engines.

**Why it landed `unclassified`, correctly.** Ruling 357's class matches the WebKit wording for an
aborted fetch on the mocked REST origin, `… due to access control checks`, against a failure's page
errors. This failure's detail is a Playwright locator timeout, so `ABORTED_MOCK_FETCH` did not match
and should not have. The tail said `0 behind a web-process crash (G5) | 0 an aborted fetch on mocked
REST | 2 unclassified`, which is the honest reading.

**What closing it needs.** A second sighting, which turns one timeout into a pattern worth acting on;
or changing the wait to key on the settled state the composer reaches after the forced failure rather
than on a fixed 5 s. The second is **G34's shape exactly** — a fixed wait standing in for the thing
actually being waited on — and if G34 is ever closed by teaching `matrix.cjs` to wait on states
rather than clocks, this wait belongs in the same pass.

## G60. Brief 7 draws no accepted-role state, and Brief 10's invitation sheet promises one

**Severity: moderate. Opened 21 September 2026 during handoff 30-A, filed under ruling 597. The
number is assigned by this entry (ruling 638). Not fixed here: the line belongs to Brief 10's build
handoff and the state belongs to a Brief 7 revision, and neither is this PR's.**

**The disagreement, read across the briefs.** Brief 10 section 6 assigns the accepted role on a
profile to Brief 7, and Brief 10's SPEC puts `Your profile lists the role once you accept (Brief 7).`
in the invitation sheet. Brief 7 Revision 1 defers Connect to Convene and draws no such state: there
is no profile element for a role a member has accepted on an event, on any tier, in any theme.

**What the tree holds.** `public.event_parties` (`20260921140100_p2_event_parties.sql`) stores the
acceptance under ruling 1018: one row per member per role per event, with a status of `invited`,
`accepted` or `declined`, and `event_parties_named_member_select` lets the member read their own rows
in every status. No surface reads it on a profile. `profile_view` does not join it, and nothing in
Brief 7's extraction has a place for it to land. So when Brief 10 ships, the sentence in its
invitation sheet describes a state the profile does not have, and a member who accepts on that promise
opens their profile and finds nothing.

**What closing it needs.** Two decisions, in two places. Brief 10's build handoff decides the line:
either the sentence comes out of the sheet, or it is rewritten to promise only what the event page
shows, which is the accepted name and image on every projection of that event (678). A Brief 7
revision draws the state: where an accepted role sits on the profile, what it reads, and whether it
carries the event's link. The second is a Claude Design pass under ruling 62 and cannot be
reconstructed from the SPEC's one sentence (ruling 90). Until the revision lands, nothing reads
`event_parties` on a profile and the sheet line is the only thing that says otherwise.

## G61. Older tables carry grants the newer files revoke, because Supabase's default privileges hand them out and only six files take them back

**Severity: low, an invite-boundary gate under prototype posture (ruling 140). Opened 21 September
2026 during handoff 30-A, filed under ruling 597. The number is assigned by this entry (ruling 638).
Not fixed here: a fix is a new migration under ruling 466, from Chat.**

**The mechanism, read live on the canonical project on 21 September 2026.** `pg_default_acl` carries
one row for tables in `public` owned by `postgres`: `anon=Dxtm`, `authenticated=Dxtm` and
`service_role=Dxtm`, which is TRUNCATE, REFERENCES, TRIGGER and MAINTAIN handed to every table at
creation before any file says a word about it. No migration in the tree alters default privileges.
Six files run `revoke all on table ... from anon, authenticated` before granting what they mean
(`20260921120100` and `20260921140100` among them), and those tables carry only what the file
grants; every other file granted on top of the default and left the four in place. Row security does
not govern TRUNCATE, and neither TRUNCATE, REFERENCES, TRIGGER nor MAINTAIN is reachable through
PostgREST today, which is why the severity is low: the grants are real and nothing can use them yet.

**Every table in `public` that carries them, from `information_schema.role_table_grants`.** The view
does not report MAINTAIN, so each row below reads as TRUNCATE, REFERENCES, TRIGGER and, by the default
ACL, MAINTAIN. Only `public.event_registrations` carries none of them: `authenticated` holds SELECT
alone.

For `authenticated`, every table but `event_registrations`: `attestations`, `connection_requests`,
`corridors`, `countries`, `dismissed_suggestions`, `edges`, `event_delivery`, `event_host_settings`,
`events`, `feed`, `focus_areas`, `industries`, `intents`, `interests`, `languages`, `media`,
`member_about`, `member_blocks`, `member_connections`, `member_corridors`, `member_embeddings`,
`member_focus_areas`, `member_follows`, `member_homes`, `member_industries`, `member_intent`,
`member_intents`, `member_interests`, `member_languages`, `member_links`, `member_origin`,
`member_regional_expertise`, `member_skills`, `member_stance_details`, `member_stances`,
`member_visibility`, `members`, `notifications`, `opportunities`, `post_dia`, `post_drafts`,
`post_links`, `post_media`, `post_reactions`, `post_saves`, `posts`, `regional_expertise`,
`second_degree`, `skills`, `space_roles`, `spaces`, `stories`, `world_countries`.

For `anon`: `attestations`, `countries`, `event_delivery`, `event_host_settings`, `focus_areas`,
`industries`, `intents`, `interests`, `languages`, `media`, `member_about`, `member_focus_areas`,
`member_follows`, `member_homes`, `member_industries`, `member_intent`, `member_intents`,
`member_interests`, `member_languages`, `member_links`, `member_origin`,
`member_regional_expertise`, `member_skills`, `member_stance_details`, `member_visibility`,
`members`, `regional_expertise`, `skills`, `world_countries`. The tables the handoff named from its
own read, `member_stances`, `focus_areas`, `notifications` and `event_delivery`, are four of these;
`20260907010622_b2_notifications.sql:49` revoked from `anon` only, which is why `notifications` is
absent from the `anon` list and present in the `authenticated` one.

**The second write path, in the same read.** `authenticated` holds INSERT, UPDATE and DELETE on
`public.event_delivery`, admitted by `event_delivery_host_all`
(`20260916120100_p1_convene_place_columns.sql:116`), beside `publish_post`'s write of the same rows.
`public.event_host_settings` carries the same shape under `event_host_settings_host_all` (`:121`).
Under the one-write-path absolute those are a second door each, held shut today only by the host
predicate in the policy.

**What closing it needs.** One migration from Chat, under 466: `revoke truncate, references, trigger,
maintain on all tables in schema public from anon, authenticated`, and `alter default privileges for
role postgres in schema public revoke truncate, references, trigger, maintain on tables from anon,
authenticated` so the next table starts clean without its file remembering to say so; then a
decision, not a revoke, on `event_delivery` and `event_host_settings`, because dropping the direct
grants there removes a path a Convene surface may already use. A harness arm that reads
`role_table_grants` and fails on any of the four for `anon` or `authenticated` would keep it closed,
in `tests/migration-drift.cjs`'s shape.

**Narrowed 28 September 2026, in handoff 35-A (items 5 and 10).** The four privileges are revoked from
every table in `public` and from the default by `20260927120100`, and the live arm "G61 (Session 35)"
keeps them closed: it reads `pg_class.relacl` through `aclexplode` and `pg_default_acl`, not
`role_table_grants`, which lists only the grants where the reading role is grantor or grantee and so
reads zero as `live_arms` whatever the truth. The entry stays open for the direct INSERT, UPDATE and
DELETE on `event_delivery` and `event_host_settings`, which are filed as G145.

## G62. Strand's `Segment.tsx` still names `SegmentBlock` in its own header, one line the rename under 1007 was told not to touch

**Severity: cosmetic. Opened 22 September 2026 during handoff 30-B, filed under ruling 597. The
number is assigned by this entry (ruling 638). Not fixed here: the handoff names the file as not
edited, and its two Done Means disagree on this one line.**

Ruling 1007 renamed `src/components/strand/SegmentBlock.tsx` to `StanceBlock.tsx` and its five
identifiers with it. `src/components/strand/Segment.tsx:3`, the header of Strand's segmented
control, reads "Not SegmentBlock: that is the Profile's stance block", written when the two parts
shared a prefix so a reader would not confuse them. After the rename that line names an export
that no longer exists. Handoff 30-B's Done Means 1 asks the identifier scan over `src` and `tests`
to return nothing, and its Done Means 2 asks `git diff` to show no change to `Segment.tsx`; on this
line they cannot both hold, and the handoff's own body says the file is not renamed and not
edited, so the build left it and the scan returns this one comment line. Closing it is a one-line
edit to that comment, "Not StanceBlock", in a change whose brief names Strand's `Segment` as
editable.

## G63. The "Who sees what" rail row still falls back to the literal `Stance` when `stance_label` is absent

**Closed 22 September 2026 under ruling 1031 (handoff 30-C item 12): the row keeps the section's
name. It is navigation, not a stance label read out of a row, so it is not a ruling 194 case and
no change is made. Opened 22 September 2026 during handoff 30-B, filed under ruling 597; severity
was low.**

Handoff 30-B removed the stance section title's literal fallback under ruling 194: the title reads
`public.member_stances` through `vocabularies()` and renders no text when that read fails. The
owner's "Who sees what" rail in `src/components/dna/ProfileSurface.tsx` (around line 713) labels
its stance row `profile.member.stance_label ?? TITLES.stance`, where `TITLES.stance` is the literal
`"Stance"`. Two readings are open. As a section name it is navigation, the row lists every section
by its name and 397 fixed that name as Stance, so a literal is what 999 permits. As a stance label
it is the same shape 194 just removed from the title, one rail over, reading the saved
`stance_label` rather than the vocabulary and a literal when that is null. The row shows the saved
label when a stance is set and the word Stance only for an owner with no stance, so the literal
never stands in for a failed vocabulary read the way the title's did. Whether the row should read
the vocabulary and render empty like the title, or is a section name and stays, is a ruling to ask
for rather than a fix to make; no test asserts either behaviour today.

## G64. The stance section renders an empty `h2` when the vocabulary fails

**Severity: low. Opened 22 September 2026 during handoff 30-C, filed under ruling 597. The number
is assigned by this entry (ruling 638). Not fixed here: the handoff names it as a register entry,
and the stance section is Brief 3's surface, one handoff over.**

Handoff 30-B (#56) made the stance section's title read `public.member_stances` through
`vocabularies()` under ruling 194 and render no text when that read fails: the title is
`stanceLabel ?? ""` in `src/components/dna/ProfileSurface.tsx`. The heading element stays in the
tree with nothing in it, so a failed vocabulary read leaves an empty `h2` on the profile, which
accessibility checkers flag as an empty heading and a screen reader announces as a heading with
no name. The fix is to render no heading element at all when the label is absent, and to assert
that in `tests/vocabulary.cjs`'s failed pass beside the existing check that no literal stands in.

## G65. Guest emails have no stated lawful basis, and the Terms and Privacy Policy are not in this tree

**Severity: invite-boundary gate. Opened 22 September 2026 during handoff 30-D, filed under ruling 597. The number is assigned by this entry (ruling 638). Prototype posture (ruling 140): the
canonical project holds no real member data, so this blocks no merge and closes before the first
real member invite.**

Ruling 532 requires the lawful basis for holding a guest's email address to be stated in the Terms
and the Privacy Policy, and puts guest emails under ruling 479's erasure work. Neither document is
in this tree, so nothing here can cite them and no surface links to the paragraph that would
govern the address a guest types on `/e/{slug}`. The address is held in `event_registrations`
`guest_email` on a going or not-going row, and as a hash only in `guest_link_requests` for a day.
What closes this: the two documents, the paragraph in each, and the erasure path under 479 that
removes a guest's rows on request.

## G66. Nothing sends a reminder to anyone, so the guest line holds the reminder out

**Severity: low. Opened 22 September 2026 during handoff 30-D, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

B10-SPEC section 4's Guest sheet reads `One email address, so the door and the reminder can reach
you.` The door reaches the guest: the going confirmation carries it (1035). The reminder does not
exist. Ruling 571 names reminders and nothing in this tree sends one to a guest or a member; there
is no scheduler, no reminder text and no row that says one was sent. Under grounded-or-empty the
field line in `src/components/dna/GuestSheet.tsx` reads `One email address, so the door can reach
you. Nothing else is asked.` until something sends a reminder, and the SPEC's line returns with it.
What closes this: a scheduled send (a Supabase cron or a dispatch-only workflow), its text through
`_shared/mail.ts`, and a record of the send.

## G67. Brief 11 is titled "Convene Pass 4", and ruling 622's fourth pass is pay and admit, which has no brief

**Severity: low. Opened 22 September 2026 during handoff 30-D, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

Two things carry the name. Brief 11 is titled "Convene Pass 4". Ruling 622's fourth pass of
Convene is pay and admit: paid events, tickets and the door for them, which is the work this
handoff holds out of the guest path (`This event takes tickets, and tickets are not open yet.`)
and which has no brief. A reader who follows "Pass 4" from the guest path's refusal lands on a
brief about something else. What closes this: a ruling that retitles one of the two, and the
brief for pay and admit when it is written.

## G68. A link request is recorded before its email is sent, so a failed send is throttled into a silent "Check your email" for ten minutes

**Severity: low. Opened 22 September 2026 during handoff 30-D, filed under ruling 597. The number
is assigned by this entry (ruling 638). Not fixed here: the throttle is `20260922120000`'s and an
applied migration is never amended (466).**

`public.guest_link_request` inserts the `guest_link_requests` row and answers `send: true` before
the guest-rsvp Edge Function has asked Resend for anything. When Resend refuses, the function
answers 502 and the sheet shows the failure under the field, which is right; but the row is already
recorded, so the guest's retry inside ten minutes is answered `send: false` and the function says
202, which the sheet renders as `Check your email` for a mail that never left. What closes this: a
new migration that records the ask only once the send succeeded (a second function the Edge
Function calls after Resend answers), or that lets the function delete its own row on a failed
send, with `tests/live-db.cjs`'s guest arm extended to the failure case.

## G69. The canonical project carried Handoff 31-A's schema before its migrations reached `main`, and the types regeneration returned it

**Severity: low. Opened 22 September 2026 during handoff 30-D item 7, filed under ruling 597. The
number is assigned by this entry (ruling 638). Amended the same day: first written as unrecorded
schema, which was true at the regeneration and not an hour later. Amended 23 September 2026:
#59 merged `main` into Handoff 31-A's branch and regenerated `src/lib/database.types.ts` on the
merged head, and that file now carries these objects, recorded under `20260922150000
p2_discovery_schema` and `20260922150100 p2_discovery_projection`, which are in the tree with it.
The catalog-comparing drift arm below stays open.**

The types regeneration taken after `20260922120000` was applied returned, beside the migration's
five additions, objects that exist on the project and nowhere in `supabase/migrations` on this
branch: the tables `convene_families`, `convene_lenses`, `convene_picks`, `discovery_dismissals`,
`editors` and `member_subscriptions`; the functions `convene_discovery`, `dismiss_discovery_item`
and `set_subscription`; and the column `events.family` with a foreign key to `convene_families`.
At the regeneration `tests/migration-drift.cjs` read PASS, so no `schema_migrations` row named
them; by the enforcing run on `3805792` the same arm read FAIL for `20260922150000
p2_discovery_schema` and `20260922150100 p2_discovery_projection`, recorded on the project with no
file in this tree. They are Handoff 31-A's (#59), applied by Chat ahead of that PR's merge: the
regeneration landed inside the moment between the objects' creation and their rows' recording,
and this branch then sat in G58's second half. They are left out of `src/lib/database.types.ts`
(its header says so), because a type here is a licence for a surface to reach what this tree does
not define; #59's own regeneration carries them. What remains open: a drift arm that compares the
project's catalog against the tree and not only its `schema_migrations` rows, so an object that
reaches the project ahead of its row reads as drift rather than passing unseen for however long
the recording takes.

## G70. `live_arms` may mint a guest row on any published event, until the guest arms sit behind a fixture policy

**Severity: low, invite-boundary gate. Opened 22 September 2026 during handoff 30-D, filed under
ruling 597 from the finding `20260922160000_r382_live_arms_guest_functions.sql` names in its own
header. The number is assigned by this entry (ruling 638). Prototype posture (ruling 140): the
canonical project holds no real member data, so this blocks no merge.**

`20260922160000` grants `live_arms` execute on `public.guest_link_request(text, text)` and
`public.guest_rsvp(uuid, text, text)`, exactly the two signatures and nothing wider, so the two
live-db guest arms can run instead of reading UNPROVEN (228). Both functions are SECURITY DEFINER
and gate on the event's public page and on the throttle, not on the caller, so a holder of
`LIVE_DB_URL`, CI's one secret for this role (382), may write a guest row on any published event
whose post is to everyone. The arms roll their rows back inside their own transaction. What closes
this: before the first real member invite, a fixture policy that admits the two ruling 218 test
accounts' events and no other, the shape the attestations arms already take under ruling 435, with
the grant narrowed to run through it.

## G71. The Home facet's rungs are not drawn and not built — closed (ruling 1110)

**Severity: medium, invite-boundary gate (ruling 140). Opened 22 September 2026 during handoff 31-A,
filed under ruling 597. The number is assigned by this entry (ruling 638).**

The Home facet's rungs (rulings 927, 928) are not drawn in Brief 9's prototype and not built; the
facet ships one option per home under 1042. `public.convene_discovery`'s `p_home` narrows to
in-person and hybrid events whose physical delivery city matches the chosen home's city, and
nothing wider. Owed: a Design correction drawing the rungs on FacetRail's home axis, and the
projection's rung predicate against `member_homes.region` and the event's place, in a new migration.

**Amended 24 September 2026 by handoff 32-A.** Strand drew the rungs (correction 24 §4, 1060,
ratified 1085) and 32-A ports them as FacetRail's `ladders`. What stays owed is the projection's rung
predicate and Discovery passing the ladders, which is 32-B's.

**Closed 24 September 2026 by handoff 32-B (Addendum 1, ruling 1110).** `20260924120000` gives
`convene_discovery` its `p_home_rung` parameter and the Home filter's rung branches (in, around, the
stored region, the country), and Discovery draws one ladder per home in the member's order, "In
{city}", "Around {city}", the region only where one is stored, the country and "Anywhere", which sends
neither `p_home` nor `p_home_rung`. No distance is shown. The `discovery-facets` arms read each rung on
a two-home fixture.

## G72. FacetRail has no control on its own Browse line, so ruling 944's collapse control is not rendered — closed (ruling 944)

**Severity: low. Opened 23 September 2026 during handoff 31-B item 4, filed under ruling 597 and
reported under 732 rather than worked around at the page. The number is assigned by this entry
(ruling 638).**

Ruling 944 puts an icon control with the accessible name `Collapse browse` and no visible word on the
rail's `Browse` line, collapsing the rail to its 64 icon strip while the lanes take the width. Strand's
`FacetRail` (`src/components/strand/FacetRail.tsx`, compile `v1789885868097915`) renders its
expanded heading as a bare `h2` with no action slot, so there is nowhere on that line for a caller's
control; placing one over the heading from Discovery is the page-level workaround 732 forbids. The
shell's `lanes` mode already carries the collapsed width (`rail: "collapsed"`, the 64 column), which
the pane uses under 688, so the control lands as one prop once Strand gives the heading a slot. The
extraction's own note also stands: the icon set had no collapse glyph at the time; `panel-left-close`
is in `public/strand/icons/` now. Owed: a Strand correction adding an action to FacetRail's heading.

**Amended 24 September 2026 by handoff 32-A.** Correction 24 §1 gave the heading its slot and 32-A
ports it as `headingAction`. Open until Discovery passes 944's control, which is 32-B's.

**Closed 24 September 2026 by handoff 32-B item 7.** Discovery passes `panel-left-close` with the
accessible name `Collapse browse` and no visible word as the rail's `headingAction`; it collapses the
rail to its 64 strip and writes the member's row for the band (1111). The mount arms read it on the
heading.

## G73. DiaLine's text is a string, so the first section's sentence cannot link the host's name

**Severity: low. Opened 23 September 2026 during handoff 31-B item 7, filed under ruling 597 and
reported under 732. The number is assigned by this entry (ruling 638).**

Ruling 1046 has `{name}` in `You follow no host yet. {name} hosts {title} in {city}; follow them and
their events start here.` link to `/m/{handle}`. Strand's `DiaLine` takes `text?: string` and renders
it in a plain span, so the sentence renders in full as words with the name unlinked. Owed: a Strand
correction letting DiaLine carry a link, after which Discovery passes it.

**Closed 23 September 2026 by handoff 31-D's PR, under ruling 1053.** 1053 rules the sentence plain
text: the host's name is not linked, so DiaLine's string is the whole answer and no Strand correction
is owed. `DiscoverySurface` already rendered it that way; the comment names 1053 and the below density
arm now asserts that the sentence carries no link.

## G74. On Discovery a card's React and Save render and do nothing — closed (rulings 1096, 1097)

**Severity: medium. Opened 23 September 2026 during handoff 31-B item 3, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Handoff 31-B's surface reads only through `loadDiscovery` and writes only through
`dismissDiscoveryItem`, and the card is Pass 1's at rest byte for byte (660), so the card's four
actions render. Share needs no write and is wired; `Ask the host` and the card's own tap open the
event page. React and Save have no write path on this surface and are inert. Owed: a ruling on
whether Discovery takes the Feed's two existence toggles (`setSaved`, `setReacted` and the `loadMarks`
read beside them) as a second write path, or the card at rest on Discovery hides them.

**Closed 24 September 2026 by handoff 32-B items 4 to 6.** The card is PostCard's discovery face,
which carries no React (1096). Save is the menu's Save or Saved, written through the Feed's own
`setSaved` and read through its `loadMarks` inside `loadDiscovery`, so it is the one existing path and
not a second (item 6).

## G75. A FacetRail option never wraps, and the longest category family is wider than the medium rail

**Severity: low. Opened 23 September 2026 during handoff 31-B item 4, filed under ruling 597 and
reported under 732. The number is assigned by this entry (ruling 638).**

SPEC section 0 sets the medium rail at 240. FacetRail's option chips are `white-space: nowrap`, and
the vocabulary's `Cultural, heritage and religious` chip is wider than the 198 the nav's padding
leaves at that width, so it runs into the nav's right padding (measured at 820: the nav's content
reaches 258 against its 240 box). It stays inside the column, so nothing pans. At expanded's 260 it
fits. The prototype drew stand-in family labels (Revision 1, conflict 3), which is why its frames
never showed it. Owed: a Strand correction letting an option wrap, or a Design ruling on the rail's
width.

**Closed 24 September 2026 by handoff 32-A.** Correction 24 §2 lets an option wrap, and the port
carries it with no prop because 844 gives the compile the chip's padding and no app ruling kept
`nowrap`. The mount arms read it on `/convene` at 390, 820 and 1280: no chip reaches past the content
box it wraps in (the nav, and at 390 the Sheet's scrolling body), whose `scrollWidth` equals its
`clientWidth`. A one-line chip is now 39.75 rather
than 36 (G87 item 1).

## G76. FacetRail has no per-axis single select, so When and Home toggle rather than choose — closed (ruling 1085)

**Severity: low. Opened 23 September 2026 during handoff 31-B item 9, filed under ruling 597 and
reported under 732. The number is assigned by this entry (ruling 638).**

Handoff 31-B makes When and Home single-select inside a multi-select rail. FacetRail's `single` mode
is one selection across the whole rail, so the two axes render as the rail's toggle buttons
(`aria-pressed`) and Discovery keeps only the newest choice in each when it writes the query. The
behaviour is single-select; the semantics a screen reader hears are a toggle group rather than a
radio group. Owed: a Strand correction for a per-axis `select="single"`.

**Amended 24 September 2026 by handoff 32-A.** Correction 24 §3's per-axis `select` is ported;
without it every axis stays a toggle group, so Discovery is unchanged. Open until Discovery declares
When and Home single, which is 32-B's.

**Closed 24 September 2026 by handoff 32-B item 2.** Format, Price and When are single segments led by
Any (radiogroups), and Home is a single ladders axis, so each chooses rather than toggles and a screen
reader hears a radio group.

## G77. Below expanded the event page's Back row names Feed when the member came from Discovery

**Severity: low. Opened 23 September 2026 during handoff 31-B item 12, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

B9-SPEC section 0 draws the compact route with `the Back row naming Discovery`. Handoff 31-B item 12
keeps `/convene/events/{id}` below expanded as 1023's own page, unchanged, and gives `EventSurface`
one prop only (the pane's), so the Back row still reads `Feed` and returns to the Feed whatever the
member came from. Owed: a ruling on the Back row's origin below expanded, and then the route state
that carries it.

**Closed 23 September 2026 by `d0c1f52`, handoff 31-D, under ruling 1065.** Discovery sets an origin
record in router history state when it opens an event (`src/lib/origin.ts`), and the page's Back row
reads it: its label is the origin's, and it goes back when the member arrived from that origin in this
history, else navigates to the origin's route and search. With no origin, a cold arrival or a document
load, the row names Discovery and goes to `/convene`, because the page lives under Discovery's route
(1047). The not-found state's button follows the same rule and reads `Back to {label}`.

## G78. The Pane's close control floats over the top of its content

**Severity: low. Opened 23 September 2026 during handoff 31-B item 12, filed under ruling 597 and
reported under 732. The number is assigned by this entry (ruling 638).**

Strand's `Pane` places its `closeLabel` control absolutely at the pane's top right with no space
reserved for it (700). Brief 10's page starts with its invitation notice when the member has one, and
at 1280 the close control sits over that notice's top right corner. Nothing is unreachable. Owed: a
Strand correction reserving the close control's row, or a Design call on the page's first block
inside a pane.

**Closed 23 September 2026 by handoff 31-D's PR, on the page and not in Strand's Pane.** With
`inPane`, `EventSurface` raises its top padding to `calc(var(--space-2) + var(--target-primary) +
var(--space-2))`, the close control's inset, its height and the same gap again, so the page's first
block starts below the control. `Pane.tsx` is unchanged (732, 950). The Discovery pane arm measures
the first block's top against the control's bottom at every expanded width. Design brief 31-E yields
to this fix; if Strand later gives the Pane a reserved close row, the page's padding comes out with
that port.

Amended 25 September 2026 by handoff 33-A (1134). Correction 28 gives the Pane that row. With a tool
handler passed, which Discovery always passes, the toolbar and the cluster share a bar above the pane
body. The page's reserved padding would now be an empty band under the bar, so it comes out with this
port, as this entry said it would, and the page keeps its own `16px` top. The pane arm still reads
the first block below the close control.

**Amended 26 September 2026 by handoff 33-A Addendum 2 (1143).** Correction 28's pane body is
unpadded and the page's frame pads no sides, so at 520 the invitation notice, the title, the body
and the cover all ran to the pane's border. The addendum reads the pane before #67 as padding its
body with `--space-6`; the tree at `d23c55f` does not: that Pane's `--space-6` is its own Loading
line's padding, and Discovery's `data-pane-body` wrapper was unpadded, so the page's sides were
zero then too, hidden at 1440 and wider only by `--content-max` centring the page in a wider pane.
`Pane.tsx` stays unchanged (844) and the page carries the inset, only with `inPane`: the frame
pads `--space-5` on both sides and drops its `--content-max` cap, since the pane (520, or 720 with
the list hidden) is the bound, so every state, loading, error, not found and cancelled included,
sits inside it. The cover alone runs back out to the pane body's edges, squared and without side
borders: the pane's rounded corners hold the toolbar row above the body, so the cover meets only
straight edges. The top and bottom stay as the previous amendment left them, and the standalone
page is unchanged. The width arm reads the cover on the body's content box and the kicker, the
title and the date row `--space-5` inside it, with the list shown and hidden, at all five widths.

## G79. At expanded the lanes lose their horizontal position when the pane opens and closes

**Severity: low. Opened 23 September 2026 during handoff 31-D item 6, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

`DiscoverySurface` returns a different element tree with the pane open (the lanes inside Strand's
`Pane` as its list) from the one it returns with the pane closed (the lanes in the surface's own
column). React rebuilds the lanes on each switch, so every lane's horizontal scroll resets to its
first card when the pane opens and again when it closes. The column keeps its place, because the
shell's layout key is the lens and does not change (688), and the lens and the facets survive (1063).
Below expanded nothing is rebuilt in place: the event page is its own route and Back restores the
column and each lane through the router's element restoration (1065). Owed: Strand's Pane open state
under 1064 (Design brief 31-E), which gives the list one place in the tree whether the pane is open or
not.

**Amended 24 September 2026 by handoff 32-A.** Correction 24 §6's `open` is ported: one grid whose
list column is the same element open or closed. Open until DiscoverySurface renders one Pane with
`open` rather than two trees, which is 32-B's.

**Amended 24 September 2026 by handoff 32-B.** Not taken: handoff 32-B's twelve items and three
addenda do not name it, and its scope is the brief (CLAUDE.md). Discovery still returns one tree with
the pane open and another with it closed, so the lanes' horizontal position still resets on each
switch. Owed as before, in a brief that names it.

## G80. place-resolve's ordering arm reads Mapbox's live answer, so an empty side fails it

**Severity: low. Opened 23 September 2026 during handoff 31-D, on run 319 (35850287842), filed under
ruling 597. The number is assigned by this entry (ruling 638).**

`tests/live-checks.cjs` proves 633 by asking `place-resolve` for `Front Room` in the United States
with two proximities, Portland and Los Angeles, and passing when the first suggestions differ. It
skips only when both calls answer `none`. On run 319 Portland answered a place and Los Angeles
answered with no first suggestion, so the arm failed with `los angeles` empty, on a head whose diff
touches neither the function nor the arm; `main`'s run 318 on `1463b5c` passed the same check. The
arm is asserting on Mapbox Search Box's live answer for one name near one city, which is not the
function's behaviour to own. Owed: the arm reads an empty side as unproven with its reason (228),
the way it already reads two `none` answers, or proves 633 on a query whose answers are stable.

## G81. The notification Respond arm reads the read mark before the write can land

**Severity: low. Opened 23 September 2026 during handoff 31-D, on a local Chromium run of `8bf1bbd`,
filed under ruling 597. The number is assigned by this entry (ruling 638).**

`NotificationPanel`'s `onRow` navigates to the destination first and then awaits `markRead`, so the
`read_at` write goes out after the URL has changed. `tests/event.cjs`'s `notification: Respond opens
the event page and marks the row read` records `db.reads.includes("n-role")` as soon as
`waitForURL` resolves, so it passes or fails on which of the two lands first: it failed once at 390
dark and passed at 390 light and both 1280 arms of the same run, and in every arm of the run before
it. Neither file is touched by 31-D. Owed: the arm waits for the write (as the Feed's own mark-read
arm does for its dot) before it reads, or the panel marks read before it navigates.

## G82. The LensBar's scope line: the app's two visual contracts disagree on its size, and neither agrees with the port on both numbers

**Severity: low. Opened 24 September 2026 during handoff 32-A's reconciliation (862), filed under
ruling 597 as the one port-against-compile disagreement the port record could not decide under 844.
The number is assigned by this entry (ruling 638).**

The compile (`v1790212533284400`, byte-identical here to correction 21's) draws the descriptor at 13
italic under the wrapper's 6px gap. `src/components/strand/LensBar.tsx` draws it at 15 italic with
12 of top padding inside the collapsing box, which is ruling 405's mechanism and is kept. 844 gives
the compile a size and a padding unless an app ruling keeps the port, and the app's two ruling-62
contracts split: `docs/shell/LENS_BAR_SPEC.md` line 42 says "sans italic 15 ... 12 below it", and
`docs/shell/SPEC.md` line 79 says both "Descriptor sans italic 12 below the track" and "Scope line: 13
italic". The size therefore has the compile and SPEC.md for 13 against LENS_BAR_SPEC alone for 15;
the spacing has both specs for 12 against the compile's 6. 32-A keeps the port (15 and 12) because
correction 25 does not carry the descriptor and porting it would change Feed's, Connect's and
Discovery's descriptors with no prop passed. Recommendation, for Chat to rule: 13 (the compile and
SPEC.md), kept 12 below (both specs, and 405's collapse needs the spacing inside the box). The track
and seat radii (the port's `--radius-m` and `--radius-badge` against the compile's 999) are the same
kind of line with no numbered ruling behind them, but a radius is not a size, a padding, a track or a
floor, so 844 does not reach them; they are listed in the port record. G53's "every frame the code
produces is the one the compile governs" is not true of these lines.

**Closed 24 September 2026 by handoff 32-A, under 844 with no new ruling.** Chat decided it as
recommended: the scope line takes the compile's 13 italic, and the spacing stays 12 below the track
inside ruling 405's collapsing box, which both app contracts give. `LensBar.tsx` draws 13, and
`docs/shell/LENS_BAR_SPEC.md` line 42 now says 13, citing this entry.

## G83. Strand's Input puts a textarea on a line box: every multiline field grows 7.5px under the wrappers correction 25 draws

**Severity: low, and a Strand defect rather than the app's. Opened 24 September 2026 during handoff
32-A under Chat's ruling on 25 §5, filed under ruling 597. The number is assigned by this entry (ruling
638).**

Correction 25 §5 nests every Input's field in `div{position:relative; display:flex; column}` then
`div{position:relative}`, on every call. The inner wrapper is a block container, so a `textarea` in it
is inline-level and sits on the line's baseline, and the strut's descent opens a gap under it.
Measured in Chromium on this app's callers at 390 and 1280, 48 Strand Input fields across sign-in,
reset, welcome, where, the guest sheet, ConveneForm, the composer's link, IntroSheet and the profile
editor: every single-line field held its box, and every textarea's line and everything below it moved
7.5px (IntroSheet's line 548.7 to 556.2 at 390). Neither the compile's `tokens/base.css` nor its
`styles.css` nor this app's preflight gives a textarea block display. Under Chat's ruling the port
keeps 92fbdc3's structure for every call that is neither the combobox (`suggestions` on a
single-line field) nor passes `icon`, marked divergent in `docs/strand-ports/v1790212533284400.md`;
after that change the same 48 fields measured identical to 92fbdc3. Owed by Strand: `display: block` on the field, or `display: flex` on the inner
wrapper; then the port drops its gate. Also for the same correction brief: with `multiline` and
`icon` together the glyph renders but the padding stays `10px 14px`, so the glyph sits on the text.

## G84. The app carries none of the compile's reduced-motion block, so every Strand motion runs for a member who asked for none

**Severity: medium for accessibility (ruling 608). Opened 24 September 2026 during handoff 32-A,
filed under ruling 597. The number is assigned by this entry (ruling 638).**

The compile's `tokens/base.css` lines 9 to 12 zero the `--dur-*` tokens and set
`animation-duration` and `transition-duration` to 0 with `!important` on every element under
`prefers-reduced-motion`. `src/styles/strand.css` has no such block; the only reduced-motion rule is
the Sheet backdrop's, and LensBar reads `matchMedia` inline without subscribing. So under reduced
motion the Pane's entrance still runs (its own prompt promises it does not, 608) and so do, from this
PR, the Pane section's fade, PostCard's selected-ring transition, Menu's item background and Select's
border. 29-A's token comparison read `:root` and dark only, which is why nothing caught it. Not ported
here: handoff 32-A item 3 moves no token but `--z-menu`. Owed: a ruling on carrying base.css's block
into strand.css.

## G85. Pane scrolls its list column, and in this shell the list column is not a scroller — closed (1134)

**Severity: low today, medium once 32-B binds `selectedKey`. Opened 24 September 2026 during handoff
32-A, filed under ruling 597. The number is assigned by this entry (ruling 638).**

`bringIntoView` in `src/components/strand/Pane.tsx` adds to the list column's own `scrollTop`, which is
the compile's 607 routine and now 1083's `selectedKey` follow as well. Under ruling 104 the shell owns
one scroller per tier and the column does not scroll (its only style is `min-width: 0`); the centre
`[data-scroller="feed"]` does. So 607's cold-arrival scroll to `[data-arrived]` has been a no-op since
31-B bound the Pane, and 1083's list follow will be one too. Owed before 32-B relies on either: Pane
scrolls the nearest scrolling ancestor, or Strand gives the list column its own scroller, which is a
Design question under 104.

**Amended 24 September 2026 by handoff 32-B item 7.** Discovery binds `selectedKey` and Previous and
Next, and the list follow is inert as this entry says. So the surface brings the open card into view
in its own lane (`scrollIntoView` with `nearest` on both axes, keyed on the lane and the event), which
moves the centre column and the lane's row, the two scrollers this shell has. The workaround is the
page's, and it goes when Pane follows the nearest scrolling ancestor.

**Closed 25 September 2026 by handoff 33-A (1134).** Correction 28's `height` bounds the Pane's grid,
and the list column becomes a scroller of its own: `overflow-y: auto`, with its overscroll contained.
Discovery passes `height` with the pane open (G110), so `bringIntoView` now moves the column the
list is in, and 1083's `selectedKey` follow acts vertically. The feed column no longer scrolls
under the pane. The surface's `scrollIntoView` with `nearest` stays, for the lane's row, the one
axis the Pane does not reach.

The width arm reads the list column as a scroller at all five expanded widths: `overflow-y: auto`,
holding more than it shows. The step arm holds the surface's `scrollIntoView` still, scrolls the list
column to its end, steps Next twice, and requires the list column scrolled with the open card inside
its box. So it reads Pane's own follow alone. Both reads fail at `d23c55f`, where the list column is
not a scroller. The change is `174a55e`'s `height`, which Discovery passes.

## G86. A Sheet inside the Pane closes the Pane with it on Escape, because the app's modal Sheet never prevents the keydown — closed (handoff 38-B)

**Severity: low. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Ruling 1084 amends 719 so that a dialog inside the pane that consumes Escape closes itself and not the
pane, and the Pane honours it: it returns on `defaultPrevented` (this port already did, as correction
21's bundle did). But this repository's `Sheet` calls `preventDefault` on an Escape keydown only when
`contained`; a modal Sheet lets the native dialog consume Escape through its `cancel` event and the
keydown still bubbles through the React tree to the Pane's section, which closes. EventSurface opens
RsvpSheet inside the Pane at expanded, so Escape there closes both, at 92fbdc3 and after this PR alike.
The contained path fails the other way: the Sheet handles Escape there in a window listener in the
capture phase, which closes it before any child's handler runs and ignores `defaultPrevented`. So
neither a Menu (G88) nor correction 25's combobox, whose Escape "closes the list ... so a Pane or Sheet
guard does not also close", can keep the key inside FacetRail's compact Sheet once a page binds them.
Owed: the Sheet prevents the Escape keydown it consumes on the modal path and yields to a prevented one
on the contained path, which is the Sheet's change and not the Pane's.

**Closed 30 September 2026, in handoff 38-B (1251), by the commit that changes `Sheet.tsx`.** The macOS
WebKit gate (1235) found the modal half again on its first run and it is G193 on PR #81's branch, which
records this close on its rebase. Both halves are one change: Escape is handled in the dialog's own React
`onKeyDown`, on both paths, which runs after every handler inside the sheet and before every ancestor.
The keydown is marked with `preventDefault`, so the Pane's guard (1084) yields; a keydown a descendant
already marked, Input's open list or a Menu, is yielded to, which is what the contained path's capture
listener could not do; and where two sheets nest the inner one runs first, so only the topmost handles
it. The capture-phase listener keeps the Tab trap and, for `contained` only, closes on an Escape whose
target is outside the dialog, since a contained dialog is not modal and raises no `cancel`; the
dialog's `cancel` listener stays for a close request that is not a keydown inside the dialog. Proven
by four checks added to the event-flows arm (`tests/event.cjs`), red on `d4742b8` and green with the
guard, on the runs handoff 38-B's PR names. The lines in `Input.tsx` and `Menu.tsx` that describe the contained
Sheet closing "in a capture listener before this runs (G86)" describe the mechanism this closes and are
left as written; they are a comment follow-up, not a behaviour.

## G87. Correction 25's compile, read against its own extractions and against this app: what Strand's next correction brief should carry

**Severity: low. Items 1, 2, 11 and the second half of 8 are reached at this PR's head, all by
Discovery's FacetRail on `/convene`: the 39.75 chip, the 1px pin, a set chip's 1.5px border, and the
heritage chip on two lines in the 240 medium rail. The rest, and item 8's heading action, are
reached by no caller. Opened 24 September 2026 during handoff 32-A's reconciliation (862),
filed under ruling 597. The number is assigned by this entry (ruling 638).**

1. Extraction 24 §2 says `minHeight: 36` still holds a one-line chip. It does not: `var(--space-2)`
   padding and `var(--text-s-lh)` make a one-line chip 39.75 (measured). The bundle governs and is
   ported.
2. Extraction 25 §3 says the heading pin's net geometry is unchanged at rest. Its transparent 1px
   bottom border is not cancelled by the margins, so the axes sit 1px lower (68.5 to 69.5). Ported.
3. Extraction 25 §3 says a ladders axis renders as a radiogroup. The code makes it a radiogroup only
   when the axis also declares `select: "single"`.
4. Extraction 23 §1 and its doctrine flag 3 say Escape did not honour `defaultPrevented` before. It
   did, in correction 21's bundle (line 2257) and in this port.
5. Pane's closed state leaves the section's two 1px borders past the 0 track (a 1200 grid scrolls to
   1202), and the close shows no fade, because the body and the cluster unmount in the same commit that
   snaps the track; only that sliver fades.
6. Pane's arrow keys carry no modifier or repeat guard: Alt+ArrowLeft, which is Back in Chrome and
   Firefox on Windows and Linux, is prevented and becomes a step, and a held arrow steps once per repeat.
7. Input's combobox names its listbox from `label`; FacetRail's combobox display passes
   `aria-labelledby` to the field and no label, so its listbox has no accessible name. And LensBar's
   trailing seat, when at least as wide as the wrapper, reads as no measurement and after twenty retries
   keeps its previous verdict instead of going icon-first.
8. Extraction 24 §1 says the label stays where it was with a heading action. The row is 44 with an 8px
   pull-back, so the axes move 8.5; and 24 §2's "three lines at 240" is two with this app's Alegreya
   Sans, and none at the 260 expanded rail (1082's 280 is not in this tree).
9. FacetRail's `scrolled` state survives the swap between `collapsed` and `facets` on one instance, so
   a rail that was scrolled comes back at the top still carrying the hairline and `data-scrolled`.
10. On a single axis whose two ladders share one "Anywhere" id, choosing it checks two radios and makes
    two tab stops in one radiogroup; a parked first option leaves a single axis with no tab stop; a
    chosen combobox id that is not among the options renders as its raw id.
11. Unmeasured, for WebKit: a set chip has a 1.5px border and an unset one 1px. Chromium floors 1.5 to 1
    and both chips are 39.75; WebKit at DPR 2 keeps 1.5, so setting a chip would move every row under it
    1px, which the old `min-height: 36` absorbed.
12. Menu prevents only ArrowUp, ArrowDown, Home, End and Escape. Inside a stepping Pane, ArrowLeft and
    ArrowRight bubble through the portal to the Pane's keydown, which steps to another item while the
    menu is still open.
13. Menu's item draws focus only as its hot ground, with `all: unset` and `outline: none`; in dark
    theme `--bg-sunken` on `--surface` is about 1.03:1 and the inset `--line` about 1.3:1, so keyboard
    focus on an item is close to invisible (G49's class).
14. A question rather than a defect: Menu's items are 36 on pointer. Ruling 498 is a standalone-target
    rule (44) against an in-row one (24), not a touch and pointer split, and this compile's own combobox
    options hold 44 in every mode. 25 §2 accepted 36; Chat may want to confirm it against 498.
15. Input's combobox: the no-match line alone sets no `box-sizing`, so it is 60 tall in Strand's own
    stylesheet and 44 under this app's reset; the active option survives a blur, so a reopened list
    can choose an option the member never moved to; the active option is never scrolled into view in
    the 264 list; Enter chooses under a modifier and on an IME commit; `aria-controls` names a listbox
    that exists only while expanded; and the ArrowDown that opens the list skips the caller's own
    `onKeyDown`. Its `.d.ts` also leaves out `id`, the handlers and `aria-labelledby`, which the
    compiled part reads.
16. A portal Menu that mounts with `open` already true, as a child of the element its `anchorRef`
    names, is not placed until something scrolls (the listener is a capture listener on the window,
    so any scroller counts) or the window resizes, and then it is placed and its first item takes
    focus. React attaches a parent's ref after its children's layout effects run, so the first
    `place()` finds no anchor and returns, `pos` stays null and the menu stays `visibility: hidden`.
    That holds in the compile's Menu on any device, and in the port whenever its mode does not change
    after mount: a fine pointer with no `input`, or any device when `input` is passed. On a coarse
    pointer with no `input` the port differs: its placing effect runs again when `useMode()` answers
    `touch`, by which time the ref is attached, so it is placed and focused where the compile's stays
    hidden. `portal={false}` is not affected: CSS
    places it and its first item is focused on mount. Menu's header in the compile documents no such
    constraint. Nothing opens a Menu on mount at this head.

## G88. A Menu opened from inside a modal Sheet renders under the Sheet's top layer and cannot be used

**Severity: medium once a caller does it; no caller does at this PR's head. Opened 24 September 2026
during handoff 32-A, filed under ruling 597. The number is assigned by this entry (ruling 638).**

Correction 25 §2 portals Menu into `document.body` at `--z-menu` 62, "so a menu clears the sheet it
opens from" (1103). In this repository the Sheet is a native modal `<dialog>` (ruling 499), which sits
in the top layer above every z-index and makes the rest of the document inert. A portal Menu opened from
a control inside a non-contained Sheet therefore renders beneath it and takes no input. Owed before any
Sheet hosts a Menu: the Menu renders inside the dialog there (`portal={false}` or a portal target inside
the dialog), or a ruling on the Sheet's modality. The compile's own Sheet opens with `showModal()` when
it is not contained too, so this is 1103's claim failing in Strand as well, not only here. And a
contained Sheet is no way out for Escape: this Sheet handles Escape in a window capture listener that
runs before Menu's own handler and ignores `defaultPrevented`, so one Escape closes the menu and the
sheet together.

## G89. Profile's Visitor overflow is a second menu beside Strand's Menu

**Severity: low. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/components/dna/ProfileBlockControl.tsx` draws its own menu for the block control (Brief 4A,
ruling 216), with `role="menuitem"` items read by `tests/block.cjs` and `tests/profile.cjs`. With Menu
ported there are now two menus in the tree. Owed: moving the overflow onto Menu in a brief that names
it, carrying the `data-testid`s those arms read; at pointer its item height would go from 44 to Menu's 36.
The file's own header names ruling 221 as giving Strand this Menu and says that when Menu ships its panel
is what gets swapped for it, and that Menu "has not landed". Menu lands in this PR, so that sentence is
now stale; handoff 32-A item 6 keeps `src/components/dna` untouched, so the swap and the comment are both
for the brief that binds Menu.

## G90. A both-engine `matrix.yml` dispatch no longer fits its 60-minute job

**Severity: low; the PR path is unaffected. Opened 24 September 2026 during handoff 32-A, filed under
ruling 597. The number is assigned by this entry (ruling 638).**

`matrix.yml`'s `matrix` job has `timeout-minutes: 60` and, with the `engine` input empty, runs both
engines in one process (`WEBKIT: "1"`). `pages.yml` run 321 on `92fbdc3` took 39m52s for Chromium's
matrix step and 43m27s for WebKit's, about 83 minutes together, and this PR's mount arms add about two
and a half minutes per engine locally. A dispatch with no engine is cancelled before WebKit finishes.
Owed: split the dispatch per engine as `pages.yml` does, or say in the input's description that an
empty engine no longer fits.

## G91. ConnectSurface imports Input and renders none

**Severity: trivial. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

`src/components/dna/ConnectSurface.tsx` imports `Input` at line 30 and never renders it; `/connect`'s
Input is IntroSheet's. Handoff 32-A's route table read the import as a binding. Owed: drop the import
in a change that touches the surface.

## G92. The shell's own layers hardcode their z-index, so 603's order does not hold against Menu

**Severity: low. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/styles/strand.css` says of the 603 scale that no component hardcodes a z-index, and 1103 places
`--z-menu` 62 below dialog and notification. In the tree, `AppShell.tsx` draws its account popover and
panel at 50 and their click-catchers at 40, `NotificationPanel.tsx`'s click-catcher is at 40,
`FeedSurface.tsx:66` holds a fixed layer at 70, and `ProfileBlockControl.tsx:49` at 20, among smaller
local ones. So a Menu at 62 would sit above the account and notification layers at 50, which 1103
says it must not. Low in practice: Menu's outside press closes it before the bell or the account
control opens. Owed: those layers read the 603 tokens (`--z-notification`, `--z-scrim`, `--z-sticky`)
in a change that touches the shell.

## G93. PasswordField draws Input's hint and error line and does not tie it to the field

**Severity: low. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Correction 25 §5 ties Input's hint or error line to its field by `aria-describedby`, and 24 §5 gives
Select the same. `src/components/strand/PasswordField.tsx` copies Input's line (13 on 1.4, error in
place of the hint) but gives the line no id and the field no `aria-describedby`, so on the sign-in,
reset and change-password forms the email field's line is announced with the field and the password
field's is not. Owed: the same tie in PasswordField, in a change that names it.

## G94. The Feed's Read more prefetch starts on a touch tap, and its timer outlives the card

**Severity: low. Opened 24 September 2026 during handoff 32-A's verification pass, filed under ruling 597. The number is assigned by this entry (ruling 638). Found in code, not measured on a device.**

`src/components/strand/PostCard.tsx` fires `onReadMoreIntent` after an 80ms `mouseenter` hold on Read
more, and its comment says never on touch (ruling 84). A tap delivers a compatibility `mouseenter`
before its click, so the hold starts on touch as well, and nothing clears the timer when the card
unmounts, so it can fire after the tap's click has already navigated. At `92fbdc3` and after this PR
alike. Owed: the hold starts only for a pointer whose type is mouse, and the timer is cleared on
unmount.

## G95. On WebKit a document load issued while a post is open in place is interrupted by a navigation back to that post

**Severity: low, unread. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

`pages.yml` run 329 (job `107762099627`, head `de65851`) failed `mount-post` at all three WebKit cells
with the same error: `page.goto: Navigation to ".../posts/seed-1" is interrupted by another navigation
to ".../posts/seed-0"`. The arm had opened `/posts/seed-0` in place from the Feed's Read more,
under ruling 105, and then issued a document load of `/posts/seed-1` without closing it. Chromium
passes the same sequence, locally and in CI. The cause is not read: Read more stops propagation and
calls `openPost` once, and its hover-intent timer only prefetches a query (`warmPost`), so neither
accounts for a second navigation. Locally there is no WebKit to read it in. The arm now closes the post with
Show less and waits for `/feed` before its direct load, which is the sequence the Feed suite's own
direct-load check has always used and which WebKit passes. Owed: read it in WebKit. If a member who
follows a link or types an address while a post is open in place is sent back to that post, it is a
defect in the in-place route, not in the harness.

## G96. The event page's toast is blanked by the timer of the toast before it — closed (handoff 35-A)

**Severity: low. Opened 24 September 2026 during handoff 32-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`EventSurface`'s `say()` sets the toast and starts a 2,600ms `setTimeout(() => setToast(null))`, and
never clears the timer before it, where `ConnectSurface` and `ProfileSurface` keep the timer in a
ref and clear it. So a toast raised less than 2.6s after the last one is removed when the older
timer fires, however recently it appeared. The event flow's withdraw hits it: timed with a
`requestAnimationFrame` probe in Chromium at 1280, twelve runs on each build, the going toast shows
at about 2,300ms and its timer fires at about 4,900, and the Withdrawn toast lands between 4,720 and
5,100, on both sides of that moment, at `92fbdc3` and at this PR's head alike. When it lands just
before it, it is gone a few milliseconds later, and `tests/event.cjs` waited 8s for a toast that had
already come and gone: one of three isolated runs at 1280 dark, and the local full run at 1280 light.
The arm now waits the going toast out before withdrawing, and the Withdrawn toast is still required.
Owed, in a brief that may touch `EventSurface`: `say()` clears its previous timer, as the other two
surfaces do. This PR changes no page (handoff 32-A item 6).

**Closed 28 September 2026, in handoff 35-A item 3, by `888fc00`.** `say()` keeps its timer in a ref
and clears the one before it, and the component clears it on unmount, as `ConnectSurface` does.
`tests/event.cjs`'s arm that waits out the going toast is unchanged.

Found in the same run and closed by this PR: `pages.yml` run 332 failed "notification: Respond opens
the event page and marks the row read" at chromium 1280 dark because the check read the mock's reads
on the tick the URL changed, while `NotificationPanel`'s `onRow` navigates first and marks the row
read after. The check now waits for the read, bounded at 5s.

## G97. Discovery's Format, Price and When words are arrays in the component

**Severity: low. Opened 24 September 2026 by handoff 32-B item 11, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

`src/components/dna/DiscoverySurface.tsx` keeps `FORMAT_OPTIONS` (In person, Online, Hybrid),
`PRICE_OPTIONS` (Free, Paid) and `WHEN_OPTIONS` (Next two weeks, This month, Later) as arrays with
their words in code. The ids are the projection's own structural values (its `p_format`, `p_price`
and `p_when` branches), but the words a member reads are labels, and no vocabulary table serves them.
Handoff 32-B edits Price's array (the third option is gone under 1095). Read against the tree rather
than the handoff (555), it also adds two of the same shape: `PLACE_KIND` (City, Region, Country for
`convene_places()`'s `kind`) and `whereFor`'s format words (In person, Online, Hybrid), a second copy
of `FORMAT_OPTIONS`'s words for the card's where line. Owed: a ruling on whether these are content
vocabularies under the fixed-vocabularies absolute or structural like the Feed's lens set (999); if
the former, a table served by `vocabularies()`, which `whereFor` reads too.

## G98. The composed OpenGraph image for a public event page is not built

**Severity: low. Opened 24 September 2026 by handoff 32-B (Held 4, ruling 1113), filed under ruling 597. The number is assigned by this entry (ruling 638).**

`/e/{slug}` keeps the link-preview tags it has. The composed image ruling 1100 describes (the cover,
the title, one line and the wordmark at 1.91:1) is its own handoff after 32-B under 1113, and nothing
in this PR draws or serves it.

## G99. The Hub's alias editor is not built

**Severity: low. Opened 24 September 2026 by handoff 32-B (Held 5), filed under ruling 597. The number
is assigned by this entry (ruling 638).**

`20260924110000` gives every event a `custom_slug` and a `short_code`, keeps the alias history in
`event_aliases`, and ships `public.event_alias_check(event, alias)`, which answers the Hub's live
preview with a status word. The editor that calls it is Brief 8 Revision 4's draw and is not built
without an approved prototype (ruling 62). Until it is, a host cannot change an alias from the app;
the database's own trigger writes the first one.

## G100. A Discovery card opens through a button, not a link (B9-SPEC line 26) — closed (1134)

**Severity: medium. Opened 24 September 2026 during handoff 32-B item 4, filed under ruling 597 and
reported under 732 rather than worked around at the page. The number is assigned by this entry
(ruling 638).**

Ruling 1067 says cards open through real links that preload on hover intent at expanded, and
B9-SPEC line 26 says of the card "The whole face is the link". PostCard's
discovery face (correction 25 §1, ported by 32-A) opens through `onOpen`: its title is a `button`
and the whole face is a click target, and it takes no `href`. So a Discovery card cannot be opened in
a new tab, copied as a link or middle-clicked, and a keyboard or screen-reader member meets a button
where 1067 promises a link. Hover intent still preloads the event route and its read at expanded
through `onPreload`. It is the part's, not the page's: Chat ruled on 25 September 2026 that
`onOpen` is a part defect and the part is not edited here. Owed: a Strand correction giving the
discovery face an `href` it renders as the anchor across the whole face, which Discovery then
passes as the member event path.

**Closed 25 September 2026 by handoff 33-A (1134).** Correction 28 gives the discovery face `href`.
The title renders as an anchor, and a cover inside it spans the face. The ellipsis, presenter and
topic stand above the cover. A plain primary click calls `onOpen` and prevents the default; a
modified or middle click is the browser's. Discovery passes the address `openEvent` navigates to,
`/convene/events/{id}` with the lens's facets, so a new tab, a copied link and a middle click open
the page a plain click shows. The plain click still opens the pane at expanded and the route below it.

## G101. The menu has no second line for Not this, so "Fewer like this in your lanes" is a toast

**Severity: low. Opened 24 September 2026 during handoff 32-B item 5, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Handoff 32-B item 5 gives Not this the line "Fewer like this in your lanes". Strand's `Menu` items
carry an id, a label, an icon, a tone and an action, with no description, and correction 25's drawing
shows Not this alone. Discovery says the sentence as the toast that confirms the dismissal, which is a
reading and not a drawing. Owed: a ruling that the toast is the place, or a Menu correction for an
item's second line.

## G102. Topics cannot render in two columns at 150 and up (B9-SPEC line 20) — closed (1134)

**Severity: low. Opened 24 September 2026 during handoff 32-B item 2, filed under ruling 597 and
reported under 732. The number is assigned by this entry (ruling 638).**

Item 2 and B9-SPEC line 20 ask for the Topics checklist in two columns at 150 and up. FacetRail's `checklist` display is
one flex column of 44 rows (correction 25 §3), the compile draws one column, and 32-B changes no part,
so Topics renders in one column at every width, as Chat ruled it stays on 25 September 2026. Owed: a Strand correction for a checklist's columns,
with the width the second column begins at.

**Closed 25 September 2026 by handoff 33-A (1134).** Correction 28 item 4 lets a checklist axis set
`columns: 2`. The part lays its rows in a grid whose tracks are never narrower than half of 150 less
the gap, so the second column begins at a checklist of exactly 150. With `--border-thin` at 1px here,
that is a 192 rail, where the extraction read 192.4 in a browser whose edge measured 1.2. Discovery
sets it on Topics. The medium rail's 240 gives a checklist of 198 and the expanded rail's 280 gives
238, so both show two columns. The compact Sheet shares the body and shows two as well, as the
compile does.

**Amended 26 September 2026 by handoff 33-A Addendum 2 (1144).** Two columns wrapped the labels in
the rail: at 1280 and 1440 the 238 checklist's tracks were 115 and four of the nine rows ran to three
lines (65.3 tall), and at 820 the 198 checklist's were 95 and four ran to four lines (87), so the rows
read as running into each other. B9-SPEC Revision 5's Filters line makes Topics one column in the
FacetRail and keeps two only in the compact Filters Sheet. Strand's `columns` stays as built (844):
Discovery's one axes list carries no `columns` on Topics, and the Sheet's FacetRail takes that list
with `columns: 2` set on Topics alone, so no axis is listed twice. The facets arm's G102 check is
changed in place and its count is unchanged: in the rail at 820, 1280 and 1440 it reads one column,
from the checklist's computed layout and its rows' lefts, and each row's bottom at or above the next
row's top; in the Sheet at 390 it reads two columns, the checklist 350 wide and its tracks 171.
On `f19af1f` it fails at the three rail cells, a grid of two tracks with each odd row beside the next.
The width the second column begins at, above, now governs the Sheet alone.

## G103. Format is a single segment, so format=online,hybrid shows as Online

**Severity: low. Opened 24 September 2026 during handoff 32-B items 1 to 3, filed under ruling 597.
The number is assigned by this entry (ruling 638).**

Join from anywhere's See all and the retired `/convene/online` both land on `format=online,hybrid`,
which the projection reads as two formats. Format is a single-select segment led by Any (item 2), so
the rail can show one choice: it checks Online while Hybrid is applied too, and picking any other
seat replaces both. The narrowing is right; what the rail shows under it is not the whole of it. Owed:
a ruling on whether Format is multi-select (chips) or the segment gains an "Online or hybrid" seat.

## G104. The Convene lens bar in the header slot is icon-first at compact (B9-SPEC lines 11 and 13)

**Severity: low. Opened 24 September 2026 during handoff 32-B item 7, filed under ruling 597, and
rewritten on 25 September 2026 when B9-SPEC reached the tree. The number is assigned by this entry
(ruling 638).**

B9-SPEC line 11 puts the lens bar at compact as icon and word "in a row that scrolls sideways (root
`width:max-content`)", moving into the header after 72px of scroll. The in-content bar now does that:
Discovery passes `labels="always"`, `icons`, `width="content"` and a `max-content` root, and its
anchor scrolls sideways, so every seat keeps its word whole and the page does not pan (the first
reading, icon-first by the part's fit test, is reverted on Chat's instruction). What remains is the
header slot: `AppHeader` renders the registered bar `compact`, which forces icon-first, so once the
member scrolls past 72 the words go. And B9-SPEC line 13 centres the expanded lens row "with the
scope line", where LensBar draws its scope line from the start of the track. Both are the parts'.
Owed: a Strand correction for AppHeader's slot to carry labels, and for LensBar's scope alignment.

**Amended 26 September 2026 by handoff 33-A Addendum 2 (1145).** At medium and expanded the bar is
now `width="content"` and centred in the shell's lens row, `[data-layout-top]`, by its caller alone:
Discovery gives LensBar's root `width: min-content`, which is the track's own width because no seat
wraps, and inline margins of `auto`. The scope line is the root's own, so it now starts 4 inside the
centred track's start edge rather than the row's, and wraps to the track's width rather than widening
the root past it. Its alignment within the track is still the part's, as above. The compact bar and
the header slot are unchanged.

## G105. Place's kind word is matched as the member types

**Severity: low. Opened 24 September 2026 during handoff 32-B item 2, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Item 2 labels each Place option by its kind. The option's label is the place's name, so the kind
rides in its `detail` ("City, Ghana", "Region, Ghana", "Country"), and FacetRail's combobox matches
by prefix on each word of the label and of the detail (correction 25 §3). So typing "c" offers every
city and every country, and "re" every region, before the member has typed a place. Owed: a ruling on
whether the kind word is matched, or a combobox option field that is shown and not searched.

## G106. On WebKit the guest sheet's Send me a link stayed disabled for 30 seconds

**Severity: low, unread. Opened 24 September 2026 while reading G5's runs for handoff 32-B Addendum 3
item F, filed under ruling 597. The number is assigned by this entry (ruling 638).**

`matrix.yml` run 59 (id `36063982157`, job `107849293819`, head `59974b2`, `ENGINE=webkit`,
`SPECIAL=event`, `ONLY=[390,844]`) failed `webkit-390x844-light-guest` with `locator.click: Timeout
30000ms exceeded` on the I am going sheet's `[data-testid="guest-send"]`, which resolved to a disabled
button for the whole wait; the arm emitted 6 of 21, no core was written and nothing classified it as
G5. The nine dispatches around it passed the same arm on the same deployment. The cause is not read:
`GuestSheet` disables the button while the field is empty or a request is in flight, so either the
field did not take the fill or a request did not settle. Owed: read it in WebKit.

## G107. B9-SPEC is cited and is not in the tree, so parts of Discovery were built with no drawing — closed (Chat, 25 September 2026)

**Severity: low. Opened 24 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Handoff 32-B names `B9-SPEC.md` in Project knowledge as the spec; the tree holds no copy, and the
only drawing of the page in it is correction 25's proof fixture inside
`docs/strand/v1790279130697923/_ds_bundle.js`, relayed from B9 Revisions 6 and 8. Built from the
handoff's words with no drawing: See all (its placement against the lane's heading and its style),
"While you are in {city}", Place's placeholder and kind words, When's four options, the menu's Saved,
Following and Subscribed words, the rail's memory, and the region rung's absence. Where the fixture
and the handoff differ (the fixture's When options, its Place placeholder, its expanded rail at 280
where the shell draws 260), the handoff was built. Owed: the spec in the tree, and a design read of
the undrawn items on the deployed preview.

**Closed 25 September 2026.** Chat attached B9-SPEC and ruled that it governs Discovery's layout; it
is committed byte for byte as `docs/convene/B9-SPEC.md`. The surface is reconciled to it where the
parts allow, each delta is listed with its disposition in #64's body, and what a part cannot do
carries its own number (G100, G102, G104, G110 to G114).

## G108. Three client wrappers call set_follow

**Severity: low. Opened 24 September 2026 during handoff 32-B item 6, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

`set_follow` is the one write path, and three client functions call it: `setFollowing` in
`src/lib/connect.ts` (Connect, and Discovery's menu under item 6), `setFollow` in
`src/lib/event-page.ts` (the event page) and `setFollow` in `src/lib/profile.ts` (Profile). They
differ only in how they report an error. Not a second write path in the database, but the shape the
one-write-path absolute exists to prevent, one layer up. Owed: one wrapper, imported by all three.

## G109. FacetRail's compact Sheet carries no z-index, so positioned content after its host paints over it

**Severity: medium. Opened 24 September 2026 during handoff 32-B item 7, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

At compact FacetRail opens its axes in the repository's Sheet with `contained`, which renders the
dialog `position: absolute` with `z-index: auto` inside whatever element hosts the rail. Anything
positioned after the host in the same stacking context paints over it. Handoff 32-B's cards are
PostCard's discovery face, which is `position: relative`, so at 390 the lanes drew over the open
Browse Sheet from its Format row down, and a press on a Home rung landed on a card (read on the local
build: `elementFromPoint` inside the Sheet answered the card at 30 and 60 percent of its height).
Discovery lifts the row that hosts the rail with `z-index: var(--z-sheet)`, a flex item's stacking
context, which does not move the Sheet's containing block; the compact `discovery-facets` arm presses
every Home rung through the Sheet.
Owed: the contained Sheet takes `--z-sheet` itself (603), so a caller cannot reintroduce this by
placing positioned content after it. Correction brief material with G30.

## G110. Pane cannot take B9-SPEC's pane: the tracks, the height, the toolbar and Hide list (line 14) — closed (1134)

**Severity: medium. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

B9-SPEC line 14 gives the open pane the grid `minmax(0,1fr) 520px` (the list takes the rest, the pane
is 520), a height of the frame less the header less 88, and a toolbar of Hide or show the list, Copy
link and Share, where Hide list sets `0 minmax(0,720px)` centred. Strand's `Pane` (correction 24 §6,
ported by 32-A) draws `--pane-list-width` (360) for the list and the pane in the rest, takes no height,
and has no toolbar or hidden-list state. Discovery binds what it has: the cluster (Previous event, Next
event, Back to Discovery), the edges `aria-disabled` in place, the arrows while focus is in the pane,
the rail at its strip, and the header row moved into the list column. Owed: a Strand correction for
the pane's tracks, the toolbar and the hidden list.

Amended 25 September 2026 by #66 (handoff 32-B, Addenda 4 and 5). The height is now carried by the
page, as G78's padding is: Discovery gives the pane body the list column's height, less the pane's
sticky offset and the column's foot, and a scroller of its own, so the pane's cluster stays in view
and Previous and Next start each event at its top (Addendum 4 item 4). The tracks are still Strand's,
and 1123 widens what they divide: with the canvas at 5% gutters and no maximum, the list keeps 360 and
the pane takes the rest, measured on the local build at 680 at 1280, 824 at 1440, 1256 at 1920 and
1832 at 2560, with the event page inside it held to `--content-max`. Addendum 5 describes the pane as
keeping its 520; it has not been 520 on any build, which is this gap, so the arm proves what 1123
asks of it (the list column holding a full 320 card, the pane inside the new edges) and the width is
left to the Strand correction. Owed as before: the tracks, the toolbar and the hidden list.

**Closed 25 September 2026 by handoff 33-A (1134).** Strand correction 28 gives `Pane` `paneWidth`,
`height`, the toolbar handlers and `listHidden` (`docs/strand-ports/v1790366257373061.md`), and
Discovery binds them with the pane open at expanded. It passes `paneWidth` 520, the three handlers
(Hide or show the list, Copy link and Share, the latter two through `useShare` with the open event's
post, 1097), and `listHidden`, which lasts while the pane is open. The list takes the rest of the width.
Measured on the local build: pane 520 and list 520, 664, 808, 1096 and 1672 at 1280, 1440, 1600, 1920
and 2560. At 1280, 1440, 1920 and 2560 these equal the compile's readings; the compile read no 1600. Hide list reads the pane at 720, centred, with the list
hidden and inert. The page's own `data-pane-body` wrapper and its measured height are gone; the part's
body is the scroller.

The height is not the spec's literal value. B9-SPEC Revision 2's pane line writes it as the frame less
the header less 88. In this shell the lens row, with its scope line, is 122.2 tall: 24 above an 82.2 bar
and 16 below. The 88 allows for 64 of row and foot. At 1280x800 the feed column below the lens row is
613.8 with a 24 foot, leaving 589.8. The literal 648 is 58.2 more than that, so the column scrolled
beneath the pane. Discovery passes
`height` 100% of a wrapper that fills the column. The wrapper's top is the collapsed FacetRail
strip's sticky inset of 16, so rail, list and pane start level, as the pane line asks. That makes the
pane the frame less the header, the lens row, that 16 and the canvas's 24 foot: 573.8 at 1280x800.
The column's `scrollHeight` equals its `clientHeight` at every expanded width, so the list and the
pane body scroll apart and nothing else does. Reported under 555, and carried as G121.

Because the column cannot scroll while the pane is open, its offset clamps to 0. Ruling 688 keeps
the lanes where the member left them. So Discovery keeps the card at the list column's top, with its
distance from that top. When the pane closes, it scrolls the feed column to put the same card at the
same distance (`355db02`). A raw offset would not carry over: a lens list's cards are
`min(680px, 100%)`, shorter in the 520 list column than in the full one.

Measured on the local build at 1280 and 1920:

- rail, list and pane all start at 202.2;
- a card opened from the last lane, at a column offset of 3868 at 1280, closes back to 3868 with the
  card in view.

The width arm reads the level tops and the feed column still; the step arm reads 688 after Back to
Discovery.

## G111. FacetRail's Clear all sits after the axes, not in the pinned heading row (line 20) — closed (1134)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

B9-SPEC line 20 pins the Filters heading row with the title, Clear all when any facet is set, and the
collapse control in the G72 slot, and scrolls the axes beneath. The ported `FacetRail` pins the title
and the collapse control and renders Clear all in a status line after the last axis, so at medium and
expanded it scrolls away with the axes. At compact Discovery shows Clear all beside the applied chips
(line 11). Owed: a Strand correction moving Clear all into the heading row.

**Closed 25 September 2026 by handoff 33-A (1134).** Correction 28 item 5 adds
`clearPlacement="heading"`, and Discovery passes it on the rail. Clear all sits in the pinned heading
row, between the title and the collapse control, inside a polite status slot. It shows only while a
facet is set. There is no foot line in the rail form. The compact Sheet keeps Clear all at its foot
whatever the prop says, as compiled; G109 is not in this pass.

The heading row pins only inside a rail that scrolls. The rail is its own scroller only when its
caller bounds its height through `style` (25 §3), and Discovery had never bounded it. The rail grew to
its content (1238 tall at 1280x800), the shell's left column scrolled instead, and the heading, with
Clear all in it, scrolled away with the axes. That was the same at `d23c55f`. The outcome cannot hold
without the bound, so Discovery now passes the rail `maxHeight: calc(100% - var(--space-4))`: its
column's height less the sticky inset it rests at.

Measured on the local build:

- the rail scrolls itself (690 at 1280x800, 511 at 820x1180, 410 at 1920x1080);
- the left column does not scroll;
- Clear all sits 17 below the rail's top, where the extraction read 17.2, and a press there lands on
  it.

## G112. The homes row is words, not a button to the profile's homes (line 11)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

B9-SPEC line 11 makes the homes row at compact a button to the profile's homes (633). Profile has no
homes section or editor yet: `src/lib/homes.ts` reads `member_homes` and says it is empty until
Profile's editor lands, and nothing on `/m/{handle}` shows or edits a home. A button with no
destination would be a dead control, so the row stays the homes in words beside the Filters trigger.
Owed: the button, once Profile's homes land.

## G113. The ported discovery face and Menu differ from B9-SPEC's card geometry (lines 26 and 27) — closed (1134)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Read from the parts as 32-A ported them (`PostCard.tsx`'s discovery face, `Menu.tsx`) against B9-SPEC
lines 26 and 27. Matching: 320 wide, the 1.5 frame, radius 14, padding 16, media 16:9 with the C badge
at 48, the title at 22/1.25 clamped to two lines at 55, the ellipsis at 44 touch and 36 pointer, the
selected ring, the hover underline, Menu's radius 10 and `--shadow-3`. Differing: the face's gap is 12
where the spec has 8; the presenter row is 44 on touch and 32 on a pointer where it has 36; the reason
row holds two lines of `--text-xs` (36.4) with no rule above it where it has 28 behind a rule; Menu's
minimum width is 220 where it has 240; Menu portals to `document.body`, which is this app's root. All
are the parts', and 32-B changes no part. Owed: Strand reconciles the correction 25 face and Menu with
B9-SPEC, or the spec is read as the compile's.

**Closed 25 September 2026 by handoff 33-A (1134).** Correction 28 item 6 takes the face and the
Menu to the spec, and the ports carry it:

- The face's gap is 8.
- The presenter row is 36 on a pointer and 44 on touch. That is 498's floor for a row of two
  controls, which the extraction reports and 1134 accepts.
- The reason row is one line in a 28 row behind a 1px `--line` rule, cut with an ellipsis.
- Menu's minimum width is 240.

No app override of any of these existed to remove. Discovery passes the face no gap, row or
width beyond the lens list's 680. PostCard, Menu's only renderer, passes it no `style`. No stylesheet
targets either part. Menu still portals to `document.body`, which is this app's frame root. G89's
second menu, Profile's Visitor overflow, is not Strand's Menu and is outside this entry.

## G114. Lanes do not animate in (line 33)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

B9-SPEC line 33 has a lane appear with an 8px translate and a fade on `--dur-default` and `--ease`. It
is not built: 32-B's items name no motion, the app carries none of the compile's reduced-motion block
(G84), and an entrance transform under the arms' geometry reads would need its own settle. Owed: the
lane entrance, with G84's reduced-motion answer, in a brief that names it.

## G115. The discovery face clamps its title on a `<button>`, which WebKit does not clamp (1087) — closed (1134)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`matrix (webkit)` run 347 (`pages.yml` id `36075579873`, job `107886270269`, head `76af944`) failed
Discovery's "the title clamps to two lines and holds two lines' height (1087)" at all 22 WebKit cells,
and Chromium passed it at all 22: the long fixture title's `h3` measured 137.5, five lines of 27.5,
with `-webkit-line-clamp` computed 2 and nothing clipped. `PostCard.tsx`'s discovery face sets the clamp
(`display: -webkit-box`, `-webkit-line-clamp: 2`, `-webkit-box-orient: vertical`, `overflow: hidden`)
on the title's `<button>`, and WebKit lays a button out as its own flex box whatever its `display`
says, so the clamp never applies there. A lane's long titles run to full length and its cards lose
B9-SPEC line 26's one fixed height; Safari shares that button layout, though no Safari device was read.

32-B changes no part, and the face types `title` as a node, so `DiscoverySurface` passes its title
inside a span carrying the same four declarations. The arm now lifts every two-line clamp in the title
for one synchronous read and puts it back, and asserts the long title runs past two lines without them
and holds 55 with them, wherever the clamp sits. The cost is the face's own: with a node title it names
its Menu `More` where the compile names it `More:` and the title, because only a string is appended.
The ellipsis control keeps `More`. Owed: Strand carries the clamp on a node inside the button; the
surface then passes a string again, its span goes, and the Menu's name has the title back.

Chat accepted the Menu's name as tracked on 25 September 2026, after `7d52411`'s run 348; the fix goes
to Strand in correction 28, after this PR merges.

**Amended 25 September 2026 by handoff 33-A (1134).** Correction 28 puts the two-line clamp on a
`span` (`data-title-clamp`) inside the face's link or button, so no engine clamps a button. The h3
still holds 55. Discovery's own span and its four declarations are gone, and it passes the title as a
string again. With `href`, the ellipsis is named "More: {title}" and the Menu keeps "More: {title}".
Read on WebKit in run 358 (`matrix (webkit)` job `108255195171`, head `d417dbf`: 6828 of 6828).
At every Discovery cell, the long title's clamp holds two lines at 55 and is the part's span inside
the face's link, and the ellipsis reads "More: {title}". That reading is evidence for `d417dbf` only
(894). `355db02`, `8186a74` and `5080ce8` change Discovery's scroll and ring code after it, so this
entry stays open until the enforcing run for the final head reads the clamp on both engines (556).

**Closed 26 September 2026 on run 367 (handoff 33-A Addendum 1 item 4, 1134).**

- Run 367 is `pages.yml` id `36216830840`, on head `af43dfd`, the final head.
- It passed on both engines: `matrix (webkit)` job `108334523577` read 6834 of 6834, and
  `matrix (chromium)` job `108334523523` read 6834 of 6834. Each had none behind a web-process
  crash (G5) and none unclassified.
- At all 22 Discovery cells on each engine, it read the long title's clamp holding two lines at 55,
  as the part's span inside the face's link, and the ellipsis reading "More: {title}".
- The run on this closure's own commit, which changes only this register, is the enforcing run
  (556), in the order Chat approved.

## G116. MediaBlock's ratioed image runs past its frame's edge on WebKit (1077, 1115) — closed (1134)

**Severity: low. Opened 25 September 2026 during handoff 32-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

The same run failed Addendum 3 item E's "Feed Convene card, one image: the frame 16:9, the image
filling it inside the edge (1077, 1115)" at 390, 820 and 1280 on WebKit. The frame measured 16:9; the
image measured 322x182, 580x327 and 724x408, the frame's full border-box height, 2px past the inside of
its 1px edge and clipped by its `overflow: hidden`. Compile `v1790279130697923` sizes the ratioed image
`width: 100%; height: 100%` in flow inside a border-box frame whose height comes from `aspect-ratio`,
and WebKit resolves that `height: 100%` against the frame's border box rather than its content box.
The ratioed galleries, whose tiles sit in declared `minmax(0,1fr)` grid rows, passed at the same widths
in the same run.

The port lays the one image out in one such cell, `minmax(0,1fr)` each way with `minHeight: 0` on the
image: on Chromium the boxes are the compile's own, and on WebKit the cell is the mechanism the
galleries passed on. It is recorded as a kept divergence in section 2 of
`docs/strand-ports/v1790279130697923.md`, and nothing geometric is kept against the compile. The
ratioed video frame carries the same mechanism (the poster in flow at `height: 100%`) and is not
changed: nothing renders video (ruling 55) and no arm reads it. Owed: Strand takes the one-cell frame
into the compile, the video frame with it, so the next re-sync does not reopen the divergence.

Chat accepted the divergence as tracked on 25 September 2026, after `7d52411`'s run 348; the change goes
to Strand in correction 28, after this PR merges.

Amended 25 September 2026 by handoff 33-A (1134). Correction 28 item 7 takes the one-cell frame into
the compile. The frame declares `display: grid` and `minmax(0,1fr)` by `minmax(0,1fr)`, and the image
takes `minHeight: 0`. Those are the port's declarations in property, value and order, so
`MediaBlock.tsx` changes only its comments. The divergence becomes the compile's own form, and
`docs/strand-ports/v1790366257373061.md` records it as present. Handoff 33-A said the app's grid-cell
layout "goes"; in the tree there was nothing to take away, because the compile adopted it (555).

Two things this entry said are now contradicted or unmet:

- **Chromium.** The extraction's item 7 read the former in-flow form overrunning its bottom edge in
  Chrome too, by 2.3 to 2.4px. That contradicts this entry's "on Chromium the boxes are the
  compile's own", which rested on run 347's arm passing on Chromium. The arm's tolerance or the
  readout browser's 1.2 edge may account for the difference; it is not read here.
- **Video.** The compile took the image and not the video frame. The ratioed video's poster is still
  in flow at `height: 100%`, so the video half this entry owed is not in `v1790366257373061` and is
  carried as G119.

The compile was measured in Chrome only. Under 1134 this entry closes only on a green
`matrix (webkit)` arm reading the image inside its frame at 390, 820 and 1280.

**Amended 25 September 2026 by handoff 33-A (1134), with what run 358 read.**

- The run: `pages.yml` id `36190688999`, head `d417dbf`, `matrix (webkit)` job `108255195171`.
- It read 6828 of 6828 checks, with none behind a web-process crash (G5) and none unclassified.
- That includes Addendum 3 item E's mount-media arms at `webkit-390x844-light`,
  `webkit-820x1180-dark` and `webkit-1280x800-light`. Each reads the Feed Convene card's one image
  at 16:9, filling its frame inside the edge.
- That reading is evidence for `d417dbf` only (894). `355db02`, `8186a74` and `5080ce8` change
  Discovery's scroll and ring code after it. `MediaBlock.tsx` has not changed since `fb4ce12`, whose
  change to it was comments only, but the run that closes this entry is the enforcing run for the
  final head (556). Until
  its `matrix (webkit)` job reads the same three cells, this entry stays open.
- The video half is G119.

**Closed 26 September 2026 on run 367 (handoff 33-A Addendum 1 item 4, 1134).**

- Run 367's `matrix (webkit)` job `108334523577`, on head `af43dfd`, read 6834 of 6834, with none
  behind a web-process crash (G5) and none unclassified.
- It ran Addendum 3 item E's mount-media arm at `webkit-390x844-light`, `webkit-820x1180-dark` and
  `webkit-1280x800-light`. At each, it read the Feed Convene card's one image at 16:9, filling its
  frame inside the edge.
- The video half stays open as G119.
- The run on this closure's own commit is the enforcing run (556).

## G117. Run 350 passed the live Place check's "Near reads the place" with nothing to read — closed (1095)

**Severity: low. Opened and closed 25 September 2026, after handoff 32-B merged as #64 on Chat's 1114
read, filed under ruling 597. The number is assigned by this entry (ruling 638).**

`tests/live-db.cjs`'s check "convene_places() answers grounded places by kind; a city narrows and Near
reads the place; a malformed place is refused" passed on #64's enforcing run 350 (`pages.yml` id
`36086569219`, head `48703c1`) without its Near clause ever reading a lane. The clause read Near only
when the city's narrowing returned it, and held true otherwise. The narrowing returned no lanes at
all, `narrowed []`: the fixture published one Accra event, and `20260924100000_p2_discovery_lanes`
sets Near's floor in `private.convene_thresholds` to 2, so the lane stayed under its floor and the
clause held on an empty premise. Under ruling 228 a clause that did not run is not a pass, and the
1114 comment on #64 said so rather than let the green be read as coverage.

Closed by this change. The fixture publishes a second Accra event under the same savepoint, so the
city's Near lane meets its floor of 2 (lanes rank per section, so the two events also sit in Fresh
without leaving Near). The check narrows on the fixture's own `city|ghana|accra` rather than whichever
city sorts first, and requires the Near lane present with every item's reason naming Accra, so a floor
raised above the fixture's two events now fails the check by name instead of passing it. The proof is
the `live` job on this change's head.

## G118. B9-SPEC line 23 still names See all on This weekend and Join from anywhere — closed (1132)

**Severity: low. Opened 25 September 2026 during #66 (handoff 32-B, Addendum 4 item 2), filed under
ruling 597. The number is assigned by this entry (ruling 638).**

B9-SPEC line 23 reads "See all (soon, weekend, online apply the matching facet; relationship lanes
switch lens)". Ruling 1112 took See all off This weekend, as #64 built it, and ruling 1122 takes it off
Join from anywhere, as this change builds it, so Happening soon is the one lane whose See all applies a
facet and the four relationship lanes switch lens. Line 13 is amended in this change because Addendum
5 asks for it; neither addendum names line 23, so it stays as Chat wrote it. Owed: line 23 restated
to 1112 and 1122.

**Closed 25 September 2026 by handoff 33-A item 4.** B9-SPEC Revision 2 (1132) replaces
`docs/convene/B9-SPEC.md` byte for byte. Its Lanes section says See all once: "Happening soon applies
`when`; relationship lanes switch lens; This weekend (1112), Join from anywhere (1122), Browse and
Filling up carry none." Nothing in the page changes: the surface already built 1112 and 1122.

## G119. MediaBlock's ratioed video frame keeps the in-flow height that ran past the edge on WebKit

**Severity: low. Opened 25 September 2026 during handoff 33-A item 2, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

G116 owed the one-cell frame for the ratioed image and the ratioed video. Strand correction 28
(`v1790366257373061`) took the image and not the video. The video frame is still
`aspect-ratio: {ratio || 16/9}` on a border-box frame with its poster in flow at `height: 100%`: the
mechanism WebKit resolved against the border box for the image in run 347. Nothing renders video
(ruling 55), and no arm reads it, so nothing on a page shows it today. Owed: the video frame's poster
in the same declared grid cell, in a Strand correction, before any surface renders video.

**Amended 26 September 2026 by handoff 33-D (correction 30 Part B, ratified with correction 31 under
1153).** Correction 30 lays the ratioed video's poster in the one declared grid cell, `minmax(0,1fr)`
by `minmax(0,1fr)` with `minHeight: 0`, with play and duration absolute over it. The unratioed video
is byte-identical to before. `MediaBlock.tsx` carries it as compiled, so the mechanism this entry
named is gone from the part.

It stays open because it is unread, not because it is untrue. The handoff owed a `matrix (webkit)`
reading of the poster inside its frame at 390, 820 and 1280, and no deployed page renders a video to
read. Ruling 55 keeps video out of the composer, `PostCardRouter.tsx` maps a post's media to `image`
or `gallery` only, and neither `BodyBlocks`, whose video block goes through this frame, nor anything
else in the tree renders `kind="video"`. No arm was written, because an arm on a page that cannot
show the frame would pass or fail on nothing (930). This entry closes on the first WebKit arm that
reads a ratioed video on a page: `BodyBlocks`' video block, once the first Discovery handoff or
Brief 10 Revision 4 binds it, is the likely first.

## G120. Discovery's Copy link and Share hand over the post's address, where the face links to the event's — closed (1140)

**Severity: low. Opened 25 September 2026 during handoff 33-A (G100, G110), filed under ruling 597.
The number is assigned by this entry (ruling 638).**

Discovery shares an event through two different addresses:

- The card menu's Share and Copy link (1097) and the pane's Copy link and Share go through the
  Feed's `useShare`, which hands over `/posts/{post id}`, the Feed's expanded card. Handoff 33-A
  names that path for the pane.
- The face's link (G100) is `/convene/events/{id}`, the member address B10-SPEC names and the tree
  routes. B9-SPEC Revision 2's Routes line names it by slug instead; that is G125. The event page's own Share hands over that address, or `/e/{slug}` when the event is
  public.

So a member who copies a card's link from the browser gets one address, and one who presses Copy
link gets another. Both open the event, but only one is the page. The open pane shows both at once:
its toolbar's Share hands over `/posts/{post id}`, and the event page's own Share row, inside the
same pane, hands over the event's address. Owed: a ruling on the address Discovery's share path
hands over, and one share path for the card, the pane and the page.

**Closed 26 September 2026 by handoff 33-A Addendum 1 item 2.** Ruling 1140 has Copy link and Share
on a Convene event, in Discovery's pane toolbar and the card menu, hand over the event's public
address under `/e/`, never `/posts/{post id}`. B9-SPEC states it in the toolbar and the menu, since
Revision 3. The event page's rule is now one function, `eventShareUrl` in `src/lib/event-page.ts`,
and the event page's Share row and Discovery's four controls all call it:

- The event facts come from the event page's own read, `event_page` under EventSurface's query
  key, never a second read and never a TypeScript derivation of `public` (1028).
- An event with a public page hands over `/e/{slug}` on this origin. One with none hands over the
  member address, `/convene/events/{id}`, which is what the event page's own Share hands over in
  the same case. A read that fails or answers nothing hands over the member address too, the one
  address that always opens the event, and one that has already failed hands it over inside the
  press.
- Both menu items and both toolbar controls are present for every event.
- A read already cached is used inside the press, because a share sheet and, on WebKit, a clipboard
  write need its activation. The pane's page is cached once the pane has loaded it. A card's is
  cached by hover intent at expanded (1067), or once the read its ellipsis's press starts has
  answered. A press made before then waits for that read's first answer, never for the retries
  EventSurface's query makes, and the harness stubs both APIs, so no arm reads activation. That is
  G131.

This closes the first of the two things the entry owed; the second, one share path for the card,
the pane and the page, stays open as G130. Discovery's four controls and the Feed's `share(id)` go
through `useShare`, with one toast and one fallback, and the Feed still hands over the post's
address. The event page's own sheet keeps its own copy and share: its share hands over
`{ title, url }` and shows nothing when the share is refused, where `useShare` hands over `{ url }`
and shows the address as its toast. So in the open pane the toolbar's Share and Share via in the
page's own sheet hand over one address in two payloads.

The width arm reads the pane's Copy link and Share at all five expanded widths, and the link arm
reads the card menu's at 390x844 and 1280x800, with one seeded event's page not public. Read in
Chromium, the width arm's check at 1280x800 and the link arm's two at both cells fail on `8d9dfd3`,
whose four controls hand over `/posts/{post id}`, and on `d23c55f`, whose menu hands over the same
and whose pane has no toolbar.

## G121. B9-SPEC Revision 2's pane height, frame less header less 88, overruns this shell's feed column — closed (1136)

**Severity: low. Opened 25 September 2026 during handoff 33-A (G110), filed under ruling 597. The
number is assigned by this entry (ruling 638).**

B9-SPEC Revision 2's pane line gives the open pane a height of the frame less the header less 88.
Measured on this shell at expanded:

- the header is 64;
- the lens row is 122.2: 24 above an 82.2 LensBar with its scope line, and 16 below;
- the feed column keeps a 24 foot.

The literal height (648 at 1280x800) is 58.2 more than the 589.8 the column gives below the lens
row, inside its 24 foot. The column scrolled beneath the pane, and the pane's foot sat below the
frame. Discovery gives the pane its column's own height
(573.8 at 1280x800, less the 16 that starts it level with the rail strip), and nothing but the
list and the pane body scrolls. G110's closing note has the
1280x800 reading. The width arm reads the pane's foot on the canvas's foot at all five expanded
widths. Owed: the spec's line restated to the shell's lens row, or a ruling
on the lens row's height.

**Closed 26 September 2026 by handoff 33-A Addendum 1 item 1.** Ruling 1136 gives the open pane the
feed column's own height less the 16 that starts it level with the rail, which is what Discovery
already does. B9-SPEC Revision 3 (sha256 `4bcc45c781d4fc38671a64b780c3e01785dbbb60fead72b629913b44a5558c7c`)
replaces the spec byte for byte and states that line. Revision 4 (sha256
`9949c0bbaf62c93fe25d3e1413155bc588a3bb82595ee579cda88d5fa02e6d96`), Chat's correction the same evening,
replaces Revision 3 and keeps that line. Read on this branch's build of `8d9dfd3` in
Chromium at 1280x800, 1440x900 and 1600x1000:

- the pane is 573.8, 673.8 and 773.8 tall, from 202.2, level with the rail strip;
- its foot is the feed column's content foot, the viewport less the column's 24.

The two comments that cited this entry now cite 1136.

## G122. Two statements outside correction 28's parts still give the expanded rail as 260

**Severity: low. Opened 25 September 2026 during handoff 33-A item 2's comment sweep (763), filed
under ruling 597. The number is assigned by this entry (ruling 638).**

The sweep for the five changed parts also found two statements that predate correction 28: a code
comment and a line in this register. Both give the shell's expanded rail width, which is AppShell's
(1082), not a behaviour correction 28 changes in FacetRail. They are left as they are, because the
handoff's sweep corrects what a changed part's old behaviour made false:

- `src/lib/rail-store.ts:24` says the open rail is 260 at expanded. `AppShell` draws 280 (1082).
- G87's item 8 says "1082's 280 is not in this tree", which is no longer so.

Two statements from the same sweep were corrected here, because they cite the spec this handoff
replaces:

- `tests/discovery.cjs`'s full-density check named the canvas "at most 1600" under the pre-1123
  line. It now reads the viewport's width with no maximum. At every width that arm runs, that is
  the value it has always compared.
- The seed's comment calls 1600 the widest width that arm runs, not the widest canvas.

Owed: the two statements above restated, in a change that touches them.

## G123. Pane's bounded list column clips the selected card's ring at its edges — closed (1150, 1151)

**Severity: low. Opened 25 September 2026 during handoff 33-A (G110), filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Correction 28's bounded list column has two properties that meet here:

- it is `overflow-y: auto` and `overflow-x: hidden`;
- Pane's `selectedKey` follow aligns the open card's top with the column's top (1083).

The selected ring is a 4px `box-shadow` outside the face (`0 0 0 2px --bg, 0 0 0 4px --ink`). After
a step, the ring's top was clipped by the column's edge. The page now gives each card's wrapper a
4px `scroll-margin-block`. Discovery's own follow runs after Pane's and honours it, so the list
settles with the whole ring in view; the step arm reads the ring. The sides are still the
compile's. In a lens list at 1280 and 1440, the 680 card fills the 520 or 664 column, and the
ring's sides are clipped. A lane's first card may lose its left band to the column's
`overflow-x: hidden`. Owed: a Strand correction that leaves the ring's inset inside the bounded list
column.

**Amended 26 September 2026 (handoff 33-A Addendum 1, the review of item 3).** The ring's bottom is
cut at a list's end as well. In a lens list at 1280x800 (`/convene/network`), Next onto the last
card leaves the list at its end: scrollTop 538, with a scrollHeight of 1112 in a 573.8 column. The
card runs from 64.4 to 574.3, and the column has no foot padding. So the face is cut by 0.5 and the
ring's bottom band is outside the column. It reads the same on `8d9dfd3`, with Pane's key held
(G128), and after a step taken with the list hidden. The same Strand correction owes the bottom.

**Closed 26 September 2026 by handoff 33-D (correction 30 Part B; 1150, 1151).**

- **The part.** A bounded list column pads `--space-2` on all four sides, and the follow lands the
  selected card below the column's top padding (`Pane.tsx`, as compiled).
- **The lane.** Pane cannot pad a lane's own sideways scroller (1151), and Discovery's lane already
  did this since `61718b7`: at expanded it has `marginLeft` −4, padding 4 each side and scroll
  padding 4. It now states them as `--space-1`.
- **The arm.** `discovery-pane-tools` reads the ring at 1280 and 1440, on both engines, with three
  checks: a lens list's sides and top, the list's foot once Next has taken it to its end, and a lane's
  first card inside both scrollports.
- **Read on this branch** in Chromium against the local build, per side as left, top, right, bottom.
  Each is how far the ring sits inside, and negative is cut:
  - at 1280, the lens list reads 4, 3.5, 4 and the foot 3.8; a lane's first card reads 0 inside the
    lane and 4 inside the list;
  - at 1440, the same.
- **On `f452140`** the same arm reads the lens list at −4, −4.5, −4 and the foot at −4.2.
- **Evidence still owed.** The enforcing run on the final head reads this on both engines. If it
  does not read green there, this entry is reopened with what it read.

## G124. Arrow keys inside the Pane's toolbar step to another event — closed (correction 30)

**Severity: low. Opened 25 September 2026 during handoff 33-A's review (G110), filed under ruling 597. The number is assigned by this entry (ruling 638).**

Correction 28 puts a `role="toolbar"` (Hide or show the list, Copy link, Share) inside the pane's
section. Since correction 23, that section's `onKeyDown` has mapped ArrowLeft and ArrowRight to
Previous and Next event whenever the target is not editable (1083). A keyboard member on Hide list
who presses ArrowRight expecting the next tool gets the next event instead. A toolbar announces
arrow-key movement between its tools, and here the keys belong to the section. Both behaviours are
the compile's, and Discovery binds them as ported (844). Owed: a Strand correction that lets the
toolbar keep its arrow keys, or drops the toolbar role.

**Closed 26 September 2026 by handoff 33-D (correction 30 Part B, ratified with correction 31 under
1153).**

- **The part.** It keeps `role="toolbar"` with the APG's keys: ArrowLeft, ArrowRight, Home and End
  move focus between the tools and stop at the ends. Each is marked handled, so the section's step
  handler, which yields to `defaultPrevented`, does not change the open event. `Pane.tsx` carries
  `onToolbarKey` as compiled. ArrowLeft and ArrowRight on anything else in the pane still step.
- **The arm.** `discovery-pane-tools` focuses Hide list and presses ArrowRight, End, ArrowRight,
  Home and ArrowLeft. At 1280 and 1440 on this branch it reads focus on `list`, `copy`, `share`,
  `share`, `list`, `list`, with the open event unchanged.
- **On `f452140`** focus stays on `list` and the event steps.
- **Evidence still owed.** The enforcing run on the final head reads this on both engines.

## G125. B9-SPEC Revision 2 addresses the member event page by slug; B10-SPEC and the tree address it by id — closed (1137)

**Severity: low. Opened 25 September 2026 during handoff 33-A's review (G100), filed under ruling 597. The number is assigned by this entry (ruling 638).**

The two specs give the member event page different addresses:

- B9-SPEC Revision 2's Routes line gives it as `/convene/events/{slug}`: "Slug: from the title,
  editable in the hub … old slugs redirect permanently".
- B10-SPEC, which owns the page, gives the member address as `/convene/events/{id}`, and the public
  one as `/e/{slug}`.

The tree follows B10-SPEC. The route's param is the event id, and `loadEventPage` refuses anything
that is not a UUID. So the face's link (G100) and every Discovery navigation address the page by
id. Nothing here changes it, since the route belongs to Brief 10. Owed: a ruling on which address
the member page has, and B9-SPEC or B10-SPEC restated to it.

**Closed 26 September 2026 by handoff 33-A Addendum 1 item 1.** Ruling 1137 addresses the member
event page by id, `/convene/events/{id}`, as the tree and B10-SPEC do; the readable, shareable
address is the public one under `/e/`. B9-SPEC Revision 3's Routes line says so. Nothing in the tree
changes.

---

## G126. The branch alias answered 404 on every route for about ninety minutes, across two deployments of one build, and cleared on its own (G20 recurred) — closed (1154)

**Severity: medium. It blocks the exit check, not the build. Opened 26 September 2026 during handoff 33-A (PR #67), filed under ruling 597. The number is assigned by this entry (ruling 638). Left open: G20's next step is a harness change outside handoff 33-A.**

What the runs read, on `claude/new-session-n9rnpi` at `5a09009`, all times UTC:

- **Run 361, attempt 1** (`36196856971`). Deploy `5797cc2d` finished at 22:29:18. Ruling 217's gate
  read every path 200 from 22:29:31 to 22:29:35. Both matrix jobs then ran with no failure until,
  between 22:33:22 and 22:33:30, both stopped at once, on different arms: chromium at
  `820x1180-shell` (arm 529) and webkit at `820x1180-light` (arm 453). From then on every page open
  timed out at 20 to 30 s. That covered `/sign-in`'s email field and the signed-out profile at
  `/m/thandiwe-dube` alike, and the page-error checks read "Failed to load resource: the server
  responded with a status of 404". Both jobs reached the 60-minute limit and were cancelled at
  23:29.
- **Run 361, attempt 2**, deploy included. This was the one re-run, and G20's "redeploy first".
  Deploy `e18f60ee` finished at 23:46:35. The gate polls each path 12 times, 10 s apart. It read
  404 on every poll of `/sign-in`, `/connect`, `/reset`, `/reset/new`, `/password`, `/welcome` and
  `/where`, from 23:46:47 to 23:59:43. It then read 200 on the first poll of every later path, from
  `/relationship` at 00:00:03 through `/.well-known/security.txt`. All three jobs failed at the gate
  with nothing tested.

Neither the tree nor a swap between builds explains a 404:

- No workflow run deployed to the branch between 22:29:18 and 23:46:35.
- The builds of runs 359, 360 and 361 differ only in tests, docs and one comment.

Two deployments of one build answered 404 on routes, and the second cleared between two polls with
nothing done. That places the fault on Cloudflare's side of the alias, not in the build or the tree.

That is inference. This container's proxy denies `pages.dev` and the artifact storage, so three
things are unread:

- which resource the matrix's 404 named;
- whether static files served through the window, which was G20's shape;
- whether the per-deployment host answered 404 along with the alias.

G20's instruction for this case is "only if a second deployment 404s the same way pass
`matrix.yml`'s `base_url` the deployment URL", and a second deployment did. `pages.yml` sets `BASE`
to `pages-deployment-alias-url || deployment-url`, so every push-triggered job reads the alias.
Owed: a ruling on whether the push-triggered jobs read the per-deployment host, which 811 already
names for each deployment, instead of the alias. That is a harness change, and handoff 33-A does not
make it.

**Amended 26 September 2026 by handoff 33-B (1141).** Ruling 1141 answers what this entry owed. The
push-triggered live and matrix jobs, and ruling 217's gate inside them, read the per-deployment host
of the deployment the same run uploaded, and never the branch alias. The dispatch workflows stop
defaulting to the alias. The harness change:

- `pages.yml`: the deploy job's `url` output is wrangler-action's `deployment-url`, the upload's own
  host, `https://<id>.dna-web-application.pages.dev`. It was `pages-deployment-alias-url` first.
  `BASE` in the live and matrix jobs is that output alone, and the host built from `ref_name` is
  gone. A step after the deploy fails the job by name when `deployment-url` is empty or is the
  alias.
- `matrix.yml` and `webkit-crash.yml`: a dispatch without `base_url` is refused by name, and none of
  their jobs builds the alias from the branch name.
- `scripts/host-tested.sh` runs first after the checkout in every test job, push and dispatch alike,
  and opens the job summary with the host the job tests (811, 893).

In this entry's window every job read the alias,
`https://claude-new-session-n9rnpi.dna-web-application.pages.dev`. The two deployments' own hosts
were `https://5797cc2d.dna-web-application.pages.dev` (attempt 1, deployed at 22:29:18) and
`https://e18f60ee.dna-web-application.pages.dev` (attempt 2, deployed at 23:46:35), read from each
deploy log's "Take a peek over at" line. No job read either.

The entry stays open until a run on the new setup reads green, and closes then. The first run that
can read green on it is handoff 33-B's own enforcing run, on a head that carries this amendment, so
the closure cites that run and is recorded after it: nothing is committed to a branch once its
enforcing run has started (556).

Owed as a separate reading: whether the per-deployment host also answered 404 in this entry's
window, the third unread item above. It is still unread. This change decides which host later runs
read, and it does not answer what `5797cc2d`'s and `e18f60ee`'s hosts answered on 25 September.

**Closed 26 September 2026 on run 374 (handoff 33-D item 0, 1154).**

- Run 374 is `pages.yml` id `36257756375`, on `53a2f4a`, handoff 33-B's final head. It is the only
  run on that branch and the first on 1141's setup, and it read green on both engines against the
  deployment's own host.
- The deploy job's 1141 step passed. The live job and both matrix jobs each opened with the same
  Host tested line: `https://043c2208.dna-web-application.pages.dev`, the deployment that run
  uploaded, built from `53a2f4a`. No job read the branch alias.
- `matrix (chromium)` job `108447813774` read 6842 of 6842, and `matrix (webkit)` job
  `108447813801` read 6842 of 6842. Each had none behind a web-process crash (G5) and none
  unclassified. `live` job `108447813800` read 162 of 162 with its three standing unproven arms.
- Still unread, and not answered by this closure: whether the per-deployment hosts `5797cc2d` and
  `e18f60ee` also answered 404 in this entry's window on 25 September. Run 374 reads a later
  deployment's own host. It says nothing about what those two hosts answered then.

---

## G127. The rail column's foot at expanded is 48, where B9-SPEC's canvas foot is 24

**Severity: low. Opened 26 September 2026 during handoff 33-A Addendum 1 item 3 (Chat's read of `5a09009`), filed under ruling 597. The number is assigned by this entry (ruling 638).**

B9-SPEC's expanded line gives the canvas "padding 24 at top and foot". AppShell draws that foot as
each column's own bottom padding:

- the feed column's is 24 at expanded (`src/components/dna/AppShell.tsx:311`);
- the rail column's is 48 (`:328` and `:342`), and no comment or ruling gives a reason for it.

The rail's foot was read against the pane's foot on this branch's build of `8d9dfd3`. The reads
were in Chromium at 1280x800, 1440x900 and 1600x1000, and two independent re-readings upheld them.

- **Pane open, the list shown or hidden.** The rail is its collapsed strip, which is content-sized
  at 411 (`max-height: none`) and runs from 202.2 to 613.2 at all three heights. The pane's foot is
  the feed column's content foot: 776, 876 and 976, the viewport less 24. So the rail's foot is
  162.8, 262.8 and 362.8 above the pane's. The rail column's own content foot is 752, 852 and 952,
  the viewport less 48, which is 24 above the pane's.
- **Pane closed, the rail open.** The rail sits at its bound, `max-height: calc(100% - 16px)`:
  549.8, 649.8 and 749.8 tall, with its content overflowing. Its foot is the rail column's content
  foot, 24 above the lanes' foot.
- Rail, list and pane start level at 202.2 in every state.

Wherever the rail reaches its bound, its foot sits 24 above the feed column's. With the pane open,
the rail is the strip and ends where its content does, so the 48 does not show. Owed: a ruling on
whether the rail column takes the canvas's 24 at expanded, or the spec names the rail's 48.

---

## G128. Pane's `selectedKey` follow runs while the list is hidden, and writes the hidden list's scroll — closed (correction 30)

**Severity: low. Opened 26 September 2026 during handoff 33-A Addendum 1 item 3 (Chat's read of `5a09009`), filed under ruling 597. The number is assigned by this entry (ruling 638).**

Correction 28 says the hidden list keeps its scroll (the extraction, line 17: "The list slot stays
the same element, hidden and inert, and keeps its scroll"). The bundle's follow
(`docs/strand/v1790366257373061/_ds_bundle.js:3154-3157`, ported at
`src/components/strand/Pane.tsx:246-250`) runs on every new `selectedKey` with no `listHidden`
check. `bringIntoView` then sets `scrollTop += box.top - c.top`, and the hidden list is still laid
out, at no width, on its 0px track. So a step taken while the list is hidden writes its scroll
against that layout.

Read in Chromium on this branch's build of `8d9dfd3`, and upheld by two independent re-readings:

- At 1280x800, Hide list moves the list from 1936 to 2107. That is scroll anchoring on the 0px
  track, and Show list reverses it.
- A Next while hidden then writes 2107 to 150. A setter trap on the list's `scrollTop` caught
  `bringIntoView`, called from the follow effect, once per step and nothing else. 1440 and 1600
  read the same.
- Discovery's own refollow on Show list covers steps that end on another card. It does not cover
  steps that return to the card the list was hidden on (Next, then Previous). Show list then left
  the list at 150, with the open card 61 above the column's top, out of view and without its ring.

Discovery now holds the key it passes Pane at the open event the list was hidden on, until the list
is shown (`hiddenKey` in `DiscoverySurface.tsx`). A step while hidden therefore writes nothing, and
Show list follows only when the open event changed. The step arm reads the hidden list's scroll
across a Next: on `8d9dfd3` it fails (4266 to 1185 at 1280, 4066 to 1185 at 1600), and with the
held key it holds. One outcome differs from `8d9dfd3`: hide on a card, step away, step back to it
and show, and the list is where it was hidden. That is "scroll kept"; if the member had scrolled the
open card out of view before hiding, it stays out of view.

The part is unchanged (844). A caller that passes the open item as `selectedKey` together with
`listHidden`, the compile's own usage, still writes the hidden list's scroll. Owed: a Strand
correction that guards the follow on `listHidden`, after which Discovery's held key goes.

**Closed 26 September 2026 by handoff 33-D (correction 30 Part B, ratified with correction 31 under
1153).**

- **The part.** The follow does not run while the list is hidden, so the hidden list's `scrollTop` is
  never written. On Show list it runs only if the key changed while the list was hidden.
- **Discovery's held key goes.** `hiddenKey`, from `3d05d50`, was removed only after the step arm
  read the same with the part's guard alone, in Chromium against the local build, at 1280 and 1600.
  - "Hide list, Next, Show list" read the hidden list's `scrollTop` 4282 → 4282 at 1280 and
    4082 → 4082 at 1600, with the card and its ring back in view on Show list.
  - Those are the readings the held key gave, value for value.
  - Discovery now passes the open event as `selectedKey` throughout.
- **The new check.** `discovery-pane-tools` adds a setter trap on the hidden list's `scrollTop`
  across Previous and Next, and at 1280 and 1440 reads no write and the hidden value held across
  both steps. In Chromium the list's own values ran 536 → 136 → 136 → 536 at 1280 and
  598 → 36 → 36 → 598 at 1440: before hiding, hidden, after the two steps, shown. WebKit read
  538 → 120 → 120 → 120 and 600 → 20 → 20 → 20 on dispatch 71, with no write either: Hide moves the
  list and Show does not move it back there, which is G138 and not this gap. So the check reads
  what G128 owns, no write and the hidden value held, and not where Show list leaves the list.
- **On `f452140`** this check also passes, because the held key produced the same outcome there. It
  is the one changed check in this handoff that cannot fail first, and the report says so.
- **Evidence still owed.** The enforcing run on the final head reads this on both engines.

---

## G129. Back then Forward to an event reached by a step reopens the pane with its list scrolled away from the open card

**Severity: low. Opened 26 September 2026 during the review of handoff 33-A Addendum 1 item 3, filed under ruling 597. The number is assigned by this entry (ruling 638).**

This was read in Chromium at 1280x800. It reads identically on this branch's build of `8d9dfd3` and
on the build that holds Pane's key (G128), with the list shown throughout:

- With the list arranged at 1936, Next follows to 85, and the open card sits at 4.0 with its ring.
- Browser Back leaves the pane, and browser Forward reopens it with a new list element. Pane's mount
  follow writes 0 to 89, and Discovery's refollow writes 89 to 85.
- A later write then sets 1936, the offset from before the step. The open card ends at -1847, out of
  view.

The last write came from the router's bundle (`Match-*.js`, through a `Set.forEach`).
`scrollToTopSelectors` in `src/router.tsx:26-30` names the feed, left and right scrollers, not
`[data-pane-list]`. So this reads as the router's element scroll restoration copying a remembered
offset onto the list column. That mechanism is inferred from the call stack and was not read in the
router's source (555). It is the class of copy-forward CLAUDE.md records under W58 and ruling 552.
Owed: the mechanism read in the router, and the list column's offset settled after the router's
restoration or excluded from it.

---

## G130. The event page's Share sheet keeps its own share and copy, apart from Discovery's `useShare` — closed (ruling 1156)

**Severity: low. Opened 26 September 2026 during the review of handoff 33-A Addendum 1 item 2 (G120), filed under ruling 597. The number is assigned by this entry (ruling 638).**

G120 owed two things: a ruling on the address Discovery's share path hands over, and one share path
for the card, the pane and the page. Ruling 1140 settled the address, and `eventShareUrl` builds it
for all three. The share path is still two:

- Discovery's card menu and pane toolbar go through the Feed's `useShare`
  (`src/components/dna/FeedSurface.tsx:38`). Its share calls `navigator.share({ url })`, or copies
  where the browser has no share. A share that throws, a dismissed sheet included, shows the address
  as its toast.
- The event page's own sheet (`src/components/dna/EventShareSheet.tsx:61-75`) copies with the same
  toast. Its Share via calls `navigator.share({ title, url })`, is offered only where the browser
  has a share, and shows nothing when the share throws.

So at expanded, with the pane open, the toolbar's Share and Share via in the sheet that the page's
Share row opens, in the same pane, hand over one address, with and without the event's title, and a
dismissed share toasts in one and not the other. Neither is ruled: 1140 names the address, and
neither B9-SPEC nor B10-SPEC section 4 names the payload or what a refused share shows. Owed: a
ruling on one share path for the card, the pane and the page, with its payload and what a refused
share shows.

**Closed 27 September 2026, in handoff 34-A item 7, under ruling 1156.** 1156 ruled the share in the
pane, and B9-SPEC Revision 6 carries it as "one share view, one path". The toolbar's Share and the
event page's own Share now open one view, `EventShareView` in `src/components/dna/EventShareSheet.tsx`,
in the pane body in place of the page and never as a Sheet over the screen. Its close control returns
to the page. The standalone page's Sheet wraps the same component, unchanged, so the event page has
one share wherever it renders: Share via hands over `{ title, url }`, is offered only where the
browser has Web Share, and shows nothing when the share is refused. The toolbar's
`handOver(paneId, "share")` is gone. As 1156 leaves them, the card menu's Share and Copy link and the
toolbar's Copy link stay on `useShare` (1140): the card menu hands over `{ url }` and shows the
address when a share is refused. That is the one difference left, and it is ruled rather than owed.

---

## G131. A card menu's Share or Copy link selected before the event page's read answers hands over after an await

**Severity: low. Opened 26 September 2026 during the review of handoff 33-A Addendum 1 item 2 (G120), filed under ruling 597. The number is assigned by this entry (ruling 638).**

Under 1140 the card menu hands over the address the event page builds from its own read,
`event_page`, and Discovery's items carry no slug and no public flag. So `handOver`
(`src/components/dna/DiscoverySurface.tsx:419`) uses the page from the query cache inside the press
when it is there. A read that has already failed, or is paused offline, hands over the member
address inside the press. Otherwise the press waits for the read's first answer, starting the read
if none is running. The pane's page is cached once the pane has loaded it; its toolbar is drawn as
it opens, so a press on it before that waits too. A card's is cached by hover intent at expanded
(1067), or by the read that the press on its ellipsis starts (`warmMenu`), once that read answers. A
select made inside that round trip takes the awaited path.

A scratch probe, not an arm, read this on this change's build in Chromium, against the harness's
`event_page` mock, which answers in 120 ms. A hand-over counted as in the press when it ran before a
`setTimeout(0)` the press set, and `window.event` agreed in every case:

- At 390x844, a click select made 0 ms after the menu appeared was awaited for Share and Copy link
  on both events read, and three of four were at 50 ms. From 100 ms on, every one ran in the press.
  A tap select at 0 ms was awaited once in four.
- At 1280x800, hover intent had not always answered by the press: at 0 and 50 ms, seven of eight
  were awaited, and from 100 ms on every one ran in the press.
- A keyboard select, Enter on the ellipsis and then Enter on the item, was awaited at both widths.
  The read starts at the click that Enter makes.
- The pane's Copy link and Share ran in the press at 1280x800.

Every hand-over was the right address. The link arm's `menuSelect` selects as soon as the menu opens,
so its presses can take either path; it reads the address, which both paths share. Chromium kept
the press's activation across these awaits: `navigator.userActivation.isActive` read true at every
awaited hand-over, at 390x844 and 1280x800.

The review of this change read the pane with `event_page` failing, in Chromium at 1280x800. As
first written, `handOver` awaited the read through `fetchQuery`, which joins a read already running
together with its retries: EventSurface's query retries a failed read three times on the default
client, 1, 2 and 4 seconds apart. So Share and Copy link, pressed as the toolbar was drawn, handed
over the member address 7355 and 7357 ms after the press, after four reads. Chromium no longer read
the press's activation, and a share stub that refuses without it was refused, so `useShare` showed
the address as its toast. `handOver` now waits for the running read's first answer through the
query cache, and hands over at the first failure. Re-read on the rebuilt build:

- The review's own sequence handed over the member address inside the press, for Share and for
  Copy link, after one read. The first attempt had already failed when the toolbar was pressed.
- A second scratch probe had `event_page` answer 1500 ms after each request, failing or not, and
  pressed while the first attempt was still running. In the pane at 1280x800, and on the card menu
  at 390x844 selected as soon as the menu opened, every hand-over came 4 or 5 ms after that first
  attempt answered. It was the member address when the attempt failed and `/e/{slug}` when it
  answered, with activation still read at 1.1 to 1.4 seconds after the press.

A wait of one attempt still outlives the press on a slow network. On WebKit a share sheet and a
clipboard write need the press's gesture, and whether the gesture survives a network await is
unread here: WebKit is not installed (G21), and the harness stubs both APIs, so no arm reads
activation. Where the call is refused, `useShare` shows the address as its toast. Owed: a hand-over
that keeps the press's activation when the read has not answered, read on WebKit. For Copy link, a
`navigator.clipboard.write` of a `ClipboardItem` whose text is a promise is the usual form for a
write whose text is not yet known. That form is unread here. Share has no such form, so its address
would have to be known at the press.

A wait is dropped once a later press overtakes it: a press of the same control, or a press on
another event. So a late answer cannot write over a later copy, or open a sheet, after the member has
moved on, and a Copy link followed by a Share on the same event hands over both. The third review
found the late overwrite before the merge. The first fix counted every press together, and on the
deployed preview, where the read had not answered, the link arm's Share dropped its Copy link
(`copied: []` at 390x844 and 1280x800 on `757149e`). Holding the read for 1500 ms reproduced that
locally at 390x844, and the rule above passes the same sequence. A Share on one event held behind its
read, followed by a Copy link on another, no longer opens the first event's sheet.

## G132. The card menu's Add to calendar waits out the event page read's retries when that read is failing

**Severity: low. Opened 26 September 2026 during the review of handoff 33-A Addendum 1 item 2 (G120), filed under ruling 597. The number is assigned by this entry (ruling 638).**

The card menu's Add to calendar (1097, `src/components/dna/DiscoverySurface.tsx:862`) reads the
event page through `qc.fetchQuery` under EventSurface's key. `fetchQuery` joins a read of that key
that is already running, together with the three retries EventSurface's query makes on the default
client, 1, 2 and 4 seconds apart; its own `retry: false` does not reach a read it joins. So with the
pane open on an event whose `event_page` is failing, that event's card menu shows "The calendar file
could not be made." about seven seconds after Add to calendar is pressed.

A scratch probe, not an arm, read it in Chromium at 1280x800 against the harness's mock, with the
pane open on a going, dated event and its card's menu pressed as soon as it opened. The toast came
6969 ms after the press on this change's build and 7078 ms after it on `8d9dfd3`, each after three
more reads of the page. With the read answering, the file downloaded 66 and 69 ms after the press.
The item predates G120, and this change leaves it as it was. G131 records the same join in Share and
Copy link, where `handOver` now waits for the running read's first answer only. Owed: the calendar
item waits for the running read's first answer too, or a ruling that the wait stands.

## G133. A Cloudflare Workers Builds check, connected outside the tree, was red on every commit it built — closed

**Severity: medium while it stood. It failed no job in `pages.yml` and deployed nothing, but it put a
red check on every commit it built, and a build of it that succeeded would have been a second deploy
path for this repository that no brief names. Opened 26 September 2026 during handoff 33-A Addendum 2
(PR #67), filed under ruling 597. The number is assigned by this entry (ruling 638).**

What was read, on `claude/new-session-n9rnpi`, all times UTC:

- A check named `Workers Builds: dna-web-application`, posted by Cloudflare's Workers Builds git
  integration, failed on `52f9263` (check run `108367334289`, 08:03) and on `9289db8`
  (`108367804518`, 08:06). Each completed in under a second, with no output text. Its build log was
  on the Cloudflare dashboard only, which the session could not open, so why it failed is not read.
- The check-suite notice for `b7baabf`, at 07:03, listed no third-party suite, and the integration's
  first comment on #67 arrived at 08:02. Nothing under `.github/` or in the build config changed.
- It built a Worker script named `dna-web-application` (id `f6c4bdf92bab4f0f8a29549e7e9ceffc`), which
  the account then held. This repository is a Pages project: `wrangler.jsonc` sets
  `pages_build_output_dir: "dist"`, Nitro's `cloudflare-pages` preset emits `dist/_worker.js`, and
  `pages.yml` deploys with `wrangler pages deploy dist`. A Workers build of this tree has no Worker
  entry to deploy, which fits an immediate failure but is inferred, not read.
- The PR's commits since `b7baabf` touch Discovery's and the event page's source, tests and docs
  only; `bun run build` passes locally and `pages.yml`'s deploy job was green on `b7baabf` (run 369).

**Closed 26 September 2026, before handoff 33-A's final head.** The founder deleted the Worker
`dna-web-application`, which had been created at 07:37 UTC (00:37 Pacific) that day with Workers
Builds connected to this repository. Chat read the account afterwards and found no Workers, and this
session's own read of the account (the Cloudflare Workers list) returned none, count 0. The Pages
project `pages.yml` deploys is the one deploy path. The check's absence on the final head is read in
PR #67's report; a Workers Builds check that still posts there is named there and stops the PR.

## G134. Moving from Discovery to the Feed inside the app leaves the Feed with no header lens below expanded

**Severity: low. Opened 26 September 2026 during the review of handoff 33-A Addendum 2 item 4
(1145), filed under ruling 597. The number is assigned by this entry (ruling 638).**

Below expanded, once the shell's scroller is past 72 (`SCROLL_SWAP_PX`), the header takes the
LensBar that the surface on screen registered in `src/lib/header-lens-store.ts`
(`src/components/dna/AppShell.tsx:189`). The Feed reached from Discovery inside the app shows none.
Its own bar is hidden once scrolled, as it always is, and the header keeps the composer entry. So
nothing on screen lets the member change the Feed's lens until they scroll back up.

A scratch probe, not an arm, read this in Chromium at 390x844 and 820x1180. It ran on `9289db8` and
on `f19af1f`, with identical results on both, so the defect predates item 4:

- **Home control** (`goHome`, `AppShell.tsx:150`), pressed on `/convene` scrolled to 200. On the
  Feed scrolled to 200, the header reads `data-centre="compose"` and holds no LensBar.
- **In-app Back.** `/feed`, then `/convene` through the router, then `history.back()`: the same
  result.
- **Direct load.** `/feed` loaded directly and scrolled to 200 reads `data-centre="lens"` with the
  header's LensBar visible.
- **Another lens.** After either move, choosing another lens on the Feed and scrolling again brings
  the header's LensBar back.

The store keeps whatever was set last, and both surfaces clear it on unmount (`FeedSurface.tsx:244`,
`DiscoverySurface.tsx:787`). The shell renders FeedSurface from `useLocation`'s pathname next to the
`<Outlet />` (`src/routes/_shell.tsx:37`, `:116` and `:117`). The probe counted React commits
through a devtools-hook stub. On every move, the Feed's lens anchor entered the DOM three or four
commits before Discovery's root left it, 11 to 54 ms earlier. So the Feed registers
(`FeedSurface.tsx:237`) and then Discovery clears the slot. The Feed's effect depends on
`[view.kind, lens, navigate]`, and none of these change after the move, so it never registers again.
A change of lens re-runs it, which is why choosing another lens restores the header's bar. Why the
router moves the pathname a few commits before it swaps the outlet is not traced.

At expanded the header never takes a lens, so nothing is missing there. The lens-identity arm cannot
see this defect: every read it makes starts from a page load, and the defect is identical on both
builds.

Owed: the Feed keeps its header lens after any in-app move from Discovery, and an arm reads the
header after that move below expanded.

**Amended 26 September 2026 by handoff 33-B item 5.** The lens-identity arm this entry names has
left the suite. What is owed is unchanged.

## G135. A local `wrangler pages dev` dies under the suites' load, and a port another process holds answers in its place

**Severity: low. It touches no deployment and no CI job: CI reads the deployed Pages build and never
runs `wrangler pages dev`. It costs local proof, which CLAUDE.md names as the only local command that
proves anything about the worker. Opened 26 September 2026 during handoff 33-A Addendum 2 (PR #67),
filed under ruling 597. The number is assigned by this entry (ruling 638).**

What was read, on this session's container, with `wrangler` 4.129.0 serving `dist` copies on
`127.0.0.1` ports while Playwright drove them:

- Servers died on their own during or between suite runs, at intervals of roughly fifteen to forty
  minutes. The logs end with workerd's
  `kj/async-io-unix.c++:186: disconnected: ::write(...): Broken pipe` and "wrangler command errored",
  or with an empty `✘ [ERROR]`, or, once, with esbuild's service deadlocking ("all goroutines are
  asleep"). No cause beyond those lines was traced.
- A dead server's port can be taken by another process started for another purpose, and `curl`'s
  200 from `/convene` then describes that process's build. Here a reference server of `f19af1f`,
  started by a parallel agent on the port a head build had failed to bind, answered until it died
  at 08:11 UTC. Every suite before then read `f19af1f`'s geometry and failed the head's new checks,
  and the head's server, restarted on the freed port, served every suite after it. The same collision happened once earlier
  in the session, on another port.
- The harness never passed on either: every check it could not read failed, and ruling 292's count
  check named each arm that emitted fewer checks than it declares.

What held the local proof for PR #67: a probe reads which build a port serves, by reading an element
that differs between builds (here `data-lensbar-width` on Discovery's lens bar), before and after
every suite; only runs bracketed by two such reads were counted.

Owed: nothing in the product. A local runner that checks the served build before it counts a run,
or a pinned `wrangler` that holds under load, would stop the next session from reading a red that is
not the change's.

## G136. Tooltip places itself against its host span, so an absolutely placed IconButton's tooltip lands at an empty box

**Severity: low. Opened 26 September 2026 during handoff 33-D (correction 31 item 3, 1146), filed
under ruling 597. The number is assigned by this entry (ruling 638).**

Correction 31's `Tooltip` wraps its control in a `span[data-tooltip-host]` (`display: inline-flex`).
It measures that span to place itself below the control, or above it at the viewport's foot.
`IconButton` wraps itself in one and still hands its `style` to the button. When a caller positions
the IconButton absolutely, the button leaves the host's flow. The host is then an empty 0 by 0 box
where the button would have sat, and the tooltip is placed against that box, not against the
control.

The compile's own `Composer` does this: its "Remove image" button on a thumbnail is
`position: absolute; top: -8; right: -8`. The tree has it there and twice more, in `ProfileHeader`'s
"Change cover" camera buttons. Each now puts the placement on a wrapper,
`<span style="position:absolute; …; display:flex">`, around the IconButton. The host span then wraps
the button, the tooltip is placed against it, and the button lands where it did. The part is as
compiled (844).

Owed: a Strand correction that places the tooltip against the control rather than the host, for
instance the host's first element child. The three wrappers then go.

## G137. Native `title` tooltips remain on parts correction 31 did not reach

**Severity: low. Opened 26 September 2026 during handoff 33-D, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Handoff 33-D's IconButton row asks for "no `title` attribute anywhere in `src/`". `Tooltip.prompt.md`
says "No `title=` anywhere in Strand". Neither holds of compile `v1790410319010950` itself, which
still writes a native `title` in four parts:

- `FacetRail`'s collapsed strip, on the expand button and on each axis button;
- `LensBar`'s icon-first seat on a pointer;
- `VerbChip`'s disabled reason;
- `PostCard`'s "Written by you" pen icon.

The ports carry each as compiled. The bundle governs, and the handoff says to port what it does.
`IdentityMark`, which is the tree's own and not in the compile, carries one too. So does the shadcn
layer's `sidebar.tsx`, which nothing imports.

What handoff 33-D made true: no IconButton renders `title`, and none can be handed one, because
`IconButtonProps` omits it. Every IconButton names itself through `aria-label` and the Tooltip.

Owed: a ruling on whether 1146's Tooltip replaces these too. If it does, a Strand correction brings
the four parts onto it, and the tree moves `IdentityMark` in the same change.

## G138. On WebKit, Show list leaves the Pane's list where Hide list moved it

**Severity: low. Opened 26 September 2026 during handoff 33-D, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Correction 28 says the hidden list keeps its scroll. The part hides the list by taking its track to
0px, where it stays laid out at no width. Hiding therefore changes the list's layout and its scroll
range, and the engine moves its `scrollTop` with no setter involved.

- **Chromium moves it back on Show list.** G128's own reading was 1936 → 2107 → 1936. Handoff
  33-D's `discovery-pane-tools` arm, against the branch's local build, read 536 → 136 → 536 at
  1280 and 598 → 36 → 598 at 1440.
- **WebKit does not.** Dispatch 71 (`36268117282`) ran the arm on WebKit against `f452140`'s
  deployment. It read the list at its end, hidden, after Previous and Next, and shown:
  538 → 120 → 120 → 120 at 1280 and 600 → 20 → 20 → 20 at 1440. Run 377 (`36268454297`) read the
  branch's own deployment on WebKit, with the part's padded column and guard: 536 → 136 → 136 → 136
  and 598 → 36 → 36 → 36.
- **Neither is a write.** The arm's setter trap caught none in either cell, so neither the part nor
  Discovery moved the list.

The readings fit scroll anchoring in Chromium and none in WebKit. That mechanism was not read in
either engine (555).

What a member sees in Safari: hide the list and show it again, with no step or with steps that
return to the same event, and the list comes back scrolled elsewhere. The open card can then be out
of view. A step that ends on another event is followed on Show list (the part's guard, G128), so
that case lands.

Owed: a Strand correction under which the part keeps the list's scroll itself across Hide and Show,
for instance by holding `scrollTop` on Hide and writing it back on Show when the key has not
changed. The arm's G128 check reads no write and the hidden value held. It does not read where Show
list leaves the list, because that differs by engine; once the part keeps the scroll, it can.

## G139. The public event page's header carries the padding shorthand beside its safe-area longhand, and drops the inset when the tier flips

**Severity: low. Opened 26 September 2026 during handoff 33-D, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/components/dna/PublicEventSurface.tsx:137-141` styles the header with
`padding: compact ? "0 16px" : "0 32px"` and `paddingTop: "env(safe-area-inset-top)"` in one object.
`useTier` flips from compact once on mount at every width above compact. When it flips, React
writes the changed shorthand, which resets `padding-top`, and does not rewrite the unchanged
longhand. React's development build names it in the guest arm at 1280x800, on the branch and on
`f452140` alike: "Updating a style property during rerender (padding) when a conflicting property is
set (paddingTop) can lead to styling bugs".

Read in Chromium against local dev servers of both builds, reached as the guest arm reaches it, by
a client navigation to `/e/{slug}` from `/sign-in`:

- At 1280x800 the header's inline style ends as `padding: 0px 32px`, and the
  `env(safe-area-inset-top)` longhand is gone.
- At 390x844, where the tier does not flip, it keeps `padding-top: env(safe-area-inset-top)`.

On a desktop the inset is 0 either way, so nothing moves. Above compact with a top inset that is not
0, the header's row would sit under the status bar. That was not read on a device.

Owed: the header in longhand only, as `AppHeader` and `ProfileSurface`'s public header already are
(ruling 344's inset in `paddingTop`, the sides in `paddingLeft` and `paddingRight`). Handoff 33-D
does not reach this surface, so it is not changed here.

## G140. After sign-in, Chromium's 1366x1024 light onboarding-layout arm stayed on `/sign-in?` for 15 s on run 379, and WebKit's 1440x900 light discovery arm on run 431 — closed (handoff 37-F)

**Severity: low, unread. Opened 27 September 2026 during handoff 34-A (item 1), filed under
ruling 597. The number is assigned by this entry (ruling 638).**

Three readings of `chromium-1366x1024-light-onboarding-layout`, each from the `matrix (chromium)` job
of a `pages.yml` run:

- **Run 379, red.** `main`'s push run on `dc21b64` (`36277451548`, job `108502943001`), against
  `4d90a13f.dna-web-application.pages.dev`. The arm's first wait, `signInTo(page, "**/welcome")`
  (`tests/onboarding.cjs:163`, the wait at `:121`), timed out. The log reads
  `page.waitForURL: Timeout 15000ms exceeded.`, then
  `waiting for navigation to "**/welcome" until "load"`, then
  `navigated to "https://4d90a13f.dna-web-application.pages.dev/sign-in?"`. Its ruling 292 line
  read `emitted 1 of 37; the 36 checks behind the failure never ran`. The job read 6842 of 6844:
  the arm's failure and its 292 line were the only two, 0 behind a web-process crash (G5) and 2
  unclassified.
- **Run 380, green.** The push run on `bc7c9c9`, on `claude/new-session-rqs074` (`36280764192`, job
  `108512103333`), against `7356b9b8.dna-web-application.pages.dev`. The arm emitted 37 of 37 (ARM
  5913 to 5950) and the job read 6880 of 6880.
- **Run 381, green.** `main`'s push run on `eba3198` (`36285472824`, job `108525412534`), against
  `499e8435.dna-web-application.pages.dev`. The arm emitted 37 of 37 (ARM 5913 to 5950) and the job
  read 6880 of 6880.

What the three builds share. `eba3198`'s tree is `bc7c9c9`'s (both `3ccc3bf`), so runs 380 and 381
read one tree. `dc21b64` differs from it by handoff 33-C's three commits and nothing else.
`b5798d6` deleted `.lovable/` and `src/lib/lovable-error-reporting.ts`, took the reporter's call out
of the root `ErrorComponent` (`src/routes/__root.tsx`), and edited `README.md` and `AGENTS.md`.
`26fc1e3` rewrote `vite.config.ts` off `@lovable.dev/vite-tanstack-config` and took the wrapper out
of `package.json`, `bun.lock` and `bunfig.toml`; its message records a clean build byte-identical to
`b5798d6`'s through the wrapper once the three values that differ between any two clean builds are
set aside. `bc7c9c9` edited `AGENTS.md` and `CLAUDE.md`. `src/routes/sign-in.tsx` and
`tests/onboarding.cjs` are the same file in all three.

What the address shows, and no more. `/sign-in?`, with an empty query, is the address a native
submission of the sign-in form produces: the form declares no `method` or `action`, and neither field
carries a `name` (`src/routes/sign-in.tsx:219` to `244`). Whether the press reached the form before
its `onSubmit` did was not read (555).

Not read: the arm's failure screenshot, `onboarding-layout-fail-chromium-1366-light`, in run 379's
artifact `matrix-chromium-run-379` (`10918766443`). The session that opened this entry could not
reach the host that serves Actions artifacts.

Owed: that screenshot, read while the artifact is retained, and any further red reading of this arm
added here before a cause is named.

**Second sighting, 30 September 2026 (handoff 37-F).** `pages.yml` run 431 (id `36696029333`, head
`950b72b`, the enforcing run of PR #81), `matrix (webkit)` job `109824752438`:
`webkit-1440x900-light-discovery` timed out on `signIn`'s `waitForURL("**/feed")` after fifteen seconds,
`emitted 1 of 36`, the job's one failure beside its retried G5 arm. WebKit this time, a different arm
and a different width, 2299 s into the job. 37-F's `FAILSTATE` line read what the page held:
`/sign-in?`, focus on `body`, no dialog, and the sign-in form's own test ids present (`password-eye`,
`forgot-password`, the two providers), so the address is the native submission this entry named and
the form had re-rendered under it.

**Closed 30 September 2026, in handoff 37-F, by the commit that changes `tests/matrix.cjs`'s `signIn`.**
The cause the address shows: the press reached the form before React's `onSubmit` was attached, so the
browser submitted the form natively. `networkidle` is not hydration. `tests/auth.cjs` already guarded
its own controls by waiting for `data-theme` on the document element, which every auth route's
`useTheme` stamps in an effect, and `signIn` did not. `hydrated(page)` now lives in `tests/matrix.cjs`,
`signIn` and the width arm's sign-in call it after the goto, and `tests/onboarding.cjs`'s and
`tests/mount.cjs`'s `signInTo` call `M.hydrated`. The screenshot this entry owed is superseded by the
`FAILSTATE` reading; a further `/sign-in?` after this commit is a new entry.

---

## G141. Pane's toolbar names no pressed state, so the surface writes `aria-pressed` on the part's Share

**Severity: low. Opened 27 September 2026 during handoff 34-A (item 7), filed under ruling 597. The
number is assigned by this entry (ruling 638).**

1156, with the founder's amendment to the 1164 release, makes the pane toolbar's Share the share
view's toggle: it carries `aria-pressed` while the view shows. Strand's Pane at `v1790410319010950`
draws that control as an `IconButton` marked `data-tool="share"` and forwards nothing else to it, no
pressed prop and no pressed look (`src/components/strand/Pane.tsx:416` to `418`). So
`DiscoverySurface` writes `aria-pressed` on the part's own button, reached as
`[data-pane-toolbar] [data-tool="share"]`: true while the view shows, false otherwise. 844 is the
precedent for reading a part's DOM where the part names no hook. React leaves an attribute it does not
manage in place, and the surface writes it again on every render that could change it.

What it costs. The state is announced and not drawn: the part's Share looks the same pressed and
unpressed, apart from its hover and focus rendering. A redraw of the part's toolbar on a render the
surface's effect does not follow would drop the attribute until the next write.

Owed: a Strand correction giving Pane's toolbar tools a pressed state, as a prop and a look. Once it
lands, the surface passes the prop and the DOM write goes.

---

## G142. `tests/rsvp-drift.cjs` prints FAIL and exits 0 — closed (handoff 35-A)

**Severity: medium. The step that exists to go red on a derivation that drifts (ruling 1002) stays
green when it finds one. Opened 27 September 2026 during handoff 34-A, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Three of the arm's failure paths set `code = 1` and `return` from inside the `try`
(`tests/rsvp-drift.cjs:92` to `93`, `:125` to `126`, `:130` to `131`). A `return` there runs the
`finally`, which closes the client, and leaves the async function, so `process.exit(code)` at `:149`
is never reached. Node then exits on its own with status 0, and the workflow step `RSVP edge drift
(ruling 1002)` in `pages.yml` reads green. Only the path that throws, `code = 1` in the `catch`,
reaches the exit.

What it hid. On run 382, the live job on `8e31309` after Chat's seed under 1165, the step printed
ten `FAIL going without an edge` rows, one per seeded registration with no `event_rsvp` edge beside
it. It exited 0. The disagreement reached a red reading only through the live-checks arms that read
the drift function themselves (handoff 30-D's claim arm). The seed itself is Chat's and is reported
on the PR (#71). This entry is the arm's exit.

Owed: the three failure paths reach the exit with their status, and the step goes red on a
disagreement. A one-line change in the test, outside 34-A's scope, so it is filed rather than made
here.

**Closed 28 September 2026, in handoff 35-A item 1, by `7d98e99`.** `process.exit(code)` moved into
the `finally`, after the client closes, so a `return` from the `try` reaches it with its status; the
messages are unchanged. Proved once with a scratch stub of `pg` answering one drift row: the arm
printed its FAIL and exited 1, and exited 0 on `84d1f2c`. The stub is not committed, since a fake
client proves the path runs and not that the arm passes.

---

## G143. A live-db block whose presence probe fails reports one name UNPROVEN and drops every other arm in it — closed (handoff 35-A)

**Severity: medium. Arms that cannot run vanish instead of reading UNPROVEN, which is the failure mode
ruling 228 exists to prevent. Opened 27 September 2026 during handoff 34-A, filed under ruling 597.
The number is assigned by this entry (ruling 638).**

`tests/live-db.cjs` opens each block with a presence probe, `to_regprocedure` on the function the
block reads. When the probe answers null the block calls `skip(names.x, why)` for its first arm's
name alone and returns. Every other arm in the block is recorded by a bare `record(...)` with a label
of its own, so none of them is reported at all: not FAIL, not UNPROVEN. On run 382 the Discovery
block's probe named `convene_discovery`'s eight-argument signature, which 20260926170300 drops. Of
the block's nineteen arms it reported one UNPROVEN, its first, and the other eighteen were absent from
the job's count, which read 141 of 143 (job `108539886763`). Handoff 34-A moves that probe to the
nine-argument signature, so the block runs again. The mechanism is unchanged in this block and in
the others built the same way.

Owed: a block that cannot run reports every arm it carries as UNPROVEN with the probe's reason, for
example by naming its arms up front in `names` and skipping each, so a missing function reads as the
coverage it removes.

**Closed 28 September 2026, in handoff 35-A item 2, by `6d18b20`.** The three blocks that open with a
presence probe are attend (`to_regprocedure` on `event_page` and `event_public_page`), guest and claim
(the guest path's three functions) and Discovery (`convene_discovery`'s signature and its recorded
version). Every arm of each is now a key in `names`, under the block's prefix, and every `record` in
those blocks reads its label from there; `armsOf(prefix)` lists a block's arms, so a probe that fails
skips each with its reason, and the attend block's two early returns after the probe skip the arms
they leave unreached. `tests/live-checks.cjs` prints `arms named: N passed, F failed, U unproven`,
where the total is the same whichever way a probe answers. Read against a scratch stub of `pg` whose
probes all answer null (not committed): the three blocks report 34 arms UNPROVEN where `84d1f2c`
reports 4, and every key with a block's prefix is reached by a `record`. Push 1's first live job did
not show the probe failing, since the probe still named the nine-argument signature and `20260926170400`,
both then on the project, and it straddled Chat's apply. Its re-run, run 387 attempt 2 (job
`109168680013`, 28 September 2026, on `0f86bf5` after both migrations were recorded), did: the Discovery
probe found the nine-argument function gone, the block's 26 arms read UNPROVEN with the probe's reason
and the total read `172 arms named: 143 passed, 0 failed, 29 unproven`, the same 172 as the first job's
`169 passed, 3 unproven`. The three other unproven arms are the ones that read UNPROVEN before this
change.

---

## G144. At medium, a centred lens bar leaves less than 140 beside it below a viewport of about 905 — closed (ruling 1171)

**Severity: low. A reading of B9-SPEC Revision 6 that the geometry forced. Opened 27 September 2026
during handoff 34-A (item 5), filed under ruling 597. The number is assigned by this entry (ruling
638).**

B9-SPEC Revision 6's medium line puts the search field in the lens row, "taking the width left beside
the bar, 140 to 280" (1124), and its Lens bar line keeps the bar centred at medium and expanded
(1145). The bar's width is its five words', 561 in Chromium at every width measured. The row is the
canvas less 32 on each side. A centred bar leaves `(row - 561) / 2 - 12` beside it: 7 at 640, 59 at
744, 97 at 820 and 199 at 1024. So from 640 to about 905 no reading gives the field 140 beside a
centred bar, and below about 725 not even beside a bar at the row's start.

What the tree does. `LensRow` in `src/components/dna/DiscoverySurface.tsx` measures the laid-out row
and bar on every render and resize. Where a centred bar leaves 140 beside it, the field sits there at
its end, 140 to 280, which is every expanded width. Where it does not, the field takes its own line
under the bar, centred at up to 280, so 1145's centring holds and the bar is never squeezed. The
discovery search arm reads the field beside the bar at 1280 and under it at 820.

Owed: a ruling on the field's place at medium where the width beside a centred bar is under 140,
whether that is this line under the bar or another.

**Closed 27 September 2026, in handoff 34-A's addendum item C, under ruling 1171.** Where the bar, a
12 gap and a 140 field do not fit side by side in the lens row, the field takes its own full-width row
under the bar, as at compact. With 1170 the bar and the field centre together as one unit on the line
the header's five Cs centre on, so the fit is measured on the width available to a unit centred on
that line: the row's width less twice the line's distance from the row's centre. `LensRow` in
`src/components/dna/DiscoverySurface.tsx` measures the row, the bar and the dock, and measures again
when any of them resizes. At medium the dock is the fixed one and its Cs centre on the viewport, so
the flip is where the row's width reaches the bar's 560.77, the gap and 140: the field sits beside
the bar from a viewport of 777 and under it at 776, read in Chromium after the fonts settle. The
discovery facets arm reads the unit at 820, 1280 and 1440 and the search arm at 820 and 1280.

---

## G145. `event_delivery` and `event_host_settings` carry direct write grants that are `publish_post`'s own permission, a second door for a host

**Severity: low, an invite-boundary gate under prototype posture (ruling 140). Opened 28 September
2026 during handoff 35-A, filed under ruling 597 and split out of G61. The number is assigned by this
entry (ruling 638).**

`public.publish_post` is security invoker, so it writes `public.event_delivery` and
`public.event_host_settings` as the member, and `authenticated` holds INSERT, UPDATE and DELETE on
both tables so that it can (`event_delivery_host_all` and `event_host_settings_host_all`,
`20260916120100_p1_convene_place_columns.sql`). Those grants are the one write path's own permission,
and they are also a way in that skips it: a host can write their own event's delivery rows through
PostgREST without passing through `publish_post`, held shut only by the host predicate in the policy.
Under the one-write-path absolute that is a second door on each table.

What it costs today: a host can change the physical, meeting-link and capacity rows of their own event
without the checks `publish_post` makes, and nothing else, since the policy limits each to the host's
own event.

Owed: a ruling, then one migration from Chat. Closing it means making `publish_post` security definer
first, so that it no longer needs the member's own write grants, and only then revoking INSERT, UPDATE
and DELETE on both tables from `authenticated`. Revoking first would break publishing.

---

## G146. `src/lib/database.types.ts` is regenerated by hand, and nothing checks the file against the project

**Severity: low. Opened 28 September 2026 during handoff 35-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Found while regenerating for item 8. The Supabase MCP's `generate_typescript_types` returns the types
as one unformatted line of JSON text, without the file's header, and without the `Views` helper at the
end, which the generator drops and CLAUDE.md says every regeneration restores. Formatted with the
pinned prettier and compared with the tree, the generated text differed from `database.types.ts` in
three ways only: prettier's own line-breaking of a few long unions, `Json`'s layout, and the one
change item 8 needed, `p_without?: string` on `convene_discovery`. That agreement is what makes the
file's header claim true today, that nothing in it is hand-written but the header and `Views`.

What it costs. The regeneration is a manual procedure with two hand steps, the header and `Views`,
and the file's header is prose that goes stale: it still describes the file as taken after handoff
34-A's migrations and does not name `p_without`. Nothing in the harness compares the file with the
project, so a migration that changes a signature or a column reaches the types only when someone
regenerates, and a `Views` restore that is forgotten breaks `src/lib/feed.ts` at the typecheck, not at
the regeneration. This branch took the one line by hand rather than replacing the file, because a
whole-file replacement would have carried the prettier differences into the diff.

Owed: a script in `scripts/` that regenerates the file, formats it, and restores the header and
`Views`, and a check that fails when the result differs from the tree, in
`tests/migration-drift.cjs`'s shape.

---

## G147. The matrix's "no page errors" arms record a failed request's status and not its URL — closed (handoff 35-C)

**Severity: low. Opened 29 September 2026 during handoff 35-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

The arms that watch a page for errors push `m.text()` for every `console` message of type `error`,
except fonts and connection resets (`tests/matrix.cjs`, and the same line in the other suites that
copy it). For a subresource that fails to load, that text is Chromium's own "Failed to load resource:
the server responded with a status of 500 ()", which names the status and not the request. So a red
"no page errors" check cannot say which URL answered 500, whether it was the mock, the deployment or
a third party, and the failure has to be attributed from the logs around it or not at all.

What it cost. Run 390 on `9424c5d`, attempt 1: `matrix (chromium)` passed 6963 of 6964 and failed
`chromium-360x800-light no page errors` with that message. The arm is the first Feed arm of the run
and loads no Discovery route. The one re-run of the failed job passed 6964 of 6964, with webkit, live
and deploy from attempt 1 on the same head. The 500 was not attributed: the artifact could not be
fetched from the session that read the run, and the message carries no URL. It is recorded here as
unexplained, neither called a flake nor traced to this PR.

Owed: the check's message carries the request's URL, from `m.location().url` on the console message
or a `response` listener for statuses of 400 and above, so the next failure of this kind names what
failed. Nothing about the arms' pass conditions changes.

**Closed 29 September 2026, in handoff 35-C, by `8a24bc2`.** Every console `error` the five suites'
listeners push now reads `<url> <text>`, the URL first so the arms' `slice(0, 300)` cannot cut it off,
from `m.location().url`. Chromium fills the location on a real 500 (probed first: the URL, line 0),
so the `response` listener added beside it does not fail an arm; it only records `METHOD status URL`
for statuses of 400 and above, and stands in for the URL where an engine gives the message none,
prefixed `(last failed response, unconfirmed)` because it can name a different request from the one
that raised the message; a URL from `m.location()` carries no prefix. No
pass condition changed, and the exclusions are as they were. Proved once with a scratch page whose
mocked route answered 500 and then 502, on Chromium only, since WebKit could not be installed in the
session (the Playwright download hosts are outside the network allowlist): the arm's message named
`https://mock.example/rest/v1/members?select=id&status=500` and `...status=502`. WebKit's location on
a failed subresource is unproven here and is read from the first WebKit failure of this kind. The
scratch is not committed.

---

## G148. `webkit-390x844-light-discovery-facets` timed out in `page.waitForURL` on run 391 attempt 1 and passed on re-run, not root-caused

**Severity: low. Opened 29 September 2026 at the start of handoff 35-B, filed under ruling 597 on the
closing note of PR #72. The number is assigned by this entry (ruling 638).**

Run 391 on `e70d59c`, attempt 1: `matrix (webkit)` failed
`FAIL [no crash] webkit-390x844-light-discovery-facets flow TimeoutError: page.waitForURL: Timeout
10000ms exceeded.`, with the call log reading only "waiting for navigation until load". The arm
emitted 8 of its 19 declared checks before it stopped, so ruling 292's check named it UNPROVEN (228)
and the 11 checks behind the failure never ran. The same job's other failure was classified, a web
process lost in `webkit-1280x800-dark-event-flows` (G5), and this one was not: the failed-arm
classifier counted it among the 2 unclassified, and it is not behind a crash. The one re-run of the
failed job (attempt 2, same head, same deployment) passed, and so did every other job from attempt 1.

What is not known. Which of the arm's `waitForURL` calls (`tests/discovery.cjs` 1689, 1748, 1784 and
1817 are the ones inside `runDiscoveryFacets`) timed out: the 8 emitted checks and the log's
"until load" wording do not say, and the artifact `matrix-webkit-run-391` was not read by the
session that filed this. Whether the URL never changed (a click on a facet option that did not
register at 390 wide on WebKit) or changed to a value the predicate did not match is likewise not
known. It is recorded as unexplained, neither called a flake nor traced to a change: run 391's head
touched only `tests/matrix.cjs` and `docs/GAPS.md`.

Owed: read the artifact's screenshot and the arm's recorded URL for the timed-out call, and give the
four `waitForURL` calls in this arm a message that names the URL they were waiting for and the URL
the page held when they gave up, so the next failure of this kind says which call and what the page
was doing. Nothing about the arm's pass conditions changes.

---

## G149. On Discovery, the five Cs sit 0.84px left of the viewport's centre from 1025 to about 1026

**Severity: low. Opened 29 September 2026 during handoff 35-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Ruling 1190's row is three tracks with the controls' width (148) reserved on both sides. On Discovery
the header's row takes 5% of the viewport each side (1123), so at 1025 it is 922.5 wide and the dock
between the tracks is 610.5. The dock is 48 of padding, five faces of 99.95, 102.39, 120.23, 115.47
and 94.13 (532.17) and four 8 gaps (32): 612.17, which is 1.67 more than the track. `space-evenly` with
negative free space falls back to start alignment, so the five Cs' box runs 1.67 to the right of its
track and its centre reads 0.84 off (measured 0.8359 at 1025 and 0.0078 at 1040, on Chromium against
the built worker). The faces are whole and inside the header's row, each 44 tall, and the Feed at 1025
reads 0.04 off because its row is 961 wide. The band is where 0.9 of the viewport less 892.17 is
under 32, that is a viewport under about 1026.9, so 1025 and 1026.

Not fixed: it needs the dock's padding or gap to give at expanded's floor, which changes the faces'
spacing the handoff holds still, and the band is two pixels wide. The axis arm (`runDiscoveryAxis`)
holds the four widths the handoff names and does not read 1025.

Owed: the dock keeps `justify-content: space-evenly` and gives its side padding first below the
width where the faces and the gaps stop fitting, or the reserved track is the controls' measured
width and not the constant.

---

---

## G150. The console-error listener is copied across five suites

**Severity: low. Opened 29 September 2026 during handoff 35-C, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`grep -n 'page.on("console"' tests/*.cjs` finds the same listener in `tests/connect.cjs`,
`tests/discovery.cjs`, `tests/matrix.cjs`, `tests/mount.cjs` and `tests/profile.cjs`: each keeps its own
ignore pattern (`IGNORED_CONSOLE` in four, an inline regex in the matrix) and, since handoff 35-C, its own
`failedResponses` list. G147 was closed by editing all five, and the next change to what a page error
is will need the same five edits, with nothing to say when one copy drifts from the others.

Not fixed: the handoff asked for the copies to be extended and for the duplication to be filed, not
refactored.

Owed: one listener in a shared module that each suite's ignore pattern is passed to, and a check that
no suite listens for console errors on its own.

---

## G151. Every Sheet opens the wrong way and snaps to rest, in WebKit and in Chromium — closed (handoff 37-B)

**Severity: high for the member; the fix is in this PR. Opened 29 September 2026 during handoff 37-B,
filed under ruling 597. The number is assigned by this entry (ruling 638).**

The founder's two Safari recordings (29 September) show every sheet's panel moving away from its rest
position on open and then snapping to it: the composer's drawer at 1278 rests with its left edge at
640, runs to the window's left edge over about 270 ms and jumps back; the compact composer, Discovery's
Filters and the event page's Share rise past the top of the window and drop. Ruling 1201's candidate (a
style flush before `shown`) and handoff 37-B's first reading (the top layer) were both wrong, and
`tests/sheet.cjs` read the motion from painted pixels on both engines before anything was changed:
on pages.yml run 398 (`8d798cf`, deployment `3de853a7`), WebKit painted the 1280 drawer's left edge
at 640, 640, 637, 214, 166, 104, 64, 24, 8, 0 and then 640 over eleven 40 ms frames, and the 430
composer sheet's top at 420, 420, 10, 670, 644, 574, 486, 452, 424, 413 and then 186; Chromium
painted the 2560 drawer at 1280, 1234, 1072, 1016 and back to 1280, and its drawers at 820 and 1280
at rest from the first frame with no slide at all. Every other arm of the run's 372 per engine passed.

Cause, isolated by bisecting the real `Sheet.tsx` in a harness and proved by reading the dialog's
scroll offset per frame: `dialog.strand-sheet` had `overflow: hidden`, which makes the dialog a scroll
container, and the focus on open scrolls its target into view. The panel is translated its own size
off screen when that focus lands, so the dialog scrolls by exactly the transform's offset to reach it
(`scrollLeft` 639 with `translateX(639px)` on every frame at 1278), and the panel is painted at layout
plus transform minus scroll, which is the transform alone, until the transition ends, the overflow
vanishes and the offset clamps back to zero. On the top-layer path `showModal()`'s own focusing steps
do the scrolling before the component's focus effect runs; on the `contained` path (Filters) the
component's focus does it, and with no scroll container of its own it would scroll the ancestor.
That is also why `getBoundingClientRect` and the paint disagreed (item 5 of the handoff's Update): the
geometry includes the clamped offset on the same frame and the compositor applies the previous one.

Closed in this PR by two lines in Sheet's own code: `overflow: clip` on `dialog.strand-sheet`
(clips the same, is never a scroll container) and `focus({ preventScroll: true })` in the focus-in
effect. Read by `tests/sheet.cjs` on both engines after the change; the arrays are in the PR. The fix
lands in the tree first and is carried back to Strand as correction 35, as 604 did for tokens.

---

## G152. The contained Sheet's scroll lock locks its parent element, not the shell's scroller

**Severity: low. Opened 29 September 2026 during handoff 37-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`Sheet.tsx`'s scroll lock sets `overflow: hidden` on `document.documentElement` and `body` for the
top-layer path and on `d.parentElement` for the `contained` path. Discovery mounts FacetRail's compact
Filters Sheet inside `[data-first-row]`, a flex row that scrolls nothing, so the lock lands on an
element whose overflow does not matter and the shell's own scroller under the sheet keeps scrolling.
Seen while bisecting G151, where a scrolled ancestor was one of the readings; not the founder's
report, and not changed here.

Owed: the contained path locks the nearest ancestor that actually scrolls (the shell's scroller under
ruling 104), found the way the wheel handler already finds a scroller, or the caller names it.

---

## G153. FacetRail's compact Filters Sheet closes by unmount, with no exit transition

**Severity: low. Opened 29 September 2026 during handoff 37-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/components/strand/FacetRail.tsx` renders `{open && <Sheet open …>}`, so closing sets `open`
false on the parent and unmounts the Sheet at once: the 300 ms exit every other sheet runs never
starts. `tests/sheet.cjs`'s exit check on the Filters arms passes with zero painted frames, because
"gone" is the whole of what it can read there. Not the founder's report and not changed here.

Owed: FacetRail keeps the Sheet mounted and passes `open` through, so its exit is Sheet's exit and the
arm reads it.

---

## G154. One WebKit exit frame read the drawer's edge at 1000 after 1277, then gone

**Severity: low. Opened 29 September 2026 during handoff 37-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

On pages.yml run 399 (`053f7d0`, the fix head), `webkit-1280x800-dark-sheet-composer` painted its
exit at 640, 642, 1046, 1096, 1130, 1184, 1235, 1264, 1277 over nine 40 ms frames and then, on the
tenth, 1000, and on the eleventh nothing, so the exit check read one frame turned back toward rest.
Every other exit of the run's eighteen sheet arms, and every exit of run 398's, ran one way. A
position of 1000 lies between the second and third frames of the same exit, and the panel unmounts
at the end of its 300 ms transition, so the frame is consistent with a screencast frame delivered
late and written in arrival order, and with nothing the component does. Not root-caused: the video
is in run 399's artefact under `sheet-video/`, and the arm stays strict rather than learning to
forgive a single frame, because the enter's real excursions at 430 were single frames too.

Recurred on run 400 (`5f9055a`), `webkit-820x1180-light-sheet-composer`: 663, 695, 720, 768, 797,
808, 818, then 638, then gone. The geometry record of the same exits answers it: the late frame
equals the exit's first moving frame in the geometry to the pixel (637.2 at 106 ms after Escape
painted as 638; 1003.6 as 1000 on run 399), and that frame is missing from the video's own order,
whose first moving frames read 663 and 1046. WebKit's screencast delivered the exit's first frame
last. `judgeExit` in `tests/sheet.cjs` now names such a frame by that match (the last painted frame,
followed by nothing, reading back toward rest within two chroma blocks of an earlier geometry reading
of the same exit) and leaves it out of the judgment; it stays in the record as `late=`.

Owed: why WebKit's screencast holds the first frame of the exit back, which nothing here reads.

**Closed 29 September 2026, in handoff 37-D item 8, by the commit that changes `tests/sheet.cjs`'s
`judgeExit`.** Run 407 (id `36604862039`, head `a969789`) went red on `webkit-390x844-light-sheet-composer`
exit: painted `840:168 ... 1160:839, 1200:346`, gone at 1240, against a geometry-exit record of
`... 63:354.7 ...`. The G154 rule missed it because it wanted a sample within two chroma blocks (4 px)
and 346 is 8.7 px from the nearest one: the sampler runs once per animation frame, about 16 ms apart,
which mid-slide is 70 to 140 px, so a video frame taken at another instant is rarely within a block of
a sample and is always between two. G154's two matches (637.2 as 638, 1003.6 as 1000) sat at the ease's
tail where the samples are dense. `reordered` in `tests/sheet.cjs` is the rule the enter shares (G160), narrowed by Chat after the first
draft matched almost any position inside the motion. A frame is excused only in WebKit (Chromium is fully
strict); when the geometry record over the same motion is itself one-way (a reversal there is real motion
and fails); when it is the first frame that moves the wrong way and removing it leaves the painted series
one-way; when it lies between two consecutive samples and is not past rest; and, on an enter, when the
series without it ends at the geometry's rest. One frame per arm, and one arm per engine per run may use
the allowance: the first arm to use it holds it and a second arm's frame fails. The excused frame, its time
and its bracketing samples are printed in the arm's detail, pass or fail. Proved against the recorded
series in a scratch that is not committed (results in PR #77's body).

**History, 29 September 2026 (handoff 37-C).** Run 413 (PR #77, head `704e745`) excused one WebKit frame
under the narrowed allowance, on `webkit-2560x1440-light-sheet-composer`'s exit, reading 2408 at 1240 ms
between geometry samples 1839 and 2410.7. That is a third sighting of the late frame, at a new width.

**Reopened 30 September 2026 (handoff 37-F item 4, ruling 1240), on five sightings the allowance was
never sized for.** Two on `pages.yml` run 419 attempt 1 (job `109677764743`, head `af5a3f1`):
`webkit-390x844-light-sheet-composer` exit `840:168,880:168,920:391,960:509,1000:530,1040:680,1080:754,
1120:802,1160:830,1200:839,1240:381,1280:-` read `late=1240:381` between geometry samples 168.8 and
389.2 and held the engine's allowance; `webkit-820x1180-light-sheet-composer` exit `800:328,840:328,
880:328,920:660,960:697,1000:718,1040:758,1080:793,1120:808,1160:-,1200:644,1240:-` was refused by name
("the reorder allowance is not available to this arm, held by webkit-390x844-light-sheet-composer") and
the job went red; attempt 2 (job `109692136301`) read the 390 cell's `late=1240:381` again and the 820
cell clean. Three on run 423 attempt 1 (PR #79, head `d969a2e`, job `109763342596`):
`webkit-390x844-light-sheet-composer` exit `... 1160:834,1200:390,1240:-` read `late=1200:390` between
168.8 and 397.4 and held the allowance; `webkit-1280x800-dark-sheet-composer` exit `880:559,920:559,
960:560,1000:1064,1040:1107,1080:1172,1120:1232,1160:1262,1200:1274,1240:1034,1280:-` and
`webkit-430x932-dark-sheet-share` exit `800:187,840:346,880:499,920:550,960:746,1000:826,1040:884,
1080:914,1120:930,1160:322,1200:-` were refused by name, three in one run, and the job went red. Every
one is the same shape: the last painted frame, followed by nothing, reading a position the exit had
already passed, matching an early geometry sample. The frames come from WebKit's screencast, not from
the page (1236): the geometry record of every one of these exits is one-way.

**Closed 30 September 2026, in handoff 37-F item 1, by the commit that changes `tests/sheet.cjs` (rulings
1236, 1240).** On WebKit the sheet arms no longer decode video. The session installs Playwright's clock,
clicks the trigger, pauses the panel's transform transition as soon as it exists and steps its
`currentTime` from 0 to 300 ms inclusive in 1000/60 ms steps, screenshotting the band at each step; the
exit is Escape with the clock paused first, so Sheet's `setTimeout(SHEET_DUR)` is held until the last
step is read, then run, and the panel's detach is asserted. A stepped series is read at instants the arm
chooses, so it cannot deliver a frame out of order, and the screenshots are lossless, so the tolerance
is 0.5 CSS px. `ALLOWANCE`, `reordered`, `excused` and the `allow` plumbing are deleted; Chromium keeps
its video, its chroma-block tolerance and its assertions, and never had the allowance, so nothing there
changes. Read first on Chromium with the probe override `SHEET_METHOD=stepped` against a local
`wrangler pages dev` of the build, every sheet cell: nineteen steps per motion, step 0 off the edge, the
exit's timers held through all nineteen steps and the panel detached once they ran (the readings are in
PR #81's body). Then on WebKit itself, the Mac port, in `pages.yml` run 427's `webkit-macos` job
(`109814308566`, head `a6cebea`): all nine sheet arms passed, every exit one-way to the edge with the
timers held, for instance `webkit-1280x800-dark-sheet-composer` exit `[0:559,16.7:585,33.3:702,50:851,
66.7:956,83.3:1031,100:1086,116.7:1129,133.3:1164,150:1191,166.7:1214,183.3:1232,200:1246,216.7:1257,
233.3:1266,250:1272,266.7:1276,283.3:1279,300:-]`, the cell whose video exit run 423 had refused. The
Linux WebKit readings are the enforcing run's, cited in the PR.

---

## G155. Headless WebKit at 2560 by 1440 on the runner paints no frame of Sheet's 300 ms transition

**Severity: low. Opened 29 September 2026 during handoff 37-B, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`webkit-2560x1440-light-sheet-composer` on pages.yml run 402 (`c9ea761`): the geometry sampler read
the panel at 2560 (its hidden position) on four animation frames to 254 ms after the click, then no
animation frame at all until 558 ms, where it read 1280, at rest, with the transform already `none`;
the video painted nothing until 560 ms and then rest. The main thread ran no frame while the whole
300 ms transition played, so no frame could show the slide, and the check "the first painted frame
after the click is not at rest, so the slide ran" failed with nothing to read. On runs 399 to 401
the same cell passed only because the hidden edge stayed painted for three frames before the same
jump to rest: the slide was not rendered on any of them. Chromium at 2560 paints it in ten frames.
This is the runner's rendering capacity at that surface and not the component: the geometry shows
hidden then rest with no excursion, and the fix's arrays at 820 and 1280 on WebKit are one-way slides.

`tests/sheet.cjs` now records that check as UNPROVEN under ruling 228 where the geometry shows the
gap (the last frame off rest and the first at rest the transition's duration apart), never as a pass
and never as a failure; the other checks on the cell judge the frames that exist.

Owed: the 2560 slide on WebKit read on hardware that renders it, which is the founder's Safari check
of Done Means 3, or a runner that can.

**Closed 30 September 2026, in handoff 37-F item 1 (rulings 1236, 1240).** The stepped method does not
depend on the engine running an animation frame while the transition plays: the transition is paused and
its `currentTime` set per step, and each step is screenshotted, so the frame exists because the arm asked
for it. Read on WebKit on macOS by `pages.yml` run 427's `webkit-macos` job (`109814308566`, head
`a6cebea`): `webkit-2560x1440-light-sheet-composer` enter `[0:-,16.7:2533,33.3:2416,50:2267,66.7:2162,
83.3:2087,100:2032,116.7:1989,133.3:1954,150:1927,166.7:1904,183.3:1886,200:1872,216.7:1861,233.3:1852,
250:1846,266.7:1842,283.3:1839,300:1839]`, rest 1839, the slide read in eighteen painted steps; exit
`[0:1839,16.7:1865,...,283.3:2559,300:-]`, timers held and the panel detached. The unprovable branch is no
longer reached on WebKit: `unpaintedTransition` in `tests/sheet.cjs` stays on Chromium's video path alone,
where the geometry sampler that feeds it still runs. The founder's Safari check (61) stays the exit
criterion for the surface itself.

---

## G156. A block's media has no store: `public.media` admits only three image types, three kinds and two image buckets

**Severity: moderate. Opened 29 September 2026 during handoff 37-A, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

Ruling 1186 says an event page's block media are held by reference to `public.media`. Read live on 28
September before `20260928120000_p2_event_blocks.sql` was written: `media_mime_check` admits `image/jpeg`,
`image/png` and `image/webp` and nothing else, `media_kind_check` admits the kinds `avatar`, `cover` and
`post`, and the rows sit in the buckets `profile-media` and `post-media`. A file, and the PDF a Resources
block would carry, cannot be a row there, so the file kind is not seeded and `event_blocks` carries no
media column: nothing is seeded that cannot be rendered, and the two departures are named in the
migration's own header.

Owed: one migration that adds a file bucket, its media kind and its mime types, and the block's media
reference together, after Strand's file part exists (ruling 1194). Item 6(i) of handoff 37-A.

---

## G157. `events.attachments` is empty on every event, named by no database function, and read by nothing in the tree

**Severity: low. Opened 29 September 2026 during handoff 37-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Read live on 28 September: `events.attachments` (jsonb) is empty on all 12 events and no function body
names it. Ruling 1186 retires it into file blocks when the file kind lands, and the file kind cannot land
in `20260928120000` (G156), so the column is not dropped there: a destructive schema change needs an
instruction naming the table (absolute), and the retirement migration is written from a list of readers,
not from an assumption. That list, from a grep of `src`, `supabase/functions` and `tests` on 29
September (main `a3a085d`):

- `src/lib/database.types.ts`: the generated `events` Row, Insert and Update types carry `attachments:
Json` and `attachments?: Json`. Generated, read by no surface by that name.
- `tests/matrix.cjs`, the mock database's two `events` row constructors (the composer's publish and the
  seeded event kinds) carry `attachments: []` to mirror the column's shape. Nothing reads the field.
- Nothing else. `src` has no component, loader or lib that reads `attachments` off an event.
  `supabase/functions` matches only Resend mail attachments (`_shared/mail.ts`'s `MailAttachment`,
  `event-mail`, `guest-rsvp`), which are unrelated to the column.

Owed: the retirement migration with the file kind (G156), dropping the column under an instruction that
names `events`, then a types regeneration and the two mock constructors losing their mirror field.
Item 6(ii) of handoff 37-A.

---

## G158. `event_media_object` serves the post's images by position and accepted parties' photos; a block image has no branch

**Severity: low. Opened 29 September 2026 during handoff 37-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`public.event_media_object(slug, kind, key)` answers the `event-media` Edge Function two things: an image
of the event's post by position, and an accepted party's photo. A block image on a public page, when an
image kind lands, has no branch there and the function's own row policy decides nothing about a block.

Owed: the branch, recorded against the same file-and-image migration as G156, so the image kind, its
store and its public-page read land together. Item 6(iii) of handoff 37-A.

---

## G159. Run 395's live job: nine place-resolve arms answered 401 on `b61830b`, unattributed

**Severity: low. Opened 29 September 2026 during handoff 37-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`pages.yml` run 395 (id `36527272574`), head `b61830b` on PR #74's branch: the live job's step 8 read
`164/173 live checks passed, 176 arms named: 164 passed, 9 failed, 3 unproven`, and all nine failures were
place-resolve arms. `a call without a JWT returns 401` passed, and the signed-in calls that follow it
passed through Cabo Verde; then the two 195-name arms broke at Madagascar and stayed broken (`every
world_countries name anchors or is unavailable`, `every world_countries name anchors to its own current
alpha-2 code`), `anchor carries the country's IANA zones` failed on the names it could not reach, and
five later arms (`Osu near Accra`, `every place carries a region`, `a nonsense string returns none`, `an
invalid session_token is a 400`, `no home and no country is unavailable without a call`, `under three
characters is none`) each answered `401 {"state":"unavailable"}` or `status 401`. The function refused a
signed-in caller partway through one run. Nothing in `b61830b` touches `place-resolve` or the JWT the
arms send. Not attributed: the function's log for that window was not read.

Not recurring: the live job passed on `7c1fa7d` (run 396, the same branch's next head), on main
`c17d1a0` (run 397, PR #74's merge) and on `c9ea761` (run 402). One run, one head, superseded.

Owed: if a second run reads the same shape, the function's own log for that window and the arms' JWT
lifetime against the step's wall-clock, before any arm is touched. Not a flake by assertion (a failing
arm is never called one); a failure whose cause was not read.

**Second sighting, 29 September 2026 (handoff 37-D, PR #77).** `pages.yml` run 412 (id `36624735921`, head
`b40046f`), `live` job `109599248223`: `place-resolve` answered HTTP 520 for Timor-Leste, so three arms
failed on that one name (194 of 195 passed): `every world_countries name anchors or is unavailable, never
a third thing`, `anchors to its own current alpha-2 code` and `carries the country's IANA zones`. A
different status from the first sighting (520, an edge-layer answer, against 401) on the same function,
one name, and `live` on main run 409 (`ff916a1`) passed all 195. The head changes no Edge Function,
migration or live-check file. Not attributed either: the function's log was not read. The failed `live`
job was not re-run, because the next push is the enforcing run's head.

---

## G160. One WebKit enter frame on the Share sheet at 390 read the hidden edge after rest, then rest again

**Severity: low. Opened 29 September 2026 during handoff 37-A, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`pages.yml` run 406 (id `36597906337`, head `2aa3587`, PR #76), `webkit-390x844-light-sheet-share`:
the enter check "the painted edge never moves away from rest between two frames (1201, 37-B)" read
`rest 168; first 687, min 168, max 687, last 168; 16 painted frames of 18 from the click; moved away
at frames 8`. The sheet's edge came from its hidden position to rest and then, on the eighth painted
frame, read the hidden position again for one frame before rest for the remainder. That is G154's shape
on the enter side: a screencast frame WebKit delivered out of arrival order and the arm wrote in the
order it arrived. G154 taught `judgeExit` in `tests/sheet.cjs` to name such a frame by its match to the
geometry record and leave it out; the enter judgment has no such match and stays strict, by G154's own
reasoning (the real enter excursions at 430 before ruling 1201's fix were single frames too).

Not this PR's: the head changes no rendered surface (types, test fixtures, a live arm and documents),
and the same WebKit matrix was green on main `a3a085d` (run 404). Every other sheet arm on both
engines passed on run 406, and the same arm passed on runs 403 and 404. The video is in run 406's
artefact under `sheet-video/`.

Owed: whether the enter judgment should learn G154's geometry match, decided with the video read, not
from this entry. The same run's `webkit-390x844-light-block-flow` lost its web process (G5's class,
reported UNPROVEN under 228) and is not a new gap.

**Closed 29 September 2026, in handoff 37-D item 8.** Run 406's `SHEET` lines: the enter's painted
series was `80:687 ... 360:170, 400:578, 440:168`, a frame at 578 between 170 and 168, against the
geometry's `123:569.5` and `106:712.1`. It is on the record's path and 8.5 px from the nearest sample,
so it would have escaped a two-block match on the exit's own rule as well, which is why 37-D's rule is
the path and not the sample, under the narrowing G154's closing note lists. `judgeEnter` names such a
frame, prints `late=`, and holds the engine's one allowance for the run. Owed: the enforcing run on 37-D's final head.

---

## G161. The tree's Sheet has no title row, so Strand's 57px header (1217, 1222) reaches only the composer

**Severity: low. Opened 29 September 2026 during handoff 37-D item 6, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Strand's Sheet renders its own header from a `title` or `onClose` prop, so its 57px change reached every
titled sheet at once. The tree's `Sheet.tsx` has no title row: each mount draws its own, and 37-D changed
the composer's alone. Measured in Chromium at 1280 by 800, light, pointer, on the mocked app, panel top 0,
721 wide; a header row is the row holding the title and the close control, border-box, so the 1px bottom
border is in it:

| Mount                                                        | Header row                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Composer (after 37-D)                                        | 57, and 57 at 390 and 820                                                                                                               |
| IntroSheet (Profile's Connect with, and Connect's Suggested) | 56                                                                                                                                      |
| GuestSheet ("I am going")                                    | 56                                                                                                                                      |
| RsvpSheet                                                    | 56                                                                                                                                      |
| RoleInvitationSheet                                          | 56                                                                                                                                      |
| ProfileSurface's C sheet ("About Connect")                   | no header row, no close control; title band bottom 112.0, title text bottom 59.2                                                        |
| OnboardingSurface's explainer                                | no header row, close is the footer "Got it"; heading bottom 71.2                                                                        |
| ConveneForm's venue-info sheet                               | no header row, no close; heading bottom 42.4                                                                                            |
| ProfileBlockControl's block sheet                            | no header row, no close; heading bottom 55.2                                                                                            |
| EventShareSheet                                              | not reachable at 1280: the event page is in Discovery's pane and Share opens the pane's own share; the Sheet mounts only below expanded |
| NotificationPanel                                            | not reachable as a Sheet at 1280 pointer: it is the 380 popover; the Sheet is touch only                                                |
| FacetRail, ConnectSurface's Filters                          | compact only                                                                                                                            |

Five mounts draw a 56 row against Strand's 57, four draw none, three are not reachable at 1280 and were
not measured. Compact was not measured on those; the composer's compact header was 53 by its padding
(0 top, 8 bottom, 44 Close, 1 border) before 37-D and reads 57 after, under Sheet's 24 px handle.

It stays a finding until the founder rules on moving the header into Sheet for every mount; 37-D changes
none of them. Measured once by scratch scripts that are not committed.

---

---

## G162. Strand's PersonCard has no static layout, and the profile's LinkRow reads handles, not URLs — closed (handoff 37-E)

**Severity: low. Opened 29 September 2026 during handoff 37-C, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Two parts the handoff named do not fit the public page as written. `PersonCard` always renders an anchor
or a button, so the public page's People (non-interactive, no profile address in `event_public_page`)
draws the card inside an `inert` wrapper under a `role="group"` that carries the name and role for a
reader (`People` in `EventParts.tsx`). `LinkRow` assumes a website URL and social handles: it gives every
non-website kind `href="#"` and prefixes an at-sign, while `private.event_presenter_profile` returns full
http(s) URLs for all four kinds, so the presenter's links reuse `LINK_KINDS` for the labels and icons and
draw their own anchors (`PresenterLinks`). Neither is changed here: Strand's parts are read from the
compile (1222), and a static PersonCard or a URL-aware LinkRow is Strand's correction to make.

**Closed 30 September 2026, in handoff 37-E items 3 and 4.** PersonCard's half: Strand's correction 35
(1230) added `readOnly` at compile `v1790724894917128`, "the same card as a plain div for display-only
contexts (the public event page's People): no button, no link, no focus stop, no hover edge", and
`src/components/strand/PersonCard.tsx` carries it as compiled (`data-readonly`, `cursor: default`, the
resting `--line` edge, `transition: none`). `People` in `EventParts.tsx` renders `<PersonCard readOnly />`
with nothing wrapped around it: the `inert` wrapper, the `aria-hidden` and the `role="group"` with its
composed label are gone, and the card's own text is what a reader reads. LinkRow's half: ruling 1232 put
the address rule in the app, not in Strand. `linkHref(kind, value)` in `src/components/dna/LinkRow.tsx`
is the one rule (a full `^https?://` URL of any kind links, a bare website is prefixed `https://`, any
other value has no address and renders as text), LinkRow and `PresenterLinks` both read it, and no
`href="#"` is rendered for a link kind anywhere. Proved by the event-blocks arm (the public page's People
carry no `inert`, `aria-hidden`, group, anchor or button; each presenter link is its stored URL in a new
tab with `rel="noopener noreferrer"`) and by the profile owner arm (the bare website is an anchor, the
two handles are `span`s), both on the deployed preview.

---

## G163. The event page reads following as a second query beside `event_page`, and the tree has two follow wrappers

**Severity: low. Opened 29 September 2026 during handoff 37-C item 11, a finding only (1226).**

`EventSurface` reads whether the member follows the host through `isFollowing` in `src/lib/event-page.ts`,
a direct `member_follows` select beside the page's one read, and writes it through `setFollow` in the same
file. `src/lib/connect.ts` carries a second wrapper of the same `set_follow` RPC, `setFollowing`. Neither
is changed by 37-C.

---

## G164. The approved public event frame's left column is a 320px literal, and Strand has no token for it — closed (handoff 37-E)

**Severity: low. Opened 29 September 2026 during handoff 37-C, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`B10-Event-Page-v2` draws the public page's left column (facts, RSVP card) at 320px with no token. The
only token in `src/styles/strand.css` that resolves to 320 is `--lane-card-width`, Discovery's lane card,
which names a different thing, and borrowing it would tie the event page's column to Discovery's card (one
axis, one meaning). The tree keeps `--pane-list-width` (360), so the left column reads 40px wider than the
frame. Owed: Strand to token the public page's left column, after which the page takes it and the
measured widths at 1536 (aside, gap `--space-8`, story) are re-read.

**Closed 30 September 2026, in handoff 37-E item 1, by `44a2903`.** Strand's correction 35 (1230) tokened
the column: `--event-page-side-column: 320px` in `tokens/spacing.css` at compile `v1790724894917128`,
"the side column of the two-column public page above --tier-expanded: `var(--event-page-side-column)
minmax(0,1fr)`, gap --space-8. Not --lane-card-width: one token, one meaning." `src/styles/strand.css`
carries it at that value, and `PublicEventSurface.tsx`'s `data-public-columns` grid reads it in place of
`--pane-list-width`. The event-blocks arm reads the aside's width against the resolved token through a
`getPropertyValue` probe and prints the readings to the run's log. Re-read on the deployed preview,
deployment `744875bf` (`https://744875bf.dna-web-application.pages.dev`), Pages run 36672353233 on
`b295ab0`, at 1536 by 960, Chromium and WebKit, light and dark, all four identical:

| Reading              | Value |
| -------------------- | ----- |
| the aside            | 320   |
| the gap, `--space-8` | 32    |
| the story            | 680   |

The story is `--content-max`, the main column 1120, so the frame's 320 column now reads as drawn and
the 40px the tree had added is gone.

---

## G165. `LINK_KINDS` is a hardcoded label map for `member_links.kind`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 7, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`LINK_KINDS` in `src/components/dna/LinkRow.tsx` (in `src/components/strand/` until 37-E) is a TypeScript
array of four `{ k, label, icon }` rows: Website, LinkedIn, X, Instagram. It covers a content vocabulary,
`member_links.kind`, the enum `public.link_kind`, which `public.vocabularies()` does not serve (its keys
were read on the canonical project during Session 38 and carry no link kinds). That is the named
anti-pattern in CLAUDE.md's fixed-vocabularies absolute: a value a member's record can hold, and a label a
surface must display for it, kept in a component file rather than read from a table at runtime. `LinkRow`
and `PresenterLinks` in `EventParts.tsx` both read it. Not changed by 37-E, which only moved the file and
gave it the address rule (1232). Owed: a `public.link_kinds` table served by `vocabularies()`, its own
migration and ruling, after which the array goes.

---

## G166. `private.event_presenter_profile` admits only `^https?://` links, a second rule beside the profile's

**Severity: low. Opened 30 September 2026 during handoff 37-E item 7, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Ruling 1225 has the presenter's line and links admitted on the event page exactly as the profile admits
them. `private.event_presenter_profile` on the canonical project (read by Chat in Session 38) returns only
links whose value matches `^https?://`, while the profile renders a bare website and handles as
`save_profile_section`'s `links` branch stores them. `public.member_links` holds three rows today, none a
full URL, so every presenter's links are empty on the event page while the same member's profile shows
three. With 37-E the app's own rule, `linkHref` in `src/components/dna/LinkRow.tsx`, decides what links
(a bare website does; a bare handle does not), so the projection's filter is a second rule in the
database that the surface no longer needs. Not changed by 37-E: the projection change is its own
migration and its own ruling.

---

## G167. Sheet: the compile shows and lays out the dialog once in a layout effect before the enter starts; the tree waits two animation frames

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). A read against compile `v1790724894917128`; `Sheet.tsx` is not
changed (1229).**

Compile, `components/core/Sheet.jsx`:

```js
React.useLayoutEffect(() => {
  // 1229: enter. The dialog is shown and laid out once at its off-edge position before paint, then the transform transitions to rest.
  if (!open) { ... return; }
  if (entered) return;
  const d = dlg.current;
  if (d) {
    if (!d.open) { if (contained) d.show(); else { try { d.showModal(); } catch (e) { d.show(); } } }
    d.getBoundingClientRect();
  }
  setEntered(true);
}, [open]);
```

Tree, `src/components/strand/Sheet.tsx`:

```ts
useEffect(() => {
  if (open) {
    opener.current = (document.activeElement as HTMLElement | null) ?? null;
    setMounted(true);
    let inner = 0;
    const id = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    ...
```

The tree has the behaviour's outcome: the panel's first paint is at its off-edge transform and the
transition runs to rest, proved frame by frame by `tests/sheet.cjs` on both engines (G151). The
mechanism differs: the compile forces one layout inside `useLayoutEffect` and flips `entered` before the
browser paints, so no frame is ever painted at rest; the tree paints the mounted panel at its off-edge
transform, then flips `shown` two frames later. Ruling 1231 records this as one of the two behaviours
Strand added beyond correction 35's brief. Chat rules on whether the tree takes it.

---

## G168. Sheet: a reopened Sheet re-enters from its edge

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile:

```js
if (!open) {
  if (entered && !reduced) setEntered(false);
  if (gone) setGone(false);
  return;
} // closed by the caller: the next open enters from the edge again
```

Tree:

```ts
setShown(false);
const t = setTimeout(() => setMounted(false), SHEET_DUR);
return () => clearTimeout(t);
```

The tree has the behaviour: `shown` returns to false the moment `open` does, so the next open starts at
the off-edge transform again whether or not the exit finished, and a reopen inside the exit window
transitions back from wherever the panel was. The compile keeps the same promise by resetting `entered`.
The second of ruling 1231's two added behaviours; filed so the report is complete.

---

## G169. Sheet: the compile's exit is driven by a `phase` prop and times itself off `--dur-slow`; the tree's is driven by `open` and a constant 300

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile:

```js
const slowMs = el => { const v = parseFloat(getComputedStyle(el).getPropertyValue('--dur-slow')); return isNaN(v) ? 300 : v; };
...
React.useEffect(() => {
  // 1229: exit. The transform returns to the edge and the panel unmounts after --dur-slow (at once under reduced motion).
  if (phase !== 'dismissing') { setGone(false); return; }
  const d = dlg.current;
  const ms = reduced || !d ? 0 : slowMs(d);
  const t = setTimeout(() => setGone(true), ms);
  return () => clearTimeout(t);
}, [phase]);
...
transform: !entered || phase === 'dismissing' ? g.off : dy ? 'translateY(' + dy + 'px)' : 'none',
transition: dy || reduced ? 'none' : 'transform var(--dur-slow) var(--ease)',
```

Tree:

```ts
export const SHEET_DUR = 300;
...
  setShown(false);
  const t = setTimeout(() => setMounted(false), SHEET_DUR);
...
  const ease = rm ? "0ms" : SHEET_DUR + "ms var(--ease)";
...
  transform: dy ? "translateY(" + dy + "px)" : shown ? "none" : hidden,
  transition: dy ? "none" : "transform " + ease,
```

The tree has the outcome (exit is the enter reversed, the panel unmounts after 300 ms, at once under
reduced motion) by a different contract: the caller flips `open`, where the compile's caller passes
`phase="dismissing"` and keeps `open` true until the panel is gone. The duration is a literal in the
tree, `SHEET_DUR = 300`, which `tests/sheet.cjs` also reads, where the compile reads `--dur-slow` off the
element at exit and cites `var(--dur-slow)` in the transition. Under reduced motion the compile starts
`entered` true and sets `transition: 'none'`; the tree sets the transition to `0ms`.

---

## G170. Sheet: the compile's `<dialog>` is the panel; the tree's `<dialog>` is a presentational scrim around a `<section role="dialog">`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile: one element carries everything.

```js
const dialog = React.createElement("dialog", {
  ref: dlg, className: "strand-sheet", "aria-label": label, "aria-busy": loading || undefined,
  onClick: e => { if (e.target === dlg.current && !contained) close('backdrop'); },
  style: { position: contained ? 'absolute' : 'fixed', inset: g.inset, margin: g.margin, width, height, ...,
    zIndex: z, ..., overflow: 'clip', ..., transform: ..., transition: ... }
}, React.createElement("style", null, '.strand-sheet::backdrop{background:var(--scrim)}'), ...)
```

Tree: two elements.

```tsx
<dialog ref={dlg} className="strand-sheet" role="presentation" data-sheet-scrim data-shown={shown ? "1" : "0"}
  onClick={(e) => { if (e.target === dlg.current) onClose?.(); }}
  style={{ position: contained ? "absolute" : "fixed", bottom: ..., height: ..., display: "flex", alignItems: ..., justifyContent: ..., background: contained ? "var(--scrim)" : "transparent", ... }}>
  <section ref={panel} role="dialog" aria-modal="true" aria-label={label} style={{ ..., transform: ..., transition: ... }}>
```

The tree's comment gives the reason: the top-layer element carries the scrim and the inert background,
the panel inside carries the dialog, so a screen reader announces one dialog and every surface keeps
selecting the panel it always selected. The backdrop click closes on both sides (the compile's target is
the dialog because the dialog is the panel and `::backdrop` clicks target it; the tree's because the
dialog is the scrim). The compile sets `zIndex: var(--z-sheet)` inline and paints `::backdrop` through an
inline `<style>`; the tree's `dialog.strand-sheet` and its `::backdrop` fade live in `src/styles/strand.css`.
Not visible to a member; visible to every test and every consumer that selects the panel.

---

## G171. Sheet: the compile lays the panel out by `tier` and `size`; the tree by `variant`, `width`, `height` and `side`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile:

```js
const GEO = {
  compact:  { width: '100%', height: 'var(--sheet-compact-height)', inset: 'auto 0 0 0', margin: 0, radius: 'var(--sheet-radius) var(--sheet-radius) 0 0', off: 'translateY(100%)' },
  medium:   { width: 'var(--sheet-medium-width)', height: '100%', inset: '0 0 0 auto', margin: 0, radius: 0, off: 'translateX(100%)' },
  expanded: { width: 'var(--sheet-expanded-width)', height: '100%', inset: '0 0 0 auto', margin: 0, radius: 0, off: 'translateX(100%)' }
};
...
function Sheet({ open, onClose, tier = 'compact', size = 'default', label, title, footer, error, loading, phase = 'rest', contained, autoFocus = true, children, style })
...
const drawer = composer && tier !== 'compact';
const g = drawer ? GEO.medium : GEO[tier] || GEO.compact;
const width = composer && tier !== 'compact' ? 'var(--sheet-composer-ratio)' : notification && tier !== 'compact' ? 'var(--sheet-notification-width)' : g.width;
const z = notification ? 'var(--z-notification)' : 'var(--z-sheet)';
```

Tree:

```ts
export function Sheet({ open, onClose, variant = "sheet", label, width, height, contained, side = "right", keyboardHeight = 0, actions, error, initialFocus, returnFocus, children, style }: SheetProps)
...
const hidden = sheet ? "translateY(100%)" : "translateX(" + (left ? "-" : "") + "100%)";
const w = sheet ? "100%" : len(width ?? SHEET_WIDTH);
const h = sheet ? (keyboardHeight > 0 ? "calc(100% - 8px)" : len(height ?? SHEET_HEIGHT)) : "100%";
```

The compile reads the tier and the named size (`default`, `composer`, `notification`) and picks every
token itself; the tree's caller picks `variant` (bottom sheet or drawer), may pass `width` (the composer
passes `COMPOSER_SHEET_WIDTH`), `height` and `side`. Ruling 605 already asks for this migration and G30
records it as unstarted; this entry is the read of the two contracts at this compile, and closes with G30. The tree has a left drawer (`side="left"`) and a
`keyboardHeight` inset the compile has no line for; the compile has `size="notification"` at
`--sheet-notification-width` and `--z-notification`, which the tree's `NotificationPanel` draws for
itself. Same geometry at rest on every tier the tree mounts; a different contract.

---

## G172. Sheet: literals in the tree where the compile reads tokens

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

| Line                | Compile                                                                                                                             | Tree                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| bottom-sheet height | `height: 'var(--sheet-compact-height)'`                                                                                             | `SHEET_HEIGHT = "80%"`                                              |
| bottom-sheet radius | `radius: 'var(--sheet-radius) var(--sheet-radius) 0 0'`                                                                             | `borderRadius: sheet ? "14px 14px 0 0" : 0`                         |
| drawer hairline     | `borderLeft: tier !== 'compact' ? 'var(--border-thin) solid var(--line)' : 0`                                                       | `borderLeft: sheet \|\| left ? "none" : "1px solid var(--line)"`    |
| drag threshold      | `parseFloat(getComputedStyle(dlg.current).getPropertyValue('--sheet-drag-dismiss')) \|\| 120`                                       | `if (dy > 120) onClose?.();`                                        |
| handle row          | `height: 'var(--space-6)'`, grip `borderRadius: 'var(--radius-pill)'`                                                               | `height: 24`, grip `borderRadius: 2`                                |
| footer              | `gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-5) var(--space-5)', borderTop: 'var(--border-thin) solid var(--line)'` | `gap: 12, padding: "12px 20px", borderTop: "1px solid var(--line)"` |
| transition          | `'transform var(--dur-slow) var(--ease)'`                                                                                           | `"transform " + SHEET_DUR + "ms var(--ease)"`                       |

Every value resolves the same today (80%, 14, 1, 120, 24, 300), so nothing is visible to a member; each
is a number written in a component for a value a token names, which is what ruling 604 and the
handoff's guardrail 3 forbid in new lines. The tree's header says the widths are "read from the
--sheet-* tokens in strand.css and never written as a number here", which is true of the widths and not
of the height. The footer's `padding-bottom` differs as well (compile `--space-5`, 20; tree 12): the
tree's action row is 8px shorter than the compile's, which is visible on every sheet with actions.

---

## G173. Sheet: focus on open lands on `[data-autofocus]` in the compile and on the heading or the first non-destructive control in the tree

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile, in the effect keyed on `[contained]`:

```js
if (autoFocus) {
  const f = d.querySelector("[data-autofocus]") || d.querySelector(FOCUSABLE);
  f && f.focus({ preventScroll: true });
}
```

Tree:

```ts
const id = requestAnimationFrame(() => {
  const explicit = initialFocus?.current;
  const heading = p.querySelector<HTMLElement>("[data-sheet-heading]");
  const safe = focusables(p).find((el) => !el.hasAttribute("data-destructive"));
  const target = explicit ?? heading ?? safe ?? p;
  if (target === heading && heading && !heading.hasAttribute("tabindex"))
    heading.setAttribute("tabindex", "-1");
  target.focus?.({ preventScroll: true });
});
```

Both focus with `preventScroll: true` (1214). The target differs: the compile takes a `[data-autofocus]`
mark, else the first focusable; the tree takes an `initialFocus` ref, else `[data-sheet-heading]` (made
focusable), else the first control without `data-destructive`, so a destructive action is never the
default target (ruling 222). The tree's `FOCUSABLE` is `a[href]` where the compile's is `[href]`. The
tree has no `autoFocus` prop. Divergent under an app ruling; a member with a keyboard lands on a
different element.

---

## G174. Sheet: the compile restores focus when `open` flips; the tree after the exit finishes, and takes `returnFocus`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile:

```js
React.useEffect(() => {
  if (!open) return;
  const prev = document.activeElement;
  return () => {
    prev && prev.focus && prev.focus();
  };
}, [open]);
```

Tree:

```ts
useEffect(() => {
  if (mounted || !wasOpen.current) return;
  wasOpen.current = false;
  restore();
}, [mounted, restore]);
```

The tree's comment records why: while the dialog is still in the top layer the browser holds focus
inside it, so a `focus()` on the opener at the moment `open` flips is a no-op and the member is left on
the sheet's last control. The tree waits for the unmount, which its showModal effect's cleanup closes on
the same commit, and takes a `returnFocus` ref or element the compile has no line for. The compile's
form runs its cleanup when `open` flips false, which is while its own `gone` is still false and the
dialog still open.

---

## G175. Sheet: the compile's `onClose` carries a reason; the tree's carries none

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile: `const close = r => onClose && onClose(r);` called as `close('escape')`, `close('backdrop')`,
`close('button')`, `close('gesture')`. Tree: `onClose?: (() => void)`, called as `onClose?.()` from the
`cancel` event, the Escape key on the contained path, the scrim click and the drag release. No caller in
the tree reads a reason. Not visible to a member.

---

## G176. Sheet: the compile consumes every wheel inside the dialog and scrolls by hand; the tree consumes at the edges only (ruling 493)

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile:

```js
const onWheel = e => {
  const target = scrollableUp(e.target, e.deltaY);
  if (target) { target.scrollTop += e.deltaY; }
  e.preventDefault();
};
const onTouch = e => { if (!scrollableUp(e.target, 0) && !d.contains(e.target)) e.preventDefault(); };
...
if (!scrim) {
  document.addEventListener('touchmove', onTouch, { passive: false });
  document.addEventListener('wheel', onDocWheel, { passive: false });
}
```

Tree:

```ts
const sc = scroller(e.target);
if (!sc) {
  e.preventDefault();
  return;
}
if (sc.axis === "x") return; // the chip row keeps its wheel
const up = e.deltaY < 0;
const atTop = sc.el.scrollTop <= 0;
const atEnd = sc.el.scrollTop + sc.el.clientHeight >= sc.el.scrollHeight - 1;
if ((up && atTop) || (!up && atEnd)) e.preventDefault();
e.stopPropagation();
```

The compile cancels every wheel over the dialog and moves the nearest vertical scroller's `scrollTop` by
`deltaY` itself, and cancels `touchmove` outside a scroller. The tree lets the browser scroll a vertical
scroller natively and cancels only at its edges, leaves a horizontal scroller its wheel (the composer's
chip row) and leaves touch to the browser, which is ruling 493's narrowing. Both lock the host's
`overflow`; the contained lock's parent is G152. A member on a pointer device feels the difference:
native smooth scrolling in the tree, per-event jumps in the compile.

---

## G177. Sheet: the compile traps Tab only when `contained`; the tree traps on both paths, from a capturing window listener

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile, `onKeyDown` on the dialog: `if (e.key !== 'Tab' || !contained) return;` then wraps between the
first and last visible focusable. Tree, `window.addEventListener("keydown", key, true)`: wraps on both
paths, and shift-Tab from the heading (tabindex -1, so never in the list) wraps to the last control.
Under `showModal()` the browser confines Tab on its own, so the outcome is the same on the production
path; the tree's explicit trap keeps one behaviour on both. Not visible to a member.

---

## G178. Sheet: the compile's body scroller, `loading` state and `aria-busy` have no line in the tree

**Severity: low. Opened 30 September 2026 during handoff 37-E item 2, filed under ruling 597. The number is
assigned by this entry (ruling 638). `Sheet.tsx` is not changed (1229).**

Compile, after the title row G161 already records:

```js
React.createElement(
  "div",
  {
    ref: body,
    "data-sheet-body": true,
    onScroll: (e) => setScrolled(e.currentTarget.scrollTop > 0),
    style: {
      flex: tier === "expanded" ? "0 1 auto" : 1,
      minHeight: 0,
      overflowY: "auto",
      padding: "var(--space-5)",
      fontSize: "var(--text-m)",
      lineHeight: "var(--text-m-lh)",
    },
  },
  loading
    ? React.createElement("p", { style: { margin: 0, color: "var(--ink-3)" } }, "Loading")
    : children,
);
```

and `"aria-busy": loading || undefined` on the dialog. Tree: `{children}` renders bare between the handle
and the status region; each mount draws its own scroller and padding, and there is no `loading` prop and
no `aria-busy`. The title row and Close control are G161; this entry is the body, the scrolled hairline
under the title (`scrolled` drives the title row's `borderBottom`), the `loading` line and `aria-busy`.
Visible to a member wherever a mount's own body padding is not `--space-5`.

---

## G179. No `docs/strand/<id>/` directory holds the bytes of `v1790664060715049`, `v1790707582513113` or `v1790724894917128`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 0, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`docs/strand/README.md` (rulings 888, 907) keeps one directory per compile, named by the id read from the
compile's own bundle, so the app Design project can be bound to a named artifact by a pinned link. The
last directory is `v1790410319010950`; the three compiles since (corrections 34 part two, its pass 2, and 35) have no directory, and the tree's parts were reconciled against two of them with no port log either
(the log for `v1790724894917128` is the first since `v1790410319010950`). Handoff 37-E did not ask for the
bytes to be committed and 37-E does not commit them; the export was unpacked in the session's scratch
space, its stamp verified, and its sections quoted into the PR body. Owed: a decision on whether the
three exports are committed under `docs/strand/` in their own change, so 907's pinned link can name the
live compile.

---

## G180. `AttestationRail` renders `href="#"` for an attestation with no address

**Severity: low. Opened 30 September 2026 during handoff 37-E item 4, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Handoff 37-E's grep for `href="#"` found one remaining site after LinkRow's rule landed:
`src/components/dna/AttestationRail.tsx` draws each attestation card as `<a href={it.href || "#"}>`, so a
card whose row carries no address is an anchor to the page top. It is not a link kind, so it is outside
1232 and 37-E's Done Means; it is the same shape LinkRow just lost. Owed: a card with no address renders
as a non-anchor, the way a bare handle now does.

---

## G181. `Checkbox` is not the compiled part: a 20px box on `--bg-sunken` with its own tick, a 15px `--ink-2` label, and no `c`

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/components/strand/Checkbox.tsx` cites no compile id, and against `components/core/Checkbox.jsx` at
`v1790724894917128` it differs on every drawn line. Compile: a hidden native input beside a drawn 22 by 22
span, `borderRadius: 6`, `1.5px solid` `--line-strong` or the C colour, `--surface` when unchecked, the C
colour or `--ink` when checked, Strand's `check.svg` at 14 in white, a 17px label in the inherited colour,
and a `c` prop that tints the box. Tree: the native input is the box (`appearance: none`), 20 by 20,
`borderRadius: 5`, `1px solid`, `--bg-sunken` when unchecked, `--ink` when checked, an inline data-URI tick,
a 15px `--ink-2` label, and no `c`. FacetRail's checklist draws its own 22px box and does not mount this
part, so the divergence reaches the profile's switches-and-checkboxes and any other `Checkbox` caller.
Not changed by 37-E (item 5 ports nothing but PersonCard). Owed: a port of the compiled part, or a ruling
that keeps the tree's drawing.

---

## G182. `LensBar` keeps LENS_BAR_SPEC's drawing over the compile's, and two behaviours differ

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Read against `components/dna/LensBar.jsx` at `v1790724894917128`. Drawing, kept by LENS_BAR_SPEC and 488:
the track is `--radius-m` with no inset hairline where the compile is a pill with `inset 0 0 0 1px
var(--line)`; the seat is `--radius-badge` at `fontWeight: on ? 700 : 500` in `--ink` with the C hue on the
glyph and `--shadow-1`, where the compile is a 999 pill at 500 in `var(--c-<c>-text)` with `0 1px 2px
rgba(26,26,24,0.08)`; the descriptor sits 12 below the track with an animated `max-height` collapse where
the compile mounts it 6 below and unmounts it. Behaviour: a tap on the active lens toggles the descriptor
and does not call `onChange` (`tap` returns early) where the compile re-opens it and always fires
`onChange`; and `collapsed` latches once (ruling 405) where the compile hides on every `true` and shows
again on `false`. Also tree-only: per-lens `disabled`, `labels` as any truthy value, `c: "brand"`, a
two-weight fit probe, `navigator.vibrate(8)`. Not changed by 37-E. Owed: Chat's confirmation that the
spec and 405 keep each line, or a port.

---

## G183. `FacetRail`'s compact sheet draws its own heading and scroller because the tree's Sheet has none

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

The compile mounts `<Sheet open onClose tier="compact" title={label} contained>{body}</Sheet>` and
Strand's Sheet draws the title, its Close control and the body scroller. The tree mounts `<Sheet open
onClose variant="sheet" label={label} contained>` around a part-drawn `h2[data-sheet-heading]` row and a
part-drawn `[data-sheet-body]` scroller (ruling 618), so at compact the Filters sheet has no Sheet-owned
Close control and the heading is the part's. The cause is G161 and G30 (the tree's Sheet contract); this
entry is the visible consequence on Discovery's and Connect's Filters. Closes with G161.

---

## G184. `MediaBlock` renders a link whose `src` is not `http(s)://` as text, where the compile renders an anchor

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Ruling 439, named in the part's header as its one kept divergence: a `kind: "link"` whose `src` does not
match `^https?://` renders as a `span` of `title || src` in `--ink-2`, with no domain line and no
thumbnail, where the compile renders `<a href={src} target="_blank" rel="noreferrer">` for any `src`. A
`javascript:`, `data:` or relative address therefore never becomes a link. Filed because the audit lists
every member-visible divergence; kept by 439, and closes on Chat's confirmation.

**No longer a divergence, 11 October 2026 (H60-MEDIA).** Compile `v1791654208929113` carries 439 itself:
its `LinkPreview` renders a link that is not a web address as a `div` marked `data-link="text"`, in both
of 1432's sizes, with no anchor. The port takes the compile's form (`docs/strand-ports/v1791654208929113-media.md`),
so the tree and the compile agree and the span of `title || src` is gone; the mount arm reads a `mailto:`
link rendering no anchor. Closes on Chat's confirmation, as before.

---

## G185. `Composer` treats medium as touch and focuses its textarea synchronously, where the compile treats medium as pointer and defers a frame

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Two lines of `src/components/strand/Composer.tsx` no ruling in its header names. Touch: the compile reads
`(mode || (tier === 'compact' ? 'touch' : 'pointer')) === 'touch'`, the tree
`(mode || (tier === "expanded" ? "pointer" : "touch")) === "touch"`, so at medium the tree shows the photo
and library picker rather than the file dialog, draws no drop hint, does not autofocus and does not bind
Cmd/Ctrl+Enter. Focus: the compile focuses the textarea in `requestAnimationFrame`, one frame after
Sheet's own focus move (ruling 641), and the tree calls `taRef.current.focus()` synchronously in the
effect, so the tree's Sheet focus (a frame later, G173) can land after it and take the textarea's focus.
Every other visible divergence in Composer is kept by a ruling its header names (458, 417, 497, 287, 74,
193, 1217). Not changed by 37-E.

---

## G186. `AppHeader`'s expanded row is the app's redesign under 99, 1175 and 1190, not the compiled part

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Against `components/dna/AppHeader.jsx` at `v1790724894917128`: the compile's expanded row is logo, a
labelled "Home" text button with a 2px underline, a spacer, a 320-wide composer pill, children, avatar,
with no bottom hairline; the tree's is logo, the five Cs inline (`PulseDock inline`), then a 44 by 44
house icon, children and avatar, on a three-track grid (`132px minmax(0,1fr) 132px`) under a 1440 cap,
with a hairline at every variant, no composer entry at expanded, a `--radius-m` entry (not a 999 pill) at
compact and medium, an 8 or 6 item gap (compile 16 or 10), a LensBar centre slot and a bell hidden while
it holds the centre at compact. Each is a ruled redesign (99 amending 78; 1175, 1190; 1000; 84). Filed so
the audit is complete; closes on Chat's confirmation that the compiled AppHeader is superseded by the
app's, or on Strand carrying the redesign.

---

## G187. `NotificationListItem` reads ruling 547's registry, ruling 461's words and ruling 490's destination line, not the compiled rows

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Compile: five kinds (`connection_accepted`, `attestation_received`, `space_role_approved`,
`event_reminder`, `role_invitation`), `' accepted your intro.'`, a second line of `time` alone, an 8 by 8
unread dot at `marginTop: 8`, Respond on every `role_invitation`. Tree: three kinds from
`NOTIFICATION_REGISTRY` (`connection_accepted`, `connection_request`, `role_invitation`; 547, G19),
`" accepted your connection request."` (461), a `data-destination-line` under every sentence (490), the
dot in a 24px `--target-min` box (480), Respond only with `onRespond`, and a composed fallback for a
`role_invitation` without `text`. Filed so the audit is complete; every line is kept by the ruling named.
Closes on Chat's confirmation.

---

## G188. `PostCard`'s feed face opens on a body tap only while the body is clamped

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Compile: the body column carries `onClick: onClick` and `cursor: onClick ? 'pointer' : 'default'`
whenever a handler is passed. Tree: `onClick={clamp ? onClick : undefined}` with the cursor likewise,
`clamp = !!onReadMore && !expanded`, so on a card with no `onReadMore` (a short post) or an expanded card
a body tap does nothing and the cursor is the default, while the compile opens it. Ruling 105's
expand-in-place ("Read more" as a link, "Show less") and 416's handle line are the feed face's other
visible divergences and are kept by those rulings; the system rung is G42. Not changed by 37-E.

---

## G189. `PulseDock`'s slots are Design pass 01's, not the compiled part

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Compile: a `CBadge` tint chip (24 in the bar, 32 in the dock) dimmed and greyscaled when off, the label
`--ink` or `--ink-3`, a 2px `--ink` underline in the bar only, `borderRadius: 10` slots, a 10px dot,
`--surface-glass` with `blur(12px)` under the dock. Tree: a bare mask glyph (20 or 26) C-coloured only
when on, the label in `--c-X-text`, a 2px C underline on every variant including the dock (W33), no
radius and a 1px hover lift, an 8px dot, `--bg` with no blur (107), safe-area left and right (344), and an
`inline` variant for the AppHeader's five Cs (99, 100). Filed so the audit is complete; every line is kept
by the ruling named. Closes on Chat's confirmation.

---

## G190. `VERB_SCHEMA` and `VERB_ACT` drop Connect and `UNTYPED` carries the Story kicker, by rulings 400, 417 and 546

**Severity: low. Opened 30 September 2026 during handoff 37-E item 5, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

Compile, in `components/dna/Composer.jsx` and `components/dna/VerbChip.jsx`: `VERB_SCHEMA.connect` is
`{kicker: 'Intro', action: 'Accept the intro', fields: [who, why]}`, `VERB_ACT.connect` is `'Make an
Intro'`, `UNTYPED` is `{kicker: null, action: null, fields: []}`, `contribute.instrument.options` is
`['Time', 'Skills', 'In-kind']`, and `convene` carries six fields and `Get a ticket`. Tree,
`src/components/strand/verb-schema.ts` and `VerbChip.tsx`: no `connect` in either (400, 417; a legacy
Connect card reads `CARD_SCHEMA.connect`, "Connection request" with no act, 157), `UNTYPED`'s kicker is
`VERB_SCHEMA.convey.kicker`, "Story" (546, W54), the instrument's options come from the vocabulary
through `fieldOptions` (193), and `convene` is `fields: []` under `forms.convene`. Filed so the audit is
complete; every line is kept by the ruling named. Closes on Chat's confirmation.

---

## G191. The secret scan of the repository's full history found no secret; one publishable key, public by design — closed (handoff 37-F item 5, ruling 1238)

**Severity: low. Opened and closed 30 September 2026 during handoff 37-F item 5, filed under rulings 597
and 1238. The number is assigned by this entry (ruling 638). An invite-boundary gate under ruling 140, not
a breach: the repository was public before 1238 made it private, and this is the record of what that
exposure contained.**

Scanned with gitleaks 8.30.0 (`gitleaks git --log-opts="--all"`, the default ruleset, values redacted at
the tool), on a clone that had fetched every branch (`refs/heads/*`, 76 remote branches including
`main`), every tag (`refs/tags/*`: none exist) and every pull request head (`refs/pull/*`: 79 heads,
`refs/pull/1` to `refs/pull/79`; GitHub keeps no `refs/pull/N/merge` for merged or closed pull requests,
so none were fetched). 492 commits reachable from those refs, of which gitleaks scanned the 394 with a
diff (it skips merge commits and empty diffs by design). Beside it, a sweep of every tree at every one of
the 492 commits for the provider shapes ruling 1238 names, printing rule, path, line and commit and never
the match: a Supabase JWT or `sb_secret_`/`sb_publishable_` key, a Stripe `sk_`/`rk_` key or `whsec_`
secret, a Resend key, a Mapbox `sk.`/`pk.` token, an Anthropic `sk-ant-` key, a database URL carrying a
password, a Cloudflare token, a GitHub token, a private-key block, an AWS access key, a Tinify key, a
service-role literal, and any quoted `password` assignment.

Findings, no value printed:

| Rule                         | Where                                                                                                                             | Commit                                                | Date              | On `main`                                                                                                                            | Class                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| gitleaks `generic-api-key`   | `.github/workflows/security-pass-02-http.yml:33`, `PUBLISHABLE_KEY:`                                                              | `57d84a4` (and `f86e254`, line 34)                    | 11 September 2026 | no: PR #28 and #30 heads, branches `claude/charming-euler-9m8a8s` and `claude/practical-bell-ikqr6e` only; the file is not on `main` | public by design: the Supabase publishable key (`sb_publishable_`), the same value the client ships                                         |
| sweep `supabase-publishable` | `src/lib/supabase.ts:13` (line 12 before `384865c`), the client's fallback                                                        | first at `a8706a4`, 6 September 2026, on `main` since | 6 September 2026  | yes                                                                                                                                  | public by design: the Supabase publishable key, served to every browser with the app                                                        |
| sweep `seeded-password`      | `src/routes/sign-in.tsx`, `src/routes/reset_.new.tsx`, `src/components/strand/PasswordField.tsx` (13 line sites over the history) | various, from `a8706a4`                               | September 2026    | yes                                                                                                                                  | false positive: every match is an `autoComplete="current-password"`/`"new-password"` attribute, an `aria-label` or a button label; no value |

No secret: no service-role key, no `sb_secret_`, no Stripe, Resend, Cloudflare, Mapbox `sk.`, Anthropic or
Tinify key, no database URL with a password, no seeded account's password, no private key, anywhere in
the history scanned. **Rotation list: none.** The Supabase publishable key is public by design and is not
rotated for this finding; the Supabase project URL beside it is likewise public.

Limits, stated so the gate is read for what it is: a clone sees only objects reachable from fetched refs,
so a commit force-pushed away on a branch, a deleted branch's objects GitHub still holds, or a pull
request's merge ref is outside this scan; the reflog is the container's, not GitHub's. GitHub's own
secret scanning, where enabled on the private repository, is the second net over what a clone cannot
reach. Nothing was committed from the scan but this entry (37-F item 5), and no history was rewritten.

---

## G192. FacetRail's contained Filters sheet unmounts on close, so it has no exit transition

**Severity: low. Opened 30 September 2026 during handoff 37-F item 1, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`src/components/strand/FacetRail.tsx` renders `<Sheet open ... contained>` inside `{open && (...)}`, so on
close the parent unmounts the Sheet rather than dropping `open`: Sheet's 300 ms exit (`setShown(false)`,
then `setMounted(false)` on a `setTimeout(SHEET_DUR)`) never runs, and the panel detaches at once. The
composer and the event page's Share drop `open` and animate out. Found by the stepped sheet arm (1236):
on WebKit its exit waits for the panel's transform transition and, for `sheet-filters`, none appears and
the panel is already gone; the video arm had read the same thing on both engines as "0 painted frames,
gone", which its exit check passes. `tests/sheet.cjs` now names the case, `atOnce=true` in the arm's
`SHEET ... exit` line and "no exit transition: the panel detached at once on Escape" in the check's
detail, and passes it as gone, because the assertion's meaning is that the exit never crosses rest and
the panel is gone, and both hold. Not changed by 37-F: nothing under `src/` is edited there (guardrail
1). Owed: either the Filters sheet drops `open` and animates out like every other Sheet caller, or the
ruling that says a contained sheet may close at once; then the arm's `atOnce` reading becomes a failure
or a rule.

---

## G193. Escape on a Sheet inside the Pane closes the Pane as well, on every engine — closed (PR #82, handoff 38-B)

**Severity: moderate. Opened 30 September 2026 during handoff 37-F item 3, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

Found by the macOS WebKit gate (1235) on its first run, `pages.yml` run 427's `webkit-macos` job
(`109814308566`) and again by `matrix.yml` run 77 (`36694192903`, `runner=macos-latest`, `SPECIAL=event
ONLY=[1280,800] THEME=dark`): `webkit-1280x800-dark-event-flows` pressed Escape on the RSVP sheet's error
state at expanded and its next step, the share control, was not found for thirty seconds. Run 77's
`FAILSTATE` line says what the page held: `/posts/post-e-loaded`, no pane, no dialog. Escape had closed the
sheet and the Pane behind it, and the Pane's close returned to the Feed card the flow came from.

Reproduced on Chromium, locally against `wrangler pages dev` of the build, in a scratch that is not
committed: open the member event page at 1280 by 800, click I am going, let the sheet focus its heading,
press Escape. The URL falls to `/convene`, no pane, no `event-share`. So it is not the Mac port; it is the
product on every engine. The mechanism, read in the tree: `Sheet.tsx` closes on the dialog's `cancel`
event and prevents that event, but on the `showModal` path it neither prevents nor stops the Escape
`keydown` itself (its window listener does so only for `contained`); `Pane.tsx`'s section `onKeyDown`
closes the pane on any Escape whose `defaultPrevented` is false (1084), and React's synthetic keydown
follows the React tree, in which the event page's `RsvpSheet` is the pane's descendant. One Escape, two
closes.

Why the arm passes on Chromium and Linux WebKit: by the arm's Escape, focus has fallen to `body`, because
the confirm button it clicked went disabled while the mocked save failed, and a keydown whose target is
`body` never crosses the pane's subtree. The same scratch, replicating the arm's exact state, reads
`active=body` before the Escape on Chromium, the pane survives, and `cancel` still reaches the sheet. The
Mac port keeps focus inside the sheet there, so the gate read the defect the flow's coincidence had hidden.
Whether Safari keeps focus as the Mac port does is the founder's device check (61); a member who opens the
RSVP sheet and presses Escape at once, with the heading focused, meets it in every browser.

Not changed by 37-F: nothing under `src/` is edited there (guardrail 1), and `Sheet.tsx` is canonical
(1229). Owed: the Sheet marks the Escape it handles as handled on the modal path too, so the Pane's
`defaultPrevented` guard (1084) sees it, or the ruling that says a Sheet's Escape may also close the pane
it sits in. Until then the gate's `webkit-1280x800-dark-event-flows` arm is red on this defect, which is
the gate doing what 1235 built it for.

**Closed 30 September 2026. The same defect as G86, opened in 32-A, and closed by PR #82 (handoff 38-B,
ruling 1251), merged as `e9cadaf`.** The Sheet handles Escape in the dialog's own React `onKeyDown`, marked
with `preventDefault` so the Pane's guard (1084) yields, on both paths; the record of the mechanism is
G86's close. The proof is the macOS gate's reading on this branch rebased onto that merge: `pages.yml` run
438's `webkit-macos` job (`110025804746`, head `4d5c136`, whose `src/` is the final head's) read `283 of
283 checks passed` across the gate's twenty arms with no web process lost, `webkit-1280x800-dark-event-flows`
among them with the four `G193` checks handoff 38-B added to the arm: the sheet closes, focus returns to
the opener, the Pane stays open, and Escape inside the Pane with no sheet still closes it. The gate that
found the defect is the gate that reads it closed.

---

## G194. The auth reveal-timing check read 1833 ms against 1066 ms on the macOS runner, then 1320 against 2106 — closed (handoff 37-F)

**Severity: low. Opened 30 September 2026 during handoff 37-F item 3, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`tests/auth.cjs`'s `webkit-390x844-light-auth flows` compares the time to reveal the reset "sent" state
for a known address against an unknown one whose mocked answer is delayed 1500 ms, within 600 ms, each in
a fresh browser; the reveal is a fixed `REVEAL_MS` of 900 in `src/routes/reset.tsx`, so the two land
together and the surface times nothing. On `pages.yml` run 427's `webkit-macos` job (`109814308566`) the
known run took 1833 ms and the unknown 1066 ms: about 900 ms above the reveal on the first of the two
browsers, none on the second. `matrix.yml` run 78 (`36694197392`, `runner=macos-latest`, `SPECIAL=auth
ONLY=[390,844] THEME=light`) ran the same arm on the same runner image and passed. Not attributed: the
extra 900 ms is on the first fresh WebKit session of that arm on a shared macOS runner, and nothing in the
arm reads where it went. The check measures wall clock from Node across the driver, the page's hydration
and the reveal, so a slow first session reads as a timed answer.

It recurred on the next reading: `pages.yml` run 430's `webkit-macos` job (`109821207415`, head
`d8cb7e4`) read `1320ms vs 2106ms`, the slow session on the other side this time. Two of four macOS
samples, alternating sides, is host noise in a wall-clock reading and not the surface.

**Closed 30 September 2026, in handoff 37-F, by the commit that changes `tests/auth.cjs`'s `sentState`.**
The interval is now read in the page: a capture listener on the form's `submit` event and a
`MutationObserver` on the sent state's insertion, both on `performance.now()`, so the driver's round trip
and a fresh session's cold start drop out of both readings; the wall clock is printed beside it as a
record, as `REVEAL <arm> known=... unknown=...`. The assertion is unchanged: the two reveals within 600 ms
of each other. On Chromium locally the page reads 908 against 909 ms where the wall clock read 1370
against 1367, which is the driver's share made visible. The macOS reading is the enforcing run's.

---

## G195. Focus inside an open Sheet falls to `body` when the focused control becomes disabled

**Severity: low. Opened 30 September 2026 during handoff 38-B item 1, filed under ruling 597. The number
is assigned by this entry (ruling 638); G191 to G194 were on PR #81's branch when it was written.**

The event-flows arm's Escape on the RSVP sheet's error state reached the page with focus on `body` on
Chromium and Linux WebKit, which is why the arm passed there while the macOS gate failed on G193
(G86): a keydown targeted at `body` never enters the Pane's subtree. The drop is in the product, not
the arm. `RsvpSheet` renders Confirm as `disabled={saving || withdrawing}` while the save is in flight,
and both engines drop focus from a focused control that becomes disabled; `Sheet.tsx` places focus
only on open (its heading, else the first non-destructive control, 222) and traps Tab, so nothing
brings focus back into the dialog when the error lands and Confirm is enabled again. The next Tab
starts from the document rather than from the sheet, against 423's trap. The Mac port keeps focus
where it was, so the founder's device check (61) may not see it.

Owed: when the element that holds focus inside the sheet loses it to `body` because it was disabled,
the Sheet puts focus back on the first focusable control, or the caller keeps Confirm focusable and
`aria-disabled` while saving, as Pane's stepping pair does (1083). Not changed by 38-B, whose one
change is the Escape guard (its guardrail 1).

---

## G196. The browser install shared the Linux matrix job's 60 minutes with the suite, so a slow apt mirror cancelled the suite with no check failed — closed (PR #83, handoff 38-C)

**Severity: moderate. Opened 30 September 2026 during handoff 38-C, filed under ruling 597. The number is
assigned by this entry (ruling 638).**

`pages.yml`'s `matrix` job had one `timeout-minutes: 60` for everything it does: dropping the Google
Chrome apt source, `scripts/retry.sh 3 bunx playwright install --with-deps <engine>`, the core-dump
setup and the suite. The install step had no time of its own, and `retry.sh` could not retry a stalled
attempt because nothing ended one. The Linux WebKit suite needs about 53 of the 60 minutes (run 436,
`109999825350`: 390 arms in 52m31s after a 73-second install), so any install past about seven minutes
left the suite less than it needs and the job was cancelled partway, which reads unproven (228) with
nothing named.

**Sightings, both on PR #81's head `420ff52`, run 439 (`36756445804`).** Attempt 1's `matrix (webkit)`
job (`110028516638`): the install step ran from 18:10:33 to 18:42:43 UTC, 32m10s, and the suite that
started at 18:42:43 was cancelled at 19:10:42 by the job's 60 minutes. Attempt 2's job (`110054085937`):
the install ran 8m22s, from 19:14:15 to 19:22:37, and the suite was cancelled at 20:14:20, 51m43s in, at
`+3217s` on the 820x1180 mount arms, with a double crash on `webkit-390x844-dark-auth flows` already
inside it that 1237 would have named at the tail the job never reached. The Chromium job passed both
times (install 29 s, suite 50m19s), and so did the macOS gate.

**Where the time went, read from the three WebKit install logs and the Chromium one.** The slow part is
the apt archive fetch inside `--with-deps`, from `azure.archive.ubuntu.com`, and never Playwright's CDN:

| Job               | apt index | apt archives                 | unpack and configure | WebKit and FFmpeg from cdn.playwright.dev | step   |
| ----------------- | --------- | ---------------------------- | -------------------- | ----------------------------------------- | ------ |
| run 436 WebKit    | 9 s       | 130 MB in 9 s (14.5 MB/s)    | 49 s                 | 3.4 s                                     | 73 s   |
| run 439 a1 WebKit | 5 s       | 130 MB in 31m47s (67.9 kB/s) | 12 s                 | 3.1 s                                     | 32m10s |
| run 439 a2 WebKit | 8 s       | 125 MB in 7m50s (266 kB/s)   | 17 s                 | 3.3 s                                     | 8m22s  |
| run 436 Chromium  | 5 s       | 34.9 MB in 5 s (6.8 MB/s)    | 5 s                  | 8 s, three downloads                      | 26 s   |

The runner image's apt is configured with `Acquire::Retries 1` and a 15-second `Acquire::http::Timeout`
(`actions/runner-images`, `images/ubuntu/scripts/build/configure-apt.sh`), which is a stall timeout and
never trips on a trickle. The image writes no `docker-clean` and leaves `APT::Keep-Downloaded-Packages`
at its default, so the fetched `.deb` files stay in `/var/cache/apt/archives` after the install.

**Third sighting, and the first reading of the bound: run 441 (`36780457917`), this branch's first
push.** The mirror served about 60 kB/s again, 10 packages and 15 MB in the 240 seconds the `matrix
(webkit)` job (`110109456142`) gave attempt 1 before `scripts/retry.sh` ended it, named it (`Attempt 1
of 3 timed out at the 240s bound`) and retried. The retry failed in a second, and so did the third:
`dpkg: error: dpkg frontend lock was locked by another process with pid 2687`. Playwright runs apt
through sudo, and sudo runs its command in a pty session of its own, outside the process group
`timeout` signals, so the cut attempt's `apt-get` outlived it and kept the lock. The step failed by
name at 4m20s, which is the outcome the bound exists for, but without the retry it promises.
`matrix.yml` run 80 (`36780595009`, `install_attempt_seconds=30`, healthy mirror) had shown the retry
working when the cut lands outside apt: attempt 1 was ended at 30 s during the WebKit download, attempt
2 found apt with nothing left to do (`0 upgraded, 0 newly installed`) and finished in 6 s, and the gate
then read 283 of 283 on Linux WebKit. Run 81 (`36781074172`, a 5-second bound) showed the leak from the
other side: attempt 1's `apt-get update` printed its `Fetched` line after the attempt had been ended,
attempt 3 met the lock attempt 2's apt still held, and the job failed by name at the install step in
30 s, having reached no test body. So each attempt now first ends the `apt-get`, `dpkg` and apt fetch
methods a previous attempt left running as root, TERM then KILL, before `dpkg --configure -a` and the
install. The same job also showed why only a complete set may be harvested into the cache: the 10 files
attempt 1 had fetched were saved under the exact key, which an exact hit never saves again.

**Owed (handoff 38-C).** The install's time separated from the suite's: each attempt bounded through
`scripts/retry.sh`, a stalled attempt ended and retried, three timed-out attempts failing the job by
name at the install step; the apt archives cached, keyed on the runner image, the engine and
Playwright's resolved version, a miss behaving exactly as before, and restored under a prefix of the
image OS and the engine alone, so a new runner image week or a Playwright bump starts from the most
recent set saved for that engine, which apt verifies file by file, rather than from nothing; the job's
budget restated per engine from the readings above, with the arithmetic in the comment over
`timeout-minutes`.

**Closed 30 September 2026 on `pages.yml` run 443 (`36782774745`, head `624e056`, whose `.github/` and
`scripts/` are the final head's; the close is the only later change).** Both Linux matrix jobs finished
inside their own budgets with every arm green and no web process lost: `matrix (webkit)`
(`110117660541`) installed in 30 s on a healthy mirror (125 MB in 9 s), ran the suite in 54m59s, 390 arms
and `7554 of 7554 checks passed`, and ended at 56m00s of its 85; `matrix (chromium)` (`110117660511`)
installed in 23 s, ran the suite in 50m29s, `7545 of 7545`, and ended at 51m18s of its 75. Each saved its
complete archive set: `Cache saved with key: apt-archives-ubuntu24-20260927.320.1-webkit-playwright-1.63.0-complete`
(187 files, 120M) and the chromium key of the same shape (14 files, 31M); both restores read
`Cache not found`, because run 442's cancelled jobs saved nothing. The bound is proven on the defect
itself by run 442's `matrix (webkit)` job (`110112903224`, head `5b25e7e`): the mirror was slow a
fourth time, attempt 1 was ended at 240 s with 24 MB of 130 fetched, attempt 2 at 240 s with 95 MB
more (`Need to get 10.7 MB/130 MB`), and attempt 3 fetched the rest and read `Succeeded on attempt 3 of
3` at 10m15s, with 195 files kept, and no lock error. The retry after a cut in the unpack window is
`matrix.yml` run 82 (`36781477756`, `install_attempt_seconds=30`): attempt 1 ended at 30 s during
`Setting up`, attempt 2 ended the leftover apt, ran `dpkg --configure -a`, found `0 upgraded, 0 newly
installed`, downloaded WebKit and succeeded at 45 s, and the gate read 283 of 283. Three timed-out
attempts failing the job by name is run 83 (`36781480713`, a 5-second bound): `All 3 attempts timed out
at the 5s bound (exit 124)`, the step red at 32 s, and the tail reading `The matrix step produced no
output; it did not reach tests/matrix.cjs.` Run 444 (`36788537363`, head `233e54a`, the same workflow)
read the same again on a runner that had rotated back to image `20260920.314.1`: `matrix (webkit)`
(`110135942000`) installed in 34 s, lost a web process on `webkit-390x844-dark profile visitor stranger`
and ran it again clean under 1237, read `7554 of 7554` and ended at 56m11s of 85 with the core
extracted; `matrix (chromium)` (`110135941861`) installed in 22 s, read `7545 of 7545` and ended at
52m28s of 75. Its restore lines also showed the fallback prefix could not match the key as first
ordered, `apt-archives-ubuntu24-webkit-` against `apt-archives-ubuntu24-20260927.320.1-webkit-…`, so
the key is reordered OS, engine, image version, Playwright in the commit after 444; the enforcing run
on the final head is cited on PR #83.

---

## G197. `private.message_requests_broadcast` sends every request update to the sender's inbox, so a decline and a recover reach the sender — closed (PR #94, handoff 41-D Addendum 1)

**Severity: moderate, an invite-boundary gate under ruling 140. Opened 3 October 2026 during handoff 41-D
Part A2, filed under ruling 597. The number is assigned by this entry (ruling 638).**

The trigger `on_message_requests_broadcast` runs after every insert and update on
`public.message_requests` and sends the row's `state` and `decided_at` to `inbox:{recipient_id}` and to
`inbox:{sender_id}` alike, read live on 3 October 2026. So when the recipient declines, the sender's own
Realtime channel carries `state: declined`, and when the recipient recovers it under 41-D's
`private.message_request_recover`, the same channel carries `state: pending` with `decided_at` null.
Ruling 157 says a declined status never reaches the sender, and 41-D's A2 header says the sender is not
told either way; the sender's surfaces read neither word today, but the payload is on a channel the
sender is authorised to subscribe to. The decline half predates 41-D; Recover adds the second word.

Owed: the sender's copy of the broadcast carries no state the sender may not see (a send and an accept
only), through a new migration that replaces the trigger function. Not changed by 41-D, which commits
its five files as Chat wrote them.

**Closed by PR #94 under handoff 41-D Addendum 1 (3 October 2026).** `20261003130500_b14d_request_broadcast.sql`
(A6) replaces `private.message_requests_broadcast` whole. The recipient's inbox still receives every
insert and update. The sender's inbox receives the insert, their own send, and the accept, when the
thread exists, and nothing for a decline, a recovery or a block. The trigger fires on `INSERT OR
UPDATE` only, read live before A6 was written. The live arm `msgdBroadcast` in `tests/live-db.cjs`
reads both inboxes from `realtime.messages` as each member inside one rolled-back transaction. It
expects the recipient's inbox to carry the insert, the decline, the recovery and the accept, and the
sender's to carry only the insert and the accept. It reports UNPROVEN until Chat applies the file.

---

## G198. `threads_live_arms_select` passes the member's id as the thread id, so `live_arms` reads no thread row

**Severity: low, harness only. Opened 3 October 2026 during handoff 41-D Part C, filed under ruling 597.
The number is assigned by this entry (ruling 638).**

The policy's predicate is `private.thread_member_in(m.id, m.id, enum_range(NULL::thread_member_state))`,
where `thread_members_live_arms_select` and `messages_live_arms_select` pass the row's `thread_id` first.
No thread's id equals a member's, so the predicate is false for every row and a direct
`select … from public.threads` as `live_arms` answers nothing. The 41-A to 41-D arms read a thread's
name and kind through `messenger_threads_view` as a test account instead, which is why nothing has
failed on it. Owed: `thread_member_in(threads.id, m.id, …)` in a new migration.

---

## G199. `private.event_thread_join` leaves `joined_seq` at 0, so with history off a joining attendee reads the thread's whole history — closed (PR #94, handoff 41-D Addendum 1)

**Severity: moderate. Opened 3 October 2026 during handoff 41-D Part A1, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

`20261003130000` inserts the attendee's `thread_members` row with `joined_at` and no `joined_seq`, whose
default is 0, and on a rejoin from `left` updates `state` and `joined_at` only.
`private.thread_invite_accept`, the other path into a thread, writes `joined_seq` as the thread's highest
`seq` at the moment of joining, and the late-joiner rule (1342) reads `joined_seq` when
`history_visible_to_new` is off. `private.event_thread_open` creates event threads with history on, so
nothing differs until a host turns history off in Manage; from then an attendee who joins through
Message reads every earlier message. The host's own row from `event_thread_open` also carries 0, which
is right for the creator. Owed: the join sets `joined_seq` to the thread's highest `seq` on insert and on
a rejoin, as `thread_invite_accept` does, in a new migration (466). Not changed by 41-D, which commits
A1 as Chat wrote it.

**Closed by PR #94 under handoff 41-D Addendum 1 (3 October 2026).** A1 was replaced in place before
it was applied, which 466 allows because only an applied file is never amended. The cause was wider
than the entry above says: `private.thread_invite_accept` already admitted a going registrant with no
invitation and set `joined_seq`, and RLS hid the thread from a non-member, so the event page could
never learn its id. The replacement `20261003130000_b14d_event_thread_join.sql` makes
`private.event_thread_join` the one event-thread join path. It sets `joined_seq` to the thread's
highest `seq` on insert and on a rejoin from `invited` or `left`. It also removes the going branch
from `thread_invite_accept`, whose invited path is unchanged. Arm `msgd` in `tests/live-db.cjs` has the
host write before each join and asserts `joined_seq` equals the highest `seq` at that moment, for a
going registrant's first join, an accepted named party's first join and that party's rejoin after
leaving.

---

## G200. `private.message_media_record`'s comment still names seven mimes after `video/quicktime` made eight

**Severity: low. Opened 3 October 2026 during handoff 41-D Part A5, filed under ruling 597. The number
is assigned by this entry (ruling 638).**

`create or replace function` keeps a function's comment, and `20261003130400` replaces the body without
a `comment on function`, so the catalogue still reads "the mime must be one of the seven" from
`20261002150000`. Owed: the comment restated with the eight in the next migration that touches the
function.

---

## G201. The Fix PR number read from this register collides with a merged Fix PR 06

**Severity: low. Opened 3 October 2026 during handoff 44's gate. Numbered by handoff 55-A under
ruling 760; filed unnumbered by Fix PR 07 (handoff 44). The number is assigned by this entry (ruling
638).**

Handoff 44 takes the next Fix PR number from the highest "Fix PR NN" this register cites, which was 05,
so 06. `docs/audit/FIX-PR-06.md`, merged in #46 on 18 September, is already Fix PR 06 (rulings 588 to
590), and the register never cites it. This PR took 07. Owed: one source for the Fix PR sequence, either
an entry here for every Fix PR or the handoff reading `docs/audit/` as well.

---

## G202. `src/components/ui/input.tsx` and `textarea.tsx` render at 14px from 768 up, and stay in the tree

**Severity: low. Opened 3 October 2026 during Fix PR 07 item 1 (ruling 1456). Numbered by handoff
55-A under ruling 760; filed unnumbered by Fix PR 07 (handoff 44). The number is assigned by this
entry (ruling 638).**

The shadcn `Input` carries `text-base md:text-sm`, which is 14px from 768 to 1023, a touch width.
Nothing renders it today; its one importer is `src/components/ui/sidebar.tsx`, which nothing imports.
Under rulings 70 and 72 no surface may use it, but if one did, 1456 would be broken on an iPad, and the
matrix's `fields` arm would only catch it on a route that arm visits. Owed: removing the unused
shadcn parts, as their own change.

---

## G203. No arm reproduces W60's masthead loop; the proof is the founder's phone (358)

**Severity: moderate. Opened 3 October 2026 during Fix PR 07 item 3. Numbered by handoff 55-A under
ruling 760; filed unnumbered by Fix PR 07 (handoff 44). The number is assigned by this entry (ruling
638).**

On the mock, at 390 in Chromium with scroll anchoring turned off, `main` at `1238947` does not loop: the
range left after condensing never drops under 96px, which is above `RELEASE_PX`. Fix PR 07's guard is
therefore proved locally only for profiles that can hold the condensed state (it condenses once and
holds) and for ranges it refuses (it stays expanded). The loop it prevents was seen on a real profile
in Safari. Owed: an arm on WebKit with a seeded short profile whose range after condensing is under
24px, which fails on `1238947` and passes on the fix.

---

## G204. The header's lens bar is named "Lens" on every surface

**Severity: low. Opened 4 October 2026 during Fix PR 08 item 3 (ruling 1467). Numbered by handoff
55-A under ruling 760; filed unnumbered by Fix PR 08 (handoff 51). The number is assigned by this
entry (ruling 638).**

`AppHeader` renders the registered bar with no `label`, so `LensBar`'s default names its tablist
"Lens" whether it holds the Feed's, Connect's or Convene's lenses; the in-page bars are "Lens",
"Connect lens" and "Convene lens". `HeaderLensBar` (`src/components/strand/AppHeader.tsx`) carries no
label field, and `src/lib/header-lens-store.ts` has nothing to pass. Connect now registers too, so a
screen reader hears "Lens" for three different lens sets once the bar docks. Owed: a `label` on
`HeaderLensBar`, passed by each registering surface and rendered by `AppHeader`.

---

## G205. The Feed's and Connect's bars sit at the start of the column at medium and expanded — closed (#98, rulings 1502 and 1504)

**Severity: low. Opened 4 October 2026 during Fix PR 08 item 2 (ruling 1465). Numbered by handoff
55-A under ruling 760; filed unnumbered by Fix PR 08 (handoff 51). The number is assigned by this
entry (ruling 638).**

Under `width="content"` the bar hugs its words. Discovery's bar is centred in its lens row by 1170;
the Feed's and Connect's are in the column and now sit at its start edge, where under `fill` they
spanned it. Nothing rules where a `content` bar sits in a column. Owed: a ruling on the bar's inline
position at medium and expanded on the Feed and Connect, and the lens seat carrying it.

**Closed by rulings 1502 and 1504 on 5 October 2026, in Fix PR 08's addendum (#98).** At medium and
expanded the Feed's and Connect's bars are justified across their column: each seat starts at its own
word's width (glyph and word, 1465) and the column's remaining width is shared equally, so the track
spans the column. 1502 first read as `fill`, which priced the Feed's five seats at 666 against its 616
column at 744, 820 and 1024; 1504 ruled the justified packing, which prices the sum. The sums read
are 506.69 for the Feed and 479.82 for Connect, against columns of 616 at medium and 760 and 712 at
1280, so every bar fits; where a sum exceeds its column the bar falls back to the sideways strip and
never drops a label. Discovery's lens row is unchanged (1170).

---

## G206. Two live checks on Convene's seeded Filling up events are red on `main` — closed (handoff 55-A, first commit)

**Severity: moderate. Opened 4 October 2026 during Fix PR 08, which touches no SQL. Numbered by
handoff 55-A under ruling 760; filed unnumbered by Fix PR 08 (handoff 51). The number is assigned by
this entry (ruling 638).**

`tests/live-checks.cjs` fails the same two checks on `main` at `8fc0526` (run 511) and on this branch
(run 512), word for word: "Handoff 34-A addendum (1173): a search whose matches sit one to a lane
returns the lane" reads `no title for the seeded event lanes not read filling absent`, and
"Handoff 34-A (1157, 1165): Filling up carries both seeded events, and event_going_names gives each
three first names" reads `names [null,null]` for both seeded events. The `live` job is red on every
branch for it, which hides any new live failure behind a known one. Not diagnosed here. Owed: the
cause read on the canonical project (the seeded events' titles and their going registrations as
`live_arms` sees them), then the seed or the arm put right.

**Closed by handoff 55-A's first commit (`1cad7b8`), recorded under its Session 54 label as G221.**
The 1165 seed was replaced on 1 October; the arm now names the two events that carry the going
registrations and reads them before it relies on them.

---

## G207. N1: `connection_request` is rendered by the client but absent from the enum and has no writer — closed (handoff 55-A)

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N1; already noted under
G19 since 13 September). Numbered by handoff 55-A under ruling 760. The number is assigned by this
entry (ruling 638).**

An incoming introduction raised nothing: the client carried the kind, its copy and its destination,
the enum did not carry the kind, and no function wrote it.

**Closed by handoff 55-A (rulings 461, 1318, 1319).** `connection_request` is a row of
`public.notification_kinds` (`20261008120100`), and `public.send_introduction` calls
`private.notify(p_recipient, 'connection_request', ...)` in its own transaction
(`20261008120300`). Withdrawal and expiry retract the row (471); acceptance settles it; a decline
retracts it and tells nobody (157). Proved by the live arm "send_introduction from owner-test leaves
member-test one connection_request row, and withdrawing it leaves none".

---

## G208. N2: `role_accepted` is written but has no row part, so an accepted invitation disappears

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N2). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Data side done by handoff 55-A (1519).** `public.respond_to_event_role` now settles the invitee's
`role_invitation` row and writes `role_accepted` to the event's host through `private.notify`; the
in-place kind rewrite on the invitee's own row is gone. The kind's row carries `renders = false`.
Held: the Strand row part for `role_accepted` (752), then `renders = true`, on the Chat/Design queue.

---

## G209. N3: four writers inserted notifications directly, and the kind-to-C map lived in two places — closed (handoff 55-A)

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N3). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A (1319).** `private.notify` is the only function that inserts a row; its two
siblings `private.notification_retract` and `private.notification_settle`, the member's
`notifications_mark_seen` and `notifications_mark_all_read`, and the 180-day purge are the only other
bodies that write the table. The trigger `on_connection_request_accepted` and
`private.notify_connection_accepted` are dropped; `invite_event_party`, `respond_to_event_role` and
`remove_event_party` call the writer and its siblings. The generated `c_category` CASE is dropped:
the row's C is written by `notify` from the kind's vocabulary row. The live arm reads `pg_proc` and
fails on any other writer.

---

## G210. N4: the kind vocabulary was a hardcoded client array — closed (handoff 55-A)

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N4; related to G187).
Numbered by handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A (1318).** `public.notification_kinds` is the vocabulary, served by
`vocabularies()` as `notification_kinds`; `NOTIFICATION_REGISTRY`, `KIND_C` and `DESTINATION` are gone
from `NotificationListItem.tsx`. A row's C and destination line come from its kind's row, and a kind
renders where its row says `renders` and the row part has a sentence. `tests/notifications.cjs` fails
on any client array or object of kinds. G187's registry half goes with it; its other halves (ruling
461's words, 490's line against the compiled rows) are unchanged.

---

## G211. N5: `attestation_received` was fixed to Contribute, where attestations are per context

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N5). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Writer side done by handoff 55-A (1325).** The kind's row carries `c_from_object = true` and no
fixed C; `private.notify` resolves its C from the object's context through
`private.notification_c_for` and refuses a context that names none. Open: attestations have no
writer yet, so `notification_c_for` carries no attestation branch; the branch lands with the writer,
and the kind keeps `renders = false` until then.

---

## G212. N6: `event_reminder` has a destination but no writer and no scheduler

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N6). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

The kind's row exists with "Opens the event" (G19's words) and `renders = false`. Its writer and
scheduler are Brief 8's delivery layer.

---

## G213. N7: no preferences store and no control

**Severity: moderate, high once email ships. Opened 1 October 2026 in Session 39's assessment (label
N7). Numbered by handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Data side done by handoff 55-A (1320).** `public.notification_preferences` holds a member's email
mode per C, read by the member alone and written only through `public.set_notification_preference`;
`private.notify` reads it when a kind carries copy. Held: the Settings control and the labels for
channels and modes, Path 1 on the Chat/Design queue (1521).

---

## G214. N8: no out-of-app delivery, no outbox, no record of a send

**Severity: moderate. Opened 1 October 2026 in Session 39's assessment (label N8). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Data side done by handoff 55-A (1321).** `private.notification_outbox` records every mail
`private.notify` enqueues; `notify-deliver` claims due rows under `for update skip locked` and marks a
row sent only with Resend's id; `resend-webhook` suppresses an address on a hard bounce or a
complaint; `dna_notify_deliver_minutely` wakes the function through `pg_net` with the vault token.
Held: the first send, which waits for each kind's copy (1520, G240). Under 1520 nothing is enqueued.

---

## G215. N9: `notifications_actor_select` returned `read_at` to the actor — closed (handoff 55-A)

**Severity: moderate; invite-boundary gate. Opened 1 October 2026 in Session 39's assessment (label
N9). Numbered by handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A (1323).** The policy is dropped in `20261008120200`; an actor reads none of
the rows they cause. Proved by the live arm "the actor reads none of the rows they caused".

---

## G216. N10: rows from a blocked member still rendered with the name — closed (handoff 55-A)

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N10). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A (1518, 139).** `notifications_recipient_select` carries
`not (actor_kind = 'member' and private.is_blocked(recipient_member_id, actor_id))`, symmetric, as row
policy; `notifications_dot` applies the same test; `private.notify` writes nothing across a block in
either direction. Proved by the live arm "a recipient who blocks the actor reads no row from them".

---

## G217. N11: the dot cleared only row by row; no Mark all read

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N11). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Data side done by handoff 55-A (1322, 1521).** Seen and read are two columns: opening the panel
calls `notifications_mark_seen`, which clears the dot while each row keeps its unread weight, and
`notifications_mark_all_read` exists for the caller's rows. Held: the panel's Mark all read control,
Path 1 on the Chat/Design queue (1521).

---

## G218. N12: no retention; 485's purge was never built — closed (handoff 55-A)

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N12). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A (1324).** `private.purge_read_notifications` deletes rows read more than 180
days ago, never an unread row, and `dna_notifications_purge_daily` runs it at 04:05 UTC; outbox rows
go by cascade. Proved by the live arm "the purge deletes a row read 200 days ago and leaves an unread
row".

---

## G219. N13: no system-category kind; 272's password-changed mail has no in-app record

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N13). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Held by handoff 55-A: `account_security` has no `notification_kinds` row because its copy needs a
ruling. The row, then a writer on the password and email change paths, land after it.

---

## G220. N14: `src/lib/notifications.ts` line 3 said no engine writes rows — closed (handoff 55-A)

**Severity: low. Opened 1 October 2026 in Session 39's assessment (label N14). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by handoff 55-A.** The header now says rows are written by `private.notify` inside each
engine's own write function and names them.

---

## G221. S54-1: the `live` job is red on every branch from the two seeded Filling up checks — closed (handoff 55-A, first commit)

**Severity: moderate. Opened 5 October 2026 in Session 54's consolidation (label S54-1; the same
defect as G206). Numbered by handoff 55-A under ruling 760. The number is assigned by this entry
(ruling 638).**

The register names `tests/discovery.cjs`; the two checks live in `tests/live-db.cjs`, run by
`tests/live-checks.cjs`. Cause, read on the canonical project in Session 55: the two events
`SEEDED_FILLING` named (the 1165 seed, `bfcc66ba-…` and `01e7c23d-…`) no longer exist, because the
canonical event set was replaced on 1 October 2026 at 07:49 and 08:11 PDT. The published future events
with five or more going registrations are now `0a527cb8-79e3-4fae-97e0-4e12b5caff2e` (Johannesburg
Returnee Supper) and `829b0fb7-72d5-4da5-bfe4-cc3ee9c14637` (Accra Diaspora Founders Breakfast), six
each, both test accounts among them.

**Closed by handoff 55-A's first commit (`1cad7b8`).** `SEEDED_FILLING` names the two events with a
comment saying where they came from; a named check reads both as published, future and uncancelled
before the two arms that depend on them, and a missing seed reports both arms unproven (228) with
"seed missing" and the id, never failed. The expectations are unchanged. The proof is this PR's `live`
job.

---

## G222. S54-2: nobody recorded who applied ledger row `20261003140000` — closed (handoff 55-A)

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-2). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

**Closed by the record, read by Chat on 5 October 2026 at 15:03 PDT.** Ledger row `20261003140000`
(1451, the All lens line) was applied by Session 44's Chat (Lane E) through `execute_sql`;
`SESSION-44-CLOSE.md` line 60 says so. Its recorded statement's drift-form md5 is
`2456cabe9441ae8f7c7353a838343d84`, equal to the committed file's. The one difference from its
neighbours: its `created_by` is null where theirs read `chat-execute_sql`.

---

## G223. S54-3: Messenger's `.mov` refusal is client-side, before the route

**Severity: moderate. Opened 5 October 2026 in Session 54's consolidation (label S54-3). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

`measureVideo` in `src/lib/media.ts` gets no dimensions in macOS Safari from a detached `<video>`.
Faststart layout was ruled out on 5 October (edge logs show no `messenger_media_record` at 14:27
Pacific). `bad_media` and `too_large` share one on-screen line. Owner: the Code queue, item (b); copy
to 41-E (1409).

**Amended 8 October 2026 by handoff 56-MOV (PR #100): the cause is the Content-Security-Policy, not
the detached element. Open.** Nobody observed what the detached element returned in Safari; that
claim was the hypothesis Done Means 2 was to test (1551). Run 523 (`b1821f4`, deployment
`2d317cab`) asked each engine for the fixture's size through a detached and an attached `<video>`,
on the deployed app:

- Linux WebKit: `{"canPlayType":"maybe","detached":{"event":"error","code":4,"message":""},"attached":{"event":"error","code":4,"message":""}}`
- Chromium: `{"canPlayType":"","detached":{"event":"error","code":4,"message":"MEDIA_ELEMENT_ERROR: Media load rejected by URL safety check"},"attached":{"event":"error","code":4,"message":"MEDIA_ELEMENT_ERROR: Media load rejected by URL safety check"}}`

Chromium's line is a policy refusal, not a codec one: locally, with no page policy, the same engine
answers `DEMUXER_ERROR_NO_SUPPORTED_STREAMS`. The policy in `src/lib/csp.ts` (and its static copy in
`public/_headers`) has no `media-src`, so media falls back to `default-src 'self'`, and a `blob:`
object URL is not `'self'`. Every `<video>` and `<audio>` given an object URL on the deployed app is
refused before it loads, in every engine, attached or detached, whatever the file; `img-src` admits
`blob:`, which is why the composer's draft thumbnail (an `<img>`, `MediaBlock kind="video"`) showed
the recording. The same policy refuses voice-note playback, which `useAudio` in
`src/lib/messenger-media.ts` runs through `new Audio(objectURL)`; `messenger-live`'s voice check
asserts the player renders, not that it plays. `fetchMessageMedia` in `src/lib/media.ts` hands every
received object to its element as a `blob:` URL (the route needs the bearer, which an element's own
request cannot carry), so voice notes and received videos were refused by the same policy, not only
the composer's attachment.

PR #100 moves the measurement to an attached element owned by `MessengerThread.tsx`, removes
`measureVideo`, and gives `too_large` its own state, but did not change the policy or the refusal,
under the handoff's stop clause: an attached element also returned no size. Owed, as a ruling,
because it changes ruling 438's header: `media-src 'self' blob:` in both `src/lib/csp.ts` and
`public/_headers` (since given as ruling 1569, below). Linux WebKit's empty message cannot by itself
separate the policy from a GStreamer decoder gap; the policy is the cause Chromium names and the one
that reaches Safari.

**Amended again 8 October 2026: the policy is changed under ruling 1569.** PR #100 adds
`media-src 'self' blob:` to `src/lib/csp.ts` and `public/_headers`, every other directive unchanged,
and the live arm that reads `/feed`'s policy asserts it. What the run on PR #100's final head reads for
the fixture in each engine is the evidence this entry closes on; Safari's is Done Means 2's walk. A
received video still cannot play once the policy allows it: G250.

---

## G224. S54-4: `tests/messenger-media.cjs` cannot catch a client-side refusal

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-4). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

The arm posts `.mov` bytes straight to the route, so CI never exercises the client path G223 breaks;
that path's proof is a named check on the deployed URL in Safari. With G223.

**Amended 8 October 2026 by handoff 56-MOV (PR #100): the arm exists; its send is unproven in every
engine CI runs. Open.** `tests/messenger-composer-video.cjs` attaches
`tests/fixtures/composer-video.mov` (8,997 bytes, 320x124 H.264 Main QuickTime) through the thread's
own video input on the deployment, sends it, and asserts the upload's integer `w` and `h` and the
message in the log; a second check attaches a file one byte over the ceiling and asserts the
`too_large` state with nothing sent to the route. It prints what the engine's detached and attached
`<video>` return before it attaches anything. On run 523 the too_large check passed on both engines
and the two send checks were UNPROVEN on both, with G223's two lines as the reason (228). Ruling
1550 puts the arm in the macOS WebKit gate (twenty-two arms) so the Mac port reads it too.
`messenger-media`'s ffmpeg-made `.mov` checks are also UNPROVEN on every runner (`ffmpeg is not on
the runner (ENOENT)`), so no CI arm today proves a `.mov` upload. The arm proves the composer's path,
never Safari. It closes when the send checks pass on a deployment whose policy admits `blob:` media.

---

## G225. S54-5: #98's iPhone walk found four lens-bar defects

**Severity: moderate. Opened 5 October 2026 in Session 54's consolidation (label S54-5). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Connect's lens bar lacks the more-to-scroll cue; the Feed's bar does not dock on scroll; a lens change
while docked moves the Feed's and Convene's bars; the trailing corner is square (1515, 1517). Owner:
Lane E, Session 57's first Fix PR.

**Closed by PR #101 (Fix PR 09, handoff 57-FIX-09) under rulings 1515, 1517 and 1575.**

- **W84, corners.** Where the bar is a strip, the rounded track is the scroller, at its column's
  width; the seat no longer scrolls, and its four corners hold.
- **W85, the cue.** A fade in the track's ground marks each end with a seat out of view. It is built
  once in `LensBar`, for every lens bar. Both are proven by the `lens-strip` arm at 360, 390, 430
  and the 820 fallback, in both themes.
- **W87, a docked lens change.** `holdLensDock` now holds the docking point reachable with a
  measured hold that lasts while docked, and the frame sampler in `runLensSeat` at 390 holds on all
  three surfaces under both seedings. On the code before this PR the sampler did not fail in either
  engine on the mock, so the hold was not shown to be the device's cause.
- **W86, the Feed docking.** Not reproduced on the mock. The step table, stepping 0 to 400 and back
  by 8 at 390 and 820, matches Connect's row for row in Chromium and Linux WebKit on the code before
  this PR (matrix run 87). No fix is made at an unproven cause, and the standing check is in
  `runLensSeat`. The founder's iPhone walk after merge (358) is the check for W86 and W87; a failure
  there reopens this entry with the device's reading.

**Confirmed on device, 8 October 2026, 19:45 PDT.** The founder walked W84 to W87 on an iPhone in
Safari on Feed, Connect and Convene after #101 merged and reported them passed (ruling 1597). W86
passed with no code aimed at it, so its cause is still unknown; if it returns, a new finding starts
from `runLensSeat`'s step table.

---

## G226. S54-6: each Design project's records lagged Chat's ratifications

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-6). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Synced on 5 October. Pages stay correct only if every ratification is relayed to its project in the
same session. Owner: protocol, Session 54's lessons.

---

## G227. S54-7: the bound compile is 53 bytes larger than Strand's export note, and three proofs are owed

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-7). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

The app project's bound compile `v1790724894917128` is 53 bytes larger than Strand's export note
states; 995's pre-copy byte count and hash were never taken for that bind; fifteen `Sheet` pages owe a
proof under 755; `LinkRow` never reached Strand. Owner: Strand's next correction brief (1510 e).

---

## G228. S54-8: Strand's root bundle carries no compile id literal

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-8). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

854 and 861 stand. Owner: standing.

---

## G229. S54-9: MemberCard's source comments in Strand still say "vouches" and flag ruled departures

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-9). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

The departures are those ruled as 1487 to 1490 and 1500. Owner: Strand's next correction brief
(1510 e).

---

## G230. S54-10: 44-W64 never reached Strand, and 44-NAV is unstarted

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-10). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

44-W64 is the event time (1447 to 1450); 44-NAV is 1474 and 1476 to 1478. Owner: the Chat/Design queue
(1510 f).

---

## G231. S54-11: the admin prototype's company-zone dialog opens on another zone

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-11). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

1415 and the built app open it on the current zone with Confirm disabled. Owner: the next admin Design
pass.

---

## G232. S54-12: Convene Pass 4's approval under 62 is not found in the register

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-12). Numbered by
handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Brief 11 was built. Owner: Session 56, reading Session 17 to 22's records.

---

## G233. S54-13: `supabase/config.toml` is absent, so no function's JWT setting is readable from the tree

**Severity: low. Opened 5 October 2026 in Session 54's consolidation (label S54-13; Session 47).
Numbered by handoff 55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Handoff 55-A's two functions, `notify-deliver` and `resend-webhook`, deploy with `verify_jwt = false`;
with no `config.toml` the setting travels in the `deploy_edge_function` call and each function's
header comment records it, as `guest-rsvp`'s and `event-media`'s do. Owner: Lane A.

---

## G234. S54-14: BR-133 puts the EDLMS repo on the canonical project's one ledger

**Severity: moderate. Opened 5 October 2026 at Session 54's close (label S54-14). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

Two repos writing migrations into one ledger breaks the single migration slot (759, 1506) and every
ledger-head check against `main`'s newest migration file. Needs a ruling before the first EDLMS
migration: one ledger owner, a schema boundary, or a separate project. Owner: Business Session 4
raises it; the app track rules it.

---

## G235. S54-15: BR-126 moves membership to its own subdomain, and BR-092 to BR-096 need restating

**Severity: low. Opened 5 October 2026 at Session 54's close (label S54-15). Numbered by handoff 55-A
under ruling 760. The number is assigned by this entry (ruling 638).**

The items BR-092 to BR-096 sent (reserved_link_words for membership and chapters, `/sign-in` returning
to `/membership`, one Membership row in the account panel under 599) need restating against the tree.
Owner: Session 56, a build check then a ruling.

---

## G236. S54-16: shared sign-in across the app, admin, lms and membership subdomains is unruled

**Severity: moderate. Opened 5 October 2026 at Session 54's close (label S54-16). Numbered by handoff
55-A under ruling 760. The number is assigned by this entry (ruling 638).**

The Supabase redirect allowlist, session and cookie scope, and the magic link BR-120 names are unruled
on the app side; 1291 put admin on its own subdomain and sign-in. Owner: Session 56 raises it for an
app ruling.

---

## G237. S54-17: BR-123 and BR-127 are proposals to the app with no app ruling

**Severity: low. Opened 5 October 2026 at Session 54's close (label S54-17). Numbered by handoff 55-A
under ruling 760. The number is assigned by this entry (ruling 638).**

BR-123 is program badges on the app profile, member opt-in; BR-127 is the no-score rule across the
EDLMS. Owner: Session 56.

---

## G238. A `community_group` thread invitation writes no notification: its C is unruled

**Severity: low. Opened 8 October 2026 during handoff 55-A (held item 2). The number is assigned by
this entry (ruling 638).**

`thread_invitation` takes its C from the thread's anchor (1325): an event thread is Convene, a Space
thread Collaborate. A community group has no anchor, so `private.thread_invite` writes nothing for it.
Owed: a ruling on a community group's C, then the writer's condition widened.

---

## G239. `reply` and `mention` have no notification kind

**Severity: low. Opened 8 October 2026 during handoff 55-A (held item 3). The number is assigned by
this entry (ruling 638).**

Their rulings (1316, 1399) are not made, so neither has a `notification_kinds` row or a writer.
`account_security` is held under G219.

---

## G240. No kind carries email copy, so nothing is sent; the Resend webhook is not registered

**Severity: moderate. Opened 8 October 2026 during handoff 55-A (held item 4). The number is assigned
by this entry (ruling 638).**

Under 1520 every `notification_kinds` row is email off with `email_subject` and `email_line` null, so
`private.notify` enqueues nothing and `notify-deliver` drains an empty queue. Owed with the copy
ruling: each kind's subject and line, the first send, registering `resend-webhook` with Resend, and
setting `RESEND_WEBHOOK_SECRET` (the function refuses every call until it is set).

---

## G241. A digest for a member with no zone is due at 08:00 UTC

**Severity: low. Opened 8 October 2026 during handoff 55-A (held item 5). The number is assigned by
this entry (ruling 638).**

`private.notify` sets a digest's `due_at` to the next 08:00 in `members.local_tz`; a null zone, or one
`pg_timezone_names` does not know, falls back to UTC until a ruling says otherwise.

---

## G242. `message_request` and `thread_invitation` have no Strand row part

**Severity: low. Opened 8 October 2026 during handoff 55-A (held item 6). The number is assigned by
this entry (ruling 638).**

Both kinds are written (1315, 1339, 1325) with `renders = false` and no destination, because the row
part has no sentence for either. Owed: the parts from Design, their destination words, then `renders`.
`role_accepted`'s part is held under G208.

---

## G243. The admin console has no delivery-health projection

**Severity: low. Opened 8 October 2026 during handoff 55-A (held item 7, ruling 1299). The number is
assigned by this entry (ruling 638).**

The outbox, the suppressions and the webhook ledger are catalogued as operated, with their console
counterpart held. Owed in Brief 12's next revision: a projection over `private.notification_outbox`
states and `private.email_suppressions`, words and never a rate (the no-score absolute).

---

## G244. `NOTIFICATION-CONTRACT.md` Revision 2 did not reach handoff 55-A's session

**Severity: low. Opened 8 October 2026 during handoff 55-A. The number is assigned by this entry
(ruling 638).**

The handoff names the contract as attached and the instruction says to read it after the handoff; the
uploads held the handoff twice and the Gap Register, and the tree holds no copy. The build follows the
handoff, which says it is later and wins where the two differ. Owed: the contract committed under
`docs/` or attached, and a read of it against this PR for any point the handoff does not restate.

---

## G245. No one-click unsubscribe endpoint exists, so a digest is never sent — closed (handoff 60-NC)

**Severity: moderate once copy ships. Opened 8 October 2026 during handoff 55-A. The number is
assigned by this entry (ruling 638).**

477 requires RFC 8058's `List-Unsubscribe` and `List-Unsubscribe-Post` on a digest, and the header
must name an HTTPS endpoint that unsubscribes on one POST. None exists, so `notify-deliver` settles a
digest row `skipped` with `no_one_click_unsubscribe` rather than send it without the pair;
`sendMail` already takes headers. Owed: a ruling on what one click turns off (the C's email, or all
digest mail), a signed per-member link, the endpoint, and the header on digests.

**Closed 11 October 2026 by handoff 60-NC (#109), in the commit that writes this paragraph.**
Ruling 1529 settled what one click turns off: every non-transactional email, every category to
off. `20261012120000` adds `private.email_unsubscribe_tokens` (a sha256 of the token, the member,
the outbox row, a 60-day expiry, row security on and no client grants), `email_unsubscribe_mint`
(service role) and `email_unsubscribe` (the publishable key). `/api/email/unsubscribe` answers RFC
8058's POST and changes nothing on a GET, and `/email/unsubscribed` sends the same POST on load.
`notify-deliver` mints before `sendMail` and passes `List-Unsubscribe` and `List-Unsubscribe-Post`
on every non-transactional email, immediate or digest, and neither on transactional mail (477), so
a digest is no longer settled `skipped` with `no_one_click_unsubscribe`. Delivery itself is not
proven: W96 (Resend SMTP 535) is parked, and the header arm reads the call to `sendMail`, never a
sent message. G275 to G278 record what this left open.

---

## G246. An outbox row claimed and never settled stays in `sending`

**Severity: low. Opened 8 October 2026 during handoff 55-A. The number is assigned by this entry
(ruling 638).**

`notify_outbox_claim` marks rows `sending`; a function that dies before `notify_outbox_settle` leaves
them there. The outbox carries no claim time, so nothing can tell such a row from one another run
still holds, and re-queueing it on `due_at` alone would risk a second send. Owed: a `claimed_at`
column and a reclaim after a window, before the first send.

---

## G247. Done Means' `rg "insert into (public\.)?notifications"` finds applied migrations as well as the writer

**Severity: low. Opened 8 October 2026 during handoff 55-A. The number is assigned by this entry
(ruling 638).**

At this PR's head the search finds `20261008120300` (`private.notify`) and three lines in
`20260908142054_b3_rulings_141_142_144.sql` and `20260921140100_p2_event_parties.sql`, the bodies this
PR replaces. Ruling 466 forbids amending an applied migration, so those lines stay. What the outcome
needs is enforced twice instead: the live arm reads `pg_proc` and fails on any writer but the six, and
`tests/notifications.cjs` scans `src/` and `supabase/functions/`. Owed: Done Means worded against the
live bodies, not the tree's history.

---

## G248. Resend's webhook documentation was unreachable from the session that wrote `resend-webhook`

**Severity: low. Opened 8 October 2026 during handoff 55-A. The number is assigned by this entry
(ruling 638).**

The environment's network policy refuses `resend.com`. The verifier is built from Resend's own SDK
(`resend` 6.32.1, `webhooks.verify`, through `standardwebhooks` 1.1.1: a `whsec_` base64 key,
HMAC-SHA256 over `id.timestamp.body`, `v1,` signatures, five minutes' tolerance) and checked against
that library's own signatures. The header names are read as `svix-*` with the Standard Webhooks
`webhook-*` names accepted as the same three. Confidence in the algorithm is high and in the header
names moderate. Owed at registration (G240): the documentation page read, and the alternate names
dropped if Resend sends only one set.

---

## G249. The Convene picker check reads the when line whether or not its wait succeeded

**Severity: low. Opened 8 October 2026 by Session 55's close, recorded by handoff 56-MOV. The number
is assigned by this entry (ruling 638).**

`webkit-1280x800-dark-convene the picker completes the moment and Publish returns` failed once on
run 521 attempt 1 and passed on the re-run. In `tests/matrix.cjs`, after `when_time` is filled, the
check waits up to 5 s for `[data-convene="when-line"]` to show `19:30`, swallows that wait's timeout
with `.catch(() => {})`, then reads the line and `pub().isDisabled()` once, so a slow effect fails
the record with no word of the wait having timed out, and Publish's state is read with no wait of its
own. The earlier sighting, WebKit at 390 on run 401 (handoff 37-B), is recorded only in the comment
above the wait. Owed: a wait whose timeout is the check's failure, and a wait on Publish's state.
Recorded only; not fixed here.

---

## G250. A received Messenger video renders as an image and cannot play

**Severity: moderate. Opened 8 October 2026 by ruling 1570, during handoff 56-MOV. The number is
assigned by this entry (ruling 638).**

`MessageMedia` in `src/components/dna/MessengerThread.tsx` (line 186 at `2d86f21`, line 192 at PR
#100's head) renders a video message through `MediaBlock kind="video"`, which draws an `<img>` whose
`src` is the object URL, with a play glyph over it. No `<video>` is mounted for a message, so a video
message cannot play even once ruling 1569's `media-src 'self' blob:` lets one load (G223). Not fixed
in PR #100 (1570). Owner: the walkthrough lane; the player's copy and controls to 41-E.

Observed on run 526 (`0d6e050`, macOS WebKit, deployment `611e6ba3`), cause unproven: once the arm had
sent the fixture and its message rendered (an `<img>` whose `src` is the `.mov`'s object URL), a fresh
load of the thread left `[data-testid="message-field"]` not visible for 15 s and a page screenshot
timed out at 5 s. WebKit decodes video in an `<img>`, so the element this entry names may stall the
page rather than only fail to play; the founder's Safari walk on the thread after a send is the check.
The arm now runs its too_large check before it sends, so it no longer reloads a thread holding a
video message.

**Closed by PR #100 under ruling 1574 (amending 1570).** A received message whose media is a video
now renders through a `<video>` with the browser's own controls, `preload="metadata"` and
`playsInline`, on an object URL of the bytes `fetchMessageMedia` fetched with the bearer, revoked when
the element goes; an image keeps `MediaBlock`, which is unchanged, and no member-facing string is
added (the player's copy and controls stay with 41-E). Building it found a second reason a video never
reached a player: `useMessageMedia` read the mime by `fetch()`ing the object URL back, which
`connect-src` does not admit, so the type could come back empty and every medium drew as an image.
`fetchMessageMedia` now answers the Blob, the mime is the Blob's own type, the hook caches the bytes
once per id for the tab and gives each element its own object URL, revoked on unmount. Whether a
fresh load of a thread holding the sent video still stalls WebKit is what the composer-video arm's
third check reads, on the Linux matrix and the macOS gate: the field visible within 15 s, and the
message carrying a `<video>` on an object URL with controls and no `blob:` `<img>`. That reading is
on PR #100's final head, not in this entry, because this entry rides in the commit the run tests.

---

## G251. The Messenger's During-bound search timed out on WebKit once and its cause is unread

**Severity: low. Opened 8 October 2026 under ruling 1589, recorded by Fix PR 09 (handoff 57-FIX-09
item 5). The number is assigned by this entry (ruling 638).**

Run 528 attempt 1, on `3259dbb` (PR #100's head), `matrix (webkit)`, job 113466162700. Arm
`webkit-messenger-live`, step 12: `FAIL [no crash] webkit-messenger-live flow TimeoutError:
locator.waitFor: Timeout 15000ms exceeded.` while waiting for `locator('[data-search-result]').first()
to be visible`. The page showed `no-results`. The check behind it, `search with a During date bound
opens the thread at the message (1338, 1347)`, and five more after it (the media notice, the image in
the bubble, the voice note, the delete for everyone, nothing in browser storage) read `UNPROVEN (228):
the flow ended before this check ran`. Ruling 292 flagged the extra flow check, 19 against a declared 18. Not a crash: 0 behind G5, no core written. The re-run passed.

The path is `messenger_search`. The step searches for a word the arm sent earlier, bounded During
today, with today's date taken from the runner's clock. It is not #100's: that PR changed the
content-security policy, the composer's measurement, received media rendering and `useMessageMedia`,
and none of the search path. The arm passed on Linux WebKit on run 523 and on Chromium on run 528.

Owed: the cause read. Among the candidates is the runner's date against the database's date
boundary: a During bound built from the runner's local day can name a day the database, reading
UTC or the member's zone, does not hold the message in. Also owed: a wait whose timeout is the check's
own failure rather than the flow's catch-all. Recorded only; not fixed here.

---

## G252. The admin Settings arm reads the sessions and read-log panels before their rows load

**Severity: low. Opened 8 October 2026 under ruling 1589, recorded by Fix PR 09 (handoff 57-FIX-09
item 5). The number is assigned by this entry (ruling 638).**

Run 528 attempt 1, on `3259dbb` (PR #100's head), `admin-arms`, job 113465879017. Arm
`chromium-1280x800-dark-admin settings analyst`, two checks:

- `sessions mark this device, Active now, and carry no aria-sort`: the panel read `Active sessions`,
  its heading, and nothing else.
- `the read log reads Settings, Your read log under Today, newest first`: the panel read its heading
  and intro line only (`Your read log What you have read in the admin and when, newest first. Opening
this log is itself logged.`).

The path is `tests/settings.cjs`, which reads both panels as soon as Settings renders, with no wait for
their rows: a load-timing race in the arm, not the admin. It is not #100's: the admin bundle imports
none of the files `3259dbb` changed. The arm passed on `0d6e050` (run 526), and the re-run passed.

Owed: a wait on each panel's rows before the read, whose timeout is the check's failure. Recorded
only; not fixed here.

---

## G253. The onboarding flow arm timed out on /welcome on WebKit once, outside the diff it ran on

**Severity: low. Opened 8 October 2026, observed by Fix PR 09 (handoff 57-FIX-09) on its enforcing
run. The number is assigned by this entry (ruling 638).**

Run 533 attempt 1, on `4ccd900` (PR #101's head), `matrix (webkit)`, job 113552642930, deployment
`ccdef5d9`. Arm `webkit-390x844-light-onboarding-flows`: `flow arm, first pass, completed` failed with
`TimeoutError: page.waitForSelector: Timeout 15000ms exceeded`. It was waiting for
`[data-testid="onboarding-who"]` to be visible, and for the navigation to `/password` to finish, on
`/welcome`. Ruling 292 then read 16 of 41 checks emitted. Not a crash: 0 behind G5. The same arm
passed in Chromium on the same run.

It is not #101's. That PR changes `LensBar`, `LensSeat` and `holdLensDock` in
`src/lib/shell-scroll.tsx`. `/welcome` renders `WhoScreen` from `OnboardingSurface` outside the shell,
and nothing on that path imports any of the three.

Owed: the cause read, starting with whether the `/password` to `/welcome` navigation settles before
the arm waits for the screen. Recorded only; not changed here.

---

## G254. A received video has no poster frame

**Severity: low. Opened 8 October 2026 by handoff 56-41E item 2.4, during the 41-E PR. The number is
assigned by this entry (ruling 638).**

SPEC-41-E section 3 draws the player with `poster` from the message's media, and nothing stores a
poster frame anywhere: `media` carries the file's own key, mime, dimensions and bytes, and no
derivation writes a still from a video (1374 transforms nothing on delivery). The player ships
without `poster`, so before Play a received video shows the browser's own first frame once its
metadata has loaded (`preload="metadata"`) and `--ink` until then. Held by the handoff ("Poster:
held"), not built here. Owed: a decision on whether a still is derived at upload (a second object
beside the file, written by the same route) or never, and a ruling before any surface stores one.

---

## G255. The emoji picker's group labels are Frimousse's English ones

**Severity: low. Opened 8 October 2026 by handoff 56-41E item 4 (ruling 1584), during the 41-E PR.
The number is assigned by this entry (ruling 638).**

The full picker's groups read emojibase's English `messages.json` group names, capitalised as
Frimousse capitalises them ("Smileys & emotion", "People & body", "Animals & nature", "Food &
drink", "Travel & places", "Activities", "Objects", "Symbols", "Flags"), and the search matches the
library's English labels and tags. Ruling 1584 lets them stand until localisation. The locale is
fixed to `en` in `src/components/dna/ReactionPicker.tsx` and the self-hosted set under
`public/emojibase/17.0.0/` holds only `en/`; a localised Messenger adds the locale's two files beside
it and passes the member's locale to the picker. The ampersands and the capitalisation are the
library's, not the copy rules' (sentence case, no ampersand in copy), which is part of what
localisation settles.

---

## G256. The fixture behind B14-Messenger-v3 was not attached to handoff 56-41E

**Severity: low. Opened 8 October 2026 during the 41-E PR. The number is assigned by this entry
(ruling 638).**

The page `messages/B14-Messenger-v3.dc.html` (`v1791487330148240`) reads its quick eight, their
labels, the tone swatches and its recent list from `messages/b14-messenger-data-v3.js`
(`v1791487334087470`, named in SPEC-41-E's stamps), which the handoff did not attach, and the build
is bound to the page and the SPEC. Two values are therefore reconstructed rather than read:

- E9's eight glyph names, seeded as `message_reaction_emoji.label` for the quick positions and
  served through `message_reaction_quick`: Thumbs up, Heart, Folded hands, Clapping, Party,
  Laughing, Surprised, Crying, in 1403's order and words.
- the five tone swatches in `src/lib/emoji.ts` (`TONES[].hex`), drawn in the picker's tone row: one
  hex per emoji modifier, the common picker values, with Not chosen on `--ink-4` as the SPEC says.

If the fixture's labels or swatches differ, the labels change by one migration on the eight rows
(a vocabulary, never a component) and the swatches by one constant. Also reconstructed, from
Frimousse 0.4.0's own resolver rather than from the handoff's "emojibase ^16" (the package declares
no dependency and fetches `emojibase-data@latest`): the self-hosted set is `17.0.0`, the version
`@latest` resolved on 8 October 2026, recorded in `message_reaction_emoji.emojibase_version`.

---

## G257. The composer-video arm could kill the macOS gate on a slow Send

**Severity: moderate. Opened 8 October 2026 by run 534 (PR #102's first gate run, head `bf1997b`).
The number is assigned by this entry (ruling 638).**

`tests/messenger-composer-video.cjs` created its 30 s `page.waitForRequest` for the media POST and
only then awaited the Send click, attaching the wait's `catch` after the click returned. On run 534
the click took longer than 30 s to find Send actionable on macOS WebKit (the fixture had just been
attached and the composer's thumbnail is `MediaBlock`'s `<img>` of the `.mov`'s object URL, the
decode G250 names), so the wait rejected with no handler and Node raised it as an uncaught
exception: the gate's process died at that arm, after `ENV … the fixture in this engine` and before
`… the composer at send`, and the arms after it, the reactions arm among them, never ran. Run 529 on
main crossed the same stretch in 45 s and passed, so the arm sat near the cliff.

Fixed in PR #102: the wait's rejection is handled where it is made and the click carries the same
30 s bound, so a slow Send records this check failed with the composer's state record and the
failstate screenshot, and the gate goes on to the arms after it (1237: never a pass, never silent).
What is not settled here is why Send took longer than 30 s on that run: whether the decode of the
attached `.mov` in the thumbnail's `<img>` stalls WebKit's main thread for that long on its own, or
something on `bf1997b` lengthened it. The next gate run on the branch, which now records the arm's
state at send, is what answers it; if it is the decode, the composer's video thumbnail should stop
handing a video's object URL to an `<img>` (the same change G250 made for the log).

**Amended 9 October 2026 by runs 538 and 539 (PR #102, heads `f4117b5` and `80a3535`): the open
half is answered, and it is the decode.** Run 538's gate read the arm's over-the-ceiling step
hanging on its Send click for the full 30 s with no crash, the failstate screenshot timing out at
5 s after it: the 100 MB draft had been handed to both the thumbnail's `<img>` and the measuring
`<video>`, and the main thread was still on it 37 s later. Run 535 crossed the same stretch in 39 s,
run 534 lost it one step later in the same web process, so whether the click landed was timing.
`80a3535` refuses a video over `MESSAGE_MEDIA_MAX_BYTES` at the attach, before an object URL exists,
and the arm's step reads that refusal with no Send to press. Run 539, with that in place, then hung
on the real send: the 9 KB fixture alone, the measuring `<video>` at readyState 0 (networkState 2)
when Send was pressed, no POST in 30 s, the screenshot timing out again. The arm's own probe loads
the same blob in an identical attached `<video>` every run, in the same web process; the one element
the probe does not have is the thumbnail, `MediaBlock kind="video"` drawing its `src` in an `<img>`.
`5770fbb` renders the video draft's tile with no `src` (the play glyph on the sunken frame), so the
measuring `<video>` is the one element holding the bytes. Run 540 (`5770fbb`): the gate 322 of 322,
the arm's four checks passed. Closed by PR #102; the register keeps the mechanism because it is the
one G250 named for the log and the same one again.

---

## G258. The Members order's tier is computed inline, and a cohort of a few thousand admitted members moves it to a materialized key

**Severity: low. Opened 9 October 2026 by Fix PR 10 (handoff 59-FIX-10 item 2, ruling 1483). The
number is assigned by this entry (ruling 638).**

`20261009120000` orders the Members lens by `private.members_order_tier(viewer, member)`, computed
inline for every member the lens admits, then name, then id, with the cursor as `{tier}|{name}|{id}`
and the keyset on the same triple. The tier is five existence checks in order: a pending request
from the member to the viewer, `private.shares_anchor`, a `public.second_degree` row, and a shared
active corridor or an attribute overlap under `private.admit_section`'s three gates. Each is an
index probe or a short join, but the sort cannot stop early: every admitted member's tier is
computed before the first page is cut, because no index orders members by a value that depends on
the viewer. The cost of one page is therefore linear in the admitted cohort, roughly fifteen probes
per member, and it is paid again on every page and every filter change.

That holds at the invite cohort (hundreds of members, a page in tens of milliseconds). It stops
holding at roughly five thousand admitted members per viewer, where a page would cost on the order
of a second on the canonical project's compute, and the lens is opened on every Connect visit. At
that threshold the ordering key 1483 names at Moderate confidence is built: a per-viewer
materialized tier, refreshed by the write paths that change it (`send_introduction`,
`respond_to_request`, `withdraw_request`, the Space role and attestation writers, the corridor and
profile section writers) in the same transaction, under the ruling 1002 line that a derived row is
written by its source's write path and never by a trigger. `second_degree` already has that shape.
The measured plan on the founder's account is recorded in Fix PR 10's PR body by Chat at apply
(`explain analyze` through the arm's connection), and that number is what moves this entry's
severity. Owner: the Code queue, on the cohort's growth, not before.

---

## G259. The reaction picker's name line, the press and hold, the scrolling list, toned hands in the grid and the pill's announced name build with B14-Messenger-v4

**Severity: low. Opened 9 October 2026 by Fix PR 10 (handoff 59-FIX-10 item 4, rulings 1613 and
1635). The number is assigned by this entry (ruling 638).**

The picker's name line under the pointer or finger (1613) is held on its build handoff. The page
that draws it, `B14-Messenger-v4`, is approved under 62 (1635, with 1629's correction to four names
before its SPEC). Five things build together from it, after 12C part 2 (1620): the name line; the
press and hold on touch (1632), with the one threshold in `src/lib/long-press.ts` (1633); the list
scrolling inside the panel at the built `listHeight` (1631); toned hands in the grid (1630); and the
pill's announced name (1634). Nothing of the five is built in Fix PR 10, which carries 1613's code
half alone: the quick bar's tooltip, the grid's and Recent's accessible names, and the agreement arm
(1621, 1628, 1629). Owner: the Code queue, behind 12C part 2.

---

## G260. Below expanded, Accept's confirmation toast dies with the list surface on the navigation it precedes

**Severity: low. Opened 9 October 2026 by run 548 (PR #103, Fix PR 10, head `6f58d49`), the Linux
`matrix (webkit)` job, cell 390 x 844 light, the Messenger flows arm. The number is assigned by this
entry (ruling 638).**

`onRequest` in `src/components/dna/MessengerSurface.tsx` accepts a request, says "Accepted. You can
reply now." into the list surface's own toast state, and then opens the new thread. Below expanded
the thread is its own route (1023, 1368): `MessagesRoute` renders the outlet in place of
`MessengerSurface`, the surface unmounts on the navigation, and the toast it had just set goes with
it, one frame after it rendered. The member on a phone never sees the confirmation; at expanded the
surface stays mounted under the Pane and the toast shows for its 2,600 ms.

The flows arm's check 18 reads the toast right after `waitForURL` resolves, which lands between the
history push and React's commit of the new route, so the read usually wins the race and the check has
passed in every run before 548. On 548's WebKit cell at 390 the commit came first: the write was
recorded, the URL was the new thread's, and the toast text was empty. Not a crash and not this PR's
code: the diff on `6f58d49` touches no surface.

The fix is the thread's: carry the sentence across the navigation in router history state, the way
a search result carries its message (1338, 1371), and let `MessengerThread` say it on mount; the
arm then reads the toast on the thread route. Until then the check stays as written, because
weakening it to "navigated" would record the lost toast as a pass. Owner: Lane E, the next Fix PR.

## G261. A portrait's signed URL expires after an hour and nothing re-signs it on the Connect card or on Profile

**Severity: low. Opened 10 October 2026 by handoff 44-MC-R3 (PR #104, the MemberCard port), at Chat's
instruction after the port read what the handoff asserted about `Avatar`. The number is assigned by
this entry (ruling 638).**

A Connect card's `src` is a signed URL for the member's `avatar_path` in the private `profile-media`
bucket, minted by `signAll` in `src/lib/connect.ts` with `createSignedUrls(paths, 60 * 60)`; Profile's
avatar and cover come from `signedProfileUrl` in `src/lib/profile.ts` with the same one-hour
`createSignedUrl`, the constant `SIGNED_URL_SECONDS` in `src/lib/media.ts`. Nothing on the card, on
Profile or in `src/components/strand/Avatar.tsx` re-signs a URL that has expired. Handoff 44-MC-R3
described `Avatar` as carrying "the stale-URL re-sign" from Fix PR 10 item 6; the file carries the
other half of that item only, the initials fallback when the photograph fails to load (W91), so a
member who leaves Connect or a profile open for over an hour sees the initials tile where the
photograph was, and a fresh read is what brings the photograph back. Connect's queries are the
re-read in practice: react-query refetches on focus and on the invalidations the actions make, and
each refetch signs anew. Profile's single read does not.

The port does not build a re-sign: the handoff's rule was to draw the portrait through `Avatar` and
not to add a second image path, and a re-sign is a lib concern (which path, which bucket, when) that
the card must not know. The fix is one `staleTime` and one place: sign at read with a `staleTime`
under the URL's life, or hold the path and sign on demand through one function the three callers
share. Owner: the next Fix PR touching `src/lib/media.ts`.

## G262. `story_opened` has no caller until a story page exists (ruling 1617)

**Severity: low. Opened 10 October 2026 by handoff 58-12C2 (PR #105, the member app's recording),
under ruling 1617. The number is assigned by this entry (ruling 638).**

`surface_event_kinds` carries `story_opened`, public, with the story as its object (tracking plan
12C, "Story-led acts"). No story page exists in the tree: a story-shaped card goes to the `/convey`
placeholder (`src/routes/_shell/$c.tsx`), which is an EmptyState and not a story. Ruling 1617 holds
the kind rather than building around it, so nothing records it and the row stays in the vocabulary
for the page that will. Owner: Convey's brief, which builds the page and records the open there.

## G263. The admin app has no reset, so its reset kinds have no caller (ruling 1617)

**Severity: low. Opened 10 October 2026 by handoff 58-12C2 (PR #105), under ruling 1617. The
number is assigned by this entry (ruling 638).**

`password_reset_requested` and `password_reset_completed` are recorded by the member app's `/reset`
and `/reset/new` (`src/routes/reset.tsx`, `src/routes/reset_.new.tsx`) with app `app`. The admin
app has no reset: its sign-in's line under the password field asks for an email to support (ruling
1329), so there is no moment on the admin host that either kind names. Ruling 1617 holds the admin
app's rows rather than inventing a moment; they arrive with an admin reset if one is ever built, on
the same recorder, which already sends app `admin` from that host. Owner: whichever brief gives the
admin app a reset.

## G264. A provider sign-in without its marker records no `sign_in_succeeded`

**Severity: low. Opened 10 October 2026 by handoff 58-12C2 (PR #105). The number is assigned by
this entry (ruling 638).**

`sign_in_succeeded` carries `method`, and for a provider return the method is the provider the
member pressed. The session cannot name it on every path: `session.user.app_metadata.provider` is
the identity the account was created with, so a password account later linked to Google (ruling
234's identity linking) reads `email` on a Google sign-in, and `user.identities` lists every linked
provider and not the one used now. The recorder therefore reads the marker `startProvider` sets in
sessionStorage before the redirect (`dna.auth.oauth-provider`, `src/lib/auth-flow.ts`), which exists
only between the member's press and the return, and records the return from AuthProvider's
`SIGNED_IN` with that provider as the method (`noteProviderSignIn`). Where the marker is absent, the
return records nothing: sessionStorage blocked or cleared, a return that lands in a different tab
from the press, or a provider flow started outside this app's own buttons. auth-js 2.115 also raises
`SIGNED_IN` from `_recoverAndRefresh` on a tab refocus and relays another tab's through its
broadcast channel, which is why the event alone can never name a sign-in. A method the session
itself could name on every path would need GoTrue to stamp the identity used on the session, which
it does not. Owner: the next auth pass, if a count of provider sign-ins without the marker ever
matters; until then the password path and every provider path from this app's own buttons are
recorded.

## G265. The public event page's `event_page_viewed` carries no object

**Severity: low. Opened 10 October 2026 by handoff 58-12C2 (PR #105), where the tree disagreed with
the handoff's "object `event`" for the public page. The number is assigned by this entry (ruling
638).**

The signed-in event page records `event_page_viewed` with the event as its object. The public page
`/e/{slug}` cannot: `public.event_public_page` builds its `event` object without the event's id
(`20260929120000_p2_event_presenter_topic.sql`, the public branch, and `PublicEventPage` types it as
`Omit<EventPageEvent, "id" | …>`), by design, so a signed-out reader learns nothing it can join on.
`record_event` takes `object_kind` and `object_id` together and refuses one without the other, and
the kind allows no prop, so `PublicEventSurface` records the view with the tab's session id, the
surface `event_public` and no object. The event funnel on the public side therefore counts views
and cannot attribute them to an event until the projection names one. The fix is one line in the
projection's public branch, `'id', v_event.id`, plus the type, and a decision that the id may be
public, which this PR does not take. Owner: Convene's next schema pass.

## G266. CI's live arms write rows into the production behaviour log

**Severity: medium. Invite-boundary gate (ruling 140). Opened 10 October 2026 by Chat's reading of
`public.surface_events` after handoff 58-12C2 merged (#105, `6f590a9`). The number is assigned by
this entry (ruling 638).**

Chat read 24 `surface_events` rows on 10 October written from sessions of `owner-test` and
`member-test`, the two ruling 218 test accounts. They are the matrix's live arms: every arm that
signs one of the two accounts into the deployed preview against the canonical project
(`tests/auth.cjs`'s accounts arm, `tests/messenger.cjs`'s `runMessengerLive`,
`tests/messenger-media.cjs`, `tests/messenger-composer-video.cjs`) drives the real recorder in
`src/lib/record.ts`, and the recorder does what it is built to do. The rolled-back live-db arms
write nothing; the mock-backed matrix arms answer `record_event` at the network layer and write
nothing. Only the arms that run the real app against the real project reach the table, and they run
on every push of every branch (`pages.yml`), so the log fills with harness behaviour at a rate no
member produces, and every rollup, the Overview's future behaviour reads and the story-led
attribution of 12C count it as DNA's.

What is not affected: `admin_overview_levers` reads product tables and never `surface_events`
(1615), so the Onboarding lever the founder verified is clean of this.

Proposed fix, not built here. The two accounts are already named in the schema by handle, in
`members_live_arms_select` and its siblings (`20260912020037_r382_live_arms_role.sql`,
`handle in ('owner-test', 'member-test')`), so `record_event` can refuse to write, returning as it
does over the rate ceiling, when `auth.uid()` is one of them: one `exists` on `public.members` by
handle inside the definer, named by a `private.is_test_account(uuid)` helper so the three places
that spell the pair today become one. That excludes every signed-in harness row at the writer, which
is where 1179 puts every decision about the log. It does not reach the signed-out rows the harness
writes on public pages, `event_page_viewed` on `/e/{slug}` and the three anonymous access kinds,
because an anonymous row carries no account; those need either a second sink (a `surface_events`
partition keyed on a harness marker the app does not send today) or a nightly delete keyed on the
harness's known session ids, neither of which the recorder's envelope supports without a change to
`record_event`'s signature. The decision between exclusion at the writer alone and a sink for the
anonymous remainder is the founder's, with counsel's view of 1179's retention, before the first
invite. Owner: the next 12C pass.

## G267. Supabase Auth's SMTP refuses with 535, so no auth email sends (W96)

**Severity: high. Invite-boundary gate (ruling 140). Opened 10 October 2026 from the founder's walk
of handoff 58-12C2 (#105), recorded as W96. The number is assigned by this entry (ruling 638).**

Every email Supabase Auth sends through the project's custom SMTP, the sign-up confirmation, the
password reset link, the magic link and the email change, fails at the provider with `535
Authentication credentials invalid`. The app's own flows are unchanged and correct: `/reset`
answers its fixed-delay sent state whatever the server does (ruling 156 applied to auth), sign-up
shows "Check your email", and neither surface can tell, by design, that nothing was sent. So a new
member cannot confirm an address and a member who has forgotten their password cannot reset it,
on production, until the credential is good.

The cause is the SMTP credential the project holds, not the code: the Resend account the sender
authenticates against is unpaid and its key is to be rotated, both the founder's. Nothing in the
tree names the key (ruling 387's module names addresses, never credentials). What closes it: the
founder pays the Resend account, mints a new key, and sets it as the project's SMTP password on
supabase.com; then one real reset on production proves the send, which is G268. Owner: the founder.

## G268. `password_reset_completed` is unverified on a real walk, blocked by G267

**Severity: low. Opened 10 October 2026 from the founder's walk of handoff 58-12C2 (#105). The
number is assigned by this entry (ruling 638).**

Done Means 3 of handoff 58-12C2 asked the founder's walk to leave a `password_reset_completed` row
with a session id and a null member. The walk left every other row it named, two anonymous
`password_reset_requested` rows among them, and could not reach `/reset/new`: the reset link never
arrived, because the project's SMTP refuses (G267). The kind is proven two ways short of a real
walk: the live-db arm `mobilAnonymous` records it signed in and signed out and reads back a null
member (`tests/live-db.cjs`), and the matrix's record arm lands a recovery session on `/reset/new`
against the mock and reads one call with no prop (`tests/record.cjs`). What is unproven is the
production path end to end, GoTrue's recovery mail through `/reset/new` to the row. It is proven
the first time a real reset completes on production after G267 closes, read by Chat from
`surface_events` as the walk would have. Owner: Chat, at the walk that follows G267.

## G269. Ruling 1455 is held: no writer of Story body image blocks exists

**Severity: low. Opened 11 October 2026 by handoff H60-MEDIA Work 8. The number is assigned by this
entry (ruling 638).**

1455 asks a Story's body image blocks to carry their framing the way a post's images now do (1643,
1709). Nothing writes a Story body image block: `BodyBlocks` is rendered by no file in `src/` outside
its own (read at `d0ac9fe`), `public.stories` holds a title and a body of text, and no write path takes
an image block. H60-MEDIA gives `BodyBlocks`' image block its own stored `width` and `height` and drops
its 16:9 default, so a block that arrives carrying its size is framed by the set; that is the whole of
what can be built. 1455 is unbuildable until a Story writer exists, and closes in the brief that builds
it, which names the block's storage and its framing beside the media row (1673). Owner: Chat, at that
brief.

## G270. Strand's openable `MediaBlock` image is a button that does not fill its line

**Severity: medium (visible). Opened 11 October 2026 during H60-MEDIA, filed under ruling 597. The
number is assigned by this entry (ruling 638).**

At compile `v1791654208929113` a single image that opens the viewer (1429) renders as a `button`, where
the frame was a `div`. A button is not stretched to its container's width as a block `div` is: outside a
parent that stretches it as a flex or grid item it shrinks to its content. On the member event page the
cover's frame read 62 by 78 at 390 (the local mount arm, before the fix), and a Messenger image bubble
takes the same path. The port sets `width: 100%` on the button and names it as its one visible
divergence (`src/components/strand/MediaBlock.tsx`, `docs/strand-ports/v1791654208929113-media.md`).
Strand's specimen sat its frames in a flex column, where the button is stretched, so the compile's
verifier could not see it. Closes when a compile carries the width, or when Chat rules the divergence
standing. Owner: Strand, by Chat's brief.

## G271. The profile's portrait and cover are not placed by their focal points: held for Strand item 13

**Severity: medium (visible). Opened 11 October 2026 by handoff 60-MEDIA-2 Work 6, under ruling 1714.
The number is assigned by this entry (ruling 638).**

`ProfileHeader` draws the portrait as a square `Avatar` and the cover as a raw `<img>` with
`object-fit: cover` placed by `coverFocus` (`docs/media-sites.md` rows 6 to 10). The framings owed are
1718's and 1719's: the portrait stays in its approved square, placed by the member's focal point, and
the cover always fills its band, placed by its focal point. Both land with Strand item 13
(`ProfileHeader` takes frames), and the header is not restyled at the call site. The onboarding photo
plate (row 11) draws the portrait's square and follows it. Since 60-MEDIA-2 a tap on either opens
`ImageViewer` on the master, whole, for every viewer; only the framing is held. Closes when item 13
lands and the cover's row leaves the Held table. Owner: Strand, by Chat's brief.

## G272. The discovery face crops its cover at 16:9: held for Strand item 12

**Severity: low. Opened 11 October 2026 by handoff 60-MEDIA-2 Work 6, under ruling 1714. The number is
assigned by this entry (ruling 638).**

`PostCard`'s discovery face draws its own `<img>` in a 16:9 box with `object-fit: cover`
(`docs/media-sites.md` row 12), the lane card on Discovery, so a host's flyer is cropped rather than
framed by the set, and a tap opens the event rather than the image. The crop is inside a Strand part
and is not hand-fixed (1714). Closes when Strand item 12 lands. Owner: Strand, by Chat's brief.

## G273. The composer's attachment tile crops a member's image: held for Strand items 10 and 11

**Severity: low. Opened 11 October 2026 by handoff 60-MEDIA-2 Work 6, under ruling 1714. The number is
assigned by this entry (ruling 638).**

The composer draws an attached image in its own 72 px square `<img>` with `object-fit: cover`
(`src/components/strand/Composer.tsx`, `docs/media-sites.md` row 13), so the member sees a crop of
what they are about to publish and cannot open it. The tile is inside a Strand part and is not
hand-fixed. Closes when Strand items 10 and 11 land. Owner: Strand, by Chat's brief.

## G274. `MediaBlock`'s strip and carousel crop and do not open the viewer, and no Strand item names them

**Severity: low (no surface renders them). Opened 11 October 2026 by handoff 60-MEDIA-2 Work 6, under
ruling 1714. The number is assigned by this entry (ruling 638).**

The strip draws square cells and the carousel fixed slides, both `object-fit: cover`, and neither
opens `ImageViewer` (`docs/media-sites.md` rows 14 and 15). Only `BodyBlocks`' group and carousel
blocks bind them, and `BodyBlocks` is rendered by no surface (G269), so no member sees either today.
The handoff names Strand items for the discovery face, `ProfileHeader` and the composer's tile, and
none for these. Closes when Chat names the item that brings them under 1714, and before any surface
binds `BodyBlocks`. Owner: Chat.

## G275. A digest is one message per notification: no copy is approved for a combined digest

**Severity: low while no kind carries copy (1520). Opened 11 October 2026 by handoff 60-NC Work 6.
The number is assigned by this entry (ruling 638).**

Closing G245 stopped `notify-deliver` skipping digest rows. Each digest row now goes at its due time
(the member's next 08:00) as its own message with its kind's own subject and line, because there is
no approved subject or framing for a message that gathers a member's day into one. A member on Daily
digest with five rows due gets five emails at 08:00. Owed: Design's copy for the combined digest,
then `deliver.ts` groups a member's due digest rows into one message carrying one token. Owner:
Chat, with Design.

## G276. Sign-in through Google or LinkedIn drops `next=email-preferences`

**Severity: low. Opened 11 October 2026 by handoff 60-NC Work 5. The number is assigned by this
entry (ruling 638).**

`/sign-in` maps `next=email-preferences` to the notification panel's email view when the member signs
in with an email and password, because the route itself navigates on the session. A provider round
trip leaves the page and returns to `/feed` through `startProvider`'s own redirect, which carries no
`next`, so a member who follows the unsubscribe page's link and signs in with a provider lands on the
Feed without the panel open. Closes when the provider redirect carries the same one-word value, or
when Settings takes the control over (1552) and the destination is a route. Owner: Code, by Chat's
brief.

## G277. Nothing purges `private.email_unsubscribe_tokens`

**Severity: low. Opened 11 October 2026 by handoff 60-NC. The number is assigned by this entry
(ruling 638).**

A token row stays after its 60-day expiry and after use. It goes only by cascade, when its outbox
row goes with its notification under the 180-day read purge (1324), so a token for a notification
that is never read is never removed. The row holds a hash and no address, and an expired token
answers `expired`, so nothing it holds is usable; the cost is growth. Owed: a retention ruling and a
purge beside `dna_notifications_purge_daily`. Owner: Chat.

## G278. The unsubscribe link in an email's body has no approved words

**Severity: low while no kind carries copy (1520). Opened 11 October 2026 by handoff 60-NC Work 6.
The number is assigned by this entry (ruling 638).**

The handoff asks that the body link to `/email/unsubscribed` with the token, and no sentence for it
is approved: SPEC-56 approves the landing page's strings and none for the email. `deliver.ts`
therefore ends the plain-text body with the bare URL on its own line after a blank line, and no
words around it. Owed: the line's copy, under 387 and 1035's plain-text rule until Design draws a
template. Owner: Chat, with Design.

## G279. `matrix.yml` still names the macOS gate as `pages.yml`'s job

**Severity: low. Opened 12 October 2026 by handoff 61-CI. The number is assigned by this entry
(ruling 638).**

Ruling 1735 moved `webkit-macos` from `pages.yml` to its own workflow, `webkit-macos.yml`, so that it
runs from the `pull_request` event on a ready head only. The handoff held every job in `matrix.yml`
unchanged, so two lines there still say "as pages.yml's webkit-macos job does": the `runner` input's
description at line 73 and the comment at line 178. Both describe what the macOS runner lacks (no
apt, no cores, no gdb), which is still true of the job where it now lives, so nothing reads them
wrongly but a reader looking for the job. Owed: both lines name `webkit-macos.yml`. Owner: Code, on
the next change that touches `matrix.yml`.

## G280. `live`'s 41-B F4 arm: `messenger_media_marked` lists nothing after a delete-for-everyone

**Severity: medium; `live` is red on every branch. Opened 12 October 2026 by handoff 61-CI. The
number is assigned by this entry (ruling 638).**

The arm "Brief 14 41-B (1343, F4): a delete-for-everyone marks the row, messenger_media_marked lists
it, messenger_media_forget drops it once and not twice" fails at step 8 of the `live` job. The send
and the delete both answer, then `marked` reads 0 where it should read 1. Because nothing is marked,
`messenger_media_forget` answers `false`. It is red on `main` at `5328568` (run 575) and on #110's
head `bae3cde` (run 576), with the same readings and the same totals (254 of 255 checks passed, 4
unproven), and #110 touches no database, Edge Function or Messenger code. The cause is not read:
either the delete no longer writes the mark `messenger_media_marked` reads, or the projection no
longer selects it on the canonical project. Owed: a reading of both functions against the arm, and
the fix in whichever is wrong. Owner: Code, by Chat's brief.

## G281. Four matrix arms pass and fail on the same app code

**Severity: low; non-crash failures in Linux matrix jobs that a merge reads. Opened 12 October 2026
by handoff 61-CI. The number is assigned by this entry (ruling 638).**

Run 574 (#109's head `30e266b`) and run 576 (#110's head `bae3cde`) ran the same app and test code.
#110 differs only in CI workflows, two scripts, docs and one comment line in `tests/matrix.cjs`. Four
checks, in three arms, passed on 574 and failed on 576, none of them behind a crash:

- `chromium-390x844-light-sheet-focus`: Tab from the Notifications title stays on the `h2`
  (`tests/sheet.cjs`, 1484). The mocked panel is empty, and the arm reads focus 150 ms after Tab.
- `webkit-390x844-light-mount-feed`: "header LensBar once scrolled: five tabs, no trailing seat, the
  52 track" read 0 bars.
- `webkit-1280x800-dark-messenger flows`: the click on the picker's "Folded hands" button timed out
  at 30 s, so the arm emitted 24 checks against its declared 23 (ruling 292).

Each reads a state that settles asynchronously, so the lead is a wait that ends before the state
does. That lead is not measured. Owed: per arm, a wait on the state itself rather than on time, or a
named cause if the product is at fault. Owner: Code.

**Addendum, 13 October 2026 (handoff 61-S1).** A fourth arm, from #110's PR comment of 22:53 PDT on
12 October: `chromium-1366x1024-dark profile owner`, check 5, "View as public matches the signed-out
page section for section" in `tests/profile.cjs`. On run 580 (#110's head `9edd660`, rebased on
`588a12b`) the owner's View as public listed no sections where the signed-out page listed ten; on
`main`'s run 579, the same app code, the check passed, and in run 580 itself it passed at every other
profile-owner cell. The arm reads `sectionIds` after a fixed 400 ms wait once the banner appears, so
it is the same fixed-wait class as the three above. The same owed item applies.

## G282. Cancel the change (A6) is held out of the email change

**Severity: low. Opened 13 October 2026 by handoff 61-S1 under ruling 1745. The number is assigned
by this entry (ruling 638).**

The extraction draws Cancel the change (A6) in the pending line of Sign-in and security, and
section 4 names its server action, `email_change_cancel()`, which Supabase Auth does not expose: a
pending `new_email` and its two confirmation tokens live in `auth.users`, which no member-facing
path writes. Ruling 1745 holds the act out, so the pending line carries A3 and Resend (A4) and no
Cancel; the change lapses when its tokens expire, or completes when both are opened (1668). Owed: a
ruling on whether a cancel exists at all, and if so its writer, which clears `new_email` and the
`email_change_token_*` columns for the caller only. Owner: Chat.

## G283. Set and Not set on the Password row are read from the email identity

**Severity: low; nothing is written wrongly. Opened 13 October 2026 by handoff 61-S1. The number is
assigned by this entry (ruling 638).**

The Sign-in methods rows come from `auth.getUserIdentities()` (extraction section 4), and the
client has no other read of whether a password is set: `encrypted_password` never leaves
`auth.users`. `methodsOf` in `src/lib/account.ts` therefore reads Set when an `email` identity
exists, which Supabase Auth creates for an account that signed up with an address and a password.
Whether setting a first password on a provider-only account (S6, Set a password) adds that identity
is not read in the tree and could not be verified on the canonical project, which holds no
provider-only test account; if it does not, such a member reads Not set and Set a password again
after a reload, and the A21 guard keeps standing although the password works. Owed: one provider
sign-in on the canonical project, Set a password, and a read of `auth.identities` after it; then
either nothing, or a definer read of `encrypted_password is not null` for the caller. Owner: Code,
by Chat's brief.

## G284. `?notifications=email` and `next=email-preferences` still open the panel's view, not the drawer's route

**Severity: low. Opened 13 October 2026 by handoff 61-S1. The number is assigned by this entry
(ruling 638).**

`src/routes/_shell/feed.tsx` says the Settings build repoints `?notifications=email` (1557) to the
email preferences' route once Settings takes the control over (1552). Handoff 61-S1 mounts the view
as `/settings/notifications` and changes nothing in the panel, so the parameter, and sign-in's
`next=email-preferences` that maps to it, still open the notification panel's email view and not
the drawer. Both entries reach the same rows (1552), so nothing is lost; what is owed is the one
destination 1552 names: the parameter and `next` resolve to `/settings/notifications`, which also
closes G276's provider half once the destination is a route. Owner: Code, by Chat's brief.

## G285. The two test accounts hold hundreds of `auth.sessions` rows

**Severity: low; test accounts only. Opened 13 October 2026 by handoff 61-S1, from run 584's live
job. The number is assigned by this entry (ruling 638).**

Every CI run signs the two ruling 218 accounts in over REST and never signs them out, and Supabase
Auth keeps a session row until it is revoked or expires, so `sessions_list()` answered 885 rows for
owner-test and 508 for member-test on 13 October. No real member is affected, but on those two
accounts Signed-in devices lists hundreds of rows, and the count grows by two or more on every run.
Owed: a ruling on whether the live arms sign their sessions out at the end of a run (a `logout` with
scope `local` per token), and a one-time purge of the rows already there, by the founder on the
project. Owner: Chat.
