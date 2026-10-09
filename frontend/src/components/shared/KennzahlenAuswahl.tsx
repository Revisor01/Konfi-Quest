import React, { useCallback, useEffect, useState } from 'react';
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
  ICON_CHALLENGE_GEFUELLT,
  ICON_INFO,
  ICON_PULS,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
  ICON_TEXTDOKUMENT_GEFUELLT
} from './icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import { fehlerText } from '../../utils/fehler';
import { tastaturKlick } from '../../utils/tastatur';

/**
 * Kennzahlen-Wahl der Leitung (docs/planung/darf-freigeben.md, entschieden
 * 09.10.2026): je Bereich -- Anträge, Events verbuchen, Challenge-Beiträge --
 * an oder aus, persönlich und je Gemeinde. Aus heißt: keine rote Zahl am
 * Reiter, nichts davon in der Zahl am App-Symbol und kein Push dafür.
 *
 * DER SERVER RECHNET, DIE APP ZEIGT: GET /notifications/badge-counts liefert
 * für einen abgewählten Bereich schon 0. Hier wird nur gewählt und danach
 * neu geholt (BadgeContext.refreshAllCounts) -- keine zweite Rechnung in der
 * App, die mit dem Server auseinanderlaufen könnte.
 *
 * Nur für die Rollen admin und org_admin; Teamer:innen und Konfis haben diese
 * Zahlen nicht (der Server antwortet ihnen mit 403).
 */

export interface Kennzahlen {
  antraege: boolean;
  verbuchen: boolean;
  challenges: boolean;
}

export const KENNZAHL_BEREICHE: { id: keyof Kennzahlen; name: string; beschreibung: string }[] = [
  { id: 'antraege', name: 'Anträge', beschreibung: 'Offene Anträge zum Entscheiden' },
  { id: 'verbuchen', name: 'Events verbuchen', beschreibung: 'Vergangene Events, an denen noch nichts verbucht ist' },
  { id: 'challenges', name: 'Challenge-Beiträge', beschreibung: 'Neue Beiträge zum Freigeben' },
];

/** Symbol je Bereich, wie die Zeilen der Konto-Einstellungen eins tragen. */
const BEREICH_ICON: Record<keyof Kennzahlen, string> = {
  antraege: ICON_TEXTDOKUMENT_GEFUELLT,
  verbuchen: ICON_TERMIN_GEFUELLT,
  challenges: ICON_CHALLENGE_GEFUELLT,
};

/** Wer die Wahl hat -- dieselbe Regel wie im Backend (utils/leitungKennzahlen.js). */
export const hatKennzahlenWahl = (rolle?: string | null): boolean =>
  rolle === 'admin' || rolle === 'org_admin';

// Vorgabe: alles an. Fehlt ein Feld, gilt es als an.
const ausAntwort = (d: Partial<Kennzahlen> | undefined): Kennzahlen => ({
  antraege: d?.antraege !== false,
  verbuchen: d?.verbuchen !== false,
  challenges: d?.challenges !== false,
});

export const ladeKennzahlen = async (): Promise<Kennzahlen> => {
  const res = await api.get('/notifications/kennzahlen');
  return ausAntwort(res.data);
};

/** Kurzfassung für die Meta-Zeile des Eintrags. */
export const kennzahlenZusammenfassung = (k: Kennzahlen | null): string => {
  if (!k) return 'Welche Bereiche eine rote Zahl bekommen';
  const an = KENNZAHL_BEREICHE.filter((b) => k[b.id]).length;
  if (an === KENNZAHL_BEREICHE.length) return 'Alle Bereiche mit roter Zahl';
  if (an === 0) return 'Keine roten Zahlen für Anträge, Events und Challenges';
  return `${an} von ${KENNZAHL_BEREICHE.length} Bereichen mit roter Zahl`;
};

interface ModalProps {
  onClose: () => void;
  /** Nach jeder gespeicherten Änderung, damit der Eintrag darunter mitzieht. */
  onGeaendert?: (k: Kennzahlen) => void;
}

