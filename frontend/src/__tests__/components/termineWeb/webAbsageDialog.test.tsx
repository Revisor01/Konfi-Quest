// „Nicht dabei" mit Grund -- die Modale der App (TeamerAbsageModal,
// UnregisterModal) und das Fenster der Web-Fassung (WebAbsageDialog) im
// Vergleich (Simon, 15.10.2026: im Browser ab 992 px ein kompaktes Fenster
// statt des App-Modals).
//
// Alle drei lesen denselben Hook (shared/useAbsageFormular). Jeder Ablauf
// läuft deshalb zweimal, einmal je Fassung, mit denselben Erwartungen: Team
// mit freiwilligem Grund und mit Pflicht nach einer Zusage, Konfi mit Grund
// (mindestens ein Zeichen, am Pflicht-Event fünf und der Satz über die
// Eltern), Konfi ohne Netz gesperrt, Team ohne Netz nicht. Was sich
// unterscheidet, steht ausdrücklich da: Die App sperrt den Haken, solange der
// Grund fehlt; der Browser lässt klicken und sagt es im Fenster. Die App
// schließt sofort, der Browser wartet auf die Antwort der Seite.
//
// Ersetzt sind Netz-Zustand und die Ionic-Bausteine der App (schlichte
// HTML-Nachbauten mit denselben Namen).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ online: true }));

vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ isOnline: h.online }) }));
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch, IonItem: durch,
    IonTitle: ({ children }: P) => <h1>{children}</h1>,
    IonLabel: ({ children }: P) => <span>{children}</span>,
    IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': name }: P & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" aria-label={name} disabled={disabled} onClick={onClick}>{children}</button>
    ),
    IonTextarea: ({ value, onIonInput, 'aria-label': name }: { value: string; onIonInput: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) => (
      <textarea aria-label={name} value={value} onChange={(e) => onIonInput({ detail: { value: e.target.value } })} />
    ),
  };
});

import TeamerAbsageModal from '../../../components/teamer/modals/TeamerAbsageModal';
import UnregisterModal from '../../../components/konfi/modals/UnregisterModal';
import WebAbsageDialog from '../../../components/shared/web/termine/WebAbsageDialog';
import { absageMindestens, absageTexte, type AbsageRolle } from '../../../components/shared/useAbsageFormular';

type Fassung = 'app' | 'web';

/** Was die Seite bekommt: der Grund, wie er ankommt. */
const gesendet = vi.fn();
/** App: dismiss(grund, rolle); Browser: Schließen. */
const zu = vi.fn();
/** Die Seite im Browser: ihre Antwort (true angekommen, false abgelehnt -- mit Meldung). */
let antwort: (grund: string, melden: (text: string) => void) => Promise<boolean>;

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  antwort = async (grund) => { gesendet(grund); return true; };
});
afterEach(() => cleanup());

const oeffnen = (fassung: Fassung, rolle: AbsageRolle, pflicht: boolean) => {
  if (fassung === 'web') {
    render(<WebAbsageDialog rolle={rolle} pflicht={pflicht} eventName="Konfi-Freizeit" onAbsage={(g, m) => antwort(g, m)} onSchliessen={zu} />);
    return;
  }
  if (rolle === 'team') {
    render(<TeamerAbsageModal eventName="Konfi-Freizeit" grundPflicht={pflicht} onAbsage={gesendet} dismiss={zu} />);
  } else {
    render(<UnregisterModal eventName="Konfi-Freizeit" mandatory={pflicht || undefined} onUnregister={gesendet} dismiss={zu} />);
  }
};

