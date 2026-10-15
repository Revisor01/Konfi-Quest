import React from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonListHeader,
  IonLabel,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonIcon,
} from '@ionic/react';
import WartendeVorgaengeKarte from '../shared/WartendeVorgaengeKarte';
import EmptyState from '../shared/EmptyState';
import OfflinePlatzhalter from '../shared/OfflinePlatzhalter';
import {
  ICON_GLOCKE,
  ICON_BENACHRICHTIGUNG,
  ICON_TERMIN_GEFUELLT,
  ICON_ORGANISATION_GEFUELLT,
  ICON_SCHLIESSEN,
} from '../shared/icons';
import {
  mitteilungsTitel,
  postfachBereich,
  zeitpunktText,
} from '../../utils/postfach';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { eintragSymbol, POSTFACH_OFFLINE_WAS, usePostfach, usePostfachSchalter } from './usePostfach';
import WebPostfachDialog from './web/WebPostfachDialog';

/** Wie viele Mitteilungen je Seite geladen werden (steht in usePostfach). */
export { POSTFACH_SEITENGROESSE } from './usePostfach';

/**
 * Das Postfach: ein Ort fuer alles, was die App jemandem mitteilen will.
 *
 * Simon (25.09.2026): "Postfach bauen!" — erreichbar ueber die Glocke in der
 * Kopfzeile (PostfachGlocke), fuer alle drei Rollen.
 *
 * ZWEI QUELLEN, EIN ORT:
 *
 * 1. Empfangene Mitteilungen (Tabelle notifications). Gemessen in Produktion
 *    am 25.09.2026: 1.324 Zeilen, 570 in den letzten 30 Tagen — Abzeichen,
 *    eingegangene Antraege, eingereichte Antraege, Entscheidungen. Geschrieben
 *    wurde sie an sechs Stellen, GELESEN NIRGENDS: Es gab keine Leseroute und
 *    keinen Aufruf in der App. Wer den Push verpasst hatte, hatte die
 *    Nachricht verpasst. Seit dem 25.09.2026 liefert GET /notifications/postfach
 *    die eigenen Mitteilungen ueber ALLE Gemeinden des Kontos (Begruendung
 *    dort: das Postfach ist persoenlich wie das Mitteilungszentrum des
 *    Handys), jede mit dem Namen ihrer Gemeinde.
 *
 * 2. Die Offline-Warteschlange (services/writeQueue): was noch gesendet wird
 *    und was endgueltig gescheitert ist. Vorher hing dafuer ein runder Knopf
 *    links unten ueber der App (WartendeVorgaengeLeiste) — Simon: "sitzt an
 *    einer komischen Stelle", "falsch im Layout". Er geht in der Glocke auf.
 *    Die Karte auf den Terminseiten (WartendeVorgaengeKarte) BLEIBT dort:
 *    Die Glocke sagt "da ist noch was", die Karte sagt "und zwar das".
 *
 * DIE FORM DER LISTE (Simon, 25.09.2026, am Geraet): "Dann sollte es die
 * Listen so aussehen wie alle unsere Listen. Ionen-Card im Hintergrund /
 * Listen obendrauf / Aktivitaeten mit der klassischen Aktivitaetenfarbe /
 * Events mit der klassischen Eventsfarbe / Chat mit der klassischen
 * Chatfarbe und so weiter." Die erste Fassung war eine schlichte IonList mit
 * IonItems und einem Punkt davor -- anders als jede andere Liste der App.
 * Jetzt derselbe Bauplan wie ChatOverview, TeamerProfilePage und die
 * Warteschlange direkt darueber: IonList inset mit IonListHeader, darin eine
 * IonCard, darin je Mitteilung ein .app-list-item mit farbigem linken Rand
 * (.app-list-item--<bereich>) und Farbkreis (.app-icon-circle--<bereich>).
 * Welche Farbe: utils/postfach.postfachBereich -- Abzeichen in der
 * Abzeichenfarbe, Antraege in der Aktivitaetenfarbe. Die Warteschlange
 * traegt ihre Farben schon (orange fuer "wird gesendet", rot fuer
 * "nicht gesendet", WartendeVorgaengeKarte), das bleibt unveraendert.
 *
 * Antippen einer Mitteilung markiert sie als gelesen und fuehrt zum Ziel —
 * ueber denselben Weg wie ein angetippter Push (utils/pushNavigation):
 * bei Bedarf erst in die Gemeinde des Inhalts wechseln, dann navigieren.
 * Nichts davon ist hier neu erfunden.
 *
 * Haengt EINMAL auf App-Ebene (wie GlobalToasts) und hoert auf das Ereignis
 * aus utils/postfach. Die Glocke steht auf jeder Seite, das Modal nicht —
 * sonst laegen so viele Modale im Speicher, wie Seiten gemountet sind.
 */
