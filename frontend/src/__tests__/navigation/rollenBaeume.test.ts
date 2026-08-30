import { describe, it, expect } from 'vitest';
import { BAEUME, hatLader, ladeRolleVor } from '../../navigation/rollenBaeume';
import { rollenStart, istTabLeisteVersteckt } from '../../navigation/routes';
import type { Rolle } from '../../navigation/routes';

// Etappe 2 des Ionic-9-Umbaus (30.08.2026): Routen, Tabs und Umleitungen
// stehen jetzt als Daten in rollenBaeume.ts statt dreimal als JSX.
//
// Der eigentliche Gewinn steht in diesem Test: Er ITERIERT ueber die Tabelle.
// Wer eine Rolle ergaenzt oder eine Route hinzufuegt, bekommt die Pruefung
// automatisch mit — es ist nicht mehr moeglich, eine Rolle zu vergessen.
// Genau das ist im August 2026 mehrfach passiert (Offline-Rueckfall dreimal
// nacheinander in je einer Ansicht, weil die anderen zwei uebersehen wurden).

const ROLLEN = Object.keys(BAEUME) as Rolle[];
const MIT_TABS = ROLLEN.filter(r => BAEUME[r].tabs.length > 0);

describe('Jeder Rollenbaum ist vollstaendig', () => {
  it.each(ROLLEN)('%s: hat Startseite, Routen und Umleitungen', (rolle) => {
    const baum = BAEUME[rolle];
    expect(baum.home).toMatch(/^\//);
    expect(baum.routes.length).toBeGreaterThan(0);
    expect(baum.redirects.length).toBeGreaterThan(0);
  });

  it.each(ROLLEN)('%s: die Startseite ist selbst eine Route', (rolle) => {
    // Sonst landet man nach dem Anmelden auf einer Seite, die es nicht gibt.
    const baum = BAEUME[rolle];
    expect(baum.routes.map(r => r.path)).toContain(baum.home);
  });

  it.each(ROLLEN)('%s: rollenStart() liefert dieselbe Startseite', (rolle) => {
    expect(rollenStart(rolle)).toBe(BAEUME[rolle].home);
  });

  it.each(ROLLEN)('%s: alle Pfade beginnen mit dem Rollen-Praefix', (rolle) => {
    // super_admin lebt bewusst unter /admin — dort verwaltet er Organisationen.
    const praefix = rolle === 'super_admin' ? '/admin' : `/${rolle}`;
    for (const r of BAEUME[rolle].routes) {
      expect(r.path.startsWith(praefix), `${rolle}: ${r.path}`).toBe(true);
    }
  });

  it.each(ROLLEN)('%s: keine doppelten Pfade', (rolle) => {
    const pfade = BAEUME[rolle].routes.map(r => r.path);
    expect(new Set(pfade).size).toBe(pfade.length);
  });

  it.each(ROLLEN)('%s: Umleitungsziele sind erreichbar', (rolle) => {
    const pfade = BAEUME[rolle].routes.map(r => r.path);
    for (const um of BAEUME[rolle].redirects) {
      // Query-Teil abschneiden: /x/events?segment=antraege -> /x/events
      const ziel = um.to.split('?')[0];
      expect(pfade, `${rolle}: ${um.from} -> ${um.to}`).toContain(ziel);
    }
  });
});

describe('Detail-Routen und ihre Listen', () => {
  // Die JSX-Fassung war hier uneinheitlich: /admin/events/:id stand VOR
  // /admin/events, /admin/konfis/:id dahinter. Beides ging, weil react-router
  // 5 mit `exact` arbeitete und die Reihenfolge damit egal war.
  //
  // In react-router 6 entfaellt `exact`; dort rangiert der Router selbst nach
  // Spezifitaet, ein statisches Segment schlaegt einen Parameter. Die
  // Reihenfolge bleibt also auch nach dem Umstieg unerheblich — was hier
  // zaehlt, ist dass es zu jeder Detail-Route ueberhaupt eine Liste gibt.
  it.each(ROLLEN)('%s: zu jeder Detail-Route gibt es die passende Liste', (rolle) => {
    const pfade = BAEUME[rolle].routes.map(r => r.path);
    for (const r of BAEUME[rolle].routes) {
      if (!r.param) continue;
      const basis = r.path.replace(/\/:[^/]+$/, '');
      // Chat-Raeume haengen an /chat, nicht an /chat/room — dort ist die
      // "Liste" die Uebersicht eine Ebene hoeher.
      const erwartet = basis.endsWith('/room') ? basis.replace(/\/room$/, '') : basis;
      expect(pfade, `${rolle}: ${r.path} ohne ${erwartet}`).toContain(erwartet);
    }
  });
});

describe('Tab-Leisten', () => {
  it.each(MIT_TABS)('%s: hat fuenf Tabs', (rolle) => {
    expect(BAEUME[rolle].tabs).toHaveLength(5);
  });

  it.each(MIT_TABS)('%s: jedes Tab-Ziel ist eine echte Route', (rolle) => {
    const pfade = BAEUME[rolle].routes.map(r => r.path);
    for (const t of BAEUME[rolle].tabs) {
      expect(pfade, `${rolle}: Tab ${t.tab} -> ${t.href}`).toContain(t.href);
    }
  });

  it.each(MIT_TABS)('%s: jedes Tab hat Symbol und Beschriftung', (rolle) => {
    for (const t of BAEUME[rolle].tabs) {
      expect(t.icon, `${rolle}: ${t.tab}`).toBeTruthy();
      expect(t.label.length, `${rolle}: ${t.tab}`).toBeGreaterThan(0);
    }
  });

  it('Tab-Namen sind app-weit eindeutig', () => {
    const alle = ROLLEN.flatMap(r => BAEUME[r].tabs.map(t => t.tab));
    expect(new Set(alle).size).toBe(alle.length);
  });

  it('Super-Admin hat bewusst keine Tab-Leiste', () => {
    expect(BAEUME.super_admin.tabs).toHaveLength(0);
  });
});

describe('Alte Push-Ziele bleiben erhalten', () => {
  // Diese Umleitungen existieren nur wegen bereits verschickter
  // Push-Nachrichten. Bricht eine, laufen die ins Leere — nicht zurueckrufbar.
  it.each(['admin', 'teamer', 'konfi'] as const)('%s: /requests leitet auf die Mitmachen-Seite', (rolle) => {
    const um = BAEUME[rolle].redirects.find(r => r.from === `/${rolle}/requests`);
    expect(um, `${rolle}: /requests fehlt`).toBeTruthy();
    expect(um!.to).toContain('segment=antraege');
  });
});

describe('Tab-Leiste verstecken', () => {
  it.each(['admin', 'teamer', 'konfi'] as const)('%s: in Chat-Raeumen versteckt', (rolle) => {
    expect(istTabLeisteVersteckt(`/${rolle}/chat/room/12`)).toBe(true);
  });

  it.each(['admin', 'teamer', 'konfi'] as const)('%s: in der Chat-Uebersicht sichtbar', (rolle) => {
    expect(istTabLeisteVersteckt(`/${rolle}/chat`)).toBe(false);
  });

  it('auf gewoehnlichen Seiten sichtbar', () => {
    for (const rolle of ['admin', 'teamer', 'konfi'] as const) {
      expect(istTabLeisteVersteckt(BAEUME[rolle].home)).toBe(false);
    }
  });
});

describe('Code-Splitting: Seiten sind faul und vorladbar', () => {
  // Seit dem Splitting (30.08.2026) ist jede Seite eine React.lazy-Huelle,
  // registriert mit ihrem Lade-Thunk. Faellt eine Seite aus der Registrierung
  // (z.B. jemand importiert sie wieder statisch und reicht die Komponente
  // direkt hinein), waere sie fuer ladeRolleVor() unsichtbar — und damit
  // offline nicht vorgeladen.
  it.each(ROLLEN)('%s: jede Route traegt eine lazy-Seite mit Vorlader', (rolle) => {
    for (const r of BAEUME[rolle].routes) {
      expect((r.page as any).$$typeof, `${rolle}: ${r.path} ist nicht lazy`).toBe(Symbol.for('react.lazy'));
      expect(hatLader(r.page), `${rolle}: ${r.path} ohne Vorlader`).toBe(true);
    }
  });

  // ladeRolleVor laedt die Module WIRKLICH — schlaegt ein Import fehl
  // (Tippfehler im Pfad, kaputter Default-Export), faellt das hier auf und
  // nicht erst beim Nutzer. Die Zahlen sind die deduplizierten Seiten je
  // Rolle: teamer hat 11 Routen, aber Badges/Material doppelt verdrahtet.
  it('konfi: ladeRolleVor laedt alle 8 Seiten-Module', async () => {
    await expect(ladeRolleVor('konfi')).resolves.toBe(8);
  });

  it('teamer: ladeRolleVor laedt alle 9 Seiten-Module', async () => {
    await expect(ladeRolleVor('teamer')).resolves.toBe(9);
  });

  it('admin: ladeRolleVor laedt alle 21 Seiten-Module', async () => {
    await expect(ladeRolleVor('admin')).resolves.toBe(21);
  });

  it('super_admin: ladeRolleVor laedt alle 2 Seiten-Module', async () => {
    await expect(ladeRolleVor('super_admin')).resolves.toBe(2);
  });
});
