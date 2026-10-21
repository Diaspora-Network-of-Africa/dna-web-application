// Handoff 40-B section 3: the exact copy of the admin app's screens, and no other words on them.
export const ADMIN_COPY = {
  signInHeading: "Admin",
  signInButton: "Sign in",
  /** Ruling 1329: the address itself comes from src/lib/contact.ts (387), never from here. */
  resetBefore: "Forgot your password? Email ",
  resetAfter: " and we will reset it.",
  resetSubject: "Admin password reset",
  mismatch: "That email and password do not match.",
  refusalHeading: "No admin access",
  refusalLine: "This account does not have access to the DNA admin console.",
  /** The word beside the mark in ConsoleShell's bar, and the Failure screen's heading. */
  shellHeading: "Admin",
  menuTitle: "Console",
  enrolHeading: "Set up two-step sign-in",
  enrolInstruction:
    "Scan this code with an authenticator app, then enter the six-digit code it shows.",
  secretLabel: "Or enter this key by hand",
  codeHeading: "Two-step sign-in",
  codeInstruction: "Enter the six-digit code from your authenticator app.",
  codeField: "Code",
  confirm: "Confirm",
  signOut: "Sign out",
  wrongCode: "That code did not work. Try the current one.",
  failure: "Something went wrong. Try again.",
} as const;

/**
 * The Onboarding lever's lines, verbatim from ruling 1619 (handoff 58-12C2 section 4). The screen
 * names are 307's. With a tie the screens are joined by the one joiner in src/lib/names.ts, which
 * the route applies; nothing here joins.
 */
export const ONBOARDING_COPY = {
  started: (n: string) => `${n} started in this period.`,
  stoppedAt: (screens: string) => `Most who have not finished stopped at ${screens}.`,
  allFinished: "Everyone who started has finished.",
  empty: "Nobody started onboarding in this period.",
  screen: {
    who: "Who you are",
    where: "Where you are",
    relationship: "Your relationship to the continent",
  },
} as const;

/**
 * The console's destinations in brief order, with the one line each shows (12B extraction §1,
 * shell; R2 §1). The Overview is available and the seven consoles after it read "Not yet" until they
 * exist. Settings is the last row and always available (1410; extraction 45-12S §1a row 7) until
 * Strand gives ConsoleShell a foot slot. Rendered by ConsoleShell and nowhere else.
 */
export const CONSOLE_DESTINATIONS: {
  id: string;
  label: string;
  line?: string;
  available: boolean;
}[] = [
  { id: "overview", label: "Overview", available: true },
  {
    id: "members",
    label: "Members",
    line: "Invite cohorts, suspensions and erasure requests. Every look at a member is logged.",
    available: false,
  },
  {
    id: "moderation",
    label: "Moderation",
    line: "Reports from every surface, the queue and the first takedowns.",
    available: false,
  },
  {
    id: "relationships",
    label: "Relationships",
    line: "Partners, sponsors, investors, press and chapter contacts, by stage.",
    available: false,
  },
  {
    id: "communications",
    label: "Communications",
    line: "The newsletter: compose, lists and sending.",
    available: false,
  },
  {
    id: "events",
    label: "Events",
    line: "Convene operations, editorial picks, corridors and thresholds.",
    available: false,
  },
  {
    id: "legal",
    label: "Legal",
    line: "Data requests: export, erasure, and the Terms and Privacy versions each member accepted.",
    available: false,
  },
  {
    id: "system",
    label: "System",
    line: "Health: failed deploys, errors, Edge Function failures and email bounces.",
    available: false,
  },
  {
    id: "settings",
    label: "Settings",
    line: "How the admin works for you, and the choices every staff member shares.",
    available: true,
  },
];

/**
 * Ruling 1311: the roles that open the Overview. Every other live role reaches the shell without the
 * Overview row and opens on Settings (1462, 1464).
 */
export const OVERVIEW_ROLES = ["admin", "analyst"] as const;

/**
 * Settings (handoff 45-D; EXTRACTION-45-12S §1 and §2, verbatim, with the build fixes of §5: the
 * re-enrol hint is "Six digits." and toasts T1 and T2 are gone). Templates take their variable parts
 * as arguments; every zone, grain and comparison word is read from the vocabularies (1392).
 */
