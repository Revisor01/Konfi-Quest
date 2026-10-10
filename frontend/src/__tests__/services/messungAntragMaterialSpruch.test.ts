/**
 * Drei Messpunkte, die Simon ausdrücklich will (27.09.2026):
 *
 *   „Aktivitäten wäre auch gut: wie oft abgelehnt wird. Und auch hier Teamer,
 *   Konfi — gibt's ja für beide. Material hinterlegt, abgerufen auch bitte.
 *   Konfi-Sprüche später auch verfolgen: welche Sprüche, welche Übersetzung,
 *   eigene."
 *
 *   - `antrag-entschieden`     Die Leitung nimmt einen Antrag an oder lehnt ihn ab.
 *   - `material-angesehen`     Die Detailansicht eines Materials ist geöffnet.
 *   - `material-abgerufen`     Eine Datei oder ein Link daraus ist geöffnet.
 *   - `konfispruch-erste-wahl` / `konfispruch-gewechselt` (seit 10.10.2026,
 *     trackKonfispruchWahl) Spruch, Übersetzung, Gemeinde; beim Wechsel der alte.
 *
 * Geprüft wird hier:
 *   1. Name und Merkmale kommen EXAKT so an (keine weiteren Felder).
 *   2. Die Positivliste verwirft alles andere — Freitext, Titel, Kennung,
 *      Bibelstelle, Rohwerte des Servers.
 *   3. Die Hilfen `materialInhalt` und `bereichAusPfad`.
 *   4. An den Aufrufstellen steht die Messung HINTER dem erfolgreichen
 *      Server-Aufruf und VOR dem catch (Muster aus mitmachenMessung.test.ts).
 *
 * Wie es gerendert wirkt, prüfen die Komponententests
 * messungAntragEntschieden, messungMaterialAbruf und messungKonfispruch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Analytics = typeof import('../../services/analytics');

const ladeMitProd = async (): Promise<Analytics> => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return await import('../../services/analytics');
};

const nutzlast = (aufruf: unknown[]): Record<string, unknown> => {
  const init = aufruf[1] as { body: string };
  return (JSON.parse(init.body) as { payload: Record<string, unknown> }).payload;
};

const rumpfText = (aufruf: unknown[]): string => (aufruf[1] as { body: string }).body;

const WURZEL = resolve(__dirname, '../../..');
const lies = (p: string) => readFileSync(resolve(WURZEL, p), 'utf8');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('antrag-entschieden: Name und Merkmale', () => {
  it.each([
    ['angenommen', 'konfi'],
    ['angenommen', 'teamer'],
    ['abgelehnt', 'konfi'],
    ['abgelehnt', 'teamer'],
  ])('%s, Antrag von %s', async (entscheidung, antragVon) => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('admin');
    a.trackHandlung('antrag-entschieden', { entscheidung, antrag_von: antragVon });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('antrag-entschieden');
    expect(p.data).toEqual({ entscheidung, antrag_von: antragVon, rolle: 'admin' });
  });

  it('verwirft Ablehnungsgrund, Aktivität, Punkte, Namen und Rohwerte des Servers', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('antrag-entschieden', {
      // Rohwert des Servers statt des Messwerts: fällt heraus.
      entscheidung: 'rejected',
      // Nur konfi und teamer sind Antragsteller — nie die Leitung.
      antrag_von: 'admin',
      admin_comment: 'Foto fehlt, bitte nachreichen',
      activity_name: 'Gottesdienst in Hennstedt',
      activity_points: '137',
      konfi_name: 'Emilia Petersen',
      request_id: '4711',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    // Gezählt ist die Entscheidung trotzdem — nur ohne jedes Merkmal.
    expect(p.name).toBe('antrag-entschieden');
    expect(p.data).toEqual({});
    const rumpf = rumpfText(fetchMock.mock.calls[0]);
    for (const verboten of ['rejected', 'Foto fehlt', 'Hennstedt', '137', 'Emilia', '4711']) {
      expect(rumpf, `${verboten} steht im Rumpf`).not.toContain(verboten);
    }
  });
});

describe('material-angesehen und material-abgerufen: Name und Merkmale', () => {
  it.each(['datei', 'link', 'beides', 'nur-text'])(
    'material-angesehen mit inhalt %s',
    async (inhalt) => {
      const a = await ladeMitProd();
      a.setAnalyticsRole('teamer');
      a.trackHandlung('material-angesehen', { inhalt });

      const p = nutzlast(fetchMock.mock.calls[0]);
      expect(p.name).toBe('material-angesehen');
      expect(p.data).toEqual({ inhalt, rolle: 'teamer' });
    }
  );

  it.each(['datei', 'link'])('material-abgerufen mit inhalt %s', async (inhalt) => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('teamer');
    a.trackHandlung('material-abgerufen', { inhalt });

    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('material-abgerufen');
    expect(p.data).toEqual({ inhalt, rolle: 'teamer' });
  });

  it('abgerufen kennt nur datei und link — nicht die Inhaltsarten des Materials', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('material-abgerufen', { inhalt: 'beides' });
    a.trackHandlung('material-abgerufen', { inhalt: 'nur-text' });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({});
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({});
  });

  it('verwirft Titel, Dateiname, Dateityp, Link-Adresse und Kennung', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('material-abgerufen', {
      inhalt: 'Gruppenfoto-Konfifreizeit.jpg',
      titel: 'Andacht in der Dorfkirche',
      mime_type: 'image/jpeg',
      url: 'https://example.org/liederheft',
      material_id: '4711',
    });
    a.trackHandlung('material-angesehen', { inhalt: 'Andacht in der Dorfkirche', id: '4711' });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({});
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({});
    const rumpfe = fetchMock.mock.calls.map(rumpfText).join('\n');
    for (const verboten of ['Gruppenfoto', 'Dorfkirche', 'image/jpeg', 'example.org', '4711']) {
      expect(rumpfe, `${verboten} steht im Rumpf`).not.toContain(verboten);
    }
  });
});

describe('Konfispruch: erste Wahl und Wechsel (trackKonfispruchWahl)', () => {
  const JOSUA = { quelle: 'vorschlag' as const, id: 11, stelle: 'Josua 1,9', bibel: 'luther' };
  const PSALM = { quelle: 'vorschlag' as const, id: 12, stelle: 'Psalm 23,1', bibel: 'bigs' };
  const EIGEN = { quelle: 'eigen' as const, text: 'Ich bin bei dir', stelle: 'Mt 28,20' };

  it('erste Wahl eines Vorschlags: genau diese Felder, dazu die Rolle', async () => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('konfi');
    a.trackKonfispruchWahl(JOSUA, null, { gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('konfispruch-erste-wahl');
    expect(p.data).toEqual({
      quelle: 'vorschlag', spruch: 'Josua 1,9', spruch_id: '11', bibel: 'luther',
      gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', rolle: 'konfi',
    });
  });

  it('erste Wahl eines eigenen Spruchs: Wortlaut und Stellenangabe', async () => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('teamer');
    a.trackKonfispruchWahl(EIGEN, null, { gemeinde: 'Kirchengemeinde Heide', kirchenkreis: null, landeskirche: null });

    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('konfispruch-erste-wahl');
    expect(p.data).toEqual({
      quelle: 'eigen', spruch: 'Ich bin bei dir', stelle: 'Mt 28,20',
      gemeinde: 'Kirchengemeinde Heide', rolle: 'teamer',
    });
  });

  it('gleicher Spruch erneut gespeichert: kein Ereignis', async () => {
    const a = await ladeMitProd();
    a.trackKonfispruchWahl(JOSUA, { ...JOSUA }, { gemeinde: 'G' });
    a.trackKonfispruchWahl(EIGEN, { ...EIGEN, text: '  Ich bin\nbei dir ' }, { gemeinde: 'G' });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('Wechsel: ein Ereignis gewechselt mit dem neuen Spruch und den vorher-Feldern', async () => {
    const a = await ladeMitProd();
    a.trackKonfispruchWahl(EIGEN, JOSUA, { gemeinde: 'G', kirchenkreis: 'K', landeskirche: 'L' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('konfispruch-gewechselt');
    expect(p.data).toEqual({
      quelle: 'eigen', spruch: 'Ich bin bei dir', stelle: 'Mt 28,20',
      vorher_quelle: 'vorschlag', vorher_spruch: 'Josua 1,9', vorher_spruch_id: '11', vorher_bibel: 'luther',
      gemeinde: 'G', kirchenkreis: 'K', landeskirche: 'L',
    });
  });

  it('andere Übersetzung desselben Spruchs ist ein Wechsel', async () => {
    const a = await ladeMitProd();
    a.trackKonfispruchWahl({ ...JOSUA, bibel: 'bigs' }, JOSUA, { gemeinde: 'G' });
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('konfispruch-gewechselt');
    expect(p.data).toEqual({
      quelle: 'vorschlag', spruch: 'Josua 1,9', spruch_id: '11', bibel: 'bigs',
      vorher_quelle: 'vorschlag', vorher_spruch: 'Josua 1,9', vorher_spruch_id: '11', vorher_bibel: 'luther',
      gemeinde: 'G',
    });
  });

  it('Wechsel zwischen zwei Vorschlägen', async () => {
    const a = await ladeMitProd();
    a.trackKonfispruchWahl(PSALM, JOSUA, null);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.data).toEqual({
      quelle: 'vorschlag', spruch: 'Psalm 23,1', spruch_id: '12', bibel: 'bigs',
      vorher_quelle: 'vorschlag', vorher_spruch: 'Josua 1,9', vorher_spruch_id: '11', vorher_bibel: 'luther',
    });
  });

  it('säubert und kürzt: Steuerzeichen und Umbrüche zu Leerzeichen, höchstens 500 Zeichen', async () => {
    const a = await ladeMitProd();
    const lang = `Zeile eins\n\nZeile\tzwei\u0007 ${'x'.repeat(600)}`;
    a.trackKonfispruchWahl({ quelle: 'eigen', text: lang, stelle: ' Ps 1 ' }, null, { gemeinde: ' G ' });
    const d = nutzlast(fetchMock.mock.calls[0]).data as Record<string, string>;
    expect(d.spruch.length).toBe(500);
    expect(d.spruch.startsWith('Zeile eins Zeile zwei x')).toBe(true);
    expect(d.stelle).toBe('Ps 1');
    expect(d.gemeinde).toBe('G');
    expect(a.UMAMI_TEXT_HOECHSTENS).toBe(500);
  });

  it('eine unbekannte Übersetzung und eine unsinnige Kennung fallen heraus', async () => {
    const a = await ladeMitProd();
    a.trackKonfispruchWahl({ quelle: 'vorschlag', id: 0, stelle: 'Josua 1,9', bibel: 'luther2017' }, null, { gemeinde: '' });
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({ quelle: 'vorschlag', spruch: 'Josua 1,9' });
  });

  it('das alte Ereignis konfispruch-gespeichert geht nicht mehr raus', async () => {
    const a = await ladeMitProd();
    // Nicht mehr in der Liste der Handlungen: trackHandlung verwirft es ganz.
    (a.trackHandlung as (h: string, m?: Record<string, string>) => void)('konfispruch-gespeichert', { quelle: 'eigen' });
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('die Übersetzungen sind genau die Auswahl der App', () => {
    const modal = lies('src/components/konfi/modals/KonfispruchSelectModal.tsx');
    expect(modal).toContain(
      "const TRANSLATION_KEYS: Translation[] = ['luther2017', 'bigs', 'gute_nachricht', 'elberfelder'];"
    );
    expect(modal).toMatch(
      /BIBEL_MESSWERT: Record<Translation, string> = \{\s*luther2017: 'luther',\s*bigs: 'bigs',\s*gute_nachricht: 'gute-nachricht',\s*elberfelder: 'elberfelder'\s*\}/
    );
    const analytics = lies('src/services/analytics.ts');
    expect(analytics).toContain("const ERLAUBTE_BIBEL = ['luther', 'gute-nachricht', 'bigs', 'elberfelder'];");
  });
});

describe('materialInhalt: dieselben Werte beim Einstellen und beim Ansehen', () => {
  it.each([
    [true, true, 'beides'],
    [true, false, 'datei'],
    [false, true, 'link'],
    [false, false, 'nur-text'],
  ] as const)('Datei %s, Link %s -> %s', async (hatDatei, hatLink, erwartet) => {
    const a = await ladeMitProd();
    expect(a.materialInhalt(hatDatei, hatLink)).toBe(erwartet);
  });

  it('das Einstellen nutzt dieselbe Hilfe', () => {
    const quelle = lies('src/components/admin/modals/MaterialFormModal.tsx');
    expect(quelle).toContain("trackHandlung('material-bereitgestellt', {\n              inhalt: materialInhalt(hatDatei, hatLink)");
  });
});

describe('bereichAusPfad: der Material-Reiter des Teams zählt als material', () => {
  it.each([
    // Befund B3: der Reiter „Material" des Teams liegt unter /teamer/profile/.
    ['/teamer/profile/material', 'material'],
    ['/teamer/profile/badges', 'badges'],
    ['/teamer/profile/konfi-stats', 'konfi-stats'],
    // Das Profil selbst bleibt das Profil.
    ['/teamer/profile', 'profile'],
    ['/konfi/profile', 'profile'],
    ['/admin/profile', 'profile'],
    // Unverändert: der zweite Pfadteil, Detailseiten unter ihrem Bereich.
    ['/teamer/material', 'material'],
    ['/admin/material', 'material'],
    ['/admin/konfis/42', 'konfis'],
    ['/konfi/chat/room/5', 'chat'],
    ['/admin/settings/categories', 'settings'],
    ['/konfi/events', 'events'],
    ['/login', 'login'],
  ])('%s -> %s', async (pfad, erwartet) => {
    const a = await ladeMitProd();
    expect(a.bereichAusPfad(pfad)).toBe(erwartet);
  });

  it.each([
    // Befund B2: ein unbekannter Pfad mit einer Kennung an zweiter Stelle.
    ['/konfi/42', 'Kennung'],
    ['/teamer/profile/7', 'Kennung unter dem Profil'],
    ['/admin/Konfis', 'Großbuchstaben'],
    ['/', 'leerer Pfad'],
    ['', 'gar kein Pfad'],
  ])('%s liefert keinen Bereich (%s)', async (pfad) => {
    const a = await ladeMitProd();
    expect(a.bereichAusPfad(pfad)).toBeNull();
  });

  it('MainTabs misst über bereichAusPfad', () => {
    const quelle = lies('src/components/layout/MainTabs.tsx');
    expect(quelle).toContain('const bereich = bereichAusPfad(location.pathname);');
    expect(quelle).toContain('if (bereich) trackBereich(bereich);');
    expect(quelle).not.toContain("location.pathname.split('/')");
  });
});

/**
 * Die Aufrufstellen. Gemessen wird HINTER dem erfolgreichen Server-Aufruf
 * und VOR dem zugehörigen catch — ein Klick, der scheitert, ist keine Nutzung.
 */
