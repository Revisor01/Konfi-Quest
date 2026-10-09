// Material fürs Team und Material verwalten: App und Web-Fassung lesen
// Titel, Jahrgangs-Auswahl, Suche (Team) und Leerzustand aus EINER
// Beschreibung (seiten/materialTeam.ts, seiten/materialLeitung.ts),
// gerendert. Dazu die Abweichungen, die bis 09.10.2026 bestanden:
//   * Team: Die Suche verglich roh -- „mueller" fand „Müller" nicht, eine
//     Suche aus Leerzeichen fand nichts; die App meldete auch bei Suche
//     „Noch keine Materialien vorhanden.".
//   * Leitung: Die App bot bei leerer Suche an, „das erste Material" anzulegen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from '../components/leitung/leitungTestHilfe';
import { MATERIAL_LEITUNG_FILTER, materialLeitungLeer } from '../../seiten/materialLeitung';
import { MATERIAL_TEAM_TITEL, MATERIAL_TEAM_TITEL_WEB, materialPasst, materialTeamLeer } from '../../seiten/materialTeam';

const h = vi.hoisted(() => ({
  breit: true,
  daten: {} as Record<string, unknown>,
  kopf: {} as Record<string, string>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('../components/leitung/leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel?: string }) => <header data-testid="kopfzeile" data-titel={titel} />,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/teamer/profile/material' }) }));
vi.mock('../../services/api', () => ({ default: { get: (...a: unknown[]) => h.apiGet(...a), delete: vi.fn() } }));
vi.mock('../../services/materialDetail', () => ({ materialDetailLaden: vi.fn(), materialVergessen: vi.fn() }));
vi.mock('../../utils/haptics', () => ({ haptik: async () => {}, triggerPullHaptic: () => {}, ImpactStyle: { Medium: 'MEDIUM' } }));
vi.mock('../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: vi.fn(), ladendeDatei: null }) }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../components/admin/modals/MaterialFormModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOfflineQuery', async () => {
  const React = await import('react');
  return {
    // Wie in webMaterial.test.tsx: Der Lader laeuft bei jedem neuen Schluessel (Suche, Jahrgang der Leitung).
    useOfflineQuery: (schluessel: string, lader: () => Promise<unknown>) => {
      const art = schluessel.split(':')[1];
      const [daten, setDaten] = React.useState<unknown>(h.daten[art]);
      React.useEffect(() => { void lader().then((d) => setDaten(d)); }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
      return { data: daten ?? [], loading: false, refresh: vi.fn(), refreshLive: vi.fn() };
    },
  };
});

import AdminMaterialPage from '../../components/admin/pages/AdminMaterialPage';
import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';

const MATERIAL = [
  { id: 1, title: 'Liederbuch Freizeit', description: 'Alle Lieder für das Lagerfeuer', file_count: 2, ist_global: true, created_by: 5, jahrgaenge: [], created_at: '2026-08-01T10:00:00Z' },
  { id: 2, title: 'Andacht Advent', description: 'Für die Gruppe von Frau Müller', file_count: 1, ist_global: false, created_by: 9, jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }], created_at: '2026-09-01T10:00:00Z' },
];

/** Was der Server für die Leitung liefert: Er sucht selbst (search) -- hier nach Titel. */
let serverListe: typeof MATERIAL = MATERIAL;
const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.kopf = {};
  serverListe = MATERIAL;
  h.daten = { material: MATERIAL, jahrgaenge: [{ id: 11, name: 'Jahrgang 2026' }, { id: 12, name: 'Jahrgang 2027' }] };
  h.apiGet.mockImplementation(async (url: string, optionen?: { params?: { search?: string } }) => {
    if (url === '/material') {
      const s = optionen?.params?.search?.toLowerCase();
      return { data: s ? serverListe.filter((m) => m.title.toLowerCase().includes(s)) : serverListe, headers: h.kopf };
    }
    if (url === '/admin/jahrgaenge') return { data: h.daten.jahrgaenge, headers: {} };
    return { data: [], headers: {} };
  });
});

const oeffnen = async (seite: React.ReactElement, breit: boolean) => {
  h.breit = breit;
  render(seite);
  await warten();
};

/** Das Suchfeld der Fassung: In der App ein IonInput, im Browser ein Suchfeld. */
const suchfeld = (breit: boolean) => (breit
  ? screen.getByRole('searchbox', { name: 'Material durchsuchen' })
  : screen.getByRole('textbox', { name: 'Material durchsuchen' }));
const suchen = async (breit: boolean, text: string) => {
  fireEvent.change(suchfeld(breit), { target: { value: text } });
  await warten();
};
const optionen = () => within(screen.getByRole('combobox', { name: 'Jahrgang' })).getAllByRole('option').map((o) => o.textContent);

