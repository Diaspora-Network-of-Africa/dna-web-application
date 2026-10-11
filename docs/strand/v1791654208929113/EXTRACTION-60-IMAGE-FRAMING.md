# EXTRACTION-60-IF: images are framed, never chopped

Session 60, 10 October 2026. Brief 60-IF (`uploads/DESIGN-BRIEF-60-IMAGE-FRAMING.md`, `v1791652809637867`), written against main `6ce161f`. Rulings 1643 (the brief), 346, 347, 348, 351, 55, 1115, 1117, 1118, 1134, 1455, 1541. Path 1. Strand read no app file (663); every tree fact is the brief's. **Approved by the founder, 10 October 2026, at compile `v1791654208929113`, as drawn: §7 items 1 to 11 included (four frames with 4:3; the within-one-step fill past an end; the fill from tokens; the gallery's frame from the first image). Awaiting Chat's ratification (129); nothing here is canonical until then.** No surface is drawn; the app project draws the composer preview and the author's post in a follow-up brief.

## 0. Compile (873)

- **Read before any source was touched:** `v1791619610379042`, the compile the three extractions of 10 October ship against (`export/strand-compile-v1791619610379042/`).
- **The compile that carries this brief: `v1791654208929113`**, read off the project `_ds_bundle.js` on 10 October 2026 at the start of the step after the source turn (873). All 76 source hashes in its header are the SHA-256 prefixes of the files on disk (`MediaBlock.jsx` `223d09b18904`, `ImageAdjust.jsx` `50fa0228d655`; the five parts of the 10 October pass unchanged), so no source changed after it and no further compile ran. One compile (Done Means 4). The source turn's first compile, before the verifier's dark-fill finding was fixed (`--media-fill` restated in the dark block), was never read and is held. `Popover`'s focus return stays held (1626); nothing else was changed. Export, byte count, SHA-256 and the blank check in §9.
- **Pre-compile check** (`screenshots/framing-60/precheck.html`, a reading instrument, not exported): `MediaBlock.jsx` and `ImageAdjust.jsx` transpiled in the page against `v1791619610379042`, then the specimen card's own script run against them in place of the namespace, so the whole card was seen before the compile. `console.error` count **0**. Readouts in §6; captures `screenshots/framing-60/*.jpg` (the capture tool does not render mask icons, so Zoom out and Zoom in are blank squares in them; the DOM readout names both).

## 1. Work 1: MediaBlock framing (1643), item by item

**1. The set, and how a frame is chosen.** Four frames, named in tokens and mirrored in the component for the choice: `--media-frame-tall` 4:5, `--media-frame-square` 1:1, `--media-frame-photo` 4:3, `--media-frame-wide` 1.91:1. Strand proposes **four, not Chat's three**: 4:3 is added (§7 item 1). An image takes the frame nearest its own ratio, nearest measured by quotient (`|ln(r / f)|`), so the boundary between neighbours is their geometric mean and a frame is never further from the image than the gap between two neighbours. `ratio` (1115) still wins as a fixed frame. The frame is drawn from the token (`aspect-ratio: var(--media-frame-…)`); only the choice uses the numbers.

What the seven ratios of the Done Means get, and the two between frames:

| image | frame | what the frame cannot hold | placed by |
|---|---|---|---|
| 9:16 | 4:5 | nothing: whole on the fill, left and right | — |
| 3:4 | 4:5 | 6% of the height | focal point |
| 4:5 | 4:5 | nothing | — |
| 1:1 | 1:1 | nothing | — |
| 4:3 | 4:3 | nothing | — |
| 16:9 | 1.91:1 | 7% of the height | focal point |
| 3:1 | 1.91:1 | nothing: whole on the fill, above and below | — |
| 3:2 | 4:3 | 11% of the width | focal point |
| 2:3 | 4:5 | 17% of the height | focal point |

Under Chat's three the same files would lose 25% of a 4:3's width (to 1:1) and 22% of a 3:2's height (to 1.91:1); those are the group photographs that lose their edges.

**2. Position by focal point.** `focalPoint {x, y}` in 0 to 1 from the media row. Wherever the image is covered (the near frame, a fixed ratio, a video poster), `object-position` is solved so the point sits in the frame where it sits in the image: with `v` the share of the image the frame shows along the cropped axis (`frame / image` or its inverse), position = `(focal − v / 2) / (1 − v)`, clamped to 0..1; the uncropped axis is 50%. With no focal point the image is centred. The image is never stretched: cover and contain only (1541). Not read when the image is whole, where there is nothing to place.

