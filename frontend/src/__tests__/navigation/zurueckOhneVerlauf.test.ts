import { describe, it, expect } from 'vitest';
import { elternPfad } from '../../components/layout/MainTabs';
import { BAEUME } from '../../navigation/rollenBaeume';

// Rolle ist ein Typ, kein Laufzeitwert — die Schluessel des Baums nehmen.
const ROLLEN = Object.keys(BAEUME) as (keyof typeof BAEUME)[];

// Befund aus Simons Geraetetest mit Build 152 (31.08.2026):
// Chat ueber eine Push-Nachricht geoeffnet -> der Zurueck-Knopf tat NICHTS,
// man kam aus dem Raum nicht mehr heraus.
//
// Ursache: Beim Antippen einer Push-Nachricht laedt AppContext die App HART
// neu (window.location.href = ziel). Danach ist der Verlauf LEER, und
// router.goBack() hat kein Ziel. Betroffen war jede Parameter-Route, nicht
// nur der Chat — also auch Termin- und Konfi-Detailseiten aus einem Push.
//
// Der Zurueck-Knopf faellt jetzt auf die uebergeordnete Seite zurueck.

describe('Zurueck ohne Verlauf: Elternpfad je Parameter-Route', () => {
  it('fuehrt aus dem Chatraum in die Chat-Uebersicht', () => {
    expect(elternPfad('/konfi/chat/room/:roomId')).toBe('/konfi/chat');
    expect(elternPfad('/admin/chat/room/:roomId')).toBe('/admin/chat');
    expect(elternPfad('/teamer/chat/room/:roomId')).toBe('/teamer/chat');
  });

  it('fuehrt aus einer Detailseite in die zugehoerige Liste', () => {
    expect(elternPfad('/konfi/events/:id')).toBe('/konfi/events');
    expect(elternPfad('/admin/konfis/:id')).toBe('/admin/konfis');
  });

  it('landet nie auf der Wurzel oder einem Parameter', () => {
    // Sonst wuerde der Zurueck-Knopf aus der Rolle herausfuehren.
    for (const rolle of ROLLEN) {
      for (const r of BAEUME[rolle].routes) {
        if (!r.param) continue;
        const ziel = elternPfad(r.path);
        expect(ziel.startsWith('/' + r.path.split('/')[1])).toBe(true);
        expect(ziel).not.toBe('/');
        expect(ziel).not.toContain(':');
      }
    }
  });

  it('deckt JEDE Parameter-Route ab — auch kuenftige', () => {
    // Iteriert ueber dieselbe Tabelle wie der Renderer: Eine neue
    // Parameter-Route wird hier automatisch mitgeprueft.
    const mitParam = ROLLEN.flatMap((rolle) =>
      BAEUME[rolle].routes.filter((r) => r.param).map((r) => r.path)
    );
    expect(mitParam.length).toBeGreaterThan(0);
    for (const pfad of mitParam) {
      const ziel = elternPfad(pfad);
      // Das Ziel muss eine echte, parameterlose Route des Baums sein.
      const existiert = ROLLEN.some((rolle) =>
        BAEUME[rolle].routes.some((r) => !r.param && r.path === ziel)
      );
      expect(existiert, `${pfad} -> ${ziel} ist keine echte Route`).toBe(true);
    }
  });
});
