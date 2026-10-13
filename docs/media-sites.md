# Media sites (ruling 1716)

Every place on `main` where an image renders: every `<img>`, every CSS `background-image` (or
`background` shorthand) built from a URL, and every `Avatar`, `MediaBlock` and `ImageViewer`.
Ruling 1714 is the rule each row is read against: every image a member uploads, on every surface,
renders through Strand's image parts, framed by the frame set (1643, with 1672's one-step rule),
and opens full size on tap. Small identity marks are its one exception: they fill their shape,
centred.

Read at `main` `1e1c451` for handoff 60-MEDIA-2 Work 1, before any fix (commit `8a7d224`), and
brought to the branch's head after it: where a row changed, "Now" says what it did before. This file
is the list
`scripts/lint-media-sites.cjs` reads (`bun run lint`), so it is kept current with the tree: a site
that moves, a site that is added and a line that shifts are all edits here.

"Now" is one of: **framed** (MediaBlock's frame set chooses the frame), **cropped** (a fixed box
with `object-fit: cover`, nothing chooses it), **whole** (the image at its own ratio) or **fill**
(an identity mark filling its shape), followed by whether a tap opens the viewer.

## Member images

| #   | Site                                            | Surface and route                                                                                   | Part                                  | Now                                                                                                                                                                                                     | 1714 requires                                                                     | Status                                                      |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `src/components/strand/PostCard.tsx:516`        | Feed `/feed`, a post `/posts/$id`, each C's surface                                                 | `MediaBlock` (image, gallery)         | framed; tap opens the viewer                                                                                                                                                                            | as now                                                                            | Under 1714 (#107)                                           |
| 2   | `src/components/dna/EventSurface.tsx:506`       | the member event page `/convene/events/$id`                                                         | `MediaBlock` (image)                  | framed by its stored size; tap opens the viewer                                                                                                                                                         | as now                                                                            | Under 1714 (#107)                                           |
| 3   | `src/components/dna/PublicEventSurface.tsx:187` | the public event page `/e/$slug`, `/x/$code`                                                        | `MediaBlock` (image)                  | framed by its stored size, 21:9 at two columns (1185); tap opens the viewer                                                                                                                             | as now                                                                            | Under 1714 (#107)                                           |
| 4   | `src/components/dna/MessengerThread.tsx:295`    | a thread `/messages/$thread`, an image message                                                      | `MediaBlock` (image, `natural={420}`) | the bubble's media width at its own ratio, up to 420 tall, cropped from its centre, no fill (1738); tap opens the viewer                                                                                | as now                                                                            | Under 1714 (#107)                                           |
| 5   | `src/components/dna/MessengerThread.tsx:1481`   | a thread, the composer's attached image                                                             | `MediaBlock` (image, `ratio="1/1"`)   | framed at the tile's fixed 1:1; tap opens the viewer                                                                                                                                                    | as now                                                                            | Under 1714 (#107)                                           |
| 6   | `src/components/dna/ProfileHeader.tsx:247`      | a profile `/m/$handle`, the hero portrait (every tier)                                              | `Avatar` in the plate                 | cropped square; a tap opens the viewer on the master for every viewer, the owner's camera badge its own "Change your photo" button (before: the owner's tap changed the photo, a visitor's did nothing) | the approved square, placed by its focal point (1718); tap opens the master whole | Tap moved (60-MEDIA-2); framing held, Strand item 13 (G271) |
| 7   | `src/components/dna/ProfileHeader.tsx:391`      | a profile at expanded, the split hero's cover                                                       | raw `<img>` in `coverImage` (`:183`)  | cropped (`object-fit: cover`, `coverFocus`); a tap opens the viewer on the master (before: no tap)                                                                                                      | fills its band, placed by its focal point (1719); tap opens the master whole      | Tap moved (60-MEDIA-2); framing held, Strand item 13 (G271) |
| 8   | `src/components/dna/ProfileHeader.tsx:481`      | a profile below expanded, the hero's cover                                                          | raw `<img>` in `coverImage` (`:183`)  | cropped (`object-fit: cover`, `coverFocus`); a tap opens the viewer on the master (before: no tap)                                                                                                      | fills its band, placed by its focal point (1719); tap opens the master whole      | Tap moved (60-MEDIA-2); framing held, Strand item 13 (G271) |
| 9   | `src/components/dna/ProfileHeader.tsx:425`      | the in-column masthead's portrait; no surface renders it (every `ProfileHeader` call passes `hero`) | `Avatar`                              | cropped square; a tap opens the viewer on the master (before: the owner's tap changed the photo)                                                                                                        | the approved square, placed by its focal point (1718); tap opens the master whole | Tap moved (60-MEDIA-2); framing held, Strand item 13 (G271) |
| 10  | `src/components/dna/ProfileHeader.tsx:573`      | the in-column masthead's cover; no surface renders it                                               | raw `<img>` in `coverImage` (`:183`)  | cropped; a tap opens the viewer on the master (before: no tap)                                                                                                                                          | fills its band, placed by its focal point (1719); tap opens the master whole      | Tap moved (60-MEDIA-2); framing held, Strand item 13 (G271) |
| 11  | `src/components/dna/OnboardingSurface.tsx:450`  | onboarding `/welcome`, the chosen photo at the portrait's size (330)                                | `Avatar`                              | cropped square; no tap                                                                                                                                                                                  | the portrait's square, placed by its focal point, with the profile (1718)         | Held, Strand item 13 (G271)                                 |
| 12  | `src/components/strand/PostCard.tsx:792`        | Discovery `/convene`, `/convene/$lens`, a lane card's event cover                                   | the discovery face's own `<img>`      | cropped 16:9 (1077); a tap opens the event                                                                                                                                                              | the frame set                                                                     | Held, Strand item 12 (G272)                                 |
| 13  | `src/components/strand/Composer.tsx:834`        | the composer on every shell route, an attached image before publishing                              | the attachment tile's own `<img>`     | cropped 72 square; no tap                                                                                                                                                                               | the frame set                                                                     | Held, Strand items 10 and 11 (G273)                         |
| 14  | `src/components/strand/MediaBlock.tsx:826`      | no surface (`BodyBlocks`' group block, bound nowhere)                                               | `MediaBlock` strip                    | cropped square cells; no tap                                                                                                                                                                            | the frame set; tap opens the viewer                                               | Held, no Strand item named (G274)                           |
| 15  | `src/components/strand/MediaBlock.tsx:919`      | no surface (`BodyBlocks`' carousel block, bound nowhere)                                            | `MediaBlock` carousel                 | cropped; no tap                                                                                                                                                                                         | the frame set; tap opens the viewer                                               | Held, no Strand item named (G274)                           |
| 16  | `src/components/strand/BodyBlocks.tsx:209`      | no surface (bound nowhere, G269)                                                                    | `MediaBlock` (image)                  | framed; tap opens the viewer                                                                                                                                                                            | as now                                                                            | Under 1714                                                  |
| 17  | `src/components/strand/ImageAdjust.tsx:326`     | the framing tool, the master being framed                                                           | `ImageAdjust`                         | whole, by design (the tool)                                                                                                                                                                             | as now                                                                            | Strand's own tool                                           |
| 18  | `src/components/strand/ImageViewer.tsx:289`     | the viewer                                                                                          | `ImageViewer`                         | whole                                                                                                                                                                                                   | as now                                                                            | Strand's own viewer                                         |

The parts' own `<img>` inside `MediaBlock` (`:295` single, `:450` gallery tile, `:582` and `:590`
video poster) are rows 1 to 5 and 16 drawn; they are not separate sites.

**Count, member-image sites (rows 1 to 18).** Under 1714 before this handoff: 6 (rows 1 to 5, and
16, which no surface renders). Moved by 60-MEDIA-2: 5, the profile's portrait and cover (rows 6 to
10), whose tap now opens the master whole while their framing is held for item 13. Held by Strand
item: item 13, 6 (rows 6 to 11, G271); item 12, 1 (row 12, G272); items 10 and 11, 1 (row 13, G273);
no item named, 2 (rows 14 and 15, G274). Strand's own tools: 2 (rows 17 and 18). Identity marks: 19
(rows 19 to 37).

## Identity marks (1714's exception)

Each fills its shape, centred, and opens nothing of its own: a tap on the row or card opens the
member, the thread or the post, never the photo.

| #   | Site                                             | Where                                                       |
| --- | ------------------------------------------------ | ----------------------------------------------------------- |
| 19  | `src/components/strand/PostCard.tsx:289`         | a post's author, 40                                         |
| 20  | `src/components/strand/PostCard.tsx:924`         | an event card's presenter, 24                               |
| 21  | `src/components/strand/Composer.tsx:1099`        | the composer's author line, 32                              |
| 22  | `src/components/strand/AppHeader.tsx:330`        | the header's own avatar, 36 and 32                          |
| 23  | `src/components/strand/ThreadRow.tsx:166`        | a Messenger thread row, 44                                  |
| 24  | `src/components/strand/RequestCard.tsx:69`       | a message request, 44                                       |
| 25  | `src/components/strand/SearchResultRow.tsx:50`   | a Messenger search result, 32                               |
| 26  | `src/components/strand/MessageComposer.tsx:348`  | a mention suggestion, 28                                    |
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
| `src/components/dna/ProfileSurface.tsx`     | 1188 | `assetBase() + "logo.png"`                            | the wordmark, public profile chrome    |
| `src/components/dna/PublicEventSurface.tsx` | 360  | `assetBase() + "logo.png"`                            | the wordmark, public event chrome      |
| `src/components/dna/AuthHead.tsx`           | 45   | `assetBase() + "logo.png"`                            | the wordmark, sign-in                  |
| `src/components/dna/AuthSurface.tsx`        | 181  | `PROVIDER_MARK[p]`                                    | a sign-in provider's mark              |
| `src/components/dna/EventShareSheet.tsx`    | 187  | `code`                                                | the share sheet's QR code, generated   |
| `src/components/dna/ProfileHeader.tsx`      | 300  | `url(" + tile + ")`                                   | the masthead's textile tile            |
| `src/components/dna/ProfileHeader.tsx`      | 327  | `url(" + tile + ")`                                   | the masthead's textile tile            |
| `src/components/dna/ProfileHeader.tsx`      | 388  | `url(" + tile + ")`                                   | the textile tile where no cover is set |
| `src/components/dna/ProfileHeader.tsx`      | 465  | `url(" + tile + ")`                                   | the masthead's textile tile            |
| `src/components/dna/ProfileHeader.tsx`      | 477  | `url(" + tile + ")`                                   | the textile tile where no cover is set |
| `src/components/dna/ProfileHeader.tsx`      | 568  | `url(" + base + "patterns/kente-pattern.svg)`         | the in-column masthead's tile          |
| `src/components/dna/PatternPicker.tsx`      | 59   | `url(" + base + "patterns/" + pt.id + "-pattern.svg)` | a pattern swatch                       |
| `src/components/dna/MemberCard.tsx`         | 137  | `url(" + assetBase() + "adinkra/nkonsonkonson.svg)`   | the Connect mark, a mask               |
| `admin/src/components/Enrolment.tsx`        | 68   | `enrolled.qrCode`                                     | the admin enrolment QR code, generated |
| `admin/src/routes/_console/settings.tsx`    | 1406 | `enrolled.qrCode`                                     | the admin enrolment QR code, generated |

Inside `src/components/strand/`, which the lint does not read, the assets are the wordmark
(`AppHeader.tsx:220`, `ConsoleShell.tsx:178`), the pattern ground (`EmptyState.tsx:50`), the
checkbox's tick (`Checkbox.tsx:49`) and the glyph masks (`Icon.tsx:15`, `CBadge.tsx:15`,
`PulseDock.tsx:37`, `BadgeRow.tsx:41`).

## Held

Raw member-image sites outside `src/components/strand/` that wait on a Strand item. The lint
passes them as recorded exceptions, each with its item and its gap; each row leaves when its item
lands.

| File                                   | Line | Source         | Strand item | Gap  |
| -------------------------------------- | ---- | -------------- | ----------- | ---- |
| `src/components/dna/ProfileHeader.tsx` | 183  | `member.cover` | 13          | G271 |
