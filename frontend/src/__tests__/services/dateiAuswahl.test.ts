import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Die Dateiauswahl der App läuft durch EINE Hülle (Simons Befund 29.09.2026,
// Android-Testbuild 128: „Dateiauswahl ist auch noch nicht als Ausnahme beim
// Biometrie öffnen."). Geprüft wird hier die Hülle selbst: Der Ausflug-Merker
// der App-Sperre steht, solange die Auswahl offen ist, und fällt verlässlich
// wieder — bei Auswahl, bei Abbruch, über die Rückkehr des Fokus und
// spätestens über die Notbremse. Merker und Uhr sind echt (Uhr gestellt).

import {
  dateiAuswaehlen,
  AUSWAHL_NACHLAUF_MS,
  AUSWAHL_RUECKKEHR_FRIST_MS,
  AUSWAHL_RUECKKEHR_HINWEIS_MS,
  DATEI_AUSFLUG_HOECHSTENS_MS,
  IM_SPEICHER_HOECHSTENS_BYTES,
} from '../../services/systemDialoge';
import { laeuftAusflug, ausflugStarten, ausflugBeenden } from '../../services/appSperre';

const echterKlick = HTMLInputElement.prototype.click;
let geoeffnet: HTMLInputElement[] = [];
let ausflugBeimOeffnen: boolean[] = [];

const datei = (name: string, typ = 'application/pdf') => new File(['x'], name, { type: typ });

/** Das System meldet eine Auswahl: Dateien ins Feld, dann `change`. */
const waehlen = (feld: HTMLInputElement, dateien: File[]) => {
  Object.defineProperty(feld, 'files', { value: dateien, configurable: true });
  feld.onchange?.(new Event('change'));
};

beforeEach(() => {
  vi.useFakeTimers();
  geoeffnet = [];
  ausflugBeimOeffnen = [];
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
    geoeffnet.push(this);
    ausflugBeimOeffnen.push(laeuftAusflug());
  };
});

afterEach(() => {
  // Liegengebliebene Ausflüge dürfen den nächsten Fall nicht verfälschen.
  vi.runOnlyPendingTimers();
  while (laeuftAusflug()) ausflugBeenden();
  vi.useRealTimers();
  HTMLInputElement.prototype.click = echterKlick;
});

describe('Die Hülle öffnet die Auswahl des Systems', () => {
  it('ein frisches, verstecktes Datei-Feld mit accept und multiple', () => {
    void dateiAuswaehlen({ accept: 'image/*,.pdf', multiple: true });

    expect(geoeffnet).toHaveLength(1);
    expect(geoeffnet[0].type).toBe('file');
    expect(geoeffnet[0].accept).toBe('image/*,.pdf');
    expect(geoeffnet[0].multiple).toBe(true);
    expect(geoeffnet[0].isConnected).toBe(false);
  });

  it('ohne Angaben: eine einzelne Datei, kein Filter', () => {
    void dateiAuswaehlen();

    expect(geoeffnet[0].multiple).toBe(false);
    expect(geoeffnet[0].accept).toBe('');
  });
});

describe('Der Ausflug läuft, solange die Auswahl offen ist', () => {
  it('er steht schon, wenn die Auswahl aufgeht — nicht erst danach', () => {
    expect(laeuftAusflug()).toBe(false);

    void dateiAuswaehlen({ accept: 'image/*' });

    expect(ausflugBeimOeffnen).toEqual([true]);
    expect(laeuftAusflug()).toBe(true);
  });

  it('auch minutenlanges Blättern in der Mediathek hält ihn', () => {
    void dateiAuswaehlen();

    vi.advanceTimersByTime(4 * 60 * 1000);

    expect(laeuftAusflug()).toBe(true);
  });
});