/** Der Rumpf des catch-Zweigs, der bei `posCatch` (`} catch`) beginnt. */
const catchRumpf = (quelle: string, posCatch: number): string => {
  const start = quelle.indexOf('{', posCatch + 1);
  let tiefe = 0;
  for (let i = start; i < quelle.length; i++) {
    if (quelle[i] === '{') tiefe++;
    if (quelle[i] === '}') tiefe--;
    if (tiefe === 0) return quelle.slice(start, i + 1);
  }
  return quelle.slice(start);
};

const hinterAufrufVorCatch = (datei: string, aufruf: string, messung: string) => {
  const quelle = lies(datei);
  const posAufruf = quelle.indexOf(aufruf);
  const posMessung = quelle.indexOf(messung, posAufruf);
  const posCatch = quelle.indexOf('} catch', posAufruf);
  expect(posAufruf, `${datei}: ${aufruf} fehlt`).toBeGreaterThan(-1);
  expect(posMessung, `${datei}: ${messung} fehlt hinter dem Aufruf`).toBeGreaterThan(posAufruf);
  expect(posCatch, `${datei}: kein catch hinter dem Aufruf`).toBeGreaterThan(-1);
  expect(posMessung, `${datei}: Messung steht nicht vor dem catch`).toBeLessThan(posCatch);
  // Und im catch-Zweig selbst steht keine Messung.
  expect(catchRumpf(quelle, posCatch)).not.toContain('trackHandlung(');
};