**3. Never crop past the subject; past the ends.** By construction a crop is never more than one neighbour gap. Past an end the image may still fill the end frame while the difference is within that end's own step, the same bound the rule puts on every crop: taller than 4:5 down to 16:25 (0.64), wider than 1.91:1 up to 2.74:1. Further than that (a 9:16 or 9:19.5 screenshot, a 3:1 panorama) the frame is the end frame and the image shows **whole, contained, centred on `--media-fill`**, which is `--bg-sunken` in both themes (`#F2EDE5` light, `#1E1D1A` dark, the token restated in the dark block): the system's neutral, not a black bar. The fill is not taken from the image (§7 item 3). Drawn in both themes (frames 1 and 7, both columns; the chrome's theme control).

**4. Galleries of two, three and four.** The gallery's frame is chosen **from the first image**: the lead's orientation (portrait, square, landscape; a tile with no dimensions counts as landscape) and the count pick one of the same four frames and the layout.

| count | portrait lead | square or landscape lead |
|---|---|---|
| 2 | 4:3, side by side: two 2:3 tiles | 1.91:1, side by side: two near-square tiles |
| 3 | 4:3, the lead down the left (a 2:3 tile) beside two 4:3 tiles | 1:1, the lead across the top two thirds (a 3:2 tile) over two 3:2 tiles |
| 4 | 4:5, a two by two of 4:5 | 1:1 (square lead) or 4:3 (landscape lead), a two by two of the same |

Every tile keeps its crop (1431, unchanged) and is placed by **its own focal point** against the shape it is really shown in; `items` take URLs or `{ src, alt, width, height, focalPoint, crop }`. `ratio` replaces the frame and keeps the layout. The former 16:10 grid with equal rows is gone; it put a 3.2:1 tile over every three-image gallery.

**5. Loading.** The stored dimensions choose the frame and its `aspect-ratio` reserves the height before the file arrives (as 1429 did); new: a frame whose `src` is not yet set (the Feed signs URLs after the record) renders as the fill alone, `data-loading`, so the card does not move when the image lands (frame 17).

**6. The expanded card and the viewer.** `whole` draws the image at its own ratio, uncropped, no frame set and no cap, for the expanded card (frame 18); with no dimensions, the file's natural height. `ImageViewer` already showed the master whole (1429, 1431) and is untouched; a tapped image or tile opens the master, whatever the card cropped (frame 19).

**Also in Work 1.** An author's `crop` from ImageAdjust picks the frame by the region's own ratio and is placed exactly (absolute, `left/top/width/height` from the region) when that ratio is the frame's within 3%; a crop that does not match the frame (a caller's `ratio`) lends its centre as the focal point (frame 10). A **video poster** with stored dimensions follows the same rule and is placed by its focal point (guardrail 4, frame 20); with neither ratio nor dimensions it stays 16:9 as before. Audio and link previews are unchanged. The frame's ground, behind every image, gallery and video, is `--media-fill`.

## 2. Work 2: ImageAdjust (348)

New part, `components/dna/ImageAdjust.jsx` (with `.d.ts`, `.prompt.md`). Exported on the namespace as `ImageAdjust`.

**What it is.** Pan and zoom inside a fixed frame: the frame the card will use, chosen by MediaBlock's own `imageFrame` from the master's stored dimensions, or the `ratio` the caller fixes. What the frame shows is what the card shows from the value written (the two share one geometry), so there is no separate preview. Auto-fit is the default and reframing is never required. Zoom is measured against filling the frame and runs to `maxZoom` (3). For an image the card shows whole (past the ends), auto-fit is whole; the first zoom step fills the frame, and the span between whole and filled, which would be part fill and part image, is never shown in either direction.

**What it writes (351).** `onChange({ focalPoint, crop })`, the media row's two fields: `focalPoint` is the centre of what the frame shows, `crop` the region shown, both as fractions of the master; `crop` is written only once the image is zoomed past filling (or filled from whole); auto-fit writes both `null`. Values are rounded to four places. The master is never rewritten; filters and colour are out of scope.

