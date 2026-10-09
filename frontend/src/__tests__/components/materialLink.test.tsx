// Material kann seit dem 31.08.2026 statt Dateien auch einen Link tragen
// (Simons Entscheidung), seit dem 01.09.2026 beliebig viele Links UND
// Dateien parallel. Anlass: Fuer das inhaltliche Programm entstehen eigene
// Seiten (konfi-quest.de/gottesbilder), die sich direkt am Material
// verknuepfen lassen sollen.
//
// Festgehalten wird:
//   1. Das Formular der Leitung fuehrt Links als Liste (kein Datei-oder-Link-
//      und kein Sichtbarkeits-Umschalter), prueft jede Adresse und schickt
//      link_urls -- Dateien laufen unabhaengig davon.
//   2. Ein Link bekommt ein EIGENES Icon, damit er sich vom Dateianhang
//      unterscheidet (Vorgabe: IonIcon, keine Emojis).
//   3. Er wird nur gezeigt, wenn er http/https ist, und oeffnet EXTERN.
//
// Seit dem 09.10.2026 gerendert (vorher Quelltext): das echte Formular, die
// echten Materialseiten der Leitung und des Teams und die Detailseite des
// Teams. Die Material-Liste am Termin steht in materialLinkAmTermin.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { istWebLink, hostAus, materialLinks } from '../../utils/linkDisplay';
import { ICON_LINK, ICON_DATEI_GEFUELLT } from '../../components/shared/icons';

import { knopf } from '../medienAttrappen';

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn(async (..._a: unknown[]) => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    put: (...a: unknown[]) => apiPut(...a),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' }, triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));
const setError = vi.fn();
let angemeldet: Record<string, unknown> = { id: 4, organization_id: 1, role_name: 'admin' };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: vi.fn() }));
vi.mock('../../components/shared/OrgSwitcherButton', () => ({ default: () => null }));
vi.mock('../../components/shared/PostfachGlocke', () => ({ default: () => null }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
const gewaehlt: { dateien: File[] | null } = { dateien: null };
const linkOeffnen = vi.fn();
vi.mock('../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../services/systemDialoge')>()),
  dateiAuswaehlen: vi.fn(async () => gewaehlt.dateien),
  linkOeffnen: (...a: unknown[]) => linkOeffnen(...a),
}));
const geschlossen = vi.fn();
vi.mock('../../utils/slidingItems', () => ({ closeOpenSlidingItems: () => geschlossen() }));

vi.mock('@ionic/react', async (original) => {
  const echt = await original<typeof import('@ionic/react')>();
  // IonInput als schlichtes <input>: ionInput erreicht in jsdom die
  // React-Handler nicht (siehe anmeldeseitenBarrierefrei.test.tsx).
  const Eingabe = ({ label, value, onIonInput, readonly }: {
    label?: string; value?: string; readonly?: boolean; onIonInput?: (e: { detail: { value: string } }) => void;
  }) => (
    <input aria-label={label} value={value ?? ''} readOnly={readonly}
      onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
  );
  return {
    ...echt,
    IonInput: Eingabe,
    // Das Symbol sichtbar machen: Link oder Datei.
    IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
  };
});

import MaterialFormModal from '../../components/admin/modals/MaterialFormModal';
import AdminMaterialPage from '../../components/admin/pages/AdminMaterialPage';
import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';
import TeamerMaterialDetailPage from '../../components/teamer/pages/TeamerMaterialDetailPage';

const brief = new File(['%PDF-1.7 Elternbrief'], 'Elternbrief.pdf', { type: 'application/pdf' });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  angemeldet = { id: 4, organization_id: 1, role_name: 'admin' };
  gewaehlt.dateien = null;
  apiGet.mockReset();
  apiGet.mockImplementation(async () => ({ data: [] }));
  apiPost.mockReset();
  apiPost.mockImplementation(async (route: string) => (route === '/material' ? { data: { id: 9 } } : { data: [] }));
});
afterEach(() => cleanup());

// --- Formular der Leitung ------------------------------------------------------

type Material = React.ComponentProps<typeof MaterialFormModal>['material'];

