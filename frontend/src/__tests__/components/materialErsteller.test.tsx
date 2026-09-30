// BEARBEITEN NUR DURCH DIE ERSTELLENDE PERSON (Entscheidung Simon, 01.09.2026)
// -- gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test,
// 30.09.2026 umgestellt).
//
//   "Admins sehen Material ihrer Jahrgaenge und globales Material.
//    Material bearbeiten kann nur der Ersteller!"
//
// Die verbindliche Prüfung macht der Server (403). Diese Tests halten fest,
// dass die Oberfläche den Unterschied ZEIGT, statt Knöpfe anzubieten, die mit
// 403 enden: Der Löschen-Wisch erscheint nur bei der erstellenden Person
// (oder der Leitung), das Formular öffnet sonst schreibgeschützt.
//
// Gerendert werden die echte Materialliste der Leitung und das echte
// Formular (Muster wie materialMedienGemeinsam: echtes Ionic, gestellt sind
// Server, Dateisystem, Anmeldung; das Öffnen des Formulars wird mitgeschrieben).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(async () => ({ data: {} })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../utils/haptics', () => ({ haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT' }, triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));

let angemeldet: Record<string, unknown> = { id: 4, organization_id: 1, role_name: 'admin' };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
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

// Das Formular der Liste: mitschreiben, womit es geöffnet würde.
let formular: { nurLesen?: boolean } | null = null;
const formularZeigen = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: (_k: unknown, props: { nurLesen?: boolean }) => {
    if (props && 'nurLesen' in props) formular = props;
    return [formularZeigen, vi.fn()];
  },
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

import AdminMaterialPage from '../../components/admin/pages/AdminMaterialPage';
import MaterialFormModal from '../../components/admin/modals/MaterialFormModal';
import { darfMaterialBearbeiten } from '../../utils/materialRechte';

const VON_ANNA = { id: 5, title: 'Freizeit-Ablauf', file_count: 1, created_at: '2026-09-01T10:00:00Z', created_by: 4, ist_global: true };
const detail = (zusatz: Record<string, unknown> = {}) => ({
  id: 5, title: 'Freizeit-Ablauf', description: 'Alles für die Freizeit', created_at: '2026-09-01T10:00:00Z',
  created_by: 4, created_by_name: 'Anna Admin', links: [],
  files: [{ id: 1, original_name: 'plan.pdf', stored_name: 'a'.repeat(64), mime_type: 'application/pdf', file_size: 2_400, created_at: '2026-09-01T10:00:00Z' }],
  ...zusatz,
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  formular = null;
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => {
    if (route === '/material') return { data: [VON_ANNA] };
    if (route === '/material/5') return { data: detail() };
    return { data: [] };
  });
});
afterEach(() => cleanup());

describe('darfMaterialBearbeiten (Spiegel der Server-Regel)', () => {
  const ersteller = { id: 4, role_name: 'admin' };
  const andererAdmin = { id: 7, role_name: 'admin' };
  const leitung = { id: 5, role_name: 'org_admin' };
  const superFlag = { id: 8, role_name: 'admin', is_super_admin: true };

  it('die erstellende Person darf ihr Material bearbeiten', () => {
    expect(darfMaterialBearbeiten(ersteller, { created_by: 4 })).toBe(true);
  });
  it('ein anderer Admin derselben Gemeinde darf NICHT', () => {
    expect(darfMaterialBearbeiten(andererAdmin, { created_by: 4 })).toBe(false);
  });
  it('org_admin darf fremdes Material bearbeiten', () => {
    expect(darfMaterialBearbeiten(leitung, { created_by: 4 })).toBe(true);
  });
  it('das is_super_admin-Flag zählt wie org_admin', () => {
    expect(darfMaterialBearbeiten(superFlag, { created_by: 4 })).toBe(true);
  });
  it('created_by null (Konto gelöscht): nur noch die Leitung', () => {
    expect(darfMaterialBearbeiten(andererAdmin, { created_by: null })).toBe(false);
    expect(darfMaterialBearbeiten(leitung, { created_by: null })).toBe(true);
  });
  it('created_by fehlt (alter Offline-Cache): wie null behandeln', () => {
    expect(darfMaterialBearbeiten(andererAdmin, {})).toBe(false);
    expect(darfMaterialBearbeiten(leitung, {})).toBe(true);
  });
  it('ohne angemeldete Person darf niemand', () => {
    expect(darfMaterialBearbeiten(null, { created_by: 4 })).toBe(false);
  });
});

