// Schriftwechsel einer Gemeinde, /admin/support/post/gemeinde/:id
// (Support-Mail, 03.10.2026, docs/planung/support-mail.md).
//
// Alle Mails der Gemeinde, aelteste zuerst (Zitate eingeklappt), und
// Antworten von support@ an eine Adresse, die der Server als moeglichen
// Empfaenger nennt (Gemeindeleitungen und Leitung mit Adresse, Absender aus
// dem Verlauf). Bausteine fuer support@ und beide Postfaecher; ihre
// Platzhalter fuellt GET /support/mail/platzhalter?organization_id=.
// Die Gemeinde kommt aus GET /organizations/:id (hook), auch eine interne.
// Erreichbar aus dem Posteingang (Gemeinden mit ungelesenen Mails, Auswahl
// aller Gemeinden, eine der Gemeinde zugeordnete Mail).

import React from 'react';
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import { ICON_ANTWORTEN, ICON_CHATS, ICON_ORGANISATION } from '../shared/icons';
import api from '../../services/api';
import type { MailAntwortDaten } from '../../types/support';
import { POSTFACH_INFO } from '../../utils/supportMail';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import { AntwortFormular, MailListe } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebGemeindePost, { WebKeineGemeinde } from './web/WebGemeindePost';
import { useGemeindePost } from './useGemeindePost';

interface Props {
  organizationId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

const GemeindePost: React.FC<Props> = ({ organizationId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck('/admin/support/post');
  const { name, verlauf, verlaufFehler, neu, empfaenger, empfaengerFehlt, letzte, betreffVorschlag, verlaufHolen } = useGemeindePost(organizationId);
  const ungelesenZahl = neu.size;

  return (
    <IonPage>
      <AppKopfzeile titel="Schriftwechsel" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Schriftwechsel" />

        <SectionHeader
          title={name}
          subtitle={`Schriftwechsel über ${POSTFACH_INFO.support.kurz}`}
          icon={ICON_ORGANISATION}
          preset="organizations"
          stats={[
            { value: verlauf ? verlauf.length : '–', label: 'Mails' },
            { value: verlauf ? ungelesenZahl : '–', label: 'Neu' },
          ]}
        />

        <div style={{ margin: '0 var(--app-abstand-basis)' }}>
          <IonButton fill="outline" size="small" onClick={() => router.push(`/admin/organizations?gemeinde=${organizationId}`)}>
            <IonIcon icon={ICON_ORGANISATION} slot="start" />
            Gemeinde öffnen
          </IonButton>
        </div>

        {verlaufFehler ? (
          <Ladefehler text="Der Schriftwechsel konnte nicht geladen werden." onErneut={() => { void verlaufHolen(true); }} />
        ) : (
          <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations">
            {verlauf
              ? <MailListe mails={verlauf} neu={neu} leer="Noch keine Mails mit dieser Gemeinde." />
              : <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Verlauf wird geladen...</p>}
          </Abschnitt>
        )}

        <Abschnitt icon={ICON_ANTWORTEN} titel={letzte ? 'Antworten' : 'Schreiben'} farbe="organizations">
          <AntwortFormular
            postfach="support"
            platzhalterFuer={{ organization_id: organizationId }}
            betreffVorschlag={betreffVorschlag}
            empfaenger={empfaenger}
            empfaengerFehlt={empfaengerFehlt}
            senden={(koerper: MailAntwortDaten) => api.post(`/support/gemeinden/${organizationId}/antworten`, koerper)}
            onGesendet={() => { void verlaufHolen(false); }}
          />
        </Abschnitt>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

/** Keine gueltige Kennung in der Adresse (/admin/support/post/gemeinde/abc): Hinweis statt Abruf. */
const KeineGemeinde: React.FC = () => {
  const zurueck = useSupportZurueck('/admin/support/post');
  return (
    <IonPage>
      <AppKopfzeile titel="Schriftwechsel" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Schriftwechsel" />
        <EmptyState icon={ICON_ORGANISATION} title="Gemeinde nicht gefunden" message="Diese Adresse nennt keine Gemeinde." />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster die Web-Fassung mit
// den Angaben der Gemeinde neben dem Schriftwechsel, sonst die Darstellung der
// App. Beide nutzen useGemeindePost.
const SupportGemeindePostPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  const gueltig = Number.isInteger(props.organizationId) && props.organizationId > 0;
  return (
    <NurSupport titel="Schriftwechsel">
      {breit
        ? (gueltig ? <WebGemeindePost organizationId={props.organizationId} /> : <WebKeineGemeinde />)
        : (gueltig ? <GemeindePost {...props} /> : <KeineGemeinde />)}
    </NurSupport>
  );
};

export default SupportGemeindePostPage;