/** Das Fenster: drei Schalter, jeder Wechsel wird sofort gespeichert (PUT). */
export const KennzahlenModal: React.FC<ModalProps> = ({ onClose, onGeaendert }) => {
  const { setError } = useApp();
  const { refreshAllCounts } = useBadge();
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [speichert, setSpeichert] = useState(false);

  // Einmal beim Öffnen laden -- bewusst ohne setError in den Abhängigkeiten
  // (Begründung wie in PushAuswahlModal).
  useEffect(() => {
    let abgemeldet = false;
    ladeKennzahlen()
      .then((k) => { if (!abgemeldet) setKennzahlen(k); })
      .catch((err) => { if (!abgemeldet) setError(fehlerText(err, 'Die Kennzahlen konnten nicht geladen werden.')); })
      .finally(() => { if (!abgemeldet) setLaedt(false); });
    return () => { abgemeldet = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schalten = useCallback(async (id: keyof Kennzahlen, an: boolean) => {
    if (!kennzahlen) return;
    setSpeichert(true);
    try {
      const res = await api.put('/notifications/kennzahlen', { [id]: an });
      const neu = ausAntwort(res.data ?? { ...kennzahlen, [id]: an });
      setKennzahlen(neu);
      onGeaendert?.(neu);
      // Der Server rechnet die Zahlen neu; die App holt sie nur.
      void refreshAllCounts();
    } catch (err) {
      setError(fehlerText(err, 'Einstellung konnte nicht gespeichert werden'));
    } finally {
      setSpeichert(false);
    }
  }, [kennzahlen, onGeaendert, refreshAllCounts, setError]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Kennzahlen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background">
        {/* Aufbau wie die Schwesterseiten unter Mehr › Konto (Simon,
            09.10.2026: "falsche Schriftgrößen, die Hinweistexte sehen nicht
            aus wie auf den anderen Unterseiten, Subtexte zu groß"). Vorher
            IonItem mit <h2>/<p>: Das iOS-Theme setzt <p> in einer Karte auf
            "inherit" und überstimmt damit die Kartenregel -- gemessen 16 px
            Untertext unter 14,4 px Titel. Jetzt die Zeilen der Konto-
            Einstellungen (app-list-item wie AbsturzberichteSchalter: Titel
            15,2 px, Untertext 12 px) und der Hinweis als eigener Abschnitt
            wie in ChangeEmailModal. */}
        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={ICON_PULS} />
            </div>
            <IonLabel>Kennzahlen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent style={{ padding: 'var(--app-abstand-mittel)' }}>
              {laedt || !kennzahlen ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-mittel)' }}>
                  {laedt ? <IonSpinner name="crescent" /> : null}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {KENNZAHL_BEREICHE.map((b) => (
                    <div key={b.id} className="app-list-item app-list-item--users" style={{ width: '100%' }}>
                      <div className="app-list-item__row">
                        <div className="app-list-item__main">
                          <div className="app-icon-circle app-icon-circle--users">
                            <IonIcon icon={BEREICH_ICON[b.id]} />
                          </div>
                          <div className="app-list-item__content">
                            <div className="app-list-item__title">{b.name}</div>
                            <div className="app-list-item__meta">
                              <span className="app-list-item__meta-item">{b.beschreibung}</span>
                            </div>
                          </div>
                        </div>
                        <IonToggle
                          className="app-toggle--users"
                          // Abstand zum Text: app-list-item__row hat keinen gap, sonst stoesst
                          // ein langer Untertitel an den Schalter.
                          style={{ marginInlineStart: 'var(--app-abstand-mittel)', flexShrink: 0 }}
                          aria-label={b.name}
                          checked={kennzahlen[b.id]}
                          disabled={speichert}
                          onIonChange={(e) => { void schalten(b.id, e.detail.checked); }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </IonList>

        <IonList inset={true} className="app-segment-wrapper">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--users">
              <IonIcon icon={ICON_INFO} />
            </div>
            <IonLabel>Hinweis</IonLabel>
          </IonListHeader>
          <IonCard className="app-card app-info-box--blue">
            <IonCardContent className="app-info-box">
              <p style={{ margin: 0 }}>
                Aus heißt: keine rote Zahl am Reiter, nichts davon in der Zahl am
                App-Symbol und kein Push dafür. Gilt für diese Gemeinde.
              </p>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

interface EintragProps {
  /** Ref der Seite für die Karten-Darstellung des Fensters; erst beim Antippen gelesen. */
  presentingRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Der Eintrag in den Konto-Einstellungen der App (Mehr › Konto), direkt unter
 * „Benachrichtigungen". Die Seite bindet ihn nur für admin/org_admin ein.
 */
const KennzahlenEintrag: React.FC<EintragProps> = ({ presentingRef }) => {
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(null);

  useEffect(() => {
    let abgemeldet = false;
    ladeKennzahlen()
      .then((k) => { if (!abgemeldet) setKennzahlen(k); })
      .catch(() => { /* Meta-Zeile fällt auf den neutralen Text zurück */ });
    return () => { abgemeldet = true; };
  }, []);

  const [zeigeModal, schliesseModal] = useIonModal(KennzahlenModal, {
    onClose: () => schliesseModal(),
    onGeaendert: (k: Kennzahlen) => setKennzahlen(k)
  });

  return (
    <div role="button" tabIndex={0} onKeyDown={tastaturKlick}
      className="app-list-item app-list-item--users"
      style={{ width: '100%', cursor: 'pointer' }}
      onClick={() => zeigeModal({ presentingElement: presentingRef?.current ?? undefined })}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--users">
            <IonIcon icon={ICON_PULS} />
          </div>
          <div className="app-list-item__content">
            <div className="app-list-item__title">Kennzahlen</div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">{kennzahlenZusammenfassung(kennzahlen)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KennzahlenEintrag;
