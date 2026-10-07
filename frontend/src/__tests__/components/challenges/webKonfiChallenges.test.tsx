// Die Challenges der Konfis in der Web-Fassung, gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Karten im Raster mit
// Stempel als Bild, Status, Frist, Zielgruppe und roter Zahl der Neuigkeiten;
// Filter (laufend, beendet, alle), Suche, die eigenen Stempel. Dazu die
// Ansicht Liste | Kacheln (Simon, 06.10.2026): dieselben Challenges als
// Tabelle mit dem eigenen Stand, Umschalter neben der Suche, Wahl im Browser
// gemerkt. Im schmalen Fenster bleibt die Liste der App.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  push: vi.fn(),
  daten: undefined as unknown,
  laedt: false,
  neuigkeiten: {} as Record<number, number>,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: h.push }),
}));
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 31, type: 'konfi', organization_id: 1 } }) }));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ challengeUpdatesByChallenge: h.neuigkeiten }) }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }) }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: h.daten, loading: h.laedt, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header data-testid="kopfzeile">{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import KonfiChallengesPage from '../../../components/konfi/pages/KonfiChallengesPage';
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
  has_submission: false,
  own_submission_count: 0,
  ...extra,
});

const LIED = challenge(13, { title: 'Lied der Woche', description: 'Welches Lied begleitet dich?', badge_name: 'Playlist', badge_icon: 'musicalNote', ends_at: tage(2) });
const FOTO = challenge(12, { title: 'Mein Lieblingsplatz', description: 'Ein Foto von der Kirche', badge_name: 'Fotograf:in', audience: 'konfis', has_submission: true, own_submission_count: 1, ends_at: tage(6), author_freetext: 'Konfi-Team' });
const BITTEN = challenge(11, { title: 'Fürbitten zum Erntedank', description: 'Schreibt eine Bitte', badge_name: 'Fürbitter:in', ends_at: tage(9), author_display_name: 'Pastorin Beispiel' });
const SOMMER = challenge(17, { title: 'Mein schönster Moment im Sommer', starts_at: tage(-75), ends_at: tage(-50), badge_name: 'Sommerkind', has_submission: true, own_submission_count: 1 });
const SEGEN = challenge(18, { title: 'Segenswünsche', starts_at: tage(-160), ends_at: tage(-140), badge_name: 'Segensbringer:in' });

const ANTWORT = {
  active: [BITTEN, FOTO, LIED],
  archive: [SEGEN, SOMMER],
  marks: [{ challenge_id: 17, badge_icon: 'sunny', badge_name: 'Sommerkind', title: 'Mein schönster Moment im Sommer', earned_at: tage(-60), description: null }],
  offene_stempel: [
    { challenge_id: 13, badge_icon: 'musicalNote', badge_name: 'Playlist', title: 'Lied der Woche', description: null, status: 'active', ends_at: tage(2) },
    { challenge_id: 18, badge_icon: 'star', badge_name: 'Segensbringer:in', title: 'Segenswünsche', description: null, status: 'ended', ends_at: tage(-140) },
  ],
};

const karten = () => [...screen.getByRole('list', { name: 'Challenges' }).children] as HTMLElement[];
const titel = () => karten().map((k) => within(k).getByRole('heading', { level: 3 }).textContent);
const chip = (name: RegExp | string) => within(screen.getByRole('group', { name: 'Challenges nach Zustand' })).getByRole('button', { name });
const waehle = (name: RegExp | string) => fireEvent.click(chip(name));

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.laedt = false;
  h.daten = ANTWORT;
  h.neuigkeiten = {};
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(JETZT));
});
afterEach(() => { cleanup(); vi.useRealTimers(); window.localStorage.clear(); });