/** Das Feld des Grundes: in der App benannt nach dem Platzhalter, im Browser nach der Beschriftung. */
const feld = (fassung: Fassung, rolle: AbsageRolle, pflicht: boolean) => {
  const t = absageTexte(rolle, pflicht);
  return fassung === 'app' ? screen.getByLabelText(t.feld) : screen.getByRole('textbox', { name: t.grund });
};
const tippe = (fassung: Fassung, rolle: AbsageRolle, pflicht: boolean, text: string) => {
  fireEvent.change(feld(fassung, rolle, pflicht), { target: { value: text } });
};
const knopf = (rolle: AbsageRolle) => screen.getByRole('button', { name: absageTexte(rolle, false).bestaetigen });
const absenden = async (rolle: AbsageRolle) => {
  await act(async () => { fireEvent.click(knopf(rolle)); });
};

/** Wie es angekommen ist: App dismiss(grund, 'confirm'), Browser Schließen nach der Antwort. */
const erwarteGesendet = (fassung: Fassung, grund: string) => {
  expect(gesendet.mock.calls).toEqual([[grund]]);
  if (fassung === 'app') expect(zu).toHaveBeenCalledWith(grund, 'confirm');
  else expect(zu).toHaveBeenCalledTimes(1);
};

/** Zu kurz: App sperrt den Haken, Browser sagt es im Fenster -- in beiden geht nichts weg. */
const erwarteAbgelehnt = async (fassung: Fassung, rolle: AbsageRolle, text: string) => {
  if (fassung === 'app') {
    expect(knopf(rolle)).toBeDisabled();
  } else {
    expect(knopf(rolle)).toBeEnabled();
    await absenden(rolle);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  }
  expect(gesendet).not.toHaveBeenCalled();
  expect(zu).not.toHaveBeenCalled();
};

describe('die Regeln stehen an einer Stelle', () => {
  it('Team: freiwillig, nach einer Zusage ein Zeichen; Konfi: ein Zeichen, am Pflicht-Event fünf', () => {
    expect(absageMindestens('team', false)).toBe(0);
    expect(absageMindestens('team', true)).toBe(1);
    expect(absageMindestens('konfi', false)).toBe(1);
    expect(absageMindestens('konfi', true)).toBe(5);
  });
});