async function formular(material?: Material, nurLesen = false) {
  const onSuccess = vi.fn();
  const ansicht = render(<MaterialFormModal material={material} nurLesen={nurLesen} onClose={vi.fn()} onSuccess={onSuccess} />);
  await act(async () => { await Promise.resolve(); });
  return { ansicht, onSuccess };
}
const titel = async (wert: string) => {
  await act(async () => { fireEvent.change(screen.getByLabelText('Titel'), { target: { value: wert } }); });
};
const adressen = () => screen.queryAllByLabelText(/^Adresse( \d+)?$/) as HTMLInputElement[];
const linkHinzufuegen = async () => { await act(async () => { fireEvent.click(screen.getByText('Link hinzufügen')); }); };
const tippe = async (feld: HTMLInputElement, wert: string) => {
  await act(async () => { fireEvent.change(feld, { target: { value: wert } }); });
};
const speichern = async () => {
  await act(async () => { fireEvent.click(knopf(document.body, 'Material speichern')); });
};
const gesendet = () => apiPost.mock.calls.find(([r]) => r === '/material')?.[1] as Record<string, unknown> | undefined;

describe('Material anlegen: Links und Dateien parallel (Leitung)', () => {
  it('es gibt KEINEN Datei-oder-Link-Umschalter mehr: beide Bereiche stehen zugleich da', async () => {
    await formular();
    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('Datei auswählen')).toBeTruthy();
    expect(document.querySelector('ion-segment')).toBeNull();
    expect(document.querySelector('ion-segment-button')).toBeNull();
  });

  it('es gibt KEINEN Sichtbarkeits-Umschalter mehr und ist_global wird nicht gesendet', async () => {
    // Simons Regel vom 01.09.2026: "wenn kein Jahrgang dann global.
    // Fertig. Sonst nur Jahrgang." Der Server leitet ist_global ab.
    await formular();
    expect(document.querySelector('ion-toggle')).toBeNull();
    await titel('Gottesbilder');
    await speichern();
    await waitFor(() => expect(gesendet()).toBeTruthy());
    expect(Object.keys(gesendet()!).sort()).toEqual(['description', 'event_ids', 'jahrgang_ids', 'link_urls', 'title']);
    expect(gesendet()).not.toHaveProperty('ist_global');
  });

  it('mehrere Links werden als Liste gefuehrt und als link_urls gesendet; leere Felder fallen heraus', async () => {
    await formular();
    expect(adressen()).toHaveLength(0);
    await linkHinzufuegen();
    await linkHinzufuegen();
    await linkHinzufuegen();
    expect(adressen().map((f) => f.getAttribute('aria-label'))).toEqual(['Adresse 1', 'Adresse 2', 'Adresse 3']);
    await tippe(adressen()[0], ' https://konfi-quest.de/gottesbilder ');
    await tippe(adressen()[2], 'https://www.youtube.com/watch?v=abc');
    await titel('Gottesbilder');
    await speichern();
    await waitFor(() => expect(gesendet()).toBeTruthy());
    expect(gesendet()!.link_urls).toEqual(['https://konfi-quest.de/gottesbilder', 'https://www.youtube.com/watch?v=abc']);
  });

  it('bestehende Links kommen aus dem Array', async () => {
    await formular({
      id: 5, title: 'Lieder', created_by: 4,
      links: [{ id: 1, url: 'https://example.org/eins' }, { id: 2, url: 'https://example.org/zwei' }],
      link_url: 'https://example.org/eins',
    } as unknown as Material);
    expect(adressen().map((f) => f.value)).toEqual(['https://example.org/eins', 'https://example.org/zwei']);
  });

  it('... mit link_url als Rueckfall (gecachter Eintrag von vorher)', async () => {
    await formular({ id: 5, title: 'Lieder', created_by: 4, link_url: 'https://example.org/alt' } as unknown as Material);
    expect(adressen().map((f) => f.value)).toEqual(['https://example.org/alt']);
    expect(adressen()[0].getAttribute('aria-label')).toBe('Adresse');
  });

  it('das Formular prueft jede Adresse schon vor dem Absenden', async () => {
    await formular();
    await linkHinzufuegen();
    await linkHinzufuegen();
    await tippe(adressen()[0], 'https://konfi-quest.de/ok');
    await tippe(adressen()[1], 'konfi-quest.de/ohne-schema');
    await titel('Gottesbilder');
    await speichern();
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('Der Link muss mit http:// oder https:// beginnen');
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('Dateien werden unabhaengig von den Links hochgeladen', async () => {
    gewaehlt.dateien = [brief];
    await formular();
    await linkHinzufuegen();
    await tippe(adressen()[0], 'https://konfi-quest.de/gottesbilder');
    await act(async () => { fireEvent.click(screen.getByText('Datei auswählen')); });
    await waitFor(() => expect(screen.getByText('Elternbrief.pdf')).toBeTruthy());
    await titel('Elternabend');
    await speichern();
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    expect(apiPost.mock.calls.map(([r]) => r)).toEqual(['/material', '/material/9/files']);
    expect(gesendet()!.link_urls).toEqual(['https://konfi-quest.de/gottesbilder']);
    const upload = apiPost.mock.calls[1][1] as FormData;
    expect((upload.getAll('files') as File[]).map((d) => d.name)).toEqual(['Elternbrief.pdf']);
  });

  it('nur Links, keine Datei: kein Upload-Aufruf', async () => {
    await formular();
    await linkHinzufuegen();
    await tippe(adressen()[0], 'https://konfi-quest.de/gottesbilder');
    await titel('Gottesbilder');
    await speichern();
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost.mock.calls[0][0]).toBe('/material');
  });
});

