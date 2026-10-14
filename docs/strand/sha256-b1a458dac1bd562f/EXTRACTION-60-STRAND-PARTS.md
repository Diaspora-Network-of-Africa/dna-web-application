# EXTRACTION-60-SP: the Strand parts for comments, reactions, tags and reframing

Session 60, 11 October 2026. Brief 60-SP (`uploads/DESIGN-BRIEF-60-STRAND-PARTS.md`, ruling 1699), with the 1704 addendum (items 18, 19), the 1711 and 1714 addendum (items 20, 21), and rulings 1717, 1718 and 1719. Written against the three ratified app extractions (1700): `EXTRACTION-60-FEED-CARD.md` (FC), `EXTRACTION-60-HASHTAGS.md` (HT), `EXTRACTION-60-REFRAME.md` (RF). **Approved and ratified under 1728** against export `sha256-b1a458dac1bd562f` (body SHA-256 `b1a458dac1bd562fa8741288fa41208d5c653e9adff4e238bd3c631f24c83482`): items 1 to 21 as drawn, `mic` as named, the 32 readout flags read as specimen content.

## 0. Compile (873)

- **Read before building:** `v1791654208929113` (brief 60-IF, ratified under 1673).
- **This compile:** `sha256-b1a458dac1bd562f`. **The host exposed no compile id (1727):** line 1 of the project `_ds_bundle.js` is the `@ds-bundle` manifest header, the bundle is served without a version, and `window.__DS_COMPILE_ID` is unset on a page. So the export is named by the first 16 hex of the SHA-256 of the project bundle as it stands, with the `ProfileHeader` ResizeObserver fix compiled in (item 19, note 3).
- **Export:** `export/strand-compile-sha256-b1a458dac1bd562f/`. The packed `_ds_bundle.js` is 667,736 bytes, SHA-256 `6005dba792ecc461775545de23bf314672ea0c4dbfd1ffae7961ac298ee5219b`. Its first line reads `/* @ds-compile-id: sha256-b1a458dac1bd562f */` and it sets `window.__DS_COMPILE_ID = 'sha256-b1a458dac1bd562f'`. Below the three header lines the body is the project bundle byte for byte (667,313 bytes, SHA-256 `b1a458dac1bd562fa8741288fa41208d5c653e9adff4e238bd3c631f24c83482`). Every file's size and hash is in the export's README.
- **`export/_ds/`** stays at `v1791495246160097`.

## 1. Proof against this compile

`screenshots/strand-parts-60/readout.html` loads each of the seven part pages against the project bundle 12 ways: light and dark, 390, 820 and 1280, touch and pointer. That is 84 loads. For each load it reads whether the page took the project bundle, the bundle's `__errors`, any page errors, the number of states drawn, any state that drew nothing, and digits in part text. Times, dates and the ratified T6 line are excluded from the digit check, and so are specimen labels and notes.

| page | loads | states | __errors | page errors | empty states | digits in parts |
|---|---|---|---|---|---|---|
| `postcard60` | 12 | 4 | 0 | 0 | – | – |
| `comments` | 12 | 13 | 0 | 0 | – | – |
| `reactions` | 12 | 11 | 0 | 0 | – | – |
| `tags` | 12 | 10 | 0 | 0 | – | state 7: 40 (T6), all 12 loads |
| `attach` | 12 | 10 | 0 | 0 | – | – |
| `settings60` | 12 | 3 | 0 | 0 | – | state 2: 380 (specimen), all 12 loads |
| `fixedbox` | 12 | 9 | 0 | 0 | state 9 at 390 and 820, 8 loads (by design: the split band is drawn at 1280 only) | – |

The readout's own pass/fail marks 32 of the 84 loads: the 12 `tags` and 12 `settings60` loads for the two digits named below, and the 8 `fixedbox` loads below 1280 for state 9, which draws only its note there. All three are specimen content, not part output. Every load took the project bundle with `__errors` 0 and no page error.

The one digit in a part page is a specimen line: `settings60` state 2 names the 380 width in its own body text. `tags` state 7 is T6, "A tag can be up to 40 letters.", which HT ratified. No part draws a count, rank or percentage.

**`fixedbox` readouts** (data-frame, per state):
- State 1: openable button width equals its container at every width (358.0 / 358.0 at 390, 788.0 / 788.0 at 820, 1248.0 / 1248.0 at 1280).
- State 2: `fixed-whole`. State 3: `fixed`. State 4: `fixed-whole · fixed`.
- States 5, 6, 7: `fill · fill` (the profile cover and photo, 1718, 1719).
- State 9 (1280 only): `fill · fill`.
- The same readouts in both themes and both input modes.

