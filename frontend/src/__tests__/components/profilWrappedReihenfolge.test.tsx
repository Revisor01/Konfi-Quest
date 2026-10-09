// Simons Vorgaben 03.09.2026 fuer die Profile von Konfi und Team:
//   Stats, Info-Hinweise (optional), Konfirmation (optional), Rueckblick,
//   Einstellungen.
// Dazu: Die Konfirmations-Karte verschwindet ganz, wenn kein Termin gebucht
// ist -- vorher stand dort eine graue Karte, die nur "Noch kein Termin
// gebucht" sagte.
// Und: "Wrapped" heisst in der Oberflaeche "Jahresrueckblick"; eine Ausgabe
// traegt den Namen, den die Leitung vergeben hat.
//
// Seit 09.10.2026 gerendert statt an den Stellen der Kommentare im Quelltext
// (Geruest gerueste/profilSeiten.tsx fuer beide Profile; die Startseite der
// Konfis mit den Attrappen unten).
import {
  zustand, geoeffnet, KONFI, TEAMER, konfiProfil, teamerProfil, rueckblick, zuruecksetzen, warte,
  zeigeKonfiProfil, zeigeTeamerProfil, reihenfolge,
} from './gerueste/profilSeiten';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// --- Attrappen nur fuer die Startseite der Konfis ---------------------------
const { speicher, prefSet } = vi.hoisted(() => {
  const speicher = new Map<string, string>();
  return {
    speicher,
    prefSet: vi.fn(async ({ key, value }: { key: string; value: string }) => { speicher.set(key, value); }),
  };
});
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: speicher.get(key) ?? null })),
    set: (arg: { key: string; value: string }) => prefSet(arg),
    remove: vi.fn(async () => undefined),
  },
}));
vi.mock('../../components/konfi/views/DashboardView', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));

import KonfiDashboardPage from '../../components/konfi/pages/KonfiDashboardPage';

beforeEach(() => {
  cleanup();
  zuruecksetzen();
  speicher.clear();
  prefSet.mockClear();
});

const label = (text: string) => screen.queryAllByText(text).find((el) => el.tagName === 'ION-LABEL') ?? null;
const neuerungen = () => document.querySelector('[data-marke="neuerungen"]');

describe('Rueckblick steht vor den Einstellungen', () => {
  it('Konfi: nach den Neuerungs-Bannern, vor den Konto-Einstellungen', async () => {
    zustand.antworten.set('/wrapped/history/7', [rueckblick(1, 'Zwischenstand September')]);
    await zeigeKonfiProfil();
    expect(reihenfolge({
      banner: neuerungen(),
      rueckblick: label('Meine Rückblicke'),
      einstellungen: label('Konto-Einstellungen'),
    })).toEqual(['banner', 'rueckblick', 'einstellungen']);
  });

  it('Team: nach den Neuerungs-Bannern, vor den Konto-Einstellungen', async () => {
    zuruecksetzen(TEAMER);
    zustand.antworten.set('/teamer/profile', teamerProfil());
    zustand.antworten.set('/wrapped/history/9', [{ ...rueckblick(2, 'Team-Rückblick 2026'), wrapped_type: 'teamer' }]);
    await zeigeTeamerProfil();
    expect(reihenfolge({
      banner: neuerungen(),
      rueckblick: label('Meine Rückblicke'),
      einstellungen: label('Konto-Einstellungen'),
    })).toEqual(['banner', 'rueckblick', 'einstellungen']);
  });

  it('ohne Rueckblick faellt der Abschnitt weg', async () => {
    await zeigeKonfiProfil();
    expect(label('Meine Rückblicke')).toBeNull();
    expect(label('Konto-Einstellungen')).not.toBeNull();
  });
});

describe('Konfirmations-Karte nur mit gebuchtem Termin', () => {
  const ORT = 'St. Clemens auf der Karte öffnen';

  it('die Karte haengt an confirmation_date', async () => {
    await zeigeKonfiProfil(konfiProfil({ confirmation_location: 'St. Clemens' }));
    expect(screen.queryByLabelText(ORT)).toBeNull();
    expect(screen.queryByText(/Noch kein Termin/)).toBeNull();
    cleanup();
    await zeigeKonfiProfil(konfiProfil({ confirmation_date: '2027-05-09T08:00:00Z', confirmation_location: 'St. Clemens' }));
    expect(screen.getByLabelText(ORT)).toBeInTheDocument();
    expect(screen.getByText('10:00 Uhr')).toBeInTheDocument();
  });

  it('sie steht vor dem Rueckblick', async () => {
    zustand.antworten.set('/wrapped/history/7', [rueckblick(1, null)]);
    await zeigeKonfiProfil(konfiProfil({ confirmation_date: '2027-05-09T08:00:00Z', confirmation_location: 'St. Clemens' }));
    expect(reihenfolge({
      konfirmation: screen.getByLabelText(ORT),
      rueckblick: label('Meine Rückblicke'),
    })).toEqual(['konfirmation', 'rueckblick']);
  });
});

