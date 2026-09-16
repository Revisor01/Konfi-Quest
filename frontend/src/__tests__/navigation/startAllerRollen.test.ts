import { describe, it, expect } from 'vitest';
import { BAEUME, ladeRolleVor, istGeladen } from '../../navigation/rollenBaeume';
import { rolleVonUser } from '../../navigation/useSeitenBereit';
import type { Rolle } from '../../navigation/routes';

// Simons Befund 16.09.2026, Build 198, echtes Geraet: "app startet bei teamer
// und konfi auf weiss" — und praezisiert: "wegnavigieren zurueck auf dashboard
// klicken alles da", "ohne sperre geht es auch nicht aufs dashboard".
//
// Also: die Daten sind da, der Router laeuft, nur der ERSTE Aufbau zeigt
// nichts. Und es haengt NICHT an der App-Sperre.
//
// Der bestehende Schutz (keinTauschImOutlet, keinPlatzhalterImOutlet,
// weisserScreenKaltstart) prueft die QUELLE — er liest App.tsx und
// MainTabs.tsx als Text. Das faengt die bekannten Muster, aber es fuehrt den
// Start nie wirklich aus. Diese Datei tut das: sie laeuft den Startweg JEDER
// Rolle ab und prueft, dass am Ende die Startseite steht.

const ROLLEN: Rolle[] = ['admin', 'teamer', 'konfi'];

describe('ladeRolleVor bringt jede Rolle vollstaendig durch', () => {
  // 60 s statt der 5 s Voreinstellung: Hier werden ECHTE dynamische Importe
  // ausgefuehrt — bei der Leitung 23 Seiten-Module. Vitest transformiert die
  // beim ersten Zugriff, das dauert auf einem kalten Lauf gemessen ueber 30 s.
  // Das ist Werkzeug-Laufzeit, kein Befund; die Erwartungen darunter bleiben
  // hart.
  it.each(ROLLEN)('%s: alle Seiten-Module der Rolle laden wirklich', { timeout: 60000 }, async (rolle) => {
    const anzahlLader = new Set(
      BAEUME[rolle].routes.map((r) => r.page)
    ).size;
    expect(anzahlLader, `${rolle} hat keine Routen`).toBeGreaterThan(0);

    const geladen = await ladeRolleVor(rolle);

    // Auf den konkreten Wert pruefen, nicht auf "mehr als 0": Ein einziger
    // fehlschlagender dynamischer Import (etwa ein zerschossener Export nach
    // einem Umbau) wuerde sonst durchrutschen — Promise.allSettled schluckt
    // ihn, und ladeRolleVor liefert trotzdem eine Zahl.
    const eindeutigeLader = new Set(
      BAEUME[rolle].routes
        .map((r) => r.page)
        .filter((p) => istGeladen(p))
    );
    expect(eindeutigeLader.size).toBe(anzahlLader);
    expect(geladen).toBeGreaterThan(0);
  });

  it.each(ROLLEN)('%s: jede Seite der Rolle ist danach als geladen vermerkt', { timeout: 60000 }, async (rolle) => {
    await ladeRolleVor(rolle);
    for (const route of BAEUME[rolle].routes) {
      expect(
        istGeladen(route.page),
        `${rolle}: Seite fuer ${route.path} ist nicht geladen`
      ).toBe(true);
    }
  });
});

