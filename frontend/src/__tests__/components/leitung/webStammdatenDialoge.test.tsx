// Kategorie, Level und Zertifikat anlegen und bearbeiten im Browser ab 992 px
// (Simon, 11.10.2026: „Web braucht eigene kompaktere Modale überall"),
// gerendert: Die Seiten oeffnen im breiten Layout einen eigenen Dialog
// (WebKategorieDialog, WebLevelDialog, WebZertifikatDialog) statt des
// App-Modals; schmal bleibt es beim Modal der App. Beide nutzen dieselbe
// Logik (useKategorieFormular, useLevelFormular, useZertifikatFormular) --
// geprueft an beiden Fassungen mit derselben Route und demselben Koerper.
//
// Echt sind Seiten, Dialoge, Hooks, sendenOderEinreihen und useActionGuard;
// nachgestellt sind Server, Warteschlange, Netzstand, Anmeldung, Ionic und
// das breite Layout.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  daten: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  enqueue: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
}));

type Wert = { detail: { value?: unknown } };

// Die Attrappe der Leitung, dazu die Felder der App-Modale, die sie nicht
// kennt: Schieberegler (Level), Akkordeon mit Icons (Level, Zertifikat) und
// ein IonInput, das auch ueber `label` benannt ist (Name des Zertifikats).
vi.mock('@ionic/react', async () => {
  const basis = await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand);
  const durch = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    ...basis,
    IonInput: ({ 'aria-label': ariaLabel, label, value, disabled, onIonInput }: {
      'aria-label'?: string; label?: string; value?: string | null; disabled?: boolean; onIonInput?: (e: Wert) => void;
    }) => (
      <input aria-label={ariaLabel ?? label} value={value ?? ''} disabled={disabled}
        onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
    IonRange: ({ 'aria-label': ariaLabel, value, min, max, onIonChange }: {
      'aria-label'?: string; value?: number; min?: number; max?: number; onIonChange?: (e: Wert) => void;
    }) => (
      <input type="range" aria-label={ariaLabel} value={value ?? 0} min={min} max={max}
        onChange={(e) => onIonChange?.({ detail: { value: Number(e.target.value) } })} />
    ),
    IonAccordionGroup: durch,
    IonAccordion: durch,
  };
});
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.apiGet(...a),
    post: (...a: unknown[]) => h.apiPost(...a),
    put: (...a: unknown[]) => h.apiPut(...a),
    delete: (...a: unknown[]) => h.apiDelete(...a),
  },
}));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => h.enqueue(...a) } }));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return h.online; }, subscribe: () => () => {} },
}));
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => 'kennung-1' }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  // Der Schluessel beginnt mit "admin:<was>:" -- die Daten stehen unter <was>.
  useOfflineQuery: (schluessel: string) => ({
    data: h.daten[schluessel.split(':')[1]] ?? [],
    loading: false,
    refresh: h.refresh,
    refreshLive: vi.fn(),
  }),
}));

import AdminCategoriesPage from '../../../components/admin/pages/AdminCategoriesPage';
import AdminLevelsPage from '../../../components/admin/pages/AdminLevelsPage';
import AdminCertificatesPage from '../../../components/admin/pages/AdminCertificatesPage';
import LevelManagementModal from '../../../components/admin/modals/LevelManagementModal';

const KATEGORIEN = [
  { id: 1, name: 'Gottesdienst', description: 'Alles rund um Feiern und Beten', created_at: '2026-01-05T10:00:00Z' },
  { id: 2, name: 'Ausflug', created_at: '2026-02-05T10:00:00Z' },
];

