// Die Challenges von Team und Leitung in der Web-Fassung, gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Karten im Raster mit
// Stempel als Bild, Status, Zeitraum, Zielgruppe, roter Zahl der neuen
// Beitraege und orangem Feld fuer Wartendes; Filter, Zielgruppe, Jahrgang,
// Suche; "Neue Challenge", Bearbeiten und Loeschen ueber dieselben
// Funktionen wie die App. Dazu die Ansicht Liste | Kacheln (Simon,
// 06.10.2026): dieselben Challenges als Tabelle, Umschalter neben der Suche,
// Wahl im Browser gemerkt, Vorgabe nach Rolle. Im schmalen Fenster bleibt die
// Liste der App.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, cleanup, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  push: vi.fn(),
  anlegen: vi.fn(),
  bearbeiten: vi.fn(),
  handleDelete: vi.fn(),
  apiGet: vi.fn(),
  liste: [] as unknown[],
  bewahrt: [] as unknown[],
  user: { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
  zaehler: {
    pendingChallengesByChallenge: {} as Record<number, number>,
    challengeUpdatesByChallenge: {} as Record<number, number>,
    challengeNeueBeitraegeByChallenge: {} as Record<number, number> | null,
    challengeNeueWartendByChallenge: {} as Record<number, number>,
  },
  holeListe: false,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: h.push }),
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => h.zaehler }));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../hooks/useChallengeFormular', () => ({ useChallengeFormular: () => ({ anlegen: h.anlegen, bearbeiten: h.bearbeiten }) }));
vi.mock('../../../hooks/useChallengeDelete', () => ({ useChallengeDelete: () => ({ handleDelete: h.handleDelete }) }));
// Die Liste kommt aus dem Hook; der Abruf selbst (Header "kein Jahrgang") laeuft einmal mit.
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string, holen: () => Promise<unknown>) => {
    if (h.holeListe && !schluessel.startsWith('challenges:bewahrte-stempel')) {
      h.holeListe = false;
      void holen();
    }
    return {
      data: schluessel.startsWith('challenges:bewahrte-stempel') ? h.bewahrt : h.liste,
      loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn(),
    };
  },
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header data-testid="kopfzeile">{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import AdminChallengesPage from '../../../components/admin/pages/AdminChallengesPage';
import TeamerChallengesPage from '../../../components/teamer/pages/TeamerChallengesPage';
import { ansichtSchluessel } from '../../../components/web/useAnsicht';

const JETZT = new Date('2026-10-03T08:30:00Z').getTime();
const tage = (n: number) => new Date(JETZT + n * 24 * 3600 * 1000).toISOString();

const challenge = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Challenge ${id}`,
  description: `Aufgabe ${id}`,
  challenge_type: 'frei',
  audience: 'konfis_und_team',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: `Stempel ${id}`,
  starts_at: tage(-5),
  ends_at: tage(9),
  is_draft: false,
  jahrgaenge: [{ id: 1, name: '2026/2027' }],
  submission_count: 0,
  pending_count: 0,
  own_submission_count: 0,
  has_badge: false,
  status: 'active',
  ...extra,
});

const FUERBITTEN = challenge(11, {
  title: 'Fürbitten zum Erntedank', description: 'Schreibt eine Bitte für den Gottesdienst', badge_name: 'Fürbitter:in', badge_icon: 'heart',
  submission_count: 7, author_freetext: 'Pastorin Beispiel', jahrgaenge: [{ id: 1, name: '2026/2027' }, { id: 2, name: '2025/2026' }],
});
const LIEBLINGSPLATZ = challenge(12, {
  title: 'Mein Lieblingsplatz', description: 'Ein Foto von der Kirche', badge_name: 'Fotograf:in', badge_icon: 'camera', audience: 'konfis',
  visibility: 'public', moderated: false, submission_count: 6, own_submission_count: 1, has_badge: true, earned_at: tage(-3), starts_at: tage(-8), ends_at: tage(6),
});
const TEAMRUNDE = challenge(14, { title: 'Team-Runde Camp', description: 'Ideen fürs Camp', audience: 'nur_team', visibility: 'private', jahrgaenge: [], submission_count: 4 });
const ENTWURF = challenge(15, { title: 'Bibelvers des Monats', is_draft: true, status: 'draft', starts_at: tage(20), ends_at: tage(34), badge_name: 'Versfinder:in' });
const GEPLANT = challenge(16, { title: 'Weihnachtskarten', status: 'scheduled', starts_at: tage(38), ends_at: tage(60), badge_name: 'Kartenkünstler:in' });
const BEENDET = challenge(17, { title: 'Sommerrückblick', status: 'ended', starts_at: tage(-75), ends_at: tage(-50), badge_name: 'Sommerkind', submission_count: 24 });
const ALLE = [BEENDET, GEPLANT, FUERBITTEN, ENTWURF, LIEBLINGSPLATZ, TEAMRUNDE];

// Nur die Karten des Rasters, nicht die Listen der Angaben darin.
const karten = () => [...screen.getByRole('list', { name: 'Challenges' }).children] as HTMLElement[];
const titel = () => karten().map((k) => within(k).getByRole('heading', { level: 3 }).textContent);
// Die Chips des Zustands -- "Alle" gibt es auch bei der Zielgruppe.
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Challenges nach Zustand' })).getByRole('button', { name });
const waehle = (name: RegExp | string) => fireEvent.click(chip(name));
const zeigen = (seite: React.ReactElement = <AdminChallengesPage />) => render(seite);

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.liste = ALLE;
  h.bewahrt = [];
  h.user = { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' };
  h.zaehler = {
    pendingChallengesByChallenge: {},
    challengeUpdatesByChallenge: {},
    challengeNeueBeitraegeByChallenge: {},
    challengeNeueWartendByChallenge: {},
  };
  h.holeListe = false;
  // Die Karten-Tests unten setzen "Kacheln" als gemerkte Wahl voraus: Die Leitung
  // startet sonst mit der Liste (Block "Ansicht Liste | Kacheln" weiter unten).
  window.localStorage.clear();
  window.localStorage.setItem(ansichtSchluessel('challenges-leitung'), 'kacheln');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(JETZT));
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });

describe('Challenges (Web, Team und Leitung): Karten im Raster', () => {
  it('zeigt, was laeuft, als Karten mit Titel als Link auf die Seite der Challenge', () => {
    zeigen();
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeInTheDocument();
    expect(titel().sort()).toEqual(['Fürbitten zum Erntedank', 'Mein Lieblingsplatz', 'Team-Runde Camp']);
    const link = within(karten()[0]).getByRole('link');
    expect(link.getAttribute('href')).toMatch(/^\/admin\/challenges\/(11|12|14)$/);
    // Echter Link: ein einfacher Klick bleibt in der App, ohne Seitenwechsel des Browsers.
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith(link.getAttribute('href'), 'none', 'push');
  });

  it('das Team oeffnet die Challenge unter /teamer/challenges/<id>', () => {
    h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
    zeigen(<TeamerChallengesPage />);
    const karte = karten().find((k) => k.textContent?.includes('Fürbitten zum Erntedank'))!;
    expect(within(karte).getByRole('link').getAttribute('href')).toBe('/teamer/challenges/11');
  });

  it('die Karte nennt Stempel, Status, Zeitraum, Rest, Beitraege, Sichtbarkeit, Zielgruppe, Jahrgaenge und Urheber:in', () => {
    zeigen();
    const karte = karten().find((k) => k.textContent?.includes('Fürbitten zum Erntedank'))!;
    expect(karte).toHaveTextContent('Stempel');
    expect(karte).toHaveTextContent('Fürbitter:in');
    expect(karte).toHaveTextContent('Läuft');
    expect(karte).toHaveTextContent('28.09. – 12.10.2026 · Noch 9 Tage');
    expect(karte).toHaveTextContent('7 Beiträge · Selbst entscheiden');
    expect(karte).toHaveTextContent('Konfis und Team · 2026/2027, 2025/2026');
    expect(karte).toHaveTextContent('Gestellt von Pastorin Beispiel');
    expect(karte).toHaveTextContent('Schreibt eine Bitte für den Gottesdienst');
  });

  it('Einzahl: ein einzelner Beitrag heisst "1 Beitrag"', () => {
    h.liste = [challenge(21, { title: 'Einer', submission_count: 1 })];
    zeigen();
    expect(karten()[0]).toHaveTextContent('1 Beitrag · Selbst entscheiden');
  });

  it('"Du hast eingereicht" nur, wo die eigene Einreichung gezaehlt ist (auch unmoderiert)', () => {
    zeigen();
    const mit = karten().find((k) => k.textContent?.includes('Mein Lieblingsplatz'))!;
    const ohne = karten().find((k) => k.textContent?.includes('Fürbitten zum Erntedank'))!;
    expect(mit).toHaveTextContent('Du hast eingereicht');
    expect(ohne).not.toHaveTextContent('Du hast eingereicht');
  });

  it('Entwurf: "Zeitraum noch offen" statt eines Datums, Marke "Entwurf"', () => {
    zeigen();
    waehle(/^Geplant/);
    const karte = karten().find((k) => k.textContent?.includes('Bibelvers des Monats'))!;
    expect(karte).toHaveTextContent('Entwurf');
    expect(karte).toHaveTextContent('Zeitraum noch offen');
    expect(karte).not.toHaveTextContent('Noch ');
  });
});

describe('Challenges (Web): rote und orange Zahl wie in der App', () => {
  it('die rote Zahl am Stempel: neue Beitraege seit dem Oeffnen, auch wartende, mit dem Satz der App', () => {
    h.zaehler.pendingChallengesByChallenge = { 11: 3 };
    h.zaehler.challengeNeueBeitraegeByChallenge = { 11: 4, 12: 1 };
    h.zaehler.challengeNeueWartendByChallenge = { 11: 3 };
    zeigen();
    expect(screen.getByRole('img', { name: '4 neue Beiträge, davon warten 3 auf Freigabe' })).toHaveTextContent('4');
    expect(screen.getByRole('img', { name: '1 neuer Beitrag' })).toHaveTextContent('1');
    // Challenge 14 hat nichts Neues: keine Zahl.
    const ruhig = karten().find((k) => k.textContent?.includes('Team-Runde Camp'))!;
    expect(within(ruhig).queryByRole('img', { name: /neue/ })).toBeNull();
  });

  it('ab 10 steht 9+ wie in der App', () => {
    h.zaehler.challengeNeueBeitraegeByChallenge = { 11: 12 };
    zeigen();
    expect(screen.getByRole('img', { name: '12 neue Beiträge' })).toHaveTextContent('9+');
  });

  it('ohne das Feld des Servers: wartende Freigaben plus neue freigegebene', () => {
    h.zaehler.challengeNeueBeitraegeByChallenge = null;
    h.zaehler.pendingChallengesByChallenge = { 11: 2 };
    h.zaehler.challengeUpdatesByChallenge = { 11: 3 };
    zeigen();
    expect(screen.getByRole('img', { name: '5 offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge' })).toHaveTextContent('5');
  });

  it('das orange Feld: wartende Beitraege in ganzen Worten, auch ohne neue', () => {
    h.zaehler.pendingChallengesByChallenge = { 11: 3, 12: 1 };
    zeigen();
    const eine = karten().find((k) => k.textContent?.includes('Mein Lieblingsplatz'))!;
    const mehrere = karten().find((k) => k.textContent?.includes('Fürbitten zum Erntedank'))!;
    expect(eine).toHaveTextContent('1 Beitrag wartet auf Freigabe');
    expect(mehrere).toHaveTextContent('3 Beiträge warten auf Freigabe');
  });

  it('der Kopf nennt die Summe der wartenden Beitraege', () => {
    h.zaehler.pendingChallengesByChallenge = { 11: 3, 12: 1 };
    zeigen();
    expect(screen.getByText(/6 Challenges · 3 laufen gerade · 4 Beiträge warten auf Freigabe/)).toBeInTheDocument();
  });
});

describe('Challenges (Web): Filter, Zielgruppe, Jahrgang und Suche', () => {
  it('Laufend ist voreingestellt; die Chips tragen die Zahl je Zustand', () => {
    zeigen();
    expect(chip(/^Laufend/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Laufend/)).toHaveTextContent('3');
    expect(chip(/^Geplant/)).toHaveTextContent('2');
    expect(chip(/^Beendet/)).toHaveTextContent('1');
    expect(chip(/^Alle/)).toHaveTextContent('6');
    expect(titel()).toHaveLength(3);
  });

  it('Geplant zeigt Entwuerfe und kommende, Beendet das Archiv, Alle alles', () => {
    zeigen();
    waehle(/^Geplant/);
    expect(titel().sort()).toEqual(['Bibelvers des Monats', 'Weihnachtskarten']);
    waehle(/^Beendet/);
    expect(titel()).toEqual(['Sommerrückblick']);
    waehle(/^Alle/);
    expect(titel()).toHaveLength(6);
  });

  it('"Wartet auf Freigabe": orange Zahl der Beitraege, zeigt nur Challenges mit Wartendem -- auch beendete', () => {
    h.zaehler.pendingChallengesByChallenge = { 11: 3, 17: 1 };
    zeigen();
    const wartet = chip(/^Wartet auf Freigabe/);
    expect(wartet).toHaveTextContent('4');
    expect(wartet.querySelector('.web-chip__zahl--orange')).not.toBeNull();
    fireEvent.click(wartet);
    expect(titel().sort()).toEqual(['Fürbitten zum Erntedank', 'Sommerrückblick']);
  });

  it('die Zielgruppe filtert; die Reihe steht nur, wenn es mehr als eine gibt', () => {
    zeigen();
    waehle(/^Alle/);
    const gruppe = screen.getByRole('group', { name: 'Zielgruppe' });
    expect(within(gruppe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Alle', 'Nur Konfis', 'Konfis und Team', 'Nur Team']);
    fireEvent.click(within(gruppe).getByRole('button', { name: 'Nur Team' }));
    expect(titel()).toEqual(['Team-Runde Camp']);
    fireEvent.click(within(gruppe).getByRole('button', { name: 'Nur Konfis' }));
    expect(titel()).toEqual(['Mein Lieblingsplatz']);
  });

  it('mit nur einer Zielgruppe und einem Jahrgang gibt es weder Reihe noch Auswahl', () => {
    h.liste = [challenge(31), challenge(32)];
    zeigen();
    expect(screen.queryByRole('group', { name: 'Zielgruppe' })).toBeNull();
    expect(screen.queryByLabelText('Jahrgang')).toBeNull();
  });

  it('der Jahrgang filtert die Challenges, die ihm zugeordnet sind', () => {
    zeigen();
    waehle(/^Alle/);
    fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: '2' } });
    expect(titel()).toEqual(['Fürbitten zum Erntedank']);
  });

  it('die Suche trifft Titel, Aufgabe und Stempel, hebt den Treffer hervor und folgt den Zaehlern', () => {
    zeigen();
    waehle(/^Alle/);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }), { target: { value: 'fuerbitt' } });
    expect(titel()).toEqual(['Fürbitten zum Erntedank']);
    expect(karten()[0].querySelector('mark')).toHaveTextContent('Fürbitt');
    expect(chip(/^Alle/)).toHaveTextContent('1');
    expect(chip(/^Beendet/)).toHaveTextContent('0');
    // Stempelname
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fotograf' } });
    expect(titel()).toEqual(['Mein Lieblingsplatz']);
  });

  it('ohne Treffer: eigener Zustand mit Weg zurueck; Escape leert die Suche', () => {
    zeigen();
    waehle(/^Alle/);
    const suche = screen.getByRole('searchbox');
    fireEvent.change(suche, { target: { value: 'gibtsnicht' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Keine Treffer' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl zurücksetzen' }));
    expect(titel()).toHaveLength(6);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } });
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});

describe('Challenges (Web): Aktionen ueber dieselben Funktionen wie die App', () => {
  it('"Neue Challenge" oeffnet das Formular der App', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Challenge' }));
    expect(h.anlegen).toHaveBeenCalledTimes(1);
  });

  it('Bearbeiten reicht die Challenge an das Formular, Loeschen an die Rueckfrage der App', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Fürbitten zum Erntedank' }));
    expect(h.bearbeiten).toHaveBeenCalledWith(expect.objectContaining({ id: 11, title: 'Fürbitten zum Erntedank' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen: Mein Lieblingsplatz' }));
    expect(h.handleDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
  });

  it('Loeschen steht nur bei der Leitung: das Team bearbeitet und moderiert, loescht nicht', () => {
    zeigen();
    expect(screen.getAllByRole('button', { name: /^Löschen:/ })).toHaveLength(3);
    cleanup();
    h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
    zeigen(<TeamerChallengesPage />);
    expect(screen.queryByRole('button', { name: /^Löschen:/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Bearbeiten:/ })).toHaveLength(3);
  });

  it('der Knopf im Fuss ist kein Teil des Kartenlinks: Klick auf Bearbeiten oeffnet nicht die Seite', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Fürbitten zum Erntedank' }));
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('Challenges (Web): die Uhr', () => {
  // Laufend, geplant und beendet folgen der Uhr, auch bei offener Seite (useJetztMitGrenzen):
  // Die Challenge endet 1,2 s nach dem Oeffnen und wandert von "Laufend" nach "Beendet".
  it('endet eine Challenge bei offener Liste, wandert sie ohne neuen Abruf von Laufend nach Beendet', async () => {
    vi.useRealTimers();
    h.liste = [challenge(51, { title: 'Endet gleich', starts_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), ends_at: new Date(Date.now() + 1200).toISOString() })];
    zeigen();
    expect(titel()).toEqual(['Endet gleich']);
    expect(chip(/^Laufend/)).toHaveTextContent('1');
    expect(chip(/^Beendet/)).toHaveTextContent('0');
    await waitFor(() => expect(chip(/^Beendet/)).toHaveTextContent('1'), { timeout: 4000 });
    expect(chip(/^Laufend/)).toHaveTextContent('0');
    expect(screen.getByRole('heading', { level: 3, name: 'Gerade läuft keine Challenge' })).toBeInTheDocument();
    fireEvent.click(chip(/^Beendet/));
    expect(titel()).toEqual(['Endet gleich']);
  });
});

describe('Challenges (Web): leere Zustaende, Stempel und Laden', () => {
  it('ohne Challenges: erklaert und bietet "Neue Challenge" an', () => {
    h.liste = [];
    zeigen();
    expect(screen.getByRole('heading', { level: 3, name: 'Gerade läuft keine Challenge' })).toBeInTheDocument();
    expect(screen.getByText('Lege eine Challenge an, damit deine Konfis eigene Beiträge einreichen können')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Neue Challenge' })[1]);
    expect(h.anlegen).toHaveBeenCalledTimes(1);
  });

  it('ohne zugewiesenen Jahrgang nennt der Zustand den Grund, wortgleich mit der App', async () => {
    h.liste = [];
    h.holeListe = true;
    h.apiGet.mockResolvedValue({ data: [], headers: { 'x-kein-jahrgang-zugewiesen': 'true' } });
    await act(async () => { zeigen(); });
    expect(screen.getByRole('heading', { level: 3, name: 'Kein Jahrgang zugewiesen' })).toBeInTheDocument();
    expect(screen.getByText('Dir ist noch kein Jahrgang zugewiesen, deshalb siehst du hier keine Challenges. Die Gemeindeleitung kann das in den Einstellungen ändern.')).toBeInTheDocument();
    expect(screen.queryByText('Gerade läuft keine Challenge')).toBeNull();
  });

  it('jeder Filter hat seinen Leerzustand', () => {
    h.liste = [FUERBITTEN];
    zeigen();
    waehle(/^Geplant/);
    expect(screen.getByRole('heading', { level: 3, name: 'Nichts in Planung' })).toBeInTheDocument();
    waehle(/^Beendet/);
    expect(screen.getByRole('heading', { level: 3, name: 'Noch nichts im Archiv' })).toBeInTheDocument();
    waehle(/^Wartet auf Freigabe/);
    expect(screen.getByRole('heading', { level: 3, name: 'Nichts wartet auf Freigabe' })).toBeInTheDocument();
  });

  it('die eigenen Stempel: erhaltene mit Datum, noch zu holende grau, beendete als vorbei; die Kachel fuehrt zur Challenge', () => {
    zeigen();
    const stempel = screen.getByRole('region', { name: 'Deine Stempel' });
    expect(stempel).toHaveTextContent('1 erhalten · 3 noch zu holen');
    const foto = within(stempel).getByText('Fotograf:in').closest('li')!;
    expect(foto).toHaveTextContent('Erhalten am 30.09.2026');
    expect(within(foto).getByRole('link', { name: 'Mein Lieblingsplatz' }).getAttribute('href')).toBe('/admin/challenges/12');
    const offen = within(stempel).getByText('Fürbitter:in').closest('li')!;
    expect(offen).toHaveClass('web-stempel--offen');
    expect(offen).toHaveTextContent('Noch zu holen');
    // Challenges, die es nur geplant gibt, bringen keinen Stempel zum Holen (Befund Simon, 18.09.2026).
    expect(within(stempel).queryByText('Versfinder:in')).toBeNull();
    expect(within(stempel).queryByText('Kartenkünstler:in')).toBeNull();
    expect(within(stempel).getByText('Sommerkind').closest('li')).toHaveTextContent('Challenge vorbei');
  });

  it('ohne Stempel steht die Karte trotzdem da und sagt, wie man einen bekommt', () => {
    h.liste = [challenge(41, { badge_name: '' })];
    zeigen();
    expect(screen.getByRole('region', { name: 'Deine Stempel' })).toHaveTextContent('Mach selbst bei einer Challenge mit');
  });

  it('bewahrte Stempel aus geloeschten Challenges: ohne Link', () => {
    h.bewahrt = [{ challenge_id: 99, badge_icon: 'star', badge_name: 'Alter Stempel', title: 'Geloeschte Challenge', earned_at: tage(-100), bewahrt: true }];
    zeigen();
    const kachel = screen.getByText('Alter Stempel').closest('li')!;
    expect(kachel).toHaveTextContent('Die Challenge gibt es nicht mehr');
    expect(within(kachel).queryByRole('link')).toBeNull();
  });
});

describe('Challenges: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Liste der App, ohne Web-Klassen', () => {
    h.breit = false;
    const { container } = zeigen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-challenge-raster')).toBeNull();
    expect(container.querySelector('.app-list-item--challenges')).not.toBeNull();
  });

  it('im breiten Fenster stehen die Web-Klassen, nicht die Listenelemente der App', () => {
    const { container } = zeigen();
    expect(container.querySelector('.web-seite')).not.toBeNull();
    expect(container.querySelector('.app-list-item--challenges')).toBeNull();
    expect(container.querySelector('ion-list, ion-item, ion-card, ion-segment')).toBeNull();
  });
});

// Ansicht Liste | Kacheln (Simon, 06.10.2026): dieselben Challenges, einmal als
// Karten im Raster, einmal als Tabelle. Der Umschalter steht als letztes
// rechts neben der Suche, der Browser merkt sich die Wahl je Seite, beim
// ersten Oeffnen startet die Leitung mit der Liste, das Team mit Kacheln.
describe('Challenges (Web, Team und Leitung): Ansicht Liste | Kacheln', () => {
  const SCHLUESSEL = ansichtSchluessel('challenges-leitung');
  const umschalter = () => screen.getByRole('group', { name: 'Ansicht' });
  const waehleAnsicht = (name: 'Liste' | 'Kacheln') => fireEvent.click(within(umschalter()).getByRole('button', { name }));
  const gewaehlt = () => within(umschalter()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  const tabelle = () => screen.getByRole('table', { name: 'Challenges' });
  const zeilen = () => within(tabelle()).getAllByRole('row').slice(1);
  const zeilenTitel = () => zeilen().map((z) => within(z).getByRole('link').textContent);
  const zeile = (name: string) => zeilen().find((z) => within(z).getByRole('link').textContent === name)!;
  const zellen = (z: HTMLElement) => within(z).getAllByRole('cell');
  const texte = (zelle: HTMLElement) => [...zelle.children].map((k) => k.textContent);

  beforeEach(() => {
    // Nichts gemerkt: es gilt die Vorgabe der Rolle.
    window.localStorage.removeItem(SCHLUESSEL);
  });

  describe('Vorgabe und Merken', () => {
    it.each([
      ['org_admin', 'Liste'],
      ['admin', 'Liste'],
      ['teamer', 'Kacheln'],
    ])('beim ersten Oeffnen startet die Rolle %s mit %s', (rolle, erwartet) => {
      h.user = { id: 12, type: rolle === 'teamer' ? 'teamer' : 'admin', organization_id: 1, role_name: rolle };
      zeigen(rolle === 'teamer' ? <TeamerChallengesPage /> : <AdminChallengesPage />);
      expect(gewaehlt()).toEqual([erwartet]);
      expect(screen.queryByRole('table', { name: 'Challenges' }) !== null).toBe(erwartet === 'Liste');
      expect(screen.queryByRole('list', { name: 'Challenges' }) !== null).toBe(erwartet === 'Kacheln');
    });

    it('der Umschalter hat genau zwei Knoepfe, Liste und Kacheln, und zeigt den gewaehlten', () => {
      zeigen();
      expect(within(umschalter()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Liste', 'Kacheln']);
      expect(gewaehlt()).toEqual(['Liste']);
    });

    it('die Wahl steht unter dem Schluessel der Seite im Browser und gilt beim naechsten Oeffnen', () => {
      zeigen();
      waehleAnsicht('Kacheln');
      expect(window.localStorage.getItem(SCHLUESSEL)).toBe('kacheln');
      expect(screen.getByRole('list', { name: 'Challenges' })).toBeInTheDocument();
      cleanup();
      zeigen();
      expect(gewaehlt()).toEqual(['Kacheln']);
      expect(screen.queryByRole('table', { name: 'Challenges' })).toBeNull();
      waehleAnsicht('Liste');
      expect(window.localStorage.getItem(SCHLUESSEL)).toBe('liste');
      cleanup();
      zeigen();
      expect(gewaehlt()).toEqual(['Liste']);
    });

    it('das Team merkt sich "Liste" ebenso, obwohl seine Vorgabe die Kacheln sind', () => {
      h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
      zeigen(<TeamerChallengesPage />);
      expect(gewaehlt()).toEqual(['Kacheln']);
      waehleAnsicht('Liste');
      cleanup();
      zeigen(<TeamerChallengesPage />);
      expect(gewaehlt()).toEqual(['Liste']);
      expect(zeilenTitel().sort()).toEqual(['Fürbitten zum Erntedank', 'Mein Lieblingsplatz', 'Team-Runde Camp']);
    });

    it('der Umschalter steht als letztes Element rechts, direkt neben der Suche, in der Zeile mit den Filter-Chips', () => {
      zeigen();
      const rechts = screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }).closest('.web-werkzeuge__rechts')!;
      expect([...rechts.children].map((k) => k.getAttribute('role'))).toEqual(['search', 'group']);
      expect(rechts.lastElementChild).toBe(umschalter());
      // Dieselbe Zeile wie die Chips des Zustands.
      expect(rechts.parentElement).toBe(screen.getByRole('group', { name: 'Challenges nach Zustand' }).parentElement);
    });

    it('ohne Challenges gibt es nichts umzuschalten: keine Werkzeugleiste, kein Umschalter', () => {
      h.liste = [];
      zeigen();
      expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
    });

    it('im schmalen Fenster bleibt die Liste der App, auch wenn "Liste" gemerkt ist', () => {
      h.breit = false;
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      const { container } = zeigen();
      expect(container.querySelector('.web-ansicht-umschalter')).toBeNull();
      expect(container.querySelector('table')).toBeNull();
      expect(container.querySelector('.app-list-item--challenges')).not.toBeNull();
    });
  });

  describe('Umschalten: dieselben Challenges in der anderen Ansicht', () => {
    it('Liste und Kacheln zeigen dieselben drei laufenden Challenges', () => {
      zeigen();
      expect(zeilenTitel().sort()).toEqual(['Fürbitten zum Erntedank', 'Mein Lieblingsplatz', 'Team-Runde Camp']);
      waehleAnsicht('Kacheln');
      expect(titel().sort()).toEqual(['Fürbitten zum Erntedank', 'Mein Lieblingsplatz', 'Team-Runde Camp']);
      waehleAnsicht('Liste');
      expect(zeilenTitel().sort()).toEqual(['Fürbitten zum Erntedank', 'Mein Lieblingsplatz', 'Team-Runde Camp']);
    });

    it('die Reihenfolge ist die der Karten: laufend, dann Entwuerfe und Kommendes, dann das Archiv', () => {
      zeigen();
      waehle(/^Alle/);
      const inListe = zeilenTitel();
      expect(inListe).toHaveLength(6);
      waehleAnsicht('Kacheln');
      expect(titel()).toEqual(inListe);
    });

    it('Filter, Zielgruppe, Jahrgang und Suche gelten in beiden Ansichten gleich und bleiben beim Umschalten', () => {
      zeigen();
      waehle(/^Geplant/);
      expect(zeilenTitel().sort()).toEqual(['Bibelvers des Monats', 'Weihnachtskarten']);
      waehleAnsicht('Kacheln');
      expect(chip(/^Geplant/)).toHaveAttribute('aria-pressed', 'true');
      expect(titel().sort()).toEqual(['Bibelvers des Monats', 'Weihnachtskarten']);

      waehle(/^Alle/);
      fireEvent.click(within(screen.getByRole('group', { name: 'Zielgruppe' })).getByRole('button', { name: 'Nur Team' }));
      expect(titel()).toEqual(['Team-Runde Camp']);
      waehleAnsicht('Liste');
      expect(zeilenTitel()).toEqual(['Team-Runde Camp']);

      fireEvent.click(within(screen.getByRole('group', { name: 'Zielgruppe' })).getByRole('button', { name: 'Alle' }));
      fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: '2' } });
      expect(zeilenTitel()).toEqual(['Fürbitten zum Erntedank']);

      fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: 'alle' } });
      fireEvent.change(screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }), { target: { value: 'fotograf' } });
      expect(zeilenTitel()).toEqual(['Mein Lieblingsplatz']);
      // Die Zaehler an den Chips folgen der Suche, wie bei den Karten.
      expect(chip(/^Alle/)).toHaveTextContent('1');
      expect(chip(/^Beendet/)).toHaveTextContent('0');
      waehleAnsicht('Kacheln');
      expect(titel()).toEqual(['Mein Lieblingsplatz']);
    });

    it('"Wartet auf Freigabe" filtert in der Liste wie bei den Karten, auch beendete Challenges', () => {
      h.zaehler.pendingChallengesByChallenge = { 11: 3, 17: 1 };
      zeigen();
      fireEvent.click(chip(/^Wartet auf Freigabe/));
      expect(zeilenTitel().sort()).toEqual(['Fürbitten zum Erntedank', 'Sommerrückblick']);
    });

    it('die Suche hebt den Treffer in Titel und Stempel der Zeile hervor', () => {
      zeigen();
      waehle(/^Alle/);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fuerbitt' } });
      expect(zeilen()).toHaveLength(1);
      expect(zeilen()[0].querySelector('a mark')).toHaveTextContent('Fürbitt');
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sommerk' } });
      expect(zeilenTitel()).toEqual(['Sommerrückblick']);
      expect(zeilen()[0].querySelector('.web-zelle-leise mark')).toHaveTextContent('Sommerk');
    });

    it('Leerzustaende und "Deine Stempel" bleiben in der Liste, wie bei den Karten', () => {
      zeigen();
      waehle(/^Wartet auf Freigabe/);
      expect(screen.getByRole('heading', { level: 3, name: 'Nichts wartet auf Freigabe' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
      waehle(/^Alle/);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gibtsnicht' } });
      expect(screen.getByRole('heading', { level: 3, name: 'Keine Treffer' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Auswahl zurücksetzen' }));
      expect(zeilen()).toHaveLength(6);
      const stempel = screen.getByRole('region', { name: 'Deine Stempel' });
      expect(stempel).toHaveTextContent('1 erhalten · 3 noch zu holen');
      expect(within(stempel).getByText('Fotograf:in').closest('li')).toHaveTextContent('Erhalten am 30.09.2026');
    });
  });

  describe('die Zeile', () => {
    it('die Spalten: Challenge, Zeitraum, Status, Beitraege, Freigabe, Zielgruppe und die Aktionen', () => {
      zeigen();
      expect(within(tabelle()).getAllByRole('columnheader').map((k) => k.textContent)).toEqual([
        'Challenge', 'Zeitraum', 'Status', 'Beiträge', 'Freigabe', 'Zielgruppe', 'Aktionen',
      ]);
    });

    it('Titel mit Stempel-Name darunter, Zeitraum mit Rest, Status, Beitraege mit Sichtbarkeit, Zielgruppe mit Jahrgaengen', () => {
      zeigen();
      const z = zellen(zeile('Fürbitten zum Erntedank'));
      expect(z[0].querySelector('a')).toHaveTextContent('Fürbitten zum Erntedank');
      expect(texte(z[0].querySelector('.web-challenge-zelle__text') as HTMLElement)).toEqual(['Fürbitten zum Erntedank', 'Stempel: Fürbitter:in']);
      expect(texte(z[1])).toEqual(['28.09. – 12.10.2026', 'Noch 9 Tage']);
      expect(z[2]).toHaveTextContent(/^Läuft$/);
      expect(texte(z[3])).toEqual(['7 Beiträge', 'Selbst entscheiden']);
      expect(z[4]).toHaveTextContent(/^–$/);
      expect(texte(z[5])).toEqual(['Konfis und Team', '2026/2027, 2025/2026']);
    });

    it('Einzahl, Sichtbarkeit "Oeffentlich" und "Nur Leitung", "Nur Team" ohne Jahrgang', () => {
      h.liste = [challenge(21, { title: 'Einer', submission_count: 1 }), LIEBLINGSPLATZ, TEAMRUNDE];
      zeigen();
      expect(texte(zellen(zeile('Einer'))[3])).toEqual(['1 Beitrag', 'Selbst entscheiden']);
      expect(texte(zellen(zeile('Mein Lieblingsplatz'))[3])).toEqual(['6 Beiträge', 'Öffentlich']);
      expect(texte(zellen(zeile('Mein Lieblingsplatz'))[5])).toEqual(['Nur Konfis', '2026/2027']);
      expect(texte(zellen(zeile('Team-Runde Camp'))[3])).toEqual(['4 Beiträge', 'Nur Leitung']);
      expect(texte(zellen(zeile('Team-Runde Camp'))[5])).toEqual(['Nur Team']);
    });

    it('der Status als Marke: Laeuft, Entwurf, Geplant, Beendet -- Entwurf ohne Datum', () => {
      zeigen();
      waehle(/^Alle/);
      const status = (name: string) => zellen(zeile(name))[2].textContent;
      expect(status('Fürbitten zum Erntedank')).toBe('Läuft');
      expect(status('Bibelvers des Monats')).toBe('Entwurf');
      expect(status('Weihnachtskarten')).toBe('Geplant');
      expect(status('Sommerrückblick')).toBe('Beendet');
      expect(texte(zellen(zeile('Bibelvers des Monats'))[1])).toEqual(['Zeitraum noch offen']);
      expect(texte(zellen(zeile('Sommerrückblick'))[1])).toEqual(['20.07. – 14.08.2026']);
    });

    it('"Du hast eingereicht" nur in der Zeile, deren eigene Einreichung gezaehlt ist (auch unmoderiert)', () => {
      zeigen();
      expect(zellen(zeile('Mein Lieblingsplatz'))[2]).toHaveTextContent('Läuft');
      expect(zellen(zeile('Mein Lieblingsplatz'))[2]).toHaveTextContent('Du hast eingereicht');
      expect(zellen(zeile('Fürbitten zum Erntedank'))[2]).not.toHaveTextContent('Du hast eingereicht');
      expect(screen.getAllByText('Du hast eingereicht')).toHaveLength(1);
    });

    it('die rote Zahl am Stempel mit dem Satz der App; ab 10 steht 9+; ohne Neues keine Zahl', () => {
      h.zaehler.pendingChallengesByChallenge = { 11: 3 };
      h.zaehler.challengeNeueBeitraegeByChallenge = { 11: 4, 12: 12 };
      h.zaehler.challengeNeueWartendByChallenge = { 11: 3 };
      zeigen();
      expect(within(zeile('Fürbitten zum Erntedank')).getByRole('img', { name: '4 neue Beiträge, davon warten 3 auf Freigabe' })).toHaveTextContent('4');
      expect(within(zeile('Mein Lieblingsplatz')).getByRole('img', { name: '12 neue Beiträge' })).toHaveTextContent('9+');
      expect(within(zeile('Team-Runde Camp')).queryByRole('img')).toBeNull();
    });

    it('ohne das Feld des Servers: wartende Freigaben plus neue freigegebene, wie bei den Karten', () => {
      h.zaehler.challengeNeueBeitraegeByChallenge = null;
      h.zaehler.pendingChallengesByChallenge = { 11: 2 };
      h.zaehler.challengeUpdatesByChallenge = { 11: 3 };
      zeigen();
      expect(within(zeile('Fürbitten zum Erntedank')).getByRole('img', { name: '5 offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge' })).toHaveTextContent('5');
    });

    it('die orange Zahl der wartenden Beitraege steht in der Spalte Freigabe, in Worten fuer Vorleseprogramme', () => {
      h.zaehler.pendingChallengesByChallenge = { 11: 3, 12: 1 };
      zeigen();
      const mehrere = zellen(zeile('Fürbitten zum Erntedank'))[4];
      const orange = within(mehrere).getByRole('img', { name: '3 Beiträge warten auf Freigabe' });
      expect(orange).toHaveTextContent('3');
      expect(orange).toHaveClass('web-chip__zahl--orange');
      expect(within(zellen(zeile('Mein Lieblingsplatz'))[4]).getByRole('img', { name: '1 Beitrag wartet auf Freigabe' })).toHaveTextContent('1');
      expect(zellen(zeile('Team-Runde Camp'))[4]).toHaveTextContent(/^–$/);
    });

    it('die Zeile ist ein Link auf die Challenge: /admin/challenges/<id>, ein Klick bleibt in der App', () => {
      zeigen();
      const link = within(zeile('Fürbitten zum Erntedank')).getByRole('link');
      expect(link.getAttribute('href')).toBe('/admin/challenges/11');
      expect(link).toHaveClass('web-link--zeile');
      expect(zeile('Fürbitten zum Erntedank')).toHaveClass('web-zeile');
      fireEvent.click(link);
      expect(h.push).toHaveBeenCalledWith('/admin/challenges/11', 'none', 'push');
    });

    it('das Team oeffnet die Challenge unter /teamer/challenges/<id>', () => {
      h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      zeigen(<TeamerChallengesPage />);
      expect(within(zeile('Fürbitten zum Erntedank')).getByRole('link').getAttribute('href')).toBe('/teamer/challenges/11');
    });
  });

  describe('Aktionen am Zeilenende: dieselben wie auf der Karte', () => {
    it('Bearbeiten reicht die Challenge an das Formular, Loeschen an die Rueckfrage der App', () => {
      zeigen();
      fireEvent.click(within(zeile('Fürbitten zum Erntedank')).getByRole('button', { name: 'Bearbeiten: Fürbitten zum Erntedank' }));
      expect(h.bearbeiten).toHaveBeenCalledTimes(1);
      expect(h.bearbeiten).toHaveBeenCalledWith(expect.objectContaining({ id: 11, title: 'Fürbitten zum Erntedank' }));
      fireEvent.click(within(zeile('Mein Lieblingsplatz')).getByRole('button', { name: 'Löschen: Mein Lieblingsplatz' }));
      expect(h.handleDelete).toHaveBeenCalledTimes(1);
      expect(h.handleDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 12 }));
    });

    it('die Knoepfe sind Symbole mit Namen, und ein Klick darauf oeffnet nicht die Seite der Challenge', () => {
      zeigen();
      const knopf = within(zeile('Fürbitten zum Erntedank')).getByRole('button', { name: 'Bearbeiten: Fürbitten zum Erntedank' });
      expect(knopf).toHaveClass('web-knopf--symbol');
      expect(knopf).toHaveAttribute('title', 'Bearbeiten');
      expect(knopf).toHaveClass('web-vorn');
      fireEvent.click(knopf);
      expect(h.push).not.toHaveBeenCalled();
    });

    it('Loeschen steht nur bei der Leitung: das Team bearbeitet, loescht aber nicht -- in der Liste wie auf den Karten', () => {
      zeigen();
      expect(screen.getAllByRole('button', { name: /^Löschen:/ })).toHaveLength(3);
      expect(screen.getAllByRole('button', { name: /^Bearbeiten:/ })).toHaveLength(3);
      cleanup();
      h.user = { id: 12, type: 'teamer', organization_id: 1, role_name: 'teamer' };
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      zeigen(<TeamerChallengesPage />);
      expect(screen.queryByRole('button', { name: /^Löschen:/ })).toBeNull();
      expect(screen.getAllByRole('button', { name: /^Bearbeiten:/ })).toHaveLength(3);
    });

    it('Liste und Karten bieten bei jeder Challenge dieselben Aktionen an', () => {
      const aktionen = () => screen.getAllByRole('button', { name: /^(Bearbeiten|Löschen):/ }).map((b) => b.getAttribute('aria-label')).sort();
      zeigen();
      waehle(/^Alle/);
      const inListe = aktionen();
      expect(inListe).toHaveLength(12);
      waehleAnsicht('Kacheln');
      expect(aktionen()).toEqual(inListe);
    });

    it('"Neue Challenge" bleibt oben, in beiden Ansichten', () => {
      zeigen();
      fireEvent.click(screen.getByRole('button', { name: 'Neue Challenge' }));
      expect(h.anlegen).toHaveBeenCalledTimes(1);
    });
  });
});