describe('materialLinks buendelt neue und alte Antwortform', () => {
  it('liefert alle Links des Arrays in Reihenfolge', () => {
    const m = {
      links: [
        { url: 'https://konfi-quest.de/gottesbilder' },
        { url: 'https://www.youtube.com/watch?v=abc' },
        { url: 'https://www.youtube.com/watch?v=def' },
      ],
      link_url: 'https://konfi-quest.de/gottesbilder',
    };
    expect(materialLinks(m)).toEqual([
      'https://konfi-quest.de/gottesbilder',
      'https://www.youtube.com/watch?v=abc',
      'https://www.youtube.com/watch?v=def',
    ]);
  });

  it('faellt ohne Array auf das Alt-Feld link_url zurueck (gecachte Eintraege)', () => {
    expect(materialLinks({ link_url: 'https://konfi-quest.de/seite' }))
      .toEqual(['https://konfi-quest.de/seite']);
  });

  it('liefert ohne Links ein leeres Array', () => {
    expect(materialLinks({})).toEqual([]);
    expect(materialLinks({ links: [], link_url: null })).toEqual([]);
  });

  it('filtert alles heraus, was kein http/https ist', () => {
    const m = {
      links: [
        { url: 'javascript:alert(1)' },
        { url: 'https://konfi-quest.de/ok' },
      ],
    };
    expect(materialLinks(m)).toEqual(['https://konfi-quest.de/ok']);
  });
});

// --- Anzeige -------------------------------------------------------------------

const LISTE = [
  { id: 1, title: 'Freizeit-Ablauf', file_count: 4, link_url: null, created_at: '2026-09-01T10:00:00Z', created_by: 4 },
  { id: 2, title: 'Gottesbilder', file_count: 0, link_url: 'https://example.org/gottesbilder', created_at: '2026-09-02T10:00:00Z', created_by: 4 },
];
const DETAIL = {
  id: 2, title: 'Gottesbilder', description: null, created_at: '2026-09-02T10:00:00Z', created_by: 4, files: [],
  links: [{ id: 1, url: 'javascript:alert(1)' }, { id: 2, url: 'https://www.example.org/gottesbilder' }],
  link_url: 'javascript:alert(1)',
};
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

/** Das Symbol im Kreis vor dem Titel einer Listenzeile. */
const kreisSymbol = (titelText: string) => {
  const zeile = screen.getByText(titelText).closest('.app-list-item') as HTMLElement;
  return zeile.querySelector('.app-icon-circle i')!.getAttribute('data-icon');
};

