import React, { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonModal
} from '@ionic/react';
import {
  ICON_BENACHRICHTIGUNG,
  ICON_CHATS_GEFUELLT,
  ICON_INFO,
  ICON_POKAL_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
  ICON_WARTEND_GEFUELLT
} from './icons';
import { useApp } from '../../contexts/AppContext';
import { tastaturKlick } from '../../utils/tastatur';
import {
  ladePushEinstellungen,
  pushZusammenfassung,
  PUSH_NICHT_ERLAUBT,
  PUSH_POSTFACH_HINWEIS,
  usePushAuswahl,
  type PushEinstellungen,
} from './usePushAuswahl';

/**
 * Auswahl, welche Push-Mitteilungen aufs Handy kommen -- fuer alle drei
 * Rollen (Leitung, Teamer:innen, Konfis).
 *
 * WARUM IN DER APP: Android laesst in den Systemeinstellungen jeden Kanal
 * einzeln stummschalten; iOS kennt das nicht, dort ist Push ganz oder gar
 * nicht. Simon (25.09.2026): "waere doch super, wenn das quasi wie in Android
 * auch auf iOS auswaehlbar macht welche pushes man bekommt." Der Weg, der auf
 * beiden Plattformen geht, ist diese Auswahl hier; der Server (users.
 * push_gruppen_stumm) haelt sie fest und laesst die abgewaehlten Gruppen beim
 * Versand weg. Die Gruppen SIND die Android-Kanaele (services/notifications.ts,
 * utils/pushGruppen.js im Backend) -- damit "Termine" auf dem Geraet und
 * "Termine" hier dasselbe meinen.
 *
 * WELCHE GRUPPEN, ENTSCHEIDET DER SERVER je Rolle: Konfis bekommen "Anfragen
 * und Freigaben" gar nicht angeboten, weil bei ihnen dort nie etwas ankommt.
 * Die App zeigt, was GET /notifications/preferences liefert -- keine zweite
 * Liste hier, die auseinanderlaufen koennte.
 *
 * DAS POSTFACH BLEIBT VOLL: Wer eine Gruppe abwaehlt, bekommt die Mitteilung
 * weiter unter der Glocke. Abgewaehlt wird nur der Weg aufs Handy.
 *
 * BEWUSST EINE GEMEINSAME KOMPONENTE (wie AppSperreSchalter): Die App hat drei
 * getrennte Komponentenbaeume, und die uebliche Falle ist, eine Aenderung nur
 * in einem davon zu machen. Die drei Profil-Seiten binden den Eintrag ein und
 * geben ueber `variante` nur ihre Farbe mit.
 */

export type PushAuswahlVariante = 'users' | 'teamer' | 'purple';

const STIL: Record<PushAuswahlVariante, { sectionIcon: string; toggle: string; infoBox: string }> = {
  users: { sectionIcon: 'app-section-icon--users', toggle: 'app-toggle--users', infoBox: 'app-info-box--blue' },
  teamer: { sectionIcon: 'app-section-icon--teamer', toggle: 'app-toggle--teamer', infoBox: 'app-info-box--teamer' },
  purple: { sectionIcon: 'app-section-icon--purple', toggle: 'app-toggle--konfi', infoBox: 'app-info-box--purple' }
};

// Laden, Kurzfassung und Typen stehen seit 15.10.2026 bei der Logik
// (usePushAuswahl), die App-Modal und Web-Dialog teilen; hier weiter
// erreichbar wie bisher.
export { ladePushEinstellungen, pushZusammenfassung };
export type { PushEinstellungen, PushGruppe } from './usePushAuswahl';

/**
 * Symbol je Gruppe. Die Schluessel sind die Gruppen-IDs des Servers
 * (utils/pushGruppen.js); eine dort neu hinzukommende Gruppe bekommt die
 * Glocke, bis sie hier ein eigenes Symbol hat.
 */
