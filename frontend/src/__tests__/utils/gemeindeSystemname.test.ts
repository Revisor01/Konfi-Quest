import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';
import {
  umlauteUmschreiben,
  systemnameAusAnzeigename,
  systemnameZumSpeichern,
} from '../../utils/gemeindeSystemname';

// Der Systemname einer Gemeinde in der App (30.09.2026, Nebenbefund Großpaket).
//
// Die Ausfuellhilfe im Gemeinde-Formular (OrganizationManagementModal,
// generateSystemName) warf Umlaute ersatzlos weg: aus „Büsum" wurde `bsum`.
// Der Server schreibt seit dem 29.09.2026 beim Anlegen um (`buesum`), die App
// schrieb den Namen beim naechsten Speichern aber wieder auf `bsum` zurueck.
// Jetzt bildet die App ihn nach derselben Regel wie der Server und laesst ihn
// beim Bearbeiten stehen, solange der Anzeigename gleich bleibt.

const require = createRequire(import.meta.url);
const server = require(resolve(process.cwd(), '../backend/utils/gemeindeSystemname.js')) as {
  umlauteUmschreiben: (t: string) => string;
  systemnameAusAnzeigename: (t: string) => string;
  systemnameWieDieApp: (t: string) => string;
  systemnameFuerNeueGemeinde: (geschickt: string, anzeigename: string) => string;
  systemnameBeimBearbeiten: (
    geschickt: string,
    anzeigename: string,
    gespeichert: { wert: string; anzeigename: string } | null
  ) => string;
};

// Gemeinsame Faelle fuer App und Server: Anzeigename -> Systemname.
const FAELLE: Array<[string, string]> = [
  ['Büsum', 'buesum'],
  ['Kirchspiel Süd', 'kirchspiel-sued'],
  ['Großenbrode', 'grossenbrode'],
  ['Ölper Straße 5', 'oelper-strasse-5'],
  // Bindestriche im Anzeigenamen fallen weg, wie beim Server (und wie bisher).
  ['Kirchengemeinde Lütjenburg-Behrensdorf', 'kirchengemeinde-luetjenburgbehrensdorf'],
  ['ÄÖÜ ẞ', 'aeoeue-ss'],
  ['  St. Jürgen  ', 'st-juergen'],
  ['Kirchspiel West', 'kirchspiel-west'],
  ['Test-Demo', 'testdemo'],
  // Andere Akzente fallen weg -- beim Server genauso.
  ['Sankt Noémi', 'sankt-nomi'],
];

describe('Systemname aus dem Anzeigenamen', () => {
  it.each(FAELLE)('%s -> %s', (anzeigename, erwartet) => {
    expect(systemnameAusAnzeigename(anzeigename)).toBe(erwartet);
  });

  it('schreibt Umlaute und ß um, auch große', () => {
    expect(umlauteUmschreiben('Äpfel, Öl, Übung, Maß, GROẞ')).toBe('aepfel, oel, uebung, Mass, GROss');
  });
});

describe('Dieselbe Regel wie der Server', () => {
  it.each(FAELLE)('%s: App und Server bilden denselben Namen', (anzeigename) => {
    expect(systemnameAusAnzeigename(anzeigename)).toBe(server.systemnameAusAnzeigename(anzeigename));
  });

  it.each(FAELLE)('%s: der Server behaelt beim Anlegen, was die App schickt', (anzeigename) => {
    const geschickt = systemnameAusAnzeigename(anzeigename);
    expect(server.systemnameFuerNeueGemeinde(geschickt, anzeigename)).toBe(geschickt);
  });

  it('die Umschrift der Umlaute ist dieselbe', () => {
    const text = 'äöüßÄÖÜẞ';
    expect(umlauteUmschreiben(text)).toBe(server.umlauteUmschreiben(text));
  });
});

