# DNA Brief 5 — Onboarding — Handoff spec

Extracted from `onboarding/B5-Onboarding-v2.dc.html`, approved at ruling 330 (gate 3). Rulings governing this surface: 62, 65, 67, 97, 107, 156, 171, 180, 181, 212, 222, 235, 242, 244, 247, 248, 259, 279, 293 to 300, 307 to 309, 311, 315, 320 to 331; sections 3, 6, 7 and 10 corrected to H-BS7-STANCE (1856 to 1862) under 763. Code reads this file; it never reads the page markup. Section 11 names every place the two differ.

Not in this spec (arrives in the Code handoff): schema, migration, RLS, RPC bodies.

Copy rules throughout: sentence case, no em dashes, no emoji, no exclamation marks, no numeral on any screen (308). Tokens by name only.

---

## 1. Routes and entry

- Three routes, one per screen: `/welcome`, `/where`, `/relationship`. Signed-in only (156). Nothing else is reachable until `onboarded_at` is set (307): any guarded route redirects to the first incomplete screen.
- Entry after email confirmation (4B), or after a Google or LinkedIn signup (235). Provider signups arrive with `name` prefilled from the provider and nothing else. Onboarding runs in full on every path.
- Resume (307): on any entry, the server resolves the first null of `name`, `current_place`, `onboarded_at` and routes there. Screens already completed are not re-shown on resume; Back reaches them.
- Exit: screen three's write sets `onboarded_at` and the client navigates to the Feed. Nothing follows (259): no affirmation, no welcome, no tour.
- No progress indicator, step counter, percentage, checklist or completeness signal anywhere (308). No deadline copy anywhere (309).

## 2. Layout per tier

Anonymous auth layout, identical to 4B sign-in: no `AppHeader`, no `PulseDock`, no rail (219 precedent). Three frames; there is no fourth.

| Tier | Column | Padding | Heading | Notes |
| --- | --- | --- | --- | --- |
| Compact 390 | full width, max 448 incl. padding | `32px 24px 64px` | 30 display, centred | page scrolls |
| Medium 820 | 400, centred | `64px 32px` | 30 display, centred | page scrolls |
| Expanded 1280 | 400, centred | `64px 32px` | 30 display, centred | screen three's card grid bleeds to 1200 (section 6) |

- Head: Strand's `AuthHead` (Design pass 01, B9 item 5, rulings 377, 390, 491). Logo `assets/logo.png`
  48 tall on compact and 56 above, top-aligned in an 84/100 band whose height never changes with
  content, then `--auth-head-gap`, a centred heading and a centred lead. The 80 is retired; nothing
  else sizes the wordmark. Onboarding holds the top of the column and never centres vertically (487).
- `main aria-labelledby` the h1. DOM order on every screen: heading, lead, (chosen line), alert, form fields, primary control, Back (180). Back never precedes the heading.
- Heading `--font-display` 400 30/1.15, centred, `text-wrap: balance`. Lead sans 17/1.5 `--ink-2`, centred. Section gap 24; form gap 24; control stack gap 12.
- Ground `--bg`. Cards and panels `--surface`. No shadow. Both themes via tokens only.

## 3. Copy, verbatim

Screen one (`/welcome`)
- Heading: Welcome to the Diaspora Network of Africa.
- Lead (328): Your name, a username and a photo to begin. Where you are, and your relationship to the continent, come next.
- Name label: Your name. Hint: As you'd like to be known here.
- Username label: Username. Hint (326, amended by ruling 411, Design pass 01 B9 item 3): We'll suggest one from your name.
  The hint names no count of changes; the two-changes policy stands and is delivered by User Settings (37).
- A refused username shows the reason in the field's own line and Continue never disables silently
  (ruling 434, B9 item 4). Three reasons, ruling 496 verbatim: "Usernames use a to z, 0 to 9 and
  hyphens. Remove the accents and try again." / "Usernames are at least three characters." /
  "Usernames cannot start or end with a hyphen." The photo gate (324) still holds Continue.
- The name field starts empty and is never derived from the email local part (ruling 469, B9 item 2).
- A Sign out text link in the footer of every screen: 44 tall, `--ink-2`, underlined, offset 3 (413).
- Photo label: Photo. Empty control: Add a photo. Chosen controls: Change photo, Remove.
- Photo too large alert: That photo is too large. Choose a smaller one and try again.
- Photo failed alert: We couldn't add that photo just now. Nothing else you entered is lost. Try again.
- Username taken alert: That username is taken. Choose another, or keep the one we suggest.
- Continue: Continue