const GRUPPEN_ICON: Record<string, string> = {
  konfi_chat: ICON_CHATS_GEFUELLT,
  konfi_termine: ICON_TERMIN_GEFUELLT,
  konfi_fortschritt: ICON_POKAL_GEFUELLT,
  konfi_verwaltung: ICON_WARTEND_GEFUELLT
};

interface SchalterZeileProps {
  variante: PushAuswahlVariante;
  toggle: string;
  icon: string;
  titel: string;
  untertitel: string;
  ariaLabel: string;
  an: boolean;
  gesperrt: boolean;
  onSchalten: (an: boolean) => void;
}

/** Eine Zeile wie in den Konto-Einstellungen (vgl. AbsturzberichteSchalter). */
const SchalterZeile: React.FC<SchalterZeileProps> = ({ variante, toggle, icon, titel, untertitel, ariaLabel, an, gesperrt, onSchalten }) => (
  <div className={`app-list-item app-list-item--${variante}`} style={{ width: '100%' }}>
    <div className="app-list-item__row">
      <div className="app-list-item__main">
        <div className={`app-icon-circle app-icon-circle--${variante}`}>
          <IonIcon icon={icon} />
        </div>
        <div className="app-list-item__content">
          <div className="app-list-item__title">{titel}</div>
          <div className="app-list-item__meta">
            <span className="app-list-item__meta-item">{untertitel}</span>
          </div>
        </div>
      </div>
      <IonToggle
        className={toggle}
        // Abstand zum Text: app-list-item__row hat keinen gap, sonst stoesst
        // ein langer Untertitel an den Schalter.
        style={{ marginInlineStart: 'var(--app-abstand-mittel)', flexShrink: 0 }}
        aria-label={ariaLabel}
        checked={an}
        disabled={gesperrt}
        onIonChange={(e) => onSchalten(e.detail.checked)}
      />
    </div>
  </div>
);

interface ModalProps {
  onClose: () => void;
  variante: PushAuswahlVariante;
  /** Wird nach jeder gespeicherten Aenderung gerufen, damit der Eintrag darunter mitzieht. */
  onGeaendert?: (e: PushEinstellungen) => void;
}

/**
 * Inhalt des Modals: Hauptschalter oben, darunter die Gruppen der Rolle.
 * Jeder Wechsel wird sofort gespeichert (PUT), wie bei den Dashboard-Schaltern.
 */