const liste = async () => {
  const r = render(<AdminMaterialPage />);
  await screen.findByText('Freizeit-Ablauf');
  return r;
};
const loeschWisch = (c: HTMLElement) => c.querySelector('[aria-label="Material löschen"]');
const oeffneMaterial = async () => {
  await act(async () => { fireEvent.click(screen.getByText('Freizeit-Ablauf').closest('ion-item')!); });
  for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
};

describe('Leitungsliste: Löschen und Bearbeiten nur mit Recht', () => {
  it('VERBOTEN: ein anderer Admin sieht keinen Löschen-Wisch und bekommt das Formular schreibgeschützt', async () => {
    angemeldet = { id: 7, organization_id: 1, role_name: 'admin' };
    const { container } = await liste();
    expect(loeschWisch(container)).toBeNull();
    await oeffneMaterial();
    expect(apiGet).toHaveBeenCalledWith('/material/5');
    expect(formularZeigen).toHaveBeenCalledTimes(1);
    expect(formular?.nurLesen).toBe(true);
  });

  it('ERLAUBT: die erstellende Person hat den Wisch und ein bearbeitbares Formular', async () => {
    angemeldet = { id: 4, organization_id: 1, role_name: 'admin' };
    const { container } = await liste();
    expect(loeschWisch(container)).not.toBeNull();
    await oeffneMaterial();
    expect(formular?.nurLesen).toBe(false);
  });

  it('ERLAUBT: die Gemeindeleitung darf fremdes Material', async () => {
    angemeldet = { id: 5, organization_id: 1, role_name: 'org_admin' };
    const { container } = await liste();
    expect(loeschWisch(container)).not.toBeNull();
    await oeffneMaterial();
    expect(formular?.nurLesen).toBe(false);
  });
});

describe('Formular: Schreibschutz ohne Bearbeitungsrecht', () => {
  const zeige = (props: Record<string, unknown>) =>
    render(<MaterialFormModal material={detail() as never} onClose={vi.fn()} onSuccess={vi.fn()} {...props} />);

  it('ohne Recht: Titel "Material ansehen", kein Speichern, kein Datei-Löschen, kein Hochladen', () => {
    const { container } = zeige({ nurLesen: true });
    expect(screen.getByText('Material ansehen')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Material speichern"]')).toBeNull();
    expect(container.querySelector('[aria-label="Datei löschen"]')).toBeNull();
    expect(screen.queryByText('Datei auswählen')).toBeNull();
    // Die Datei selbst bleibt zu sehen.
    expect(screen.getByText('plan.pdf')).toBeInTheDocument();
  });

  it('der Hinweis nennt die erstellende Person', () => {
    zeige({ nurLesen: true });
    expect(screen.getByText('Angelegt von Anna Admin. Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.')).toBeInTheDocument();
  });

  it('... und sagt es, wenn ihr Konto gelöscht ist', () => {
    render(<MaterialFormModal material={detail({ created_by: null, created_by_name: null }) as never} nurLesen onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByText('Das Konto der erstellenden Person wurde gelöscht. Bearbeiten und löschen kann nur noch die Gemeindeleitung.')).toBeInTheDocument();
  });

  it('mit Recht: "Material bearbeiten", Speichern, Datei-Löschen und Hochladen sind da, kein Hinweis', () => {
    const { container } = zeige({ nurLesen: false });
    expect(screen.getByText('Material bearbeiten')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Material speichern"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Datei löschen"]')).not.toBeNull();
    expect(screen.getByText('Datei auswählen')).toBeInTheDocument();
    expect(screen.queryByText(/Bearbeiten und löschen kann nur/)).toBeNull();
  });
});

void React;
