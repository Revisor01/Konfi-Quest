/**
 * Nutzungstiefe: WAS wird in der App getan?
 *
 * Bis 14.09.2026 zeigten die Zahlen nur, DASS jemand da war (Sitzungen,
 * Bereichsaufrufe, Fehler). Fuer ein Rollout-Gespraech mit einer Landeskirche
 * ist aber die andere Frage die entscheidende: arbeiten Gemeinden wirklich mit
 * der App — werden Punkte vergeben, Anwesenheiten verbucht, Beitraege
 * durchgesehen? `trackHandlung` zaehlt genau das.
 *
 * Hier wird geprueft:
 *  1. Jede Handlung kommt mit den erwarteten, konkreten Merkmalen an.
 *  2. Aus einem Merkmalsobjekt voller Personendaten kommt NICHTS davon heraus —
 *     die Positivliste ist die Sperre, nicht die Disziplin der Aufrufstelle.
 *  3. Ein kaputter Sendeweg stoert die aufrufende Funktion nicht.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Analytics = typeof import('../../services/analytics');

const ladeMitProd = async (): Promise<Analytics> => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  return await import('../../services/analytics');
};

/** Die an Umami gesendete Nutzlast eines fetch-Aufrufs. */
const nutzlast = (aufruf: unknown[]): Record<string, unknown> => {
  const init = aufruf[1] as { body: string };
  return (JSON.parse(init.body) as { payload: Record<string, unknown> }).payload;
};

/** Der komplette gesendete Rumpf als Text — fuer die Personenbezug-Suche. */
const rumpfText = (aufruf: unknown[]): string => (aufruf[1] as { body: string }).body;

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

describe('Jede Handlung kommt mit ihren Merkmalen an', () => {
  it('punkte-vergeben: Aktivitaet mit Punkteart', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('punkte-vergeben', { weg: 'aktivitaet', punkteart: 'gottesdienst' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    expect(p.name).toBe('punkte-vergeben');
    expect(p.data).toEqual({ weg: 'aktivitaet', punkteart: 'gottesdienst' });
  });

  it('punkte-vergeben: Bonuspunkte mit Punkteart', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: 'gemeinde' });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({
      weg: 'bonus',
      punkteart: 'gemeinde'
    });
  });

  it('punkte-vergeben: Teamer-Aktivitaet ohne Punkteart', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('punkte-vergeben', { weg: 'aktivitaet', punkteart: 'ohne' });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({
      weg: 'aktivitaet',
      punkteart: 'ohne'
    });
  });

  it('anwesenheit-erfasst: einzeln und alle, Konfi und Team', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('anwesenheit-erfasst', { umfang: 'einzeln', gruppe: 'konfi' });
    a.trackHandlung('anwesenheit-erfasst', { umfang: 'alle', gruppe: 'teamer' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nutzlast(fetchMock.mock.calls[0]).name).toBe('anwesenheit-erfasst');
    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({
      umfang: 'einzeln',
      gruppe: 'konfi'
    });
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({
      umfang: 'alle',
      gruppe: 'teamer'
    });
  });

  it('beitrag-moderiert: alle vier Entscheidungen', async () => {
    const a = await ladeMitProd();
    for (const e of ['freigegeben', 'ausgeblendet', 'wieder-sichtbar', 'anonymisiert']) {
      a.trackHandlung('beitrag-moderiert', { entscheidung: e });
    }

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const gesendet = fetchMock.mock.calls.map(
      (c) => (nutzlast(c).data as Record<string, string>).entscheidung
    );
    expect(gesendet).toEqual([
      'freigegeben',
      'ausgeblendet',
      'wieder-sichtbar',
      'anonymisiert'
    ]);
  });

  it('termin-angelegt: Einzeltermin und Serie', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('termin-angelegt', { form: 'einzeln', zielgruppe: 'konfi' });
    a.trackHandlung('termin-angelegt', { form: 'serie', zielgruppe: 'teamer' });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({
      form: 'einzeln',
      zielgruppe: 'konfi'
    });
    expect(nutzlast(fetchMock.mock.calls[1]).data).toEqual({
      form: 'serie',
      zielgruppe: 'teamer'
    });
  });

  it('material-bereitgestellt: alle vier Inhaltsarten', async () => {
    const a = await ladeMitProd();
    for (const i of ['datei', 'link', 'beides', 'nur-text']) {
      a.trackHandlung('material-bereitgestellt', { inhalt: i });
    }

    const gesendet = fetchMock.mock.calls.map(
      (c) => (nutzlast(c).data as Record<string, string>).inhalt
    );
    expect(gesendet).toEqual(['datei', 'link', 'beides', 'nur-text']);
  });

  it('die Rolle haengt an, mehr aber nicht', async () => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('admin');
    a.trackHandlung('punkte-vergeben', { weg: 'aktivitaet', punkteart: 'gemeinde' });

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    // Genau diese drei Felder — sonst nichts.
    expect(Object.keys(daten).sort()).toEqual(['punkteart', 'rolle', 'weg']);
    expect(daten.rolle).toBe('admin');
  });

  it('meldet unter demselben festen Pfad wie alle anderen Ereignisse', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('termin-angelegt', { form: 'einzeln', zielgruppe: 'konfi' });

    const p = nutzlast(fetchMock.mock.calls[0]);
    // Echte Routen koennen Namen oder IDs enthalten — deshalb fest.
    expect(p.url).toBe('/app');
    expect(p.hostname).toBe('app.konfi-quest.de');
  });
});