export const PushAuswahlModal: React.FC<ModalProps> = ({ onClose, variante, onGeaendert }) => {
  const stil = STIL[variante];
  // Laden, Speichern und Meldungen: dieselbe Logik wie im Dialog des Browsers.
  const { einstellungen, laedt, speichert, hauptSchalten, gruppeSchalten, erlaubt, erlauben } = usePushAuswahl({ onGeaendert });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Benachrichtigungen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background">
        {/* Aufbau wie die Schwesterseiten unter Mehr › Konto (Simon,
            09.10.2026, zuerst am Kennzahlen-Fenster: "Subtexte zu groß",
            die Unterseiten sollen einheitlich aussehen). Vorher IonItem mit
            <h2>/<p>: Das iOS-Theme setzt <p> in einer Karte auf "inherit"
            und ueberstimmt die Kartenregel -- gemessen 16 px Untertext unter
            14,4 px Titel. Jetzt die Zeilen der Konto-Einstellungen
            (app-list-item wie AbsturzberichteSchalter), die Hinweise als
            farbige Karte mit <p> wie in ChangeEmailModal. */}
        {!erlaubt && (
          <IonList inset={true} className="app-segment-wrapper">
            <IonCard className={`app-card ${stil.infoBox}`}>
              <IonCardContent className="app-info-box">
                <p style={{ margin: '0 0 var(--app-abstand-mittel) 0' }}>
                  {PUSH_NICHT_ERLAUBT}
                </p>
                <IonButton size="small" fill="outline" onClick={erlauben}>
                  Mitteilungen erlauben
                </IonButton>
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className={`app-section-icon ${stil.sectionIcon}`}>
              <IonIcon icon={ICON_BENACHRICHTIGUNG} />
            </div>
            <IonLabel>Aufs Handy</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              {laedt || !einstellungen ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-mittel)' }}>
                  <IonSpinner name="crescent" />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <SchalterZeile
                    variante={variante}
                    toggle={stil.toggle}
                    icon={ICON_BENACHRICHTIGUNG}
                    titel="Alle Mitteilungen"
                    untertitel="Hauptschalter für die Gruppen darunter"
                    ariaLabel="Mitteilungen aufs Handy"
                    an={einstellungen.push_enabled}
                    gesperrt={speichert}
                    onSchalten={hauptSchalten}
                  />
                  {einstellungen.gruppen.map((g) => (
                    <SchalterZeile
                      key={g.id}
                      variante={variante}
                      toggle={stil.toggle}
                      icon={GRUPPEN_ICON[g.id] ?? ICON_BENACHRICHTIGUNG}
                      titel={g.name}
                      untertitel={g.beschreibung}
                      ariaLabel={g.name}
                      an={g.aktiv}
                      gesperrt={speichert || !einstellungen.push_enabled}
                      onSchalten={(an) => gruppeSchalten(g.id, an)}
                    />
                  ))}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        {/* Ein Hinweis, nicht zwei (26.09.2026, Simons Befund: "Die
            Hinweistexte bei Benachrichtigungen sind voellig random doppelt").
            Im farbigen Kasten wie ueberall sonst (Simon, 26.09.2026: "wie
            etwa wenn du in das Modal guckst fuer E-Mail") -- als eigener
            Abschnitt "Hinweis" genau wie dort. */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className={`app-section-icon ${stil.sectionIcon}`}>
              <IonIcon icon={ICON_INFO} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className={`app-card ${stil.infoBox}`}>
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                {PUSH_POSTFACH_HINWEIS}
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

interface EintragProps {
  variante: PushAuswahlVariante;
  /** Ref der Seite fuer die Karten-Darstellung des Modals; wird erst beim Antippen gelesen. */
  presentingRef?: React.RefObject<HTMLElement | null>;
  /** Rueckfall, wenn die Seite kein Ref durchreicht (Konfi-Profil). */
  presentingElement?: HTMLElement | null;
}

/**
 * Der Eintrag fuer die Konto-Einstellungen: oeffnet die Auswahl. Fehlt die
 * Berechtigung des Geraets noch, wird sie beim Antippen zusaetzlich
 * angefordert -- das war bis zum 25.09.2026 die EINZIGE Funktion des
 * Leitungs-Eintrags "Benachrichtigungen", und sie bleibt erhalten.
 */
const PushAuswahlEintrag: React.FC<EintragProps> = ({ variante, presentingRef, presentingElement }) => {
  const { pushNotificationsPermission, requestPushPermissions } = useApp();
  const [einstellungen, setEinstellungen] = useState<PushEinstellungen | null>(null);

  useEffect(() => {
    let abgemeldet = false;
    ladePushEinstellungen()
      .then((e) => { if (!abgemeldet) setEinstellungen(e); })
      .catch(() => { /* Meta-Zeile faellt auf den neutralen Text zurueck */ });
    return () => { abgemeldet = true; };
  }, []);

  const [zeigeModal, schliesseModal] = useIonModal(PushAuswahlModal, {
    onClose: () => schliesseModal(),
    variante,
    onGeaendert: (e: PushEinstellungen) => setEinstellungen(e)
  });

  const oeffnen = () => {
    if (pushNotificationsPermission !== 'granted') {
      void requestPushPermissions();
    }
    zeigeModal({ presentingElement: presentingRef?.current ?? presentingElement ?? undefined });
  };

  return (
    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
      className={`app-list-item app-list-item--${variante}`}
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={oeffnen}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className={`app-icon-circle app-icon-circle--lg app-icon-circle--${variante}`}>
            <IonIcon icon={ICON_BENACHRICHTIGUNG} />
          </div>
          <div className="app-list-item__content">
            <div className="app-list-item__title">Benachrichtigungen</div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">{pushZusammenfassung(einstellungen, pushNotificationsPermission)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushAuswahlEintrag;
