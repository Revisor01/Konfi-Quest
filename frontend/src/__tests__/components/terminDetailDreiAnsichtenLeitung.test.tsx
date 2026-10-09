// Befund N6 (Drei-Ansichten-Bericht), Teil Leitung -- gerendert.
//
// Das Termin-Detail gibt es dreimal (Konfi, Team, Leitung); Simons
// Entscheidungen vom 27.08.2026 stehen in allen drei. Bis 09.10.2026 prüfte
// das ein Quelltext-Test über drei Dateien (terminDetailDreiAnsichten.test.ts).
// Jetzt rendert je Ansicht eine Datei die echte Seite: diese die der Leitung,
// die Schwestern ...Konfi und ...Team.
//
// Den Statustext der Kopfzeile in allen Spielarten (Teamer-Kontingent,
// fehlender Status, Bald, Ausgebucht, Warteliste) prüft
// terminStatusDetailansicht.test.tsx; hier steht, dass er vom Backend kommt
// und nicht aus einer eigenen Rechnung über die Fristen.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne, statusText, inTagen } from './gerueste/leitungTerminDetail';
import { kopfzeileMitschreiben, nachtragZuruecksetzen, kopfzeilen } from './gerueste/nachtragKopfzeileIonic';

kopfzeileMitschreiben();

beforeEach(() => {
  zuruecksetzen();
  nachtragZuruecksetzen();
});

const zeige = async (zusatz: Record<string, unknown>) => {
  zustand.detail = termin(zusatz);
  return oeffne();
};

/** Der Wert einer Info-Zeile über ihre Beschriftung -- null, wenn es sie nicht gibt. */
const zeile = (beschriftung: string) => {
  const label = [...document.querySelectorAll('.app-info-row__label')].find((el) => el.textContent === beschriftung);
  if (!label) return null;
  return [...label.parentElement!.querySelectorAll('.app-info-row__value')].map((el) => el.textContent).join(' | ');
};

/** Die Kacheln im Kopf der Ansicht als "Wert Beschriftung". */
const kacheln = () => [...document.querySelectorAll('.app-stats-row__item')].map((k) =>
  `${k.querySelector('.app-stats-row__value')?.textContent} ${k.querySelector('.app-stats-row__label')?.textContent}`);

describe('N6 Leitung: Check-in-Fenster', () => {
  it('zeigt das Zeitfenster des Termins', async () => {
    await zeige({ checkin_window: 45 });
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 45 Min. (vor/nach Beginn)');
  });

  it('der Wert kommt aus checkin_window, nicht aus einer festen Zahl', async () => {
    await zeige({ checkin_window: 20 });
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 20 Min. (vor/nach Beginn)');
  });

  it('ohne Zeitfenster entfällt die Zeile', async () => {
    await zeige({ checkin_window: null });
    expect(zeile('Check-in-Fenster')).toBeNull();
  });
});

describe('N6 Leitung: Anmeldezeitraum', () => {
  it('ohne gesetzten Beginn: "Sofort möglich"', async () => {
    await zeige({ registration_opens_at: null });
    expect(zeile('Anmeldung')).toMatch(/^Sofort möglich/);
  });

  it('mit Beginn und Schluss: beide stehen da', async () => {
    await zeige({ registration_opens_at: '2026-09-01T08:00:00+02:00', registration_closes_at: '2026-09-20T18:00:00+02:00' });
    expect(zeile('Anmeldung')).toMatch(/^von 01\.09\.2026 – 08:00 \| bis 20\.09\.2026 – 18:00/);
  });

  it('entfällt bei Pflichtterminen', async () => {
    await zeige({ mandatory: true, registration_status: 'mandatory', max_participants: 0 });
    expect(zeile('Anmeldung')).toBeNull();
  });
});

