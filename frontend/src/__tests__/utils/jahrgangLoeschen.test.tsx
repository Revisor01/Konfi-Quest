// Die Rueckfrage vor dem Loeschen eines Jahrgangs nennt, was mitgeht
// (28.09.2026). Seit das Loeschen die Events und Challenges des Jahrgangs
// mitnimmt (Simon, 28.09.2026), darf die Rueckfrage nicht mehr nur vom
// Chatverlauf sprechen -- sonst loescht jemand zwanzig Termine, weil er einen
// leeren Jahrgang vermutet hat.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { jahrgangLoeschHinweis, istLoeschVorschau, type JahrgangLoeschVorschau } from '../../utils/jahrgangLoeschen';

const leer: JahrgangLoeschVorschau = {
  aktive_konfis: 0, befoerderte: 0, chat_nachrichten: 0,
  events_geloescht: 0, events_kuenftig: 0, events_behalten: 0,
  challenges_geloescht: 0, challenges_behalten: 0
};

describe('jahrgangLoeschHinweis', () => {
  it('nennt die Zahl der Events und Challenges, die mitgehen, und die kuenftigen darunter', () => {
    const text = jahrgangLoeschHinweis('2023/2024', { ...leer, events_geloescht: 12, events_kuenftig: 2, challenges_geloescht: 3 });
    expect(text).toContain('Jahrgang "2023/2024" wirklich löschen?');
    expect(text).toContain('Mit dem Jahrgang werden 12 Events und 3 Challenges gelöscht — samt Anmeldungen, Chats und Beiträgen.');
    expect(text).toContain('2 Events liegen noch in der Zukunft.');
    expect(text).toContain('Stempel, die Teamer:innen und Leitung in diesen Challenges bekommen haben, bleiben ihnen erhalten.');
    expect(text).toContain('Das lässt sich nicht rückgängig machen.');
  });

  it('spricht die Einzahl richtig aus', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, events_geloescht: 1, events_kuenftig: 1, challenges_geloescht: 1, befoerderte: 1 });
    expect(text).toContain('Mit dem Jahrgang werden 1 Event und 1 Challenge gelöscht');
    expect(text).toContain('Ein Event liegt noch in der Zukunft.');
    expect(text).toContain('1 zur Teamer:in beförderte Konfi behält ihre Konfi-Zeit mit Punkten und Badges.');
  });

  it('sagt, was bleibt: Events und Challenges anderer Jahrgaenge verlieren nur die Zuordnung', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, events_behalten: 2, challenges_behalten: 1 });
    expect(text).toContain('Zum Jahrgang gehören keine eigenen Events und Challenges.');
    expect(text).toContain('2 Events und 1 Challenge gehören auch zu anderen Jahrgängen oder dem Team und bleiben bestehen; nur die Zuordnung zu diesem Jahrgang fällt weg.');
    expect(text).not.toContain('Stempel');
  });

  it('nennt das Material, das danach das ganze Team sieht (Simon, 28.09.2026: "Material wird global ja.")', () => {
    const viele = jahrgangLoeschHinweis('A', { ...leer, material_global: 3 });
    expect(viele).toContain('3 Materialien gehören nur zu diesem Jahrgang. Sie bleiben erhalten und sind danach für das ganze Team sichtbar.');
    const eins = jahrgangLoeschHinweis('A', { ...leer, material_global: 1 });
    expect(eins).toContain('1 Material gehört nur zu diesem Jahrgang. Es bleibt erhalten und ist danach für das ganze Team sichtbar.');
  });

  it('ohne betroffenes Material oder ohne das Feld (Vorschau vom 28.09.) steht kein Material-Satz', () => {
    expect(jahrgangLoeschHinweis('A', { ...leer, material_global: 0 })).not.toContain('Material');
    expect(jahrgangLoeschHinweis('A', leer)).not.toContain('Material');
  });

  it('warnt vor aktiven Konfis, die das Loeschen blockieren', () => {
    const text = jahrgangLoeschHinweis('A', { ...leer, aktive_konfis: 12 });
    expect(text).toContain('Dem Jahrgang sind noch 12 aktive Konfis zugeordnet — solange ist das Löschen nicht möglich.');
  });

  it('ohne Vorschau (aelterer Server) steht die allgemeine Fassung -- ohne Zahlen, aber mit Events und Challenges', () => {
    const text = jahrgangLoeschHinweis('A', null);
    expect(text).toContain('die Events und Challenges, die nur zu ihm gehören, werden unwiderruflich entfernt');
    expect(text).toContain('Material, das nur zu ihm gehört, bleibt und ist danach für das ganze Team sichtbar.');
    expect(text).not.toMatch(/\d+ Events?/);
  });
});