describe('Beim Speichern: neu anlegen und bearbeiten', () => {
  it('neu: der Systemname aus dem Anzeigenamen, mit Umlauten', () => {
    expect(systemnameZumSpeichern('Büsum')).toEqual({ name: 'buesum', slug: 'buesum' });
    expect(systemnameZumSpeichern('Büsum', null)).toEqual({ name: 'buesum', slug: 'buesum' });
  });

  it('bearbeiten, Anzeigename gleich: der gespeicherte Systemname bleibt (auch der alte ohne Umlaut)', () => {
    const alt = { name: 'bsum', slug: 'bsum', display_name: 'Büsum' };
    expect(systemnameZumSpeichern('Büsum', alt)).toEqual({ name: 'bsum', slug: 'bsum' });
  });

  it('bearbeiten, Anzeigename gleich: ein umgeschriebener Name wird nicht zurückgedreht', () => {
    const neu = { name: 'buesum', slug: 'buesum', display_name: 'Büsum' };
    expect(systemnameZumSpeichern('Büsum', neu)).toEqual({ name: 'buesum', slug: 'buesum' });
  });

  it('bearbeiten, Anzeigename gleich: ein eigener Systemname bleibt', () => {
    const eigen = { name: 'ks-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' };
    expect(systemnameZumSpeichern('Kirchspiel Süd', eigen)).toEqual({ name: 'ks-sued', slug: 'ks-sued' });
  });

  it('bearbeiten, nur Leerzeichen am Rand anders: gilt als gleich', () => {
    const neu = { name: 'buesum', slug: 'buesum', display_name: 'Büsum' };
    expect(systemnameZumSpeichern('  Büsum ', neu)).toEqual({ name: 'buesum', slug: 'buesum' });
  });

  it('bearbeiten, Anzeigename geändert: neu gebildet, mit Umlauten', () => {
    const alt = { name: 'bsum', slug: 'bsum', display_name: 'Büsum' };
    expect(systemnameZumSpeichern('Büsum Deichhausen', alt)).toEqual({
      name: 'buesum-deichhausen',
      slug: 'buesum-deichhausen',
    });
  });
});

// Die Verdrahtung im Formular (Bearbeiten, was PUT schickt) prueft
// components/gemeindeSystemnameBearbeiten.test.tsx.

// Beim Bearbeiten kommt der Server zum selben Ergebnis, ob die Store-App 2.2.x
// (bildet immer neu, ohne Umlaute) oder diese App schickt (09.10.2026,
// backend/utils/gemeindeSystemname.js, systemnameBeimBearbeiten).
describe('Systemname beim Bearbeiten: alte und neue App gleich', () => {
  const GESPEICHERT = [
    { name: 'buesum', slug: 'buesum', display_name: 'Büsum' },
    { name: 'bsum', slug: 'bsum', display_name: 'Büsum' },
    { name: 'ks-sued', slug: 'ks-sued', display_name: 'Kirchspiel Süd' },
    { name: 'kirchspiel-west', slug: 'kirchspiel-west', display_name: 'Kirchspiel West' },
  ];
  const ANZEIGE = ['Büsum', 'Büsum Deichhausen', 'Kirchspiel Süd', 'Kirchspiel West', 'Groß Ölper'];

  for (const gespeichert of GESPEICHERT) {
    for (const anzeige of ANZEIGE) {
      it(`${gespeichert.slug} mit Anzeigename „${anzeige}"`, () => {
        const wieGespeichert = { wert: gespeichert.slug, anzeigename: gespeichert.display_name };
        const vonDerAltenApp = server.systemnameWieDieApp(anzeige);
        const vonDerNeuenApp = systemnameZumSpeichern(anzeige, gespeichert).slug;

        const ausAlt = server.systemnameBeimBearbeiten(vonDerAltenApp, anzeige, wieGespeichert);
        const ausNeu = server.systemnameBeimBearbeiten(vonDerNeuenApp, anzeige, wieGespeichert);

        expect(ausAlt).toBe(vonDerNeuenApp);
        expect(ausNeu).toBe(vonDerNeuenApp);
      });
    }
  }
});