describe('Challenges der Konfis (Web): Karten im Raster', () => {
  it('zeigt das Laufende, die knappste Frist zuerst, als Karten mit Link auf die Seite der Challenge', () => {
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Challenges' })).toBeInTheDocument();
    expect(titel()).toEqual(['Lied der Woche', 'Mein Lieblingsplatz', 'Fürbitten zum Erntedank']);
    const link = within(karten()[0]).getByRole('link');
    expect(link.getAttribute('href')).toBe('/konfi/challenges/13');
    fireEvent.click(link);
    expect(h.push).toHaveBeenCalledWith('/konfi/challenges/13', 'none', 'push');
  });

  it('die Karte nennt Stempel, Zustand, Frist, Zielgruppe und Urheber:in -- ohne Zahlen der Leitung', () => {
    render(<KonfiChallengesPage />);
    const karte = karten()[1];
    expect(karte).toHaveTextContent('Fotograf:in');
    expect(karte).toHaveTextContent('Läuft');
    expect(karte).toHaveTextContent('Noch 6 Tage');
    expect(karte).toHaveTextContent('Nur Konfis');
    expect(karte).toHaveTextContent('Gestellt von Konfi-Team');
    // Konfis sehen weder Beitragszahlen noch Sichtbarkeit noch Bearbeiten/Loeschen (nur Leitung und Team).
    expect(karte).not.toHaveTextContent('Beiträge');
    expect(within(karte).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Neue Challenge' })).toBeNull();
  });

  it('der Urheber steht auch, wenn nur der aufgeloeste Name da ist', () => {
    render(<KonfiChallengesPage />);
    expect(karten()[2]).toHaveTextContent('Gestellt von Pastorin Beispiel');
  });

  it('"Du hast eingereicht" nur bei der eigenen Einreichung', () => {
    render(<KonfiChallengesPage />);
    expect(karten()[1]).toHaveTextContent('Du hast eingereicht');
    expect(karten()[0]).not.toHaveTextContent('Du hast eingereicht');
  });

  it('die rote Zahl: Neuigkeiten je Challenge wie am Eintrag der App, ab 10 als 9+', () => {
    h.neuigkeiten = { 13: 3, 12: 1, 11: 14 };
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('img', { name: '3 Neuigkeiten' })).toHaveTextContent('3');
    expect(screen.getByRole('img', { name: '14 Neuigkeiten' })).toHaveTextContent('9+');
    cleanup();
    h.neuigkeiten = {};
    render(<KonfiChallengesPage />);
    expect(screen.queryByRole('img', { name: /Neuigkeiten/ })).toBeNull();
  });

  it('Beendetes steht im Archiv: zuletzt Beendetes zuerst, mit Zeitraum statt Restzeit', () => {
    render(<KonfiChallengesPage />);
    waehle(/^Beendet/);
    expect(titel()).toEqual(['Mein schönster Moment im Sommer', 'Segenswünsche']);
    expect(karten()[0]).toHaveTextContent('Beendet');
    expect(karten()[0]).toHaveTextContent('20.07. – 14.08.2026');
    expect(karten()[0]).not.toHaveTextContent('Noch ');
  });
});

describe('Challenges der Konfis (Web): Filter und Suche', () => {
  it('Laufend ist voreingestellt, die Chips tragen die Zahl; Geplantes und Wartendes gibt es fuer Konfis nicht', () => {
    render(<KonfiChallengesPage />);
    const gruppe = screen.getByRole('group', { name: 'Challenges nach Zustand' });
    expect(within(gruppe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Laufend3', 'Beendet2', 'Alle5']);
    expect(chip(/^Laufend/)).toHaveAttribute('aria-pressed', 'true');
    waehle(/^Alle/);
    expect(titel()).toHaveLength(5);
  });

  it('die Suche trifft Titel, Aufgabe und Stempel und hebt den Treffer hervor', () => {
    render(<KonfiChallengesPage />);
    waehle(/^Alle/);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }), { target: { value: 'fuerbitt' } });
    expect(titel()).toEqual(['Fürbitten zum Erntedank']);
    expect(karten()[0].querySelector('mark')).toHaveTextContent('Fürbitt');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'playlist' } });
    expect(titel()).toEqual(['Lied der Woche']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gibtsnicht' } });
    expect(screen.getByRole('heading', { level: 3, name: 'Keine Treffer' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(titel()).toHaveLength(5);
  });

  it('leere Zustaende in den Worten der App', () => {
    h.daten = { ...ANTWORT, active: [], archive: [] };
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('heading', { level: 3, name: 'Gerade läuft keine Challenge' })).toBeInTheDocument();
    expect(screen.getByText('Sobald eine neue Challenge startet, findest du sie hier — und bekommst eine Nachricht.')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    cleanup();
    h.daten = { ...ANTWORT, archive: [] };
    render(<KonfiChallengesPage />);
    waehle(/^Beendet/);
    expect(screen.getByRole('heading', { level: 3, name: 'Noch nichts im Archiv' })).toBeInTheDocument();
    expect(screen.getByText('Beendete Challenges kannst du hier später in Ruhe nachlesen.')).toBeInTheDocument();
  });

  it('kaputte oder alte Antworten: leere Listen statt eines Fehlers', () => {
    h.daten = { active: 'kaputt' };
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('heading', { level: 3, name: 'Gerade läuft keine Challenge' })).toBeInTheDocument();
  });

  it('laedt noch: Platzhalter statt Liste', () => {
    h.daten = undefined;
    h.laedt = true;
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Challenges werden geladen...');
    expect(screen.queryByRole('list', { name: 'Challenges' })).toBeNull();
  });
});

