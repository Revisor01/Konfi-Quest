// Konfis und Team der Leitung in der Web-Fassung (/admin/konfis), gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Tabelle mit Name,
// Jahrgang, Punkten je Art und gesamt, Badges und den Aktionen der Zeile;
// Suche (Umlaute), Jahrgang-Filter, Sortierung ueber die Spaltenkoepfe, Reiter
// Konfis/Team, Kennzahlen. Die Rechte sind die der App: Die Leitung sieht nur
// ihre Jahrgaenge, Einladen und Teamer:innen loeschen nur die Gemeindeleitung.
//
// Die Balken zeigen ihren Wert (progressbar mit Prozent und "x von y"), die Zahl
// steht ueber dem Balken, der Kreis vor dem Namen hat seine Initialen. Vorher
// schluckte ein gleichnamiges Stylesheet der Konfi-Seite beides
// (webCssKlassen.test.ts).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { KopfzeileAttrappe } from '../support/ionicAttrappe';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  setError: vi.fn(),
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  standort: { pathname: '/admin/konfis', search: '' },
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
vi.mock('../../../components/admin/modals/ActivityModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/BonusModal', () => ({ default: () => null }));

import WebKonfis from '../../../components/admin/web/leitung/WebKonfis';
import ActivityModal from '../../../components/admin/modals/ActivityModal';
import BonusModal from '../../../components/admin/modals/BonusModal';

void KopfzeileAttrappe;

const JAHRGAENGE = [
  { id: 11, name: 'Jahrgang 2025' },
  { id: 12, name: 'Jahrgang 2026' },
];

const KONFIS = [
  { id: 1, name: 'Anna Müller', username: 'anna.mueller', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 7, gemeinde_points: 5, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 3 },
  { id: 2, name: 'Ben Schmidt', username: 'ben.schmidt', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 10, gemeinde_points: 10, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 5 },
  { id: 3, name: 'Clara Beispiel', username: 'clara.beispiel', jahrgang_name: 'Jahrgang 2025', gottesdienst_points: 2, gemeinde_points: 1, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 0 },
  { id: 4, name: 'Dora Test', username: 'dora.test', jahrgang_name: 'Jahrgang 2025', gottesdienst_points: 4, gemeinde_points: 8, gottesdienst_enabled: false, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 1 },
  { id: 5, name: 'Emil Probe', username: 'emil.probe', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 0, gemeinde_points: 0, target_gottesdienst: 10, target_gemeinde: 10, badgeCount: 0 },
];

const TEAM = [
  { id: 21, name: 'Frieda Muster', username: 'frieda', jahrgang_name: 'Jahrgang 2026', badge_count: 2, cert_count: 1, teamer_since: '2024-09-01' },
  { id: 22, name: 'Gero Beispiel', display_name: 'Gero B.', username: 'gero', jahrgang_name: 'Jahrgang 2025, Jahrgang 2026', badge_count: 6, cert_count: 3, teamer_since: '2023-05-01' },
];

const aktionen = {
  onNeuLaden: vi.fn(),
  onKonfiAnlegen: vi.fn(),
  onTeamAnlegen: vi.fn(),
  onMatrix: vi.fn(),
  onKonfiLoeschen: vi.fn(),
  onTeamerLoeschen: vi.fn(),
};

const zeigen = (props: Partial<React.ComponentProps<typeof WebKonfis>> = {}) => render(
  <WebKonfis konfis={KONFIS} jahrgaenge={JAHRGAENGE} laedt={false} ohneJahrgang={false} {...aktionen} {...props} />,
);

const tabelle = (name: string) => screen.getByRole('table', { name });
const zeilen = (name = 'Konfis') => within(tabelle(name)).getAllByRole('row').slice(1);
const namen = (name = 'Konfis') => zeilen(name).map((z) => within(z).getAllByRole('cell')[0].querySelector('a')!.textContent);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const zeileVon = (name: string) => zeilen().find((z) => zelle(z, 0).querySelector('a')!.textContent === name)!;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.user = konto('org_admin');
  h.standort = { pathname: '/admin/konfis', search: '' };
  h.apiGet.mockResolvedValue({ data: TEAM });
});

