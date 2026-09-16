// Das Absage-Modal bleibt bei einem Serverfehler nicht stumm stehen
// (16.09.2026)
//
// DER FEHLER: TerminAbsagenModal.handleSave rief onSave() ohne try/catch auf.
// useActionGuard raeumt in einem `finally` auf und reicht den Fehler weiter;
// handleSave haengt als async onClick am Speichern-Knopf, und React faengt so
// eine Rejection nicht ab. Lehnte der Server ab, lief `dismiss()` nie: Das
// Fenster blieb offen, OHNE Meldung, und die Rejection blieb unbehandelt
// (einen globalen unhandledrejection-Handler gibt es im Projekt nicht). Man
// tippte auf Speichern und es passierte sichtbar nichts.
//
// SICHTBAR WURDE ER durch die Umstellung der Termin-Routen auf requireAdmin
// am selben Tag (Simon: "teamer erstellen keine veranstaltungen fertig. das
// machen admins und org admins."). Eine Teamer:in mit einer ausgelieferten
// App-Fassung -- die Builds 195 bis 197 zeigen ihr den Wisch "Absagegrund
// bearbeiten" an einem abgesagten Termin -- bekommt seither 403.
//
// ER BETRIFFT AUCH DIE LEITUNG: AdminEventsPage benutzt dasselbe Modal mit
// demselben onSave ohne catch. Dort faellt es heute nur nicht auf, weil ein
// Admin dieses 403 nie sieht. Ein 500 oder ein Netzabbruch traefe ihn genauso.
// Deshalb sitzt der Fix im gemeinsamen Modal statt in einer der beiden Seiten.
//
// HIER WIRD VERHALTEN GEPRUEFT, NICHT QUELLTEXT: Die anderen Dateien dieser
// Runde lesen die Quelle (die Seiten haengen an IonPage/Router/AppContext und
// waeren teuer zu rendern). Dieses Modal laesst sich dagegen klein rendern --
// und nur ein echter Klick zeigt, ob das Fenster offen bleibt und ob eine
// Meldung kommt. Eine Quelltextpruefung auf "catch" haette das nicht belegt.
//
// WICHTIG: useActionGuard wird NICHT gemockt. Der echte Guard ist Teil des
// Fehlerbildes (sein `finally` reicht die Rejection durch) -- ein
// Pass-through-Mock wuerde genau die Mechanik wegnehmen, um die es geht.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

const setError = vi.fn();

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    isOnline: true,
    setError,
    setSuccess: vi.fn(),
  }),
}));

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonButtons: passthrough,
    // Als echter Knopf, sonst laesst sich nicht klicken.
    IonButton: ({ children, onClick, disabled, ...rest }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      'aria-label'?: string;
    }) => React.createElement(
      'button',
      { onClick, disabled, 'aria-label': rest['aria-label'] },
      children
    ),
    IonIcon: () => null,
    IonItem: passthrough,
    IonLabel: passthrough,
    IonNote: passthrough,
    IonTextarea: () => null,
    IonCard: passthrough,
    IonCardContent: passthrough,
    IonList: passthrough,
    IonListHeader: passthrough,
    IonSpinner: () => null,
  };
});

import TerminAbsagenModal from '../../components/admin/modals/TerminAbsagenModal';

const grundProps = {
  terminName: 'Konfifreizeit',
  terminDatum: 'Mi., 23.09.2026',
  konfiAnzahl: 12,
  modus: 'grund' as const,
  grundVorgabe: 'Heizung defekt',
};

const absagenProps = { ...grundProps, modus: 'absagen' as const, grundVorgabe: '' };

/** Der Speichern-Knopf heisst je nach Modus anders. */
const speichernKnopf = (modus: 'grund' | 'absagen') =>
  screen.getByLabelText(modus === 'grund' ? 'Absagegrund speichern' : 'Termin absagen');

