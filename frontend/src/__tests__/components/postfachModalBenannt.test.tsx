import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { type ReactNode } from 'react';
import { render, screen, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-16: Das Postfach ist ein Modal mit
// Kopfzeile; sein Name ist die IonTitle „Postfach", angebunden ueber
// aria-labelledby. Der Stub reicht genau diese Attribute durch (der echte
// ion-modal rendert seine Kinder in jsdom erst beim Praesentieren, die
// IonTitle waere nicht im Baum). Geprueft wird, dass der Verweis auf ein
// Element zeigt, dessen Text „Postfach" ist -- nicht nur, dass er da steht.
// ---------------------------------------------------------------------------

type StubProps = { children?: ReactNode };
vi.mock('@ionic/react', () => ({
  IonModal: (props: StubProps & { isOpen?: boolean; 'aria-labelledby'?: string; 'aria-label'?: string }) =>
    (props.isOpen
      ? <div role="dialog" data-testid="modal" aria-labelledby={props['aria-labelledby']} aria-label={props['aria-label']}>{props.children}</div>
      : null),
  IonHeader: (props: StubProps) => <div>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps & { id?: string }) => <div id={props.id}>{props.children}</div>,
  IonButtons: (props: StubProps) => <div>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; 'aria-label'?: string }) =>
    <button type="button" onClick={props.onClick} aria-label={props['aria-label']}>{props.children}</button>,
  IonContent: (props: StubProps) => <div>{props.children}</div>,
  IonList: (props: StubProps) => <div>{props.children}</div>,
  IonListHeader: (props: StubProps) => <div>{props.children}</div>,
  IonItem: (props: StubProps & { onClick?: () => void }) => <div onClick={props.onClick}>{props.children}</div>,
  IonLabel: (props: StubProps) => <div>{props.children}</div>,
  IonSpinner: () => <span />,
  IonCard: (props: StubProps) => <div>{props.children}</div>,
  IonCardContent: (props: StubProps) => <div>{props.children}</div>,
  IonIcon: () => <span />,
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { eintraege: [], ungelesen: 0, weitere: false } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 7, type: 'konfi', organization_id: 1 }, activeOrgId: null, organizations: [], switchOrg: vi.fn() }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: 0, refreshAllCounts: vi.fn() }),
}));
vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: [], gescheitert: [], vergessen: vi.fn(), alleVergessen: vi.fn() }),
}));

import PostfachModal from '../../components/common/PostfachModal';
import { oeffnePostfach } from '../../utils/postfach';

beforeEach(() => vi.clearAllMocks());

describe('Postfach-Modal ist ueber seine Ueberschrift benannt (UI BF-16)', () => {
  it('aria-labelledby zeigt auf die Ueberschrift „Postfach"', async () => {
    render(<PostfachModal />);
    await act(async () => { oeffnePostfach(); });
    const dialog = await screen.findByTestId('modal');
    const id = dialog.getAttribute('aria-labelledby');
    expect(id).toBe('postfach-modal-titel');
    const titel = document.getElementById(id!);
    expect(titel?.textContent?.trim()).toBe('Postfach');
  });
});