describe('Konfis (Web): Tabelle', () => {
  it('Kopf, Spalten und Zeilen: Name als Link auf die Detailseite, Punkte je Art und gesamt', () => {
    zeigen();
    expect(screen.getByRole('heading', { level: 1, name: 'Konfis' })).toBeInTheDocument();
    expect(screen.getByText('5 Konfis in 2 Jahrgängen')).toBeInTheDocument();
    expect(within(tabelle('Konfis')).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Name', 'Jahrgang', 'Gottesdienst', 'Gemeinde', 'Gesamt', 'Badges', 'Aktionen']);
    // Standard: nach Name, A bis Z.
    expect(namen()).toEqual(['Anna Müller', 'Ben Schmidt', 'Clara Beispiel', 'Dora Test', 'Emil Probe']);
    const anna = zeileVon('Anna Müller');
    expect(within(zelle(anna, 0)).getByRole('link')).toHaveAttribute('href', '/admin/konfis/1');
    expect(zelle(anna, 0)).toHaveTextContent('anna.mueller');
    expect(zelle(anna, 1)).toHaveTextContent('Jahrgang 2026');
    expect(within(zelle(anna, 2)).getByText('7 / 10')).toBeInTheDocument();
    expect(within(zelle(anna, 3)).getByText('5 / 10')).toBeInTheDocument();
    expect(within(zelle(anna, 4)).getByText('12 / 20')).toBeInTheDocument();
    expect(zelle(anna, 5)).toHaveTextContent('3');
  });

  it('eine abgeschaltete Punkteart zaehlt nicht: Strich statt Zahl, Ziel und Summe nur der aktiven Art', () => {
    zeigen();
    const dora = zeileVon('Dora Test');
    expect(zelle(dora, 2)).toHaveTextContent('–');
    expect(within(zelle(dora, 3)).getByText('8 / 10')).toBeInTheDocument();
    expect(within(zelle(dora, 4)).getByText('8 / 10')).toBeInTheDocument();
  });

  it('wer das Ziel erreicht hat, traegt den gruenen Balken', () => {
    zeigen();
    expect(zelle(zeileVon('Ben Schmidt'), 4).querySelector('.web-punktebalken--erreicht')).not.toBeNull();
    expect(zelle(zeileVon('Anna Müller'), 4).querySelector('.web-punktebalken--erreicht')).toBeNull();
  });

  it('der Kreis vor dem Namen zeigt die Initialen, gruen wer das Ziel erreicht hat', () => {
    zeigen();
    const kreis = (name: string) => zelle(zeileVon(name), 0).querySelector('.web-initialen')!;
    expect(kreis('Anna Müller').textContent).toBe('AM');
    expect(kreis('Anna Müller').className).toBe('web-initialen web-initialen--konfis');
    expect(kreis('Ben Schmidt').textContent).toBe('BS');
    expect(kreis('Ben Schmidt').className).toBe('web-initialen web-initialen--erreicht');
  });

  it('Kennzahlen: Konfis, Punkte gesamt, Ziel erreicht, Jahrgaenge', () => {
    zeigen();
    expect(screen.getByRole('group', { name: 'Konfis: 5' })).toBeInTheDocument();
    // 12 + 20 + 3 + 8 + 0
    expect(screen.getByRole('group', { name: 'Punkte gesamt: 43' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ziel erreicht: 1' })).toHaveTextContent('von 5 Konfis');
    expect(screen.getByRole('group', { name: 'Jahrgänge: 2' })).toBeInTheDocument();
  });

  it('die Spalte "Letzte Aktivität" steht nur da, wenn die Liste sie liefert', () => {
    const { unmount } = zeigen();
    expect(within(tabelle('Konfis')).queryByRole('columnheader', { name: 'Letzte Aktivität' })).toBeNull();
    unmount();
    zeigen({ konfis: [{ ...KONFIS[0], letzte_aktivitaet: '2026-09-28T10:00:00Z' }, KONFIS[1]] });
    expect(within(tabelle('Konfis')).getByRole('columnheader', { name: 'Letzte Aktivität' })).toBeInTheDocument();
    expect(zelle(zeileVon('Anna Müller'), 6)).toHaveTextContent('28.09.2026');
    expect(zelle(zeileVon('Ben Schmidt'), 6)).toHaveTextContent('–');
  });

  it('laedt: Platzhalter statt Tabelle; keine Konfis: Leerzustand mit Anlegen', () => {
    const { unmount } = zeigen({ laedt: true });
    expect(screen.getByRole('status')).toHaveTextContent('Die Konfis werden geladen.');
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    zeigen({ konfis: [] });
    expect(screen.getByText('Noch keine Konfis angelegt.')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Konfi anlegen' })[1]);
    expect(aktionen.onKonfiAnlegen).toHaveBeenCalledTimes(1);
  });
});

// Der Balken ist ein progressbar mit Name, Prozentwert und Text; seine Breite ist
// der Anteil in Prozent. Die Zahl steht daneben ("7 / 10"), nicht im Balken.
const balken = (z: HTMLElement, name: string) => within(z).getByRole('progressbar', { name });
const fuellung = (b: HTMLElement) => b.querySelector<HTMLElement>('.web-punktebalken__fuellung')!;

describe('Konfis (Web): Balken der Punkte', () => {
  it('jeder Balken traegt seinen Wert: Prozent als Wert und als Breite, "x von y" als Text', () => {
    zeigen();
    const anna = zeileVon('Anna Müller');
    const godi = balken(zelle(anna, 2), 'Gottesdienst-Punkte');
    expect(godi).toHaveAttribute('aria-valuenow', '70');
    expect(godi).toHaveAttribute('aria-valuemin', '0');
    expect(godi).toHaveAttribute('aria-valuemax', '100');
    expect(godi).toHaveAttribute('aria-valuetext', '7 von 10');
    expect(fuellung(godi).style.width).toBe('70%');
    const gemeinde = balken(zelle(anna, 3), 'Gemeinde-Punkte');
    expect(gemeinde).toHaveAttribute('aria-valuenow', '50');
    expect(fuellung(gemeinde).style.width).toBe('50%');
    const gesamt = balken(zelle(anna, 4), 'Punkte gesamt');
    expect(gesamt).toHaveAttribute('aria-valuenow', '60');
    expect(gesamt).toHaveAttribute('aria-valuetext', '12 von 20');
    expect(fuellung(gesamt).style.width).toBe('60%');
  });

  it('1 von 10 sind 10 Prozent; ohne Punkte ist der Balken leer (0 Prozent), nicht verschwunden', () => {
    zeigen();
    const gemeinde = balken(zelle(zeileVon('Clara Beispiel'), 3), 'Gemeinde-Punkte');
    expect(gemeinde).toHaveAttribute('aria-valuenow', '10');
    expect(gemeinde).toHaveAttribute('aria-valuetext', '1 von 10');
    expect(fuellung(gemeinde).style.width).toBe('10%');
    const leer = balken(zelle(zeileVon('Emil Probe'), 4), 'Punkte gesamt');
    expect(leer).toHaveAttribute('aria-valuenow', '0');
    expect(fuellung(leer).style.width).toBe('0%');
  });

  it('die Zahl steht ueber dem Balken, nicht darin: Kopf mit "1 / 10", Spur und Fuellung ohne Text', () => {
    zeigen();
    const zelleGemeinde = zelle(zeileVon('Clara Beispiel'), 3);
    expect(zelleGemeinde.querySelector('.web-punktebalken__kopf')).toHaveTextContent('1 / 10');
    expect(zelleGemeinde.querySelector('.web-punktebalken__spur')!.textContent).toBe('');
    // Der Balken liegt UNTER der Zahl (Reihenfolge im Baustein), nicht neben oder auf ihr.
    const kinder = [...zelleGemeinde.querySelector('.web-punktebalken')!.children].map((c) => c.className);
    expect(kinder).toEqual(['web-punktebalken__kopf', 'web-punktebalken__spur']);
  });

  it('Farben der Punktarten: Gottesdienst, Gemeinde und Gesamt tragen je ihre Klasse', () => {
    zeigen();
    const anna = zeileVon('Anna Müller');
    expect(zelle(anna, 2).querySelector('.web-punktebalken--gottesdienst')).not.toBeNull();
    expect(zelle(anna, 3).querySelector('.web-punktebalken--gemeinde')).not.toBeNull();
    expect(zelle(anna, 4).querySelector('.web-punktebalken--gesamt')).not.toBeNull();
  });

  it('Ziel erreicht: Balken voll, Haken und der Satz "Ziel erreicht" fuer Vorleseprogramme; sonst keines von beiden', () => {
    zeigen();
    const ben = balken(zelle(zeileVon('Ben Schmidt'), 4), 'Punkte gesamt');
    expect(ben).toHaveAttribute('aria-valuenow', '100');
    expect(ben).toHaveAttribute('aria-valuetext', '20 von 20, Ziel erreicht');
    expect(zelle(zeileVon('Ben Schmidt'), 4).querySelector('.web-punktebalken__haken')).not.toBeNull();
    const anna = zelle(zeileVon('Anna Müller'), 4);
    expect(balken(anna, 'Punkte gesamt')).toHaveAttribute('aria-valuetext', '12 von 20');
    expect(anna.querySelector('.web-punktebalken__haken')).toBeNull();
  });

  it('mehr als das Ziel: der Balken bleibt bei 100 Prozent, die Zahl und "110 %" sagen es', () => {
    zeigen({ konfis: [{ ...KONFIS[0], gottesdienst_points: 12, gemeinde_points: 10 }] });
    const z = zelle(zeilen()[0], 4);
    const b = balken(z, 'Punkte gesamt');
    expect(b).toHaveAttribute('aria-valuenow', '100');
    expect(fuellung(b).style.width).toBe('100%');
    expect(b).toHaveAttribute('aria-valuetext', '22 von 20, Ziel erreicht');
    expect(z.querySelector('.web-punktebalken__kopf')).toHaveTextContent('22 / 20');
    expect(z.querySelector('.web-punktebalken__prozent')).toHaveTextContent('110 %');
  });

  it('eine abgeschaltete Punkteart hat keinen Balken: Strich, und der Satz dazu fuer Vorleseprogramme', () => {
    zeigen();
    const godi = zelle(zeileVon('Dora Test'), 2);
    expect(within(godi).queryByRole('progressbar')).toBeNull();
    expect(godi.querySelector('.web-punktebalken__wert')).toHaveTextContent('–');
    expect(godi.querySelector('.web-punktebalken__wert')).toHaveAttribute('title', 'Für diesen Jahrgang abgeschaltet');
    expect(godi).toHaveTextContent('Gottesdienst-Punkte: für diesen Jahrgang abgeschaltet');
    // Das Gesamtziel zaehlt nur die aktive Art: 8 von 10 -> 80 Prozent.
    expect(balken(zelle(zeileVon('Dora Test'), 4), 'Punkte gesamt')).toHaveAttribute('aria-valuenow', '80');
  });
});

describe('Konfis (Web): Suche, Filter, Sortierung', () => {
  it('die Suche kennt Umlaute: "mueller" findet "Müller", der Treffer ist markiert', () => {
    zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Konfi suchen' }), { target: { value: 'mueller' } });
    expect(namen()).toEqual(['Anna Müller']);
    expect(screen.getByText('1 von 5 Konfis')).toBeInTheDocument();
    // Hervorgehoben wird, was im Text steht ("Müller"), nicht was getippt wurde.
    expect(zelle(zeilen()[0], 0).querySelector('mark')!.textContent).toBe('Müller');
  });

  it('die Suche findet auch den Benutzernamen; nichts gefunden: Hinweis statt Tabelle', () => {
    zeigen();
    const feld = screen.getByRole('searchbox', { name: 'Konfi suchen' });
    fireEvent.change(feld, { target: { value: 'emil.pr' } });
    expect(namen()).toEqual(['Emil Probe']);
    fireEvent.change(feld, { target: { value: 'gibtesnicht' } });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Keine Konfis gefunden')).toBeInTheDocument();
    expect(screen.getByText('Versuche andere Suchbegriffe.')).toBeInTheDocument();
  });

  it('der Jahrgang-Filter zeigt nur diesen Jahrgang und zaehlt "2 von 5"', () => {
    zeigen();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'Jahrgang 2025' } });
    expect(namen()).toEqual(['Clara Beispiel', 'Dora Test']);
    expect(screen.getByText('2 von 5 Konfis')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'alle' } });
    expect(namen()).toHaveLength(5);
  });

  it('Suche und Jahrgang gelten zusammen', () => {
    zeigen();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'Jahrgang 2026' } });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Konfi suchen' }), { target: { value: 'e' } });
    // Anna Müller hat kein "e"? "Müller" hat eins -- Ben Schmidt, Emil Probe auch.
    expect(namen()).toEqual(['Anna Müller', 'Ben Schmidt', 'Emil Probe']);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Konfi suchen' }), { target: { value: 'emil' } });
    expect(namen()).toEqual(['Emil Probe']);
  });

  it('Klick auf "Gesamt" ordnet nach Punkten, groesste zuerst; ein zweiter Klick dreht um', () => {
    zeigen();
    const kopf = () => within(tabelle('Konfis')).getByRole('columnheader', { name: 'Gesamt' });
    expect(kopf()).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gesamt' }));
    expect(namen()).toEqual(['Ben Schmidt', 'Anna Müller', 'Dora Test', 'Clara Beispiel', 'Emil Probe']);
    expect(kopf()).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(kopf()).getByRole('button', { name: 'Gesamt' }));
    expect(namen()).toEqual(['Emil Probe', 'Clara Beispiel', 'Dora Test', 'Anna Müller', 'Ben Schmidt']);
    expect(kopf()).toHaveAttribute('aria-sort', 'ascending');
  });

  it('Name beginnt A bis Z, ein zweiter Klick Z bis A; Jahrgang ordnet nach dem Namen des Jahrgangs, dann nach Name', () => {
    zeigen();
    const kopf = (name: string) => within(tabelle('Konfis')).getByRole('columnheader', { name });
    expect(kopf('Name')).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(kopf('Name')).getByRole('button'));
    expect(namen()).toEqual(['Emil Probe', 'Dora Test', 'Clara Beispiel', 'Ben Schmidt', 'Anna Müller']);
    fireEvent.click(within(kopf('Jahrgang')).getByRole('button'));
    expect(namen()).toEqual(['Clara Beispiel', 'Dora Test', 'Anna Müller', 'Ben Schmidt', 'Emil Probe']);
  });

  it('bei gleichen Punkten entscheidet der Name, nicht die Reihenfolge der Antwort', () => {
    zeigen({ konfis: [KONFIS[4], { ...KONFIS[2], gottesdienst_points: 0, gemeinde_points: 0 }, KONFIS[0]] });
    fireEvent.click(within(within(tabelle('Konfis')).getByRole('columnheader', { name: 'Gesamt' })).getByRole('button'));
    expect(namen()).toEqual(['Anna Müller', 'Clara Beispiel', 'Emil Probe']);
  });
});

