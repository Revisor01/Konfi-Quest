// „Nicht dabei" mit Grund -- als Logik ohne Darstellung (Simon, 15.10.2026:
// im Browser ab 992 px bekommt jedes Formular, das noch ein Modal der App
// öffnet, ein kompaktes Fenster). Die App zeigt sie wie bisher in ihren
// Modalen, der Browser im Fenster (web/termine/WebAbsageDialog.tsx):
//
//   Team    teamer/modals/TeamerAbsageModal.tsx -- die Absage einer
//           Teamer:in unter /teamer/events und die eigene Absage der Leitung
//           unter /admin/events/:id.
//   Konfi   konfi/modals/UnregisterModal.tsx -- „Abmelden", „Von der
//           Warteliste abmelden" und die Abmeldung vom Pflicht-Event.
//
// Die Regeln je Rolle bleiben, wie sie waren -- sie stehen nur nicht mehr
// zweimal da:
//
//   Team    Der Grund ist freiwillig, AUSSER die Absage nimmt eine Zusage
//           zurück (`pflicht`, utils/zusageKnoepfe.ts absageBrauchtGrund):
//           dann mindestens ein Zeichen; das Backend lehnt ohne Grund ab
//           (400, grund_erforderlich). Ohne Netz bleibt Absenden möglich,
//           die Seite reiht ein.
//   Konfi   Ein Grund gehört immer dazu: mindestens ein Zeichen, am
//           Pflicht-Event (`pflicht`) fünf -- die Eltern bestätigen die
//           Abmeldung später. Ohne Netz bleibt Absenden möglich wie beim
//           Team: Die Seite reiht die Abmeldung ein (Simon, 30.08.2026);
//           ein Platz wird frei, nicht belegt.
//
// Gesendet wird von der Seite (onAbsage): Sie kennt Route, Warteschlange und
// was danach neu geladen wird. In der App wie bisher ohne Warten -- das Modal
// schließt sofort, Fehler meldet die Seite oben. Im Browser (`fehlerImDialog`)
// wartet das Fenster auf die Antwort: Es bleibt gesperrt, solange gesendet
// wird, ein Fehler steht im Fenster (`melden` an die Seite), und es schließt
// erst, wenn die Absage angekommen oder eingereiht ist.

import { useState } from 'react';
import { useActionGuard } from '../../hooks/useActionGuard';

export type AbsageRolle = 'team' | 'konfi';

/** Die Texte eines Fensters -- je Rolle und Pflicht dieselben in App und Browser. */
export interface AbsageTexte {
  /** Kopf: „Absage" bzw. „Abmeldung". */
  titel: string;
  /** Vor dem Namen des Events: „Absage für" bzw. „Abmeldung von". */
  fuer: string;
  /** Überschrift des Grundes. */
  grund: string;
  /** Name des Feldes in der App (dort steht keine Beschriftung daneben). */
  feld: string;
  platzhalter: string;
  /** Der Satz über dem Feld, wenn es einen gibt. */
  erklaerung?: string;
  /** Konfi am Pflicht-Event: der Satz über die Eltern (hervorgehoben). */
  elternHinweis?: string;
  /** Name des Knopfes, der absendet. */
  bestaetigen: string;
  /** Was fehlt, wenn der Grund zu kurz ist. */
  fehlt: string;
}

/** Konfi am Pflicht-Event: so viele Zeichen braucht der Grund mindestens. */
export const PFLICHT_GRUND_ZEICHEN = 5;

const TEAM_PFLICHT: AbsageTexte = {
  titel: 'Absage',
  fuer: 'Absage für',
  grund: 'Grund für die Absage',
  feld: 'Warum kannst du nicht?',
  platzhalter: 'Warum kannst du nicht?',
  erklaerung: 'Du hattest zugesagt. Bitte gib einen Grund an, damit die Leitung umplanen kann.',
  bestaetigen: 'Absage bestätigen',
  fehlt: 'Ohne Grund lässt sich eine Absage nach Zusage nicht speichern.',
};

const TEAM_FREIWILLIG: AbsageTexte = {
  ...TEAM_PFLICHT,
  grund: 'Grund (freiwillig)',
  feld: 'Grund (kannst du leer lassen)',
  platzhalter: 'Grund (kannst du leer lassen)',
  erklaerung: 'Ein Grund hilft der Leitung beim Planen — du musst aber keinen angeben.',
};

