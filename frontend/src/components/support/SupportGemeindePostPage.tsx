// Schriftwechsel einer Gemeinde, /admin/support/post/gemeinde/:id
// (Support-Mail, 03.10.2026, docs/planung/support-mail.md).
//
// Alle Mails der Gemeinde, aelteste zuerst (Zitate eingeklappt), und
// Antworten von support@ an eine Adresse, die der Server als moeglichen
// Empfaenger nennt (Gemeindeleitungen und Leitung mit Adresse, Absender aus
// dem Verlauf). Bausteine fuer support@ und beide Postfaecher; ihre
// Platzhalter fuellt GET /support/mail/platzhalter?organization_id=.
// Erreichbar aus dem Posteingang (Gemeinden mit ungelesenen Mails, Auswahl
// aller Gemeinden, eine der Gemeinde zugeordnete Mail).

import React, { useCallback, useEffect, useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, useIonRouter } from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import { ICON_ANTWORTEN, ICON_CHATS, ICON_ORGANISATION } from '../shared/icons';
import api from '../../services/api';
import type { GemeindeKurz, MailAntwortDaten, MailEmpfaenger, MailNachricht } from '../../types/support';
import { POSTFACH_INFO, chronologisch, empfaengerLesen, gemeindeName, standardBetreff, ungeleseneIds } from '../../utils/supportMail';
import { mailsAlsGelesen } from '../../navigation/supportMailZaehler';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import { AntwortFormular, MailListe } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';

interface Props {
  organizationId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

const GemeindePost: React.FC<Props> = ({ organizationId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck('/admin/support/post');

  const [gemeinde, setGemeinde] = useState<GemeindeKurz | null>(null);
  const [verlauf, setVerlauf] = useState<MailNachricht[] | null>(null);
  const [verlaufFehler, setVerlaufFehler] = useState(false);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [empfaenger, setEmpfaenger] = useState<MailEmpfaenger[]>([]);
  const [empfaengerFehlt, setEmpfaengerFehlt] = useState(false);

  const verlaufHolen = useCallback(async (ersterAbruf: boolean) => {
    try {
      const antwort = await api.get(`/support/gemeinden/${organizationId}/verlauf`);
      const liste = chronologisch(Array.isArray(antwort.data) ? antwort.data as MailNachricht[] : []);
      const ungelesen = ungeleseneIds(liste);
      setVerlauf(liste);
      setVerlaufFehler(false);
      if (ersterAbruf) setNeu(new Set(ungelesen));
      void mailsAlsGelesen(ungelesen);
    } catch {
      setVerlaufFehler(true);
    }
  }, [organizationId]);

  const rahmenHolen = useCallback(async () => {
    const [g, e] = await Promise.allSettled([
      api.get('/organizations'),
      api.get(`/support/gemeinden/${organizationId}/empfaenger`),
    ]);
    const liste = g.status === 'fulfilled' && Array.isArray(g.value.data) ? g.value.data as GemeindeKurz[] : [];
    setGemeinde(liste.find((x) => x.id === organizationId) ?? null);
    setEmpfaenger(e.status === 'fulfilled' ? empfaengerLesen(e.value.data) : []);
    setEmpfaengerFehlt(e.status !== 'fulfilled');
  }, [organizationId]);

  useEffect(() => {
    void verlaufHolen(true);
    void rahmenHolen();
  }, [verlaufHolen, rahmenHolen]);

  const name = gemeinde ? gemeindeName(gemeinde) : `Gemeinde ${organizationId}`;
  const letzte = verlauf && verlauf.length > 0 ? verlauf[verlauf.length - 1] : null;
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
            betreffVorschlag={standardBetreff(letzte?.betreff)}
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

const SupportGemeindePostPage: React.FC<Props> = (props) => (
  <NurSupport titel="Schriftwechsel">
    {Number.isInteger(props.organizationId) && props.organizationId > 0 ? <GemeindePost {...props} /> : <KeineGemeinde />}
  </NurSupport>
);

export default SupportGemeindePostPage;