describe.each<Fassung>(['app', 'web'])('Absage und Abmeldung (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('Team, freiwillig: Überschrift „Absage", Erklärung; ohne Grund geht die Absage leer an die Seite', async () => {
    oeffnen(fassung, 'team', false);
    if (fassung === 'app') expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Absage');
    else expect(screen.getByRole('dialog', { name: 'Absage' })).toHaveAccessibleDescription('Absage für Konfi-Freizeit');
    expect(screen.getByText('Ein Grund hilft der Leitung beim Planen — du musst aber keinen angeben.')).toBeInTheDocument();
    await absenden('team');
    erwarteGesendet(fassung, '');
  });

  it('Team nach Zusage: ohne Grund nichts, mit Grund ohne Leerzeichen am Rand', async () => {
    oeffnen(fassung, 'team', true);
    expect(screen.getByText('Du hattest zugesagt. Bitte gib einen Grund an, damit die Leitung umplanen kann.')).toBeInTheDocument();
    tippe(fassung, 'team', true, '   ');
    await erwarteAbgelehnt(fassung, 'team', 'Ohne Grund lässt sich eine Absage nach Zusage nicht speichern.');
    tippe(fassung, 'team', true, '  Krank ');
    await absenden('team');
    erwarteGesendet(fassung, 'Krank');
  });

  it('Konfi: ohne Grund nichts, ein Zeichen reicht; kein Eltern-Satz, kein Zähler', async () => {
    oeffnen(fassung, 'konfi', false);
    if (fassung === 'app') expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Abmeldung');
    else expect(screen.getByRole('dialog', { name: 'Abmeldung' })).toHaveAccessibleDescription('Abmeldung von Konfi-Freizeit');
    expect(screen.queryByText('Deine Eltern müssen die Abmeldung noch bei uns bestätigen.')).toBe(null);
    expect(screen.queryByText(/\/5 Zeichen/)).toBe(null);
    await erwarteAbgelehnt(fassung, 'konfi', 'Bitte gib einen Grund für die Abmeldung an');
    tippe(fassung, 'konfi', false, ' x ');
    await absenden('konfi');
    erwarteGesendet(fassung, 'x');
  });

  it('Konfi am Pflicht-Event: der Satz über die Eltern, Zähler „4/5 Zeichen", erst ab fünf', async () => {
    oeffnen(fassung, 'konfi', true);
    expect(screen.getByText('Deine Eltern müssen die Abmeldung noch bei uns bestätigen.')).toBeInTheDocument();
    tippe(fassung, 'konfi', true, 'Arzt');
    expect(screen.getByText('4/5 Zeichen')).toBeInTheDocument();
    await erwarteAbgelehnt(fassung, 'konfi', 'Bitte gib einen Grund für die Abmeldung an (mind. 5 Zeichen)');
    tippe(fassung, 'konfi', true, ' krank ');
    expect(screen.queryByText(/\/5 Zeichen/)).toBe(null);
    await absenden('konfi');
    erwarteGesendet(fassung, 'krank');
  });

  it('Konfi ohne Netz: gesperrt, „Du bist offline"', async () => {
    h.online = false;
    oeffnen(fassung, 'konfi', false);
    tippe(fassung, 'konfi', false, 'Urlaub');
    expect(knopf('konfi')).toBeDisabled();
    expect(screen.getByText(/Du bist offline/)).toBeInTheDocument();
    fireEvent.click(knopf('konfi'));
    expect(gesendet).not.toHaveBeenCalled();
  });

  it('Team ohne Netz: Absenden bleibt möglich (die Seite reiht ein)', async () => {
    h.online = false;
    oeffnen(fassung, 'team', true);
    tippe(fassung, 'team', true, 'Krank');
    expect(knopf('team')).toBeEnabled();
    await absenden('team');
    erwarteGesendet(fassung, 'Krank');
  });

  it('Schließen sendet nichts', () => {
    oeffnen(fassung, 'konfi', false);
    tippe(fassung, 'konfi', false, 'Urlaub');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(gesendet).not.toHaveBeenCalled();
    if (fassung === 'app') expect(zu).toHaveBeenCalledWith(undefined, 'cancel');
    else expect(zu).toHaveBeenCalledTimes(1);
  });
});

// --- Nur der Browser: warten, sperren, die Ablehnung im Fenster ----------------------
describe('Absage-Fenster (web): solange gesendet wird, bleibt es; eine Ablehnung steht darin', () => {
  it('während des Sendens schließt nichts; danach steht die Meldung der Seite im Fenster, das Fenster bleibt offen', async () => {
    let ablehnen: (text: string) => void = () => undefined;
    antwort = (grund, melden) => new Promise<boolean>((fertig) => {
      gesendet(grund);
      ablehnen = (text) => { melden(text); fertig(false); };
    });
    oeffnen('web', 'team', true);
    tippe('web', 'team', true, 'Krank');
    await absenden('team');
    const dialog = screen.getByRole('dialog', { name: 'Absage' });

    // Jeder Weg hinaus ist gesperrt: X, Abbrechen, Escape, Klick daneben.
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Absage bestätigen' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(zu).not.toHaveBeenCalled();

    await act(async () => { ablehnen('Fehler beim Speichern'); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Speichern');
    expect(zu).not.toHaveBeenCalled();
    expect(gesendet.mock.calls).toEqual([['Krank']]);
    // Wieder frei; die nächste Eingabe räumt die Meldung weg.
    tippe('web', 'team', true, 'Krank, sorry');
    expect(within(dialog).queryByRole('alert')).toBe(null);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('Absenden im Formular (Enter auf dem Knopf) geht denselben Weg', async () => {
    oeffnen('web', 'konfi', false);
    tippe('web', 'konfi', false, 'Urlaub');
    const form = (feld('web', 'konfi', false) as HTMLTextAreaElement).form as HTMLFormElement;
    await act(async () => { fireEvent.submit(form); });
    erwarteGesendet('web', 'Urlaub');
  });
});