**Input.** Pointer: drag pans, grab and grabbing cursors. Touch: one finger pans, two pinch (Pointer Events, `touch-action: none` inside the frame, pointer capture). Keyboard: the frame is one tab stop (`role="group"`, `aria-roledescription="image framing"`), named "Reframe: {alt}. Drag to move the image; arrow keys nudge; plus and minus zoom."; arrow keys move the frame over the image by 2% of the frame (10% with Shift); `+`/`=` and `-`/`_` zoom by a step of 1.25. Controls under the frame: Zoom out and Zoom in (`IconButton`, 44 on touch and 36 on a pointer, icons `minus` and `plus`) and Reset (a ghost `Button`, named "Reset to auto-fit"); each is disabled at its limit and never absent, so nothing moves under the thumb. No number is shown anywhere (guardrail 2). A change is written at the end of a drag or pinch, on every key press and on each control.

**Where it is reached** is the app's to draw (composer preview; the author's own post). `value` reopens the part where the author left it.

## 3. Props added

`MediaBlock` (`MediaBlock.d.ts`):

| prop | type | reads |
|---|---|---|
| `focalPoint` | `{ x, y }` 0..1 | image, video, gallery tiles: the point kept in view |
| `crop` | `{ x, y, width, height }` 0..1 | image, video, gallery tiles: the author's region |
| `whole` | boolean | image: own ratio, uncropped (the expanded card) |
| `items` | `(string \| MediaImage)[]` | gallery: a tile may carry `src, alt, width, height, focalPoint, crop` (`MediaImage` is new in the `.d.ts`) |
| `width`, `height` | number | now also read by `kind="video"` for the poster's frame |

`ImageAdjust` (`ImageAdjust.d.ts`): `src`, `alt`, `width`, `height`, `ratio`, `value`, `defaultValue`, `onChange`, `input`, `maxZoom` (3), `label` ("Reframe"), `proofFocus` (specimens only), `style`; `AdjustValue { focalPoint, crop }`.

`PostCard.d.ts`: `media` gains `focalPoint`, `crop`, `whole`, and `items` as `(string | MediaImage)[]`; `PostCard.jsx` spreads `media` into MediaBlock unchanged, so nothing else was touched there.

Exported for proofs and for ImageAdjust, not on the namespace (lower case): `imageFrame`, `placement`, `galleryFrame`, `ratioNum`.

## 4. Tokens added

| token | file | value | reads |
|---|---|---|---|
| `--media-frame-tall` | spacing.css | `4 / 5` | the portrait frame, the tallest |
| `--media-frame-square` | spacing.css | `1 / 1` | |
| `--media-frame-photo` | spacing.css | `4 / 3` | the landscape phone photograph |
| `--media-frame-wide` | spacing.css | `1.91 / 1` | the widest frame |
| `--media-fill` | colors.css | `var(--bg-sunken)`, declared in `:root` **and again in `[data-theme="dark"]`** | the ground past the ends and before the file arrives: `#F2EDE5` light, `#1E1D1A` dark. A `var()` alias resolves where it is declared, so the dark block must restate it or the light value would inherit (the verifier caught exactly that before the compile; §7 item 11) |

No token was changed. One icon added: `assets/icons/minus.svg` (Lucide minus, 1.5px stroke, as `plus.svg`). The spacing.css note that kept 1429's band in the component is reworded to point at the set.

## 5. Specimens: `components/dna/framing.card.html`

Card **"Media: framed, never chopped"**, group Components, viewport 1360×4200. One chrome drives every frame: theme Light or Dark, width Compact 360 / Medium 744 / Expanded 1280, input Pointer or Touch, and a section filter (All, Frames, Galleries, Loading-whole-video, ImageAdjust). The column is `max-width: 680px` with 16px padding, so media renders at 328 at 360 and 680 at 744 and 1280. Placeholders are drawings, not photographs: a flat ground, a thirds grid, corner ticks, the ratio written top left and a **subject** (head and shoulders in a ring) at a chosen point, so the focal point's work is readable.

| # | draws | Done Means |
|---|---|---|
| 1 to 7 | 9:16, 3:4, 4:5, 1:1, 4:3, 16:9, 3:1; left centred, right with the focal point on the subject (0.8, 0.14); two columns at 744 and above | the seven ratios, with and without a focal point, three widths, both themes |
| 8, 9 | 3:2 and 2:3, between frames, the largest crops the set asks for | |
| 10 | the author's crop placed exactly | |
| 11 to 16 | galleries of 2, 3, 4, mixed shapes, landscape-led and portrait-led, each tile with its own focal point | galleries |
| 17 | before the file arrives: the frame alone, beside the loaded frame | loading |
| 18 | `whole`: the expanded card | the whole image |
| 19 | the viewer, contained, with a 9:16 image | |
| 20 | a 3:2 video poster in 4:3 with its focal point | guardrail 4 |
| 21 | `ratio="16/9"` still wins, now placed by the focal point | 1430 regression |
| 22 to 26 | ImageAdjust: default (live, with a proof readout of what it writes), panned, zoomed, reset (starts zoomed), keyboard focus | every state, on the chrome's input |
| 27, 28 | ImageAdjust on a 3:1 (whole first) and on a fixed 16/9 frame | |

