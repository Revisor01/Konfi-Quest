// Abmelde-Dialog der Konfis (UnregisterModal) -- gerendert (Audit Tests
// 26.09.2026, BF-10: kein Test hat ihn je gerendert; die Seiten, die ihn
// oeffnen, ersetzen ihn im Test durch eine Attrappe).
//
// Abmelden verlangt einen Grund: bei Pflicht-Terminen mindestens fuenf
// Zeichen (die Eltern bestaetigen spaeter), sonst eines. Der Grund geht ohne
// Rand-Leerzeichen weiter, Schliessen meldet nichts ab, offline geht nichts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const zustand = vi.hoisted(() => ({ online: true }));

vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ isOnline: zustand.online }) }));
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch,
    IonContent: durch, IonList: durch, IonListHeader: durch, IonLabel: durch, IonCard: durch,
    IonCardContent: durch, IonItem: durch, IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: P & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>,
    IonTextarea: ({ value, onIonInput, 'aria-label': label }: { value: string; onIonInput: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) =>
      <textarea aria-label={label} value={value} onChange={(e) => onIonInput({ detail: { value: e.target.value } })} />,
  };
});

import UnregisterModal from '../../components/konfi/modals/UnregisterModal';

const bestaetigen = () => screen.getByRole('button', { name: 'Abmeldung bestätigen' });
const grund = (text: string) => fireEvent.change(screen.getByLabelText('Grund für die Abmeldung'), { target: { value: text } });

beforeEach(() => { zustand.online = true; });

describe('Abmelden von einem Termin', () => {
  it('nennt den Termin; ohne Grund laesst sich nicht abmelden', () => {
    render(<UnregisterModal eventName="Gemeindefest" onUnregister={vi.fn()} dismiss={vi.fn()} />);
    expect(screen.getByText('Gemeindefest')).toBeInTheDocument();
    expect(bestaetigen()).toBeDisabled();
    grund('   ');
    expect(bestaetigen()).toBeDisabled();
  });

  it('ein Zeichen reicht bei einem freiwilligen Termin; der Grund geht ohne Rand-Leerzeichen weiter', async () => {
    const onUnregister = vi.fn();
    const dismiss = vi.fn();
    render(<UnregisterModal eventName="Gemeindefest" onUnregister={onUnregister} dismiss={dismiss} />);
    grund('  x ');
    expect(bestaetigen()).toBeEnabled();
    await act(async () => { fireEvent.click(bestaetigen()); });
    expect(onUnregister).toHaveBeenCalledWith('x');
    expect(dismiss).toHaveBeenCalledWith('x', 'confirm');
  });

  it('Pflicht-Termin: Hinweis auf die Eltern, Zaehler und erst ab fuenf Zeichen', async () => {
    const onUnregister = vi.fn();
    render(<UnregisterModal eventName="Konfitag" mandatory onUnregister={onUnregister} dismiss={vi.fn()} />);
    expect(screen.getByText('Deine Eltern müssen die Abmeldung noch bei uns bestätigen.')).toBeInTheDocument();
    grund(' krank ');
    // " krank " sind ohne Rand fuenf Zeichen -- genau die Grenze.
    expect(bestaetigen()).toBeEnabled();
    grund('Arzt');
    expect(screen.getByText('4/5 Zeichen')).toBeInTheDocument();
    expect(bestaetigen()).toBeDisabled();
    fireEvent.click(bestaetigen());
    expect(onUnregister).not.toHaveBeenCalled();
  });

  it('freiwilliger Termin: kein Eltern-Hinweis, kein Zaehler', () => {
    render(<UnregisterModal eventName="Gemeindefest" onUnregister={vi.fn()} dismiss={vi.fn()} />);
    expect(screen.queryByText('Deine Eltern müssen die Abmeldung noch bei uns bestätigen.')).toBe(null);
    expect(screen.queryByText(/\/5 Zeichen/)).toBe(null);
  });

  it('Schliessen meldet nicht ab', () => {
    const onUnregister = vi.fn();
    const dismiss = vi.fn();
    render(<UnregisterModal eventName="Gemeindefest" onUnregister={onUnregister} dismiss={dismiss} />);
    grund('Urlaub');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(dismiss).toHaveBeenCalledWith(undefined, 'cancel');
    expect(onUnregister).not.toHaveBeenCalled();
  });

  it('offline: gesperrt, mit Hinweis', () => {
    zustand.online = false;
    render(<UnregisterModal eventName="Gemeindefest" onUnregister={vi.fn()} dismiss={vi.fn()} />);
    grund('Urlaub');
    expect(bestaetigen()).toBeDisabled();
    expect(bestaetigen().textContent).toBe(' Du bist offline');
  });
});