describe('Material als Link: Anzeige', () => {
  beforeEach(() => {
    apiGet.mockImplementation(async (route: string) => {
      if (route === '/material') return { data: LISTE };
      if (route === '/material/2') return { data: DETAIL };
      return { data: [] };
    });
  });

  it('die Leitungsliste kennzeichnet Link-Material mit eigenem Icon', async () => {
    render(<AdminMaterialPage />);
    await screen.findByText('Gottesbilder');
    expect(kreisSymbol('Gottesbilder')).toBe(ICON_LINK);
    expect(kreisSymbol('Freizeit-Ablauf')).toBe(ICON_DATEI_GEFUELLT);
  });

  it('die Teamer-Liste ebenso', async () => {
    angemeldet = { id: 9, organization_id: 1, role_name: 'teamer' };
    render(<MemoryRouter initialEntries={['/teamer/profile/material']}><TeamerMaterialPage /></MemoryRouter>);
    await screen.findByText('Gottesbilder');
    expect(kreisSymbol('Gottesbilder')).toBe(ICON_LINK);
    expect(kreisSymbol('Freizeit-Ablauf')).toBe(ICON_DATEI_GEFUELLT);
  });

  /** Die Link-Zeilen einer geoeffneten Detailansicht (unter "Link"/"Links"). */
  const linkZeilen = () => {
    const kopf = screen.getAllByText(/^Links?$/).find((el) => el.closest('ion-list-header'))!;
    const abschnitt = kopf.closest('ion-list') as HTMLElement;
    return [...abschnitt.querySelectorAll<HTMLElement>('.app-list-item')];
  };

  const ansichten: Array<[string, () => Promise<void>]> = [
    ['Teamer-Detailseite', async () => {
      angemeldet = { id: 9, organization_id: 1, role_name: 'teamer' };
      render(<TeamerMaterialDetailPage materialId={2} onClose={vi.fn()} />);
      await screen.findByText('example.org');
    }],
    ['Teamer-Liste (Detailbereich)', async () => {
      angemeldet = { id: 9, organization_id: 1, role_name: 'teamer' };
      render(<MemoryRouter initialEntries={['/teamer/profile/material']}><TeamerMaterialPage /></MemoryRouter>);
      await screen.findByText('Gottesbilder');
      await act(async () => { fireEvent.click(screen.getByText('Gottesbilder')); });
      await screen.findByText('example.org');
    }],
  ];

  it.each(ansichten)('%s zeigt nur http/https-Links, mit Link-Symbol und Domain', async (_name, oeffnen) => {
    await oeffnen();
    const zeilen = linkZeilen();
    expect(zeilen).toHaveLength(1);
    expect(within(zeilen[0]).getByText('example.org')).toBeTruthy();
    expect(zeilen[0].querySelector('.app-icon-circle i')!.getAttribute('data-icon')).toBe(ICON_LINK);
    expect(screen.queryByText(/javascript/)).toBeNull();
    // Nur ein gueltiger Link: die Ueberschrift sagt "Link", nicht "Links".
    expect(screen.getAllByText('Link').some((el) => el.closest('ion-list-header'))).toBe(true);
  });

  it.each(ansichten)('%s oeffnet den Link extern im Browser', async (_name, oeffnen) => {
    await oeffnen();
    await act(async () => { fireEvent.click(linkZeilen()[0]); });
    await waitFor(() => expect(linkOeffnen).toHaveBeenCalledTimes(1));
    expect(linkOeffnen).toHaveBeenCalledWith('https://www.example.org/gottesbilder');
  });

  it.each(ansichten)('%s zeigt keine Emojis fuer den Link', async (_name, oeffnen) => {
    // Vorgabe: IonIcon, keine Emojis.
    await oeffnen();
    expect(EMOJI.test(linkZeilen()[0].textContent ?? '')).toBe(false);
  });

  it('auch die Listenzeilen und das Formular tragen keine Emojis', async () => {
    render(<AdminMaterialPage />);
    await screen.findByText('Gottesbilder');
    const zeile = screen.getByText('Gottesbilder').closest('.app-list-item') as HTMLElement;
    expect(EMOJI.test(zeile.textContent ?? '')).toBe(false);
    cleanup();
    await formular();
    const linkBereich = screen.getByText('Links').closest('ion-list') as HTMLElement;
    expect(EMOJI.test(linkBereich.textContent ?? '')).toBe(false);
  });
});