describe('Challenges der Konfis (Web): die eigenen Stempel', () => {
  it('dasselbe Raster wie auf der Seite einer Person: erhalten mit Datum in der Info, offen gestrichelt, vorbei sagt es', () => {
    render(<KonfiChallengesPage />);
    const stempel = screen.getByRole('region', { name: 'Deine Stempel' });
    expect(stempel).toHaveTextContent('1 erhalten · 2 noch zu holen');
    const erhalten = within(stempel).getByRole('link', { name: 'Sommerkind' });
    expect(erhalten.getAttribute('href')).toBe('/konfi/challenges/17');
    const info = document.getElementById(erhalten.getAttribute('aria-describedby')!)!;
    fireEvent.focus(erhalten);
    expect(info).toBeVisible();
    expect(info).toHaveTextContent('Mein schönster Moment im Sommer');
    expect(info).toHaveTextContent('04.08.2026');
    fireEvent.blur(erhalten);
    expect(info).not.toBeVisible();
    const offen = within(stempel).getByRole('link', { name: 'Playlist' });
    expect(offen.closest('li')).toHaveClass('web-auszeichnung--offen');
    expect(document.getElementById(offen.getAttribute('aria-describedby')!)).toHaveTextContent('Mach bei dieser Challenge mit');
    const vorbei = within(stempel).getByRole('link', { name: 'Segensbringer:in' });
    expect(document.getElementById(vorbei.getAttribute('aria-describedby')!)).toHaveTextContent('Diese Challenge ist vorbei.');
  });

  it('ohne Stempel steht die Karte trotzdem da, mit dem Satz der App', () => {
    h.daten = { ...ANTWORT, marks: [], offene_stempel: [] };
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('region', { name: 'Deine Stempel' })).toHaveTextContent('Für jede Challenge, bei der du mitmachst, bekommst du einen eigenen Stempel.');
  });

  it('aeltere Server ohne offene Stempel: nur die erhaltenen', () => {
    h.daten = { ...ANTWORT, offene_stempel: undefined };
    render(<KonfiChallengesPage />);
    expect(screen.getByRole('region', { name: 'Deine Stempel' })).toHaveTextContent('1 erhalten');
    expect(screen.getByRole('region', { name: 'Deine Stempel' })).not.toHaveTextContent('noch zu holen');
  });
});

describe('Challenges der Konfis: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die Liste der App, ohne Web-Klassen', () => {
    h.breit = false;
    const { container } = render(<KonfiChallengesPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(container.querySelector('.web-challenge-raster')).toBeNull();
    expect(container.querySelector('.app-list-item--challenges')).not.toBeNull();
    expect(container.textContent).toContain('Aktuelle Challenges');
  });

  it('im breiten Fenster stehen weder Listenelemente noch Segmente der App', () => {
    const { container } = render(<KonfiChallengesPage />);
    expect(container.querySelector('.app-list-item')).toBeNull();
    expect(container.querySelector('ion-segment, ion-item, ion-card, ion-list')).toBeNull();
  });
});

