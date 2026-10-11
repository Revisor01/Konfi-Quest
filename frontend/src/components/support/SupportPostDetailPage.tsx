// Eine Mail aus dem Posteingang, /admin/support/post/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Oben Betreff und die Handgriffe „Antworten" (solange die Mail in keinem
// Vorgang liegt, vom selben Postfach an den Absender) und „Einsortieren" (in
// einen bestehenden Vorgang mit Suche oder einen neuen; der Server nimmt den
// ganzen Faden mit) -- beide als Modal (Simon, 11.10.2026). Darunter der Faden
// als Gespräch (MailGespraeche), am Ende Archivieren oder Wiederherstellen und
// Löschen mit Rückfrage. Liegt die Mail in einem Vorgang, führt ein Link
// dorthin; geantwortet wird dort, damit die Nummer im Betreff steht.
//
// Beim Öffnen werden die ungelesenen eingehenden Mails des Fadens als gelesen
// gemeldet; sie tragen auf dieser Seite noch die Marke „Neu".

import React, { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_ANTWORTEN, ICON_ARCHIV, ICON_CHATS, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG, ICON_WECHSEL } from '../shared/icons';
import api from '../../services/api';
import type { MailAntwortDaten } from '../../types/support';
import { POSTFACH_INFO } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import { SUPPORT_POSTEINGANG } from '../../navigation/supportMenue';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import { Hinweis } from './SupportMailTeile';
import MailGespraeche from './MailGespraeche';
import { AntwortModal, EinsortierenModal } from './SupportModale';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPosteingang from './web/WebPosteingang';
import { usePostDetail } from './usePostDetail';

interface Props {
  nachrichtId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

const PostDetail: React.FC<Props> = ({ nachrichtId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_POSTEINGANG);
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, laden, letzteEingehende, betreffVorschlag, vorgangId, archiviert,
    archivieren, wiederherstellen, loeschenFragen,
  } = usePostDetail(nachrichtId);
  const [antwortOffen, setAntwortOffen] = useState(false);
  const [einsortierenOffen, setEinsortierenOffen] = useState(false);

  const kopf = <AppKopfzeile titel="Mail" onZurueck={zurueck} gemeindeUmschalter={false} />;

  if (laedt && !mail) {
    return (
      <IonPage>
        {kopf}
        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel="Mail" />
          <LoadingSpinner message="Mail wird geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  if (!mail) {
    return (
      <IonPage>
        {kopf}
        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel="Mail" />
          {fehler && !nichtGefunden ? (
            <Ladefehler text="Die Mail konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          ) : (
            <EmptyState icon={ICON_MAIL} title="Mail nicht gefunden" message="Diese Mail gibt es nicht (mehr) — archivierte Mails bleiben 180 Tage." />
          )}
        </IonContent>
      </IonPage>
    );
  }

  const imVorgang = vorgangId !== null;
  const antworten = !imVorgang && !archiviert && letzteEingehende !== null;
  const betreff = mail.betreff?.trim() || '(ohne Betreff)';

  return (
    <IonPage>
      {kopf}
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Mail" />

        <SectionHeader
          title={betreff}
          subtitle={mail.von_name?.trim() || mail.von_adresse}
          icon={ICON_MAIL}
          preset="organizations"
          stats={[
            { value: String(faden.length), label: faden.length === 1 ? 'Mail' : 'Mails' },
            { value: POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach, label: 'Postfach' },
            { value: imVorgang ? `Nr. ${vorgangId}` : archiviert ? 'Archiv' : 'Eingang', label: imVorgang ? 'Vorgang' : 'Liegt im' },
          ]}
        />

        {/* Die Handgriffe einer Mail stehen oben; Antworten und Einsortieren öffnen ein Modal. */}
        <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', margin: '0 var(--app-abstand-basis) var(--app-abstand-eng)' }}>
          {antworten && (
            <IonButton style={{ flex: 1 }} onClick={() => setAntwortOffen(true)} disabled={!isOnline}>
              <IonIcon icon={ICON_ANTWORTEN} slot="start" />
              Antworten
            </IonButton>
          )}
          <IonButton style={{ flex: 1 }} fill={antworten ? 'outline' : 'solid'} onClick={() => setEinsortierenOffen(true)} disabled={!isOnline}>
            <IonIcon icon={ICON_WECHSEL} slot="start" />
            {imVorgang ? 'Umsortieren' : 'Einsortieren'}
          </IonButton>
        </div>

        {archiviert && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel="Diese Mail liegt im Archiv">
              {mail.archiviert_am ? `Archiviert am ${datumUhrzeit(mail.archiviert_am)}. ` : ''}Nach 180 Tagen wird sie gelöscht.
            </Hinweis>
          </div>
        )}

        {imVorgang && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel={`Einsortiert in Vorgang ${vorgangId}`}>
              Antworten gehen über den Vorgang, damit die Nummer im Betreff steht.
              <div style={{ marginTop: 'var(--app-abstand-eng)' }}>
                <IonButton size="small" fill="outline" onClick={() => router.push(`/admin/support/vorgaenge/${vorgangId}`)}>
                  <IonIcon icon={ICON_LISTE} slot="start" />
                  Vorgang öffnen
                </IonButton>
              </div>
            </Hinweis>
          </div>
        )}

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations" ohneKarte>
          <MailGespraeche mails={faden} neu={neu} />
        </Abschnitt>

        <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-basis)' }}>
          {archiviert ? (
            <IonButton style={{ flex: 1 }} fill="outline" onClick={() => { void wiederherstellen(); }} disabled={!isOnline}>
              <IonIcon icon={ICON_RUECKGAENGIG} slot="start" />
              Wiederherstellen
            </IonButton>
          ) : (
            <IonButton style={{ flex: 1 }} fill="outline" onClick={() => { void archivieren(); }} disabled={!isOnline}>
              <IonIcon icon={ICON_ARCHIV} slot="start" />
              Archivieren
            </IonButton>
          )}
          <IonButton style={{ flex: 1 }} fill="outline" color="danger" onClick={loeschenFragen} disabled={!isOnline}>
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            Löschen
          </IonButton>
        </div>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />

        {antworten && letzteEingehende && (
          <AntwortModal
            offen={antwortOffen}
            onSchliessen={() => setAntwortOffen(false)}
            formular={{
              postfach: mail.postfach,
              betreffVorschlag,
              an: letzteEingehende.von_adresse,
              senden: (koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper),
            }}
          />
        )}
        <EinsortierenModal
          offen={einsortierenOffen}
          onSchliessen={() => setEinsortierenOffen(false)}
          titel={imVorgang ? 'Anderem Vorgang zuordnen' : 'Einsortieren'}
          mail={{ id: mail.id, betreff: mail.betreff }}
          onFertig={(id) => { if (id) router.push(`/admin/support/vorgaenge/${id}`); }}
        />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster der Posteingang mit
// dieser Mail im Lesebereich (wie ein Mailprogramm), sonst die Darstellung der
// App. Beide nutzen usePostDetail.
const SupportPostDetailPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  return (
    <NurSupport titel="Mail">
      {breit ? <WebPosteingang start={props.nachrichtId} /> : <PostDetail {...props} />}
    </NurSupport>
  );
};

export default SupportPostDetailPage;
