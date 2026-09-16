import React from 'react';
import { IonButton, IonCard, IonCardContent, IonIcon, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { ICON_ABSAGE, ICON_BEARBEITEN, ICON_RUECKGAENGIG } from './icons';
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
// 'kasten' ist der Abschnitt der Detailansichten, 'zeile' die kompakte
// Form fuer Listeneintraege und Dashboard-Kacheln, wo kein Platz fuer einen
// Kasten ist. Beide zeigen dieselben drei Aussagen in derselben Reihenfolge:
// Grund, wer abgesagt hat, wer den Grund zuletzt geaendert hat.
//
// DIE KARTE (16.09.2026, Simons Befund): Der Kasten war vorher eine rot
// getoente Flaeche, die frei zwischen den Abschnitten schwebte -- die
// Nachbarn (Details, Beschreibung, Abmeldungen, Material) stehen alle im
// gleichen Muster: IonList.app-section-inset > IonListHeader mit rundem
// Abschnitts-Icon > IonCard.app-card > IonCardContent.app-card-content.
// Das Vorbild ist UnregistrationsSection in admin/views/EventDetailSections.tsx:
// weisse Karte, roter Kopf-Kreis, der Grund darin. Genau so sitzt der
// Absageblock jetzt auch.
//
// WIE VIEL ROT BLEIBT: der Kreis im Kopf (app-section-icon--danger), das
// Wort "Abgesagt:" (app-reason-box__label faerbt es rot) und der Knopf
// "Grund bearbeiten". Die FLAECHE ist weiss wie ueberall -- die rote
// Tonung (app-reason-box--danger) faellt weg, sonst waere es wieder ein
// Kasten in der Karte. Erkennbar bleibt die Absage damit dreifach: am Kopf
// "Absage", am roten Kreis und am roten Label.

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

  /**
   * Knopf "Absage zurücknehmen" (16.09.2026). Nur setzen, wo jemand schreiben
   * darf -- dieselbe Berechtigung wie beim Absagen und beim Grund
   * (requireTeamer + darfTermin). Konfis bekommen ihn nicht.
   *
   * Der Aufrufer stellt die Rueckfrage: Das Zuruecknehmen schickt allen
   * Wiederangemeldeten einen Push, und wie viele das sind, weiss nur er.
   */
  onZuruecknehmen?: () => void;

  /** Hell auf dunklem Grund (Dashboard-Kacheln mit Farbverlauf). */
  aufDunkel?: boolean;
}

const AbsageBlock: React.FC<AbsageBlockProps> = ({
  event,
  variante = 'kasten',
  zeigePlatzhalter = variante === 'kasten',
  onGrundBearbeiten,
  bearbeitenDeaktiviert = false,
  onZuruecknehmen,
  aufDunkel = false,
}) => {
  if (!istAbgesagt(event) || !event) return null;

  const grund = event.cancelled_reason?.trim() || '';
  const absager = absageUrheberZeile(event);
  const grundUrheber = absagegrundUrheberZeile(event);

  // Nichts zu sagen und nichts zu tun -> gar nicht rendern. Eine leere Box
  // unter einem Termin, der ohnehin schon "Abgesagt" im Kopf traegt, ist nur
  // Flaeche.
  if (!grund && !zeigePlatzhalter && !onGrundBearbeiten && !onZuruecknehmen) return null;

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
    <IonList className="app-section-inset" inset={true}>
      <IonListHeader>
        <div className="app-section-icon app-section-icon--danger">
          <IonIcon icon={ICON_ABSAGE} />
        </div>
        <IonLabel>Absage</IonLabel>
      </IonListHeader>
      <IonCard className="app-card">
        <IonCardContent className="app-card-content">
          <div className="app-absage-block__text">
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
          </div>
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
          {/* ABSAGE ZURUECKNEHMEN (16.09.2026): Die Heizung ist doch rechtzeitig
              repariert. Steht neben dem Grund und nicht an einer eigenen Stelle,
              weil beides dasselbe betrifft -- die Absage -- und dieselbe
              Berechtigung hat (requireTeamer + darfTermin, wie das Absagen
              selbst). Kein Rechte-Gate hier: Wer nicht darf, bekommt 403.

              Nicht 'danger': Der Knopf hebt eine Absage AUF. In Rot gelesen,
              neben einer roten Zeile, sieht er aus wie "noch endgueltiger
              absagen". Die Rueckfrage stellt der Aufrufer -- sie muss sagen, wie
              viele Leute dabei einen Push bekommen. */}
          {onZuruecknehmen && (
            <IonButton
              size="small"
              fill="clear"
              color="success"
              disabled={bearbeitenDeaktiviert}
              onClick={onZuruecknehmen}
              style={{ marginTop: 'var(--app-abstand-mini)', marginLeft: 'calc(-1 * var(--app-abstand-mini))' }}
            >
              <IonIcon icon={ICON_RUECKGAENGIG} className="app-event-detail__icon-gap" />
              Absage zurücknehmen
            </IonButton>
          )}
        </IonCardContent>
      </IonCard>
    </IonList>
  );
};

export default AbsageBlock;
