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
    // Die Moderation steht seit der Web-Fassung der Challenges (03.10.2026)
    // im Hook, den die Ansicht der App und die Web-Fassung gemeinsam nutzen.
    datei: 'src/components/admin/views/useChallengeLeitung.ts',
    handlung: 'beitrag-moderiert',
    vorher: '/moderate`'
  },
  {
    datei: 'src/components/admin/modals/EventModal.tsx',
    handlung: 'termin-angelegt',
    vorher: "api.post('/events/series', { ...payload, client_id: anlegeKennung.current })"
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
  },
  // Simon, 27.09.2026: Anträge, Material, Konfispruch
  // (docs/messung/umami.md, U1–U3).
  {
    datei: 'src/components/admin/modals/ActivityRequestModal.tsx',
    handlung: 'antrag-entschieden',
    vorher: 'api.put(`/admin/activities/requests/${request.id}`, body)'
  },
  {
    datei: 'src/components/teamer/pages/TeamerMaterialPage.tsx',
    handlung: 'material-angesehen',
    vorher: 'await materialDetailLaden<MaterialDetail>(matId)'
  },
  {
    datei: 'src/components/teamer/pages/TeamerMaterialPage.tsx',
    handlung: 'material-abgerufen',
    vorher: 'await dateiOeffnen(file.stored_name, file.original_name, file.mime_type)'
  },
  {
    datei: 'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
    handlung: 'material-angesehen',
    vorher: 'await materialDetailLaden<MaterialDetail>(materialId)'
  },
  {
    datei: 'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
    handlung: 'material-abgerufen',
    vorher: 'await dateiOeffnen(file.stored_name, file.original_name, file.mime_type)'
  },
  {
    datei: 'src/components/konfi/modals/KonfispruchSelectModal.tsx',
    handlung: 'konfispruch-gespeichert',
    vorher: 'api.patch(`${apiBasePath}/profile`'
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
    //
    // Gezaehlt wird erst ab dem Wort `catch`: In `} catch (err) {` schliesst
    // die erste Klammer den try-Block. Bis 27.09.2026 zaehlte sie mit, die
    // Tiefe stand damit in derselben Zeile wieder auf 0 — und der Rumpf des
    // catch wurde nie angesehen. Der Test war gruen, ohne etwas zu pruefen.
    const zeilen = quelle.split('\n');
    let imCatch = false;
    let tiefe = 0;
    let catchZeilen = 0;
    for (const zeile of zeilen) {
      let rest = zeile;
      if (!imCatch && /\bcatch\s*(\(|\{)/.test(zeile)) {
        imCatch = true;
        tiefe = 0;
        rest = zeile.slice(zeile.search(/\bcatch\b/));
      }
      if (imCatch) {
        catchZeilen++;
        expect(
          zeile.includes(`trackHandlung('${handlung}'`),
          `${datei}: Messung im catch-Zweig`
        ).toBe(false);
        tiefe += (rest.match(/\{/g) || []).length;
        tiefe -= (rest.match(/\}/g) || []).length;
        if (tiefe <= 0 && /\}/.test(rest)) imCatch = false;
      }
    }
    // Gegenprobe gegen einen leeren Lauf: jede dieser Dateien hat catch-Zweige
    // mit Rumpf, also muessen mehr Zeilen angesehen worden sein als catch-Koepfe.
    const koepfe = zeilen.filter((z) => /\bcatch\s*(\(|\{)/.test(z)).length;
    expect(catchZeilen).toBeGreaterThan(koepfe);
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
    const posSerie = quelle.indexOf("api.post('/events/series', { ...payload, client_id: anlegeKennung.current })");
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
    'material-bereitgestellt',
    'antrag-entschieden',
    'material-angesehen',
    'material-abgerufen',
    'konfispruch-gespeichert'
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
    'nur-text',
    'angenommen',
    'abgelehnt',
    'vorschlag',
    'eigen',
    'luther',
    'gute-nachricht',
    'bigs',
    'elberfelder'
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