describe('istWebLink bleibt der Waechter vor dem Oeffnen', () => {
  it('laesst http und https durch', () => {
    expect(istWebLink('https://konfi-quest.de/gottesbilder')).toBe(true);
    expect(istWebLink('http://gemeinde.example/seite')).toBe(true);
  });

  it('weist alles andere ab', () => {
    expect(istWebLink('javascript:alert(1)')).toBe(false);
    expect(istWebLink('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(istWebLink('file:///etc/passwd')).toBe(false);
    expect(istWebLink('konfi-quest.de/gottesbilder')).toBe(false);
    expect(istWebLink(null)).toBe(false);
    expect(istWebLink('')).toBe(false);
  });

  it('beschriftet wird mit der Domain, nicht der vollen Adresse', () => {
    expect(hostAus('https://konfi-quest.de/gottesbilder')).toBe('konfi-quest.de');
    expect(hostAus('https://www.konfi-quest.de/gottesbilder')).toBe('konfi-quest.de');
  });
});

describe('Link-Zeilen im Material-Modal: entfernen per Wischen', () => {
  // Simons Hinweis 03.09.2026: Im Material-Modal stand als letzte Stelle
  // noch ein Muelleimer-Knopf direkt in der Link-Zeile. Ueberall sonst in
  // der App -- auch bei den Dateien im selben Modal -- liegt das Loeschen
  // unter der Wischgeste.
  const zweiLinks = {
    id: 5, title: 'Lieder', created_by: 4,
    links: [{ id: 1, url: 'https://example.org/eins' }, { id: 2, url: 'https://example.org/zwei' }],
  } as unknown as Material;
  const wischzeile = (feld: HTMLElement) => feld.closest('ion-item-sliding') as HTMLElement;

  it('die Link-Zeile liegt in einer Wischzeile mit Optionen am Ende', async () => {
    await formular(zweiLinks);
    for (const feld of adressen()) {
      const wisch = wischzeile(feld);
      expect(wisch).not.toBeNull();
      const optionen = wisch.querySelector('ion-item-options');
      // Ionic setzt seine Werte als Eigenschaft des Elements, nicht als Attribut.
      expect((optionen as unknown as { side?: string }).side).toBe('end');
      expect(optionen!.classList.contains('app-swipe-actions')).toBe(true);
    }
  });

  it('das Entfernen haengt an der Wisch-Option: genau dieser Link geht, die Zeile schliesst', async () => {
    await formular(zweiLinks);
    const option = wischzeile(adressen()[0]).querySelector('ion-item-option[aria-label="Link entfernen"]') as HTMLElement;
    expect(option.classList.contains('app-swipe-action')).toBe(true);
    await act(async () => { fireEvent.click(option); });
    expect(adressen().map((f) => f.value)).toEqual(['https://example.org/zwei']);
    expect(geschlossen).toHaveBeenCalledTimes(1);
  });

  it('in der Zeile steht kein Loeschknopf mehr', async () => {
    // Gegenprobe: Der alte Muelleimer sass als IonButton mit slot="end"
    // direkt neben dem Eingabefeld.
    await formular(zweiLinks);
    const item = adressen()[0].closest('ion-item') as HTMLElement;
    expect(item.querySelector('ion-button')).toBeNull();
    expect(item.querySelector('[slot="end"]')).toBeNull();
  });

  it('nutzt dieselbe Darstellung wie die Datei-Zeilen: roter Kreis', async () => {
    await formular(zweiLinks);
    const option = wischzeile(adressen()[0]).querySelector('ion-item-option')!;
    const kreis = option.querySelector('.app-icon-circle');
    expect(kreis!.classList.contains('app-icon-circle--danger')).toBe(true);
  });

  it('im Lese-Modus deckt Wischen nichts auf, Felder sind schreibgeschuetzt, kein Hinzufuegen', async () => {
    // Ohne Bearbeitungsrecht gibt es nichts zu entfernen.
    await formular(zweiLinks, true);
    expect(adressen()).toHaveLength(2);
    for (const feld of adressen()) {
      // Hinter der Zeile liegt keine Option: Wischen deckt nichts auf.
      expect(wischzeile(feld).querySelector('ion-item-option')).toBeNull();
      expect(feld.readOnly).toBe(true);
    }
    expect(screen.queryByText('Link hinzufügen')).toBeNull();
  });
});
