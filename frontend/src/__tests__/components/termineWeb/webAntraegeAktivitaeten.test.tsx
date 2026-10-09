// Die gemeldeten Aktivitäten und der Katalog der Aktivitäten der Leitung in
// der Web-Fassung, gerendert (03.10.2026; 06.10.2026 wie in der App geordnet):
// der Reiter "Aktivitäten" unter Mitmachen (?segment=antraege; was Konfis und
// Team gemeldet haben) als Tabelle mit Status-Chips, der Katalog (die Vorlagen
// für Punkte) als eigene Seite unter Mehr (/admin/activities) mit Rollen-Chips,
// Art-Filter und Suche. Geprüft, angelegt, gelöscht wird mit denselben
// Fenstern und Rückfragen wie in der App.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import {
  h, api, setError, routerPush, geoeffnet, letzteRueckfrage, knopfIn,
  zuruecksetzen, richteEin, oeffne, JETZT,
} from './geruestWeb';
import WebAntraege from '../../../components/admin/web/termine/WebAntraege';
import type { AntragZeile } from '../../../components/admin/web/termine/typen';
import { WebAktivitaetenTabelle, type AktivitaetZeile } from '../../../components/admin/web/termine/WebAktivitaeten';

const antrag = (id: number, zusatz: Partial<AntragZeile>): AntragZeile => ({
  id, konfi_id: id + 10, konfi_name: 'Mia Muster', jahrgang_name: 'Jahrgang 2026', activity_id: 3,
  activity_name: 'Gemeindefest helfen', activity_type: 'gemeinde', activity_points: 2, requested_date: '2026-09-27',
  status: 'pending', created_at: '2026-10-02T09:00:00Z', updated_at: '2026-10-02T09:00:00Z', ...zusatz,
});

const ANTRAEGE: AntragZeile[] = [
  antrag(71, { konfi_name: 'Mia Muster', comment: 'Beim Aufbau geholfen', photo_filename: 'beleg.jpg' }),
  antrag(72, { konfi_name: 'Ben Beispiel', activity_name: 'Sonntagsgottesdienst', activity_type: 'gottesdienst', activity_points: 1, status: 'approved', created_at: '2026-09-21T09:00:00Z' }),
  antrag(73, { konfi_name: 'Zoe Probe', jahrgang_name: 'Jahrgang 2027', status: 'rejected', admin_comment: 'Nicht belegt', created_at: '2026-09-11T09:00:00Z' }),
  antrag(74, { konfi_name: 'Tim Teamer', jahrgang_name: undefined, activity_name: 'Freizeit begleitet', activity_target_role: 'teamer', activity_points: 0, created_at: '2026-10-01T09:00:00Z' }),
];

const AKTIVITAETEN_KONFI = [
  { id: 3, name: 'Gemeindefest helfen', description: 'Auf- und Abbau', points: 2, type: 'gemeinde', target_role: 'konfi', created_at: '2026-08-01T00:00:00Z' },
  { id: 1, name: 'Sonntagsgottesdienst', points: 1, type: 'gottesdienst', target_role: 'konfi', created_at: '2026-08-01T00:00:00Z' },
  { id: 4, name: 'Adventsmarkt', points: 3, type: 'gemeinde', target_role: 'konfi', created_at: '2026-08-01T00:00:00Z' },
];
const AKTIVITAETEN_TEAM = [
  { id: 9, name: 'Freizeit begleitet', points: 0, type: null, target_role: 'teamer', created_at: '2026-08-01T00:00:00Z' },
];

const DATEN = {
  'admin:events:': [], 'admin:events-cancelled:': [], 'admin:jahrgaenge:': [],
  'admin:requests:': ANTRAEGE,
  'admin:activities:1:konfi': AKTIVITAETEN_KONFI,
  'admin:activities:1:teamer': AKTIVITAETEN_TEAM,
};

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });
// Die Wahl Liste/Kacheln merkt sich der Browser -- jeder Test beginnt mit der Vorgabe.
beforeEach(() => { try { window.localStorage.clear(); } catch { /* ohne Speicher gilt die Vorgabe */ } });

/** 'antraege': der Reiter „Aktivitäten" unter Mitmachen; 'aktivitaeten': der Katalog unter Mehr. */
const oeffneReiter = (segment: 'antraege' | 'aktivitaeten', nutzer: 'leitung' | 'admin' | 'teamer' = 'leitung', filter = '') => {
  if (segment === 'aktivitaeten') {
    richteEin({ nutzer, pfad: '/admin/activities', daten: DATEN });
    return oeffne('aktivitaeten');
  }
  richteEin({ nutzer, pfad: '/admin/events', suche: `?segment=${segment}${filter}`, daten: DATEN });
  return oeffne('leitung');
};