describe('N6 Leitung: der Anmeldestatus kommt vom Backend', () => {
  it('rechnet nicht selbst: Frist längst offen, das Backend sagt "upcoming" -> "Bald"', async () => {
    await zeige({ registration_status: 'upcoming', registration_opens_at: inTagen(-3), max_participants: 0 });
    expect(statusText()).toBe('Bald');
  });

  it('nutzt den Wert aus der Antwort: Frist erst in drei Tagen, das Backend sagt "open" -> "Offen"', async () => {
    await zeige({ registration_status: 'open', registration_opens_at: inTagen(3), max_participants: 0 });
    expect(statusText()).toBe('Offen');
  });

  it('kennt Pflichttermine (sonst fiele "mandatory" auf "Geschlossen")', async () => {
    await zeige({ registration_status: 'mandatory', mandatory: true, max_participants: 0 });
    expect(statusText()).toBe('Pflicht-Event');
  });

  it('erkennt "ausgebucht" an der Kapazität: voll mit freier Warteliste meldet das Backend "open"', async () => {
    await zeige({ registration_status: 'open', max_participants: 1, registered_count: 1, waitlist_enabled: true });
    expect(statusText()).toBe('Warteliste');
  });
});

describe('N6 Leitung: keine "Punkte 0"', () => {
  it('ohne Punkte keine Punkte- und keine Typ-Zeile', async () => {
    await zeige({ points: 0 });
    expect(zeile('Punkte')).toBeNull();
    expect(zeile('Typ')).toBeNull();
  });

  it('mit Punkten stehen beide da', async () => {
    await zeige({ points: 3, point_type: 'gottesdienst' });
    expect(zeile('Punkte')).toBe('3');
    expect(zeile('Typ')).toBe('Gottesdienst');
  });

  it('bei Pflicht, Nur-Team und Konfirmation entfallen sie auch mit Punkten', async () => {
    for (const art of [{ mandatory: true }, { teamer_only: true }, { is_konfirmation: true }]) {
      zuruecksetzen();
      const { unmount } = await zeige({ points: 3, ...art });
      expect([zeile('Punkte'), zeile('Typ')]).toEqual([null, null]);
      unmount();
    }
  });

  it('die mittlere Kachel weicht bei 0 Punkten auf die Abgemeldeten aus', async () => {
    await zeige({ points: 0, teamer_needed: false });
    expect(kacheln()).toEqual(['1 von 20 TN', '0 Abgemeldet', '0 Warteliste']);
  });

  it('mit Punkten zeigt sie die Punkte', async () => {
    await zeige({ points: 3, teamer_needed: false });
    expect(kacheln()).toEqual(['1 von 20 TN', '3 Punkte', '0 Warteliste']);
  });
});

// Aus umschalterInDetailansichten (26.09.2026, Simon: "In Events Details kein
// org switcher zeigen."): Der Termin gehört zu genau einer Gemeinde.
describe('Leitungs-Termindetail: kein Gemeinde-Umschalter', () => {
  it('im geladenen Termin nicht', async () => {
    await zeige({});
    expect(kopfzeilen.length).toBeGreaterThan(0);
    expect(kopfzeilen.filter((k) => k.gemeindeUmschalter !== false)).toEqual([]);
  });

  it('auch nicht beim Laden und beim Hinweis auf einen fremden Jahrgang', async () => {
    // Die Antwort kommt nie (Laden) bzw. sagt 403 jahrgang_nicht_zugewiesen.
    const EventDetailView = (await import('../../components/admin/views/EventDetailView')).default;
    const { api } = await import('./gerueste/leitungTerminDetail');
    api.get.mockImplementation(() => new Promise(() => undefined));
    const laden = render(<EventDetailView eventId={7} onBack={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    laden.unmount();
    api.get.mockRejectedValue({ response: { status: 403, data: { error_code: 'jahrgang_nicht_zugewiesen' } } });
    render(<EventDetailView eventId={7} onBack={() => undefined} />);
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    const titel = kopfzeilen.map((k) => k.titel);
    expect(titel).toContain('Event-Details');
    expect(titel).toContain('Event');
    expect(kopfzeilen.filter((k) => k.gemeindeUmschalter !== false)).toEqual([]);
  });
});