describe('Wortwahl: Jahresrueckblick statt Wrapped', () => {
  it.each([
    ['Konfi', KONFI],
    ['Team', TEAMER],
  ])('%s-Profil ueberschreibt den Abschnitt mit "Meine Rückblicke"', async (_r, user) => {
    zuruecksetzen(user);
    zustand.antworten.set('/teamer/profile', teamerProfil());
    zustand.antworten.set(`/wrapped/history/${user.id}`, [rueckblick(1, null)]);
    if (user === KONFI) await zeigeKonfiProfil(); else await zeigeTeamerProfil();
    expect(label('Meine Rückblicke')).not.toBeNull();
    expect(screen.queryByText(/Wrapped/)).toBeNull();
  });

  it.each([
    ['Konfi', KONFI],
    ['Team', TEAMER],
  ])('%s-Profil zeigt den Titel der Ausgabe statt "Konfi-Wrapped 2026"', async (_r, user) => {
    zuruecksetzen(user);
    zustand.antworten.set('/teamer/profile', teamerProfil());
    zustand.antworten.set(`/wrapped/history/${user.id}`, [rueckblick(1, 'Zwischenstand September'), rueckblick(2, null, 2025)]);
    if (user === KONFI) await zeigeKonfiProfil(); else await zeigeTeamerProfil();
    const abschnitt = label('Meine Rückblicke')?.closest('ion-list');
    const titel = [...(abschnitt?.querySelectorAll('.app-list-item__title') ?? [])].map((t) => t.textContent);
    expect(titel).toEqual(['Zwischenstand September', 'Jahresrückblick 2025']);
  });
});

// --- Startseite der Konfis ----------------------------------------------------
const dashboard = (zusatz: Record<string, unknown>) => ({
  konfi: { id: 7, display_name: 'Emilia Test', jahrgang_name: '2026', gottesdienst_points: 0, gemeinde_points: 0 },
  total_points: 0, recent_badges: [], badge_count: 0, recent_events: [], event_count: 0, ranking: [],
  has_wrapped: true,
  ...zusatz,
});
const zeigeStart = async (daten: Record<string, unknown>) => {
  zustand.antworten.set('/konfi/dashboard', daten);
  zustand.antworten.set('/konfi/profile', {});
  zustand.antworten.set('/konfi/events', []);
  zustand.antworten.set('/konfi/badges/v2', { available: [], earned: [], stats: { totalVisible: 0, totalSecret: 0 } });
  const r = render(<KonfiDashboardPage />);
  await warte(10);
  return r;
};

describe('Wortwahl auf der Startseite', () => {
  it('die Startseite nennt nicht mehr "Dein Wrapped ist da"', async () => {
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: null }));
    expect(screen.queryByText(/Wrapped/)).toBeNull();
    expect(screen.getByText('Dein Jahresrückblick ist da!')).toBeInTheDocument();
    expect(screen.getByText('Schau ihn dir an')).toBeInTheDocument();
  });

  it('die Startseite nutzt den Namen der Ausgabe, wenn es einen gibt', async () => {
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    expect(screen.getByText('Zwischenstand September')).toBeInTheDocument();
    expect(screen.queryByText('Dein Jahresrückblick ist da!')).toBeNull();
    expect(screen.getByText('Dein Rückblick - bis jetzt! Hier tippen.')).toBeInTheDocument();
  });
});

describe('Der Hinweis auf der Startseite laesst sich wegklicken', () => {
  it('es gibt einen Ausblenden-Knopf, und er blendet aus', async () => {
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    fireEvent.click(screen.getByLabelText('Hinweis ausblenden'));
    await warte();
    expect(screen.queryByText('Zwischenstand September')).toBeNull();
  });

  it('das Wegklicken wird pro AUSGABE gemerkt, nicht ein fuer alle Mal', async () => {
    // Sonst bliebe auch der naechste Rueckblick fuer immer verborgen.
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    fireEvent.click(screen.getByLabelText('Hinweis ausblenden'));
    await warte();
    expect(prefSet).toHaveBeenCalledWith({ key: 'wrapped_hinweis_7_3', value: '1' });
    cleanup();
    // Die naechste Ausgabe meldet sich wieder.
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 4, wrapped_titel: 'Dein Abschluss' }));
    expect(screen.getByText('Dein Abschluss')).toBeInTheDocument();
    cleanup();
    // Die weggeklickte bleibt weg.
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    expect(screen.queryByText('Zwischenstand September')).toBeNull();
  });

  it('der Knopf oeffnet nicht versehentlich den Rueckblick', async () => {
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    fireEvent.click(screen.getByLabelText('Hinweis ausblenden'));
    await warte();
    expect(geoeffnet).not.toContain('WrappedModal');
  });

  it('ein Tipp auf die Karte oeffnet ihn', async () => {
    // Gegenprobe zum Test darueber: Die Attrappe zaehlt das Oeffnen wirklich.
    await zeigeStart(dashboard({ wrapped_ausgabe_id: 3, wrapped_titel: 'Zwischenstand September' }));
    fireEvent.click(screen.getByText('Zwischenstand September'));
    expect(geoeffnet).toEqual(['WrappedModal']);
  });
});
