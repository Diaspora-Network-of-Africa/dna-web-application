# Media sites (ruling 1716)

Every place on `main` where an image renders: every `<img>`, every CSS `background-image` (or
`background` shorthand) built from a URL, and every `Avatar`, `MediaBlock` and `ImageViewer`.
Ruling 1714 is the rule each row is read against: every image a member uploads, on every surface,
renders through Strand's image parts, framed by the frame set (1643, with 1672's one-step rule),
and opens full size on tap. Small identity marks are its one exception: they fill their shape,
centred.

Read at `main` `1e1c451` for handoff 60-MEDIA-2 Work 1, before any fix (commit `8a7d224`), and
brought to the branch's head after it: where a row changed, "Now" says what it did before. Brought to
handoff H61-SP's head (Strand compile `sha256-b1a458dac1bd562f`, 14 October 2026): the profile's
header is Strand's part, the discovery face and the composer's tile take the frame set's fixed-box
rule, and the Held table is empty. This file
is the list
`scripts/lint-media-sites.cjs` reads (`bun run lint`), so it is kept current with the tree: a site
that moves, a site that is added and a line that shifts are all edits here.

"Now" is one of: **framed** (MediaBlock's frame set chooses the frame), **cropped** (a fixed box
with `object-fit: cover`, nothing chooses it), **whole** (the image at its own ratio) or **fill**
(an identity mark filling its shape), followed by whether a tap opens the viewer.

## Member images