describe('Konfis (Web): Rechte', () => {
  it('Gemeindeleitung: Anlegen, Einladen, Anwesenheit, Punkte und Loeschen; alle Jahrgaenge im Filter', () => {
    zeigen();
    expect(screen.getByRole('button', { name: 'Konfi anlegen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anwesenheit' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Konfis einladen' })).toHaveAttribute('href', '/admin/settings/invite');
    expect(within(zeileVon('Anna Müller')).getByRole('button', { name: 'Punkte an Anna Müller vergeben' })).toBeInTheDocument();
    expect(within(zeileVon('Anna Müller')).getByRole('button', { name: 'Anna Müller löschen' })).toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: 'Jahrgang' })).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Alle Jahrgänge', 'Jahrgang 2025', 'Jahrgang 2026']);
  });

  it('Leitung mit einem Jahrgang: nur dieser im Filter und in den Zahlen, kein Einladen', () => {
    h.user = konto('admin', [12]);
    zeigen({ konfis: [KONFIS[0], KONFIS[1], KONFIS[4]] });
    expect(within(screen.getByRole('combobox', { name: 'Jahrgang' })).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Alle Jahrgänge', 'Jahrgang 2026']);
    expect(screen.getByText('3 Konfis in 1 Jahrgang')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Jahrgänge: 1' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Konfis einladen' })).toBeNull();
    // Anlegen und Anwesenheit bleiben, wie in der App.
    expect(screen.getByRole('button', { name: 'Konfi anlegen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anwesenheit' })).toBeInTheDocument();
  });

  it('Leitung ohne Jahrgang: der Leerzustand nennt den Grund statt "Noch keine Konfis"', () => {
    h.user = konto('admin', []);
    zeigen({ konfis: [], ohneJahrgang: true });
    expect(screen.getByText('Kein Jahrgang zugewiesen')).toBeInTheDocument();
    expect(screen.getByText('Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Konfis angelegt.')).toBeNull();
    expect(within(screen.getByRole('combobox', { name: 'Jahrgang' })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Alle Jahrgänge']);
  });

  it('wer nicht Leitung ist, bekommt keine Aktionen (Konto ohne Rolle der Verwaltung)', () => {
    h.user = konto('teamer');
    zeigen();
    expect(screen.queryByRole('button', { name: 'Konfi anlegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /löschen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Punkte an/ })).toBeNull();
  });
});

describe('Konfis (Web): Aktionen der Zeile', () => {
  it('Loeschen reicht die Zeile an die Seite weiter (dort steht die Rueckfrage)', () => {
    zeigen();
    fireEvent.click(within(zeileVon('Clara Beispiel')).getByRole('button', { name: 'Clara Beispiel löschen' }));
    expect(aktionen.onKonfiLoeschen).toHaveBeenCalledWith(expect.objectContaining({ id: 3, name: 'Clara Beispiel' }));
  });

  it('Punkte vergeben: erst die Wahl im Dialog, dann dasselbe Fenster wie in der Detailansicht, vorbelegt mit der Konfi', () => {
    zeigen();
    fireEvent.click(within(zeileVon('Anna Müller')).getByRole('button', { name: 'Punkte an Anna Müller vergeben' }));
    const dialog = screen.getByRole('dialog', { name: 'Punkte an Anna Müller vergeben' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Aktivität eintragen/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.stand.fenster).toHaveLength(1);
    expect(h.stand.fenster[0].komponente).toBe(ActivityModal);
    expect(h.stand.fenster[0].props).toEqual(expect.objectContaining({ konfiId: 1, targetRole: 'konfi' }));
  });

  it('Bonuspunkte: das Fenster bekommt die Punktearten des Jahrgangs, damit die abgeschaltete Art fehlt', () => {
    zeigen();
    fireEvent.click(within(zeileVon('Dora Test')).getByRole('button', { name: 'Punkte an Dora Test vergeben' }));
    fireEvent.click(screen.getByRole('button', { name: /Bonuspunkte vergeben/ }));
    expect(h.stand.fenster[0].komponente).toBe(BonusModal);
    expect(h.stand.fenster[0].props).toEqual(expect.objectContaining({
      konfiId: 4,
      punkteartFlags: { gottesdienst_enabled: false, gemeinde_enabled: undefined },
    }));
  });

  it('Escape schliesst die Wahl, ohne ein Fenster zu oeffnen', () => {
    zeigen();
    fireEvent.click(within(zeileVon('Anna Müller')).getByRole('button', { name: 'Punkte an Anna Müller vergeben' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.stand.fenster).toHaveLength(0);
  });

  it('die Kopfaktionen rufen die Fenster der Seite', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit' }));
    expect(aktionen.onKonfiAnlegen).toHaveBeenCalledTimes(1);
    expect(aktionen.onMatrix).toHaveBeenCalledTimes(1);
  });
});

describe('Team (Web): Reiter in der Adresse', () => {
  beforeEach(() => { h.standort = { pathname: '/admin/konfis', search: '?filter=team' }; });

  it('?filter=team zeigt das Team: Tabelle mit Jahrgaengen, Badges, Zertifikaten und "im Team seit"', async () => {
    zeigen();
    await screen.findByRole('table', { name: 'Team' });
    expect(h.apiGet).toHaveBeenCalledWith('/admin/konfis/teamer');
    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText('2 Personen im Team')).toBeInTheDocument();
    expect(within(tabelle('Team')).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Name', 'Jahrgänge', 'Badges', 'Zertifikate', 'Im Team seit', 'Aktionen']);
    expect(namen('Team')).toEqual(['Frieda Muster', 'Gero B.']);
    const gero = zeilen('Team')[1];
    expect(within(zelle(gero, 0)).getByRole('link')).toHaveAttribute('href', '/admin/konfis/22');
    expect(zelle(gero, 1)).toHaveTextContent('Jahrgang 2025, Jahrgang 2026');
    expect(zelle(gero, 2)).toHaveTextContent('6');
    expect(zelle(gero, 3)).toHaveTextContent('3');
    expect(zelle(gero, 4)).toHaveTextContent('2023');
    expect(screen.getByRole('group', { name: 'Zertifikate: 4' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Badges: 8' })).toBeInTheDocument();
  });

  it('die Konfi-Liste wird erst gar nicht nach dem Team gefragt, solange der Reiter "Konfis" offen ist', () => {
    h.standort = { pathname: '/admin/konfis', search: '' };
    zeigen();
    expect(h.apiGet).not.toHaveBeenCalled();
  });

  it('Reiter wechseln: Klick auf "Team" laedt das Team, Suche beginnt leer', async () => {
    h.standort = { pathname: '/admin/konfis', search: '' };
    zeigen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Konfi suchen' }), { target: { value: 'anna' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Team' })); });
    await screen.findByRole('table', { name: 'Team' });
    expect(screen.getByRole('searchbox', { name: 'Im Team suchen' })).toHaveValue('');
    expect(screen.getByRole('button', { name: /^Team\s*2$/ })).toHaveAttribute('aria-pressed', 'true');
    // Zurueck: Konfis mit ihrer Zahl.
    fireEvent.click(screen.getByRole('button', { name: /^Konfis\s*5$/ }));
    expect(screen.getByRole('table', { name: 'Konfis' })).toBeInTheDocument();
  });

  it('Sortierung: Badges, meiste zuerst', async () => {
    zeigen();
    await screen.findByRole('table', { name: 'Team' });
    fireEvent.click(within(within(tabelle('Team')).getByRole('columnheader', { name: 'Badges' })).getByRole('button'));
    expect(namen('Team')).toEqual(['Gero B.', 'Frieda Muster']);
  });

  it('Suche im Team', async () => {
    zeigen();
    await screen.findByRole('table', { name: 'Team' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Im Team suchen' }), { target: { value: 'gero' } });
    expect(namen('Team')).toEqual(['Gero B.']);
    expect(screen.getByText('1 von 2 im Team')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Im Team suchen' }), { target: { value: 'zzz' } });
    expect(screen.getByText('Niemand im Team gefunden')).toBeInTheDocument();
  });

  it('Teamer:in loeschen: nur die Gemeindeleitung; danach wird das Team neu geladen', async () => {
    zeigen();
    await screen.findByRole('table', { name: 'Team' });
    h.apiGet.mockClear();
    await act(async () => { fireEvent.click(within(zeilen('Team')[0]).getByRole('button', { name: 'Frieda Muster löschen' })); });
    expect(aktionen.onTeamerLoeschen).toHaveBeenCalledWith(expect.objectContaining({ id: 21 }));
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/admin/konfis/teamer'));
  });

  it('Leitung (nicht Gemeindeleitung): kein Loeschen im Team, ein Fehler ist kein leeres Team', async () => {
    h.user = konto('admin', [12]);
    zeigen();
    await screen.findByRole('table', { name: 'Team' });
    expect(screen.queryByRole('button', { name: /löschen/ })).toBeNull();
  });

  it('Fehler beim Laden: Meldung mit erneutem Versuch statt "Noch niemand im Team"', async () => {
    h.apiGet.mockRejectedValueOnce(new Error('Netz weg'));
    const stumm = vi.spyOn(console, 'error').mockImplementation(() => {});
    zeigen();
    expect(await screen.findByRole('alert')).toHaveTextContent('Das Team konnte nicht geladen werden.');
    expect(screen.queryByText('Noch niemand im Team.')).toBeNull();
    expect(h.setError).toHaveBeenCalledWith('Das Team konnte nicht geladen werden');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('table', { name: 'Team' })).toBeInTheDocument();
    stumm.mockRestore();
  });
});
