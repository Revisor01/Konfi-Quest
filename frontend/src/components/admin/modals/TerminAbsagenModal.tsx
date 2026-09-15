import React, { useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonNote,
  IonTextarea,
  IonIcon,
  IonCard,
  IonCardContent,
  IonList,
  IonListHeader,
  IonSpinner,
} from '@ionic/react';
import {
  ICON_GESPERRT,
  ICON_HAKEN,
  ICON_SCHLIESSEN,
} from '../../shared/icons';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { useApp } from '../../../contexts/AppContext';

// TERMIN ABSAGEN, MIT GRUND (15.09.2026)
//
// Simons Fall: Die Konfifreizeit faellt aus, weil die Heizung im Gemeindehaus
// kaputt ist. Zwanzig Konfis bekommen "Abgesagt" -- und sonst nichts. Die
// Rueckfragen landen danach einzeln im Chat und am Telefon, obwohl die Leitung
// den Grund beim Absagen im Kopf hatte.
//
// EIN MODAL, KEIN ACTION SHEET -- nach derselben Linie wie bei der Abmeldung
// (siehe AbmeldungNachtragenModal): Wer etwas SCHREIBT, bekommt ein Modal; wer
// nur BESTAETIGT, einen Alert oder ein Sheet. Bis hierher war die Absage eine
// reine Bestaetigung und damit zu Recht ein Action Sheet. Mit dem Freitextfeld
// ist sie keine mehr -- ein Sheet bietet kein mitwachsendes Textfeld und auf
// kleinen Geraeten kaum Platz.
//
// DER GRUND IST FREIWILLIG (Entscheidung Simon, 15.09.2026): Leer absenden
// muss gehen und verhaelt sich dann exakt wie vorher -- derselbe Push-Text,
// keine zusaetzliche Zeile am Termin. Eine Absage ist oft eilig, morgens um
// sieben, wenn feststeht, dass es nicht geht; ein Pflichtfeld hielte sie auf.
//
// DER HINWEIS SAGT, WER MITLIEST: Der Grund geht an ALLE Teilnehmenden und in
// den Push (Entscheidung Simon, 15.09.2026). Das ist keine Nebenwirkung,
// sondern der Zweck -- aber es muss an der Stelle stehen, an der jemand den
// Text tippt. Sonst schreibt die Leitung eine interne Notiz ("Team hat
// verpennt") in ein Feld, das zwanzig Konfis lesen. Dieselbe Regel wie beim
// Abmelde-Modal: eine Folge, die in diesem Moment eintritt und nicht
// rueckgaengig zu machen ist, gehoert dorthin, wo man sie ausloest.

interface TerminAbsagenModalProps {
  /** Name des Termins — steht im Kopf des Modals. */
  terminName: string;
  /** Datum als fertiger Text, z. B. "Sa., 20.09.2026". */
  terminDatum: string;
  /** Wie viele Konfis angemeldet sind — dieselbe Zahl wie bisher im Sheet. */
  konfiAnzahl: number;
  /** Sagt den Termin ab. Leerer Grund heisst: kein Grund. */
  onSave: (grund: string) => Promise<void> | void;
  dismiss: () => void;
}

const TerminAbsagenModal: React.FC<TerminAbsagenModalProps> = ({
  terminName,
  terminDatum,
  konfiAnzahl,
  onSave,
  dismiss,
}) => {
  const { isOnline } = useApp();
  const [grundText, setGrundText] = useState('');
  const { isSubmitting, guard } = useActionGuard();

  const handleSave = async () => {
    await guard(async () => {
      await onSave(grundText.trim());
      dismiss();
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Absagen</IonTitle>
          <IonButtons slot="start">
            <IonButton aria-label="Abbrechen" className="app-modal-close-btn" onClick={dismiss} disabled={isSubmitting}>
              <IonIcon icon={ICON_SCHLIESSEN} />
            </IonButton>
          </IonButtons>
          <IonButtons slot="end">
            <IonButton
              aria-label="Termin absagen"
              className="app-modal-submit-btn app-modal-submit-btn--events"
              onClick={handleSave}
              disabled={isSubmitting || !isOnline}
            >
              {isSubmitting ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonList inset={true} className="app-modal-section">
          <IonListHeader>
            <div className="app-section-icon app-section-icon--events">
              <IonIcon icon={ICON_GESPERRT} />
            </div>
            <IonLabel>„{terminName}“ absagen</IonLabel>
          </IonListHeader>
          <IonCard className="app-card">
            <IonCardContent>
              {/* Dieselben Eckdaten, die vorher im Kopf des Action Sheets
                  standen — damit beim Absagen sichtbar bleibt, um welchen
                  Termin es geht und wie viele Leute es trifft. */}
              <IonNote className="app-hinweis-text">
                {terminDatum} · {konfiAnzahl} {konfiAnzahl === 1 ? 'Konfi angemeldet' : 'Konfis angemeldet'}
              </IonNote>
              <IonList style={{ background: 'transparent', padding: '0' }}>
                <IonItem lines="none" style={{ '--background': 'transparent' }}>
                  <IonTextarea
                    label="Grund (optional)"
                    labelPlacement="stacked"
                    value={grundText}
                    onIonInput={(e) => setGrundText(e.detail.value ?? '')}
                    placeholder="z. B. „Heizung im Gemeindehaus defekt“"
                    rows={3}
                    autoGrow={true}
                    maxlength={500}
                    disabled={isSubmitting}
                  />
                </IonItem>
              </IonList>
              <IonNote className="app-hinweis-text">
                Alle Angemeldeten sehen den Grund am Termin und bekommen ihn in der Mitteilung.
                Ohne Grund wird nur die Absage gemeldet.
              </IonNote>
            </IonCardContent>
          </IonCard>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default TerminAbsagenModal;