| #   | Site                                            | Surface and route                                                                                   | Part                                                            | Now                                                                                                                                                                                                                                                                      | 1714 requires                                                             | Status                                   |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | `src/components/strand/PostCard.tsx:531`        | Feed `/feed`, a post `/posts/$id`, each C's surface                                                 | `MediaBlock` (image, gallery)                                   | framed; tap opens the viewer                                                                                                                                                                                                                                             | as now                                                                    | Under 1714 (#107)                        |
| 2   | `src/components/dna/EventSurface.tsx:506`       | the member event page `/convene/events/$id`                                                         | `MediaBlock` (image)                                            | framed by its stored size; tap opens the viewer                                                                                                                                                                                                                          | as now                                                                    | Under 1714 (#107)                        |
| 3   | `src/components/dna/PublicEventSurface.tsx:187` | the public event page `/e/$slug`, `/x/$code`                                                        | `MediaBlock` (image, `ratio="21/9"` at two columns)             | framed by its stored size; at two columns the 21:9 fixed box (1185), filled within one ratio step (1.63:1 to 3.34:1) and whole on `--media-fill` past it (item 21, 1717); tap opens the viewer                                                                           | as now                                                                    | Under 1714 (H61-SP item 21)              |
| 4   | `src/components/dna/MessengerThread.tsx:295`    | a thread `/messages/$thread`, an image message                                                      | `MediaBlock` (image, `natural={420}`)                           | the bubble's media width at its own ratio, up to 420 tall, cropped from its centre, no fill (1738); tap opens the viewer                                                                                                                                                 | as now                                                                    | Under 1714 (#107)                        |
| 5   | `src/components/dna/MessengerThread.tsx:1481`   | a thread, the composer's attached image                                                             | `MediaBlock` (image, `ratio="1/1"`)                             | framed at the tile's fixed 1:1; tap opens the viewer                                                                                                                                                                                                                     | as now                                                                    | Under 1714 (#107)                        |
| 6   | `src/components/strand/ProfileHeader.tsx:413`   | a profile `/m/$handle`, the hero portrait (every tier)                                              | `ProfileHeader`'s plate: `Framed` (`:303`) or `Avatar` (`:306`) | the approved square, filled and placed by the focal point where `photoFrame` is passed (1719), the `Avatar` where none is (every profile until G292); a tap opens the viewer on the master for every viewer, the owner's camera badge its own "Change your photo" button | as now                                                                    | Under 1714 (H61-SP item 13)              |
| 7   | `src/components/strand/ProfileHeader.tsx:551`   | a profile at expanded, the split hero's cover                                                       | `ProfileHeader`'s `Framed` (`:275`, its `<img>` at `:172`)      | fills its band, placed by the focal point (1718); the band measured, its ratio the frame; `data-frame-box="cover"`, `data-frame="fill"`; a tap opens the viewer on the master whole ("Open image")                                                                       | as now                                                                    | Under 1714 (H61-SP item 13)              |
| 8   | `src/components/strand/ProfileHeader.tsx:630`   | a profile below expanded, the hero's cover                                                          | `ProfileHeader`'s `Framed` (`:275`)                             | as row 7                                                                                                                                                                                                                                                                 | as now                                                                    | Under 1714 (H61-SP item 13)              |
| 9   | `src/components/strand/ProfileHeader.tsx:579`   | the in-column masthead's portrait; no surface renders it (every `ProfileHeader` call passes `hero`) | `ProfileHeader`'s plate                                         | as row 6                                                                                                                                                                                                                                                                 | as now                                                                    | Under 1714 (H61-SP item 13)              |
| 10  | `src/components/strand/ProfileHeader.tsx:713`   | the in-column masthead's cover; no surface renders it                                               | `ProfileHeader`'s `Framed` (`:275`)                             | as row 7                                                                                                                                                                                                                                                                 | as now                                                                    | Under 1714 (H61-SP item 13)              |
| 11  | `src/components/dna/OnboardingSurface.tsx:450`  | onboarding `/welcome`, the chosen photo at the portrait's size (330)                                | `Avatar`                                                        | cropped square; no tap                                                                                                                                                                                                                                                   | the portrait's square, placed by its focal point, with the profile (1718) | Held: the frame the profile reads (G292) |
| 12  | `src/components/strand/PostCard.tsx:822`        | Discovery `/convene`, `/convene/$lens`, a lane card's event cover                                   | the discovery face's own `<img>` in its fixed 16:9 box          | placed through `imageFrame` and `placement` by the row's size, focal point and crop (item 12, 1697); within one ratio step of 16:9 (1.24:1 to 2.55:1) it fills, past it a flyer shows whole on `--media-fill` (item 21, 1717); `data-frame`; a tap opens the event       | as now                                                                    | Under 1714 (H61-SP items 12 and 21)      |
| 13  | `src/components/strand/Composer.tsx:936`        | the composer on every shell route, an attached image before publishing                              | `AttachmentTile` (`MediaBlock` image at 1:1, `:90`)             | the 80 square at the tile's fixed 1:1, placed by the image's own focal point and crop (items 10 and 11); not openable, by design (the tile is the composer's own control)                                                                                                | as now                                                                    | Under 1714 (H61-SP items 10 and 11)      |
| 14  | `src/components/strand/MediaBlock.tsx:866`      | no surface (`BodyBlocks`' group block, bound nowhere)                                               | `MediaBlock` strip                                              | cropped square cells; no tap                                                                                                                                                                                                                                             | the frame set; tap opens the viewer                                       | Held, no Strand item named (G274)        |
| 15  | `src/components/strand/MediaBlock.tsx:959`      | no surface (`BodyBlocks`' carousel block, bound nowhere)                                            | `MediaBlock` carousel                                           | cropped; no tap                                                                                                                                                                                                                                                          | the frame set; tap opens the viewer                                       | Held, no Strand item named (G274)        |
| 16  | `src/components/strand/BodyBlocks.tsx:209`      | no surface (bound nowhere, G269)                                                                    | `MediaBlock` (image)                                            | framed; tap opens the viewer                                                                                                                                                                                                                                             | as now                                                                    | Under 1714                               |
| 17  | `src/components/strand/ImageAdjust.tsx:326`     | the framing tool, the master being framed                                                           | `ImageAdjust`                                                   | whole, by design (the tool)                                                                                                                                                                                                                                              | as now                                                                    | Strand's own tool                        |
| 18  | `src/components/strand/ImageViewer.tsx:289`     | the viewer                                                                                          | `ImageViewer`                                                   | whole                                                                                                                                                                                                                                                                    | as now                                                                    | Strand's own viewer                      |

The parts' own `<img>` inside `MediaBlock` (`:326` single, `:490` gallery tile, `:622` and `:630`
video poster) are rows 1 to 5, 13 and 16 drawn; they are not separate sites. `ProfileHeader`'s one
`<img>` (`:172`, inside `Framed`) is rows 6 to 10 drawn: since H61-SP item 13 the header is Strand's
part and draws through MediaBlock's exported `imageFrame` and `placement`, so it is a Strand image
part and not a raw site.

**Count, member-image sites (rows 1 to 18).** Under 1714: 14 (rows 1 to 10, 12, 13, 16, and 3 under
item 21). Held: 1 (row 11, the onboarding plate, which takes the profile's frame when the projection
carries one, G292); no Strand item named, 2 (rows 14 and 15, G274). Strand's own tools: 2 (rows 17 and
18). Identity marks: 21 (rows 19 to 39).

## Identity marks (1714's exception)

Each fills its shape, centred, and opens nothing of its own: a tap on the row or card opens the
member, the thread or the post, never the photo.

| #   | Site                                             | Where                                                       |
| --- | ------------------------------------------------ | ----------------------------------------------------------- |
| 19  | `src/components/strand/PostCard.tsx:289`         | a post's author, 40                                         |
| 20  | `src/components/strand/PostCard.tsx:924`         | an event card's presenter, 24                               |
| 21  | `src/components/strand/Composer.tsx:1230`        | the composer's author line, 32                              |
| 22  | `src/components/strand/AppHeader.tsx:330`        | the header's own avatar, 36 and 32                          |
| 23  | `src/components/strand/ThreadRow.tsx:166`        | a Messenger thread row, 44                                  |
| 24  | `src/components/strand/RequestCard.tsx:69`       | a message request, 44                                       |
| 25  | `src/components/strand/SearchResultRow.tsx:50`   | a Messenger search result, 32                               |
| 26  | `src/components/strand/TokenSuggest.tsx:195`     | a token suggestion (the Messenger's mention list), 28       |
| 27  | `src/components/strand/PersonCard.tsx:95`        | a person tile (event going list, `EventSurface.tsx:726`)    |
| 28  | `src/components/strand/PersonCard.tsx:112`       | a person row (event people, `EventParts.tsx:270`, `:280`)   |
| 29  | `src/components/dna/MemberCard.tsx:428`          | a Connect card's portrait, 4:5 by the card's own box (1541) |
| 30  | `src/components/dna/MessengerThread.tsx:1135`    | the Messenger thread header, 40                             |
| 31  | `src/components/dna/MessengerSurface.tsx:330`    | the Messenger's connection picker, 32                       |
| 32  | `src/components/dna/IntroSheet.tsx:109`          | the introduction sheet's recipient, 48                      |
| 33  | `src/components/dna/MessageRequestSheet.tsx:117` | the message request sheet's recipient, 44                   |
| 34  | `src/components/dna/AttestationRail.tsx:105`     | an attester, 28                                             |
| 35  | `src/components/dna/ConnectSurface.tsx:498`      | a DIA suggestion row on Connect, 28                         |
| 36  | `src/components/dna/PostCardRouter.tsx:53`       | an event post's speaker chip, 32                            |
| 37  | `src/components/dna/EventParts.tsx:217`          | an event's host line, 40                                    |
| 38  | `src/components/strand/Comment.tsx:202`          | a comment's author, 32 (24 on a reply); bound nowhere yet   |
| 39  | `src/components/strand/PostCard.tsx:304`         | a post's author, 40 (row 19's current line)                 |

`Avatar` with no `src` draws initials and no image: `ProfileSurface.tsx:808`, `:826`, `:1482`,
`Rails.tsx:67`, `MessengerThread.tsx:2007`. `NotificationListItem` draws no image (its `role="img"`
is the C glyph).

## Not member images

Media a member did not upload, or no image at all: third-party link thumbnails, drawn by
`MediaBlock`'s link kind (`MediaBlock.tsx:646`; called from `PostCard.tsx:519`,
`EventParts.tsx:389`, `MessengerThread.tsx:197`, `:1496`), which show the linked page's own image;
and a Messenger video (`MessengerThread.tsx:271`), which plays in the browser's player, contained.

## Assets

The lint's allowlist. A raw `<img>` or a URL background outside `src/components/strand/` passes only
when its file and source are a row here, or a row in Held below. `Source` is text that appears in the
`src` attribute or in the `url(` expression.

| File                                        | Line | Source                                                | What                                   |
| ------------------------------------------- | ---- | ----------------------------------------------------- | -------------------------------------- |
| `src/components/dna/ProfileSurface.tsx`     | 1177 | `assetBase() + "logo.png"`                            | the wordmark, public profile chrome    |
| `src/components/dna/PublicEventSurface.tsx` | 361  | `assetBase() + "logo.png"`                            | the wordmark, public event chrome      |
| `src/components/dna/AuthHead.tsx`           | 45   | `assetBase() + "logo.png"`                            | the wordmark, sign-in                  |
| `src/components/dna/AuthSurface.tsx`        | 181  | `PROVIDER_MARK[p]`                                    | a sign-in provider's mark              |
| `src/components/dna/EventShareSheet.tsx`    | 187  | `code`                                                | the share sheet's QR code, generated   |
| `src/components/dna/PatternPicker.tsx`      | 64   | `url(" + base + "patterns/" + pt.id + "-pattern.svg)` | a pattern swatch                       |
| `src/components/dna/MemberCard.tsx`         | 137  | `url(" + assetBase() + "adinkra/nkonsonkonson.svg)`   | the Connect mark, a mask               |
| `admin/src/components/Enrolment.tsx`        | 68   | `enrolled.qrCode`                                     | the admin enrolment QR code, generated |
| `admin/src/routes/_console/settings.tsx`    | 1406 | `enrolled.qrCode`                                     | the admin enrolment QR code, generated |

Inside `src/components/strand/`, which the lint does not read, the assets are the wordmark
(`AppHeader.tsx`, `ConsoleShell.tsx:178`), the pattern ground (`EmptyState.tsx:50`), the masthead's
textile tiles (`ProfileHeader.tsx:460`, `:487`, `:548`, `:614`, `:626`, `:708`, since item 13 moved the
part here), the checkbox's tick (`Checkbox.tsx:50`) and the glyph masks (`Icon.tsx:15`, `CBadge.tsx:15`,
`PulseDock.tsx:37`, `BadgeRow.tsx:41`).

## Held

Raw member-image sites outside `src/components/strand/` that wait on a Strand item. The lint
passes them as recorded exceptions, each with its item and its gap; each row leaves when its item
lands. Empty since H61-SP: item 13 moved the profile cover's raw `<img>` into Strand's `ProfileHeader`.

| File | Line | Source | Strand item | Gap |
| ---- | ---- | ------ | ----------- | --- |
