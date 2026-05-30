import type { Device, ProjectState, Slide } from "./types";

let _id = 0;
export const nid = () => `s_${Date.now().toString(36)}_${(_id++).toString(36)}`;

// Projekt ist deutschsprachig — Texte liegen unter dem "de"-Key.
const de = (s: string) => ({ de: s });

// ---------- Feature-Paletten — bg 1:1 aus globalem CSS (--app-color-*) ----------
// backgroundFor() legt darüber Glow + Verlauf, sodass es trotz exakter
// Sektionsfarbe fetzig wirkt. accent = hellere/dunklere Tönung derselben Farbe.
const P = {
  konfi:     { bg: "#5b21b6", fg: "#ffffff", accent: "#a855f7", muted: "#e9d5ff" }, // --app-color-konfis (Lila)
  events:    { bg: "#dc2626", fg: "#ffffff", accent: "#f87171", muted: "#ffe4e6" }, // --app-color-events (Rot)
  activities:{ bg: "#047857", fg: "#ffffff", accent: "#34d399", muted: "#d1fae5" }, // --app-color-activities (Grün) — Anträge/Aktivitäten
  gottesdienst:{ bg: "#3b82f6", fg: "#ffffff", accent: "#93c5fd", muted: "#dbeafe" }, // --app-color-gottesdienst (Blau)
  badge:     { bg: "#f59e0b", fg: "#ffffff", accent: "#fcd34d", muted: "#fef3c7" }, // --app-color-badges (Amber)
  chat:      { bg: "#06b6d4", fg: "#ffffff", accent: "#67e8f9", muted: "#cffafe" }, // --app-color-chat (Cyan)
  material:  { bg: "#d97706", fg: "#ffffff", accent: "#fbbf24", muted: "#fef3c7" }, // --app-color-material (Bronze)
  teamer:    { bg: "#be185d", fg: "#ffffff", accent: "#f472b6", muted: "#fce7f3" }, // --app-color-teamer (Pink)
  admin:     { bg: "#667eea", fg: "#ffffff", accent: "#a5b4fc", muted: "#e0e7ff" }, // --app-color-users (Indigo)
  gemeinde:  { bg: "#059669", fg: "#ffffff", accent: "#34d399", muted: "#d1fae5" }, // --app-color-gemeinde (Smaragd)
  navy:      { bg: "#2563eb", fg: "#ffffff", accent: "#1e3a8a", muted: "#bae6fd" }, // Hauptblau + dunkler Akzent (App-Icon)
} as const;

// Framing-Vorlagen: gerade-unten / gerade-oben / links-schräg / rechts-schräg
// (tilt negativ = nach links gekippt, positiv = nach rechts)
const straightUp = { layout: "device-bottom" as const };           // gerade, von unten rein
const straightDown = { layout: "device-top" as const };            // gerade, von oben rein
const tiltLeft = { layout: "device-bottom" as const, tilt: -8 };   // links schräg
const tiltRight = { layout: "device-bottom" as const, tilt: 8 };   // rechts schräg

