// Eine Mail aus dem Posteingang, /admin/support/post/:id (Support-Mail,
// 03.10.2026, docs/planung/support-mail.md).
//
// Die Mail mit ihrem ganzen Faden (aelteste zuerst, Zitate eingeklappt,
// Anhaenge nur als Namen). Zuordnen zu einer Anfrage (offene zuerst) oder
// einer Gemeinde -- der Server nimmt den ganzen Faden mit --, und zurueck in
// den Posteingang. Solange die Mail nicht zugeordnet ist, laesst sie sich
// von hier beantworten (vom selben Postfach an den Absender); zugeordnet
// geht die Antwort ueber die Anfrage bzw. den Schriftwechsel der Gemeinde,
// damit Postfach und Kennung im Betreff stimmen.
//
// Beim Oeffnen werden die ungelesenen eingehenden Mails des Fadens als
// gelesen gemeldet; sie tragen auf dieser Seite noch die Marke „Neu".

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_ANTWORTEN, ICON_ARCHIV, ICON_CHATS, ICON_MAIL, ICON_ORGANISATION, ICON_WECHSEL } from '../shared/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeAnfrage, GemeindeKurz, MailAntwortDaten, MailNachricht, MailVerlauf } from '../../types/support';
import { ANFRAGE_STATUS } from '../../utils/supportAnfragen';
import {
  POSTFACH_INFO,
  anfragenZumZuordnen,
  fadenAus,
  gemeindeName,
  gemeindenSortiert,
  standardBetreff,
  ungeleseneIds,
} from '../../utils/supportMail';
import { fehlerStatus, fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { mailsAlsGelesen, supportMailZaehlerAuffrischen } from '../../navigation/supportMailZaehler';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import { AntwortFormular, Hinweis, MailListe } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';

interface Props {
  nachrichtId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

const PostDetail: React.FC<Props> = ({ nachrichtId }) => {
  const { setError, setSuccess, isOnline } = useApp();
  const router = useIonRouter();
  const zurueck = useSupportZurueck('/admin/support/post');

  const [mail, setMail] = useState<MailVerlauf | null>(null);
  const [faden, setFaden] = useState<MailNachricht[]>([]);
  const [neu, setNeu] = useState<ReadonlySet<number>>(new Set());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [nichtGefunden, setNichtGefunden] = useState(false);

  const [anfragen, setAnfragen] = useState<GemeindeAnfrage[]>([]);
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [auswahlFehlt, setAuswahlFehlt] = useState(false);
  const [anfrageWahl, setAnfrageWahl] = useState('');
  const [gemeindeWahl, setGemeindeWahl] = useState('');
  const [ordnetZu, setOrdnetZu] = useState(false);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async (ersterAbruf: boolean) => {
    if (!Number.isInteger(nachrichtId) || nachrichtId <= 0) {
      setNichtGefunden(true);
      setLaedt(false);
      return;
    }
    try {
      const antwort = await api.get(`/support/mail/nachrichten/${nachrichtId}`);
      const daten = antwort.data && typeof antwort.data === 'object' ? antwort.data as MailVerlauf : null;
      if (!daten || typeof daten.id !== 'number') {
        setMail(null);
        setNichtGefunden(true);
        return;
      }
      const liste = fadenAus(daten);
      const ungelesen = ungeleseneIds(liste);
      setMail(daten);
      setFaden(liste);
      // „Neu" bleibt fuer diesen Besuch an den Mails, die beim Oeffnen
      // ungelesen waren -- auch nachdem sie als gelesen gemeldet sind.
      if (ersterAbruf) setNeu(new Set(ungelesen));
      setNichtGefunden(false);
      setFehler(false);
      void mailsAlsGelesen(ungelesen);
    } catch (err) {
      setMail(null);
      if (fehlerStatus(err) === 404) setNichtGefunden(true);
      else setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, [nachrichtId]);

  const auswahlHolen = useCallback(async () => {
    const [a, g] = await Promise.allSettled([api.get('/support/anfragen'), api.get('/organizations')]);
    setAnfragen(a.status === 'fulfilled' && Array.isArray(a.value.data) ? anfragenZumZuordnen(a.value.data) : []);
    setGemeinden(g.status === 'fulfilled' && Array.isArray(g.value.data) ? gemeindenSortiert(g.value.data) : []);
    setAuswahlFehlt(a.status !== 'fulfilled' || g.status !== 'fulfilled');
  }, []);

  useEffect(() => {
    void holen(true);
    void auswahlHolen();
  }, [holen, auswahlHolen]);

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen(true);
  };

  const zuordnen = async (koerper: { anfrage_id: number } | { organization_id: number } | Record<string, never>, meldung: string) => {
    if (!mail || offlineBlockiert(isOnline, setError)) return;
    setOrdnetZu(true);
    try {
      await api.post(`/support/mail/nachrichten/${mail.id}/zuordnen`, koerper);
      setSuccess(meldung);
      setAnfrageWahl('');
      setGemeindeWahl('');
      supportMailZaehlerAuffrischen();
      await holen(false);
    } catch (err) {
      setError(fehlerText(err, 'Mail konnte nicht zugeordnet werden'));
    } finally {
      setOrdnetZu(false);
    }
  };

  // Antwort an den Absender der letzten eingehenden Mail des Fadens.
  const letzteEingehende = useMemo(
    () => [...faden].reverse().find((m) => m.richtung === 'ein') ?? mail,
    [faden, mail]
  );
  const betreffVorschlag = standardBetreff(faden[faden.length - 1]?.betreff ?? mail?.betreff);

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
            <EmptyState icon={ICON_MAIL} title="Mail nicht gefunden" message="Diese Mail gibt es nicht (mehr) — nicht zugeordnete Mails bleiben 180 Tage." />
          )}
        </IonContent>
      </IonPage>
    );
  }

  const anfrageDerMail = mail.anfrage_id ? anfragen.find((a) => a.id === mail.anfrage_id) : undefined;
  const gemeindeDerMail = mail.organization_id ? gemeinden.find((g) => g.id === mail.organization_id) : undefined;
  const zugeordnet = mail.anfrage_id !== null || mail.organization_id !== null;
  const gewaehlteAnfrage = anfragen.find((a) => String(a.id) === anfrageWahl);
  const gewaehlteGemeinde = gemeinden.find((g) => String(g.id) === gemeindeWahl);

  return (
    <IonPage>
      {kopf}
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Mail" />

        {mail.anfrage_id !== null && (
          <div style={{ margin: 'var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel={`Zugeordnet zur Anfrage ${anfrageDerMail ? `„${anfrageDerMail.gemeinde}“` : mail.anfrage_id}`}>
              Antworten gehen über die Anfrage, von {POSTFACH_INFO.moin.kurz}.
            </Hinweis>
            <IonButton fill="outline" onClick={() => router.push(`/admin/support/anfragen/${mail.anfrage_id}`)}>
              <IonIcon icon={ICON_MAIL} slot="start" />
              Anfrage öffnen
            </IonButton>
          </div>
        )}
        {mail.organization_id !== null && (
          <div style={{ margin: 'var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel={`Zugeordnet zur Gemeinde ${gemeindeDerMail ? `„${gemeindeName(gemeindeDerMail)}“` : mail.organization_id}`}>
              Antworten gehen über den Schriftwechsel der Gemeinde, von {POSTFACH_INFO.support.kurz}.
            </Hinweis>
            <IonButton fill="outline" onClick={() => router.push(`/admin/support/post/gemeinde/${mail.organization_id}`)}>
              <IonIcon icon={ICON_ORGANISATION} slot="start" />
              Schriftwechsel öffnen
            </IonButton>
          </div>
        )}

        <Abschnitt icon={ICON_CHATS} titel={faden.length === 1 ? 'Mail' : `Faden mit ${faden.length} Mails`} farbe="organizations">
          <MailListe mails={faden} neu={neu} />
        </Abschnitt>

        <Abschnitt icon={ICON_WECHSEL} titel="Zuordnen" farbe="organizations">
          <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' }}>
            Der ganze Faden geht mit — auch spätere Antworten darauf ordnet der Server dann selbst zu.
          </p>
          {auswahlFehlt && (
            <p role="status" style={{ margin: '0 0 var(--app-abstand-kompakt)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
              Anfragen oder Gemeinden konnten nicht vollständig geladen werden.
            </p>
          )}
          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Anfrage</IonLabel>
              <IonSelect
                aria-label="Anfrage"
                interface="popover"
                value={anfrageWahl}
                disabled={anfragen.length === 0}
                onIonChange={(e) => setAnfrageWahl(String(e.detail.value ?? ''))}
              >
                <IonSelectOption value="">Anfrage wählen</IonSelectOption>
                {anfragen.map((a) => (
                  <IonSelectOption key={a.id} value={String(a.id)}>
                    {`${a.gemeinde} · ${a.kontakt_name} (${(ANFRAGE_STATUS[a.status] ?? ANFRAGE_STATUS.neu).label})`}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonList>
          <IonButton
            expand="block"
            fill="outline"
            disabled={!gewaehlteAnfrage || ordnetZu || !isOnline || gewaehlteAnfrage.id === mail.anfrage_id}
            onClick={() => { if (gewaehlteAnfrage) void zuordnen({ anfrage_id: gewaehlteAnfrage.id }, 'Mail der Anfrage zugeordnet'); }}
          >
            <IonIcon icon={ICON_MAIL} slot="start" />
            Einer Anfrage zuordnen
          </IonButton>

          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Gemeinde</IonLabel>
              <IonSelect
                aria-label="Gemeinde"
                interface="popover"
                value={gemeindeWahl}
                disabled={gemeinden.length === 0}
                onIonChange={(e) => setGemeindeWahl(String(e.detail.value ?? ''))}
              >
                <IonSelectOption value="">Gemeinde wählen</IonSelectOption>
                {gemeinden.map((g) => (
                  <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonList>
          <IonButton
            expand="block"
            fill="outline"
            disabled={!gewaehlteGemeinde || ordnetZu || !isOnline || gewaehlteGemeinde.id === mail.organization_id}
            onClick={() => { if (gewaehlteGemeinde) void zuordnen({ organization_id: gewaehlteGemeinde.id }, 'Mail der Gemeinde zugeordnet'); }}
          >
            <IonIcon icon={ICON_ORGANISATION} slot="start" />
            Einer Gemeinde zuordnen
          </IonButton>

          {zugeordnet && (
            <IonButton
              expand="block"
              fill="clear"
              disabled={ordnetZu || !isOnline}
              onClick={() => { void zuordnen({}, 'Mail zurück im Posteingang'); }}
            >
              <IonIcon icon={ICON_ARCHIV} slot="start" />
              Zurück in den Posteingang
            </IonButton>
          )}
        </Abschnitt>

        {!zugeordnet && letzteEingehende && (
          <Abschnitt icon={ICON_ANTWORTEN} titel="Antworten" farbe="organizations">
            <AntwortFormular
              postfach={mail.postfach}
              betreffVorschlag={betreffVorschlag}
              an={letzteEingehende.von_adresse}
              senden={(koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper)}
              onGesendet={() => { void holen(false); }}
            />
          </Abschnitt>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

const SupportPostDetailPage: React.FC<Props> = (props) => (
  <NurSupport titel="Mail"><PostDetail {...props} /></NurSupport>
);

export default SupportPostDetailPage;