describe('Auswahl: die Dateien kommen an, der Ausflug endet nach dem Nachlauf', () => {
  it('eine Datei', async () => {
    const auswahl = dateiAuswaehlen({ accept: '.pdf' });
    const plan = datei('plan.pdf');

    waehlen(geoeffnet[0], [plan]);

    await expect(auswahl).resolves.toEqual([plan]);
    // Der Rückweg in die App (appStateChange) kommt womöglich erst nach dem
    // change-Ereignis an — bis dahin muss der Merker noch stehen.
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS - 1);
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(laeuftAusflug()).toBe(false);
  });

  it('mehrere Dateien, in der gewählten Reihenfolge', async () => {
    const auswahl = dateiAuswaehlen({ multiple: true });
    const a = datei('a.pdf');
    const b = datei('b.txt', 'text/plain');

    waehlen(geoeffnet[0], [a, b]);

    const dateien = await auswahl;
    expect(dateien).toHaveLength(2);
    // Dokumente kommen als Kopie im Speicher zurueck (01.10.2026, Abschnitt
    // unten) -- verglichen wird deshalb Name und Inhalt, nicht das Objekt.
    expect(dateien!.map((d) => d.name)).toEqual(['a.pdf', 'b.txt']);
    expect(await dateien![1].text()).toBe('x');
  });

  it('das Feld wird erst ausgelesen, dann geleert', async () => {
    const auswahl = dateiAuswaehlen();
    const feld = geoeffnet[0];
    const wertGeleert = vi.fn();
    Object.defineProperty(feld, 'value', { configurable: true, get: () => 'C:\\fakepath\\plan.pdf', set: wertGeleert });

    waehlen(feld, [datei('plan.pdf')]);

    expect((await auswahl)?.map((d) => d.name)).toEqual(['plan.pdf']);
    expect(wertGeleert).toHaveBeenCalledWith('');
  });

  it('dieselbe Datei lässt sich gleich noch einmal wählen', async () => {
    const plan = datei('plan.pdf');

    const erste = dateiAuswaehlen();
    waehlen(geoeffnet[0], [plan]);
    await expect(erste).resolves.toEqual([plan]);

    const zweite = dateiAuswaehlen();
    waehlen(geoeffnet[1], [plan]);
    await expect(zweite).resolves.toEqual([plan]);
    expect(geoeffnet[1]).not.toBe(geoeffnet[0]);
  });

  it('ein change ohne Datei zählt als Abbruch', async () => {
    const auswahl = dateiAuswaehlen();

    waehlen(geoeffnet[0], []);

    await expect(auswahl).resolves.toBeNull();
  });
});

describe('Dateien ohne Typ vom Gerät bekommen ihn aus der Endung', () => {
  // Simons Befund 29.09.2026 (Android): Eine .docx ging nicht raus. Nennt das
  // Gerät keinen Typ, schickte das WebView sie als application/octet-stream.
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  it.each(['', 'application/octet-stream'])('Word-Datei mit Typ %j -> Word-Typ, Name und Inhalt bleiben', async (typ) => {
    const auswahl = dateiAuswaehlen({ multiple: true });
    const ohne = new File(['PK-Word'], 'Einladung.docx', { type: typ });
    const foto = datei('IMG_1.jpg', 'image/jpeg');

    waehlen(geoeffnet[0], [ohne, foto]);

    const dateien = (await auswahl)!;
    expect(dateien.map((d) => [d.name, d.type])).toEqual([
      ['Einladung.docx', DOCX],
      ['IMG_1.jpg', 'image/jpeg'],
    ]);
    expect(await dateien[0].text()).toBe('PK-Word');
    // Eine Datei mit Typ bleibt dieselbe.
    expect(dateien[1]).toBe(foto);
  });

  it('ein Foto ohne Typ wird ein Foto — die Verkleinerung hängt an image/', async () => {
    const auswahl = dateiAuswaehlen({ accept: 'image/*' });

    waehlen(geoeffnet[0], [new File(['x'], 'IMG_2.HEIC', { type: '' })]);

    expect((await auswahl)![0].type).toBe('image/heic');
  });
});

