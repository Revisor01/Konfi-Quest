// Eine Mail aus dem Posteingang, /admin/support/post/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7;
// docs/planung/support-detailseiten.md, „In der App", Skizze App D).
//
// Dieselbe Reihenfolge wie ein Vorgang, nach App-Muster:
//   - Kopfzeile „Mail" mit Archivieren (im Archiv: Wiederherstellen) und der Glocke;
//   - farbiger Kopf mit dem Kern des Betreffs (ohne Re:, AW: und Kennung),
//     Name UND Adresse des Absenders und drei Zahlen-Kacheln: Mails · Neu ·
//     Anhänge -- nur Zahlen, nichts läuft über (bis 11.10.2026 „support@Eingang");
//   - die Karte „Stand": das Postfach als Marke, im Archiv der Satz dazu,
//     der Hauptknopf „Einsortieren" (der Posteingang ist zum Zuordnen da) und
//     daneben Antworten bzw. Wiederherstellen;
//   - der Verlauf, flach, mit der Antwortzeile unter der jüngsten Mail;
//   - „Mail löschen" als einziger Knopf ganz unten; Ziehen zum Aktualisieren.
// Antworten und Einsortieren öffnen ein Modal (SupportModale.tsx).
//
// Kennt der Server den Absender (Frage 11, `absender_bekannt`, seit
// 12.10.2026), steht in der Karte „Stand" der Hinweis „Absender gehört zu
// {Gemeinde} · 2 offene Vorgänge" und darunter „In Vorgang N einsortieren" --
// das legt die Mail ohne Modal in den jüngsten offenen Vorgang der Gemeinde.
// Das Modal „Einsortieren" ist dann vorbelegt (Vorgang bzw. Gemeinde).
//
// Liegt die Mail in einem Vorgang (oder gehört sie zu einer Anfrage oder
// Gemeinde), ersetzt sich die Seite durch den Vorgang, die Mail steht dort
// offen und hervorgehoben (E, useMailWeiterleitung). Archivieren und Löschen
// gibt es dann nicht -- der Server lehnt beides für solche Mails ab (409).
//
// Beim Öffnen werden die ungelesenen eingehenden Mails des Fadens als gelesen
// gemeldet; sie tragen auf dieser Seite noch die Marke „Neu".

