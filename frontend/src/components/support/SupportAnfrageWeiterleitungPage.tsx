// Die alte Adresse einer Anfrage, /admin/support/anfragen/:id, führt zum
// Vorgang dieser Anfrage (docs/planung/support-vorgaenge.md, Entscheidung 7:
// „Anfragen ist ein Filter der Vorgänge"). Die Anfrage hat keine eigene Seite
// mehr -- ihre Angaben, ihr Verlauf und „Gemeinde anlegen" stehen im Vorgang.
//
// Aus der Anfrage allein lässt sich die Adresse des Vorgangs nicht bilden: Die
// Seite sucht ihn in den Listen (GET /support/vorgaenge?filter=offen und
// ?filter=archiv, Feld `anfrage_id`) und ersetzt sich dann durch ihn. Links aus
// alten Mitteilungen, Lesezeichen und Mails mit dem Kennzeichen „[Anfrage N]"
// kommen so weiter an. Gibt es den Vorgang nicht (mehr), sagt die Seite das und
// führt zur Liste der Anfragen.

import React, { useEffect, useState } from 'react';
import { IonButton, IonContent, IonPage, useIonRouter } from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_LISTE } from '../shared/icons';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { NurSupport } from './SupportBausteine';
import { vorgaengeLaden } from './useVorgangsliste';
import { useSupportZurueck } from './useSupportZurueck';
import WebSeite from '../web/WebSeite';
import WebKnopf from '../web/WebKnopf';
import { WebFehler, WebLaden, WebLeer } from '../web/WebZustaende';

interface Props {
  anfrageId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite fuehrt selbst weiter. */
  onBack?: () => void;
}

const ANFRAGEN_LISTE = `${SUPPORT_VORGAENGE}?art=neue_gemeinde`;

type Stand = 'sucht' | 'fehlt' | 'fehler';

/** Sucht den Vorgang der Anfrage und ersetzt die Seite durch ihn. */
function useVorgangDerAnfrage(anfrageId: number): [Stand, () => void] {
  const router = useIonRouter();
  const [stand, setStand] = useState<Stand>('sucht');
  const [versuch, setVersuch] = useState(0);

  useEffect(() => {
    let aktiv = true;
    if (!Number.isInteger(anfrageId) || anfrageId <= 0) {
      void Promise.resolve().then(() => { if (aktiv) setStand('fehlt'); });
      return () => { aktiv = false; };
    }
    void (async () => {
      const [offen, archiv] = await Promise.allSettled([vorgaengeLaden('offen'), vorgaengeLaden('archiv')]);
      if (!aktiv) return;
      const gefunden = [offen, archiv]
        .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
        .find((v) => v.anfrage_id === anfrageId);
      if (gefunden) router.push(`${SUPPORT_VORGAENGE}/${gefunden.id}`, 'none', 'replace');
      else setStand(offen.status === 'rejected' && archiv.status === 'rejected' ? 'fehler' : 'fehlt');
    })();
    return () => { aktiv = false; };
  }, [anfrageId, versuch, router]);

  return [stand, () => { setStand('sucht'); setVersuch((v) => v + 1); }];
}

const AnfrageAppFassung: React.FC<{ stand: Stand; erneut: () => void }> = ({ stand, erneut }) => {
  const zurueck = useSupportZurueck(ANFRAGEN_LISTE);
  return (
    <IonPage>
      <AppKopfzeile titel="Anfrage" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Anfrage" />
        {stand === 'sucht' ? (
          <LoadingSpinner message="Anfrage wird geöffnet..." />
        ) : (
          <EmptyState
            icon={ICON_LISTE}
            title={stand === 'fehler' ? 'Nicht geladen' : 'Anfrage nicht gefunden'}
            message={stand === 'fehler' ? 'Die Vorgänge konnten nicht geladen werden. Zieh die Seite zum Aktualisieren herunter oder geh zurück.' : 'Zu dieser Anfrage gibt es keinen Vorgang (mehr).'}
          />
        )}
        {stand === 'fehler' && (
          <div style={{ margin: 'var(--app-abstand-basis)', textAlign: 'center' }}>
            <IonButton fill="outline" onClick={erneut}>Erneut versuchen</IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

const AnfrageWebFassung: React.FC<{ stand: Stand; erneut: () => void }> = ({ stand, erneut }) => (
  <WebSeite bereich="Support" titel="Anfrage" zurueck={{ href: ANFRAGEN_LISTE, text: 'Alle Anfragen' }}>
    {stand === 'sucht' && <WebLaden karten={1} text="Die Anfrage wird geöffnet." />}
    {stand === 'fehler' && <WebFehler text="Die Vorgänge konnten nicht geladen werden." onErneut={erneut} />}
    {stand === 'fehlt' && (
      <WebLeer
        icon={ICON_LISTE}
        titel="Anfrage nicht gefunden"
        text="Zu dieser Anfrage gibt es keinen Vorgang (mehr) — vielleicht wurde sie gelöscht."
        aktion={<WebKnopf href={ANFRAGEN_LISTE}>Alle Anfragen</WebKnopf>}
      />
    )}
  </WebSeite>
);

/** Die Suche laeuft erst, wenn der Schutz „nur Support" die Seite einhaengt -- fuer andere Konten kein Abruf. */
const Suche: React.FC<{ anfrageId: number }> = ({ anfrageId }) => {
  const breit = useBreitesLayout();
  const [stand, erneut] = useVorgangDerAnfrage(anfrageId);
  return breit ? <AnfrageWebFassung stand={stand} erneut={erneut} /> : <AnfrageAppFassung stand={stand} erneut={erneut} />;
};

const SupportAnfrageWeiterleitungPage: React.FC<Props> = ({ anfrageId }) => (
  <NurSupport titel="Anfrage"><Suche anfrageId={anfrageId} /></NurSupport>
);

export default SupportAnfrageWeiterleitungPage;
