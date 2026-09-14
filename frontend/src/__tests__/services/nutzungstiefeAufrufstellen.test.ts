/**
 * Die Aufrufstellen: wird WIRKLICH erst nach der erfolgreichen Antwort
 * gemessen — und nie beim Klick?
 *
 * Der Laufzeit-Test in `nutzungstiefe.test.ts` beweist nur, dass
 * `trackHandlung` richtig filtert und sendet. Ob die Aufrufstelle im
 * try-Block hinter dem `await api.*` sitzt oder davor, sieht man dem
 * Laufzeitverhalten einer einzelnen Komponente nicht an — wohl aber dem
 * Quelltext.
 *
 * Warum das wichtig ist: Ein Klick, der in einem Fehler endet, ist keine
 * Nutzung. Wuerde beim Klick gezaehlt, waeren die Zahlen ausgerechnet dort
 * geschoent, wo sie einer Landeskirche standhalten muessen.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WURZEL = resolve(__dirname, '../../..');
const lies = (p: string) => readFileSync(resolve(WURZEL, p), 'utf8');

/** Datei -> gemessene Handlung(en) und der Aufruf, der vorher gelingen muss. */
const STELLEN: Array<{
  datei: string;
  handlung: string;
  /** Der api-Aufruf, hinter dem die Messung stehen MUSS. */
  vorher: string;
}> = [
  {
    datei: 'src/components/admin/modals/ActivityModal.tsx',
    handlung: 'punkte-vergeben',
    vorher: '/activities`, body)'
  },
  {
    datei: 'src/components/admin/modals/BonusModal.tsx',
    handlung: 'punkte-vergeben',
    vorher: '/bonus-points`, body)'
  },
  {
    datei: 'src/components/admin/modals/ChallengeLeitungModal.tsx',
    handlung: 'beitrag-moderiert',
    vorher: '/moderate`'
  },
  {
    datei: 'src/components/admin/modals/EventModal.tsx',
    handlung: 'termin-angelegt',
    vorher: "api.post('/events/series', payload)"
  },
  {
    datei: 'src/components/admin/modals/MaterialFormModal.tsx',
    handlung: 'material-bereitgestellt',
    vorher: "api.post('/material', payload)"
  },
  {
    datei: 'src/components/admin/views/EventDetailView.tsx',
    handlung: 'anwesenheit-erfasst',
    vorher: '/attendance`'
  }
];

