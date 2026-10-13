// Die Hooks der Detailseiten des Supports (Stufe „verlauf" aus
// docs/planung/support-detailseiten.md), ohne Darstellung: was App und Web
// gemeinsam bekommen. Gegen die Attrappe des Servers (vorgaengeServer.ts),
// damit die Aufrufe exakt geprüft werden.
//   - useVorgangDetail: Stand, Kennzahlen, Angaben, Empfänger aus der
//     Detail-Antwort, Status setzen, Ablehnen erst nach der Rückfrage,
//     Abschluss-Rückruf (nächster Eintrag), „Danach", Betreff im Einordnen.
//   - useAntwortEditor: „Danach" nach dem Senden, „Gesendet, Status nicht
//     gesetzt." statt Stille, feste Zeile bei einer Adresse.
//   - usePostDetail: Stand der Mail, Antwort-Objekt, Weiterleitung.
//   - useEinsortieren: der eigene Vorgang ist kein Ziel, was mitgeht.
//   - useGemeindeAnlegen: `geaendert` für die Rückfrage beim Schließen; ein
//     eben angelegter Kirchenkreis gehört zur Vorbelegung, `zuruecksetzen`
//     stellt Formular und Vorbelegung zusammen her. Dazu, ob der Kirchenkreis
//     einer Anfrage in der Struktur steht (Karte „Anfrage" in useVorgangDetail).
//   - vorgewaehlterEmpfaenger: wen Editor und Antwortzeile nennen.
//   - useEinordnenFormular: eine Bedienweise mit Speichern, Pflicht-Bereich,
//     Betreff, Hinweis bei Erledigt (Anfrage: Ablehnung).
//   - useLizenzAendern: PATCH …/limit allein; GET + PUT mit vollem Körper;
//     Teilerfolg; ohne Netz nichts.
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';
import { ANFRAGE_41, mail, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  online: true,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 9, role_name: 'super_admin' }, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));