export const SETTINGS_COPY = {
  title: "Settings",
  line: "How the admin works for you, and the choices every staff member shares.",
  tabPersonal: "Personal",
  tabOrg: "Organization",
  loading: "Loading settings",
  saving: "Saving",
  saved: "Saved",
  retry: "Retry",

  personalLine: "Only you change these. They are kept on your account and hold on every device.",
  appearance: "Appearance",
  appearanceLine: "System follows each device. Your choice applies the moment you make it.",
  appearanceSystem: (device: "light" | "dark") =>
    `This device is set to ${device}, so the admin is ${device} here.`,
  appearanceFixed: (theme: string) => `The admin is ${theme} on every device you sign in on.`,
  appearanceFailed: "Not kept on your account yet. It still applies on this device.",

  zone: "Reading time zone",
  zoneCompanyLine: (companyLong: string) =>
    `You read in the company reporting zone, ${companyLong}. You may choose your own zone instead.`,
  zoneOwnLine: (ownShort: string, companyLong: string) =>
    `You read in your own zone, ${ownShort}. The company reports in ${companyLong}.`,
  zoneModeCompany: "Company zone",
  zoneModeOwn: "My own zone",
  yourZone: "Your zone",
  yourZoneHint:
    "Times on every page read in this zone. Days and weeks stay with the company reporting zone.",
  zoneModeFailedOwn: "Not saved. You still read in your own zone.",
  zoneModeFailedCompany: "Not saved. You still read in the company zone.",
  yourZoneFailed: (prevShort: string) => `Not saved. You still read in ${prevShort}.`,
  windowLabel: "On the Overview, the window line reads",
  ownZoneSentence: (ownShort: string, companyShort: string) =>
    `Times are in your own zone, ${ownShort}. Days and weeks follow the company reporting zone, ${companyShort}.`,

  opensTo: "The Overview opens to",
  opensToLine:
    "The grain and comparison the Overview shows when you open it. You can still switch on the page.",
  grain: "Time grain",
  grainGroup: "Default time grain",
  compare: "Compare with",
  compareGroup: "Default comparison",
  grainFailed: (prevGrain: string) => `Not saved. The Overview still opens to ${prevGrain}.`,
  compareFailed: "Not saved. The earlier comparison still holds.",

  security: "Sign-in security",
  twoFactor: "Two-factor sign-in",
  twoFactorLine: "Required for every staff account. It cannot be turned off.",
  reenrolLine: "Moving to a new phone or authenticator? Re-enrol. We ask for a current code first.",
  reenrolButton: "Re-enrol your authenticator",
  sessions: "Active sessions",
  sessionDevice: "Device",
  sessionLast: "Last activity",
  thisDevice: (device: string) => `${device}, this device`,
  activeNow: "Active now",
  timesIn: (zoneShort: string) => `Times in ${zoneShort}.`,
  sessionsCaption: "Your active sessions by device and last activity",
  signOutLine: "Lost a device, or not sure? Sign out everywhere, including here.",
  signOutButton: "Sign out everywhere",

  readLog: "Your read log",
  readLogLine:
    "What you have read in the admin and when, newest first. Opening this log is itself logged.",
  today: "Today",
  readLogFoot: (zoneShort: string) => `Every entry is a page or a block. Times in ${zoneShort}.`,
  readLogEmpty: "Nothing read yet. Pages and blocks you open in the admin appear here by day.",

  readOnly: "An admin changes these. You can read them.",
  adminLine: "Shared by every staff member. Each change is recorded in the history below.",
  companyZone: "Company reporting zone",
  companyZoneLine:
    "The zone every staff member's Overview counts its days and weeks in, so the weekly review reads the same way every time.",
  changeZone: "Change the company zone",
  companyZoneFailed: (prevShort: string) =>
    `Not saved. The company zone is still ${prevShort} for everyone.`,
  dia: "DIA's note on the Overview",
  diaLine: "Applies to every staff member. Off removes the note block from everyone's Overview.",
  diaSwitch: "Show DIA's note on the Overview",
  diaFailed: (prevOn: boolean) =>
    `Not saved. DIA's note is still ${prevOn ? "on" : "off"} for everyone.`,
  on: "On",
  off: "Off",
  policies: "Fixed policies",
  policiesLine: "Set for the company. Nobody changes these here.",
  policyTwoFactor: "Two-factor sign-in is required",
  policyTwoFactorLine: "For every staff account.",
  policyLogged: "Every read of the admin is logged",
  policyLoggedLine: "Each staff member can see their own in Personal, Your read log.",
  history: "Change history",
  historyLine:
    "Every Organization change, newest first, with who made it and the value before and after. Opening this history is itself logged.",
  historyWhen: "When",
  historySetting: "Setting",
  historyBefore: "Before",
  historyAfter: "After",
  historyBy: "By",
  historyFoot: (zoneShort: string) => `Newest first. Times in ${zoneShort}.`,
  historyCaption: "Organization change history, newest first",
  historyEmpty:
    "No Organization setting has changed yet. When one does, it appears here with its before and after.",

  zoneSheet: "Change the company reporting zone",
  newZone: "New company zone",
  zoneWillMove: (newShort: string) =>
    `Every staff member's Overview will move to ${newShort} days and weeks, starting from the next refresh.`,
  zoneIsCurrent: "This is the company zone now. Choose another zone to change it.",
  zoneSheetLine:
    "Staff who read in their own zone keep their times. The change is recorded in the history with its before and after.",
  keepZone: (currentName: string) => `Keep ${currentName}`,
  changeTo: (newShort: string) => `Change to ${newShort}`,
  changeTheZone: "Change the zone",

  signOutSheet: "Sign out everywhere?",
  signOutBody: (device: string) =>
    `Every session ends, including this one on ${device}. You will sign in again with your password and your authenticator.`,
  staySignedIn: "Stay signed in",
  signedOutTitle: "You are signed out everywhere",
  signedOutLine:
    "Every session has ended, including this one. Sign in again with your password and your authenticator.",
  signInAgain: "Sign in again",

  reenrolSheet: "Re-enrol your authenticator",
  reenrolStep1:
    "First, enter the code your current authenticator shows. This keeps anyone else from moving your sign-in.",
  currentCode: "Current code",
  sixDigits: "Six digits.",
  codeMismatch: "That code did not match. Try the code showing now.",
  cancel: "Cancel",
  continue: "Continue",
  reenrolStep2:
    "Add DNA Admin to your new authenticator, then enter the code it shows. Your old entry stops working when you finish.",
  enrolmentPlaceholder: "The enrolment code appears here",
  newCode: "Code from the new entry",
  finish: "Finish re-enrolling",
  reenrolled: "Your authenticator is re-enrolled. The old entry no longer works.",
  dismiss: "Dismiss",
} as const;