describe('Gemessen wird erst nach der erfolgreichen Antwort', () => {
  it.each(STELLEN)('$datei misst $handlung', ({ datei, handlung }) => {
    const quelle = lies(datei);
    expect(quelle).toContain(`trackHandlung('${handlung}'`);
    expect(quelle).toContain("from '../../../services/analytics'");
  });

  it.each(STELLEN)('$datei misst NACH dem Server-Aufruf', ({ datei, vorher, handlung }) => {
    const quelle = lies(datei);
    const posAufruf = quelle.indexOf(vorher);
    const posMessung = quelle.indexOf(`trackHandlung('${handlung}'`);
    expect(posAufruf).toBeGreaterThan(-1);
    expect(posMessung).toBeGreaterThan(-1);
    // Die Messung steht im Quelltext HINTER dem Aufruf — also im try-Block
    // nach dem await, nicht davor und nicht im Klick-Handler.
    expect(posMessung).toBeGreaterThan(posAufruf);
  });

  it.each(STELLEN)('$datei misst nicht im catch-Zweig', ({ datei, handlung }) => {
    const quelle = lies(datei);
    // Eine fehlgeschlagene Handlung darf kein Erfolgs-Ereignis senden. Im
    // Quelltext heisst das: zwischen einem `catch` und der naechsten Messung
    // darf kein trackHandlung-Aufruf stehen, der zu dieser Handlung gehoert.
    const zeilen = quelle.split('\n');
    let imCatch = false;
    let tiefe = 0;
    for (const zeile of zeilen) {
      if (!imCatch && /\bcatch\s*(\(|\{)/.test(zeile)) {
        imCatch = true;
        tiefe = 0;
      }
      if (imCatch) {
        expect(
          zeile.includes(`trackHandlung('${handlung}'`),
          `${datei}: Messung im catch-Zweig`
        ).toBe(false);
        tiefe += (zeile.match(/\{/g) || []).length;
        tiefe -= (zeile.match(/\}/g) || []).length;
        if (tiefe <= 0 && /\}/.test(zeile)) imCatch = false;
      }
    }
  });
});

describe('Keine Handlung wird doppelt gezaehlt', () => {
  it('die bereits gemessenen Konfi-Handlungen bleiben bei track()', () => {
    // `event-angemeldet` und `challenge-beitrag` gibt es seit August. Wuerden
    // sie zusaetzlich als Handlung gezaehlt, staende dieselbe Tat zweimal in
    // den Zahlen.
    const anmeldung = lies('src/components/konfi/views/EventDetailView.tsx');
    expect(anmeldung).toContain("track('event-angemeldet'");
    expect(anmeldung).not.toContain('trackHandlung(');

    const beitrag = lies('src/components/konfi/modals/ChallengeSubmitModal.tsx');
    expect(beitrag).toContain("track('challenge-beitrag'");
    expect(beitrag).not.toContain('trackHandlung(');
  });

  it('das Bearbeiten eines Termins zaehlt nicht als Anlegen', () => {
    const quelle = lies('src/components/admin/modals/EventModal.tsx');
    // Der PUT-Zweig (Bearbeiten) darf keine Messung tragen.
    const posPut = quelle.indexOf('api.put(`/events/${event.id}`, updatePayload)');
    const posSerie = quelle.indexOf("api.post('/events/series', payload)");
    expect(posPut).toBeGreaterThan(-1);
    expect(posSerie).toBeGreaterThan(posPut);
    // Zwischen dem PUT und dem naechsten POST steht keine Messung.
    expect(quelle.slice(posPut, posSerie)).not.toContain('trackHandlung(');
  });

  it('nur neu eingestelltes Material wird gezaehlt', () => {
    const quelle = lies('src/components/admin/modals/MaterialFormModal.tsx');
    // Die Messung haengt an der Bedingung "kein vorhandenes Material".
    expect(quelle).toMatch(
      /if \(!material\) \{[\s\S]{0,400}?trackHandlung\('material-bereitgestellt'/
    );
  });
});

describe('Die Ereignisnamen und Merkmale stehen fest', () => {
  /**
   * Vollstaendige Sollliste. Kommt ein Wert dazu, faellt dieser Test — und
   * zwingt dazu, ihn bewusst einzutragen statt ihn nebenbei durchzureichen.
   */
  const NAMEN = [
    'punkte-vergeben',
    'anwesenheit-erfasst',
    'beitrag-moderiert',
    'termin-angelegt',
    'material-bereitgestellt'
  ];
  const MERKMALE = [
    'aktivitaet',
    'bonus',
    'gottesdienst',
    'gemeinde',
    'ohne',
    'einzeln',
    'alle',
    'konfi',
    'teamer',
    'freigegeben',
    'ausgeblendet',
    'wieder-sichtbar',
    'anonymisiert',
    'serie',
    'datei',
    'link',
    'beides',
    'nur-text'
  ];

  it('alle Namen und Merkmale stehen so in analytics.ts', () => {
    const analytics = lies('src/services/analytics.ts');
    for (const wert of [...NAMEN, ...MERKMALE]) {
      expect(analytics).toContain(`'${wert}'`);
    }
  });

  it('kein Name traegt eine umschriebene Umlaut-Form', () => {
    // Nutzertexte tragen echte Umlaute. Die Ereignis- und Merkmalsnamen sind
    // technische Schluessel — sie muessen deshalb ohne Umlaut auskommen, und
    // zwar OHNE Umschreibung: kein `aktivitaeten`, kein `jahrgaenge`.
    //
    // `aktivitaet` ist die eine bewusste Ausnahme: der Wert bezeichnet den
    // Weg der Punktevergabe und haette als `aktivität` einen Umlaut im
    // Schluessel. Er ist hier namentlich ausgenommen, damit die Regel nicht
    // still aufweicht.
    const ausnahme = new Set(['aktivitaet']);
    for (const wert of [...NAMEN, ...MERKMALE]) {
      if (ausnahme.has(wert)) continue;
      // Echtes Doppel-s ("erfasst") ist erlaubt, eine ss-Umschreibung eines
      // ß nicht: die faellt bei diesen Woertern mit dem Umlaut-Check auf.
      expect(wert, `${wert} enthaelt eine Umlaut-Umschreibung`).not.toMatch(/ae|oe|ue/);
    }
    // Und kein Wert traegt einen echten Umlaut — Umami-Schluessel bleiben ASCII.
    for (const wert of [...NAMEN, ...MERKMALE]) {
      expect(wert).toMatch(/^[a-z-]+$/);
    }
  });
});