describe('Abbruch', () => {
  it('cancel (neuere WebViews): null, der Ausflug endet nach dem Nachlauf', async () => {
    const auswahl = dateiAuswaehlen();

    geoeffnet[0].oncancel?.(new Event('cancel'));

    await expect(auswahl).resolves.toBeNull();
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });

  it('ohne cancel: die Rückkehr des Fokus beendet die Auswahl nach der Frist', async () => {
    const hinweis = vi.fn();
    const auswahl = dateiAuswaehlen({ beiRueckkehrOhneAuswahl: hinweis });
    let ergebnis: File[] | null | 'offen' = 'offen';
    void auswahl.then((d) => { ergebnis = d; });

    window.dispatchEvent(new Event('focus'));

    vi.advanceTimersByTime(AUSWAHL_RUECKKEHR_HINWEIS_MS);
    expect(hinweis).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(ergebnis).toBe('offen');
    expect(laeuftAusflug()).toBe(true);

    vi.advanceTimersByTime(AUSWAHL_RUECKKEHR_FRIST_MS - AUSWAHL_RUECKKEHR_HINWEIS_MS);
    await expect(auswahl).resolves.toBeNull();
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });

  it('eine Auswahl nach der Rückkehr des Fokus gewinnt noch innerhalb der Frist', async () => {
    const hinweis = vi.fn();
    const auswahl = dateiAuswaehlen({ beiRueckkehrOhneAuswahl: hinweis });
    const video = datei('clip.mov', 'video/quicktime');

    window.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(8000);
    waehlen(geoeffnet[0], [video]);

    await expect(auswahl).resolves.toEqual([video]);
    // Der Hinweis kam, weil nach 1,2 s noch nichts da war — danach nicht mehr.
    vi.advanceTimersByTime(AUSWAHL_RUECKKEHR_FRIST_MS);
    expect(hinweis).toHaveBeenCalledTimes(1);
  });

  it('eine Datei, deren change verloren ging, zählt zum Ende der Frist trotzdem', async () => {
    const auswahl = dateiAuswaehlen();
    const plan = datei('plan.pdf');

    window.dispatchEvent(new Event('focus'));
    Object.defineProperty(geoeffnet[0], 'files', { value: [plan], configurable: true });
    vi.advanceTimersByTime(AUSWAHL_RUECKKEHR_FRIST_MS);

    await expect(auswahl).resolves.toEqual([plan]);
  });

  it('kein Hinweis, wenn die Auswahl vor Ablauf der 1,2 s da ist', async () => {
    const hinweis = vi.fn();
    const auswahl = dateiAuswaehlen({ beiRueckkehrOhneAuswahl: hinweis });

    window.dispatchEvent(new Event('focus'));
    waehlen(geoeffnet[0], [datei('plan.pdf')]);
    await auswahl;
    vi.advanceTimersByTime(AUSWAHL_RUECKKEHR_FRIST_MS);

    expect(hinweis).not.toHaveBeenCalled();
  });
});

