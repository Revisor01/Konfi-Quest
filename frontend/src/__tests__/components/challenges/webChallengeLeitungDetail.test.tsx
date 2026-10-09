// Die Seite einer Challenge fuer Team und Leitung in der Web-Fassung,
// gerendert (docs/planung/web-alle-bereiche.md, Entscheidung 6). Aufbau wie
// jede Detailseite (06.10.2026): im Kopf Titel, Kennzeichen und alle Aktionen,
// darunter die Kennzahlen; links Aufgabe und Beitraege als Raster mit den
// Knoepfen der Moderation, rechts die Angaben und der Stempel. Alles ueber
// dieselbe Logik wie die Ansicht der App (useChallengeLeitung): Rechte,
// Zaehler, Aktionen. Gelesen wird beim Aufgehen und Verlassen wie dort.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  push: vi.fn(),
  presentAlert: vi.fn(),
  presentModal: vi.fn(),
  bearbeiten: vi.fn(),
  dateiOeffnen: vi.fn(),
  setError: vi.fn(),
  markChallengeAsRead: vi.fn(async () => undefined),
  refreshAllCounts: vi.fn(async () => undefined),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  user: { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
  zaehler: {
    pendingChallengesByChallenge: {} as Record<number, number>,
    challengeUpdatesByChallenge: {} as Record<number, number>,
    challengeNeueBeitraegeByChallenge: {} as Record<number, number> | null,
    challengeNeueWartendByChallenge: {} as Record<number, number>,
  },
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: h.push }),
  useIonAlert: () => [h.presentAlert, vi.fn()],
  useIonModal: () => [h.presentModal, vi.fn()],
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn() }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ ...h.zaehler, markChallengeAsRead: h.markChallengeAsRead, refreshAllCounts: h.refreshAllCounts }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../hooks/useChallengeFormular', () => ({ useChallengeFormular: () => ({ anlegen: vi.fn(), bearbeiten: h.bearbeiten }) }));
vi.mock('../../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: h.dateiOeffnen }) }));
vi.mock('../../../components/shared/ChallengeMedium', () => ({
  default: ({ filePath, mediaType, maxHoehe, onOeffnen }: { filePath: string; mediaType: string; maxHoehe: number; onOeffnen?: (p: string, n: string) => void }) => (
    <div data-testid="medium" data-art={mediaType} data-pfad={filePath} data-hoehe={maxHoehe}>
      <button type="button" onClick={() => onOeffnen?.(filePath, 'datei.jpg')}>öffnen {filePath}</button>
    </div>
  ),
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header data-testid="kopfzeile">{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import ChallengeLeitungPage from '../../../components/shared/ChallengeLeitungPage';
import { offlineCache } from '../../../services/offlineCache';

const JETZT = new Date('2026-10-03T08:30:00Z').getTime();
const tage = (n: number) => new Date(JETZT + n * 24 * 3600 * 1000).toISOString();
const vor = (stunden: number) => new Date(JETZT - stunden * 3600 * 1000).toISOString();

const LAUFEND = {
  id: 7,
  title: 'Fürbitten zum Erntedank',
  description: 'Schreibt eine Bitte in einem Satz.',
  challenge_type: 'frei',
  audience: 'konfis_und_team',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['text', 'photo'],
  allow_multiple: true,
  badge_icon: 'heart',
  badge_name: 'Fürbitter:in',
  author_name: 'Pastorin Beispiel',
  starts_at: tage(-5),
  ends_at: tage(9),
  is_draft: false,
  jahrgaenge: [{ id: 1, name: '2026/2027' }, { id: 2, name: '2025/2026' }],
  submission_count: 5,
  pending_count: 2,
  own_submission_count: 0,
};

const beitrag = (id: number, user: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, user_id: user, media_type: 'text', text_content: `Text von ${name}`, file_path: null, file_name: null, link_url: null,
  konfi_consent: 'publish', moderation_status: 'approved', moderation_note: null, created_at: vor(id), display_name: name, jahrgang_name: '2026/2027',
  ...extra,
});

const BEITRAEGE = [
  beitrag(1, 31, 'Lena Beispiel'),
  beitrag(2, 32, 'Jonas Muster', { media_type: 'photo', file_path: 'foto-abc', file_name: 'kirche.jpg', text_content: 'Die Kirche am Abend' }),
  beitrag(3, 33, 'Mara Probe', { moderation_status: 'pending' }),
  beitrag(4, 34, 'Ole Vorlage', { moderation_status: 'pending', konfi_consent: 'private' }),
  beitrag(5, 36, 'Noah Entwurf', { moderation_status: 'hidden', moderation_note: 'Bitte ohne Namen Dritter.' }),
  beitrag(6, 4, 'Alex Beispiel', { moderation_status: 'approved' }),
];

const fehlerMitStatus = (status: number) => Object.assign(new Error(String(status)), { response: { status, data: { error: 'x' } } });
const netzWeg = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const antworten = (challenge: unknown = LAUFEND, beitraege: unknown[] = BEITRAEGE) => {
  h.apiGet.mockImplementation(async (route: string) => {
    if (route === '/challenges/admin/7') return { data: challenge };
    if (route === '/challenges/admin/7/submissions') return { data: { challenge, submissions: beitraege } };
    throw new Error(`unerwartet: ${route}`);
  });
};

const oeffne = (onBack = vi.fn()) => ({ onBack, ...render(<ChallengeLeitungPage challengeId={7} onBack={onBack} />) });
const zeigen = async (onBack = vi.fn()) => {
  const r = oeffne(onBack);
  await screen.findByRole('heading', { level: 1, name: 'Fürbitten zum Erntedank' });
  await screen.findByRole('list', { name: 'Beiträge' });
  return r;
};
const beitraege = () => [...screen.getByRole('list', { name: 'Beiträge' }).children] as HTMLElement[];
const namen = () => beitraege().map((b) => within(b).getByText(/^(Lena|Jonas|Mara|Ole|Noah|Alex) /).textContent);
const kopf = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement;
/** Die Knoepfe im Kopf in der Reihenfolge der Seite (Aktionen sind Knoepfe oben rechts). */
const knoepfeImKopf = () => within(kopf()).queryAllByRole('button').map((b) => b.textContent!.trim());
/** Die Kachel-Beschriftungen der Kennzahlen-Reihe ("Laufzeit: Noch 9 Tage"). */
const kennzahlen = () => [...document.querySelectorAll('.web-detail__kennzahlen .web-kachel')].map((k) => k.getAttribute('aria-label'));
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Beiträge nach Zustand' })).getByRole('button', { name });
const waehle = (name: RegExp | string) => fireEvent.click(chip(name));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.breit = true;
  h.user = { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' };
  h.zaehler = {
    pendingChallengesByChallenge: {},
    challengeUpdatesByChallenge: {},
    challengeNeueBeitraegeByChallenge: {},
    challengeNeueWartendByChallenge: {},
  };
  h.apiGet.mockReset();
  h.apiPut.mockReset();
  h.apiDelete.mockReset();
  h.apiPut.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
  antworten();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(JETZT));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Challenge fuer Team und Leitung (Web): Aufbau wie jede Detailseite', () => {
  it('alle Aktionen im Kopf, "Beitrag einreichen" als primaerer Knopf ganz rechts -- keine Karte "Aktionen"', async () => {
    await zeigen();
    expect(knoepfeImKopf()).toEqual(['Beiträge exportieren', 'Challenge bearbeiten', 'Beitrag einreichen']);
    expect(within(kopf()).getByRole('button', { name: 'Beitrag einreichen' })).toHaveClass('web-knopf--primaer');
    expect(within(kopf()).getByRole('button', { name: 'Challenge bearbeiten' })).not.toHaveClass('web-knopf--primaer');
    expect(screen.queryByRole('region', { name: 'Aktionen' })).toBeNull();
  });

  it('Kennzahlen unter dem Kopf: Beitraege, Teilnehmende, Warten auf Freigabe, Laufzeit', async () => {
    await zeigen();
    expect(kennzahlen()).toEqual(['Beiträge: 6', 'Teilnehmende: 6', 'Warten auf Freigabe: 2', 'Laufzeit: Noch 9 Tage']);
    const reihe = document.querySelector('.web-detail__kennzahlen') as HTMLElement;
    expect(reihe.querySelector('[aria-label="Beiträge: 6"]')).toHaveTextContent('3 im Feed');
    expect(kopf().compareDocumentPosition(reihe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reihe.compareDocumentPosition(document.querySelector('.web-spalten')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Teilnehmende zaehlen Personen, nicht Beitraege; die Kachel wartender Freigaben hebt sich nur mit Wartendem hervor', async () => {
    antworten(LAUFEND, [beitrag(1, 31, 'Lena Beispiel'), beitrag(2, 31, 'Lena Beispiel'), beitrag(3, 33, 'Mara Probe', { moderation_status: 'pending' })]);
    await zeigen();
    expect(kennzahlen()).toEqual(['Beiträge: 3', 'Teilnehmende: 2', 'Warten auf Freigabe: 1', 'Laufzeit: Noch 9 Tage']);
    expect(screen.getByRole('group', { name: 'Warten auf Freigabe: 1' })).toHaveClass('web-kachel--achtung');
    cleanup();
    antworten(LAUFEND, [beitrag(1, 31, 'Lena Beispiel')]);
    await zeigen();
    expect(screen.getByRole('group', { name: 'Warten auf Freigabe: 0' })).not.toHaveClass('web-kachel--achtung');
  });

  it('ohne Freigabe-Pflicht keine Kachel fuer wartende Beitraege', async () => {
    antworten({ ...LAUFEND, moderated: false });
    await zeigen();
    expect(kennzahlen()).toEqual(['Beiträge: 6', 'Teilnehmende: 6', 'Laufzeit: Noch 9 Tage']);
  });

  it('die Laufzeit nennt den Zustand: Entwurf, Geplant mit Beginn, Beendet mit Datum', async () => {
    antworten({ ...LAUFEND, is_draft: true });
    await zeigen();
    expect(screen.getByRole('group', { name: 'Laufzeit: Entwurf' })).toHaveTextContent('Zeitraum noch offen');
    cleanup();
    antworten({ ...LAUFEND, starts_at: tage(3), ends_at: tage(10) });
    await zeigen();
    expect(screen.getByRole('group', { name: 'Laufzeit: Geplant' })).toHaveTextContent('Beginnt am 06.10.2026');
    cleanup();
    antworten({ ...LAUFEND, starts_at: tage(-30), ends_at: tage(-10) });
    await zeigen();
    expect(screen.getByRole('group', { name: 'Laufzeit: Beendet' })).toHaveTextContent('am 23.09.2026');
  });

  it('ohne Beitraege (offline, kein Stand): Striche statt falscher Nullen', async () => {
    h.apiGet.mockImplementation(async (route: string) => {
      if (route === '/challenges/admin/7') return { data: LAUFEND };
      throw netzWeg;
    });
    oeffne();
    await screen.findByText('Die Liste der Beiträge ist offline nicht verfügbar.');
    expect(kennzahlen()).toEqual(['Beiträge: –', 'Teilnehmende: –', 'Warten auf Freigabe: –', 'Laufzeit: Noch 9 Tage']);
  });

  it('links der Inhalt (Aufgabe, Beitraege), rechts der Block "Angaben" mit Angaben und Stempel', async () => {
    await zeigen();
    const [haupt, seite] = [...document.querySelector('.web-spalten')!.children] as HTMLElement[];
    expect(seite.tagName).toBe('ASIDE');
    expect(seite).toHaveAttribute('aria-label', 'Angaben');
    expect(within(haupt).getByRole('region', { name: 'Worum geht es?' })).toBeInTheDocument();
    expect(within(haupt).getByRole('list', { name: 'Beiträge' })).toBeInTheDocument();
    expect(within(seite).getByRole('region', { name: 'Angaben' })).toBeInTheDocument();
    expect(within(seite).getByRole('region', { name: 'Stempel' })).toBeInTheDocument();
    expect(within(haupt).queryByRole('region', { name: 'Angaben' })).toBeNull();
  });
});

describe('Challenge fuer Team und Leitung (Web): Kopf, Aufgabe und Angaben', () => {
  it('Titel, Weg zurueck als Link zur Liste, Marken und Aufgabe', async () => {
    await zeigen();
    expect(screen.getByRole('link', { name: 'Alle Challenges' }).getAttribute('href')).toBe('/admin/challenges');
    const kopf = screen.getByRole('heading', { level: 1 }).closest('header')!;
    expect(kopf).toHaveTextContent('Läuft');
    expect(kopf).toHaveTextContent('Konfis und Team');
    expect(kopf).toHaveTextContent('28.09. – 12.10.2026');
    expect(screen.getByRole('region', { name: 'Worum geht es?' })).toHaveTextContent('Schreibt eine Bitte in einem Satz.');
    expect(screen.getByRole('region', { name: 'Worum geht es?' })).toHaveTextContent('Gestellt von Pastorin Beispiel');
    // Der Weg zurueck fuehrt ueber die Router-Navigation, nicht ueber einen Seitenwechsel des Browsers.
    fireEvent.click(screen.getByRole('link', { name: 'Alle Challenges' }));
    expect(h.push).toHaveBeenCalledWith('/admin/challenges', 'none', 'push');
  });

  it('das Team kommt unter /teamer/challenges zurueck', async () => {
    h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
    await zeigen();
    expect(screen.getByRole('link', { name: 'Alle Challenges' }).getAttribute('href')).toBe('/teamer/challenges');
  });

  it('die Angaben: Status, Zeitraum mit Rest, Zielgruppe, Jahrgaenge, Sichtbarkeit, Freigabe, Antwort mit, Beitraege je Person', async () => {
    await zeigen();
    const angaben = screen.getByRole('region', { name: 'Angaben' });
    const wert = (label: string) => within(angaben).getByText(label).closest('div')!.querySelector('dd')!;
    expect(wert('Status')).toHaveTextContent('Läuft');
    expect(wert('Zeitraum')).toHaveTextContent('28.09. – 12.10.2026');
    expect(wert('Zeitraum')).toHaveTextContent('Noch 9 Tage');
    expect(wert('Zielgruppe')).toHaveTextContent('Konfis und Team');
    expect(wert('Jahrgänge')).toHaveTextContent('2026/2027, 2025/2026');
    expect(wert('Sichtbarkeit')).toHaveTextContent('Selbst entscheiden');
    expect(wert('Freigabe')).toHaveTextContent('Das Team gibt Beiträge frei');
    expect(wert('Antwort mit')).toHaveTextContent('Text, Foto');
    expect(wert('Beiträge je Person')).toHaveTextContent('Beliebig viele');
  });

  it('"Nur das Team": keine Jahrgaenge, sondern das ganze Team; "Nur Leitung" ohne Freigabe-Zeile', async () => {
    antworten({ ...LAUFEND, audience: 'nur_team', visibility: 'private', jahrgaenge: [], allow_multiple: false });
    await zeigen();
    const angaben = screen.getByRole('region', { name: 'Angaben' });
    expect(angaben).toHaveTextContent('Alle im Team der Gemeinde');
    expect(angaben).toHaveTextContent('Nur Leitung');
    expect(within(angaben).queryByText('Freigabe')).toBeNull();
    expect(angaben).toHaveTextContent('Einer');
  });

  it('der Stempel: Name und wie man ihn bekommt (mit Freigabe bzw. beim Einreichen)', async () => {
    await zeigen();
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Fürbitter:in');
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Mit der Freigabe ihres ersten Beitrags bekommt eine Person diesen Stempel.');
    cleanup();
    antworten({ ...LAUFEND, moderated: false });
    await zeigen();
    expect(screen.getByRole('region', { name: 'Stempel' })).toHaveTextContent('Wer einen Beitrag einreicht, bekommt diesen Stempel.');
  });

  it('beendet: "Worum ging es?", Zustand "Beendet", kein Einreichen', async () => {
    antworten({ ...LAUFEND, starts_at: tage(-30), ends_at: tage(-10) });
    await zeigen();
    expect(screen.getByRole('region', { name: 'Worum ging es?' })).toHaveTextContent('Beendet');
    expect(screen.queryByRole('button', { name: 'Beitrag einreichen' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Angaben' })).queryByText('Noch', { exact: false })).toBeNull();
  });
});

describe('Challenge fuer Team und Leitung (Web): Beitraege als Raster', () => {
  it('der Feed zeigt nur Freigegebenes, neueste zuerst; die Chips tragen die Zahlen', async () => {
    await zeigen();
    expect(namen()).toEqual(['Lena Beispiel', 'Jonas Muster', 'Alex Beispiel']);
    expect(screen.getByRole('heading', { level: 2, name: '3 Beiträge' })).toBeInTheDocument();
    expect(chip(/^Feed/)).toHaveTextContent('3');
    expect(chip(/^Wartet/)).toHaveTextContent('2');
    expect(chip(/^Abgelehnt/)).toHaveTextContent('1');
    expect(chip(/^Meins/)).toHaveTextContent('1');
    expect(chip(/^Feed/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Wartet" zeigt die wartenden mit orangem Zahlenfeld, "Abgelehnt" den Grund, "Meins" die eigenen', async () => {
    await zeigen();
    expect(chip(/^Wartet/).querySelector('.web-chip__zahl--orange')).toHaveTextContent('2');
    waehle(/^Wartet/);
    expect(namen()).toEqual(['Mara Probe', 'Ole Vorlage']);
    waehle(/^Abgelehnt/);
    expect(namen()).toEqual(['Noah Entwurf']);
    expect(beitraege()[0]).toHaveTextContent('Grund der Ablehnung');
    expect(beitraege()[0]).toHaveTextContent('Bitte ohne Namen Dritter.');
    waehle(/^Meins/);
    expect(namen()).toEqual(['Alex Beispiel']);
    expect(beitraege()[0]).toHaveTextContent('Dein Beitrag');
  });

  it('Marken: Zustand und Einwilligung, "nur Leitung" schlaegt den Haken', async () => {
    await zeigen();
    waehle(/^Wartet/);
    expect(beitraege()[0]).toHaveTextContent('Wartet auf Freigabe');
    expect(beitraege()[0]).toHaveTextContent('Mit Namen sichtbar');
    expect(beitraege()[1]).toHaveTextContent('Nur Leitung');
  });

  it('Bilder gross: der Beitrag mit Foto zeigt das Medium mit hoher Hoehe, antippen oeffnet es', async () => {
    await zeigen();
    const medium = within(beitraege()[1]).getByTestId('medium');
    expect(medium).toHaveAttribute('data-art', 'photo');
    expect(medium).toHaveAttribute('data-pfad', 'foto-abc');
    expect(medium).toHaveAttribute('data-hoehe', '420');
    fireEvent.click(within(medium).getByRole('button'));
    expect(h.dateiOeffnen).toHaveBeenCalledWith('foto-abc', 'datei.jpg');
  });

  it('ohne freigegebene Beitraege: Hinweis auf "Wartet", wenn dort etwas steht', async () => {
    antworten(LAUFEND, [beitrag(3, 33, 'Mara Probe', { moderation_status: 'pending' })]);
    oeffne();
    expect(await screen.findByText('Im Feed steht nur, was freigegeben ist. Beiträge, die noch warten, findest du unter „Wartet“.')).toBeInTheDocument();
  });

  it('ohne Freigabe-Pflicht gibt es keinen Reiter "Wartet", bei "nur Leitung" keinen "Abgelehnt"', async () => {
    antworten({ ...LAUFEND, moderated: false, visibility: 'private' }, BEITRAEGE);
    await zeigen();
    const gruppe = screen.getByRole('group', { name: 'Beiträge nach Zustand' });
    expect(within(gruppe).getAllByRole('button').map((b) => b.textContent?.replace(/\d+$/, ''))).toEqual(['Feed', 'Meins']);
  });

  it('wartet noch: Platzhalter; offline ohne Stand: sagt es, statt "keine Beitraege" zu behaupten', async () => {
    h.apiGet.mockImplementation(async (route: string) => {
      if (route === '/challenges/admin/7') return { data: LAUFEND };
      throw netzWeg;
    });
    oeffne();
    expect(await screen.findByText('Die Liste der Beiträge ist offline nicht verfügbar.')).toBeInTheDocument();
    expect(screen.queryByText('Keine Beiträge')).toBeNull();
  });
});

describe('Challenge fuer Team und Leitung (Web): Moderation ueber dieselben Funktionen wie die App', () => {
  it('Freigeben: PUT approve, die Zahl am Reiter geht sofort mit, Zaehler und Liste werden nachgezogen', async () => {
    await zeigen();
    waehle(/^Wartet/);
    // Ab jetzt haengt das Nachladen: Die Zahl darf sich nur durch die Aktion selbst aendern.
    h.apiGet.mockImplementation(() => new Promise(() => undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben: Mara Probe' }));
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/3/moderate', { action: 'approve' }));
    await waitFor(() => expect(chip(/^Wartet/)).toHaveTextContent('1'));
    await waitFor(() => expect(h.refreshAllCounts).toHaveBeenCalled());
  });

  it('Ausblenden fragt in einem Dialog nach dem Grund und schickt ihn mit', async () => {
    await zeigen();
    waehle(/^Wartet/);
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden: Mara Probe' }));
    const dialog = screen.getByRole('dialog', { name: 'Beitrag ausblenden' });
    expect(dialog).toHaveTextContent('Der Beitrag von Mara Probe wird für die Gruppe nicht mehr sichtbar sein.');
    fireEvent.change(within(dialog).getByLabelText('Begründung (optional)'), { target: { value: '  Passt nicht zur Aufgabe  ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ausblenden' }));
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/3/moderate', { action: 'hide', reason: 'Passt nicht zur Aufgabe' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Ausblenden ohne Grund scheitert nie am fehlenden Grund; Abbrechen und Escape senden nichts', async () => {
    await zeigen();
    waehle(/^Wartet/);
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden: Mara Probe' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden: Mara Probe' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ausblenden: Mara Probe' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ausblenden' }));
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/3/moderate', { action: 'hide' }));
  });

  it('Anonym stellen und Endgueltig loeschen fragen mit der Rueckfrage der App, erst die Bestaetigung loest aus', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Anonym stellen: Lena Beispiel' }));
    expect(h.presentAlert).toHaveBeenCalledWith(expect.objectContaining({ header: 'Beitrag anonym stellen' }));
    expect(h.apiPut).not.toHaveBeenCalled();
    const anonym = h.presentAlert.mock.calls[0][0].buttons.find((b: { text: string }) => b.text === 'Anonym stellen');
    anonym.handler();
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/1/moderate', { action: 'anonymize' }));

    h.presentAlert.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen: Lena Beispiel' }));
    expect(h.presentAlert).toHaveBeenCalledWith(expect.objectContaining({ header: 'Beitrag wirklich löschen?' }));
    expect(h.apiDelete).not.toHaveBeenCalled();
    h.presentAlert.mock.calls[0][0].buttons.find((b: { text: string }) => b.text === 'Endgültig löschen').handler();
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/challenges/admin/submissions/1'));
  });

  it('Wieder einblenden steht nur bei Ausgeblendetem', async () => {
    await zeigen();
    expect(screen.queryByRole('button', { name: /^Wieder einblenden/ })).toBeNull();
    waehle(/^Abgelehnt/);
    fireEvent.click(screen.getByRole('button', { name: 'Wieder einblenden: Noah Entwurf' }));
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/challenges/admin/submissions/5/moderate', { action: 'unhide' }));
  });

  it('Rechte wie in der App: Endgueltig loeschen nur die Leitung; den eigenen Beitrag blendet niemand aus', async () => {
    await zeigen();
    expect(screen.getAllByRole('button', { name: /^Endgültig löschen:/ })).toHaveLength(3);
    // Der eigene Beitrag (Alex Beispiel, id 4): anonym stellen und loeschen ja, ausblenden nein.
    expect(screen.queryByRole('button', { name: 'Ausblenden: Alex Beispiel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ausblenden: Lena Beispiel' })).toBeInTheDocument();
    cleanup();
    h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
    await zeigen();
    expect(screen.queryByRole('button', { name: /^Endgültig löschen:/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ausblenden: Lena Beispiel' })).toBeInTheDocument();
  });

  it('bei "nur Leitung" gibt es nichts auszublenden', async () => {
    antworten({ ...LAUFEND, visibility: 'private', moderated: false });
    await zeigen();
    expect(screen.queryByRole('button', { name: /^Ausblenden:/ })).toBeNull();
  });

  it('ein Fehler der Moderation geht an die Meldung der App, nicht ins Leere', async () => {
    h.apiPut.mockRejectedValue(fehlerMitStatus(500));
    await zeigen();
    waehle(/^Wartet/);
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben: Mara Probe' }));
    await waitFor(() => expect(h.setError).toHaveBeenCalled());
  });
});

describe('Challenge fuer Team und Leitung (Web): Aktionen', () => {
  it('Bearbeiten oeffnet das Formular der App mit dieser Challenge', async () => {
    await zeigen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Challenge bearbeiten' }));
    expect(h.bearbeiten).toHaveBeenCalledWith(expect.objectContaining({ id: 7, title: 'Fürbitten zum Erntedank' }));
  });

  it('Beitrag einreichen oeffnet das Einreich-Formular der App, solange die Challenge laeuft', async () => {
    await zeigen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Beitrag einreichen' }));
    expect(h.presentModal).toHaveBeenCalledTimes(1);
  });

  it('einmal pro Person: nach dem eigenen Beitrag kein Einreichen mehr', async () => {
    antworten({ ...LAUFEND, allow_multiple: false });
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Beitrag einreichen' })).toBeNull();
  });

  it('Entwurf und geplante Challenge lassen sich nicht bespielen', async () => {
    antworten({ ...LAUFEND, is_draft: true });
    await zeigen();
    expect(screen.queryByRole('button', { name: 'Beitrag einreichen' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Angaben' })).toHaveTextContent('Zeitraum noch offen');
    expect(screen.getByRole('region', { name: 'Worum geht es?' })).toHaveTextContent('Entwurf — noch nicht veröffentlicht');
  });

  it('Exportieren holt die Texte der Beitraege', async () => {
    h.apiGet.mockImplementation(async (route: string) => {
      if (route === '/challenges/admin/7') return { data: LAUFEND };
      if (route === '/challenges/admin/7/submissions') return { data: { challenge: LAUFEND, submissions: BEITRAEGE } };
      if (route === '/challenges/admin/7/export') return { data: '' };
      throw new Error(`unerwartet: ${route}`);
    });
    await zeigen();
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Beiträge exportieren' }));
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/challenges/admin/7/export', { responseType: 'text' }));
    // Ohne Texte sagt die Seite es, statt eine leere Datei zu laden.
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Es gibt noch keine Texte oder Links zum Exportieren.'));
  });
});

describe('Challenge fuer Team und Leitung (Web): neue Beitraege seit dem letzten Oeffnen', () => {
  it('der Hinweis nennt die Zahl, die beim Oeffnen noch rot an der Karte stand, mit dem Satz der App', async () => {
    h.zaehler.challengeNeueBeitraegeByChallenge = { 7: 4 };
    h.zaehler.challengeNeueWartendByChallenge = { 7: 3 };
    await zeigen();
    const hinweis = screen.getByRole('status');
    expect(hinweis).toHaveTextContent('Seit deinem letzten Besuch');
    expect(hinweis).toHaveTextContent('4 neue Beiträge, davon warten 3 auf Freigabe');
  });

  it('das Gelesen-Melden aendert den Hinweis nicht: Er haelt den Stand von beim Oeffnen', async () => {
    h.zaehler.challengeNeueBeitraegeByChallenge = { 7: 2 };
    const r = await zeigen();
    h.zaehler = { ...h.zaehler, challengeNeueBeitraegeByChallenge: { 7: 0 } };
    r.rerender(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 neue Beiträge');
    await waitFor(() => expect(h.markChallengeAsRead).toHaveBeenCalledWith(7));
  });

  it('nichts Neues: kein Hinweis', async () => {
    await zeigen();
    expect(screen.queryByText('Seit deinem letzten Besuch')).toBeNull();
  });

  it('beim Aufgehen und beim Verlassen als gelesen gemeldet, Entwuerfe nie', async () => {
    const { unmount } = await zeigen();
    await waitFor(() => expect(h.markChallengeAsRead).toHaveBeenCalledTimes(1));
    expect(h.markChallengeAsRead).toHaveBeenCalledWith(7);
    unmount();
    await waitFor(() => expect(h.markChallengeAsRead).toHaveBeenCalledTimes(2));
    cleanup();
    h.markChallengeAsRead.mockClear();
    antworten({ ...LAUFEND, is_draft: true });
    const entwurf = await zeigen();
    entwurf.unmount();
    await new Promise((r) => setTimeout(r, 30));
    expect(h.markChallengeAsRead).not.toHaveBeenCalled();
  });
});

describe('Challenge fuer Team und Leitung (Web): laedt, gibt es nicht, offline', () => {
  it('waehrend des Ladens Platzhalter, danach die Challenge', async () => {
    h.apiGet.mockReturnValue(new Promise(() => undefined));
    oeffne();
    expect(screen.getByRole('status')).toHaveTextContent('Challenge wird geladen...');
    expect(screen.getByRole('heading', { level: 1, name: 'Challenge' })).toBeInTheDocument();
  });

  it('geloescht oder fremde Gemeinde (404): freundlicher Hinweis mit Weg zur Liste', async () => {
    h.apiGet.mockRejectedValue(fehlerMitStatus(404));
    const { onBack } = oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Diese Challenge gibt es nicht mehr' })).toBeInTheDocument();
    expect(h.setError).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zu den Challenges' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(h.markChallengeAsRead).not.toHaveBeenCalled();
  });

  it('nicht zugewiesener Jahrgang (403): nennt den Grund', async () => {
    h.apiGet.mockRejectedValue(fehlerMitStatus(403));
    oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Nicht deinem Jahrgang zugeordnet' })).toBeInTheDocument();
  });

  it('ohne Netz und ohne Stand: sagt, dass es eine Verbindung braucht, mit erneutem Versuch', async () => {
    h.apiGet.mockRejectedValue(netzWeg);
    oeffne();
    expect(await screen.findByRole('heading', { level: 3, name: 'Keine Verbindung' })).toBeInTheDocument();
    h.apiGet.mockClear();
    antworten();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Fürbitten zum Erntedank' })).toBeInTheDocument();
  });

  it('ohne Netz aus der Leitungsliste bekannt: die Challenge aus dem Speicher der Liste', async () => {
    await offlineCache.set('admin:challenges:1', [LAUFEND], 60_000);
    h.apiGet.mockRejectedValue(netzWeg);
    oeffne();
    expect(await screen.findByRole('heading', { level: 1, name: 'Fürbitten zum Erntedank' })).toBeInTheDocument();
  });

  // Der Rahmen bleibt beim Wechsel von "laedt" zur Challenge derselbe: Baute er sich neu auf,
  // verschwaende Ionics IonContent mitten im Messen (TypeError in readDimensions, an
  // Seiten der Web-Fassung gemessen). Und die IonPage bleibt eine (keinTauschImOutlet).
  it('vom Laden zur Challenge bleibt derselbe IonContent und dieselbe IonPage', async () => {
    let antwort: (v: unknown) => void = () => undefined;
    h.apiGet.mockImplementation((route: string) => (route === '/challenges/admin/7'
      ? new Promise((r) => { antwort = r; })
      : Promise.resolve({ data: { challenge: LAUFEND, submissions: [] } })));
    const { container } = oeffne();
    const inhaltVorher = container.querySelector('ion-content');
    const seiteVorher = container.querySelector('.ion-page');
    expect(inhaltVorher).not.toBeNull();
    antwort({ data: LAUFEND });
    await screen.findByRole('heading', { level: 1, name: 'Fürbitten zum Erntedank' });
    expect(container.querySelectorAll('ion-content')).toHaveLength(1);
    expect(container.querySelector('ion-content')).toBe(inhaltVorher);
    expect(container.querySelectorAll('.ion-page')).toHaveLength(1);
    expect(container.querySelector('.ion-page')).toBe(seiteVorher);
  });

  it('vom Laden zum Hinweis ebenso', async () => {
    let ablehnen: (e: unknown) => void = () => undefined;
    h.apiGet.mockReturnValue(new Promise((_r, j) => { ablehnen = j; }));
    const { container } = oeffne();
    const inhaltVorher = container.querySelector('ion-content');
    ablehnen(fehlerMitStatus(404));
    await screen.findByRole('heading', { level: 3, name: 'Diese Challenge gibt es nicht mehr' });
    expect(container.querySelector('ion-content')).toBe(inhaltVorher);
    expect(container.querySelectorAll('.ion-page')).toHaveLength(1);
  });
});

describe('Challenge fuer Team und Leitung: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Ansicht der App, ohne Web-Klassen', async () => {
    h.breit = false;
    const { container } = oeffne();
    await waitFor(() => expect(container.textContent).toContain('Fürbitten zum Erntedank'));
    await waitFor(() => expect(container.querySelector('.app-list-item--challenges')).not.toBeNull());
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-beitraege')).toBeNull();
  });

  it('im breiten Fenster stehen weder Listenelemente noch Segmente der App', async () => {
    const { container } = await zeigen();
    expect(container.querySelector('.app-list-item')).toBeNull();
    expect(container.querySelector('ion-segment, ion-item, ion-card, ion-list')).toBeNull();
  });
});

// Recht "Challenge-Beiträge freigeben" (09.10.2026, docs/planung/darf-freigeben.md):
// GET /challenges/admin/:id liefert `darf_freigeben`. Bei false bleibt alles
// lesbar, aber Freigeben, Ausblenden, Wieder einblenden und Anonym stellen
// fehlen (der Server antwortet 403); Endgueltig loeschen ist eine eigene Route
// und bleibt der Leitung. Fehlt das Feld, gilt es als an.
describe('Recht "Challenge-Beiträge freigeben"', () => {
  const HINWEIS = 'Bei dieser Challenge gibt jemand anderes die Beiträge frei. Das Recht vergibt die Gemeindeleitung.';
  const MODERATION = /^(Freigeben|Ausblenden|Wieder einblenden|Anonym stellen):/;

  it('VERBOTEN (false): in keinem Reiter ein Knopf der Moderation, dafür der Grund; Beiträge bleiben lesbar', async () => {
    antworten({ ...LAUFEND, darf_freigeben: false });
    await zeigen();
    expect(screen.getByText(HINWEIS)).toBeInTheDocument();
    for (const reiter of [/^Feed/, /^Wartet/, /^Abgelehnt/]) {
      waehle(reiter);
      expect(screen.queryAllByRole('button', { name: MODERATION })).toEqual([]);
    }
    waehle(/^Wartet/);
    expect(namen()).toEqual(['Mara Probe', 'Ole Vorlage']);
    // Loeschen haengt nicht an diesem Recht.
    expect(screen.getAllByRole('button', { name: /^Endgültig löschen:/ })).toHaveLength(2);
  });

  it.each([
    ['ERLAUBT (true)', { darf_freigeben: true }],
    ['älterer Server ohne das Feld', {}],
  ])('%s: Freigeben, Ausblenden und Wieder einblenden wie bisher, kein Hinweis', async (_name, zusatz) => {
    antworten({ ...LAUFEND, ...zusatz });
    await zeigen();
    expect(screen.queryByText(HINWEIS)).toBe(null);
    waehle(/^Wartet/);
    expect(screen.getByRole('button', { name: 'Freigeben: Mara Probe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ausblenden: Mara Probe' })).toBeInTheDocument();
    waehle(/^Abgelehnt/);
    expect(screen.getByRole('button', { name: 'Wieder einblenden: Noah Entwurf' })).toBeInTheDocument();
  });

  it('App (schmales Fenster): derselbe Grund über der Liste; mit Recht nicht', async () => {
    h.breit = false;
    antworten({ ...LAUFEND, darf_freigeben: false });
    const erste = oeffne();
    await waitFor(() => expect(erste.container.querySelector('.app-list-item--challenges')).not.toBeNull());
    expect(erste.container.textContent).toContain(HINWEIS);
    erste.unmount();
    antworten({ ...LAUFEND, darf_freigeben: true });
    const zweite = oeffne();
    await waitFor(() => expect(zweite.container.querySelector('.app-list-item--challenges')).not.toBeNull());
    expect(zweite.container.textContent).not.toContain(HINWEIS);
  });
});