const LEVELS = [
  { id: 1, name: 'anfang', title: 'Neu dabei', description: 'Die ersten Schritte', points_required: 0, icon: 'footsteps', color: '#10b981', is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
  { id: 2, name: 'fleissig', title: 'Fleißig', points_required: 12, icon: 'trophy', color: '#3b82f6', is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
];

const ZERTIFIKATE = [
  { id: 1, name: 'JuLeiCa', icon: 'ribbon', is_active: true, created_at: '2026-01-01T10:00:00Z' },
  { id: 2, name: 'Erste-Hilfe-Kurs', icon: 'medkit', is_active: true, created_at: '2026-01-02T10:00:00Z' },
];

const OFFLINE = 'Du bist offline. Gespeichert wird, sobald du wieder online bist.';

const fenster = () => h.stand.fenster;
/** Name und Knopf einer Zeile heissen gleich ("X bearbeiten"): der erste ist der Name in der Zelle. */
const erster = (name: string) => screen.getAllByRole('button', { name })[0];
const dialog = (name: string) => screen.getByRole('dialog', { name });
const feld = (d: HTMLElement, name: string) => within(d).getByLabelText(name) as HTMLInputElement;
const tippen = (d: HTMLElement, name: string, wert: string) => fireEvent.change(feld(d, name), { target: { value: wert } });
/** Ein Takt der Ereignisschleife: Speichern laeuft ueber mehrere Promises (senden, einreihen, Rueckruf). */
const takt = () => new Promise((fertig) => { setTimeout(fertig, 0); });
const klicken = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); await takt(); }); };
const knopf = (d: HTMLElement, name: string) => within(d).getByRole('button', { name });
/** Das App-Modal, das die Seite ueber useIonModal geoeffnet hat, mit seinen Werten. */
const appModalZeigen = (i = 0) => {
  const Komponente = fenster()[i].komponente as React.FC<Record<string, unknown>>;
  return render(<Komponente {...fenster()[i].props} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.daten = { categories: KATEGORIEN, levels: LEVELS, certificates: ZERTIFIKATE };
  // mockReset: eine nicht verbrauchte Antwort „einmal" (mockRejectedValueOnce) darf nicht in den naechsten Test wandern.
  h.apiGet.mockReset().mockResolvedValue({ data: [] });
  h.apiPost.mockReset().mockResolvedValue({ data: { id: 99 } });
  h.apiPut.mockReset().mockResolvedValue({ data: {} });
  h.apiDelete.mockReset().mockResolvedValue({ data: {} });
  h.enqueue.mockReset().mockResolvedValue({ id: 'q1' });
});

