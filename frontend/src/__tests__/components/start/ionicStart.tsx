// Ionic-Attrappe fuer die gerenderten Tests der Web-Fassung von Start, Badges
// und Profil (03.10.2026, docs/planung/web-alle-bereiche.md, Entscheidung 6).
//
// Baut auf der Attrappe der Support-Ansicht auf (native Felder statt Shadow-DOM)
// und haelt zusaetzlich fest, WELCHE Modale die Seite oeffnen wuerde: Die
// Handgriffe der App (E-Mail aendern, Punkte-Uebersicht, ...) sind Ionic-Modale
// ueber useIonModal -- der Test prueft, dass der Knopf der Web-Fassung genau
// dieses Modal mit denselben Eigenschaften anfordert.
import React from 'react';
import { ionicAttrappe, type AlertOptionen } from '../support/ionicAttrappe';

export interface ModalAufruf {
  /** displayName der angeforderten Komponente (siehe modalAttrappe). */
  name: string;
  props: Record<string, unknown>;
  optionen: Record<string, unknown> | undefined;
}

export interface IonicStartZustand {
  push: (pfad: string, richtung?: string, art?: string) => void;
  modale: ModalAufruf[];
  alerts: AlertOptionen[];
  /**
   * Optional: die Eigenschaften, mit denen useIonModal im LETZTEN Render
   * gerufen wurde, je Modal-Name. Ein Aufruf haelt immer die Eigenschaften des
   * Renders, in dem er entstand -- setzt die Seite erst einen Zustand und oeffnet
   * dann (badgeId), sind sie dort noch die alten. Echtes Ionic baut die
   * Komponente erst nach dem Oeffnen und mit den Eigenschaften des dann
   * neuesten Renders (useOverlay); diese Ablage bildet das nach.
   */
  zuletzt?: Record<string, Record<string, unknown>>;
}

/** Eine Attrappe fuer ein Modal: leer, aber mit Namen, damit der Test sie erkennt. */
export const modalAttrappe = (name: string) => {
  const komponente = () => null;
  komponente.displayName = name;
  return komponente;
};

export function ionicStart(z: IonicStartZustand) {
  const basis = ionicAttrappe({
    router: { push: z.push, goBack: () => undefined, canGoBack: () => false },
    presentAlert: (o) => { z.alerts.push(o); },
  });
  return {
    ...basis,
    IonProgressBar: () => null,
    IonPage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    useIonModal: (komponente: { displayName?: string; name?: string }, props: Record<string, unknown>) => {
      const name = komponente.displayName ?? komponente.name ?? '?';
      if (z.zuletzt) z.zuletzt[name] = props;
      return [
        (optionen?: Record<string, unknown>) => { z.modale.push({ name, props, optionen }); },
        () => undefined,
      ];
    },
    useIonPopover: () => [() => undefined, () => undefined],
  };
}