describe('Aufrufstellen: nach der Antwort, nicht im catch', () => {
  it('Leitung entscheidet einen Antrag (ActivityRequestModal)', () => {
    hinterAufrufVorCatch(
      'src/components/admin/modals/ActivityRequestModal.tsx',
      'await api.put(`/admin/activities/requests/${request.id}`, body);',
      "trackHandlung('antrag-entschieden', {"
    );
  });

  it('Antrag: Entscheidung und Antragsteller kommen aus dem Antrag, nicht aus Freitext', () => {
    const quelle = lies('src/components/admin/modals/ActivityRequestModal.tsx');
    expect(quelle).toContain(
      "trackHandlung('antrag-entschieden', {\n            entscheidung: selectedAction === 'approve' ? 'angenommen' : 'abgelehnt',\n            antrag_von: request.activity_target_role\n          });"
    );
  });

  it('Antrag: genau eine Messstelle — offline eingereihte Entscheidungen zählen nicht', () => {
    const quelle = lies('src/components/admin/modals/ActivityRequestModal.tsx');
    // Eine einzige Messung, und die steht (Test oben) vor dem catch des
    // Online-Zweigs; der Offline-Zweig mit writeQueue folgt erst danach.
    expect(quelle.split('trackHandlung(').length - 1).toBe(1);
    expect(quelle.indexOf('await writeQueue.enqueue({')).toBeGreaterThan(
      quelle.indexOf("trackHandlung('antrag-entschieden'")
    );
  });

  // Seit dem gemeinsamen Medien-Weg (27.09.2026, Paket M3) laedt das Detail
  // ueber materialDetailLaden (erst der Server, ohne Netz der gemerkte Stand)
  // und eine Datei ueber useDateiOeffnen (Medien-Cache). Gemessen wird weiter
  // erst nach dem Erfolg: angesehen nur mit einer Antwort des Servers
  // (!ausSpeicher), abgerufen nur, wenn dateiOeffnen die Datei geladen hat.
  it('Material-Reiter: Detail geöffnet (TeamerMaterialPage.openDetail)', () => {
    hinterAufrufVorCatch(
      'src/components/teamer/pages/TeamerMaterialPage.tsx',
      'const { daten, ausSpeicher } = await materialDetailLaden<MaterialDetail>(matId);',
      "if (!ausSpeicher) {\n        trackHandlung('material-angesehen', {"
    );
  });

  it.each([
    'src/components/teamer/pages/TeamerMaterialPage.tsx',
    'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
  ])('%s: Datei abgerufen nur, wenn dateiOeffnen sie geladen hat', (datei) => {
    expect(lies(datei)).toContain(
      "    if (await dateiOeffnen(file.stored_name, file.original_name, file.mime_type)) {\n" +
      "      trackHandlung('material-abgerufen', { inhalt: 'datei' });\n" +
      '    }'
    );
  });

  it('dateiOeffnen meldet Erfolg erst nach dem Laden der Datei, nie im catch vor dem Laden', () => {
    const quelle = lies('src/hooks/useDateiOeffnen.ts');
    const posLaden = quelle.indexOf('const blob = await getMediaBlob(filePath, {');
    const posGeladen = quelle.indexOf('geladen = true;', posLaden);
    expect(posLaden).toBeGreaterThan(-1);
    expect(posGeladen).toBeGreaterThan(posLaden);
    expect(quelle).toContain('let geladen = false;');
    expect(quelle).toContain('if (ladendeDatei) return false;');
    expect(catchRumpf(quelle, quelle.indexOf('} catch', posGeladen))).toContain('return geladen;');
  });

  it.each([
    'src/components/teamer/pages/TeamerMaterialPage.tsx',
    'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
  ])('%s: Link erst nach der Prüfung und dem Öffnen', (datei) => {
    const quelle = lies(datei);
    const posPruefung = quelle.indexOf('if (!istWebLink(url)) {');
    const posOeffnen = quelle.indexOf('linkOeffnen(url);', posPruefung);
    const posMessung = quelle.indexOf("trackHandlung('material-abgerufen', { inhalt: 'link' });");
    expect(posPruefung).toBeGreaterThan(-1);
    expect(posOeffnen).toBeGreaterThan(posPruefung);
    expect(posMessung).toBeGreaterThan(posOeffnen);
  });

  it('Material an einem Event: angesehen erst nach der erfolgreichen Antwort, einmal je Öffnen', () => {
    const quelle = lies('src/components/teamer/pages/TeamerMaterialDetailPage.tsx');
    // Nach materialDetailLaden und nur mit einer Antwort des Servers — ein
    // Stand nur vom Gerät (ohne Netz) zählt nicht; einmal je Öffnen.
    hinterAufrufVorCatch(
      'src/components/teamer/pages/TeamerMaterialDetailPage.tsx',
      'const { daten, ausSpeicher } = await materialDetailLaden<MaterialDetail>(materialId);',
      "trackHandlung('material-angesehen', {"
    );
    expect(quelle).toMatch(
      /if \(!ausSpeicher && !angesehenGemeldet\.current\) \{\s*angesehenGemeldet\.current = true;\s*trackHandlung\('material-angesehen', \{/
    );
    expect(quelle).toContain('const angesehenGemeldet = useRef(false);');
  });

  it.each([
    ["api.patch(`${apiBasePath}/profile`, {\n            konfspruch_id: selectedSpruchId,", "trackKonfispruchWahl(\n            { quelle: 'vorschlag'"],
    ["api.patch(`${apiBasePath}/profile`, {\n            konfspruch_freitext: text,", "trackKonfispruchWahl({ quelle: 'eigen'"],
  ])('Konfispruch (%#): gemessen nach dem PATCH, vor dem catch', (aufruf, messung) => {
    hinterAufrufVorCatch(
      'src/components/konfi/modals/KonfispruchSelectModal.tsx',
      `await ${aufruf}`,
      messung
    );
    const quelle = lies('src/components/konfi/modals/KonfispruchSelectModal.tsx');
    expect(catchRumpf(quelle, quelle.indexOf('} catch', quelle.indexOf(aufruf)))).not.toContain('trackKonfispruchWahl(');
  });

  it('Konfispruch: der Vorher-Stand kommt aus der Anzeige, die Gemeinde aus dem Konto -- nie eine Person', () => {
    const quelle = lies('src/components/konfi/modals/KonfispruchSelectModal.tsx');
    expect(quelle).toContain('kirchenkreis: aktiveGemeinde?.kirchenkreis,');
    expect(quelle).toContain('landeskirche: aktiveGemeinde?.landeskirche,');
    expect(quelle.match(/const vorher = wahlAusAnzeige\(current\);/g)?.length).toBe(2);
    const messungen = quelle.match(/trackKonfispruchWahl\([\s\S]*?\);/g) || [];
    expect(messungen.length).toBe(2);
    for (const m of messungen) {
      expect(m).toContain('vorher');
      expect(m).toMatch(/vorher,\s*ort\s*\)/);
      expect(m).not.toMatch(/display_name|username|user\.id|user\?\.id|jahrgang/);
    }
    expect(quelle).not.toContain('trackHandlung(');
  });

});