/**
 * Die Datenschutz-Sperre. Die Nutzenden sind ueberwiegend minderjaehrig; eine
 * Gemeinde mit drei Teamer:innen waere ueber die Organisation faktisch
 * identifizierbar. Deshalb ist nicht die Aufrufstelle die Sperre, sondern die
 * Positivliste in `trackHandlung`.
 */
describe('Kein Personenbezug geht mit', () => {
  /** Alles, was aus einer Aufrufstelle versehentlich mitkommen koennte. */
  const personenbezug = {
    name: 'Emilia Petersen',
    konfi_name: 'Emilia Petersen',
    konfiId: '4711',
    user_id: '4711',
    jahrgang: '2026/2027',
    organisation: 'Kirchengemeinde Hennstedt',
    dateiname: 'Gruppenfoto-Konfifreizeit.jpg',
    titel: 'Andacht in der Dorfkirche',
    kommentar: 'War super dabei!',
    // Mehrstellig: eine einzelne Ziffer kaeme in der Website-Kennung zufaellig
    // vor und wuerde die Suche unbrauchbar machen.
    punkte: '137',
    email: 'emilia@example.com',
    zeitpunkt: '2026-09-14T18:30:00.000Z'
  };

  it('verwirft jedes unbekannte Merkmal, sendet das Ereignis aber', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('punkte-vergeben', {
      weg: 'bonus',
      punkteart: 'gemeinde',
      ...personenbezug
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = nutzlast(fetchMock.mock.calls[0]);
    // Die Handlung ist gezaehlt — das ist der Zweck.
    expect(p.name).toBe('punkte-vergeben');
    // Aber nur die beiden erlaubten Merkmale sind drin.
    expect(p.data).toEqual({ weg: 'bonus', punkteart: 'gemeinde' });
  });

  it('keiner der Personenwerte steht irgendwo im gesendeten Rumpf', async () => {
    const a = await ladeMitProd();
    a.setAnalyticsRole('teamer');
    a.trackHandlung('material-bereitgestellt', { inhalt: 'datei', ...personenbezug });

    const rumpf = rumpfText(fetchMock.mock.calls[0]);
    for (const wert of Object.values(personenbezug)) {
      expect(rumpf, `${wert} steht im gesendeten Rumpf`).not.toContain(wert);
    }
    // Und auch keiner der Schluessel — sonst stuende der Feldname im
    // Dashboard. Geprueft wird gegen `data`, denn nur dorthin koennte ein
    // Merkmal geraten; `name` im Rumpf ist Umamis eigenes Feld fuer den
    // Ereignisnamen und hat mit den uebergebenen Merkmalen nichts zu tun.
    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    for (const schluessel of Object.keys(personenbezug)) {
      expect(schluessel in daten, `${schluessel} steht in den Daten`).toBe(false);
    }
    expect(Object.keys(daten).sort()).toEqual(['inhalt', 'rolle']);
  });

  it('ein erlaubter Schluessel mit fremdem Wert faellt heraus', async () => {
    const a = await ladeMitProd();
    // Genau der gefaehrliche Fall: der Schluessel stimmt, der Wert kommt aus
    // einem Formular (hier der Name einer Aktivitaet).
    a.trackHandlung('punkte-vergeben', {
      weg: 'aktivitaet',
      punkteart: 'Gottesdienst in Hennstedt'
    });

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    expect(daten).toEqual({ weg: 'aktivitaet' });
    expect(rumpfText(fetchMock.mock.calls[0])).not.toContain('Hennstedt');
  });

  it('sendet keine Anzahl mit, auch wenn eine uebergeben wird', async () => {
    const a = await ladeMitProd();
    // Bei einer kleinen Gemeinde waere die Gruppengroesse ein Fingerabdruck.
    a.trackHandlung('anwesenheit-erfasst', {
      umfang: 'alle',
      gruppe: 'konfi',
      anzahl: '3'
    });

    expect(nutzlast(fetchMock.mock.calls[0]).data).toEqual({
      umfang: 'alle',
      gruppe: 'konfi'
    });
  });

  it('eine unbekannte Handlung wird gar nicht gesendet', async () => {
    const a = await ladeMitProd();
    // Ein Tippfehler soll keinen neuen Ereignisnamen im Dashboard erzeugen.
    (a.trackHandlung as (h: string, m?: Record<string, string>) => void)(
      'punkte-vergebn',
      { weg: 'bonus' }
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leere und nicht gesetzte Merkmale erzeugen keine Felder', async () => {
    const a = await ladeMitProd();
    a.trackHandlung('termin-angelegt', { form: 'einzeln', zielgruppe: undefined });

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    expect(daten).toEqual({ form: 'einzeln' });
    expect('zielgruppe' in daten).toBe(false);
  });
});

/**
 * Die Messung darf die App nie stoeren. Ein fehlgeschlagenes Ereignis darf
 * niemals verhindern, dass Punkte vergeben werden.
 */
describe('Ein kaputter Sendeweg stoert nichts', () => {
  it('wirft nicht, wenn fetch synchron wirft', async () => {
    const a = await ladeMitProd();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('kein Netz'); }));

    expect(() =>
      a.trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: 'gemeinde' })
    ).not.toThrow();
  });

  it('wirft nicht, wenn fetch ein abgelehntes Promise liefert', async () => {
    const a = await ladeMitProd();
    const abgelehnt = vi.fn().mockRejectedValue(new Error('Server weg'));
    vi.stubGlobal('fetch', abgelehnt);

    expect(() =>
      a.trackHandlung('anwesenheit-erfasst', { umfang: 'alle', gruppe: 'konfi' })
    ).not.toThrow();
    expect(abgelehnt).toHaveBeenCalledTimes(1);
    // Die Ablehnung ist abgefangen, nicht offen — sonst schlaegt sie als
    // unhandledRejection zu.
    await Promise.resolve();
  });

  it('wirft nicht, wenn fetch gar nicht existiert', async () => {
    const a = await ladeMitProd();
    vi.stubGlobal('fetch', undefined);

    expect(() =>
      a.trackHandlung('beitrag-moderiert', { entscheidung: 'freigegeben' })
    ).not.toThrow();
  });

  it('die aufrufende Funktion laeuft trotz kaputter Messung zu Ende', async () => {
    const a = await ladeMitProd();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('kaputt'); }));

    // Nachbau der Aufrufstelle: Punkte sind vergeben, danach wird gemessen.
    let punkteVergeben = false;
    let durchgelaufen = false;
    const punkteVergebenUndMessen = () => {
      punkteVergeben = true;
      a.trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: 'gemeinde' });
      durchgelaufen = true;
    };

    expect(punkteVergebenUndMessen).not.toThrow();
    expect(punkteVergeben).toBe(true);
    expect(durchgelaufen).toBe(true);
  });

  it('sendet gar nicht, solange die Messung abgeschaltet ist', async () => {
    vi.resetModules();
    vi.stubEnv('PROD', false);
    const a = await import('../../services/analytics');
    a.trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: 'gemeinde' });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