## 2. Parts, item by item

Where a part existed, it took a variant or a prop. Three parts were lifted out of a consumer rather than drawn again. Four parts are new.

### Group 1: the Feed card's shell
1. **`PostCard`, changed.** `below?: ReactNode` sits after the footer, inside the chassis and its 1.5px C frame, at the card's padding with a 12 gap. The app's style override on the continuation box goes away. Absent, the card is unchanged. (FC 5.2 item 1)

### Group 2: comments and reactions
2. **`Comment`, new.** Props: `name`, `avatarSrc`, `time`, `edited` (F14), `sending` (F16), `failed` with `onRetry` (F17), `text` (the caller renders it through `TagText`), `onReply` and `replyLabel` (top level only, 1677; F13), `menu`, `menuLabel` and `menuPortal` (F22), `deleted` and `deletedText` (the tombstone, F15, replies kept), `replies` (one level), `reply`, `presentation: 'thread' | 'latest'` with `onOpen` (F10), `input` and `style`. (FC 5.2 item 3)
3. **The comment composer is `MessageComposer`, changed, not a second part.** It already carries the reply and edit strips, the field and Send, so a second composer would do the same job. `attach={false}` drops Attach. **`mic={false}` drops the mic.** The brief's name was `voice`, but `voice` already names the attached voice note, so the switch is `mic`. Also new: `fieldLabel` (F18), `editingLabel` (F19 "Editing your comment") and `cancelLabel` (F19 "Cancel"). Token suggestions come through `TokenSuggest` (item 8). (FC 5.2 item 2)
4. **`ReactionRow`, lifted out of `MessageBubble`.** Props: `reactions` (`{ emoji, names?, own? }`), `names` (true, the default, gives the Messenger's pills; false gives the Feed's glyph-only pills with the viewer's own outlined in `--ink` on `--bg-sunken`, `aria-pressed`, 1674), `onReact`, `onSeeWho` and `seeWhoLabel` (author only, 1676; F5), `label` (F3), `nameOf`, `pop`, `input` and `style`. It wraps at 390 and never shows a count. `MessageBubble` now draws its pills through it, unchanged. (FC 5.2 item 4)
5. **`ReactionPicker`, lifted out of `MessageBubble`.** `view: 'quick' | 'full'`. The quick view is the eight (1587) plus More. The full view is search, skin tone, Recent, the caller's groups and the name line, as a Sheet on touch and a Popover on pointer. A press held for `holdMs` (500) names the glyph through `Tooltip`'s controlled `open` and swallows the tap that follows (1632, 1633). The eight and their names are `ReactionGlyph`'s, unchanged. The groups and names are passed in from `message_reaction_emoji`. `MessageBubble`'s `reactBar` is its quick view. (FC 5.2 item 7)
6. **`Tooltip`, changed.** `open?: boolean` makes it controlled: it shows while true on any input, touch included, and hover and focus no longer toggle it. Absent, it is uncontrolled as before. (FC 5.2 item 6)

### Group 3: tags
7. **`TagLink`, new, with `TagText`.** `TagLink` takes `tag`, `c`, `href`, `onOpen`, `children` and `style`. It renders an inline link in `--c-{c}-text` (`--ink` for system) at weight 500, in the author's case. There is no underline at rest, an underline on hover and a focus ring, and never a chip or a count (1683). Without `href` it is an inline button. `TagText` takes `parts` (the app's parser output), `c` and `onOpenTag`. `PostCard`'s body, `Comment` and the composer preview render tags through it. (HT 5.2 item 1)
8. **`TokenSuggest`, lifted out of `MessageComposer`'s mention listbox.** The listbox already existed for `@`, so lifting it gives `#` and `@` one behaviour. It is `role="listbox"` under a combobox at the caret, not a `Menu`. Props: `options` (`{ value, label, avatar? }`), `open`, `onChoose`, `onClose`, `label` (T2 "Tags"), `placement` (below, above or inline), `order` (alpha, the default, or given), `limit` (5), and `children`, a render prop. `Input` with `multiline` takes it as `tokens`. `MessageComposer` keeps `mentions` through it. Strand does no matching. (HT 5.2 item 2)
9. **`Input`, changed.** `note?: string` is a quiet line under the field, separate from `hint` and `error`: `--ink-2` at `--text-xs` after an info icon, in a polite `role="status"` region tied by `aria-describedby`. It is not DIA (1300). It carries T4 to T6. (HT 5.2 item 4)

