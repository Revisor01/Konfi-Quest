// Gerüst für gerenderte Tests der Einladungsseite der Leitung (AdminInvitePage).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 09.10.2026): einladungVerlaengernRueckmeldung und
// einladungsGueltigkeit prüfen dieselbe Seite -- Gültigkeit beim Anlegen,
// Verlängern mit Auswahl, Rückmeldung während des Aufrufs.
//
// EINBINDEN: Dieses Modul als ERSTES importieren:
//
//   import { seiteOeffnen, zustand, api, ... } from './gerueste/einladungSeite';
//
// Gerendert wird die ECHTE Seite (App-Fassung, nicht die breite Web-Fassung).
// Nachgestellt sind Server, Offline-Cache (ruft den echten Abruf der Seite),
// QR-Code-Erzeugung, Ionic (schlichte Elemente: IonSelect ist ein <select>,
// eine Wisch-Option ein Knopf mit ihrem Namen, IonSpinner ein
// data-testid="spinner", IonIcon zeigt sein Symbol als data-icon) und der
// Bestätigungsdialog (seine Optionen merkt sich der Test).
import React, { useCallback, useEffect, useState } from 'react';
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';

export interface Einladung {
  id: number;
  invite_code: string;
  jahrgang_id: number;
  jahrgang_name: string;
  expires_at: string;
  used_count: number;
}

export const zustand = {
  jahrgaenge: [{ id: 1, name: '2026/27' }, { id: 2, name: '2027/28' }],
  einladungen: [] as Einladung[],
};

export const api = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
export const setSuccess = vi.fn();
export const setError = vi.fn();

export interface DialogKnopf { text: string; role?: string; handler?: (wert?: unknown) => unknown }
export interface DialogOptionen {
  header?: string;
  message?: string;
  inputs?: Array<{ type: string; label: string; value: unknown; checked?: boolean }>;
  buttons: Array<DialogKnopf | string>;
}
export const dialoge: DialogOptionen[] = [];
export const letzterDialog = () => dialoge[dialoge.length - 1];

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    delete: (...a: unknown[]) => api.delete(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, organization_id: 1, role_name: 'admin' }, setSuccess, setError, isOnline: true }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));
vi.mock('../../../utils/slidingItems', () => ({ closeOpenSlidingItems: vi.fn() }));
// Der Offline-Cache ruft den echten Abruf der Seite; refresh ruft ihn erneut.
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: <T,>(_schluessel: string, abruf: () => Promise<T>) => {
    const [data, setData] = useState<T | null>(null);
    const refresh = useCallback(async () => { setData(await abruf()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { void refresh(); }, [refresh]);
    return { data, loading: data === null, refresh };
  },
}));

type K = { children?: React.ReactNode };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  const div = ({ children }: K) => <div>{children}</div>;
  return {
    IonPage: div, IonHeader: div, IonToolbar: div, IonTitle: div, IonContent: div, IonButtons: div,
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: div, IonCard: div, IonCardContent: div, IonText: durch,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonItem: ({ children, onClick }: K & { onClick?: () => void }) => <div data-testid="zeile" onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: K) => <div data-testid="wischzeile">{children}</div>,
    IonItemOptions: div,
    IonItemOption: ({ children, onClick, disabled, 'aria-label': name }: K & {
      onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
    }) => <button type="button" aria-label={name} disabled={disabled} onClick={onClick}>{children}</button>,
    IonButton: ({ children, onClick, disabled, 'aria-label': name }: K & {
      onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
    }) => <button type="button" aria-label={name} disabled={disabled} onClick={onClick}>{children}</button>,
    IonSelect: ({ children, value, onIonChange, 'aria-label': name }: K & {
      value?: unknown; onIonChange?: (e: { detail: { value: unknown } }) => void; 'aria-label'?: string;
    }) => (
      <select aria-label={name} value={value == null ? '' : String(value)}
        onChange={(e) => onIonChange?.({ detail: { value: Number(e.target.value) } })}>
        <option value="" />
        {children}
      </select>
    ),
    IonSelectOption: ({ children, value }: K & { value?: unknown }) => <option value={String(value)}>{children}</option>,
    IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
    IonSpinner: () => <span data-testid="spinner" />,
    useIonAlert: () => [(o: DialogOptionen) => { dialoge.push(o); }],
  };
});

import AdminInvitePage from '../../../components/admin/pages/AdminInvitePage';

const TAG = 24 * 60 * 60 * 1000;
export const inTagen = (n: number) => new Date(Date.now() + n * TAG).toISOString();

export const einladung = (id: number, zusatz: Partial<Einladung> = {}): Einladung => ({
  id, invite_code: `CODE${id}`, jahrgang_id: 1, jahrgang_name: '2026/27', expires_at: inTagen(5), used_count: 0, ...zusatz,
});

export function zuruecksetzen() {
  zustand.jahrgaenge = [{ id: 1, name: '2026/27' }, { id: 2, name: '2027/28' }];
  zustand.einladungen = [];
  dialoge.length = 0;
  for (const f of [api.get, api.post, api.delete, setSuccess, setError]) f.mockReset();
  api.get.mockImplementation(async (pfad: string) => {
    if (pfad === '/admin/jahrgaenge') return { data: zustand.jahrgaenge };
    if (pfad === '/auth/invite-codes') return { data: zustand.einladungen };
    return { data: [] };
  });
  api.post.mockResolvedValue({ data: {} });
}

/** Die Seite rendern und warten, bis Jahrgänge und Codes geladen sind. */
export async function seiteOeffnen() {
  const r = render(<AdminInvitePage onClose={vi.fn()} />);
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
}

/** Im Dialog den Knopf mit diesem Text drücken (mit dem gewählten Wert). */
export async function imDialogDruecken(text: string, wert?: unknown) {
  const knopf = letzterDialog().buttons.find((b) => typeof b !== 'string' && b.text === text) as DialogKnopf;
  await act(async () => { await knopf.handler?.(wert); });
}