interface PostfachAppModalProps {
  offen: boolean;
  praesentiertVon: HTMLElement | undefined;
  onSchliessen: () => void;
}

/** Das Modal der App (und des schmalen Browserfensters). */
const PostfachAppModal: React.FC<PostfachAppModalProps> = ({ offen, praesentiertVon, onSchliessen: schliessen }) => {
  const {
    eintraege, ungelesen, weitere, laedt, ladefehler, mehrereGemeinden, listeLeer,
    wartend, gescheitert, hatWarteschlange, vergessen, alleVergessen,
    antippen, alleGelesen, aeltereLaden,
  } = usePostfach({ offen, schliessen });

  return (
    // presentingElement: Auf iOS die Karte mit Abdunklung, wie jedes andere
    // Modal der App (Begruendung bei postfachPraesentationsElement).
    <IonModal aria-labelledby="postfach-modal-titel" isOpen={offen} onDidDismiss={schliessen} presentingElement={praesentiertVon}>
      <IonHeader>
        <IonToolbar>
          {/* Schliessen-Symbol links wie in InfoModal, PointsHistoryModal und
              allen anderen Modalen -- kein Text-Knopf "Fertig" (Simon,
              25.09.2026: "machen ein Symbol wie ueberall"). */}
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={schliessen} aria-label="Schließen">
              <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle id="postfach-modal-titel">Postfach</IonTitle>
        </IonToolbar>
      </IonHeader>
      {/* Der Verlauf-Hintergrund aller Seiten und Modale; die Inhalte stehen
          darauf in Karten (app-card), wie ueberall sonst. */}
      <IonContent className="app-gradient-background">
        {hatWarteschlange && (
          <section aria-label="Warteschlange" data-testid="postfach-warteschlange">
            <WartendeVorgaengeKarte
              wartend={wartend}
              gescheitert={gescheitert}
              onVergessen={vergessen}
            />
            {gescheitert.length > 1 && (
              <div style={{ padding: '0 var(--app-abstand-basis) var(--app-abstand-basis)' }}>
                <IonButton expand="block" fill="clear" onClick={alleVergessen}>
                  Alle Fehlschläge wegwischen
                </IonButton>
              </div>
            )}
          </section>
        )}

        <section aria-label="Mitteilungen" data-testid="postfach-mitteilungen">
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--info">
                <IonIcon icon={ICON_BENACHRICHTIGUNG} />
              </div>
              <IonLabel>Mitteilungen</IonLabel>
              {ungelesen > 0 && (
                <IonButton size="small" fill="clear" onClick={alleGelesen}>
                  Alle gelesen
                </IonButton>
              )}
            </IonListHeader>
            {/* Kein eigener Kartengrund mehr (26.09.2026): Vom 25.09. bis hierher
                stand `--background: var(--app-surface-card)` inline an dieser
                Karte, weil sie auf Simons iPhone nicht die Tokenfarbe trug.
                Die Ursache lag nicht im Modal, sondern in der Kartenregel
                selbst: ion-card.app-card verlor auf iOS an Spezifitaet gegen
                das ios27-Theme (Dunkelmodus-Audit BF-03) -- auf JEDER Seite,
                nur im Hellen unsichtbar. Die Regel in theme/variables.css
                schlaegt das Theme jetzt selbst; ein Flicken hier wuerde das
                nur wieder verdecken. */}
            <IonCard className="app-card" data-testid="postfach-karte">
              <IonCardContent style={{ padding: listeLeer ? 'var(--app-abstand-basis)' : 'var(--app-abstand-mittel)' }}>
                {laedt && listeLeer && (
                  <div className="app-postfach__laedt">
                    <IonSpinner name="crescent" />
                  </div>
                )}

                {ladefehler && listeLeer && (
                  <OfflinePlatzhalter was={POSTFACH_OFFLINE_WAS} />
                )}

                {!laedt && !ladefehler && listeLeer && (
                  <EmptyState
                    icon={ICON_GLOCKE}
                    title="Nichts Neues"
                    message="Hier landen Punkte, Badges, Events, Anträge und Entscheidungen — auch die, deren Push du verpasst hast."
                  />
                )}

                {eintraege.map(eintrag => {
                  const ungelesenerEintrag = !eintrag.read_at;
                  const bereich = postfachBereich(eintrag.type);
                  const symbol = eintragSymbol(eintrag, bereich);
                  const zeitpunkt = zeitpunktText(eintrag.created_at);
                  const gemeinde = mehrereGemeinden && eintrag.organization_name ? eintrag.organization_name : null;
                  const klassen = [
                    'app-list-item',
                    `app-list-item--${bereich}`,
                    'app-postfach-eintrag',
                    ungelesenerEintrag ? 'app-postfach-eintrag--ungelesen' : null,
                  ].filter(Boolean).join(' ');
                  return (
                    <div
                      key={eintrag.id}
                      role="button"
                      tabIndex={0}
                      className={klassen}
                      data-ungelesen={ungelesenerEintrag ? 'true' : 'false'}
                      data-bereich={bereich}
                      onClick={() => antippen(eintrag)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          antippen(eintrag);
                        }
                      }}
                    >
                      {/* Ungelesen: ein blauer Punkt in der Ecke, ohne Zahl
                          und ohne Symbol -- derselbe Punkt wie an der Glocke
                          (Simon, TestFlight 233, 29.09.2026: "Das Symbol der
                          blauen Briefkaesten fuer die Post am Postfach gefaellt
                          mir nicht"). Bis dahin ein geschlossener Umschlag im
                          Eselsohr. Der Klartext steht in title/aria-label;
                          Lage und Groesse regelt das Stylesheet
                          (.app-postfach-eintrag__punkt). */}
                      {ungelesenerEintrag && (
                        <span
                          className="app-ungelesen-punkt app-postfach-eintrag__punkt"
                          title="Neu — ungelesen"
                          role="img"
                          aria-label="Neu — ungelesen"
                        />
                      )}
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className={`app-icon-circle app-icon-circle--${bereich}`}>
                            {symbol.emoji !== undefined
                              ? <span data-testid="postfach-emoji" style={{ fontSize: 'var(--app-text-untertitel)', lineHeight: 1 }}>{symbol.emoji}</span>
                              : <IonIcon icon={symbol.icon} />}
                          </div>
                          <div className="app-list-item__content">
                            <div
                              className="app-list-item__title"
                              style={ungelesenerEintrag ? { paddingRight: 'var(--app-abstand-weit)' } : undefined}
                            >
                              {mitteilungsTitel(eintrag)}
                            </div>
                            <div className="app-list-item__subtitle">{eintrag.message}</div>
                            {/* Datum und Gemeinde mit Symbol, wie Datum und Ort in
                                den Terminlisten (konfi/views/EventsView). */}
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item" data-testid="postfach-zeitpunkt">
                                <IonIcon icon={ICON_TERMIN_GEFUELLT} className="app-icon-color--events" />
                                {zeitpunkt}
                              </span>
                              {gemeinde && (
                                <span className="app-list-item__meta-item" data-testid="postfach-gemeinde">
                                  <IonIcon icon={ICON_ORGANISATION_GEFUELLT} className="app-icon-color--organizations" />
                                  {gemeinde}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </IonCardContent>
            </IonCard>
          </IonList>

          {weitere && !ladefehler && (
            <div style={{ padding: '0 var(--app-abstand-basis) var(--app-abstand-basis)' }}>
              <IonButton expand="block" fill="clear" disabled={laedt} onClick={aeltereLaden}>
                Ältere Mitteilungen laden
              </IonButton>
            </div>
          )}
        </section>
      </IonContent>
    </IonModal>
  );
};

/**
 * Das Postfach auf App-Ebene: hoert auf die Glocke und zeigt in den Apps und
 * im schmalen Fenster das Modal, im Browser ab 992 px den Dialog der
 * Web-Fassung (common/web/WebPostfachDialog). Simon, 15.10.2026: Was im
 * Browser noch ein App-Modal oeffnet, bekommt ein kompaktes Web-Fenster; in
 * den Apps bleibt das Modal, wie es ist. Beide lesen dieselbe Logik
 * (usePostfach): dieselben Mitteilungen, dieselben Wege zum Server, dasselbe
 * Ziel beim Klick, dieselben Zaehler.
 */
const PostfachModal: React.FC = () => {
  const { offen, praesentiertVon, schliessen } = usePostfachSchalter();
  const breit = useBreitesLayout();
  if (breit) return offen ? <WebPostfachDialog onSchliessen={schliessen} /> : null;
  return <PostfachAppModal offen={offen} praesentiertVon={praesentiertVon} onSchliessen={schliessen} />;
};

export default PostfachModal;