## 6. Readouts from the pre-compile check (pointer, light, 360)

| check | reading |
|---|---|
| `imageFrame` for the nine ratios | 9:16 tall (contain) · 3:4 tall (near) · 4:5 tall (exact) · 1:1 square (exact) · 4:3 photo (exact) · 16:9 wide (near) · 3:1 wide (contain) · 3:2 photo (near) · 2:3 tall (near) · no size: wide (unknown, contain) |
| `galleryFrame` | 2 landscape lead wide/columns · 2 portrait lead photo/columns · 3 landscape lead square/lead-top · 3 portrait lead photo/lead-left · 4 landscape lead photo/grid · 4 portrait lead tall/grid · 4 square lead square/grid |
| rendered frames | 23 image frames; `data-frame`/`data-frame-set` by state as the table in §1 says; the first three at 328×410 (4:5) |
| 16:9 `object-position`, centred then focal | none (centred) · `50% 0%` (the subject at y 0.14 holds the image to the top) |
| the author's crop (frame 10) | `left −46.87% top −19.44% width 156.25% height 138.89%`: the region 0.3, 0.14, 0.64 × 0.72 of the 3:2 file, exactly |
| ImageAdjust, ArrowRight from auto-fit | `{ focalPoint: { x: 0.5178, y: 0.5 }, crop: null }`, `data-state="panned"` (2% of the frame = 0.0178 of a 3:2 image shown at 0.889 of its width in 4:3) |
| then `+` | `{ focalPoint: { x: 0.5178, y: 0.5 }, crop: { x: 0.1622, y: 0.1, width: 0.7111, height: 0.8 } }`, `zoomed`; the region's ratio is 4:3 |
| then Reset | `{ focalPoint: null, crop: null }`, `auto` |
| states 23 to 28 | panned · zoomed · zoomed · panned · auto (wide, whole first) · auto (fixed) |
| names | the frame: "Reframe: A 3:2 image. Drag to move the image; arrow keys nudge; plus and minus zoom."; buttons: Zoom out (disabled at auto-fit), Zoom in, Reset to auto-fit (disabled at auto-fit) |
| the fill in dark (verifier, then re-read) | with `data-theme="dark"` on the frame, the 9:16 frame's `background-color` reads `rgb(30, 29, 26)` (`#1E1D1A`) after the dark block restates `--media-fill`; before that line it read `rgb(242, 237, 229)` |
| `console.error` | 0 |

## 7. Decisions no ruling covers, and wants a ruling