// Ansicht Liste | Kacheln (Simon, 06.10.2026): dieselben Challenges, einmal als
// Karten im Raster, einmal als Tabelle mit dem eigenen Stand. Konfis starten
// mit Kacheln; der Umschalter steht als letztes rechts neben der Suche.
describe('Challenges der Konfis (Web): Ansicht Liste | Kacheln', () => {
  const SCHLUESSEL = ansichtSchluessel('challenges-mitglied');
  const umschalter = () => screen.getByRole('group', { name: 'Ansicht' });
  const waehleAnsicht = (name: 'Liste' | 'Kacheln') => fireEvent.click(within(umschalter()).getByRole('button', { name }));
  const gewaehlt = () => within(umschalter()).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent);
  const tabelle = () => screen.getByRole('table', { name: 'Challenges' });
  const zeilen = () => within(tabelle()).getAllByRole('row').slice(1);
  const zeilenTitel = () => zeilen().map((z) => within(z).getByRole('link').textContent);
  const zeile = (name: string) => zeilen().find((z) => within(z).getByRole('link').textContent === name)!;
  const zellen = (z: HTMLElement) => within(z).getAllByRole('cell');
  const texte = (zelle: HTMLElement) => [...zelle.children].map((k) => k.textContent);

  describe('Vorgabe und Merken', () => {
    it('beim ersten Oeffnen sind es Kacheln, der Umschalter zeigt sie als gewaehlt', () => {
      render(<KonfiChallengesPage />);
      expect(gewaehlt()).toEqual(['Kacheln']);
      expect(screen.getByRole('list', { name: 'Challenges' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
      expect(within(umschalter()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Liste', 'Kacheln']);
    });

    it('die Wahl steht unter dem Schluessel der Seite im Browser und gilt beim naechsten Oeffnen', () => {
      render(<KonfiChallengesPage />);
      waehleAnsicht('Liste');
      expect(window.localStorage.getItem(SCHLUESSEL)).toBe('liste');
      expect(zeilenTitel()).toEqual(['Lied der Woche', 'Mein Lieblingsplatz', 'Fürbitten zum Erntedank']);
      cleanup();
      render(<KonfiChallengesPage />);
      expect(gewaehlt()).toEqual(['Liste']);
      expect(screen.queryByRole('list', { name: 'Challenges' })).toBeNull();
      waehleAnsicht('Kacheln');
      expect(window.localStorage.getItem(SCHLUESSEL)).toBe('kacheln');
      cleanup();
      render(<KonfiChallengesPage />);
      expect(gewaehlt()).toEqual(['Kacheln']);
    });

    it('die Wahl der Challenges gilt nur dort: eine andere Seite hat ihren eigenen Schluessel', () => {
      render(<KonfiChallengesPage />);
      waehleAnsicht('Liste');
      expect(window.localStorage.getItem(ansichtSchluessel('challenges-leitung'))).toBeNull();
      expect(window.localStorage.getItem(ansichtSchluessel('events-mitglied'))).toBeNull();
    });

    it('der Umschalter steht als letztes Element rechts, direkt neben der Suche, in der Zeile mit den Filter-Chips', () => {
      render(<KonfiChallengesPage />);
      const rechts = screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }).closest('.web-werkzeuge__rechts')!;
      expect([...rechts.children].map((k) => k.getAttribute('role'))).toEqual(['search', 'group']);
      expect(rechts.lastElementChild).toBe(umschalter());
      expect(rechts.parentElement).toBe(screen.getByRole('group', { name: 'Challenges nach Zustand' }).parentElement);
    });

    it('ohne Challenges gibt es nichts umzuschalten', () => {
      h.daten = { ...ANTWORT, active: [], archive: [] };
      render(<KonfiChallengesPage />);
      expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
    });

    it('im schmalen Fenster bleibt die Liste der App, auch wenn "Liste" gemerkt ist', () => {
      h.breit = false;
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      const { container } = render(<KonfiChallengesPage />);
      expect(container.querySelector('.web-ansicht-umschalter')).toBeNull();
      expect(container.querySelector('table')).toBeNull();
      expect(container.querySelector('.app-list-item--challenges')).not.toBeNull();
    });
  });

  describe('Umschalten: dieselben Challenges in der anderen Ansicht', () => {
    it('Liste und Kacheln zeigen dieselben Challenges in derselben Reihenfolge: knappste Frist zuerst', () => {
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      render(<KonfiChallengesPage />);
      expect(zeilenTitel()).toEqual(['Lied der Woche', 'Mein Lieblingsplatz', 'Fürbitten zum Erntedank']);
      waehleAnsicht('Kacheln');
      expect(titel()).toEqual(['Lied der Woche', 'Mein Lieblingsplatz', 'Fürbitten zum Erntedank']);
    });

    it('Filter und Suche gelten in beiden Ansichten gleich und bleiben beim Umschalten', () => {
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      render(<KonfiChallengesPage />);
      waehle(/^Beendet/);
      expect(zeilenTitel()).toEqual(['Mein schönster Moment im Sommer', 'Segenswünsche']);
      waehleAnsicht('Kacheln');
      expect(chip(/^Beendet/)).toHaveAttribute('aria-pressed', 'true');
      expect(titel()).toEqual(['Mein schönster Moment im Sommer', 'Segenswünsche']);
      waehle(/^Alle/);
      fireEvent.change(screen.getByRole('searchbox', { name: 'Challenges durchsuchen' }), { target: { value: 'playlist' } });
      expect(titel()).toEqual(['Lied der Woche']);
      waehleAnsicht('Liste');
      expect(zeilenTitel()).toEqual(['Lied der Woche']);
      expect(zeilen()[0].querySelector('.web-zelle-leise mark')).toHaveTextContent('Playlist');
      expect(chip(/^Alle/)).toHaveTextContent('1');
      expect(chip(/^Laufend/)).toHaveTextContent('1');
      expect(chip(/^Beendet/)).toHaveTextContent('0');
    });

    it('Leerzustaende und "Deine Stempel" bleiben in der Liste, wie bei den Karten', () => {
      window.localStorage.setItem(SCHLUESSEL, 'liste');
      render(<KonfiChallengesPage />);
      waehle(/^Alle/);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'gibtsnicht' } });
      expect(screen.getByRole('heading', { level: 3, name: 'Keine Treffer' })).toBeInTheDocument();
      expect(screen.queryByRole('table')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
      expect(zeilen()).toHaveLength(5);
      expect(screen.getByRole('region', { name: 'Deine Stempel' })).toHaveTextContent('1 erhalten · 2 noch zu holen');
      cleanup();
      h.daten = { ...ANTWORT, archive: [] };
      render(<KonfiChallengesPage />);
      waehle(/^Beendet/);
      expect(screen.getByRole('heading', { level: 3, name: 'Noch nichts im Archiv' })).toBeInTheDocument();
    });
  });

  describe('die Zeile', () => {
    beforeEach(() => { window.localStorage.setItem(SCHLUESSEL, 'liste'); });

    it('die Spalten: Challenge, Zeitraum, Status und der eigene Stand -- ohne Zahlen und Knoepfe der Leitung', () => {
      render(<KonfiChallengesPage />);
      expect(within(tabelle()).getAllByRole('columnheader').map((k) => k.textContent)).toEqual(['Challenge', 'Zeitraum', 'Status', 'Dein Stand']);
      expect(within(tabelle()).queryByRole('button')).toBeNull();
      expect(tabelle()).not.toHaveTextContent('Beiträge');
      expect(screen.queryByRole('button', { name: 'Neue Challenge' })).toBeNull();
    });

    it('Titel mit Stempel-Name darunter, Zeitraum mit Rest, Status und eigener Stand', () => {
      render(<KonfiChallengesPage />);
      const z = zellen(zeile('Mein Lieblingsplatz'));
      expect(texte(z[0].querySelector('.web-challenge-zelle__text') as HTMLElement)).toEqual(['Mein Lieblingsplatz', 'Stempel: Fotograf:in']);
      expect(texte(z[1])).toEqual(['28.09. – 09.10.2026', 'Noch 6 Tage']);
      expect(z[2]).toHaveTextContent(/^Läuft$/);
      expect(z[3]).toHaveTextContent(/^Du hast eingereicht$/);
    });

    it('"Du hast eingereicht" nur bei der eigenen Einreichung, sonst steht dort ein Strich', () => {
      render(<KonfiChallengesPage />);
      expect(zellen(zeile('Lied der Woche'))[3]).toHaveTextContent(/^–$/);
      expect(zellen(zeile('Fürbitten zum Erntedank'))[3]).toHaveTextContent(/^–$/);
      expect(screen.getAllByText('Du hast eingereicht')).toHaveLength(1);
      waehle(/^Beendet/);
      expect(zellen(zeile('Mein schönster Moment im Sommer'))[3]).toHaveTextContent(/^Du hast eingereicht$/);
      expect(zellen(zeile('Segenswünsche'))[3]).toHaveTextContent(/^–$/);
    });

    it('Beendetes mit Zeitraum statt Restzeit', () => {
      render(<KonfiChallengesPage />);
      waehle(/^Beendet/);
      const z = zellen(zeile('Mein schönster Moment im Sommer'));
      expect(texte(z[1])).toEqual(['20.07. – 14.08.2026']);
      expect(z[2]).toHaveTextContent(/^Beendet$/);
    });

    it('die rote Zahl: Neuigkeiten je Challenge am Stempel der Zeile, ab 10 als 9+, sonst keine', () => {
      h.neuigkeiten = { 13: 3, 11: 14 };
      render(<KonfiChallengesPage />);
      expect(within(zeile('Lied der Woche')).getByRole('img', { name: '3 Neuigkeiten' })).toHaveTextContent('3');
      expect(within(zeile('Fürbitten zum Erntedank')).getByRole('img', { name: '14 Neuigkeiten' })).toHaveTextContent('9+');
      expect(within(zeile('Mein Lieblingsplatz')).queryByRole('img')).toBeNull();
    });

    it('die Zeile ist ein Link auf die Challenge: /konfi/challenges/<id>, ein Klick bleibt in der App', () => {
      render(<KonfiChallengesPage />);
      const link = within(zeile('Lied der Woche')).getByRole('link');
      expect(link.getAttribute('href')).toBe('/konfi/challenges/13');
      expect(link).toHaveClass('web-link--zeile');
      expect(zeile('Lied der Woche')).toHaveClass('web-zeile');
      fireEvent.click(link);
      expect(h.push).toHaveBeenCalledWith('/konfi/challenges/13', 'none', 'push');
    });
  });
});
