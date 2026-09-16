import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { ICON_BEARBEITEN } from './icons';
import { absageUrheberZeile, absagegrundUrheberZeile, AbsageAngabe } from '../../utils/anwesenheitUrheber';
import { istAbgesagt } from './eventFormatting';

// DER ABGESAGTE TERMIN, EINMAL GESCHRIEBEN (15.09.2026)
//
// Der Befund: Ein abgesagter Termin sah in sieben Ansichten verschieden aus.
// Der Grund stand in drei Listen und zwei Detailansichten, aber in keinem der
// beiden Dashboards -- also ausgerechnet dort nicht, wo man nach dem Push
// ZUERST landet. Die Zeile "Grund geändert von ..." gab es nur bei der
// Leitung; Team und Konfis lasen "Abgesagt von Anna" ueber einem Text, den
// Bernd geschrieben hatte. Den Knopf zum Nachtragen gab es nur im
// Leitungs-Detail, obwohl das Backend ihn jeder Teamer:in erlaubt
// (requireTeamer, events/verwaltung.js).
//
// Jede dieser Abweichungen war fuer sich klein und keine davon war
// beabsichtigt -- sie entstanden, weil derselbe Block fuenfmal von Hand
// nachgebaut wurde. Deshalb steht er jetzt einmal hier.
//
// WAS DIE VARIANTEN UNTERSCHEIDET: nur der Rahmen, nicht der Inhalt.
// 'kasten' ist der rote Kasten der Detailansichten, 'zeile' die kompakte
// Form fuer Listeneintraege und Dashboard-Kacheln, wo kein Platz fuer einen
// Kasten ist. Beide zeigen dieselben drei Aussagen in derselben Reihenfolge:
// Grund, wer abgesagt hat, wer den Grund zuletzt geaendert hat.

interface AbsageBlockProps {
  /**
   * Der Termin. Muss cancelled ODER registration_status === 'cancelled'
   * tragen -- welches der beiden, haengt an der Route, deshalb prueft
   * istAbgesagt() beide.
   */
  event: (AbsageAngabe & {
    cancelled?: boolean;
    registration_status?: string;
    cancelled_reason?: string | null;
  }) | null | undefined;

  /** 'kasten' fuer Detailansichten, 'zeile' fuer Listen und Kacheln. */
  variante?: 'kasten' | 'zeile';

  /**
   * Text ohne Grund anzeigen? In den Detailansichten ja: Dort ist der
   * Unterschied zwischen "kein Grund angegeben" und "alte Absage ohne
   * Datenbankfeld" fuer die Lesenden nicht zu erkennen, und ohne den Satz
   * gaebe es beim Nachtragen auch keinen Ort fuer den Knopf. In Listen und
   * auf Kacheln nein -- dort sagt das Badge "Abgesagt" schon, und eine leere
   * Zeile zwischen Zaehlern und Kategorien traegt nichts bei.
   */
  zeigePlatzhalter?: boolean;

  /**
   * Knopf "Grund nachtragen" / "Grund bearbeiten". Nur setzen, wo jemand
   * schreiben darf (Leitung und Team -- requireTeamer). Konfis bekommen ihn
   * nicht: Sie lesen den Grund, sie schreiben ihn nicht.
   */
  onGrundBearbeiten?: () => void;

  /** Ohne Verbindung laesst sich nichts speichern. */
  bearbeitenDeaktiviert?: boolean;

  /** Hell auf dunklem Grund (Dashboard-Kacheln mit Farbverlauf). */
  aufDunkel?: boolean;
}

const AbsageBlock: React.FC<AbsageBlockProps> = ({
  event,
  variante = 'kasten',
  zeigePlatzhalter = variante === 'kasten',
  onGrundBearbeiten,
  bearbeitenDeaktiviert = false,
  aufDunkel = false,
}) => {
  if (!istAbgesagt(event) || !event) return null;

  const grund = event.cancelled_reason?.trim() || '';
  const absager = absageUrheberZeile(event);
  const grundUrheber = absagegrundUrheberZeile(event);

  // Nichts zu sagen und nichts zu tun -> gar nicht rendern. Eine leere Box
  // unter einem Termin, der ohnehin schon "Abgesagt" im Kopf traegt, ist nur
  // Flaeche.
  if (!grund && !zeigePlatzhalter && !onGrundBearbeiten) return null;

  const leiseFarbe = aufDunkel ? 'rgba(255,255,255,0.75)' : 'var(--app-text-tertiary)';
  const textFarbe = aufDunkel ? 'rgba(255,255,255,0.9)' : 'var(--app-text-secondary)';

  const urheberZeilen = (
    <>
      {absager && (
        <div style={{ color: leiseFarbe, fontSize: 'var(--app-text-hinweis)', marginTop: 'var(--app-abstand-winzig)' }}>
          {absager}
        </div>
      )}
      {/* Zweite Zeile nur, wenn der Grund von jemand anderem stammt als die
          Absage (Migration 152) -- sonst staende hier zweimal derselbe Name.
          Die Entscheidung darueber faellt in absagegrundUrheberZeile(). */}
      {grundUrheber && (
        <div style={{ color: leiseFarbe, fontSize: 'var(--app-text-hinweis)', marginTop: 'var(--app-abstand-winzig)' }}>
          {grundUrheber}
        </div>
      )}
    </>
  );

  if (variante === 'zeile') {
    return (
      <>
        {grund && (
          <div style={{ color: textFarbe, fontSize: 'var(--app-text-hinweis)', marginTop: 'var(--app-abstand-winzig)' }}>
            <strong>Abgesagt: </strong>{grund}
          </div>
        )}
        {grund && urheberZeilen}
      </>
    );
  }

  return (
    <div
      className="app-reason-box app-reason-box--danger"
      style={{ margin: '0 var(--app-abstand-basis) var(--app-abstand-eng) var(--app-abstand-basis)' }}
    >
      {grund ? (
        <>
          <span className="app-reason-box__label">Abgesagt:</span> {grund}
        </>
      ) : (
        // Kein Grund ist kein Fehler (er war immer freiwillig, Migration 150)
        // -- der Satz sagt nur, dass hier einer stehen koennte. Er steht
        // ausdruecklich in ALLEN drei Rollen: Ohne ihn faellt der Block weg,
        // und dann ist "kein Grund angegeben" von "alte Absage" nicht zu
        // unterscheiden.
        <span style={{ color: 'var(--app-text-secondary)' }}>Kein Grund zur Absage angegeben.</span>
      )}
      {urheberZeilen}
      {/* Kein Rechte-Gate an dieser Stelle. Die Berechtigung sitzt im Backend
          (requireTeamer + darfTermin, dieselbe wie beim Absagen); wer nicht
          darf, bekommt 403. Genau deshalb steht der Knopf jetzt auch im Team:
          Die Erlaubnis war da, nur die Oberflaeche fehlte. */}
      {onGrundBearbeiten && (
        <IonButton
          size="small"
          fill="clear"
          color="danger"
          disabled={bearbeitenDeaktiviert}
          onClick={onGrundBearbeiten}
          style={{ marginTop: 'var(--app-abstand-mini)', marginLeft: 'calc(-1 * var(--app-abstand-mini))' }}
        >
          <IonIcon icon={ICON_BEARBEITEN} className="app-event-detail__icon-gap" />
          {grund ? 'Grund bearbeiten' : 'Grund nachtragen'}
        </IonButton>
      )}
    </div>
  );
};

export default AbsageBlock;