describe('TerminAbsagenModal: der Server lehnt ab', () => {
  beforeEach(() => {
    setError.mockClear();
  });

  it('das Fenster schliesst NICHT und es kommt eine Meldung (403 der Teamer:in)', async () => {
    // Genau die Antwort, die eine Teamer:in seit dem 16.09.2026 bekommt.
    const fehler = { response: { status: 403, data: { error: 'Keine Berechtigung' } } };
    const onSave = vi.fn().mockRejectedValue(fehler);
    const dismiss = vi.fn();

    render(<TerminAbsagenModal {...grundProps} onSave={onSave} dismiss={dismiss} />);
    await act(async () => { fireEvent.click(speichernKnopf('grund')); });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // Das Fenster bleibt stehen -- wer den Fehler liest, soll seinen Text
    // noch dastehen haben.
    expect(dismiss).not.toHaveBeenCalled();
    // Und die Meldung kommt aus der SERVERANTWORT, nicht aus dem Fallback.
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('Keine Berechtigung');
  });

  it('ohne Fehlertext vom Server kommt der Fallback des Modus', async () => {
    // Netzabbruch: keine response, kein data.error.
    const onSave = vi.fn().mockRejectedValue(new Error('Network Error'));
    const dismiss = vi.fn();

    render(<TerminAbsagenModal {...grundProps} onSave={onSave} dismiss={dismiss} />);
    await act(async () => { fireEvent.click(speichernKnopf('grund')); });

    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError).toHaveBeenCalledWith('Fehler beim Speichern des Absagegrundes');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('im Absagen-Modus nennt der Fallback das Absagen', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network Error'));
    const dismiss = vi.fn();

    render(<TerminAbsagenModal {...absagenProps} onSave={onSave} dismiss={dismiss} />);
    await act(async () => { fireEvent.click(speichernKnopf('absagen')); });

    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError).toHaveBeenCalledWith('Fehler beim Absagen des Termins');
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('der Knopf bleibt danach benutzbar -- ein zweiter Versuch geht', async () => {
    // Der Guard darf nicht verriegelt zurueckbleiben. Sein `finally` gibt
    // frei; ginge das verloren, waere das Fenster zwar offen, aber tot.
    const onSave = vi.fn()
      .mockRejectedValueOnce({ response: { status: 403, data: { error: 'Keine Berechtigung' } } })
      .mockResolvedValueOnce(undefined);
    const dismiss = vi.fn();

    render(<TerminAbsagenModal {...grundProps} onSave={onSave} dismiss={dismiss} />);
    await act(async () => { fireEvent.click(speichernKnopf('grund')); });
    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));

    await act(async () => { fireEvent.click(speichernKnopf('grund')); });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    // Beim zweiten Mal klappt es -- und DANN schliesst das Fenster.
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('TerminAbsagenModal: der Server nimmt an', () => {
  beforeEach(() => {
    setError.mockClear();
  });

  it.each([
    ['grund' as const, grundProps],
    ['absagen' as const, absagenProps],
  ])('im Modus %s schliesst das Fenster weiterhin, ohne Meldung', async (modus, props) => {
    // Die Gegenrichtung zu den Tests oben: Der Fix darf den Erfolgsfall nicht
    // anfassen. Ein catch, das auch bei Erfolg zuschlaegt, waere schlimmer
    // als der Fehler, den es behebt.
    const onSave = vi.fn().mockResolvedValue(undefined);
    const dismiss = vi.fn();

    render(<TerminAbsagenModal {...props} onSave={onSave} dismiss={dismiss} />);
    await act(async () => { fireEvent.click(speichernKnopf(modus)); });

    await waitFor(() => expect(dismiss).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it('der getrimmte Grund geht an onSave', async () => {
    // Nebenbei abgesichert: Das catch darf den Wert nicht verschlucken oder
    // veraendern.
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminAbsagenModal {...grundProps} grundVorgabe="  Heizung defekt  " onSave={onSave} dismiss={vi.fn()} />
    );
    await act(async () => { fireEvent.click(speichernKnopf('grund')); });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Heizung defekt'));
  });
});