describe('Notbremse: die Sperre ist nie dauerhaft tot', () => {
  it('kommt gar kein Ereignis, endet der Ausflug nach der Höchstdauer', () => {
    void dateiAuswaehlen();

    vi.advanceTimersByTime(DATEI_AUSFLUG_HOECHSTENS_MS - 1);
    expect(laeuftAusflug()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(laeuftAusflug()).toBe(false);
  });

  it('eine späte Auswahl nach der Notbremse kommt noch an und räumt keinen fremden Ausflug ab', async () => {
    const auswahl = dateiAuswaehlen();
    vi.advanceTimersByTime(DATEI_AUSFLUG_HOECHSTENS_MS);
    // Inzwischen läuft ein anderer Systemdialog (etwa ein Teilen-Blatt).
    ausflugStarten();

    const plan = datei('plan.pdf');
    waehlen(geoeffnet[0], [plan]);
    await expect(auswahl).resolves.toEqual([plan]);
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);

    expect(laeuftAusflug()).toBe(true);
    ausflugBeenden();
    expect(laeuftAusflug()).toBe(false);
  });

  it('nach Auswahl und Nachlauf feuert die Notbremse ins Leere', async () => {
    const auswahl = dateiAuswaehlen();
    waehlen(geoeffnet[0], [datei('plan.pdf')]);
    await auswahl;
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    ausflugStarten();

    vi.advanceTimersByTime(DATEI_AUSFLUG_HOECHSTENS_MS);

    expect(laeuftAusflug()).toBe(true);
  });

  it('lässt sich die Auswahl gar nicht öffnen: null, und der Ausflug endet', async () => {
    HTMLInputElement.prototype.click = () => { throw new Error('nicht erlaubt'); };

    await expect(dateiAuswaehlen()).resolves.toBeNull();
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('Zwei Auswahlen nacheinander zählen sauber', () => {
  it('jede meldet genau einen Ausflug an und ab', async () => {
    const erste = dateiAuswaehlen();
    const zweite = dateiAuswaehlen();

    waehlen(geoeffnet[0], [datei('a.pdf')]);
    await erste;
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(true);

    geoeffnet[1].oncancel?.(new Event('cancel'));
    await zweite;
    vi.advanceTimersByTime(AUSWAHL_NACHLAUF_MS);
    expect(laeuftAusflug()).toBe(false);
  });
});

describe('Dokumente liegen nach der Auswahl im Speicher (01.10.2026)', () => {
  // Simon nach dem Update auf Build 132: "Word & PDF in Material / Chat
  // hochladen/senden geht immer noch nicht." Bis 01.10. 16:35 kam keine
  // einzige Datei-Anfrage des Materials am Server an (Proxy-Log). Auf Android
  // verweist eine gewaehlte Datei auf den Speicherort des Anbieters (Drive,
  // Downloads); das WebView liest sie erst beim Senden und bricht ab, wenn
  // sich Groesse oder Zeit dort inzwischen anders lesen. Fotos gingen immer:
  // Die Verkleinerung liest sie sofort in den Speicher. Dasselbe jetzt fuer
  // Dokumente -- gleich bei der Auswahl.
  const lesbar = (inhalt: string, name: string, typ: string) => {
    const f = new File([inhalt], name, { type: typ, lastModified: 1700000000000 });
    return f;
  };

  it('eine PDF kommt als eigene Kopie mit Name, Typ, Zeit und Inhalt', async () => {
    const auswahl = dateiAuswaehlen({ accept: '.pdf' });
    const plan = lesbar('%PDF-1.7 Inhalt', 'Freizeitplan.pdf', 'application/pdf');

    waehlen(geoeffnet[0], [plan]);

    const [kopie] = (await auswahl)!;
    expect(kopie).not.toBe(plan);
    expect([kopie.name, kopie.type, kopie.size, kopie.lastModified])
      .toEqual(['Freizeitplan.pdf', 'application/pdf', plan.size, 1700000000000]);
    expect(await kopie.text()).toBe('%PDF-1.7 Inhalt');
  });

  it('die Kopie bleibt lesbar, auch wenn das Original es danach nicht mehr ist', async () => {
    const auswahl = dateiAuswaehlen();
    const brief = lesbar('PK-Word', 'Brief.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // Genau einmal lesbar -- so verhaelt sich eine Datei, deren Anbieter beim
    // zweiten Lesen eine andere Zeit meldet.
    const echt = brief.arrayBuffer.bind(brief);
    let gelesen = 0;
    brief.arrayBuffer = () => (gelesen++ === 0 ? echt() : Promise.reject(new DOMException('geaendert', 'NotReadableError')));

    waehlen(geoeffnet[0], [brief]);

    const [kopie] = (await auswahl)!;
    await expect(brief.arrayBuffer()).rejects.toThrow('geaendert');
    expect(await kopie.text()).toBe('PK-Word');
  });

  it('Fotos und Videos bleiben unberuehrt -- Fotos verkleinert die App ohnehin, Videos koennen gross sein', async () => {
    const auswahl = dateiAuswaehlen({ multiple: true });
    const foto = lesbar('jpg', 'IMG_1.jpg', 'image/jpeg');
    const film = lesbar('mp4', 'VID_1.mp4', 'video/mp4');

    waehlen(geoeffnet[0], [foto, film]);

    const dateien = (await auswahl)!;
    expect(dateien[0]).toBe(foto);
    expect(dateien[1]).toBe(film);
  });

  it('laesst sich ein Dokument nicht lesen, geht das Original weiter (nicht schlechter als vorher)', async () => {
    const auswahl = dateiAuswaehlen();
    const kaputt = lesbar('x', 'Liste.pdf', 'application/pdf');
    kaputt.arrayBuffer = () => Promise.reject(new DOMException('weg', 'NotReadableError'));

    waehlen(geoeffnet[0], [kaputt]);

    expect((await auswahl)![0]).toBe(kaputt);
  });

  it('ueber der Grenze bleibt das Original -- die Groessenpruefung meldet "zu gross" wie bisher', async () => {
    const auswahl = dateiAuswaehlen();
    const riesig = lesbar('x', 'Archiv.pdf', 'application/pdf');
    Object.defineProperty(riesig, 'size', { value: IM_SPEICHER_HOECHSTENS_BYTES + 1 });
    const lesen = vi.fn();
    riesig.arrayBuffer = lesen;

    waehlen(geoeffnet[0], [riesig]);

    expect((await auswahl)![0]).toBe(riesig);
    expect(lesen).not.toHaveBeenCalled();
  });
});