### Group 4: the composer and attached images
10. **`Composer`, changed.** Images are held as data, `ComposerImage { key, src, alt, width, height, media_id, pending, focalPoint, crop }`, and `ComposerPost.media` carries them. New props: `onUpload(file)`, which returns the media row (until it resolves, the tile reads Uploading and Reframe is disabled); `onFraming(image, value)` for `media_set_framing`; `tags` (`{ find, suggest, parse, note }`, all the app's); `maxImages` (4); and `initialReframe` (review harnesses only). Reframe opens `ImageAdjust`: on touch as a second view inside the Sheet (`pushed`), on pointer inline above the live preview (1695). The preview is fed the framing and renders tags through `TagLink`. A reserved word gets the note line (1685). Post never waits on reframing. (RF 5.2 item 2, HT 5.2 item 3)
11. **`AttachmentTile`, new.** Props: `src`, `alt`, `width`, `height`, `focalPoint`, `crop`, `pending` (R4, Reframe disabled), `reframed` (R3, 1696), `onRemove` (R7), `onReframe` (R1, named R2), `active`, the four label overrides, `input` and `style`. Its two consumers are the composer and Edit; put the tiles in a list named R9. (RF 5.2 item 4)

### Group 5: framing in two existing parts
12. **`PostCard`'s discovery face, changed.** It keeps its own fixed 16:9 box with `--radius-m`, and places `media.focalPoint` and `media.crop` through MediaBlock's exported `imageFrame` and `placement` (1697). The face opens the event, never the viewer, so it does not render through `MediaBlock`. Under item 21 its box takes `--media-fill` and `data-frame`. (RF 5.2 item 1)
13. **`ProfileHeader`, new to Strand.** It is landed from the app's `profile/strand-patch/Profile.jsx`, attached unchanged, and draws as the staged file draws it with three changes:
    - Strand's own `IdentityMark` replaces the staged copy, so one part does that job.
    - `coverFrame` and `photoFrame` (`{ width, height, focalPoint, crop }`) are placed through `imageFrame` and `placement`. They replace `coverFocus`, which is removed.
    - The cover is reframed in its tier's own box (1694): the part measures the band and fixes the frame to its ratio. **1718:** the profile cover is an exception to 1714. It always fills its band by focal point at every tier, and is never shown whole on the fill. A tap on the cover (Open image, MediaBlock's string, not new) opens `ImageViewer` on the whole image. **1719:** the portrait stays square in the plate, filled and placed by focal point. 4:5 stays MemberCard's.

    Without stored dimensions, the size is read from the file on load. The cover box carries `data-frame="fill"`. The other props are unchanged from the staged file: `member`, `identified`, `owner`, `onAvatar`, `onCover`, `hero`, `split`, `condensed`, `lock`, `condensedAvatar`, `bleed`, `gutter`, `coverHeight`, `avatarSize`, `actions`, `children` and `style`. **Not in this compile:** `SectionCard`, `VisibilitySelect`, `VocabularyPicker`, `SegmentBlock`, `CCard`, `CSheetBody`, `AttestationRail` and `PatternPicker` stay staged in the app. `BadgeRow`, `LinkRow` and `IdentityMark` were already Strand's, so their staged copies are not read. (RF 5.2 item 3)

### Group 6: shared behaviour
14. **`Sheet`, changed.** `pushed?: { title, onBack, backLabel? }` is a second view inside the same sheet. Back (R8) and the title replace the title row, and Close stays. Escape goes back. Focus moves to the pushed heading when the view arrives and back to the sheet's heading when it returns. Absent, unchanged. (RF 5.2 item 5; 60-S)

### Carried from 1673
15. **`ConsoleShell`, changed (1649).** A destination's explanatory line reads `--ink-2`; it was `--ink-3`, which measured 4.00:1 on the current row's tint.
16. **`--weight-semibold: 600` (1650).** It is the console's current-row weight, now a token.
17. **`--c-system-tint` restated in the dark block.** It read the light `#F2EDE5` in the dark theme before.

### Addendum 1704
18. **`Sheet`, changed.** `size="account"` is the account drawer. Above compact it reads `--sheet-panel-width` (380) at `--z-sheet`, so it no longer borrows `size="notification"` and its raised layer. At compact it is the ordinary bottom sheet. `--sheet-notification-width` now aliases `--sheet-panel-width`, with its value unchanged.
19. **`Switch`, changed.** `hint?: string` is a 13px `--ink-3` line under the label, tied to the switch by `aria-describedby`, as on Input and Select. With a hint, the row aligns to the top. Absent, unchanged.

