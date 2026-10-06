// Hilfen fuer die gerenderten Tests der Web-Fassung der Leitung
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): die Ionic-Attrappe der
// Support-Tests, dazu ein useIonModal, das festhaelt, WELCHES Fenster mit
// WELCHEN Werten aufgeht -- die Web-Fassung oeffnet dieselben Fenster wie die
// App, das ist der Teil, der sich pruefen laesst.
import React from 'react';
import { vi } from 'vitest';
import { ionicAttrappe, type AlertOptionen } from '../support/ionicAttrappe';

export interface GeoeffnetesFenster {
  komponente: unknown;
  props: Record<string, unknown>;
  optionen: unknown;
}

export interface LeitungTestStand {
  alert: AlertOptionen | null;
  fenster: GeoeffnetesFenster[];
  push: ReturnType<typeof vi.fn>;
}

/** Der Wert fuer `vi.mock('@ionic/react', ...)`. */
export async function ionicFuerLeitung(stand: LeitungTestStand) {
  const basis = ionicAttrappe({
    presentAlert: (o) => { stand.alert = o; },
    router: { push: stand.push as never, goBack: vi.fn(), canGoBack: () => false },
  });
  return {
    ...basis,
    IonPage: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(({ children }, ref) => <div ref={ref}>{children}</div>),
    // Wie Ionic: Das Fenster liest seine Werte beim Aufgehen aus dem LETZTEN
    // Zeichnen der Seite (useOverlay, Effekt auf componentProps) -- so
    // funktioniert "erst setKonfi, dann present". Deshalb liest `props` hier den
    // neuesten Stand, nicht den vom Aufruf.
    useIonModal: (komponente: unknown, props: Record<string, unknown>) => {
      const neueste = React.useRef(props);
      neueste.current = props;
      return [
        (optionen: unknown) => {
          stand.fenster.push({ komponente, get props() { return neueste.current; }, optionen });
        },
        vi.fn(),
      ];
    },
    // Die schmale Darstellung der App (Badges-Abschnitt) oeffnet Popover.
    useIonPopover: () => [vi.fn(), vi.fn()],
    // Die Seiten der App ordnen mit Ziehen (Dashboard) und setzen Text in IonText (Einladung).
    IonReorderGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    IonReorder: () => null,
    IonText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  };
}

export const neuerStand = (): LeitungTestStand => ({ alert: null, fenster: [], push: vi.fn() });

/** Ein Konto, wie AppContext es liefert. */
export const konto = (rolle: 'org_admin' | 'admin' | 'teamer', jahrgangIds: number[] = []) => ({
  id: 5,
  organization_id: 1,
  role_name: rolle,
  display_name: 'Test Konto',
  assigned_jahrgaenge: jahrgangIds.map((id) => ({ id, name: `J${id}`, can_view: true, can_edit: true })),
});