const chip = (name: RegExp) => screen.getByRole('button', { name });
/** Ein Chip einer benannten Gruppe -- Namen von Aktivitäten stehen als Knöpfe in der Tabelle. */
const artChip = (name: RegExp) => within(screen.getByRole('group', { name: 'Aktivitäten nach Art' })).getByRole('button', { name });
const tabelle = (name: string) => screen.getByRole('table', { name });
/** Die Spalte "Von" bzw. "Aktivität" als Namen, von oben nach unten. */
const spalte = (name: string, nr: number) => within(tabelle(name)).getAllByRole('row').slice(1)
  .map((z) => within(z).getAllByRole('cell')[nr].querySelector('.web-zelle-titel')!.textContent);

describe('Anträge: Reiter und Tabelle', () => {
  it('?segment=antraege: Titel und Reiter heißen "Aktivitäten" wie in der App; die Zahl am Reiter kommt aus dem Badge', async () => {
    h.badge = { pendingEventsCount: 0, pendingRequestsCount: 2 };
    await oeffneReiter('antraege');
    expect(screen.getByRole('heading', { level: 1, name: 'Aktivitäten' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Bereiche von Mitmachen' });
    expect(within(nav).getByRole('link', { name: /^Aktivitäten/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /^Events/ })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('img', { name: '2 Anträge warten auf Entscheidung' })).toBeInTheDocument();
  });

  it('Standard "Offen": die offenen Anträge, neueste zuerst; die Chips zählen alle Status', async () => {
    await oeffneReiter('antraege');
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Mia Muster', 'Tim Teamer']);
    // Derselbe Vorlesesatz wie an der orangen Zahl der App (seiten/mitmachenLeitung.ts, 09.10.2026).
    expect(chip(/^Offen/)).toHaveTextContent(/^Offen2 Anträge warten auf Entscheidung$/);
    expect(chip(/^Verbucht/)).toHaveTextContent(/^Verbucht1$/);
    expect(chip(/^Abgelehnt/)).toHaveTextContent(/^Abgelehnt1$/);
    expect(chip(/^Alle/)).toHaveTextContent(/^Alle4$/);
    expect(chip(/^Offen/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('die Zeile zeigt Person, Jahrgang, Aktivität mit Kommentar, Punkte, Foto-Hinweis und Status', async () => {
    await oeffneReiter('antraege');
    const zeile = screen.getByRole('button', { name: 'Aktivität von Mia Muster prüfen' }).closest('tr')!;
    const zellen = within(zeile).getAllByRole('cell');
    expect(zellen[1]).toHaveTextContent('Mia Muster');
    expect(zellen[1]).toHaveTextContent('Jahrgang 2026');
    expect(zellen[2]).toHaveTextContent('Gemeindefest helfen');
    expect(zellen[2]).toHaveTextContent('„Beim Aufbau geholfen“');
    expect(zellen[3]).toHaveTextContent('Foto');
    expect(zellen[4]).toHaveTextContent('2P');
    expect(zellen[4]).toHaveTextContent('Gemeinde');
    expect(zellen[5]).toHaveTextContent('Offen');
  });

  it('Anträge des Teams: "Team" statt Jahrgang, keine Punkte', async () => {
    await oeffneReiter('antraege');
    const zeile = screen.getByRole('button', { name: 'Aktivität von Tim Teamer prüfen' }).closest('tr')!;
    expect(within(zeile).getAllByRole('cell')[1]).toHaveTextContent('Team');
    expect(within(zeile).getAllByRole('cell')[4]).toHaveTextContent('–');
  });

  it('Klick auf "Verbucht", "Abgelehnt" und "Alle" wechselt die Liste', async () => {
    await oeffneReiter('antraege');
    fireEvent.click(chip(/^Verbucht/));
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Ben Beispiel']);
    fireEvent.click(chip(/^Abgelehnt/));
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Zoe Probe']);
    expect(screen.getByText('Grund der Ablehnung:')).toBeInTheDocument();
    expect(screen.getByText('Nicht belegt')).toBeInTheDocument();
    fireEvent.click(chip(/^Alle/));
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Mia Muster', 'Tim Teamer', 'Ben Beispiel', 'Zoe Probe']);
  });

  it('?filter=alle in der Adresse wählt "Alle" vor', async () => {
    await oeffneReiter('antraege', 'leitung', '&filter=alle');
    expect(chip(/^Alle/)).toHaveAttribute('aria-pressed', 'true');
    expect(within(tabelle('Gemeldete Aktivitäten')).getAllByRole('row')).toHaveLength(5);
  });

  it('Suche nach Person und nach Aktivität, ohne Treffer mit Weg zurück', async () => {
    await oeffneReiter('antraege', 'leitung', '&filter=alle');
    const feld = screen.getByRole('searchbox', { name: 'Aktivitäten durchsuchen' });
    fireEvent.change(feld, { target: { value: 'zoe' } });
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Zoe Probe']);
    fireEvent.change(feld, { target: { value: 'freizeit' } });
    expect(spalte('Gemeldete Aktivitäten', 1)).toEqual(['Tim Teamer']);
    fireEvent.change(feld, { target: { value: 'zzz' } });
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(within(tabelle('Gemeldete Aktivitäten')).getAllByRole('row')).toHaveLength(5);
  });

  it('leer: Hinweis statt Tabelle', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/events', suche: '?segment=antraege', daten: { ...DATEN, 'admin:requests:': [] } });
    await oeffne('leitung');
    expect(screen.queryByRole('table')).toBe(null);
    expect(screen.getByText('Keine Aktivitäten warten auf eine Entscheidung.')).toBeInTheDocument();
  });

  it('Aktualisieren lädt die Anträge neu (nicht die Events)', async () => {
    await oeffneReiter('antraege');
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    await act(async () => { await Promise.resolve(); });
    expect(h.neuGeladen).toEqual(['admin:requests:1']);
  });
});

describe('Anträge: Aktionen -- dieselben Funktionen wie die App', () => {
  it('"Prüfen" öffnet das Fenster "Aktivität prüfen"', async () => {
    await oeffneReiter('antraege');
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität von Mia Muster prüfen' }));
    expect(geoeffnet('AdminActivityRequestModal')).toHaveLength(1);
  });

  it('erledigte Anträge: "Ansehen" öffnet dasselbe Fenster, "Zurücksetzen" fragt nach und ruft /reset', async () => {
    await oeffneReiter('antraege', 'leitung', '&filter=verbucht');
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität von Ben Beispiel ansehen' }));
    expect(geoeffnet('AdminActivityRequestModal')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Aktivität zurücksetzen' }));
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Aktivität zurücksetzen');
    expect(frage.message).toBe('Genehmigte Aktivität von "Ben Beispiel" zurücksetzen und wieder als offen markieren?');
    expect(api.put).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Zurücksetzen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/admin/activities/requests/72/reset');
    expect(h.neuGeladen).toEqual(['admin:requests:1']);
    expect(h.triggerRefresh.mock.calls.map((a) => a[0])).toEqual(['requests', 'konfis']);
  });

  it('offene Anträge lassen sich nicht zurücksetzen -- es gibt nur "Prüfen"', async () => {
    await oeffneReiter('antraege');
    expect(screen.queryByRole('button', { name: 'Aktivität zurücksetzen' })).toBe(null);
  });
});

describe('Anträge: Hinweis ohne Jahrgang', () => {
  const aktionen = { pruefen: vi.fn(), zuruecksetzen: vi.fn() };

  it('der Server blendet Konfi-Anträge aus: Hinweis, und eine leere Liste sagt warum', () => {
    render(<WebAntraege antraege={[]} ohneJahrgang aktionen={aktionen} />);
    expect(screen.getByRole('status')).toHaveTextContent('Kein Jahrgang zugewiesen');
    expect(screen.getByRole('status')).toHaveTextContent('Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du keine Meldungen von Konfis.');
    expect(screen.getByRole('heading', { name: 'Kein Jahrgang zugewiesen' })).toBeInTheDocument();
  });

  it('ohne Hinweis, wenn dem Konto ein Jahrgang zugewiesen ist', () => {
    render(<WebAntraege antraege={[]} ohneJahrgang={false} aktionen={aktionen} />);
    expect(screen.queryByRole('status')).toBe(null);
    expect(screen.queryByText(/Kein Jahrgang zugewiesen/)).toBe(null);
  });

  it('eine kaputte Antwort (Objekt statt Liste) zeigt eine leere Liste statt abzustürzen', () => {
    render(<WebAntraege antraege={{ fehler: 'x' } as unknown as AntragZeile[]} ohneJahrgang={false} aktionen={aktionen} />);
    expect(screen.queryByRole('table')).toBe(null);
    expect(screen.getByText('Keine Aktivitäten vorhanden')).toBeInTheDocument();
  });
});

// Recht "Anträge entscheiden" (09.10.2026): ohne es kein "Prüfen", sondern
// "Ansehen" (das Fenster zeigt den Grund), und kein Zurücksetzen.
describe('Anträge: Recht "Anträge entscheiden"', () => {
  const aktionen = { pruefen: vi.fn(), zuruecksetzen: vi.fn() };
  const LISTE: AntragZeile[] = [
    antrag(81, { konfi_name: 'Ohne Recht offen', darf_entscheiden: false }),
    antrag(82, { konfi_name: 'Ohne Recht verbucht', status: 'approved', darf_entscheiden: false }),
    antrag(83, { konfi_name: 'Mit Recht offen', darf_entscheiden: true }),
    antrag(84, { konfi_name: 'Alt verbucht', status: 'approved' }),
  ];
  const zeigeAlle = () => {
    render(<WebAntraege antraege={LISTE} ohneJahrgang={false} aktionen={aktionen} />);
    fireEvent.click(screen.getByRole('button', { name: /^Alle/ }));
  };

  it('VERBOTEN: offen ohne Recht heißt "Ansehen" statt "Prüfen"; verbucht ohne Recht hat kein Zurücksetzen', () => {
    zeigeAlle();
    expect(screen.queryByRole('button', { name: 'Aktivität von Ohne Recht offen prüfen' })).toBe(null);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität von Ohne Recht offen ansehen' }));
    expect(aktionen.pruefen).toHaveBeenCalledWith(expect.objectContaining({ id: 81 }));
    expect(screen.getByRole('button', { name: 'Aktivität von Ohne Recht verbucht ansehen' })).toBeInTheDocument();
    // Zwei verbuchte, aber nur der mit Recht (Feld fehlt = wie bisher) lässt sich zurücksetzen.
    expect(screen.getAllByRole('button', { name: 'Aktivität zurücksetzen' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität zurücksetzen' }));
    expect(aktionen.zuruecksetzen).toHaveBeenCalledWith(expect.objectContaining({ id: 84 }));
  });

  it('ERLAUBT: mit Recht "Prüfen" am offenen Antrag', () => {
    zeigeAlle();
    expect(screen.getByRole('button', { name: 'Aktivität von Mit Recht offen prüfen' })).toBeInTheDocument();
  });
});

describe('Aktivitäten: Tabelle', () => {
  it('der Katalog unter Mehr: nach Name sortiert, mit Art und Punkten; die Chips zählen die Arten', async () => {
    await oeffneReiter('aktivitaeten');
    expect(screen.getByRole('heading', { level: 1, name: 'Aktivitäten' })).toBeInTheDocument();
    const namen = within(tabelle('Aktivitäten')).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[0].textContent);
    expect(namen).toEqual(['Adventsmarkt', 'Gemeindefest helfenAuf- und Abbau', 'Sonntagsgottesdienst']);
    expect(artChip(/^Alle/)).toHaveTextContent(/^Alle3$/);
    expect(artChip(/^Gemeinde/)).toHaveTextContent(/^Gemeinde2$/);
    expect(artChip(/^Gottesdienst/)).toHaveTextContent(/^Gottesdienst1$/);
    const zeile = screen.getByRole('button', { name: 'Adventsmarkt bearbeiten' }).closest('tr')!;
    expect(zeile).toHaveTextContent('Gemeinde');
    expect(zeile).toHaveTextContent('+3P');
  });

  it('Art-Chip und Suche filtern; die Suche liest auch die Beschreibung', async () => {
    await oeffneReiter('aktivitaeten');
    fireEvent.click(artChip(/^Gottesdienst/));
    expect(within(tabelle('Aktivitäten')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Sonntagsgottesdienst bearbeiten' })).toBeInTheDocument();
    fireEvent.click(artChip(/^Alle/));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Aktivität suchen' }), { target: { value: 'abbau' } });
    expect(within(tabelle('Aktivitäten')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Gemeindefest helfen bearbeiten' })).toBeInTheDocument();
  });

  it('Reiter "Team": lädt die Liste des Teams, ohne Spalten Art und Punkte', async () => {
    await oeffneReiter('aktivitaeten');
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    expect(h.abfragen.at(-1)).toBe('admin:activities:1:teamer');
    expect(screen.getByRole('button', { name: 'Freizeit begleitet bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Punkte' })).toBe(null);
    expect(screen.queryByRole('columnheader', { name: 'Art' })).toBe(null);
    expect(screen.queryByRole('group', { name: 'Aktivitäten nach Art' })).toBe(null);
  });

  it('Neue Aktivität öffnet das Fenster; Tippen auf eine Aktivität ebenso', async () => {
    await oeffneReiter('aktivitaeten');
    fireEvent.click(screen.getByRole('button', { name: 'Neue Aktivität anlegen' }));
    expect(geoeffnet('ActivityManagementModal')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Adventsmarkt bearbeiten' }));
    expect(geoeffnet('ActivityManagementModal')).toHaveLength(2);
  });

  it('Löschen fragt nach und ruft erst nach "Löschen" DELETE', async () => {
    await oeffneReiter('aktivitaeten');
    const zeile = screen.getByRole('button', { name: 'Adventsmarkt bearbeiten' }).closest('tr')!;
    fireEvent.click(within(zeile).getByRole('button', { name: 'Aktivität löschen' }));
    const frage = letzteRueckfrage();
    expect(frage.message).toBe('Aktivität "Adventsmarkt" wirklich löschen?');
    expect(api.delete).not.toHaveBeenCalled();
    await act(async () => { await knopfIn(frage, 'Löschen')!.handler!(); });
    expect(api.delete).toHaveBeenCalledWith('/admin/activities/4');
  });

  it('offline: keine Rückfrage, kein Löschen, eine Meldung', async () => {
    h.online = false;
    await oeffneReiter('aktivitaeten');
    fireEvent.click(within(screen.getByRole('button', { name: 'Adventsmarkt bearbeiten' }).closest('tr')!).getByRole('button', { name: 'Aktivität löschen' }));
    expect(h.presentAlert).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledTimes(1);
  });
});

describe('VERBOTEN: Teamer:innen bei den Aktivitäten', () => {
  it('sehen die Liste, aber weder Anlegen noch Bearbeiten noch Löschen', async () => {
    await oeffneReiter('aktivitaeten', 'teamer');
    expect(screen.getByText('Adventsmarkt')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neue Aktivität anlegen' })).toBe(null);
    expect(screen.queryByRole('button', { name: /bearbeiten$/ })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Aktivität löschen' })).toBe(null);
    expect(screen.queryByRole('columnheader', { name: 'Aktionen' })).toBe(null);
  });
});

describe('ERLAUBT: Admin bei den Aktivitäten', () => {
  it('legt an, bearbeitet und löscht wie die Gemeindeleitung', async () => {
    await oeffneReiter('aktivitaeten', 'admin');
    expect(screen.getByRole('button', { name: 'Neue Aktivität anlegen' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Aktivität bearbeiten' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Aktivität löschen' })).toHaveLength(3);
  });
});

describe('/admin/activities (die Adresse aus "Mehr")', () => {
  it('eine Seite unter Mehr wie die anderen: Weg zurück zu Mehr, keine Reiter von Mitmachen', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten: DATEN });
    await oeffne('aktivitaeten');
    expect(screen.getByRole('heading', { level: 1, name: 'Aktivitäten' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    expect(within(screen.getByRole('navigation', { name: 'Zurück' })).getByRole('link', { name: /Mehr/ })).toHaveAttribute('href', '/admin/settings');
    expect(within(tabelle('Aktivitäten')).getAllByRole('row')).toHaveLength(4);
    expect(h.abfragen.filter((k) => k.startsWith('admin:activities:'))[0]).toBe('admin:activities:1:konfi');
  });

  it('ein Klick auf "Mehr" geht zurück zu Mehr', async () => {
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten: DATEN });
    await oeffne('aktivitaeten');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Zurück' })).getByRole('link', { name: /Mehr/ }));
    expect(routerPush).toHaveBeenCalledWith('/admin/settings', 'none', 'push');
  });

  it('schmal: die Liste der App, keine Tabelle', async () => {
    h.breit = false;
    richteEin({ nutzer: 'leitung', pfad: '/admin/activities', daten: DATEN });
    await oeffne('aktivitaeten');
    expect(screen.queryByRole('table')).toBe(null);
    expect(screen.queryByRole('navigation', { name: 'Bereiche von Mitmachen' })).toBe(null);
    expect(screen.getAllByTestId('termin')).toHaveLength(3);
  });
});

// --- Sortieren nach Spalte (Simon, 07.10.2026) und Liste/Kacheln (07.10.2026) ---

/** Die Reihenfolge der Zeilen, gelesen an den Namen, die in ihnen stehen. */
const reihenfolge = (t: HTMLElement, namen: readonly string[]) => within(t).getAllByRole('row').slice(1)
  .map((zeile) => namen.find((n) => zeile.textContent!.includes(n)) ?? '?');
/** Klick auf den Kopf der Spalte -- der Knopf im columnheader. */
const sortiere = (t: HTMLElement, kopf: string) => {
  const zelle = within(t).getByRole('columnheader', { name: new RegExp(`^${kopf}`) });
  fireEvent.click(within(zelle).getByRole('button'));
  return zelle;
};

const zeigeAntraege = () => {
  const aktionen = { pruefen: vi.fn(), zuruecksetzen: vi.fn() };
  h.standort = { pathname: '/admin/events', search: '?segment=antraege&filter=alle' };
  const r = render(<WebAntraege antraege={ANTRAEGE} ohneJahrgang={false} aktionen={aktionen} />);
  return { ...r, aktionen };
};

const KATALOG: AktivitaetZeile[] = [
  { id: 3, name: 'Gemeindefest helfen', description: 'Auf- und Abbau', points: 2, type: 'gemeinde', categories: [{ id: 1, name: 'Mithelfen' }] },
  { id: 1, name: 'Sonntagsgottesdienst', points: 1, type: 'gottesdienst', categories: [{ id: 2, name: 'Gottesdienst' }] },
  { id: 4, name: 'Adventsmarkt', points: 3, type: 'gemeinde', categories: [] },
] as unknown as AktivitaetZeile[];

const zeigeKatalog = (rolle: 'konfi' | 'teamer' = 'konfi') => {
  const aufrufe = { onBearbeiten: vi.fn(), onLoeschen: vi.fn(), onAnlegen: vi.fn(), onRolle: vi.fn() };
  const r = render(
    <WebAktivitaetenTabelle
      aktivitaeten={rolle === 'konfi' ? KATALOG : (AKTIVITAETEN_TEAM as unknown as AktivitaetZeile[])}
      rolle={rolle}
      darfAnlegen
      darfBearbeiten
      darfLoeschen
      {...aufrufe}
    />,
  );
  return { ...r, aufrufe };
};

const umschalter = (name: 'Liste' | 'Kacheln') => within(screen.getByRole('group', { name: 'Ansicht' })).getByRole('button', { name });
/** Die Kachel, in deren Kopf der Name steht. */
const kachel = (name: string) => [...document.querySelectorAll<HTMLElement>('.web-bildkarte')]
  .find((k) => k.querySelector('.web-bildkarte__kopf')!.textContent!.includes(name))!;
const akzent = (k: HTMLElement) => k.style.getPropertyValue('--web-bildkarte-akzent');

describe('Anträge: Sortieren nach Spalte', () => {
  const NAMEN = ['Mia Muster', 'Ben Beispiel', 'Zoe Probe', 'Tim Teamer'];

  it('bis zum Klick neueste zuerst; "Von" ordnet nach Name, ein zweiter Klick dreht', () => {
    zeigeAntraege();
    const t = () => tabelle('Gemeldete Aktivitäten');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Mia Muster', 'Tim Teamer', 'Ben Beispiel', 'Zoe Probe']);
    const kopf = sortiere(t(), 'Von');
    expect(kopf).toHaveAttribute('aria-sort', 'ascending');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Ben Beispiel', 'Mia Muster', 'Tim Teamer', 'Zoe Probe']);
    sortiere(t(), 'Von');
    expect(kopf).toHaveAttribute('aria-sort', 'descending');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Zoe Probe', 'Tim Teamer', 'Mia Muster', 'Ben Beispiel']);
  });

  it('"Eingang" ordnet nach Datum, "Status" nach dem Ablauf, "Punkte" mit dem Team unten', () => {
    zeigeAntraege();
    const t = () => tabelle('Gemeldete Aktivitäten');
    sortiere(t(), 'Eingang');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Zoe Probe', 'Ben Beispiel', 'Tim Teamer', 'Mia Muster']);
    // Offen, Offen, Verbucht, Abgelehnt -- Offenes zuerst, nicht alphabetisch
    // (das wäre Abgelehnt, Offen, Offen, Verbucht). Gleiche Status behalten
    // die Reihenfolge der Seite; absteigend dreht die Reihe.
    sortiere(t(), 'Status');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Mia Muster', 'Tim Teamer', 'Ben Beispiel', 'Zoe Probe']);
    sortiere(t(), 'Status');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Zoe Probe', 'Ben Beispiel', 'Mia Muster', 'Tim Teamer']);
    sortiere(t(), 'Punkte');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Ben Beispiel', 'Mia Muster', 'Zoe Probe', 'Tim Teamer']);
    sortiere(t(), 'Punkte');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Mia Muster', 'Zoe Probe', 'Ben Beispiel', 'Tim Teamer']);
  });
});

describe('Aktivitäten: Sortieren nach Spalte', () => {
  const NAMEN = ['Gemeindefest helfen', 'Sonntagsgottesdienst', 'Adventsmarkt'];

  it('"Punkte" ordnet nach der Zahl, ein zweiter Klick dreht; "Art" nach dem Wort', () => {
    zeigeKatalog();
    const t = () => tabelle('Aktivitäten');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Adventsmarkt', 'Gemeindefest helfen', 'Sonntagsgottesdienst']);
    const kopf = sortiere(t(), 'Punkte');
    expect(kopf).toHaveAttribute('aria-sort', 'ascending');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Sonntagsgottesdienst', 'Gemeindefest helfen', 'Adventsmarkt']);
    sortiere(t(), 'Punkte');
    expect(kopf).toHaveAttribute('aria-sort', 'descending');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Adventsmarkt', 'Gemeindefest helfen', 'Sonntagsgottesdienst']);
    sortiere(t(), 'Art');
    sortiere(t(), 'Art');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Sonntagsgottesdienst', 'Adventsmarkt', 'Gemeindefest helfen']);
  });

  it('"Aktivität" und "Kategorien" ordnen nach Text; ohne Kategorie steht unten', () => {
    zeigeKatalog();
    const t = () => tabelle('Aktivitäten');
    sortiere(t(), 'Aktivität');
    sortiere(t(), 'Aktivität');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Sonntagsgottesdienst', 'Gemeindefest helfen', 'Adventsmarkt']);
    sortiere(t(), 'Kategorien');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Sonntagsgottesdienst', 'Gemeindefest helfen', 'Adventsmarkt']);
    sortiere(t(), 'Kategorien');
    expect(reihenfolge(t(), NAMEN)).toEqual(['Gemeindefest helfen', 'Sonntagsgottesdienst', 'Adventsmarkt']);
  });
});

describe('Aktivitäten: Liste oder Kacheln', () => {
  it('Vorgabe Liste; "Kacheln" wechselt und merkt sich die Wahl über das Neuladen hinaus', () => {
    const { unmount } = zeigeKatalog();
    expect(umschalter('Liste')).toHaveAttribute('aria-pressed', 'true');
    expect(tabelle('Aktivitäten')).toBeInTheDocument();
    fireEvent.click(umschalter('Kacheln'));
    expect(umschalter('Kacheln')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('table')).toBe(null);
    expect(within(screen.getByRole('list', { name: 'Aktivitäten' })).getAllByRole('article')).toHaveLength(3);
    expect(window.localStorage.getItem('konfiquest.ansicht.aktivitaeten')).toBe('kacheln');
    unmount();
    zeigeKatalog();
    expect(umschalter('Kacheln')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('table')).toBe(null);
    fireEvent.click(umschalter('Liste'));
    expect(window.localStorage.getItem('konfiquest.ansicht.aktivitaeten')).toBe('liste');
    expect(tabelle('Aktivitäten')).toBeInTheDocument();
  });

  it('die Kachel trägt den Namen im Kopf, in der Farbe der Art: Gottesdienst, Gemeinde, Team', () => {
    window.localStorage.setItem('konfiquest.ansicht.aktivitaeten', 'kacheln');
    const { unmount } = zeigeKatalog();
    expect(kachel('Sonntagsgottesdienst').querySelector('.web-bildkarte__kopf')).toHaveTextContent('GottesdienstSonntagsgottesdienst');
    expect(akzent(kachel('Sonntagsgottesdienst'))).toBe('var(--app-color-gottesdienst)');
    expect(akzent(kachel('Adventsmarkt'))).toBe('var(--app-color-gemeinde)');
    expect(kachel('Adventsmarkt')).toHaveTextContent('+3 Punkte');
    unmount();
    zeigeKatalog('teamer');
    expect(kachel('Freizeit begleitet').querySelector('.web-bildkarte__kopf')).toHaveTextContent('TeamFreizeit begleitet');
    expect(akzent(kachel('Freizeit begleitet'))).toBe('var(--app-color-teamer)');
  });

  it('Titel und "Bearbeiten" öffnen genau diese Aktivität, "Löschen" ebenso', () => {
    window.localStorage.setItem('konfiquest.ansicht.aktivitaeten', 'kacheln');
    const { aufrufe } = zeigeKatalog();
    // Nicht die erste Kachel -- sonst fiele ein falscher Eintrag nicht auf.
    fireEvent.click(screen.getByRole('button', { name: 'Sonntagsgottesdienst bearbeiten' }));
    expect(aufrufe.onBearbeiten).toHaveBeenCalledTimes(1);
    expect(aufrufe.onBearbeiten.mock.calls[0][0].id).toBe(1);
    fireEvent.click(within(kachel('Gemeindefest helfen')).getByRole('button', { name: 'Aktivität bearbeiten' }));
    expect(aufrufe.onBearbeiten).toHaveBeenCalledTimes(2);
    expect(aufrufe.onBearbeiten.mock.calls[1][0].id).toBe(3);
    fireEvent.click(within(kachel('Sonntagsgottesdienst')).getByRole('button', { name: 'Aktivität löschen' }));
    expect(aufrufe.onLoeschen).toHaveBeenCalledTimes(1);
    expect(aufrufe.onLoeschen.mock.calls[0][0].id).toBe(1);
  });
});

describe('Anträge: Liste oder Kacheln', () => {
  it('Vorgabe Liste; "Kacheln" wechselt und merkt sich die Wahl', () => {
    const { unmount } = zeigeAntraege();
    expect(umschalter('Liste')).toHaveAttribute('aria-pressed', 'true');
    expect(tabelle('Gemeldete Aktivitäten')).toBeInTheDocument();
    fireEvent.click(umschalter('Kacheln'));
    expect(screen.queryByRole('table')).toBe(null);
    expect(within(screen.getByRole('list', { name: 'Gemeldete Aktivitäten' })).getAllByRole('article')).toHaveLength(4);
    expect(window.localStorage.getItem('konfiquest.ansicht.antraege')).toBe('kacheln');
    unmount();
    zeigeAntraege();
    expect(umschalter('Kacheln')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('table')).toBe(null);
  });

  it('die Kachel trägt den Namen im Kopf, in der Farbe des Stands: offen, verbucht, abgelehnt', () => {
    window.localStorage.setItem('konfiquest.ansicht.antraege', 'kacheln');
    zeigeAntraege();
    expect(kachel('Mia Muster').querySelector('.web-bildkarte__kopf')).toHaveTextContent('Mia Muster');
    expect(kachel('Mia Muster').querySelector('.web-bildkarte__kopf')).toHaveTextContent('Gemeinde · Jahrgang 2026');
    expect(akzent(kachel('Mia Muster'))).toBe('var(--app-color-warning)');
    expect(akzent(kachel('Ben Beispiel'))).toBe('var(--app-color-success)');
    expect(akzent(kachel('Zoe Probe'))).toBe('var(--app-color-danger)');
    expect(kachel('Zoe Probe')).toHaveTextContent('Grund der Ablehnung: Nicht belegt');
  });

  it('Titel und "Prüfen" rufen das Prüfen genau dieses Antrags; erledigte "Zurücksetzen"', () => {
    window.localStorage.setItem('konfiquest.ansicht.antraege', 'kacheln');
    const { aktionen } = zeigeAntraege();
    // Der Titel im Kopf ...
    const titel = within(within(kachel('Tim Teamer')).getByRole('heading')).getByRole('button', { name: 'Aktivität von Tim Teamer prüfen' });
    fireEvent.click(titel);
    // ... und "Prüfen" im Fuß -- derselbe Weg wie in der Liste. Beides nicht an
    // der ersten Kachel (Mia), sonst fiele ein falscher Eintrag nicht auf.
    const fuss = kachel('Tim Teamer').querySelector('footer') as HTMLElement;
    fireEvent.click(within(fuss).getByRole('button', { name: 'Aktivität von Tim Teamer prüfen' }));
    expect(aktionen.pruefen.mock.calls.map((c) => c[0].id)).toEqual([74, 74]);
    // Erledigte: der Titel heißt "ansehen" und öffnet dasselbe Fenster.
    fireEvent.click(within(within(kachel('Ben Beispiel')).getByRole('heading')).getByRole('button', { name: 'Aktivität von Ben Beispiel ansehen' }));
    expect(aktionen.pruefen.mock.calls.at(-1)![0].id).toBe(72);
    fireEvent.click(within(kachel('Zoe Probe')).getByRole('button', { name: 'Aktivität zurücksetzen' }));
    expect(aktionen.zuruecksetzen.mock.calls.map((c) => c[0].id)).toEqual([73]);
  });
});
