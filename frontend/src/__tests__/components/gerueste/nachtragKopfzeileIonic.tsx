// Nachträge zu den Gerüsten dieses Ordners (09.10.2026).
//
// Die Gerüste (konfiTerminDetail, leitungTerminDetail, teamerTerminSeite)
// stellen Kopfzeile und Ionic schlicht nach -- für manche Fragen zu schlicht:
// Welche Props bekommt die Kopfzeile (gemeindeUmschalter)? Wohin führt der
// Router? Mit welchen Props wird ein Modal angemeldet, auch beim
// NEU-Zeichnen? Statt die geteilten Gerüste umzubauen, legt dieses Modul die
// betroffenen Attrappen per vi.doMock NACHTRÄGLICH darüber.
//
// EINBINDEN: NACH dem Gerüst importieren und vor dem ersten Rendern
// aufrufen (oben in der Testdatei, mit await):
//
//   import { zuruecksetzen, oeffne } from './gerueste/konfiTerminDetail';
//   import { kopfzeileMitschreiben, ionicNachtragen } from './gerueste/nachtragKopfzeileIonic';
//   kopfzeileMitschreiben();
//   await ionicNachtragen();
//
// Das trägt, weil die Gerüste die Ansicht erst beim Rendern laden
// (dynamischer Import): Bis dahin ist die Attrappe hier registriert.
import React from 'react';
import { vi } from 'vitest';

/** Jede gezeichnete Kopfzeile mit ihren Props, in Reihenfolge. */
export const kopfzeilen: Array<Record<string, unknown>> = [];
/** Die zuletzt gezeichnete Kopfzeile. */
export const letzteKopfzeile = () => kopfzeilen.at(-1);

/** Jeder Aufruf von useIonModal -- bei JEDEM Zeichnen, nicht nur beim Öffnen. */
export const modalAnmeldungen: Array<{ name: string; props: Record<string, unknown> }> = [];
/** Wohin der Router geschickt wurde (useIonRouter().push). */
export const routerZiele = vi.fn();

export const nachtragZuruecksetzen = () => {
  kopfzeilen.length = 0;
  modalAnmeldungen.length = 0;
  routerZiele.mockReset();
};

type KopfProps = { titel?: string; rechts?: React.ReactNode; onZurueck?: () => void } & Record<string, unknown>;

/** Die Kopfzeile schreibt ihre Props mit und zeigt Zurück und den rechten Bereich. */
export const kopfzeileMitschreiben = () => {
  vi.doMock('../../../components/shared/AppKopfzeile', () => ({
    default: (props: KopfProps) => {
      kopfzeilen.push(props);
      return (
        <header data-testid="kopfzeile" data-titel={props.titel}>
          {props.onZurueck && <button type="button" aria-label="Zurück" onClick={props.onZurueck} />}
          {props.rechts}
        </header>
      );
    },
    AppKopfzeileGross: () => null,
  }));
};

/**
 * Ionic des Gerüsts, ergänzt: useIonModal schreibt bei jedem Zeichnen mit,
 * useIonRouter meldet seine Ziele an routerZiele, dazu beliebige weitere
 * Bausteine (zusatz), die das Gerüst nicht kennt.
 */
export const ionicNachtragen = async (zusatz: Record<string, unknown> = {}) => {
  // Hier kommt die Attrappe des Gerüsts an -- dessen vi.mock gilt schon.
  const basis = await import('@ionic/react') as unknown as Record<string, unknown> & {
    useIonModal: (k: unknown, p: Record<string, unknown>) => unknown;
  };
  vi.doMock('@ionic/react', () => ({
    ...basis,
    useIonRouter: () => ({ push: routerZiele }),
    ...zusatz,
    useIonModal: (komponente: { name?: string; displayName?: string } | undefined, props: Record<string, unknown>) => {
      modalAnmeldungen.push({ name: komponente?.displayName || komponente?.name || 'unbekannt', props });
      return basis.useIonModal(komponente, props);
    },
  }));
};