// ---------------------------------------------------------------------------
describe('Kategorie im Browser: eigener Dialog', () => {
  it('Felder mit sichtbarer Beschriftung, vorbelegt mit der Kategorie; „Speichern" beim Bearbeiten, „Anlegen" bei einer neuen', () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(erster('Gottesdienst bearbeiten'));
    const d = dialog('Kategorie bearbeiten');
    expect(feld(d, 'Name')).toHaveValue('Gottesdienst');
    expect(feld(d, 'Name')).toHaveAttribute('aria-required', 'true');
    expect(feld(d, 'Name')).toHaveAttribute('placeholder', 'z.B. Ausflug, Gottesdienst');
    expect(feld(d, 'Beschreibung')).toHaveValue('Alles rund um Feiern und Beten');
    expect(knopf(d, 'Speichern')).toHaveAttribute('type', 'submit');
    fireEvent.click(knopf(d, 'Abbrechen'));
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    const neu = dialog('Neue Kategorie');
    expect(feld(neu, 'Name')).toHaveValue('');
    expect(feld(neu, 'Beschreibung')).toHaveValue('');
    expect(knopf(neu, 'Anlegen')).toHaveAttribute('type', 'submit');
    expect(within(neu).queryByText(OFFLINE)).toBeNull();
  });

  it('ohne Namen: die Meldung steht im Dialog, nichts geht hinaus, der Dialog bleibt offen', async () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    const d = dialog('Neue Kategorie');
    tippen(d, 'Name', '   ');
    await klicken(knopf(d, 'Anlegen'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Name ist erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(dialog('Neue Kategorie')).toBeInTheDocument();
    // Tippen nimmt die Meldung weg.
    tippen(d, 'Name', 'A');
    expect(within(d).queryByRole('alert')).toBeNull();
  });

  it('Anlegen schickt POST /admin/categories mit Name und Beschreibung (getrimmt, leer -> null), laedt neu und schliesst', async () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    const d = dialog('Neue Kategorie');
    tippen(d, 'Name', '  Ausflug  ');
    tippen(d, 'Beschreibung', '   ');
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/categories', { name: 'Ausflug', description: null });
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Bearbeiten schickt PUT /admin/categories/:id; Enter im Feld schickt ab wie der Knopf', async () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(erster('Ausflug bearbeiten'));
    const d = dialog('Kategorie bearbeiten');
    tippen(d, 'Beschreibung', 'Raus aus der Kirche');
    await act(async () => { fireEvent.submit(feld(d, 'Name').closest('form')!); await takt(); });
    expect(h.apiPut).toHaveBeenCalledWith('/admin/categories/2', { name: 'Ausflug', description: 'Raus aus der Kirche' });
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Abbrechen und das X schicken nichts', () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(erster('Ausflug bearbeiten'));
    tippen(dialog('Kategorie bearbeiten'), 'Name', 'Ausflug ans Meer');
    fireEvent.click(knopf(dialog('Kategorie bearbeiten'), 'Abbrechen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    fireEvent.click(knopf(dialog('Neue Kategorie'), 'Schließen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('antwortet der Server mit einem Fehler, steht seine Meldung im Dialog; nichts wird neu geladen', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Kategoriename existiert bereits' } } });
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    const d = dialog('Neue Kategorie');
    tippen(d, 'Name', 'Gottesdienst');
    await klicken(knopf(d, 'Anlegen'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Kategoriename existiert bereits');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(dialog('Neue Kategorie')).toBeInTheDocument();
  });

  it('ohne Netz: Hinweis im Dialog, gespeichert wird wie in der App ueber die Warteschlange', async () => {
    h.online = false;
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    const d = dialog('Neue Kategorie');
    expect(within(d).getByRole('status')).toHaveTextContent(OFFLINE);
    tippen(d, 'Name', 'Konfifahrt');
    expect(knopf(d, 'Anlegen')).toBeEnabled();
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'POST',
      url: '/admin/categories',
      body: { name: 'Konfifahrt', description: null },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: 'kennung-1', label: 'Kategorie erstellen' },
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Wird gespeichert sobald du wieder online bist');
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('schmal oeffnet „Neue Kategorie" weiter das Modal der App; es speichert mit derselben Route und demselben Koerper', async () => {
    h.breit = false;
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie anlegen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fenster()).toHaveLength(1);
    expect((fenster()[0].komponente as { name: string }).name).toBe('CategoryModal');
    expect(fenster()[0].props.category).toBeNull();
    appModalZeigen();
    expect(screen.getByRole('heading', { name: 'Neue Kategorie' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ausflug  ' } });
    await klicken(screen.getByRole('button', { name: 'Kategorie speichern' }));
    expect(h.apiPost).toHaveBeenCalledWith('/admin/categories', { name: 'Ausflug', description: null });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('das Modal der App meldet einen Fehler des Servers weiter oben (setError), wie bisher', async () => {
    h.breit = false;
    h.apiPut.mockRejectedValue({ response: { status: 409, data: { error: 'Kategoriename existiert bereits' } } });
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie anlegen' }));
    // Die Zeile der Liste ist in der Attrappe kein Knopf: das Modal mit der Kategorie, wie die Seite es oeffnet.
    const Komponente = fenster()[0].komponente as React.FC<Record<string, unknown>>;
    render(<Komponente {...fenster()[0].props} category={KATEGORIEN[1]} />);
    expect(screen.getByLabelText('Name')).toHaveValue('Ausflug');
    await klicken(screen.getByRole('button', { name: 'Kategorie speichern' }));
    expect(h.apiPut).toHaveBeenCalledWith('/admin/categories/2', { name: 'Ausflug', description: null });
    expect(h.setError).toHaveBeenCalledWith('Kategoriename existiert bereits');
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('Level im Browser: eigener Dialog', () => {
  it('Felder wie in der App, vorbelegt mit dem Level: Titel, Punkte, Beschreibung, Icon und Farbe', () => {
    render(<AdminLevelsPage />);
    fireEvent.click(erster('Fleißig bearbeiten'));
    const d = dialog('Level bearbeiten');
    expect(feld(d, 'Titel')).toHaveValue('Fleißig');
    expect(feld(d, 'Benötigte Punkte')).toHaveValue(12);
    expect(feld(d, 'Benötigte Punkte')).toHaveAttribute('min', '0');
    expect(feld(d, 'Beschreibung')).toHaveValue('');
    expect(within(d).getByRole('group', { name: 'Icon' })).toHaveTextContent('Pokal (Erfolg)');
    expect(within(d).getByRole('button', { name: 'Pokal' })).toHaveAttribute('aria-pressed', 'true');
    expect(feld(d, 'Level-Farbe')).toHaveValue('#3b82f6');
    expect(knopf(d, 'Speichern')).toHaveAttribute('type', 'submit');
  });

  it('ein neues Level: leerer Titel, 0 Punkte, Pokal; das Farbfeld zeigt die Farbe der Level (#ec4899) statt Schwarz', () => {
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level' }));
    const d = dialog('Neues Level');
    expect(feld(d, 'Titel')).toHaveValue('');
    expect(feld(d, 'Benötigte Punkte')).toHaveValue(0);
    expect(within(d).getByRole('button', { name: 'Pokal' })).toHaveAttribute('aria-pressed', 'true');
    expect(feld(d, 'Level-Farbe')).toHaveValue('#ec4899');
    expect(knopf(d, 'Anlegen')).toBeEnabled();
  });

  it('Pruefen: ohne Titel und ohne Punkte je eine Meldung im Dialog; nichts geht hinaus', async () => {
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level' }));
    const d = dialog('Neues Level');
    await klicken(knopf(d, 'Anlegen'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Titel ist erforderlich');
    tippen(d, 'Titel', 'Gold');
    tippen(d, 'Benötigte Punkte', '');
    await klicken(knopf(d, 'Anlegen'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Benötigte Punkte müssen eine ganze Zahl ab 0 sein');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('Anlegen schickt POST /levels mit Namen aus dem Titel, Punkten, Icon aus einer anderen Kategorie und gewaehlter Farbe', async () => {
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level' }));
    const d = dialog('Neues Level');
    tippen(d, 'Titel', ' Gold-Meister ');
    tippen(d, 'Benötigte Punkte', '30');
    tippen(d, 'Beschreibung', 'Fast am Ziel');
    fireEvent.click(within(d).getByRole('button', { name: 'Natur' }));
    const natur = within(d).getByRole('group', { name: 'Icon: Natur' });
    fireEvent.click(within(natur).getByRole('button', { name: 'Sonne' }));
    expect(within(natur).getByRole('button', { name: 'Sonne' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(d).getByRole('group', { name: 'Icon' })).toHaveTextContent('Sonne (Natur)');
    fireEvent.input(feld(d, 'Level-Farbe'), { target: { value: '#f59e0b' } });
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledWith('/levels', {
      name: 'gold_meister',
      title: 'Gold-Meister',
      description: 'Fast am Ziel',
      points_required: 30,
      icon: 'sunny',
      color: '#f59e0b',
      reward_type: null,
      reward_value: null,
      is_active: true,
    });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ohne gewaehlte Farbe geht die angezeigte Farbe der Level als #rrggbb hinaus, nicht das Token', async () => {
    // Der Server speichert die Farbe in levels.color varchar(7): Das Token
    // var(--app-color-level) brach dort mit 500 ab (Gegenpruefung, 11.10.2026).
    // Gesendet wird, was das Farbfeld zeigt -- auch ohne geladenes Stylesheet.
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level' }));
    const d = dialog('Neues Level');
    expect(feld(d, 'Level-Farbe')).toHaveValue('#ec4899');
    tippen(d, 'Titel', 'Start');
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledWith('/levels', {
      name: 'start',
      title: 'Start',
      description: '',
      points_required: 0,
      icon: 'trophy',
      color: '#ec4899',
      reward_type: null,
      reward_value: null,
      is_active: true,
    });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Bearbeiten schickt PUT /levels/:id mit dem gespeicherten Namen; ein Fehler des Servers steht im Dialog', async () => {
    h.apiPut.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Ein Level mit dieser Punktzahl existiert bereits' } } });
    render(<AdminLevelsPage />);
    fireEvent.click(erster('Fleißig bearbeiten'));
    const d = dialog('Level bearbeiten');
    tippen(d, 'Benötigte Punkte', '0');
    await klicken(knopf(d, 'Speichern'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Ein Level mit dieser Punktzahl existiert bereits');
    expect(h.refresh).not.toHaveBeenCalled();
    tippen(d, 'Benötigte Punkte', '15');
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).toHaveBeenLastCalledWith('/levels/2', {
      name: 'fleissig',
      title: 'Fleißig',
      description: '',
      points_required: 15,
      icon: 'trophy',
      color: '#3b82f6',
      reward_type: null,
      reward_value: null,
      is_active: true,
    });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Abbrechen schickt nichts', () => {
    render(<AdminLevelsPage />);
    fireEvent.click(erster('Fleißig bearbeiten'));
    tippen(dialog('Level bearbeiten'), 'Titel', 'Fleißiger');
    fireEvent.click(knopf(dialog('Level bearbeiten'), 'Abbrechen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis, und das Bearbeiten geht wie in der App in die Warteschlange', async () => {
    h.online = false;
    render(<AdminLevelsPage />);
    fireEvent.click(erster('Fleißig bearbeiten'));
    const d = dialog('Level bearbeiten');
    expect(within(d).getByRole('status')).toHaveTextContent(OFFLINE);
    tippen(d, 'Titel', 'Sehr fleißig');
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/levels/2',
      body: {
        name: 'fleissig', title: 'Sehr fleißig', description: '', points_required: 12, icon: 'trophy', color: '#3b82f6',
        reward_type: null, reward_value: null, is_active: true,
      },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: 'kennung-1', label: 'Level bearbeiten' },
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Level wird aktualisiert sobald du wieder online bist');
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('schmal: das Modal der App mit derselben Logik -- Titel, Regler, Haken schicken denselben Koerper', async () => {
    h.breit = false;
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level anlegen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fenster()[0].komponente).toBe(LevelManagementModal);
    appModalZeigen();
    expect(screen.getByRole('heading', { name: 'Neues Level' })).toBeInTheDocument();
    // Ohne Titel bleibt der Haken gesperrt, wie bisher.
    expect(screen.getByRole('button', { name: 'Level speichern' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Gold-Meister' } });
    fireEvent.change(screen.getByLabelText('Benötigte Punkte'), { target: { value: '30' } });
    await klicken(screen.getByRole('button', { name: 'Sonne' }));
    await klicken(screen.getByRole('button', { name: 'Level speichern' }));
    // Die App schickt ohne Farbwahl weiter das Token, wie vor dem Herausziehen
    // der Logik. Der Server lehnt es ab (levels.color varchar(7), 500) -- ein
    // offener Befund der App, zu beheben in einem eigenen Commit mit Test;
    // der Dialog im Browser schickt #rrggbb (Test oben).
    expect(h.apiPost).toHaveBeenCalledWith('/levels', {
      name: 'gold_meister', title: 'Gold-Meister', description: '', points_required: 30, icon: 'sunny',
      color: 'var(--app-color-level)', reward_type: null, reward_value: null, is_active: true,
    });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
describe('Zertifikat im Browser: eigener Dialog', () => {
  it('Felder vorbelegt: Name und Icon; ein neues Zertifikat beginnt mit dem Band', () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(erster('Erste-Hilfe-Kurs bearbeiten'));
    const d = dialog('Zertifikat bearbeiten');
    expect(feld(d, 'Name')).toHaveValue('Erste-Hilfe-Kurs');
    expect(feld(d, 'Name')).toHaveAttribute('placeholder', 'z.B. JuLeiCa, Teamer-Card');
    const icon = within(d).getByRole('group', { name: 'Icon' });
    expect(icon).toHaveTextContent('Erste Hilfe');
    fireEvent.click(knopf(d, 'Abbrechen'));
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat' }));
    const neu = dialog('Neues Zertifikat');
    expect(feld(neu, 'Name')).toHaveValue('');
    expect(within(neu).getByRole('group', { name: 'Icon' })).toHaveTextContent('Band (Erfolg)');
    expect(within(neu).getByRole('button', { name: 'Band' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ohne Namen: Meldung im Dialog, nichts geht hinaus', async () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat' }));
    const d = dialog('Neues Zertifikat');
    await klicken(knopf(d, 'Anlegen'));
    expect(within(d).getByRole('alert')).toHaveTextContent('Name ist erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('Anlegen schickt POST /teamer/certificate-types mit Name und Icon, Bearbeiten PUT mit der Kennung', async () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat' }));
    const d = dialog('Neues Zertifikat');
    tippen(d, 'Name', ' Kinderschutz ');
    fireEvent.click(within(d).getByRole('button', { name: 'Schild' }));
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledWith('/teamer/certificate-types', { name: 'Kinderschutz', icon: 'shield' });
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(erster('JuLeiCa bearbeiten'));
    const b = dialog('Zertifikat bearbeiten');
    tippen(b, 'Name', 'JuLeiCa 2027');
    await klicken(knopf(b, 'Speichern'));
    expect(h.apiPut).toHaveBeenCalledWith('/teamer/certificate-types/1', { name: 'JuLeiCa 2027', icon: 'ribbon' });
    expect(h.refresh).toHaveBeenCalledTimes(2);
  });

  it('Abbrechen schickt nichts', () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(erster('JuLeiCa bearbeiten'));
    fireEvent.click(knopf(dialog('Zertifikat bearbeiten'), 'Abbrechen'));
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ohne Netz: Hinweis, und das Anlegen geht in die Warteschlange', async () => {
    h.online = false;
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat' }));
    const d = dialog('Neues Zertifikat');
    expect(within(d).getByRole('status')).toHaveTextContent(OFFLINE);
    tippen(d, 'Name', 'Kinderschutz');
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'POST',
      url: '/teamer/certificate-types',
      body: { name: 'Kinderschutz', icon: 'ribbon' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: 'kennung-1', label: 'Zertifikat erstellen' },
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Wird gespeichert sobald du wieder online bist');
  });

  it('schmal: das Modal der App mit derselben Logik', async () => {
    h.breit = false;
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat anlegen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((fenster()[0].komponente as { name: string }).name).toBe('CertificateModal');
    appModalZeigen();
    expect(screen.getByRole('heading', { name: 'Neues Zertifikat' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kinderschutz' } });
    await klicken(screen.getByRole('button', { name: 'Schild' }));
    await klicken(screen.getByRole('button', { name: 'Zertifikat speichern' }));
    expect(h.apiPost).toHaveBeenCalledWith('/teamer/certificate-types', { name: 'Kinderschutz', icon: 'shield' });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });
});