import { useVorgangDetail } from '../../../components/support/useVorgangDetail';
import { useAntwortEditor, vorgewaehlterEmpfaenger, type AntwortFormularProps } from '../../../components/support/useAntwortEditor';
import { usePostDetail } from '../../../components/support/usePostDetail';
import { useDirektEinsortieren, useEinsortieren } from '../../../components/support/useEinsortieren';
import { useGemeindeAnlegen } from '../../../components/support/useGemeindeAnlegen';
import { useEinordnenFormular } from '../../../components/support/useEinordnenFormular';
import { useLizenzAendern } from '../../../components/support/useLizenzAendern';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';
import { abonniereSupportGeaendert, meldeSupportGeaendert } from '../../../utils/supportAktualisieren';
import { ERLEDIGT_HINWEIS, type VorgangGemeinde } from '../../../utils/supportVorgaenge';
import { ABLEHNEN_RUECKFRAGE, DANACH_FEHLER, EINORDNEN_TEXT, EINSORTIEREN_HINWEIS, LIZENZ_TEXT } from '../../../seiten/supportDetail';
import type { GemeindeAnfrage, MailNachricht } from '../../../types/support';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.alert = null;
  h.online = true;
  supportMailZaehlerZuruecksetzen();
  server = vorgaengeServer({
    vorgaenge: [
      // 1: Formular einer bekannten Gemeinde, die jüngste Mail kam von außen (Fall 3)
      vorgang(1, { art: 'fehler', bereich: 'chat', status: 'in_arbeit', betreff: 'Chat zeigt nichts Neues', organization_id: 7,
        beschreibung: 'Seit gestern erscheint nichts.', kontakt_name: 'Das Sekretariat', kontakt_email: 'sekretariat@example.org' }),
      // 3: Anfrage, noch nicht angelegt
      vorgang(3, { art: 'neue_gemeinde', bereich: null, status: 'neu', betreff: 'Anfrage Kirchengemeinde Lindenau', quelle: 'anfrage', anfrage_id: 41, anfrage: { ...ANFRAGE_41 } }),
      // 4: Anfrage, angelegt; erledigt im Archiv, Gemeinde 7 mit Leitung lena.probe
      vorgang(4, { art: 'neue_gemeinde', bereich: null, status: 'erledigt', betreff: 'Anfrage Kirchengemeinde Musterdorf', quelle: 'anfrage', anfrage_id: 42,
        organization_id: 7, archiviert_am: '2026-10-04T10:00:00Z', status_seit: '2026-10-04T10:00:00Z',
        anfrage: { ...ANFRAGE_41, id: 42, gemeinde: 'Kirchengemeinde Musterdorf', email: 'lena.probe@example.org', status: 'angelegt', organization_id: 7 } }),
      // 6: Lizenz und Abrechnung
      vorgang(6, { art: 'lizenz', bereich: null, status: 'in_arbeit', betreff: 'Größere Lizenz', organization_id: 7, kontakt_email: 'lena.probe@example.org' }),
      // 7: Lizenz ohne Gemeinde
      vorgang(7, { art: 'lizenz', bereich: null, status: 'in_arbeit', betreff: 'Lizenz?', kontakt_email: 'anna@example.org', gemeinde_angabe: 'Kirchengemeinde Heide' }),
    ],
    mails: [
      mail(11, 1, { betreff: 'Chat zeigt nichts Neues', text: 'Seit gestern.', gesendet_am: '2026-10-03T07:00:00Z' }),
      mail(12, 1, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'], betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]',
        text: 'Wir schauen nach.', gesendet_am: '2026-10-03T07:30:00Z', gelesen_am: '2026-10-03T07:30:00Z', verfasst_von: 9, verfasst_von_name: 'Test Super-Admin' }),
      mail(13, 1, { betreff: 'AW: [Vorgang 1] Re: Chat zeigt nichts Neues', text: 'Danke, es klappt wieder.', gesendet_am: '2026-10-03T08:00:00Z', anhaenge: [{ name: 'bild.png' }] }),
      mail(31, 3, { postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Eure Anfrage bei Konfi Quest [Anfrage 41]', text: 'Wann geht es los?', gelesen_am: '2026-10-03T07:00:00Z' }),
      // Posteingang: ein Faden aus zwei Mails, die jüngere ungelesen
      mail(51, null, { faden: 'post', postfach: 'moin', von_adresse: 'ben@example.org', von_name: 'Ben Beispiel', betreff: 'Frage', gesendet_am: '2026-10-02T08:00:00Z', gelesen_am: '2026-10-02T09:00:00Z', anhaenge: [{ name: 'a.pdf' }] }),
      mail(52, null, { faden: 'post', postfach: 'moin', von_adresse: 'ben@example.org', von_name: 'Ben Beispiel', betreff: 'Re: Frage', gesendet_am: '2026-10-03T08:00:00Z' }),
      mail(53, null, { postfach: 'support', von_adresse: 'alt@example.org', von_name: null, betreff: 'Alt', archiviert_am: '2026-10-01T08:00:00Z', gelesen_am: '2026-10-01T08:00:00Z' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete, put: h.apiPut });
});

// Erfundener Wert fuer das Passwortfeld. Als Konstante und zusammengesetzt
// statt als Zeichenkette am Feld, damit Geheimnis-Scanner (GitGuardian, PR
// #220 und #246) einen Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Sicher', 'Wert', '42'].join('-');
const bestaetigen = async (knopf: string) => { await act(async () => { await h.alert?.buttons?.find((b) => b.text === knopf)?.handler?.(); }); };
/** Bis der Vorgang geladen ist. */
const geladen = async (id: number, optionen?: Parameters<typeof useVorgangDetail>[1]) => {
  const hook = renderHook(() => useVorgangDetail(id, optionen));
  await waitFor(() => expect(hook.result.current.vorgang?.id).toBe(id));
  return hook;
};
/** Ab jetzt liefert die Struktur auch den eben angelegten Kirchenkreis „Steinburg“ (Nr. 13). */
const mitSteinburg = () => {
  const alt = h.apiGet.getMockImplementation()!;
  h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise'
    ? Promise.resolve({ data: [{ id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' }, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }] })
    : alt(pfad, o as never)));
};

describe('useVorgangDetail: Regel-Stelle und Empfänger', () => {
  it('Stand, Kennzahlen und Angaben aus der Regel-Stelle: Fall 3 (die jüngste Nachricht kam von außen), Mails · Neu · Tage offen', async () => {
    const { result } = await geladen(1);
    expect(result.current.stand).toMatchObject({ fall: '3', ton: 'warnung', haupt: 'antworten', neben: ['erledigt'], antwortGesperrt: false });
    expect(result.current.stand?.satz).toMatch(/^Pastorin Lena Probe wartet seit /);
    // „Mails“ zählt wie der Verlauf das Anliegen aus dem Formular mit: drei Mails und der Anfang.
    expect(result.current.kennzahlen.map((k) => [k.schluessel, k.zahl]).slice(0, 2)).toEqual([['mails', 4], ['neu', 2]]);
    expect(result.current.kennzahlen[2].schluessel).toBe('tage_offen');
    expect(result.current.angaben.map((k) => k.schluessel)).toEqual(['kontakt', 'gemeinde']);
    expect(result.current.beantwortet?.id).toBe(13);
  });

  it('die Empfänger kommen aus der Detail-Antwort (Absender zuerst, Schlüssel des Servers) -- kein eigener Abruf mehr', async () => {
    const { result } = await geladen(1);
    expect(result.current.empfaenger).toEqual([
      { adresse: 'lena.probe@example.org', name: 'Pastorin Lena Probe', herkunft: 'absender' },
      { adresse: 'sekretariat@example.org', name: 'Das Sekretariat', herkunft: 'kontakt' },
    ]);
    expect(result.current.antwort).toMatchObject({ postfach: 'support', an: null, empfaengerVorgabe: 'lena.probe@example.org', betreffVorschlag: 'Re: Chat zeigt nichts Neues' });
    expect(result.current.antwort?.empfaenger).toBe(result.current.empfaenger);
    expect(result.current.antwort?.beantwortet?.id).toBe(13);
    expect(server.aufrufe('get', /empfaenger$/)).toEqual([]);
  });

  it('eine Anfrage mit einer einzigen Adresse antwortet fest an sie (von moin@); „Danach“ ohne Erledigt -- das lehnte die Anfrage ab', async () => {
    const { result } = await geladen(3);
    expect(result.current.antwort).toMatchObject({ postfach: 'moin', an: 'anna@example.org', empfaenger: null });
    expect(result.current.antwort?.danach?.wahlen).toEqual(['wartet', 'in_arbeit']);
    expect(result.current.antwort?.danach?.vorgabe).toBe('wartet');
  });

  it('erledigt im Archiv: Antworten geht, aber ohne „Danach“ -- die Antwort lässt den Status, wie er ist', async () => {
    const { result } = await geladen(4);
    expect(result.current.antwort).not.toBeNull();
    expect(result.current.antwort?.danach).toBeNull();
  });

  it('„Im Vorgang antworten“ wählt die Adresse vor -- nur eine, die zur Wahl steht', async () => {
    const { result } = await geladen(1);
    act(() => result.current.antwortAn('sekretariat@example.org'));
    expect(result.current.antwortVorgabe).toBe('sekretariat@example.org');
    expect(result.current.antwort?.empfaengerVorgabe).toBe('sekretariat@example.org');
    act(() => result.current.antwortAn('fremd@example.org'));
    expect(result.current.antwort?.empfaengerVorgabe).toBe('lena.probe@example.org');
  });

  it('Stand 1a nach dem Neuladen: der Benutzername der Gemeindeleitung kommt aus `leitung`', async () => {
    const { result } = await geladen(4);
    expect(result.current.stand?.fall).toBe('1a');
    expect(result.current.stand?.satz).toBe('Gemeinde angelegt am 04.10.2026. Benutzername der Gemeindeleitung: lena.probe – Benutzername und Passwort getrennt weitergeben.');
    expect(result.current.stand?.haupt).toBe('gemeinde_oeffnen');
  });

  it('„Lizenz ändern“ geht nur im Lizenz-Vorgang mit Gemeinde', async () => {
    expect((await geladen(6)).result.current.lizenzAenderbar).toBe(true);
    expect((await geladen(7)).result.current.lizenzAenderbar).toBe(false);
    expect((await geladen(1)).result.current.lizenzAenderbar).toBe(false);
  });
});

describe('useVorgangDetail: Status, Ablehnen, Abschluss', () => {
  it('statusSetzen(erledigt): genau ein PATCH, danach der Abschluss-Rückruf für den nächsten Eintrag', async () => {
    const nachAbschluss = vi.fn();
    const { result } = await geladen(1, { nachAbschluss });
    let ok = false;
    await act(async () => { ok = await result.current.statusSetzen('erledigt'); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch').map((a) => [a.pfad, a.koerper])).toEqual([['/support/vorgaenge/1', { status: 'erledigt' }]]);
    expect(nachAbschluss).toHaveBeenCalledTimes(1);
    expect(nachAbschluss).toHaveBeenCalledWith('erledigt', 1);
    expect(h.setSuccess).toHaveBeenCalledWith('Vorgang erledigt und ins Archiv gelegt');
  });

  it('statusSetzen scheitert: Meldung, kein Abschluss; ein anderer Status als Erledigt ist kein Abschluss', async () => {
    const nachAbschluss = vi.fn();
    const { result } = await geladen(1, { nachAbschluss });
    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    let ok = true;
    await act(async () => { ok = await result.current.statusSetzen('erledigt'); });
    expect(ok).toBe(false);
    expect(h.setError).toHaveBeenCalledWith('Datenbankfehler');
    server.stand.fehler.clear();
    await act(async () => { await result.current.statusSetzen('wartet'); });
    expect(nachAbschluss).not.toHaveBeenCalled();
  });

  it('Ablehnen: erst die Rückfrage mit der Folge; Abbrechen schickt nichts; „Ablehnen“ schickt genau PATCH { status: erledigt }', async () => {
    const nachAbschluss = vi.fn();
    const { result } = await geladen(3, { nachAbschluss });
    await waitFor(() => expect(result.current.ablehnbar).toBe(true));
    act(() => result.current.ablehnenFragen());
    expect(h.alert).toMatchObject({ header: ABLEHNEN_RUECKFRAGE.header, message: ABLEHNEN_RUECKFRAGE.message });
    expect(h.alert?.buttons?.map((b) => b.text)).toEqual(['Abbrechen', 'Ablehnen']);
    expect(server.aufrufe('patch')).toEqual([]);
    await bestaetigen('Abbrechen');
    expect(server.aufrufe('patch')).toEqual([]);

    act(() => result.current.ablehnenFragen());
    await bestaetigen('Ablehnen');
    await waitFor(() => expect(server.aufrufe('patch').map((a) => [a.pfad, a.koerper])).toEqual([['/support/vorgaenge/3', { status: 'erledigt' }]]));
    expect(nachAbschluss).toHaveBeenCalledWith('erledigt', 3);
    expect(h.setSuccess).toHaveBeenCalledWith('Anfrage abgelehnt');
  });

  it('Ablehnen gibt es nur bei einer Anfrage, die noch nicht angelegt ist -- sonst keine Rückfrage und kein Aufruf', async () => {
    for (const id of [1, 4]) {
      const { result, unmount } = await geladen(id);
      expect(result.current.ablehnbar).toBe(false);
      act(() => result.current.ablehnenFragen());
      expect(h.alert).toBeNull();
      unmount();
    }
    expect(server.aufrufe('patch')).toEqual([]);
  });

  it('Archivieren, Wiederherstellen und Löschen sagen, ob es geklappt hat; Archivieren und Löschen melden den Abschluss', async () => {
    const nachAbschluss = vi.fn();
    const nachLoeschen = vi.fn();
    const { result } = await geladen(1, { nachAbschluss, nachLoeschen });
    let ok = false;
    await act(async () => { ok = await result.current.archivieren(); });
    expect(ok).toBe(true);
    expect(nachAbschluss).toHaveBeenLastCalledWith('archiviert', 1);
    await act(async () => { ok = await result.current.wiederherstellen(); });
    expect(ok).toBe(true);
    expect(nachAbschluss).toHaveBeenCalledTimes(1);
    act(() => result.current.loeschenFragen());
    expect(h.alert?.header).toBe('Vorgang löschen');
    await bestaetigen('Löschen');
    await waitFor(() => expect(nachLoeschen).toHaveBeenCalledTimes(1));
    expect(nachAbschluss).toHaveBeenLastCalledWith('geloescht', 1);
    expect(h.push).not.toHaveBeenCalled();
  });

  it('eine Funktion als zweites Argument ist weiter „nach dem Löschen“ (so riefen es die Seiten bis 11.10.2026)', async () => {
    const nachLoeschen = vi.fn();
    const { result } = await geladen(1, nachLoeschen);
    act(() => result.current.loeschenFragen());
    await bestaetigen('Löschen');
    await waitFor(() => expect(nachLoeschen).toHaveBeenCalledTimes(1));
  });

  it('ohne Netz: kein Aufruf, kein Abschluss', async () => {
    const nachAbschluss = vi.fn();
    const { result, rerender } = await geladen(3, { nachAbschluss });
    h.online = false;
    rerender();
    let ok = true;
    await act(async () => { ok = await result.current.statusSetzen('erledigt'); });
    expect(ok).toBe(false);
    act(() => result.current.ablehnenFragen());
    expect(h.alert).toBeNull();
    expect(server.aufrufe('patch')).toEqual([]);
    expect(nachAbschluss).not.toHaveBeenCalled();
  });

  it('Einordnen nimmt den Betreff mit: ein PATCH mit genau den Feldern, der Titel steht sofort da', async () => {
    const { result } = await geladen(1);
    let ok = false;
    await act(async () => { ok = await result.current.einordnen({ betreff: 'Chat lädt nicht', dringlichkeit: 'dringend' }); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch').map((a) => a.koerper)).toEqual([{ betreff: 'Chat lädt nicht', dringlichkeit: 'dringend' }]);
    expect(result.current.vorgang?.betreff).toBe('Chat lädt nicht');
  });

  it('die Antwort trägt die angezeigte Mail (antwort_auf = die jüngste eingehende), auch wenn der Support zuletzt schrieb', async () => {
    server.stand.mails.push(mail(14, 1, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'],
      betreff: 'Re: Chat zeigt nichts Neues [Vorgang 1]', text: 'Klappt es?', gesendet_am: '2026-10-03T08:30:00Z', gelesen_am: '2026-10-03T08:30:00Z' }));
    const { result } = await geladen(1);
    expect(result.current.beantwortet?.id).toBe(13);
    expect(result.current.antwort?.antwortAuf).toBe(13);
    // Im Posteingang steht die beantwortete Mail in der Adresse des Aufrufs -- kein Feld im Körper.
    const post = renderHook(() => usePostDetail(52));
    await waitFor(() => expect(post.result.current.antwort).not.toBeNull());
    expect(post.result.current.antwort?.antwortAuf).toBeUndefined();
  });

  it('„Danach“ aus der Antwort: bestätigt nur derselbe Vorgang mit genau diesem Status; Erledigt meldet dann den Abschluss -- ohne PATCH', async () => {
    const nachAbschluss = vi.fn();
    const { result } = await geladen(1, { nachAbschluss });
    const danach = result.current.antwort!.danach!;
    const stand = (status: string, id = 1) => ({ nachricht: { id: 99 }, vorgang: { id, status, status_seit: '2026-10-03T09:00:00Z', archiviert_am: null } });
    expect(danach.ausAntwort!(stand('wartet'), 'wartet')).toBe(true);
    expect(nachAbschluss).not.toHaveBeenCalled();
    // Ein älterer Server ({ nachricht }), ein anderer Status, ein anderer Vorgang, ein kaputtes Feld: nicht bestätigt.
    expect(danach.ausAntwort!({ nachricht: { id: 99 } }, 'wartet')).toBe(false);
    expect(danach.ausAntwort!(stand('in_arbeit'), 'wartet')).toBe(false);
    expect(danach.ausAntwort!(stand('wartet', 2), 'wartet')).toBe(false);
    expect(danach.ausAntwort!({ vorgang: 'wartet' }, 'wartet')).toBe(false);
    expect(nachAbschluss).not.toHaveBeenCalled();
    expect(danach.ausAntwort!({ nachricht: { id: 99 }, vorgang: { id: 1, status: 'erledigt', status_seit: '2026-10-03T09:00:00Z', archiviert_am: '2026-10-03T09:00:00Z' } }, 'erledigt')).toBe(true);
    expect(nachAbschluss).toHaveBeenCalledTimes(1);
    expect(nachAbschluss).toHaveBeenCalledWith('erledigt', 1);
    expect(server.aufrufe('patch')).toEqual([]);
  });

  it('„Danach“ per PATCH (die Rückfallebene für ältere Server) setzt den Status leise -- ohne eigene Meldung; Erledigt meldet den Abschluss', async () => {
    const nachAbschluss = vi.fn();
    const { result } = await geladen(1, { nachAbschluss });
    expect(result.current.antwort?.danach?.wahlen).toEqual(['wartet', 'in_arbeit', 'erledigt']);
    let ok = false;
    await act(async () => { ok = await result.current.antwort!.danach!.setzen('erledigt'); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch').map((a) => a.koerper)).toEqual([{ status: 'erledigt' }]);
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(nachAbschluss).toHaveBeenCalledWith('erledigt', 1);
  });
});

describe('useVorgangDetail: der Stand nach Nachfassen und Wiederherstellen in derselben Sitzung', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
    server.stand.jetzt = '2026-10-11T09:30:00Z';
  });
  afterEach(() => { vi.useRealTimers(); });

  it('Nachfassen mit „Danach: Wartet“ (der Status bleibt, status_seit auch): danach kein „nachfassen?“ mehr, Hauptknopf Erledigt', async () => {
    server.stand.vorgaenge.push(vorgang(9, { art: 'frage', bereich: 'chat', status: 'wartet', status_seit: '2026-10-03T10:00:00Z', betreff: 'Chat', organization_id: 7, quelle: 'mail' }));
    server.stand.mails.push(
      mail(91, 9, { von_adresse: 'lena.probe@example.org', von_name: 'Pastorin Lena Probe', betreff: 'Chat', text: 'Geht nicht.', gesendet_am: '2026-10-02T08:00:00Z', gelesen_am: '2026-10-02T09:00:00Z' }),
      mail(92, 9, { richtung: 'aus', von_adresse: 'support@konfi-quest.example', von_name: 'Support', an_adressen: ['lena.probe@example.org'], betreff: 'Re: Chat [Vorgang 9]',
        text: 'Bitte neu anmelden.', gesendet_am: '2026-10-03T10:00:00Z', gelesen_am: '2026-10-03T10:00:00Z', verfasst_von: 9, verfasst_von_name: 'Test Super-Admin' }),
    );
    const { result } = await geladen(9);
    expect(result.current.stand).toMatchObject({ fall: '5', haupt: 'antworten', satz: 'Wartet seit 03.10., 12:00 auf Pastorin Lena Probe – nachfassen?' });
    expect(result.current.antwort?.danach?.vorgabe).toBe('wartet');

    // Was der Editor tut (seit 12.10.2026): senden mit „Danach" (Vorgabe) im Körper; der Server bestätigt den
    // Status in der Antwort -- kein PATCH. Die Meldung lädt neu.
    let antwort: unknown;
    await act(async () => { antwort = await result.current.antwort!.senden({ betreff: 'Re: Chat', text: 'Klappt es inzwischen?', an: 'lena.probe@example.org', status: 'wartet', antwort_auf: 91 }); });
    expect(result.current.antwort!.danach!.ausAntwort!(antwort, 'wartet')).toBe(true);
    expect(server.aufrufe('patch')).toEqual([]);
    await act(async () => { meldeSupportGeaendert(); });
    await waitFor(() => expect(result.current.vorgang?.verlauf.length).toBe(3));
    expect(result.current.vorgang?.status_seit).toBe('2026-10-03T10:00:00Z');
    expect(result.current.stand).toMatchObject({ fall: '5', haupt: 'erledigt', neben: ['antworten'], satz: 'Wartet seit heute, 11:30 auf Pastorin Lena Probe.' });
  });

  it('Gemeinde angelegt, dann wiederhergestellt: der Stand ist nicht mehr 1a, sondern wie bei jedem offenen Vorgang', async () => {
    const { result } = await geladen(3);
    await waitFor(() => expect(result.current.anlegen.formular).not.toBeNull());
    act(() => result.current.anlegen.aendern({ adminPassword: BEISPIELWERT }));
    await act(async () => { await result.current.anlegen.anlegen(); });
    await bestaetigen('Anlegen');
    await waitFor(() => expect(result.current.vorgang?.archiviert_am).not.toBeNull());
    expect(result.current.stand).toMatchObject({ fall: '1a', haupt: 'gemeinde_oeffnen' });

    let ok = false;
    await act(async () => { ok = await result.current.wiederherstellen(); });
    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.vorgang?.archiviert_am).toBeNull());
    // Die jüngste Nachricht ist die Mail der Anfrage von außen (Nr. 31): Fall 3.
    expect(result.current.stand).toMatchObject({ fall: '3', haupt: 'antworten', neben: ['erledigt'] });
    expect(result.current.archiviert).toBe(false);
  });
});

describe('vorgewaehlterEmpfaenger: eine Regel für Editor und Antwortzeile', () => {
  const lena = { adresse: 'lena.probe@example.org', name: 'Pastorin Lena Probe', herkunft: 'absender' };
  const tim = { adresse: 'tim.probe@example.org', name: 'Pastor Tim Probe', herkunft: 'leitung' };

  it('die einzige Adresse; sonst die Vorgabe, wenn sie zur Wahl steht (ohne Groß/klein); sonst niemand', () => {
    expect(vorgewaehlterEmpfaenger([lena], null)).toBe('lena.probe@example.org');
    expect(vorgewaehlterEmpfaenger([lena, tim], 'TIM.PROBE@example.org')).toBe('tim.probe@example.org');
    expect(vorgewaehlterEmpfaenger([lena, tim], null)).toBe('');
    expect(vorgewaehlterEmpfaenger([lena, tim], 'fremd@example.org')).toBe('');
    expect(vorgewaehlterEmpfaenger([], 'lena.probe@example.org')).toBe('');
    expect(vorgewaehlterEmpfaenger(null, 'lena.probe@example.org')).toBe('');
  });
});

describe('useAntwortEditor: „Danach“, feste Zeile, Wahl', () => {
  const props = (extra: Partial<AntwortFormularProps> = {}): AntwortFormularProps => ({
    postfach: 'support',
    betreffVorschlag: 'Re: Frage',
    empfaenger: [{ adresse: 'lena.probe@example.org', name: 'Pastorin Lena Probe', herkunft: 'absender' }],
    senden: vi.fn().mockResolvedValue({}),
    ...extra,
  });
  const editor = async (p: AntwortFormularProps) => {
    const hook = renderHook((q: AntwortFormularProps) => useAntwortEditor(q), { initialProps: p });
    await waitFor(() => expect(hook.result.current.status).not.toBeNull());
    return hook;
  };
  const tippenUndSenden = async (hook: Awaited<ReturnType<typeof editor>>) => {
    act(() => hook.result.current.setEntwurf((e) => ({ ...e, text: 'Hallo' })));
    act(() => hook.result.current.abschicken());
    await bestaetigen('Senden');
    // Senden und „Danach“ sind zwei Aufrufe hintereinander: bis beide durch sind.
    await act(async () => { await new Promise((fertig) => setTimeout(fertig, 0)); });
  };

  it('„Danach“ geht im Körper mit; bestätigt die Antwort des Servers den Status, kein zweiter Aufruf -- Erfolg heißt „Antwort gesendet“', async () => {
    const setzen = vi.fn().mockResolvedValue(true);
    const ausAntwort = vi.fn().mockReturnValue(true);
    const onGesendet = vi.fn();
    const antwortDesServers = { nachricht: { id: 99 }, vorgang: { id: 1, status: 'in_arbeit', status_seit: '2026-10-03T09:00:00Z', archiviert_am: null } };
    const p = props({ danach: { wahlen: ['wartet', 'in_arbeit', 'erledigt'], vorgabe: 'wartet', setzen, ausAntwort }, onGesendet, antwortAuf: 13, senden: vi.fn().mockResolvedValue(antwortDesServers) });
    const hook = await editor(p);
    expect(hook.result.current.danachStatus).toBe('wartet');
    expect(hook.result.current.danachWahlen).toEqual(['wartet', 'in_arbeit', 'erledigt']);
    act(() => hook.result.current.setDanachStatus('in_arbeit'));
    await tippenUndSenden(hook);
    expect(p.senden).toHaveBeenCalledWith({ text: 'Hallo', betreff: 'Re: Frage', an: 'lena.probe@example.org', status: 'in_arbeit', antwort_auf: 13 });
    expect(ausAntwort).toHaveBeenCalledWith(antwortDesServers, 'in_arbeit');
    expect(setzen).not.toHaveBeenCalled();
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(h.setError).not.toHaveBeenCalled();
    expect(onGesendet).toHaveBeenCalledTimes(1);
    // Danach steht wieder die Vorgabe da, der Text ist leer.
    expect(hook.result.current.danachStatus).toBe('wartet');
    expect(hook.result.current.entwurf.text).toBe('');
  });

  it('bestätigt die Antwort den Status nicht (älterer Server), setzt ihn die Rückfallebene: genau ein PATCH über `setzen`', async () => {
    const setzen = vi.fn().mockResolvedValue(true);
    const ausAntwort = vi.fn().mockReturnValue(false);
    const p = props({ danach: { wahlen: ['wartet', 'in_arbeit'], vorgabe: 'wartet', setzen, ausAntwort }, senden: vi.fn().mockResolvedValue({ nachricht: { id: 99 } }) });
    const hook = await editor(p);
    await tippenUndSenden(hook);
    expect(p.senden).toHaveBeenCalledWith({ text: 'Hallo', betreff: 'Re: Frage', an: 'lena.probe@example.org', status: 'wartet' });
    expect(ausAntwort).toHaveBeenCalledWith({ nachricht: { id: 99 } }, 'wartet');
    expect(setzen).toHaveBeenCalledTimes(1);
    expect(setzen).toHaveBeenCalledWith('wartet');
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('scheitert der Status: „Gesendet, Status nicht gesetzt.“ -- nie Stille, keine Erfolgsmeldung; der Entwurf ist trotzdem gesendet und leer', async () => {
    const setzen = vi.fn().mockResolvedValue(false);
    const hook = await editor(props({ danach: { wahlen: ['wartet', 'in_arbeit'], vorgabe: 'wartet', setzen } }));
    await tippenUndSenden(hook);
    expect(setzen).toHaveBeenCalledWith('wartet');
    expect(h.setError).toHaveBeenCalledWith(DANACH_FEHLER);
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(hook.result.current.entwurf.text).toBe('');
  });

  it('wirft „Danach“, gilt dasselbe; scheitert schon das Senden (502), wird kein Status gesetzt und der Text bleibt', async () => {
    const setzen = vi.fn().mockRejectedValue(new Error('weg'));
    const hook = await editor(props({ danach: { wahlen: ['wartet'], vorgabe: 'wartet', setzen } }));
    await tippenUndSenden(hook);
    expect(h.setError).toHaveBeenCalledWith(DANACH_FEHLER);

    vi.clearAllMocks();
    const senden = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { response: { status: 502, data: { error: 'kaputt' } } }));
    const zweiter = await editor(props({ senden, danach: { wahlen: ['wartet'], vorgabe: 'wartet', setzen } }));
    await tippenUndSenden(zweiter);
    expect(setzen).not.toHaveBeenCalled();
    expect(zweiter.result.current.problem).toEqual({ art: 'versand_gescheitert' });
    expect(zweiter.result.current.entwurf.text).toBe('Hallo');
  });

  it('ohne Vorgang kein „Danach“: kein Status, Erfolg wie bisher', async () => {
    const hook = await editor(props({ empfaenger: null, an: 'ben@example.org' }));
    expect(hook.result.current.danachStatus).toBeNull();
    expect(hook.result.current.danachWahlen).toEqual([]);
    await tippenUndSenden(hook);
    expect(h.setSuccess).toHaveBeenCalledWith('Antwort gesendet');
  });

  it('eine Wahl, die nicht angeboten wird, fällt auf die Vorgabe zurück', async () => {
    const hook = await editor(props({ danach: { wahlen: ['wartet', 'in_arbeit'], vorgabe: 'wartet', setzen: vi.fn() } }));
    act(() => hook.result.current.setDanachStatus('erledigt'));
    expect(hook.result.current.danachStatus).toBe('wartet');
  });

  it('feste Zeile bei genau einer Adresse (mit Etikett der Herkunft); bei mehreren die Wahl mit lesbaren Etiketten', async () => {
    const eine = await editor(props());
    expect(eine.result.current.feste).toEqual({ an: 'Pastorin Lena Probe <lena.probe@example.org>', etikett: 'schrieb uns' });
    expect(eine.result.current.gewaehlt).toBe('lena.probe@example.org');

    const beantwortet = { id: 52, von_adresse: 'ben@example.org', von_name: 'Ben Beispiel' } as MailNachricht;
    const fest = await editor(props({ empfaenger: null, an: 'ben@example.org', beantwortet }));
    expect(fest.result.current.feste).toEqual({ an: 'Ben Beispiel <ben@example.org>', etikett: null });

    const mehrere = await editor(props({ empfaenger: [
      { adresse: 'lena.probe@example.org', name: 'Pastorin Lena Probe', herkunft: 'absender' },
      { adresse: 'alt@example.org', name: null, herkunft: 'verlauf' },
    ] }));
    expect(mehrere.result.current.feste).toBeNull();
    expect(mehrere.result.current.empfaengerOptionen).toEqual([
      { wert: 'lena.probe@example.org', label: 'Pastorin Lena Probe <lena.probe@example.org> · schrieb uns' },
      { wert: 'alt@example.org', label: 'alt@example.org · aus früheren Mails' },
    ]);
  });

  it('eine neue Vorgabe („Im Vorgang antworten“) gilt, auch wenn vorher jemand anderes gewählt war', async () => {
    const liste = [
      { adresse: 'a@example.org', name: null, herkunft: 'absender' },
      { adresse: 'b@example.org', name: null, herkunft: 'leitung' },
    ];
    const hook = await editor(props({ empfaenger: liste, empfaengerVorgabe: 'a@example.org' }));
    expect(hook.result.current.gewaehlt).toBe('a@example.org');
    act(() => hook.result.current.setGewaehlterEmpfaenger('a@example.org'));
    hook.rerender(props({ empfaenger: liste, empfaengerVorgabe: 'b@example.org' }));
    expect(hook.result.current.gewaehlt).toBe('b@example.org');
  });

  it('der Betreff wird erst auf Wunsch bearbeitet; nach dem Senden steht er wieder als Text da', async () => {
    const hook = await editor(props());
    expect(hook.result.current.betreffBearbeiten).toBe(false);
    act(() => hook.result.current.setBetreffBearbeiten(true));
    expect(hook.result.current.betreffBearbeiten).toBe(true);
    await tippenUndSenden(hook);
    expect(hook.result.current.betreffBearbeiten).toBe(false);
  });
});

describe('usePostDetail: Stand, Antwort, Weiterleitung', () => {
  const geoeffnet = async (id: number) => {
    const hook = renderHook(() => usePostDetail(id));
    await waitFor(() => expect(hook.result.current.mail?.id).toBe(id));
    return hook;
  };

  it('im Posteingang: Einsortieren als Hauptknopf, Antworten daneben; das fertige Antwort-Objekt an den Absender; Mails · Neu · Anhänge', async () => {
    const { result } = await geoeffnet(52);
    expect(result.current.imPosteingang).toBe(true);
    expect(result.current.weiterleitung).toBeNull();
    expect(result.current.stand).toMatchObject({ haupt: 'einsortieren', neben: ['antworten'], archivierbar: true, loeschbar: true, satz: null });
    expect(result.current.antwort).toMatchObject({ postfach: 'moin', an: 'ben@example.org', betreffVorschlag: 'Re: Frage' });
    expect(result.current.antwort?.beantwortet?.id).toBe(52);
    expect(result.current.kennzahlen.map((k) => [k.schluessel, k.zahl])).toEqual([['mails', 2], ['neu', 1], ['anhaenge', 1]]);
    await act(async () => { await result.current.antwort!.senden({ text: 'Hallo' }); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/52/antworten')).toHaveLength(1);
  });

  it('eine ältere Mail des Fadens geöffnet: geantwortet wird auf die jüngste eingehende -- an sie geht auch der Aufruf', async () => {
    const { result } = await geoeffnet(51);
    expect(result.current.antwort?.beantwortet?.id).toBe(52);
    expect(result.current.antwort?.an).toBe('ben@example.org');
    await act(async () => { await result.current.antwort!.senden({ text: 'Hallo' }); });
    // Bis 12.10.2026 an /51/antworten: Der Server antwortete dann an den Absender von 51, mit 51 als Bezug.
    expect(server.aufrufe('post', /\/antworten$/).map((a) => a.pfad)).toEqual(['/support/mail/nachrichten/52/antworten']);
  });

  it('ein Faden über Posteingang und Vorgang: geantwortet wird auf die jüngste eingehende IM POSTEINGANG -- die Antwort bleibt dort', async () => {
    // 54 gehört über die Kopfzeilen zum selben Faden, liegt aber in Vorgang 1
    // (etwa dieselbe Mail an moin@ und support@: moin@ Posteingang, support@ Regel 4).
    server.stand.mails.push(mail(54, 1, { faden: 'post', postfach: 'support', von_adresse: 'lena.probe@example.org', von_name: 'Pastorin Lena Probe', betreff: 'Re: Frage', gesendet_am: '2026-10-03T09:00:00Z' }));
    const { result } = await geoeffnet(51);
    expect(result.current.faden.map((m) => m.id)).toEqual([51, 52, 54]);
    expect(result.current.letzteEingehende?.id).toBe(52);
    expect(result.current.antwort).toMatchObject({ postfach: 'moin', an: 'ben@example.org' });
    expect(result.current.antwort?.beantwortet?.id).toBe(52);
    await act(async () => { await result.current.antwort!.senden({ text: 'Hallo' }); });
    // Ginge sie an 54, gehörte die Antwort wie 54 zu Vorgang 1 (der Server übernimmt die Zuordnung der beantworteten Mail).
    expect(server.aufrufe('post', /\/antworten$/).map((a) => a.pfad)).toEqual(['/support/mail/nachrichten/52/antworten']);
    expect(server.stand.mails.filter((m) => m.richtung === 'aus' && m.text === 'Hallo').map((m) => m.vorgang_id)).toEqual([null]);
  });

  it('die jüngste eingehende im Posteingang kam an das andere Postfach: das Formular nennt ihr Postfach -- von dort sendet der Server', async () => {
    server.stand.mails.push(mail(55, null, { faden: 'post', postfach: 'support', von_adresse: 'ben@example.org', von_name: 'Ben Beispiel', betreff: 'Re: Frage', gesendet_am: '2026-10-03T09:00:00Z' }));
    const { result } = await geoeffnet(51);
    expect(result.current.mail?.postfach).toBe('moin');
    expect(result.current.antwort?.beantwortet?.id).toBe(55);
    expect(result.current.antwort).toMatchObject({ postfach: 'support', an: 'ben@example.org' });
  });

  it('eine Mail in einem Vorgang: kein Antworten, kein Archivieren, kein Löschen -- die Weiterleitung mit ?mail=', async () => {
    const { result } = await geoeffnet(13);
    expect(result.current.imPosteingang).toBe(false);
    expect(result.current.weiterleitung).toBe('/admin/support/vorgaenge/1?mail=13');
    expect(result.current.antwort).toBeNull();
    expect(result.current.stand).toMatchObject({ haupt: null, neben: [], archivierbar: false, loeschbar: false });
  });

  it('absender_bekannt: die Angabe für Zeile und Vorbelegung -- nur im Posteingang; ohne Angabe oder bei einem älteren Server null', async () => {
    const ohne = await geoeffnet(52);
    expect(ohne.result.current.absender).toBeNull();
    ohne.unmount();

    server.stand.bekannteAbsender['ben@example.org'] = 7;
    const mit = await geoeffnet(52);
    // Offen in Gemeinde 7: 1 (in Arbeit) und 6 (in Arbeit) -- 4 ist erledigt; der jüngste ist 6 (gleiche Zeit, höhere Nummer).
    expect(mit.result.current.absender).toEqual({ satz: 'Absender gehört zu Kirchengemeinde Musterdorf · 2\u00a0offene Vorgänge', organizationId: 7, vorgangId: 6 });
    expect(mit.result.current.mail?.absender_bekannt).toEqual({ organization_id: 7, gemeinde_name: 'Kirchengemeinde Musterdorf', offene_vorgaenge: 2, vorgang_id: 6 });
    mit.unmount();

    server = vorgaengeServer({ alterServer: true, vorgaenge: server.stand.vorgaenge, mails: server.stand.mails, bekannteAbsender: { 'ben@example.org': 7 } });
    server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete, put: h.apiPut });
    const alt = await geoeffnet(52);
    expect(alt.result.current.mail?.absender_bekannt).toBeNull();
    expect(alt.result.current.absender).toBeNull();
  });

  it('im Archiv: kein Antworten; Wiederherstellen daneben und der Satz, dass Einsortieren sie zurückholt', async () => {
    const { result } = await geoeffnet(53);
    expect(result.current.antwort).toBeNull();
    expect(result.current.stand).toMatchObject({ haupt: 'einsortieren', neben: ['wiederherstellen'], archivierbar: false });
    expect(result.current.stand?.satz).toBe('Im Archiv seit 01.10.2026 · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück.');
  });
});

describe('useEinsortieren: Ziel und was mitgeht', () => {
  it('aus dem Posteingang: alle offenen Vorgänge zur Wahl, der Faden geht mit', async () => {
    const { result } = renderHook(() => useEinsortieren({ id: 52, betreff: 'Re: Frage' }));
    await waitFor(() => expect(result.current.vorgaenge).not.toBeNull());
    expect(result.current.vorgaenge!.map((v) => v.id).sort()).toEqual([1, 3, 6, 7]);
    expect(result.current.hinweis).toBe(EINSORTIEREN_HINWEIS.faden);
    expect(result.current.modus).toBe('bestehend');
  });

  it('mit Vorgabe (Absender bekannt): der Vorgang ist gewählt, beim neuen Vorgang die Gemeinde -- Absenden nimmt die Wahl', async () => {
    const onFertig = vi.fn();
    const { result } = renderHook(() => useEinsortieren({ id: 52, betreff: 'Re: Frage' }, onFertig, { vorgabe: { vorgangId: 6, organizationId: 7 } }));
    await waitFor(() => expect(result.current.vorgaenge).not.toBeNull());
    expect(result.current.vorgangWahl).toBe('6');
    expect(result.current.gewaehlterVorgang?.id).toBe(6);
    expect(result.current.neu).toEqual({ art: '', bereich: '', dringlichkeit: 'normal', betreff: 'Frage', organizationId: '7' });
    await act(async () => { await result.current.absenden(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/52/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 6 }]);
    expect(onFertig).toHaveBeenCalledWith(6);
  });

  it('eine Vorgabe ohne Vorgang belegt nur die Gemeinde vor; beim Verschieben aus einem Vorgang gilt keine Vorgabe', async () => {
    const nurGemeinde = renderHook(() => useEinsortieren({ id: 52, betreff: 'Re: Frage' }, undefined, { vorgabe: { vorgangId: null, organizationId: 8 } }));
    await waitFor(() => expect(nurGemeinde.result.current.vorgaenge).not.toBeNull());
    expect(nurGemeinde.result.current.vorgangWahl).toBe('');
    expect(nurGemeinde.result.current.neu.organizationId).toBe('8');

    const verschieben = renderHook(() => useEinsortieren({ id: 13, betreff: 'AW: Re: Chat' }, undefined, { ausVorgang: 1, vorgabe: { vorgangId: 6, organizationId: 7 } }));
    await waitFor(() => expect(verschieben.result.current.vorgaenge).not.toBeNull());
    expect(verschieben.result.current.vorgangWahl).toBe('');
    expect(verschieben.result.current.gewaehlterVorgang).toBeNull();
    expect(verschieben.result.current.neu.organizationId).toBe('');
  });

  it('useDirektEinsortieren: derselbe Aufruf wie aus dem Dialog ({ vorgang_id }), dieselbe Folge -- Meldung, „Support-Daten geändert", onFertig', async () => {
    const onFertig = vi.fn();
    const geaendert = vi.fn();
    const ab = abonniereSupportGeaendert(geaendert);
    try {
      const { result } = renderHook(() => useDirektEinsortieren(52, onFertig));
      let ok = false;
      await act(async () => { ok = await result.current.einsortieren(6); });
      expect(ok).toBe(true);
      expect(server.aufrufe('post', '/support/mail/nachrichten/52/einsortieren').map((a) => a.koerper)).toEqual([{ vorgang_id: 6 }]);
      expect(h.setSuccess).toHaveBeenCalledWith('Mail in Vorgang 6 einsortiert');
      expect(geaendert).toHaveBeenCalledTimes(1);
      expect(onFertig).toHaveBeenCalledWith(6);
      // Wie der Server: Der Faden geht aus dem Posteingang mit.
      expect(server.stand.mails.filter((m) => m.faden === 'post').map((m) => m.vorgang_id)).toEqual([6, 6]);
    } finally {
      ab();
    }
  });

  it('useDirektEinsortieren: ein Fehler kommt als Meldung, kein onFertig; ohne Netz und ohne Mail kein Aufruf', async () => {
    const onFertig = vi.fn();
    server.stand.fehler.set('POST /support/mail/nachrichten/52/einsortieren', Object.assign(new Error('x'), { response: { status: 404, data: { error: 'Vorgang nicht gefunden' } } }));
    const { result } = renderHook(() => useDirektEinsortieren(52, onFertig));
    let ok = true;
    await act(async () => { ok = await result.current.einsortieren(6); });
    expect(ok).toBe(false);
    expect(h.setError).toHaveBeenCalledWith('Vorgang nicht gefunden');
    expect(onFertig).not.toHaveBeenCalled();

    vi.clearAllMocks();
    h.online = false;
    const offline = renderHook(() => useDirektEinsortieren(52, onFertig));
    await act(async () => { ok = await offline.result.current.einsortieren(6); });
    expect(ok).toBe(false);
    const ohneMail = renderHook(() => useDirektEinsortieren(null, onFertig));
    await act(async () => { ok = await ohneMail.result.current.einsortieren(6); });
    expect(ok).toBe(false);
    expect(server.aufrufe('post', /einsortieren$/)).toHaveLength(1);
  });

  it('aus einem Vorgang: der eigene steht nicht zur Wahl, nur diese Mail geht; Herauslösen beginnt mit „neu“', async () => {
    const onFertig = vi.fn();
    const { result } = renderHook(() => useEinsortieren({ id: 13, betreff: 'AW: Re: Chat' }, onFertig, { ausVorgang: 1, modus: 'neu' }));
    await waitFor(() => expect(result.current.vorgaenge).not.toBeNull());
    expect(result.current.vorgaenge!.map((v) => v.id).sort()).toEqual([3, 6, 7]);
    expect(result.current.hinweis).toBe(EINSORTIEREN_HINWEIS.allein);
    expect(result.current.modus).toBe('neu');
    act(() => result.current.aendernNeu({ art: 'sonstiges', betreff: 'Abgezweigt' }));
    await act(async () => { await result.current.absenden(); });
    expect(server.aufrufe('post', '/support/mail/nachrichten/13/einsortieren')[0].koerper).toEqual({ neu: { art: 'sonstiges', dringlichkeit: 'normal', betreff: 'Abgezweigt' } });
    expect(onFertig).toHaveBeenCalledWith(100);
    // Die Attrappe bewegt wie der Server nur diese Mail.
    expect(server.stand.mails.filter((m) => m.vorgang_id === 1).map((m) => m.id)).toEqual([11, 12]);
  });
});

describe('useGemeindeAnlegen: geändert', () => {
  it('nach der Vorbelegung unverändert; eine Eingabe ändert, zurückgesetzt nicht mehr', async () => {
    const anfrage = { ...ANFRAGE_41 } as unknown as GemeindeAnfrage;
    const { result } = renderHook(() => useGemeindeAnlegen(anfrage));
    await waitFor(() => expect(result.current.formular).not.toBeNull());
    expect(result.current.geaendert).toBe(false);
    const name = result.current.formular!.name;
    expect(result.current.formular!.kontaktTelefon).toBe('0170 1234567');
    act(() => result.current.aendern({ kontaktTelefon: '0481 123' }));
    expect(result.current.geaendert).toBe(true);
    act(() => result.current.aendern({ kontaktTelefon: '0170 1234567', name: `${name} ` }));
    expect(result.current.geaendert).toBe(true);
    act(() => result.current.aendern({ name }));
    expect(result.current.geaendert).toBe(false);
  });

  it('ohne Anfrage nie geändert', () => {
    expect(renderHook(() => useGemeindeAnlegen(null)).result.current.geaendert).toBe(false);
  });

  it('ein eben angelegter Kirchenkreis gehört zur Vorbelegung -- nicht geändert; zuruecksetzen stellt Formular und Vorbelegung zusammen her', async () => {
    const anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' } as unknown as GemeindeAnfrage;
    const { result } = renderHook(() => useGemeindeAnlegen(anfrage));
    await waitFor(() => expect(result.current.formular).not.toBeNull());
    expect(result.current.formular!.kirchenkreisId).toBeNull();
    expect(result.current.kkGefunden).toBeNull();
    mitSteinburg();
    await act(async () => { await result.current.kirchenkreisAnlegen(); });
    expect(server.aufrufe('post', '/support/kirchenkreise').map((a) => a.koerper)).toEqual([{ name: 'Steinburg', landeskirche_id: 1 }]);
    expect(result.current.formular!.kirchenkreisId).toBe(13);
    expect(result.current.geaendert).toBe(false);

    act(() => {
      result.current.aendern({ kontaktTelefon: '0481 123', kirchenkreisId: null });
      result.current.setEigenesLimit(true);
      result.current.setPasswortZeigen(true);
    });
    expect(result.current.geaendert).toBe(true);
    act(() => result.current.zuruecksetzen());
    expect(result.current.geaendert).toBe(false);
    expect(result.current.formular!.kontaktTelefon).toBe('0170 1234567');
    expect(result.current.formular!.kirchenkreisId).toBe(13);
    expect(result.current.eigenesLimit).toBe(false);
    expect(result.current.passwortZeigen).toBe(false);
  });
});

describe('useVorgangDetail: Kirchenkreis der Anfrage in der Struktur', () => {
  const kreisZeile = (d: ReturnType<typeof useVorgangDetail>) => d.angaben.find((k) => k.schluessel === 'anfrage')?.zeilen.find((z) => z.schluessel === 'kreis');

  it('steht er dort: „steht in der Struktur", ohne Aktion', async () => {
    const { result } = await geladen(3);
    await waitFor(() => expect(kreisZeile(result.current)?.wert).toBe('Dithmarschen › Nordkirche · steht in der Struktur'));
    expect(kreisZeile(result.current)?.aktion).toBeUndefined();
  });

  it('fehlt er (kirchenkreisFinden sagt null): „fehlt noch" mit „Als Kirchenkreis anlegen"; danach steht er in der Struktur', async () => {
    server.stand.vorgaenge.find((v) => v.id === 3)!.anfrage = { ...ANFRAGE_41, kirchenkreis: 'Steinburg' };
    const { result } = await geladen(3);
    await waitFor(() => expect(kreisZeile(result.current)?.wert).toBe('Steinburg › Nordkirche · fehlt noch'));
    expect(kreisZeile(result.current)?.aktion).toEqual({ art: 'kirchenkreis_anlegen', label: 'Als Kirchenkreis anlegen' });
    mitSteinburg();
    await act(async () => { await result.current.anlegen.kirchenkreisAnlegen(); });
    await waitFor(() => expect(kreisZeile(result.current)?.wert).toBe('Steinburg › Nordkirche · steht in der Struktur'));
  });

  it('eine noch leere Struktur: auch dann „fehlt noch" -- nicht unbekannt', async () => {
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise' ? Promise.resolve({ data: [] }) : alt(pfad, o as never)));
    const { result } = await geladen(3);
    await waitFor(() => expect(kreisZeile(result.current)?.wert).toBe('Dithmarschen › Nordkirche · fehlt noch'));
  });

  it('lässt sich die Struktur nicht laden: unbekannt -- kein Urteil, keine Aktion', async () => {
    const alt = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, o?: unknown) => (pfad === '/support/kirchenkreise' ? Promise.reject(new Error('weg')) : alt(pfad, o as never)));
    const { result } = await geladen(3);
    await waitFor(() => expect(result.current.anlegen.strukturFehlt).toBe(true));
    expect(kreisZeile(result.current)?.wert).toBe('Dithmarschen › Nordkirche');
    expect(kreisZeile(result.current)?.aktion).toBeUndefined();
  });
});

describe('useEinordnenFormular: eine Bedienweise mit Speichern (App und Browser)', () => {
  const formular = async (id: number) => {
    const hook = renderHook(() => {
      const d = useVorgangDetail(id);
      return { d, f: useEinordnenFormular(d) };
    });
    await waitFor(() => expect(hook.result.current.f.entwurf).not.toBeNull());
    return hook;
  };

  it('Ändern schickt nichts; „Speichern“ schickt EIN PATCH mit genau den geänderten Feldern, auch dem Betreff (einzeilig)', async () => {
    const { result } = await formular(1);
    expect(result.current.f.entwurf).toEqual({ status: 'in_arbeit', art: 'fehler', bereich: 'chat', dringlichkeit: 'normal', gemeinde: '7', betreff: 'Chat zeigt nichts Neues' });
    act(() => result.current.f.aendern({ dringlichkeit: 'dringend' }));
    act(() => result.current.f.aendern({ betreff: '  Chat lädt\n nicht ' }));
    expect(result.current.f.geaendert).toBe(true);
    expect(server.aufrufe('patch')).toEqual([]);
    let ok = false;
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch').map((a) => [a.pfad, a.koerper])).toEqual([['/support/vorgaenge/1', { dringlichkeit: 'dringend', betreff: 'Chat lädt nicht' }]]);
  });

  it('ohne Änderung schließt „Speichern“ ohne Aufruf', async () => {
    const { result } = await formular(1);
    expect(result.current.f.geaendert).toBe(false);
    let ok = false;
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch')).toEqual([]);
  });

  it('Pflicht-Bereich bei Frage, Fehler und Wunsch: erst nach „Speichern“ der Fehler, kein Aufruf; mit Bereich geht es', async () => {
    const { result } = await formular(1);
    act(() => result.current.f.aendern({ art: 'frage', bereich: '' }));
    expect(result.current.f.fehler).toBeNull();
    let ok = true;
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(false);
    expect(result.current.f.fehler).toBe(EINORDNEN_TEXT.bereichFehlt);
    expect(server.aufrufe('patch')).toEqual([]);
    act(() => result.current.f.aendern({ bereich: 'konten' }));
    expect(result.current.f.fehler).toBeNull();
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(true);
    expect(server.aufrufe('patch').map((a) => a.koerper)).toEqual([{ art: 'frage', bereich: 'konten' }]);
  });

  it('ein leerer Betreff wird nicht gespeichert', async () => {
    const { result } = await formular(1);
    act(() => result.current.f.aendern({ betreff: '   ' }));
    let ok = true;
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(false);
    expect(result.current.f.fehler).toBe(EINORDNEN_TEXT.betreffFehlt);
    expect(server.aufrufe('patch')).toEqual([]);
  });

  it('der Hinweis nur bei „Erledigt“ -- bei einer Anfrage, die noch nicht angelegt ist, mit der Ablehnung', async () => {
    const vorgang = await formular(1);
    expect(vorgang.result.current.f.hinweis).toBeNull();
    act(() => vorgang.result.current.f.aendern({ status: 'erledigt' }));
    expect(vorgang.result.current.f.hinweis).toBe(ERLEDIGT_HINWEIS);
    const anfrage = await formular(3);
    act(() => anfrage.result.current.f.aendern({ status: 'erledigt' }));
    expect(anfrage.result.current.f.hinweis).toBe(EINORDNEN_TEXT.erledigtAnfrage);
    act(() => anfrage.result.current.f.aendern({ status: 'wartet' }));
    expect(anfrage.result.current.f.hinweis).toBeNull();
  });

  it('unberührt folgt der Entwurf dem Vorgang; eine Eingabe bleibt stehen -- auch, wenn das Speichern scheitert', async () => {
    const { result } = await formular(1);
    server.stand.vorgaenge[0].betreff = 'Anderswo geändert';
    await act(async () => { await result.current.d.laden(); });
    expect(result.current.f.entwurf?.betreff).toBe('Anderswo geändert');

    server.stand.fehler.set('PATCH /support/vorgaenge/1', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    act(() => result.current.f.aendern({ dringlichkeit: 'dringend' }));
    let ok = true;
    await act(async () => { ok = await result.current.f.speichern(); });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.d.vorgang?.dringlichkeit).toBe('normal'));
    expect(result.current.f.entwurf?.dringlichkeit).toBe('dringend');
    act(() => result.current.f.zuruecksetzen());
    expect(result.current.f.entwurf?.dringlichkeit).toBe('normal');
  });

  it('die Gemeinden zur Wahl: „Keine Gemeinde“, dann nach Namen', async () => {
    const { result } = await formular(1);
    await waitFor(() => expect(result.current.f.gemeindeOptionen).toHaveLength(3));
    expect(result.current.f.gemeindeOptionen).toEqual([
      { wert: '', label: 'Keine Gemeinde' },
      { wert: '7', label: 'Kirchengemeinde Musterdorf' },
      { wert: '8', label: 'Kirchengemeinde Wiesengrund' },
    ]);
  });
});

describe('useLizenzAendern: nur bestehende Routen', () => {
  const JETZT = new Date('2026-10-11T10:00:00Z');
  const GEMEINDE: VorgangGemeinde = {
    id: 7, name: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf', is_active: true, is_trial: true, trial_ends_at: '2026-11-02T00:00:00Z',
    max_konfis: 5, konfi_count: 3, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', wunsch_lizenz: 'standard', kirchenkreis_id: 11, intern: false,
  };
  const lizenz = (g: VorgangGemeinde | null = GEMEINDE) => renderHook(() => useLizenzAendern(g, { jetzt: JETZT }));
  const organisationsAufrufe = () => server.stand.aufrufe.filter((a) => a.pfad.startsWith('/organizations/')).map((a) => [a.methode, a.pfad]);
  const speichern = async (r: { current: ReturnType<typeof useLizenzAendern> }) => {
    let ok: boolean | null = null;
    await act(async () => { ok = await r.current.speichern(); });
    return ok;
  };
  let meldungen = 0;
  let abmelden: () => void = () => {};
  beforeEach(() => {
    meldungen = 0;
    abmelden = abonniereSupportGeaendert(() => { meldungen += 1; });
  });
  afterEach(() => abmelden());
  /**
   * Genau eine Meldung „Support-Daten geändert" -- eine zweite ließe jede offene Liste doppelt
   * laden. Meldungen im selben Durchlauf fasst supportAktualisieren zu einer zusammen; eine
   * spätere (etwa nach einem weiteren await) käme danach: Deshalb kurz warten und erneut zählen.
   */
  const genauEineMeldung = async () => {
    await waitFor(() => expect(meldungen).toBe(1));
    await act(async () => { await new Promise((r) => { setTimeout(r, 20); }); });
    expect(meldungen).toBe(1);
  };

  it('nur der Tarif geändert: genau PATCH /organizations/7/limit { max_konfis: 50 } -- kein GET, kein PUT', async () => {
    const { result } = lizenz();
    expect(result.current.formular).toEqual({ tarif: '5', eigenesLimit: false, laufzeit: 'unveraendert', datum: '2026-11-02', testphase: true });
    act(() => result.current.aendern({ tarif: '50' }));
    expect(result.current.geaendert).toBe(true);
    expect(await speichern(result)).toBe(true);
    expect(organisationsAufrufe()).toEqual([['patch', '/organizations/7/limit']]);
    expect(server.aufrufe('patch', '/organizations/7/limit')[0].koerper).toEqual({ max_konfis: 50 });
    expect(server.stand.gemeinden[7].max_konfis).toBe(50);
    expect(h.setSuccess).toHaveBeenCalledWith('Lizenz geändert: Standard bis 02.11.2026');
    await genauEineMeldung();
  });

  it('die Laufzeit geändert: GET, dann PUT mit dem vollen Körper -- die Stammdaten bleiben; danach „Support-Daten geändert“', async () => {
    const { result } = lizenz();
    act(() => result.current.aendern({ laufzeit: 'jahr_ab_heute' }));
    expect(await speichern(result)).toBe(true);
    expect(organisationsAufrufe()).toEqual([['get', '/organizations/7'], ['put', '/organizations/7']]);
    expect(server.aufrufe('put', '/organizations/7')[0].koerper).toEqual({
      name: 'musterdorf', slug: 'musterdorf', display_name: 'Kirchengemeinde Musterdorf', description: null, contact_name: null,
      contact_email: null, contact_phone: null, address: null, website_url: null, kirchenkreis: 'Dithmarschen', is_active: true,
      kirchenkreis_id: 11, trial_ends_at: '2027-10-11T10:00:00.000Z', is_trial: true,
    });
    expect(server.stand.gemeinden[7].kirchenkreis).toBe('Dithmarschen');
    expect(h.setSuccess).toHaveBeenCalledWith('Lizenz geändert: Testphase bis 11.10.2027');
    await genauEineMeldung();
  });

  it('scheitert der PUT nach dem PATCH: „Tarif gespeichert, Laufzeit nicht – bitte erneut speichern.“, der Entwurf bleibt', async () => {
    server.stand.fehler.set('PUT /organizations/7', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    const { result } = lizenz();
    act(() => result.current.aendern({ tarif: '50', laufzeit: 'jahr_ab_heute' }));
    const vorher = result.current.formular;
    expect(await speichern(result)).toBe(false);
    expect(organisationsAufrufe()).toEqual([['patch', '/organizations/7/limit'], ['get', '/organizations/7'], ['put', '/organizations/7']]);
    expect(h.setError).toHaveBeenCalledWith(LIZENZ_TEXT.teilGespeichert);
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(result.current.formular).toEqual(vorher);
    // Der Tarif gilt schon: Karte und Stand laden neu.
    await genauEineMeldung();
  });

  it('nach dem Teilerfolg „erneut speichern": nur noch GET und PUT -- kein zweites PATCH, denn der Tarif gilt schon', async () => {
    server.stand.fehler.set('PUT /organizations/7', Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Datenbankfehler' } } }));
    const { result, rerender } = renderHook((p: { g: VorgangGemeinde }) => useLizenzAendern(p.g, { jetzt: JETZT }), { initialProps: { g: GEMEINDE } });
    act(() => result.current.aendern({ tarif: '50', laufzeit: 'jahr_ab_heute' }));
    expect(await speichern(result)).toBe(false);
    expect(organisationsAufrufe()).toEqual([['patch', '/organizations/7/limit'], ['get', '/organizations/7'], ['put', '/organizations/7']]);
    // Die Seite lädt den Vorgang neu (die Meldung): Die Gemeinde trägt jetzt den Tarif 50, der Entwurf bleibt.
    expect(server.stand.gemeinden[7].max_konfis).toBe(50);
    rerender({ g: { ...GEMEINDE, max_konfis: 50 } });
    expect(result.current.formular).toMatchObject({ tarif: '50', laufzeit: 'jahr_ab_heute' });
    server.stand.fehler.clear();
    expect(await speichern(result)).toBe(true);
    expect(organisationsAufrufe()).toEqual([
      ['patch', '/organizations/7/limit'], ['get', '/organizations/7'], ['put', '/organizations/7'],
      ['get', '/organizations/7'], ['put', '/organizations/7'],
    ]);
  });

  it('eine gesperrte Gemeinde (abgelaufen): Vorschau und Meldung sagen, dass der Zugang gesperrt bleibt; der PUT lässt is_active, wie er ist', async () => {
    server.stand.gemeinden[7].is_active = false;
    const { result } = lizenz({ ...GEMEINDE, is_active: false, trial_ends_at: '2026-10-01T00:00:00Z' });
    act(() => result.current.wunschUebernehmen!());
    expect(result.current.vorschau?.gesperrt).toBe(LIZENZ_TEXT.bleibtGesperrt);
    expect(await speichern(result)).toBe(true);
    expect((server.aufrufe('put', '/organizations/7')[0].koerper as Record<string, unknown>).is_active).toBe(false);
    expect(h.setSuccess).toHaveBeenCalledWith(`Lizenz geändert: Standard bis 11.10.2027. ${LIZENZ_TEXT.bleibtGesperrt}`);
  });

  it('scheitert schon der PATCH: Meldung, kein GET und kein PUT, nichts neu geladen', async () => {
    server.stand.fehler.set('PATCH /organizations/7/limit', Object.assign(new Error('x'), { response: { status: 400, data: { error: 'max_konfis ungültig' } } }));
    const { result } = lizenz();
    act(() => result.current.aendern({ tarif: '50', laufzeit: 'jahr_ab_heute' }));
    expect(await speichern(result)).toBe(false);
    expect(organisationsAufrufe()).toEqual([['patch', '/organizations/7/limit']]);
    expect(h.setError).toHaveBeenCalledWith('max_konfis ungültig');
    expect(meldungen).toBe(0);
  });

  it('liefert GET keine lesbare Gemeinde, ist die Laufzeit hier gesperrt -- kein PUT', async () => {
    const vorher = h.apiGet.getMockImplementation()!;
    h.apiGet.mockImplementation((pfad: string, optionen?: unknown) => (pfad === '/organizations/7' ? Promise.resolve({ data: { id: 7 } }) : vorher(pfad, optionen)));
    const { result } = lizenz();
    act(() => result.current.aendern({ laufzeit: 'jahr_ab_heute' }));
    expect(await speichern(result)).toBe(false);
    expect(result.current.laufzeitGesperrt).toBe(true);
    expect(h.setError).toHaveBeenCalledWith(LIZENZ_TEXT.stammFehlt);
    expect(server.aufrufe('put')).toEqual([]);
  });

  it('ohne Netz: kein Aufruf', async () => {
    h.online = false;
    const { result } = lizenz();
    act(() => result.current.aendern({ tarif: '50', laufzeit: 'jahr_ab_heute' }));
    expect(await speichern(result)).toBe(false);
    expect(organisationsAufrufe()).toEqual([]);
    expect(h.setError).toHaveBeenCalledTimes(1);
  });

  it('„Wunschlizenz übernehmen“ nur, wenn ein Wunsch bekannt ist und vom Entwurf abweicht; die Vorschau zeigt, was danach gilt', async () => {
    const { result } = lizenz();
    expect(result.current.wunschName).toBe('Standard');
    expect(result.current.wunschUebernehmen).not.toBeNull();
    act(() => result.current.wunschUebernehmen!());
    // Die Lizenz läuft noch bis 02.11.: ein Jahr ab Laufzeitende, Testphase aus.
    expect(result.current.formular).toMatchObject({ tarif: '50', eigenesLimit: false, laufzeit: 'jahr_ab_ende', testphase: false });
    expect(result.current.wunschUebernehmen).toBeNull();
    expect(result.current.vorschau?.text).toBe('Danach: Standard — bis 50 Konfis · 99\u00a0€ pro Jahr · Lizenz bis 02.11.2027.');
    expect(result.current.vorschau?.warnung).toBeNull();

    const ohneWunsch = lizenz({ ...GEMEINDE, wunsch_lizenz: null });
    expect(ohneWunsch.result.current.wunschUebernehmen).toBeNull();
  });

  it('gilt der Wunsch schon (Standard, keine Testphase): kein „Wunschlizenz übernehmen“ -- er setzte einer unbegrenzten Lizenz sonst ein Ende', () => {
    const { result } = lizenz({ ...GEMEINDE, max_konfis: 50, is_trial: false, trial_ends_at: null });
    expect(result.current.wunschUebernehmen).toBeNull();
  });

  it('der Schalter „Testphase“: das Limit folgt ihm, solange es auf der Vorgabe steht; ohne Laufzeitende ist er aus', async () => {
    const { result } = lizenz();
    act(() => result.current.aendern({ testphase: false }));
    expect(result.current.formular).toMatchObject({ testphase: false, tarif: '50' });
    act(() => result.current.aendern({ testphase: true, laufzeit: 'unbegrenzt' }));
    expect(result.current.formular?.testphase).toBe(false);
  });

  it('ohne Gemeinde: nicht änderbar, kein Formular, kein Aufruf', async () => {
    const { result } = lizenz(null);
    expect(result.current.aenderbar).toBe(false);
    expect(result.current.formular).toBeNull();
    expect(result.current.formularLink).toBeNull();
    expect(await speichern(result)).toBe(false);
    expect(organisationsAufrufe()).toEqual([]);
  });

  it('der Link ins Gemeinde-Formular', () => {
    expect(lizenz().result.current.formularLink).toBe('/admin/organizations?gemeinde=7&bearbeiten=1');
  });
});