// ============================================================
// iPhone-Deck (bis zu 10 Slides)
// 1-5: Konfi-Sicht · 6-10: Team & Leitung
// ============================================================
function iphoneSlides(): Slide[] {
  return [
    // 1 — HERO (gerade von unten)
    {
      id: nid(),
      ...straightUp,
      layout: "hero",
      label: de("KONFI QUEST"),
      headline: de("Die Konfizeit\nals Abenteuer."),
      screenshot: "/screenshots/apple/iphone/{locale}/01.png",
      palette: P.navy,
      showIcon: true,
    },
    // 2 — Punkte sammeln (gerade von unten)
    {
      id: nid(),
      ...straightUp,
      label: de("FÜR KONFIS"),
      headline: de("Sammle Punkte\nfür dein Engagement."),
      screenshot: "/screenshots/apple/iphone/{locale}/02.png",
      palette: P.konfi,
      showIcon: true,
    },
    // 3 — Events anmelden (rechts schräg)
    {
      id: nid(),
      ...tiltRight,
      label: de("EVENTS"),
      headline: de("Melde dich\nin Sekunden an."),
      screenshot: "/screenshots/apple/iphone/{locale}/03.png",
      palette: P.events,
      showIcon: true,
    },
    // 4 — Anträge: Aktivitäten & Gottesdienste (links schräg)
    {
      id: nid(),
      ...tiltLeft,
      label: de("ANTRÄGE"),
      headline: de("Aktivitäten und\nGottesdienste einreichen."),
      screenshot: "/screenshots/apple/iphone/{locale}/04.png",
      palette: P.activities,
      showIcon: true,
    },
    // 5 — Badges & Level (gerade von oben)
    {
      id: nid(),
      ...straightDown,
      label: de("BADGES & LEVEL"),
      headline: de("Schalte Abzeichen\nund Level frei."),
      screenshot: "/screenshots/apple/iphone/{locale}/05.png",
      palette: P.badge,
      showIcon: true,
    },
    // 6 — Material fürs Team (gerade von unten, Team-Farbe)
    {
      id: nid(),
      ...straightUp,
      label: de("FÜRS TEAM"),
      headline: de("Material immer\ngriffbereit."),
      screenshot: "/screenshots/apple/iphone/{locale}/06.png",
      palette: P.material,
      showIcon: true,
    },
    // 7 — Anwesenheit verwalten (rechts schräg, Admin)
    {
      id: nid(),
      ...tiltRight,
      label: de("FÜR DIE LEITUNG"),
      headline: de("Anwesenheit\nim Blick behalten."),
      screenshot: "/screenshots/apple/iphone/{locale}/07.png",
      palette: P.admin,
      showIcon: true,
    },
    // 8 — Teamer:innen organisieren (links schräg, Team)
    {
      id: nid(),
      ...tiltLeft,
      label: de("TEAM ORGANISIEREN"),
      headline: de("Dein Team\nan einem Ort."),
      screenshot: "/screenshots/apple/iphone/{locale}/08.png",
      palette: P.teamer,
      showIcon: true,
    },
    // 9 — Teamer-Badges & Dashboard (gerade von oben)
    {
      id: nid(),
      ...straightDown,
      label: de("TEAMER:INNEN-MODUS"),
      headline: de("Badges und Dashboard\nfürs Team."),
      screenshot: "/screenshots/apple/iphone/{locale}/09.png",
      palette: P.badge,
      showIcon: true,
    },
    // 10 — Zertifikate mit Ablauf (gerade von unten, Cert-Farbe)
    {
      id: nid(),
      ...straightUp,
      label: de("ZERTIFIKATE"),
      headline: de("Nachweise mit\nAblaufdatum verwalten."),
      screenshot: "/screenshots/apple/iphone/{locale}/10.png",
      palette: P.gemeinde,
      showIcon: true,
    },
  ];
}