import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonRouter,
  type RefresherEventDetail,
} from '@ionic/react';
import AppKopfzeile from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_ARCHIV, ICON_CHATS, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG, ICON_WECHSEL } from '../shared/icons';
import { POSTFACH_INFO, betreffKern } from '../../utils/supportMail';
import { triggerPullHaptic } from '../../utils/haptics';
import { MAIL_DETAIL_TEXT } from '../../seiten/supportDetail';
import { SUPPORT_POSTEINGANG, SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import MailGespraeche from './MailGespraeche';
import { AntwortModal, EinsortierenModal } from './SupportModale';
import { Antwortzeile, StandKarte, type StandKarteHinweis, type StandKarteMarke, type StandKnopf } from './SupportVorgangTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPosteingang from './web/WebPosteingang';
import { usePostDetail } from './usePostDetail';
import { useMailWeiterleitung } from './useMailWeiterleitung';
import { useDirektEinsortieren } from './useEinsortieren';

interface Props {
  nachrichtId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

type Modal = 'antworten' | 'einsortieren';

const PostDetail: React.FC<Props> = ({ nachrichtId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_POSTEINGANG);
  const {
    isOnline, mail, faden, laedt, neu, fehler, nichtGefunden, laden, letzteEingehende, archivieren, wiederherstellen, loeschenFragen,
    stand, kennzahlen, antwort, weiterleitung, absender,
  } = usePostDetail(nachrichtId);
  useMailWeiterleitung(weiterleitung);
  const [modal, setModal] = useState<Modal | null>(null);
  // Einsortiert (Modal oder „In Vorgang N einsortieren"): in den Vorgang, mit dieser Mail offen und
  // hervorgehoben (E). Mit replace: Die Mail liegt danach nicht mehr im Posteingang, „Zurück" führt
  // dorthin statt in eine Seite, die gleich weiterleitet.
  const nachEinsortieren = (id: number | null) => { if (id && mail) router.push(`${SUPPORT_VORGAENGE}/${id}?mail=${mail.id}`, 'forward', 'replace'); };
  const direkt = useDirektEinsortieren(mail?.id ?? null, nachEinsortieren);

  const aktualisieren = async (e: CustomEvent<RefresherEventDetail>) => {
    await laden();
    e.detail.complete();
  };
  const refresher = (
    <IonRefresher slot="fixed" onIonRefresh={(e) => { void aktualisieren(e); }} onIonPull={triggerPullHaptic}>
      <IonRefresherContent refreshingSpinner="crescent" />
    </IonRefresher>
  );

  // Ohne eingeklappte Zweitzeile (AppKopfzeileGross), wie die geladene Seite und
  // der Vorgang: Ionic blendet den Titel der Kopfzeile aus, sobald sie eingehängt
  // wird, und lässt ihn ausgeblendet, wenn sie danach verschwindet -- bis
  // 12.10.2026 stand die geladene Mail auf iOS ohne „Mail“ in der Kopfzeile da.
  if (!mail || !stand || weiterleitung) {
    return (
      <IonPage>
        <AppKopfzeile titel="Mail" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          {mail && weiterleitung ? (
            // Sie liegt woanders: Die Seite ist gleich dort.
            <LoadingSpinner message={MAIL_DETAIL_TEXT.weiterleitung(mail.vorgang_id ?? null)} />
          ) : laedt ? (
            <LoadingSpinner message="Mail wird geladen..." />
          ) : fehler && !nichtGefunden ? (
            <Ladefehler text="Die Mail konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          ) : (
            <EmptyState icon={ICON_MAIL} title="Mail nicht gefunden" message="Diese Mail gibt es nicht (mehr) — archivierte Mails bleiben 180 Tage." />
          )}
        </IonContent>
      </IonPage>
    );
  }

  const name = mail.von_name?.trim();
  const postfach = POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach;

  // Die Karte „Stand": das Postfach als Marke (bis 11.10.2026 eine Kachel, die überlief).
  // Im Archiv sagt es der Satz der Karte; die Marke nur, falls er fehlt (jede Angabe einmal).
  const marken: StandKarteMarke[] = [
    { schluessel: 'postfach', text: postfach, ton: 'info' },
    ...(stand.archiviert && !stand.satz ? [{ schluessel: 'archiv', text: MAIL_DETAIL_TEXT.archiv, ton: 'neutral' as const }] : []),
  ];
  const haupt: StandKnopf | null = stand.haupt === 'einsortieren'
    ? { schluessel: 'einsortieren', ...MAIL_DETAIL_TEXT.einsortieren, icon: ICON_WECHSEL, onKlick: () => setModal('einsortieren'), gesperrt: !isOnline }
    : null;
  const neben: StandKnopf[] = stand.neben.map((a) => (a === 'antworten'
    ? { schluessel: a, ...MAIL_DETAIL_TEXT.antworten, onKlick: () => setModal('antworten'), gesperrt: !antwort || !isOnline }
    : { schluessel: a, ...MAIL_DETAIL_TEXT.wiederherstellen, onKlick: () => { void wiederherstellen(); }, gesperrt: !isOnline }));

  const antwortAn = letzteEingehende && letzteEingehende.richtung === 'ein'
    ? letzteEingehende.von_name?.trim() || letzteEingehende.von_adresse
    : null;

  // „Absender gehört zu …" mit dem Knopf, der ohne Modal einsortiert (nur mit offenem Vorgang).
  const zielVorgang = absender?.vorgangId ?? null;
  const hinweis: StandKarteHinweis | null = absender ? {
    text: absender.satz,
    knopf: zielVorgang !== null ? {
      schluessel: 'in_vorgang',
      ...MAIL_DETAIL_TEXT.inVorgang(zielVorgang),
      icon: ICON_LISTE,
      onKlick: () => { void direkt.einsortieren(zielVorgang); },
      gesperrt: !isOnline || direkt.sendet,
    } : null,
  } : null;

  return (
    <IonPage>
      <AppKopfzeile
        titel="Mail"
        onZurueck={zurueck}
        gemeindeUmschalter={false}
        rechts={stand.archivierbar ? (
          <IonButton aria-label={MAIL_DETAIL_TEXT.archivieren} title={MAIL_DETAIL_TEXT.archivieren} onClick={() => { void archivieren(); }} disabled={!isOnline}>
            <IonIcon icon={ICON_ARCHIV} slot="icon-only" />
          </IonButton>
        ) : stand.archiviert ? (
          <IonButton aria-label={MAIL_DETAIL_TEXT.wiederherstellen.label} title={MAIL_DETAIL_TEXT.wiederherstellen.titel} onClick={() => { void wiederherstellen(); }} disabled={!isOnline}>
            <IonIcon icon={ICON_RUECKGAENGIG} slot="icon-only" />
          </IonButton>
        ) : undefined}
      />
      <IonContent className="app-gradient-background" fullscreen>
        {refresher}

        <div className="support-vorgang__kopf">
          <SectionHeader
            title={betreffKern(mail.betreff) || '(ohne Betreff)'}
            subtitle={name ? `${name} <${mail.von_adresse}>` : mail.von_adresse}
            icon={ICON_MAIL}
            preset="organizations"
            stats={kennzahlen.map((k) => ({ value: k.wert, label: k.label }))}
          />
        </div>

        <StandKarte marken={marken} satz={stand.satz} ton={stand.ton} hinweis={hinweis} haupt={haupt} neben={neben} />

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations" ohneKarte>
          <MailGespraeche
            mails={faden}
            neu={neu}
            titelKern={mail.betreff}
            nachJuengster={antwort ? (
              <Antwortzeile an={antwortAn} gesperrt={!isOnline} onKlick={() => setModal('antworten')} />
            ) : undefined}
          />
        </Abschnitt>

        {stand.loeschbar && (
          <IonButton className="support-vorgang__loeschen" expand="block" fill="outline" color="danger" onClick={loeschenFragen} disabled={!isOnline}>
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            {MAIL_DETAIL_TEXT.loeschenUnten}
          </IonButton>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />

        {antwort && (
          <AntwortModal key={mail.id} offen={modal === 'antworten'} onSchliessen={() => setModal(null)} formular={antwort} />
        )}
        <EinsortierenModal
          offen={modal === 'einsortieren'}
          onSchliessen={() => setModal(null)}
          mail={{ id: mail.id, betreff: mail.betreff }}
          vorgabe={absender ? { vorgangId: absender.vorgangId, organizationId: absender.organizationId } : null}
          onFertig={nachEinsortieren}
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
