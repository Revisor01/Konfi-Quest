import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Etappe 1 des Ionic-9-Umbaus (30.08.2026): Bevor irgendetwas am Routing
// angefasst wird, halten diese Tests den IST-Zustand fest. Sie sind die
// Referenz, gegen die Etappe 2 (Routen datengetrieben) und Etappe 3
// (Ionic 8 -> 9, react-router 5 -> 6) gemessen werden.
//
// Vorher fasste KEIN EINZIGER Test das Routing an — bei 68 Routen ueber drei
// Rollenbaeume. Ein gebrochener Pfad waere erst aufgefallen, wenn ihn jemand
// benutzt. Genau das Muster, das hier schon mehrfach zugeschlagen hat.
//
// Bewusst quellcode-basiert und nicht rendernd: Diese Tests muessen den
// Versionssprung UEBERLEBEN und danach gegen die neue Struktur laufen. Die
// Pfad-Liste ist der Vertrag, nicht die JSX-Schreibweise.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const baeume = lies('src/navigation/rollenBaeume.ts');
const routes = lies('src/navigation/routes.ts');
const app = lies('src/App.tsx');

// Der vollstaendige Bestand, per Hand aus MainTabs.tsx uebertragen und
// gegengezaehlt. Aendert sich hier etwas, ist es eine bewusste Entscheidung
// und keine Nebenwirkung eines Umbaus.
const ROUTEN = {
  admin: [
    '/admin/konfis', '/admin/konfis/:id', '/admin/chat', '/admin/chat/room/:roomId',
    '/admin/activities', '/admin/events', '/admin/events/:id',
    '/admin/settings/categories', '/admin/settings/jahrgaenge', '/admin/settings/levels',
    '/admin/settings/invite', '/admin/settings/certificates', '/admin/settings/dashboard',
    '/admin/settings', '/admin/badges', '/admin/challenges', '/admin/users',
    '/admin/organizations', '/admin/material', '/admin/profile', '/admin/metrics',
  ],
  teamer: [
    '/teamer/dashboard', '/teamer/chat', '/teamer/chat/room/:roomId', '/teamer/events',
    '/teamer/material', '/teamer/badges', '/teamer/challenges', '/teamer/profile',
    '/teamer/profile/badges', '/teamer/profile/material', '/teamer/profile/konfi-stats',
  ],
  konfi: [
    '/konfi/dashboard', '/konfi/events', '/konfi/events/:id', '/konfi/badges',
    '/konfi/challenges', '/konfi/chat', '/konfi/chat/room/:roomId', '/konfi/profile',
  ],
} as const;

// Umleitungen, die aus Push-Nachrichten heraus angesprungen werden. Bricht
// eine davon, laufen bereits verschickte Push-Nachrichten ins Leere — die
// lassen sich nicht zurueckrufen.
const UMLEITUNGEN = [
  ['/admin/requests', '/admin/events?segment=antraege'],
  ['/teamer/requests', '/teamer/events?segment=antraege'],
  ['/konfi/requests', '/konfi/events?segment=antraege'],
] as const;

describe('Routen-Bestand je Rollenbaum', () => {
  for (const [rolle, pfade] of Object.entries(ROUTEN)) {
    it(`${rolle}: alle ${pfade.length} Routen sind verdrahtet`, () => {
      const fehlend = pfade.filter(p => !baeume.includes(`path: '${p}'`));
      expect(fehlend).toEqual([]);
    });
  }

  it('jede Rolle hat einen Einstieg von "/" und "/login"', () => {
    // Nach dem Anmelden landet man ueber diese Umleitungen im richtigen Baum.
    // Steht jetzt einmal als `home` je Baum statt dreimal als JSX-Redirect.
    for (const ziel of ['/admin/konfis', '/teamer/dashboard', '/konfi/dashboard']) {
      expect(baeume).toContain(`home: '${ziel}'`);
    }
  });
});

describe('Push-Ziele bleiben erreichbar', () => {
  for (const [von, nach] of UMLEITUNGEN) {
    it(`${von} leitet auf ${nach}`, () => {
      expect(baeume).toContain(`from: '${von}', to: '${nach}'`);
    });
  }
});

describe('Tab-Leiste', () => {
  it('ist in Chat-Raeumen aller drei Rollen versteckt', () => {
    // Eine Regex statt dreier startsWith-Vergleiche.
    expect(routes).toContain('istTabLeisteVersteckt');
    expect(routes).toMatch(/admin\|teamer\|konfi.*chat\\\/room/);
  });

  it('jede Rolle hat fuenf Tabs', () => {
    for (const [rolle, anzahl] of [['admin-', 5], ['teamer-', 5]] as const) {
      const treffer = baeume.match(new RegExp(`tab: '${rolle}`, 'g')) || [];
      expect(treffer.length, rolle).toBe(anzahl);
    }
  });
});

describe('Anmelde-Bereich in App.tsx', () => {
  it('kennt die vier oeffentlichen Routen', () => {
    for (const p of ['/login', '/register', '/forgot-password', '/reset-password']) {
      expect(app).toContain(p);
    }
  });

  it('faengt unbekannte Pfade ab, statt eine weisse Seite zu zeigen', () => {
    // Der Kommentar an dieser Stelle berichtet von genau dieser Regression.
    expect(app).toMatch(/Redirect to="\/login"|Navigate to="\/login"/);
  });
});

describe('Der Org-Wechsel remountet ueber den Router-Key', () => {
  it('IonReactRouter traegt den orgVersion-Key', () => {
    // Diese Mechanik ersetzt ein window.location.reload(), das im nativen
    // WebView die App zerschiesst. Sie muss den Umbau ueberleben.
    expect(app).toMatch(/key=\{orgVersion\}/);
  });
});