### Addendum 1711, 1714 and rulings 1717 to 1719
20. **`MediaBlock`, changed (1711).** The openable image's button is `width: 100%` and `box-sizing: border-box`, like the plain frame, so it fills its container. The proof reads the same width for the button and the container at every load. **The app's divergence G270 closes when it rebinds to this compile.**
21. **`MediaBlock`, changed (1714, 1717).** A fixed box keeps its shape. That covers MediaBlock's `ratio`, the discovery face's 16:9 (item 12) and the public event page's 21:9. An image within one ratio step of the box fills it, placed by focal point. Beyond that, by its stored size, it shows whole on `--media-fill` (`data-frame="fixed-whole"`). This is 1672's rule applied to fixed boxes. One ratio step (1717) is the frame set's neighbour step at the box's ratio. 16:9 sits between 4:3 and 1.91:1 and takes 1.91 / (4/3), so it fills from 1.24:1 to 2.55:1. 21:9 is past the wide end and takes 1.91:1's step, so it fills from 1.63:1 to 3.34:1. On a frame of the set, the step is the wider of its two. Without stored dimensions a ratioed image fills as before. New export: `fixedStep(R)`. The profile cover is the 1718 exception (item 13). Drawn: a portrait flyer in a 16:9 lane card (whole on the fill), a 4:3 photograph in the same card (fills), the 21:9 event cover with a flyer (whole) and a 16:9 photograph (fills), and a portrait photo set as a profile cover (fills by focal point, 1718).

## 3. Tokens added or changed

| token | value | layer | file | item |
|---|---|---|---|---|
| `--weight-semibold` | `600` | LAYER 1, a primitive | `tokens/typography.css` | 16 (1650) |
| `--sheet-panel-width` | `380px` | LAYER 2 | `tokens/spacing.css` | 18 (1704) |
| `--sheet-notification-width` | `var(--sheet-panel-width)`, was `380px`; value unchanged | LAYER 2 | `tokens/spacing.css` | 18 |
| `--c-system-tint` | restated as `var(--bg-sunken)` in `[data-theme="dark"]` | LAYER 2 | `tokens/colors.css` | 17 (1673) |

No other token was added. Items 20 and 21 use `--media-fill` and the four `--media-frame-*` tokens from 1643 unchanged. No icon was added; every icon the new parts name is already in `assets/icons/`.

## 4. Strings

**No string is new.** Every string the parts carry was ratified in the three extractions or already belonged to a part, and each is used verbatim:

- **FC:** F3 Reactions; F4 the emoji names (passed in); F5 See who reacted; F8 React, More, Search emoji, Skin tone, Recent, No emoji match.; F10 the latest line; F13 Reply; F14 Edited; F15 This comment was deleted.; F16 Sending; F17 Did not send., Try again; F18 Write a comment, Write a reply; F19 Replying to {first}, Editing your comment, Cancel; F20 Send, Save; F22 More.
- **HT:** T1 #{tag}; T2 Tags; T3 the suggestion rows; T4 to T6 the note line, passed in by the app.
- **RF:** R1 Reframe; R2 Reframe {alt}; R3 Reframed; R4 Uploading; R5 Done; R6 the second view's line; R7 Remove image; R8 Back; R9 Attached images; R10 Preview.
- **Existing:** "Open image" (MediaBlock, used for the profile cover's tap); Add a cover, Change cover and Change your photo (ProfileHeader, as staged); "Not chosen" (the skin tone default, 1576).

## 5. App pages that must rebind and be proven under 755

B60-FeedCard, B60-Hashtags, B60-Reframe, B60-Settings, B2 Shell-Feed, B3 Profile, Convene and Messenger.

- **B3 Profile:** import `ProfileHeader` from Strand and drop the staged copy. Pass `coverFrame` and `photoFrame` from the media rows, and drop the `coverFocus` conversion. Keep `SectionCard`, `VisibilitySelect` and the rest of `Profile.jsx` staged.
- **Convene:** the lane card's flyer now shows whole on the fill when it is past one step of 16:9. The event page's 21:9 cover is passed as `ratio="21/9"`.
- **G270** closes on rebind (item 20).

## 6. Notes

1. **`mic`, not `voice`** (item 3). The brief's name was already taken by the attached voice note.
2. **The profile cover tap.** The cover is a button with Open image. The owner's Change cover sits over it as its own control. The plate keeps Change your photo.
3. **`ProfileHeader`'s band measurement** is batched to the next frame, so a resize never re-enters the observer in the same frame.
4. **The specimen pages** are `components/dna/{postcard60,comments,reactions,tags,attach,fixedbox}.card.html` and `components/core/settings60.card.html`, with the shared chrome in `components/dna/spec-60sp.js`. The chrome sets theme, width (390, 820, 1280) and input, by control or by query string.
