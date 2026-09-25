import React from 'react';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon } from '@ionic/react';
import { ICON_ZURUECK } from './icons';
import OrgSwitcherButton from './OrgSwitcherButton';
import PostfachGlocke from './PostfachGlocke';

/**
 * Die gemeinsame Kopfzeile der App.
 *
 * Simon (25.09.2026): "Könnte man in dem Zuge auf ne gemeinsame Zeile per
 * Rolle umstellen? Und dann nur pro Seite ein und ausblenden." und "Dann kann
 * der Gemeindeumschalter auch auf jede Seite, dann weiß ich wo ich bin."
 *
 * Vorher baute jede Seite ihre Kopfzeile selbst — Konfi 6, Teamer 7, Leitung
 * 19 Stueck, alle nach demselben Bauplan: IonHeader translucent, IonToolbar,
 * Knopf links, IonTitle, IonButtons rechts, dazu die eingeklappte Zweitzeile
 * mit grossem Titel. Wer etwas fuer ALLE Seiten wollte (die Glocke, den
 * Gemeinde-Umschalter), musste 32 Dateien anfassen und vergass zuverlaessig
 * eine. Der Gemeinde-Umschalter stand deshalb nur auf einer einzigen Seite
 * (AdminKonfisPage) — wer per Push in eine andere Gemeinde wechselte, kam
 * von den uebrigen Seiten nicht zurueck (Audit-Befund C3, 25.09.2026).
 *
 * Fest eingebaut sind deshalb:
 *   - die Glocke (PostfachGlocke) rechts aussen, hinter den Knoepfen der Seite,
 *   - der Gemeinde-Umschalter (OrgSwitcherButton) links. Er blendet sich
 *     selbst aus, wenn das Konto nur einer Gemeinde angehoert — fuer Konfis
 *     also praktisch immer. Er wird trotzdem NICHT pro Rolle abgeschaltet:
 *     Gehoert ein Konto doch einmal zwei Gemeinden an (Umzug, Doppelrolle),
 *     ist der Rueckweg da, ohne dass jemand daran denken muss.
 *
 * Beides laesst sich pro Seite abschalten (glocke={false},
 * gemeindeUmschalter={false}), etwa in einer Detailansicht, in der links
 * schon ein Zurueck-Knopf steht und rechts der Platz knapp ist.
 *
 * Umstellung GESTUFT (Simons Entscheidung 25.09.2026): zuerst nur die
 * Konfi-Rolle, Team und Leitung folgen, wenn das Ergebnis angesehen ist.
 * Kurz vor einer Store-Einreichung sollen nicht 32 Seiten gleichzeitig
 * wackeln. Bis dahin behalten Team und Leitung den schwebenden
 * Warteschlangen-Knopf (WartendeVorgaengeLeiste) — App.tsx blendet ihn nur
 * fuer Konfis aus, weil dort die Glocke seine Aufgabe uebernimmt.
 *
 * Die eingeklappte Zweitzeile (grosser Titel beim Herunterziehen) muss in
 * Ionic INNERHALB von IonContent stehen, deshalb ist sie eine eigene
 * Komponente: AppKopfzeileGross.
 */
export interface AppKopfzeileProps {
  titel: React.ReactNode;
  /** Zurueck-Knopf links aussen. Ohne Angabe: kein Zurueck-Knopf. */
  onZurueck?: () => void;
  /** Weitere Knoepfe links (IonButton-Elemente), nach dem Zurueck-Knopf. */
  links?: React.ReactNode;
  /** Knoepfe rechts (IonButton-Elemente), stehen VOR der Glocke. */
  rechts?: React.ReactNode;
  /** Gemeinde-Umschalter zeigen (Vorgabe: ja; er blendet sich bei einer Gemeinde selbst aus). */
  gemeindeUmschalter?: boolean;
  /** Glocke zeigen (Vorgabe: ja). */
  glocke?: boolean;
}

const AppKopfzeile: React.FC<AppKopfzeileProps> = ({
  titel,
  onZurueck,
  links,
  rechts,
  gemeindeUmschalter = true,
  glocke = true,
}) => (
  <IonHeader translucent={true}>
    <IonToolbar>
      {(onZurueck || links) && (
        <IonButtons slot="start">
          {onZurueck && (
            <IonButton aria-label="Zurück" onClick={onZurueck}>
              <IonIcon icon={ICON_ZURUECK} slot="icon-only" />
            </IonButton>
          )}
          {links}
        </IonButtons>
      )}
      {gemeindeUmschalter && <OrgSwitcherButton />}
      <IonTitle>{titel}</IonTitle>
      {(rechts || glocke) && (
        <IonButtons slot="end">
          {rechts}
          {glocke && <PostfachGlocke />}
        </IonButtons>
      )}
    </IonToolbar>
  </IonHeader>
);

/**
 * Die eingeklappte Zweitzeile mit grossem Titel (iOS-Muster: beim
 * Herunterziehen waechst der Titel). Steht als erstes Kind in IonContent.
 */
export const AppKopfzeileGross: React.FC<{ titel: React.ReactNode }> = ({ titel }) => (
  <IonHeader collapse="condense">
    <IonToolbar className="app-condense-toolbar">
      <IonTitle size="large">{titel}</IonTitle>
    </IonToolbar>
  </IonHeader>
);

export default AppKopfzeile;