describe('istLoeschVorschau', () => {
  it('nimmt nur vollstaendige Antworten', () => {
    expect(istLoeschVorschau(leer)).toBe(true);
    expect(istLoeschVorschau({ ...leer, material_global: 2 })).toBe(true);
    expect(istLoeschVorschau({ ...leer, events_geloescht: '3' })).toBe(false);
    expect(istLoeschVorschau({ aktive_konfis: 0 })).toBe(false);
    expect(istLoeschVorschau(null)).toBe(false);
    expect(istLoeschVorschau([])).toBe(false);
  });
});

// Die Seite gerendert: Loesch-Wisch antippen -> Vorschau vom Server holen ->
// Rueckfrage mit genau dem Text aus jahrgangLoeschHinweis.
const apiGet = vi.fn();
const presentAlert = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: 'org_admin' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [{ id: 4, name: '2023/2024', created_at: '2026-08-01T00:00:00Z', konfi_count: 0 }],
    loading: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));
vi.mock('../../services/api', () => ({
  default: { get: (url: string) => apiGet(url), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ rechts }: { rechts?: React.ReactNode }) => <header>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch, IonContent: durch,
    IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null, IonSpinner: () => null,
    IonList: durch, IonListHeader: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch,
    IonItemOptions: durch, IonToggle: () => null, IonRange: () => null, IonInput: () => null,
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref} data-testid="jahrgang">{children}</div>),
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [presentAlert],
  };
});

import AdminJahrgaengeePage from '../../components/admin/pages/AdminJahrgaengeePage';

describe('AdminJahrgaengeePage fragt mit Zahlen nach', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const loeschenAntippen = async () => {
    render(<AdminJahrgaengeePage />);
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('jahrgang')).getByRole('button', { name: 'Jahrgang löschen' }));
    });
    await waitFor(() => expect(presentAlert).toHaveBeenCalledTimes(1));
    return presentAlert.mock.calls[0][0] as { header: string; message: string };
  };

  it('holt die Vorschau und baut den Text daraus', async () => {
    const vorschau = { ...leer, events_geloescht: 12, events_kuenftig: 2, challenges_geloescht: 3 };
    apiGet.mockResolvedValue({ data: vorschau });
    const rueckfrage = await loeschenAntippen();
    expect(apiGet).toHaveBeenCalledWith('/admin/jahrgaenge/4/loeschvorschau');
    expect(rueckfrage.header).toBe('Jahrgang löschen');
    expect(rueckfrage.message).toBe(jahrgangLoeschHinweis('2023/2024', vorschau));
    expect(rueckfrage.message).toContain('Mit dem Jahrgang werden 12 Events und 3 Challenges gelöscht');
  });

  it('ohne Antwort des Servers steht die allgemeine Fassung', async () => {
    apiGet.mockRejectedValue(new Error('Netz weg'));
    const rueckfrage = await loeschenAntippen();
    expect(rueckfrage.message).toBe(jahrgangLoeschHinweis('2023/2024', null));
  });

  it('eine unvollstaendige Antwort (aelterer Server) gilt nicht als Vorschau', async () => {
    apiGet.mockResolvedValue({ data: { aktive_konfis: 0 } });
    const rueckfrage = await loeschenAntippen();
    expect(rueckfrage.message).toBe(jahrgangLoeschHinweis('2023/2024', null));
  });

  it('der alte Text, der nur vom Chatverlauf sprach, ist weg', async () => {
    apiGet.mockResolvedValue({ data: leer });
    const rueckfrage = await loeschenAntippen();
    expect(rueckfrage.message).not.toContain('Der Jahrgang und sein Chatverlauf werden unwiderruflich entfernt.');
  });
});
