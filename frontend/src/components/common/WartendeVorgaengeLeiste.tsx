import React, { useState } from 'react';
import {
  IonIcon,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
} from '@ionic/react';
import { timeOutline, alertCircleOutline } from 'ionicons/icons';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import WartendeVorgaengeKarte from '../shared/WartendeVorgaengeKarte';

/**
 * Kompakter Knopf, der in der ganzen App erscheint, sobald etwas in der
 * Offline-Warteschlange liegt oder endgueltig gescheitert ist. Antippen
 * oeffnet die Liste.
 *
 * War bis zum 30.08.2026 eine vollbreite orange Leiste. Simons Einwand:
 * "fast ein bisschen doll" — fuer drei Vorgangsarten (Abmeldung, Aktivitaet
 * melden, Chat) ein Dauerbalken ueber der ganzen App. Anmelden und
 * Warteliste sind offline naemlich GESPERRT, nicht eingereiht; die Leiste
 * versprach mehr, als die Warteschlange traegt.
 *
 * Jetzt: runder Knopf mit Zaehler-Badge, Farbe nur am Badge. Der volle Satz
 * steht im aria-label (Screenreader lesen ihn weiter) und im Modal. Sitzt
 * LINKS: unten rechts steht auf TeamerEventsPage ein IonFab
 * (TeamerEventsPage.tsx:1566), links ist in allen drei Baeumen frei.
 *
 * Wartend ist Information, Fehlschlag ist eine Aufgabe — deshalb bleibt
 * data-variante="danger" auffaelliger (rot statt orange).
 *
 * Haengt wie GlobalToasts auf App-Ebene. Grund: Die rund zwanzig
 * Leitungs-Aktionen (Kategorien, Jahrgaenge, Abzeichen, Level, Termine,
 * Material, Zertifikate) verteilen sich ueber ebenso viele Seiten mit je
 * eigener Kopfzeile — es gibt keine gemeinsame Huelle, in die sich ein
 * Hinweis pro Ansicht einhaengen liesse. Eine Stelle wirkt hier ueberall,
 * auch dort, wo spaeter etwas Neues eingereiht wird.
 *
 * Die Termin-Seiten zeigen ihre wartenden Vorgaenge zusaetzlich in der Liste
 * selbst (WartendeVorgaengeKarte) — dort steht der Hinweis im Zusammenhang,
 * direkt neben den Antraegen, um die es geht. Das ist Absicht und keine
 * Dopplung: Die Leiste sagt "da ist noch was", die Karte sagt "und zwar das".
 */
const WartendeVorgaengeLeiste: React.FC = () => {
  const { wartend, gescheitert, vergessen, alleVergessen } = useWartendeVorgaenge();
  const [offen, setOffen] = useState(false);

  const anzahl = wartend.length + gescheitert.length;
  if (anzahl === 0) return null;

  const nurGescheitert = wartend.length === 0;
  const text = nurGescheitert
    ? `${gescheitert.length} ${gescheitert.length === 1 ? 'Vorgang wurde' : 'Vorgänge wurden'} nicht gesendet`
    : `${wartend.length} ${wartend.length === 1 ? 'Vorgang wird' : 'Vorgänge werden'} gesendet`;

  return (
    <>
      <button
        type="button"
        className="app-wartende-leiste"
        data-variante={nurGescheitert ? 'danger' : 'warning'}
        onClick={() => setOffen(true)}
        aria-label={`${text} — antippen zeigt die Liste`}
      >
        <IonIcon icon={nurGescheitert ? alertCircleOutline : timeOutline} aria-hidden="true" />
        <span className="app-wartende-leiste__zahl" aria-hidden="true">{anzahl}</span>
      </button>

      <IonModal isOpen={offen} onDidDismiss={() => setOffen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Warteschlange</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setOffen(false)}>Fertig</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <WartendeVorgaengeKarte
            wartend={wartend}
            gescheitert={gescheitert}
            onVergessen={vergessen}
          />
          {gescheitert.length > 1 && (
            <div style={{ padding: '0 16px 16px' }}>
              <IonButton expand="block" fill="clear" onClick={alleVergessen}>
                Alle Fehlschläge wegwischen
              </IonButton>
            </div>
          )}
        </IonContent>
      </IonModal>
    </>
  );
};

export default WartendeVorgaengeLeiste;