describe('Material fürs Team: eine Beschreibung für App und Browser', () => {
  beforeEach(() => { h.user = konto('teamer'); });

  it('Titel: in der App „Material", im Browser bewusst „Material fürs Team" (der Bereich heißt schon „Material")', async () => {
    await oeffnen(<TeamerMaterialPage />, false);
    expect(screen.getByTestId('kopfzeile')).toHaveAttribute('data-titel', MATERIAL_TEAM_TITEL);
    expect(MATERIAL_TEAM_TITEL).toBe('Material');
  });

  it('der Browser zeigt den Titel der Web-Fassung', async () => {
    await oeffnen(<TeamerMaterialPage />, true);
    expect(screen.getByRole('heading', { level: 1, name: MATERIAL_TEAM_TITEL_WEB })).toBeInTheDocument();
  });

  it.each([false, true])('die Jahrgangs-Auswahl ist dieselbe (breit=%s): „Alle Jahrgänge" und die Jahrgänge', async (breit) => {
    await oeffnen(<TeamerMaterialPage />, breit);
    expect(optionen()).toEqual(['Alle Jahrgänge', 'Jahrgang 2026', 'Jahrgang 2027']);
  });

  it.each([false, true])('Umlaute gefaltet (breit=%s): „mueller" findet „Frau Müller" in der Beschreibung', async (breit) => {
    await oeffnen(<TeamerMaterialPage />, breit);
    await suchen(breit, 'mueller');
    expect(screen.getByText('Andacht Advent')).toBeInTheDocument();
    expect(screen.queryByText('Liederbuch Freizeit')).toBeNull();
  });

  it.each([false, true])('nur Leerzeichen grenzen nicht ein (breit=%s): beide Materialien bleiben', async (breit) => {
    await oeffnen(<TeamerMaterialPage />, breit);
    await suchen(breit, '   ');
    expect(screen.getByText('Andacht Advent')).toBeInTheDocument();
    expect(screen.getByText('Liederbuch Freizeit')).toBeInTheDocument();
  });

  it.each([false, true])('leer durch die Suche (breit=%s): „Versuche andere Suchbegriffe …", nicht „Noch keine Materialien"', async (breit) => {
    await oeffnen(<TeamerMaterialPage />, breit);
    await suchen(breit, 'gibtesnicht');
    expect(screen.getByText('Keine Materialien')).toBeInTheDocument();
    expect(screen.getByText(materialTeamLeer(true).text)).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Materialien vorhanden.')).toBeNull();
  });

  it('wirklich leer: in beiden Fassungen „Noch keine Materialien vorhanden."', async () => {
    h.daten.material = [];
    h.apiGet.mockImplementation(async (url: string) => ({ data: url === '/admin/jahrgaenge' ? [] : [], headers: {} }));
    await oeffnen(<TeamerMaterialPage />, false);
    expect(screen.getByText('Noch keine Materialien vorhanden.')).toBeInTheDocument();
  });

  it('das Prädikat: Jahrgang und Suche zusammen', () => {
    expect(materialPasst(MATERIAL[1], 'advent', 12)).toBe(true);
    expect(materialPasst(MATERIAL[1], 'advent', 11)).toBe(false);
    expect(materialPasst(MATERIAL[0], ' lagerfeuer ')).toBe(true);
  });
});

describe('Material verwalten: eine Beschreibung für App und Browser', () => {
  beforeEach(() => { h.user = konto('org_admin'); });

  it.each([false, true])('die festen Optionen der Jahrgangs-Auswahl kommen aus der Beschreibung (breit=%s)', async (breit) => {
    await oeffnen(<AdminMaterialPage />, breit);
    expect(optionen()).toEqual([...MATERIAL_LEITUNG_FILTER.map((f) => f.label), 'Jahrgang 2026', 'Jahrgang 2027']);
    expect(optionen().slice(0, 2)).toEqual(['Alle Jahrgänge', 'Nur globales Material']);
  });

  it.each([false, true])('leer durch die Suche (breit=%s): „Versuche andere Suchbegriffe …" statt des Angebots, das erste Material anzulegen', async (breit) => {
    await oeffnen(<AdminMaterialPage />, breit);
    await suchen(breit, 'gibtesnicht');
    // Die Web-Fassung wartet 300 ms aufs Weitertippen, bevor sie fragt.
    if (breit) { await act(async () => { await new Promise((r) => setTimeout(r, 350)); }); await warten(); }
    expect(screen.getByText('Versuche andere Suchbegriffe oder einen anderen Jahrgang.')).toBeInTheDocument();
    expect(screen.queryByText('Erstelle dein erstes Material mit dem + Button')).toBeNull();
    expect(screen.queryByText('Lege das erste Material mit „Neues Material“ an.')).toBeNull();
  });

  it('wirklich leer: jede Fassung nennt ihren Knopf zum Anlegen (bewusster Unterschied)', async () => {
    serverListe = [];
    await oeffnen(<AdminMaterialPage />, false);
    expect(screen.getByText(materialLeitungLeer({ ohneJahrgang: false, suche: '', filter: 'alle' }, 'app').text)).toBeInTheDocument();
    expect(screen.getByText('Erstelle dein erstes Material mit dem + Button')).toBeInTheDocument();
  });

  it('wirklich leer im Browser: „Neues Material"', async () => {
    serverListe = [];
    await oeffnen(<AdminMaterialPage />, true);
    expect(screen.getByText('Lege das erste Material mit „Neues Material“ an.')).toBeInTheDocument();
  });
});