describe('Die Startseite jeder Rolle ist im eigenen Baum erreichbar', () => {
  // Der Kern von Simons Befund: Beim Kaltstart steht die App auf der
  // Startseite der Rolle — und dort muss eine Route greifen. Greift keine,
  // rendert das Outlet nichts: weisser Bildschirm, bis eine Navigation eine
  // gueltige Route trifft ("wegnavigieren, zurueck, alles da").

  /** Bildet den Routen-Abgleich des Outlets nach: matcht `home` auf eine Route? */
  const findeRoute = (rolle: Rolle, pfad: string) => {
    const baum = BAEUME[rolle];
    const treffer = baum.routes.find((r) => {
      const muster = r.path
        .split('/')
        .map((t) => (t.startsWith(':') ? '[^/]+' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/');
      return new RegExp(`^${muster}$`).test(pfad);
    });
    const umleitung = baum.redirects.find((u) => u.from === pfad);
    return { treffer, umleitung };
  };

  it.each(ROLLEN)('%s: die Startseite trifft eine echte Route', (rolle) => {
    const { treffer } = findeRoute(rolle, BAEUME[rolle].home);
    expect(
      treffer,
      `${rolle}: home ${BAEUME[rolle].home} trifft KEINE Route -> leeres Outlet`
    ).toBeTruthy();
  });

  it.each(ROLLEN)('%s: jedes Tab-Ziel trifft eine echte Route', (rolle) => {
    for (const tab of BAEUME[rolle].tabs) {
      const pfad = tab.href.split('?')[0];
      const { treffer, umleitung } = findeRoute(rolle, pfad);
      expect(
        Boolean(treffer || umleitung),
        `${rolle}: Tab "${tab.label}" zeigt auf ${pfad}, dort ist keine Route`
      ).toBe(true);
    }
  });

  it.each(ROLLEN)('%s: die Startseite ist auch ein Tab-Ziel oder eindeutig erreichbar', (rolle) => {
    // Bei allen drei Rollen ist die Startseite zugleich der erste Reiter.
    // Waere sie das nicht, staende beim Start eine Seite ohne aktiven Reiter —
    // IonTabs hat dann keinen passenden Tab und zeigt unter Umstaenden nichts.
    const tabs = BAEUME[rolle].tabs.map((t) => t.href.split('?')[0]);
    expect(
      tabs,
      `${rolle}: Startseite ${BAEUME[rolle].home} ist kein Tab-Ziel`
    ).toContain(BAEUME[rolle].home);
  });
});

describe('Die Rolle wird aus dem Konto richtig abgeleitet', () => {
  // Wenn hier etwas kippt, laedt useSeitenBereit den FALSCHEN Baum vor —
  // MainTabs rendert dann einen Baum, dessen Seiten-Chunks noch fehlen, und
  // das Outlet bekommt genau den Platzhalter-Tausch, der weiss macht.
  it('Leitung', () => {
    expect(rolleVonUser({ type: 'admin', role_name: 'org_admin' }, false)).toBe('admin');
  });
  it('Teamer', () => {
    expect(rolleVonUser({ type: 'teamer', role_name: 'teamer' }, false)).toBe('teamer');
  });
  it('Konfi', () => {
    expect(rolleVonUser({ type: 'konfi', role_name: 'konfi' }, false)).toBe('konfi');
  });
  it('Super-Admin geht vor', () => {
    expect(rolleVonUser({ type: 'admin', role_name: 'super_admin' }, true)).toBe('super_admin');
  });

  it('useSeitenBereit und MainTabs leiten dieselbe Rolle ab', () => {
    // Zwei Stellen berechnen die Rolle unabhaengig voneinander (App.tsx ueber
    // useSeitenBereit, MainTabs selbst). Laufen sie auseinander, laedt die
    // eine Stelle Baum A vor und die andere rendert Baum B — weisse Seite mit
    // exakt Simons Bild. Die Regel wird hier gegen die MainTabs-Fassung
    // gehalten.
    const wieMainTabs = (u: { type?: string; role_name?: string }) => {
      const superAdmin = u.role_name === 'super_admin';
      return superAdmin
        ? 'super_admin'
        : u.type === 'admin'
          ? 'admin'
          : u.type === 'teamer'
            ? 'teamer'
            : 'konfi';
    };
    const faelle = [
      { type: 'admin', role_name: 'org_admin' },
      { type: 'admin', role_name: 'admin' },
      { type: 'teamer', role_name: 'teamer' },
      { type: 'konfi', role_name: 'konfi' },
      { type: 'admin', role_name: 'super_admin' },
      // Der heikle Fall: /auth/me liefert role_name, aber KEIN type. Kommt
      // der Wert aus dem Cache nicht mit, faellt rolleVonUser auf 'konfi' —
      // und ein Teamer bekaeme den Konfi-Baum.
      { type: 'teamer' },
      { type: 'konfi' },
    ];
    for (const f of faelle) {
      const istSuper = f.role_name === 'super_admin';
      expect(rolleVonUser(f, istSuper), JSON.stringify(f)).toBe(wieMainTabs(f));
    }
  });
});