const KONFI: AbsageTexte = {
  titel: 'Abmeldung',
  fuer: 'Abmeldung von',
  grund: 'Grund für die Abmeldung',
  feld: 'Grund für die Abmeldung',
  platzhalter: 'Bitte gib einen Grund für deine Abmeldung an...',
  bestaetigen: 'Abmeldung bestätigen',
  // Derselbe Satz, mit dem die Seite einen fehlenden Grund ablehnt (konfi/views/EventDetailView, handleUnregister).
  fehlt: 'Bitte gib einen Grund für die Abmeldung an',
};

const KONFI_PFLICHT: AbsageTexte = {
  ...KONFI,
  erklaerung: 'Dies ist ein Pflicht-Event. Bitte gib einen Grund für deine Abmeldung an.',
  elternHinweis: 'Deine Eltern müssen die Abmeldung noch bei uns bestätigen.',
  // Wie handleOptOut der Seite.
  fehlt: 'Bitte gib einen Grund für die Abmeldung an (mind. 5 Zeichen)',
};

/** Die Texte für Rolle und Pflicht. */
export const absageTexte = (rolle: AbsageRolle, pflicht: boolean): AbsageTexte => {
  if (rolle === 'team') return pflicht ? TEAM_PFLICHT : TEAM_FREIWILLIG;
  return pflicht ? KONFI_PFLICHT : KONFI;
};

/** So viele Zeichen (ohne Leerzeichen am Rand) braucht der Grund mindestens. */
export const absageMindestens = (rolle: AbsageRolle, pflicht: boolean): number => {
  if (rolle === 'team') return pflicht ? 1 : 0;
  return pflicht ? PFLICHT_GRUND_ZEICHEN : 1;
};

export interface AbsageFormularOptionen {
  rolle: AbsageRolle;
  /** Team: die Absage nimmt eine Zusage zurück. Konfi: Pflicht-Event. */
  pflicht: boolean;
  /**
   * Senden (die Seite). Der Grund kommt ohne Leerzeichen am Rand. Im Browser
   * mit `melden` für eine Meldung im Fenster; `false` heißt: nicht
   * angekommen, das Fenster bleibt offen.
   */
  onAbsage: (grund: string, melden?: (text: string) => void) => unknown;
  /** Danach: App sofort (dismiss), Browser erst nach der Antwort (schließen). */
  onFertig: (grund: string) => void;
  /** Meldungen im Fenster statt oben (der Dialog des Browsers). */
  fehlerImDialog?: boolean;
}

export function useAbsageFormular({ rolle, pflicht, onAbsage, onFertig, fehlerImDialog = false }: AbsageFormularOptionen) {
  const [grund, setGrund] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const { isSubmitting, guard } = useActionGuard();

  const texte = absageTexte(rolle, pflicht);
  const mindestens = absageMindestens(rolle, pflicht);
  const laenge = grund.trim().length;
  const gueltig = laenge >= mindestens;

  const absenden = async () => {
    if (!gueltig) {
      // Die App sperrt den Haken; der Browser sagt im Fenster, was fehlt.
      if (fehlerImDialog) setFehler(texte.fehlt);
      return;
    }
    const text = grund.trim();
    await guard(async () => {
      if (!fehlerImDialog) {
        onAbsage(text);
        onFertig(text);
        return;
      }
      setFehler(null);
      const angekommen = await onAbsage(text, (meldung) => setFehler(meldung || null));
      if (angekommen !== false) onFertig(text);
    });
  };

  return {
    texte,
    grund,
    setGrund,
    mindestens,
    gueltig,
    isSubmitting,
    absenden,
    /** Team, Pflicht: Solange der Grund fehlt, steht in der App der Satz in Rot darunter. */
    fehltSichtbar: rolle === 'team' && pflicht && laenge === 0,
    /** Konfi, Pflicht-Event: „4/5 Zeichen", solange es zu wenige sind. */
    zaehler: rolle === 'konfi' && pflicht && laenge < PFLICHT_GRUND_ZEICHEN ? `${laenge}/${PFLICHT_GRUND_ZEICHEN} Zeichen` : null,
    /** Die Meldung im Fenster (nur mit `fehlerImDialog`). */
    fehler,
    fehlerLeeren: () => setFehler(null),
  };
}

export type AbsageFormular = ReturnType<typeof useAbsageFormular>;