Screen two (`/where`)
- Heading: Where are you right now?
- Lead: The city and country you're living in today. This helps people near you, and people from where you are, find you.
- Labels: City, Country. Country empty option: Select a country
- Continue: Continue. Back: Back

Screen three (`/relationship`)
- Heading: What's your relationship to the continent right now?
- Lead (300's sub-heading): There's no wrong answer here, and nothing is permanent. Choose what feels closest to where you are today.
- Six cards (300, 331; 1856, 1857, 1859, 1861), verbatim, in this order, which is `public.member_stances.position` (1859). Each is title, body, label. The title is the stance's label in `public.member_stances`, read through `vocabularies()`; no component holds the order or the titles (187).
  - Kin. You're of the African Diaspora, by birth, by ancestry or by heritage. Return isn't your path, and that's completely alright. You're here for the people, the culture, the ideas and the work. Connection matters on its own terms, and you belong here without needing a plan. Label: I am Kin
  - Returnee. You're of the African Diaspora and you're moving toward the continent in some way, whether your family left one generation ago or many. That might be visiting more often, investing, building something, relocating one day, or simply keeping the door open. Return looks different for everyone, and all of it counts. Label: I am a Returnee
  - Bridge. You live across both. Your life, work or family keeps you moving between the continent and the Diaspora, and neither place is the one you're leaving. You carry each side to the other, and that movement is what you bring. Label: I am a Bridge
  - Anchor. You're on the continent, living and rooted there. You might have been born there, found your way back, or made your home in an African country other than the one you're from. You might be building something or teaching, studying, creating, raising a family. What matters is that you're present, and that when the Diaspora reaches toward this work, you're who they reach. Label: I am an Anchor
  - Ally. You're not of the Diaspora, and you're choosing to show up anyway. You might be family by marriage, a partner in the work, or someone who stands with it. What you bring might be capital, expertise, networks, time or advocacy, and it strengthens the work. You walk alongside. You support and partner. You don't represent. Label: I am an Ally
  - Still exploring. You've arrived and you're not ready to name where you fit yet, which is honestly the most reasonable place to start. Take your time, look around, and choose when it feels right. Nothing here is waiting on you. Label: I'm still exploring
- Chosen line (327): You're marked as still exploring for now. Change it below if something fits better.
- Footer (300): You can change this whenever you like. It's meant to move as you do.
- Explainer link: What these mean, and why we ask
- Finish: Finish. Back: Back

Resume, any screen: lead replaced by Welcome back. Let's pick up where you left off.

Save failed, any screen (4B pattern): We couldn't save that just now. Nothing you entered is lost. Try again.

Explainer sheet (248, 321): section 7.

## 4. Screen one: who you are (324 to 326, 330)

Three required controls, peers in one form, gap 24. Continue is live only when name is non-empty, the username field is non-empty (the suggestion counts), and a photo is chosen (324).

- Name: Strand `Input`, `autocomplete="name"`. Provider entry prefills it.
- Username: Strand `Input`, `autocomplete="off"`. Derived suggestion (section 9) fills the field once a name exists and the member has not typed in the field. Typing replaces it. No availability round trip, no debounce, no per-keystroke query (brief, legacy anti-pattern). Collision surfaces on save as the taken alert with the field in error; the suggestion remains available.
- Photo: label "Photo" (sans 15/500 `--ink-2`) above a row: plate then control(s). Plate: 4px `--bg`, radius 22, no border (330; on this ground it reads as nothing, which is correct). Inside: Strand `Avatar` at 96 on compact, 120 on medium and expanded, radius 18 (profile spec section 1). Empty state: a `--bg-sunken` square of the same size and radius with `camera` icon 24 in `--ink-3`. Chosen state: `Avatar` with `src`, plus Change photo (secondary Button) and Remove (text button, 44 tall). Pick to done is one step: tap, pick, shown. No crop step (324 mitigation). Too large and failed are alerts (section 8); the name and username are untouched by either.
- Write on Continue: `name`, `username`, `avatar_url`. Screen one's RPC.

## 5. Screen two: where you are

- City: Strand `Input`, `autocomplete="address-level2"`.
- Country: Strand `Select`, options from ruling 242's world list, first option value empty labelled Select a country.
- Continue is disabled until both are present. City typed with no country is a disabled Continue and nothing else: no error, nothing has failed.
- Write on Continue: `current_place` (city, country). Screen two's RPC.
- Country of origin, heritage, return pathway, focus areas, industries, regions and intentions are profile sections and are not asked here.

## 6. Screen three: relationship to the continent (297, 300, 320, 327, 329)

- Chosen line under the lead: sans 15/1.5 `--ink`, centred, `padding 10px 14px`, radius `--radius-m`, `--bg-sunken`, `role="status"`. Rendered while the selection is the default and untouched; hidden the moment the member touches any card (329). It never returns within the session.
- Cards: `role="radiogroup"` labelled by the heading text; each card `role="radio"`, `aria-checked`, `aria-disabled` while saving. Roving tabindex: the checked card is the single tab stop; arrow keys move selection and focus; Space and Enter select.
- Card chassis: `--surface`, radius `--radius-l` (14), padding 20/19, gap 14, `1px --line`. Selected: `1.5px --ink` frame, padding 19/18 so the box does not shift. Title row: radio glyph 22 (`circle` in `--ink-3`; `circle-dot` in `--c-connect` when selected) then title `--font-display` 400 22/1.2. Body sans 15/1.65 `--ink-2`. Label sans 15, 500 `--ink-3`, 700 `--ink` when selected, pinned to the card foot.
- Cards come from `vocabularies().stances`, six in `public.member_stances.position` order (187, 1859); each card's body and foot label are section 3's copy for that value. A vocabulary that does not load renders no card (194); Finish still writes the default.
- Layout (320, amended by 1860): compact and medium stack the six cards in a column, gap 12, full column width. Expanded shows the six as two rows of three, read left to right: `grid repeat(3, minmax(0,1fr))`, gap 12, bleeding out of the 400 column to 1200 (inset 40 each side of the 1280 frame), cards equal height within a row. No horizontal scrolling at any tier, no scroll indicator.
- Still exploring is `aria-checked` on load. Finish is enabled without any interaction.
- Footer and link follow the cards, centred; the link is a text button, 44 tall, underlined, `--ink`.
- Write on Finish: `stance`; `stance_declared_at` only if the member touched a card in this session (touched is a client flag set by any selection, including re-selecting the default); `onboarded_at` set once by the same write path. Screen three's RPC. Opening the explainer does not set touched.

## 7. Explainer sheet (222, 248, 321)

Strand `Sheet`, `label` "What these mean, and why we ask". Ruling 492: one size on every sheet.
Compact: `variant="sheet"`, height 80 percent of the viewport, radius 14 top. Medium and expanded:
`variant="drawer"`, width 40 percent of the viewport; the 65 percent drawer is retired. Scrim and
Esc close, and the Sheet manages focus (heading in, opener out, trapped while open; rulings 222, 480).

Focus (222): on open, focus moves to the sheet h2 (`tabIndex=-1`); on close, focus returns to the link that opened it.

Body: padding `20px 20px 8px` compact, `40px 32px 16px` otherwise; column max 620 centred on drawer; section gap 28. Order and copy, verbatim:

1. h2: What these mean, and why we ask
2. Lead: DNA connects people across the African Diaspora and the continent, and the way it finds people for you starts here. Your answer shapes who you're suggested to, and who sees you when they search by relationship. It never ranks you, and no one is ever shown a score.
3. Kicker (13 caps `--ink-3`): What the six mean. Five paragraphs (1862), sans 15/1.6 `--ink-2`:
   - Kin and Returnees are both of the Diaspora. The difference is direction, not belonging. Kin is here for the people, the culture and the work; a Returnee is moving toward the continent in some way.
   - A Bridge lives across both, at home on the continent and in the Diaspora at once. They carry each side to the other.
   - An Anchor is on the continent, born there, returned, or rooted in an African country other than their own. They are who the Diaspora reaches.
   - An Ally is not of the Diaspora and chooses to contribute. They walk alongside.
   - Still exploring is a real answer, and most people start there.
4. Kicker: What changes when you choose. Six rows in `public.member_stances.position` order (1859, 1862), the term being the stance's label from `vocabularies()`, `grid 132px 1fr` (single column on compact), `1px --line` above each, padding `12px 0`; term `--font-display` 19, body sans 15/1.55 `--ink-2`:
   - Kin: DNA looks for people rather than plans: members who share your city, your heritage or your work, wherever they sit. Nothing assumes you are moving, and nothing asks you about it again.
   - Returnee: DNA points you toward Anchors on the continent and members building in the same direction, at whatever pace suits the life you have. You surface when someone looks for people facing the continent.
   - Bridge: You're reachable from both sides. Members on the continent and in the Diaspora can find you, and DNA suggests you where a connection needs someone who knows both places. Nothing asks you to pick one.
   - Anchor: You become reachable to a Diaspora looking for partners on the ground, in your city and your field. Intros, Space invitations and event asks tend to arrive here first, because you are who they reach.
   - Ally: DNA matches what you bring to the Needs and Spaces that asked for it. You are never put in front of the Diaspora as one of them. You walk alongside, and the distinction holds everywhere it matters.
   - Still exploring: Nothing narrows. You are suggested broadly and you see the whole network while you look around. DNA records that you have not answered yet, not that you answered no.
5. Panel, `--bg-sunken`, radius 14, padding 16. Title (display 19): The Return. Body: The Return is DNA's name for the movement of the Diaspora back toward the continent, in every form it takes: visits, investment, building, relocation, advocacy. You don't have to be part of it to be part of DNA.
6. Close line: You can change your answer whenever you like, and changing it changes nothing about what you've already done here.
7. Got it: primary Button. Compact: pinned footer, `padding 12px 20px 20px`, `1px --line` above. Drawer: inline after the close line, max width 280, 24 below.

No five-C content in onboarding (322). Orientation belongs to the Feed's empty state and the five entry points.

## 8. States per screen

| State | Screen | Rendering |
| --- | --- | --- |
| Entry | all | as sections 4 to 6 |
| Provider prefilled | one | name filled, nothing else |
| Username suggested | one | field holds the derived name; hint unchanged |
| Photo chosen | one | Avatar with image, Change photo, Remove |
| Photo too large | one | alert; photo stays empty; name and username kept |
| Photo failed | one | alert; photo stays empty; name and username kept |
| Username taken | one | alert; username field `error`; photo and name kept |
| City, no country | two | Continue disabled; no alert |
| Member chose a stance | three | chosen line hidden; touched true |
| Explainer open | three | section 7 |
| Saving | all | form `aria-busy`; every control disabled; Continue or Finish keeps its label |
| Save failed | all | alert; nothing cleared |
| Resume | any | lead replaced; fields hold what was saved |

Alert (4B pattern): `role="alert"`, `tabIndex=-1`, focus moves to it on render; `1px --error` border, `--surface`, radius `--radius-m`, `info` icon 18 in `--error`, sans 15/1.45 `--ink`. One alert at a time; it sits between the lead (or chosen line) and the form.

## 9. Username derivation (325)

Client and server derive the same string: trim, lowercase, strip everything except `a-z 0-9 space -`, spaces to `-`, collapse repeated `-`, trim leading and trailing `-`. Example: "Thandiwe Dube" gives `thandiwe-dube`. On collision at save the server does not append a suffix; it returns the taken state and the member chooses. The derived suggestion, accepted or untouched, is not one of the member's two changes (325); the first deliberate choice on this screen is free, and the two changes follow it.

## 10. Data, writes and measures (307, 311)

- Screen one RPC: `name`, `username`, `avatar_url`. Returns taken on username collision.
- Screen two RPC: `current_place`.
- Screen three RPC: `stance`, `stance_declared_at` (only when touched), `onboarded_at` (once). No separate completion call.
- `stance` values: the `public.stance` enum, `kin | returnee | bridge | anchor | ally | exploring` (1856), listed here in `public.member_stances.position` order (1859), which is the one order any surface shows; database default `exploring`.
- Resume reads the first null of `name`, `current_place`, `onboarded_at`.
- Company-facing (311), emitted at each write: completion and abandonment per screen; time on screen three; stance declared versus default; photo and username adoption here versus later; completion by entry path (email, Google, LinkedIn). Add: explainer opens.
- Matrix arm (279): layout at nine viewports, state proofs on two.

## 11. Where the page and this spec differ

- The page's country list is trimmed to prove the picker; Code reads ruling 242's full list.
- The page fakes saves with a 900ms delay and always succeeds unless a review state is chosen; Code's RPCs return the real outcome.
- The page's chosen photo is `assets/imagery/hero-professional.jpeg`; Code shows the member's upload.
- Review bar, frame labels and URL pills are prototype chrome, not part of the surface.
- The page renders all three frames at once; production is fluid between the review widths.

## 12. Strings not in Brief 5

Ruled after the brief: 326, 327, 328 leads and hints; 323 photo and username state copy (section 3). Unruled and used: "Select a country", "Photo", "Change photo", "Remove", the sheet kickers "What the five mean" and "What changes when you choose", and the five what-changes paragraphs in section 7. Ratified by approval at 330.

Status: v2 approved at ruling 330 (gate 3); spec completed under 331. Ready for Code handoff.