// ============================================================
// Android-Deck (bis zu 8 Slides) — verdichtet
// ============================================================
function androidSlides(): Slide[] {
  return [
    {
      id: nid(),
      ...straightUp,
      layout: "hero",
      label: de("KONFI QUEST"),
      headline: de("Die Konfizeit\nals Abenteuer."),
      screenshot: "/screenshots/android/phone/{locale}/01.png",
      palette: P.navy,
      showIcon: true,
    },
    {
      id: nid(),
      ...straightUp,
      label: de("FÜR KONFIS"),
      headline: de("Sammle Punkte\nfür dein Engagement."),
      screenshot: "/screenshots/android/phone/{locale}/02.png",
      palette: P.konfi,
      showIcon: true,
    },
    {
      id: nid(),
      ...tiltRight,
      label: de("EVENTS"),
      headline: de("Melde dich\nin Sekunden an."),
      screenshot: "/screenshots/android/phone/{locale}/03.png",
      palette: P.events,
      showIcon: true,
    },
    {
      id: nid(),
      ...tiltLeft,
      label: de("ANTRÄGE"),
      headline: de("Aktivitäten und\nGottesdienste einreichen."),
      screenshot: "/screenshots/android/phone/{locale}/04.png",
      palette: P.activities,
      showIcon: true,
    },
    {
      id: nid(),
      ...straightDown,
      label: de("BADGES & CHAT"),
      headline: de("Abzeichen sammeln,\nin Kontakt bleiben."),
      screenshot: "/screenshots/android/phone/{locale}/05.png",
      palette: P.badge,
      showIcon: true,
    },
    {
      id: nid(),
      ...straightUp,
      label: de("FÜRS TEAM"),
      headline: de("Material immer\ngriffbereit."),
      screenshot: "/screenshots/android/phone/{locale}/06.png",
      palette: P.material,
      showIcon: true,
    },
    {
      id: nid(),
      ...tiltRight,
      label: de("FÜR DIE LEITUNG"),
      headline: de("Anwesenheit und\nTeam verwalten."),
      screenshot: "/screenshots/android/phone/{locale}/07.png",
      palette: P.admin,
      showIcon: true,
    },
    {
      id: nid(),
      ...straightUp,
      label: de("ZERTIFIKATE"),
      headline: de("Nachweise mit\nAblaufdatum verwalten."),
      screenshot: "/screenshots/android/phone/{locale}/08.png",
      palette: P.gemeinde,
      showIcon: true,
    },
  ];
}

function ipadStarter(): Slide[] {
  return [
    {
      id: nid(),
      layout: "hero",
      label: de("KONFI QUEST"),
      headline: de("Die Konfizeit\nals Abenteuer."),
      screenshot: "",
      palette: P.navy,
      showIcon: true,
    },
    {
      id: nid(),
      layout: "device-bottom",
      label: de("FÜR KONFIS"),
      headline: de("Sammle Punkte\nfür dein Engagement."),
      screenshot: "",
      palette: P.konfi,
      showIcon: true,
    },
    {
      id: nid(),
      layout: "device-top",
      label: de("FÜR DIE LEITUNG"),
      headline: de("Verwalte alles\nan einem Ort."),
      screenshot: "",
      palette: P.admin,
      showIcon: true,
    },
  ];
}

function tabletStarter(): Slide[] {
  return [
    {
      id: nid(),
      layout: "hero",
      label: de("KONFI QUEST"),
      headline: de("Die Konfizeit\nals Abenteuer."),
      screenshot: "",
      palette: P.navy,
      showIcon: true,
    },
    {
      id: nid(),
      layout: "split-landscape",
      label: de("FÜR DIE LEITUNG"),
      headline: de("Verwalte alles\nan einem Ort."),
      screenshot: "",
      palette: P.admin,
      showIcon: true,
    },
  ];
}

function fgStarter(): Slide[] {
  return [
    {
      id: nid(),
      layout: "feature-graphic",
      label: {},
      headline: de("Die Konfizeit als Abenteuer."),
      screenshot: "",
      palette: P.navy,
      showIcon: true,
    },
  ];
}

export const DEFAULT_PROJECT: ProjectState = {
  appName: "Konfi Quest",
  themeId: "dark-bold",
  locales: ["de"],
  locale: "de",
  device: "iphone",
  orientation: "portrait",
  appIcon: "/app-icon.png",
  slidesByDevice: {
    iphone: iphoneSlides(),
    android: androidSlides(),
    ipad: ipadStarter(),
    "android-7": tabletStarter(),
    "android-10": tabletStarter(),
    "feature-graphic": fgStarter(),
  },
};

export function newSlide(layout: Slide["layout"] = "device-bottom"): Slide {
  return {
    id: nid(),
    layout,
    label: de("NEU"),
    headline: de("Headline\nhier bearbeiten."),
    screenshot: "",
  };
}

export function detectPlatform(device: Device): "ios" | "android" {
  return device === "iphone" || device === "ipad" ? "ios" : "android";
}
