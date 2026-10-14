// Strand (DNA design system) ported from the app.diasporanetwork.africa extractions (B1-Composer-v3,
// B2-Shell-Feed-v3). Tokens live in src/styles/strand.css.
export * from "./cmeta";
export * from "./Icon";
export * from "./Avatar";
export * from "./Button";
export * from "./IconButton";
export * from "./Input";
export * from "./Switch";
export * from "./Checkbox";
export * from "./Toast";
export * from "./Sheet";
export * from "./CBadge";
export * from "./VerbChip";
export * from "./AudienceSelect";
export * from "./DiaLine";
export * from "./MediaBlock";
export * from "./PostCard";
export * from "./PulseDock";
export * from "./verb-schema";
export * from "./Composer";
export * from "./AppHeader";
export * from "./EmptyState";
export * from "./LensBar";
export * from "./NotificationBell";
export * from "./NotificationListItem";
export * from "./RailWidget";
// Brief 3 (B3-Profile-v3): the two core additions the compile carries.
export * from "./Select";
export * from "./Chip";
// Handoff 37-E (1232): the app's own parts, ported from the app project's strand-patch sources and
// Design pass 01 rather than from a Strand compile, live in src/components/dna/ and are not
// re-exported here: AttestationRail, AuthHead, BackRow, CCard, CSheetBody, CardFade, LinkRow,
// MemberCard, PasswordField, PatternPicker, PlaceTile, ProfileHeader, SectionCard, StanceBlock,
// VerbRow, VisibilitySelect, VocabularyPicker and cinfo. The folder's record is
// docs/strand-ports/v1790724894917128.md. BadgeRow and IdentityMark left that list with handoff
// 44-MC-R3 (1530): Strand drew both at compile v1791495246160097 and the ports below are the one
// implementation of each; MemberCard stays an app part, rewritten from the same compile's part.
// Convene Pass 1 (ruling 673): the Segment part, the Composer its first caller.
export * from "./Segment";
// Strand re-sync to compile v1789885868097915 (handoff 29-A item 3, ruling 851): the two parts the
// compile carries and this tree did not. Discovery binds both (handoffs 31-B, 32-B and 33-A).
export * from "./FacetRail";
export * from "./Pane";
// Strand compile v1790212533284400 (handoff 32-A, correction 25 §2, ruling 1102): Menu, the list of
// acts a card's ellipsis summons. It reads --z-menu (1103). PostCard's discovery face renders it.
export * from "./Menu";
// Strand compile v1790410319010950 (corrections 30 and 31, ratified 1153; handoff 33-D item 2):
// Tooltip, which IconButton now wraps itself in (1146), and correction 30's three parts. No page
// binds BodyBlocks, PersonCard or BrowseTile yet; the first Discovery handoff and Brief 10
// Revision 4 do.
export * from "./Tooltip";
export * from "./BodyBlocks";
export * from "./PersonCard";
export * from "./BrowseTile";
// Strand compile v1790885781186000 (proposals 40, rulings 1306 and 1308; ratified 1309 and 1310;
// handoff 40-D item 2): the seven admin parts. The admin app imports them from here like every
// other Strand part; the member app imports none of them, and tests/admin-bundles.cjs reads that
// off its built output. LoadError stays in src/components/dna/ (1309). DiaNote's module also
// exports hasNumber, the 1301 check, beside the part (1310).
export * from "./ConsoleShell";
export * from "./MeasureCard";
export * from "./Sparkline";
export * from "./StackedBars";
export * from "./BarList";
export * from "./DataTable";
export * from "./DiaNote";
// Brief 14 (SPEC 41-14 Part A item 5; extraction 41-14 section 5.4, ratified 1368 to 1373; handoff
// 41-C): the eleven Messenger parts proposed for Strand, ported from the approved prototype
// `B14-Messenger-v1.dc.html` (compile v1790724894917128) rather than from a Strand compile, since
// no compile carries them yet. AppHeader's `messages` slot and `MessagesControl`, Pane's route-bar
// props and DiaLine's `escapeLabel` are the same brief's changes to parts already here. The record
// is docs/strand-ports/v1790724894917128-b14.md.
export * from "./ThreadRow";
export * from "./RequestCard";
export * from "./MessageBubble";
export * from "./Ticks";
export * from "./VoicePlayer";
export * from "./VoiceRecorder";
export * from "./MessageComposer";
export * from "./ReactionGlyph";
export * from "./PinnedStrip";
export * from "./DaySeparator";
export * from "./BlockedMessageLine";
export * from "./SearchResultRow";
// Handoff 45-D (admin Settings): Tabs, at compile v1790885781186000, which the Settings prototype
// loads and the tree had not carried. Record: docs/strand-ports/v1790885781186000.md section 8.
export * from "./Tabs";
// Strand compile v1791495246160097 (correction 56, ratified 1599; handoff 44-MC-R3, 1530): the two
// trust marks, IdentityMark (1497) and BadgeRow (1497, 1500, 1540). ProfileHeader, ProfileSurface
// and MemberCard read them from here. Record: docs/strand-ports/v1791495246160097.md.
export * from "./IdentityMark";
export * from "./BadgeRow";
// Strand compile v1791654208929113 (1643, ratified 1673; W62's 1429 to 1433 and 1543 to 1549;
// H60-MEDIA Work 1): ImageViewer, which MediaBlock opens on a tapped image, and ImageAdjust, which
// nothing mounts yet (1710). Record: docs/strand-ports/v1791654208929113-media.md.
export * from "./ImageViewer";
export * from "./ImageAdjust";
// Strand compile sha256-b1a458dac1bd562f (brief 60-SP items 1 to 21, ratified 1728; handoff H61-SP):
// the parts for comments, reactions, tags and reframing. ReactionRow and ReactionPicker's quick view
// are bound by MessageBubble; TokenSuggest by MessageComposer's mention list and Input's `tokens`;
// AttachmentTile by Composer's strip; ProfileHeader by ProfileSurface, replacing the app copy in
// src/components/dna/ (one implementation). Comment, TagLink and TagText wait for the Feed card and
// hashtag handoffs. Popover is the full picker's pointer container (1578). Record:
// docs/strand-ports/sha256-b1a458dac1bd562f.md.
export * from "./TagLink";
export * from "./TokenSuggest";
export * from "./ReactionRow";
export * from "./ReactionPicker";
export * from "./Popover";
export * from "./Comment";
export * from "./AttachmentTile";
export * from "./ProfileHeader";