1. **Four frames, not three (wants a ruling).** Chat's lean was 4:5, 1:1, 1.91:1. Strand adds 4:3 (`--media-frame-photo`): it is the landscape phone photograph, the single most common shape after 3:4, and under three frames it loses a quarter of its width to 1:1, which is the group photograph losing its edges. The cost is one more height in the feed. The brief said Strand proposes the set; this is the proposal, with §1's table for the comparison.
2. **How far past an end an image still fills the frame (decision inside 1643).** The brief's words make everything taller than 4:5 "past the ends" and whole on the fill, which would put thin side bars on every 3:4 portrait (6%) and 2:3 (17%). Drawn instead with the rule's own bound: within one neighbour step past an end the image fills the end frame placed by its focal point; beyond it, whole on the fill. 3:4 and 2:3 fill 4:5; 9:16 is whole. 16:9 and 2.35:1 fill 1.91:1; 3:1 is whole.
3. **The fill is the system's neutral, not taken from the image (decision).** Guardrail 3 says fills come from tokens, and 1429 ratified no blur, no gradient, no second copy of the image behind the frame; `--media-fill` is `--bg-sunken` in both themes, which is a step off the surface, never black. An image-derived fill would be a second copy and could not be a token. If Chat wants it, it is a `fill` prop on the same part.
4. **The gallery's frame comes from the first image (the brief asked which).** The lead's orientation and the count, §1 item 4. Chosen so a portrait-led set stands and a landscape-led set lies, and so a two-up is never taller than 4:3. The old 16:10 equal-row grid is gone (1431's "tiles keep their crop" holds).
5. **ImageAdjust writes `crop` only once zoomed past filling** (or filled from whole); a pan alone writes the focal point and `crop: null`, which MediaBlock reproduces exactly from the same geometry. The whole-to-filled snap (§2) is Strand's reading of the chopped look the brief refuses.
6. **Arrow keys move the frame over the image**, so ArrowRight shows more of the right side, the convention of a crop tool rather than of dragging the picture. A pointer drag moves the picture.
7. **`data-frame` values** are now `exact | near | tall | wide | fixed | unknown | whole` (W62's `none` became `exact`; `near` and `fixed` are new), with `data-frame-set` and `data-gallery-layout` beside them, for proofs.
8. **Zoom out and Zoom in are disabled at their limits, not absent.** The discovery face's rule (1096) keeps menu items absent rather than disabled; a stepper at its end is a different case, and an absent control would move Reset under the thumb. Wants a ruling only if Chat reads 1096 as general.
9. **`proofFocus`** on ImageAdjust paints the focus ring for a static frame; specimens only, as 1547 treated `contained` and `autoFocus`.
10. **Not touched, by instruction:** `MessageBubble.d.ts` still says an image frame is "MediaBlock's 1429 band" (words only; the part renders through MediaBlock and takes the set); the Convene discovery face draws its own 16:9 box outside MediaBlock (1430) and is unchanged; `strip` and `carousel` keep their square and 16:9 cells; `Popover`'s focus return is held (1626).
11. **For the record, out of this brief's scope:** `--c-system-tint: var(--bg-sunken)` has the same alias trap as §4 notes for `--media-fill`: declared in `:root` only, it reads `#F2EDE5` in the dark theme. Not changed here (Work 1 and 2 only); one line in the dark block fixes it when a brief owns it.

## 8. Parts changed, in one list

Changed: `MediaBlock` (`.jsx`, `.d.ts`, `.prompt.md`), `PostCard.d.ts` (the `media` type only). New: `ImageAdjust` (`.jsx`, `.d.ts`, `.prompt.md`), `components/dna/framing.card.html`, `assets/icons/minus.svg`. Tokens: `tokens/spacing.css` (four frames, one note reworded), `tokens/colors.css` (`--media-fill`, in `:root` and restated in the dark block). Instrument: `screenshots/framing-60/precheck.html` and its captures. Records: this file; `readme.md` (the component index names `ImageAdjust`). No other part, no surface, no page, no app-project file. **Admin: none. DIA: none.**

## 9. Compile, export and the blank check

| check | reading |
|---|---|
| compile id, read off the project `_ds_bundle.js` (873) | **`v1791654208929113`**, 10 October 2026; built on `v1791619610379042`; 69 components, 41 cards, 247 tokens in the manifest |
| export | `export/strand-compile-v1791654208929113/_ds_bundle.js`: line 1 `/* @ds-compile-id: v1791654208929113 */`, line 3 `window.__DS_COMPILE_ID = 'v1791654208929113'`, the project bundle byte for byte below; **583,281 bytes, SHA-256 `f63958b279426f96ebb4ea3e07a815db79e52e571e755ac6d9f91ad27cf82687`** (the project body 582,928 bytes, `1dd2a98e12b8610b09ad0738e34fe5345c7559cbd8821e9152a6ac1d160e1a4e`). Beside it: `styles.css`, `tokens/colors.css`, `tokens/spacing.css` (the two token files this pass changed, and the sheet that imports them), `assets/icons/minus.svg`, this extraction and `README.md` (byte counts and SHA-256s read after the copy, 995). `export/_ds/` stays at `v1791495246160097` |
| blank page (`screenshots/framing-60/blank-export.html`: React and the exported bundle, nothing else, rendering nothing) | `window.__DS_COMPILE_ID` `v1791654208929113`; **`__errors` 0**; 69 exports on the namespace; `MediaBlock`, `ImageAdjust`, `ImageViewer`, `PostCard`, `LensBar`, `Popover` all functions |
| the specimen against the compiled bundle | `components/dna/framing.card.html` opened on `v1791654208929113`: the readings of §6 hold; the verifier's pass is the record |
| held | `Popover`'s focus return (correction 56 §12a, 1578): 1626 |
