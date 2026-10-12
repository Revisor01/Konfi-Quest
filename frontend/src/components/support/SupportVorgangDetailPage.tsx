// Ein Vorgang der Support-Ansicht, /admin/support/vorgaenge/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7;
// docs/planung/support-detailseiten.md, „In der App", Skizzen App A bis C).
//
// Dieselbe Reihenfolge wie im Browser, nach App-Muster:
//   - Kopfzeile „Vorgang N" (bei einer Anfrage „Anfrage N") mit Einordnen,
//     Archivieren bzw. Wiederherstellen und der Glocke;
//   - farbiger Kopf mit dem Kreis der Art, dem Betreff, „Nr. N · Gemeinde"
//     (die Gemeinde nur, wenn der Vorgang ihr zugeordnet ist) und drei
//     Zahlen-Kacheln -- nur Zahlen, nichts läuft über;
//   - die Karte „Stand": Marken (antippen öffnet Einordnen), der Satz, wer
//     dran ist, bei einer Lizenz die Zusatzzeile, der Hauptknopf 2 : 1 zum
//     Nebenknopf und die Notiz (Simon, 11.10.2026: Hauptknopf oben);
//   - der Verlauf, flach, mit der Antwortzeile unter der jüngsten Mail und
//     dem Menü je Mail (In anderen Vorgang verschieben, herauslösen);
//   - die Angaben: Lizenz, Anfrage, Kontakt (mit Mobil), Gemeinde (mit
//     eingeklappter Gemeindeleitung);
//   - Löschen als einziger Knopf ganz unten; Ziehen zum Aktualisieren.
// Antworten, Einordnen, Notiz, Lizenz ändern, Gemeinde anlegen und
// Verschieben öffnen ein Modal (SupportModale.tsx).
//
// Die Logik steht in components/support/useVorgangDetail.ts, dieselbe wie in
// der Web-Fassung; was wann steht, entscheidet die Regel-Stelle
// (utils/supportVorgaenge.ts: vorgangStand, vorgangKennzahlen, vorgangAngaben).

import React, { useMemo, useState } from 'react';
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
import {
  ICON_ANTWORTEN,
  ICON_ARCHIV,
  ICON_BEARBEITEN,
  ICON_CHATS,
  ICON_HAKEN,
  ICON_LISTE,
  ICON_LOESCHEN,
  ICON_RUECKGAENGIG,
} from '../shared/icons';
import type { MailNachricht } from '../../types/support';
import {
  ART_SYMBOL,
  anfangText,
  istZugeordnet,
  kontaktVon,
  mailAusAdresse,
  vorgangName,
  type StandAktion,
} from '../../utils/supportVorgaenge';
import { anlegenVorbelegen } from '../../utils/supportAnfragen';
import { triggerPullHaptic } from '../../utils/haptics';
import { AKTION_TEXT, APP_VORGANG_TEXT, MAIL_MENUE } from '../../seiten/supportDetail';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { useAppLocation } from '../../navigation/useAppLocation';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import MailGespraeche, { type MailMenuePunkt } from './MailGespraeche';
import {
  AntwortModal,
  EinordnenModal,
  EinsortierenModal,
  GemeindeAnlegenModal,
  LizenzModal,
  NotizModal,
} from './SupportModale';
import { AngabenAbschnitte, Antwortzeile, NotizZeile, StandKarte, type StandKarteMarke, type StandKnopf } from './SupportVorgangTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useVorgangDetail } from './useVorgangDetail';
import type { EinsortierenModus } from './useEinsortieren';
import WebVorgaenge from './web/WebVorgaenge';

interface Props {
  vorgangId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zur Liste zurueck. */
  onBack?: () => void;
}

type Modal = 'antworten' | 'einordnen' | 'notiz' | 'lizenz' | 'anlegen';

/** Symbole nur am Hauptknopf -- die Nebenknöpfe sind ein Drittel breit. */
const HAUPT_SYMBOL: Partial<Record<StandAktion, string>> = {
  antworten: ICON_ANTWORTEN,
  erledigt: ICON_HAKEN,
  wiederherstellen: ICON_RUECKGAENGIG,
};

const VorgangDetail: React.FC<Props> = ({ vorgangId }) => {
  const zurueck = useSupportZurueck(SUPPORT_VORGAENGE);
  const router = useIonRouter();
  const { search } = useAppLocation();
  // ?mail=5: diese Mail offen, in den Blick gerollt und kurz markiert.
  const hervorheben = useMemo(() => mailAusAdresse(search), [search]);
  const d = useVorgangDetail(vorgangId);
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, antwort, antwortAn, statusSetzen, ablehnbar,
    ablehnenFragen, archivieren, wiederherstellen, loeschenFragen, archiviert, anlegen, stand, kennzahlen, angaben,
    lizenzAenderbar, beantwortet,
  } = d;
  const [modal, setModal] = useState<Modal | null>(null);
  const [einsortieren, setEinsortieren] = useState<{ mail: MailNachricht; modus: EinsortierenModus } | null>(null);

  const aktualisieren = async (e: CustomEvent<RefresherEventDetail>) => {
    await laden();
    e.detail.complete();
  };

  if (laedt && !vorgang) {
    return (
      <IonPage>
        <AppKopfzeile titel="Vorgang" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          <LoadingSpinner message="Vorgang wird geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  if (!vorgang) {
    return (
      <IonPage>
        <AppKopfzeile titel="Vorgang" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          {fehler && !nichtGefunden ? (
            <Ladefehler text="Der Vorgang konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          ) : (
            <EmptyState icon={ICON_LISTE} title="Vorgang nicht gefunden" message="Diesen Vorgang gibt es nicht (mehr) — vielleicht wurde er gelöscht." />
          )}
        </IonContent>
      </IonPage>
    );
  }

  const anfrage = vorgang.anfrage;
  const kontakt = kontaktVon(vorgang);
  // Derselbe Anfang, den die Kachel „Mails" mitzählt (utils/supportVorgaenge.ts, vorgangKennzahlen).
  const formularText = anfangText(vorgang);
  const titel = anfrage ? `Anfrage ${vorgang.id}` : vorgangName(vorgang.id);
  // Die Gemeinde nur mit Zuordnung. „Noch nicht angelegt" nennt bei einer Anfrage die Marke im Stand --
  // jede Angabe einmal (Leitidee 4).
  const gemeindeText = istZugeordnet(vorgang)
    ? vorgang.gemeinde?.display_name ?? vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}`
    : null;
  const untertitel = gemeindeText ? `Nr. ${vorgang.id} · ${gemeindeText}` : `Nr. ${vorgang.id}`;
  const einordnenOeffnen = () => setModal('einordnen');

  // Die Knöpfe des Stands: was die Regel-Stelle als Haupt- und Nebenaktion nennt.
  const knopf = (aktion: StandAktion, haupt: boolean): StandKnopf => {
    const text = AKTION_TEXT[aktion];
    const grund: StandKnopf = { schluessel: aktion, label: text.label, titel: text.titel, icon: haupt ? HAUPT_SYMBOL[aktion] : undefined, onKlick: () => {} };
    switch (aktion) {
      case 'antworten':
        return { ...grund, onKlick: () => setModal('antworten'), gesperrt: !antwort || !isOnline };
      case 'erledigt':
        return { ...grund, onKlick: () => { void statusSetzen('erledigt'); }, gesperrt: speichert || !isOnline };
      case 'gemeinde_anlegen':
        return { ...grund, onKlick: () => setModal('anlegen'), gesperrt: !anlegen.anlegbar || !anlegen.formular || !isOnline };
      case 'gemeinde_oeffnen':
        return { ...grund, onKlick: () => router.push(`/admin/organizations?gemeinde=${anlegen.gemeindeId ?? vorgang.organization_id}`) };
      case 'wiederherstellen':
        return { ...grund, onKlick: () => { void wiederherstellen(); }, gesperrt: speichert || !isOnline };
      case 'gemeinde_zuordnen':
        return { ...grund, onKlick: einordnenOeffnen, gesperrt: !isOnline };
      case 'ablehnen':
        return { ...grund, onKlick: ablehnenFragen, gesperrt: !ablehnbar || speichert || !isOnline, gefahr: true };
      case 'lizenz_aendern':
        return { ...grund, onKlick: () => setModal('lizenz'), gesperrt: !lizenzAenderbar || !isOnline };
      default:
        return grund;
    }
  };

  const marken: StandKarteMarke[] = (stand?.marken ?? []).map((m) => ({
    schluessel: m.schluessel,
    text: m.text,
    ton: m.ton,
    onKlick: m.oeffnetEinordnen && isOnline ? einordnenOeffnen : undefined,
    beschriftung: m.oeffnetEinordnen ? `${m.text} – Einordnen` : undefined,
  }));

  const menue = (m: MailNachricht): MailMenuePunkt[] => [
    { schluessel: 'verschieben', label: MAIL_MENUE.verschieben, onKlick: () => setEinsortieren({ mail: m, modus: 'bestehend' }) },
    { schluessel: 'herausloesen', label: MAIL_MENUE.herausloesen, onKlick: () => setEinsortieren({ mail: m, modus: 'neu' }) },
  ];

  const antwortAnName = beantwortet?.von_name?.trim() || beantwortet?.von_adresse || kontakt.name || kontakt.email;

  return (
    <IonPage className="support-vorgang-seite">
      <AppKopfzeile
        titel={titel}
        onZurueck={zurueck}
        gemeindeUmschalter={false}
        rechts={(
          <>
            {/* icon-only wie in den anderen Detailseiten: auf Android 48 statt 56 px breit (Platz für „Vorgang 123"). */}
            <IonButton aria-label="Einordnen" title="Einordnen" onClick={einordnenOeffnen} disabled={!isOnline}>
              <IonIcon icon={ICON_BEARBEITEN} slot="icon-only" />
            </IonButton>
            {archiviert ? (
              <IonButton aria-label="Wiederherstellen" title={AKTION_TEXT.wiederherstellen.titel} onClick={() => { void wiederherstellen(); }} disabled={speichert || !isOnline}>
                <IonIcon icon={ICON_RUECKGAENGIG} slot="icon-only" />
              </IonButton>
            ) : (
              <IonButton aria-label="Archivieren" title="Archivieren" onClick={() => { void archivieren(); }} disabled={speichert || !isOnline}>
                <IonIcon icon={ICON_ARCHIV} slot="icon-only" />
              </IonButton>
            )}
          </>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void aktualisieren(e); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent refreshingSpinner="crescent" />
        </IonRefresher>

        <div className="support-vorgang__kopf">
          <SectionHeader
            title={vorgang.betreff || '(ohne Betreff)'}
            subtitle={untertitel}
            icon={ART_SYMBOL[vorgang.art]}
            preset="organizations"
            stats={kennzahlen.map((k) => ({ value: k.wert, label: k.label }))}
          />
        </div>

        {stand && (
          <StandKarte
            marken={marken}
            satz={stand.satz}
            ton={stand.ton}
            zusatz={stand.zusatz}
            haupt={knopf(stand.haupt, true)}
            neben={stand.neben.map((a) => knopf(a, false))}
            notiz={<NotizZeile notiz={vorgang.notiz} onKlick={() => setModal('notiz')} />}
          />
        )}

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations" ohneKarte>
          <MailGespraeche
            mails={vorgang.verlauf}
            neu={neu}
            anfang={formularText ? {
              marke: vorgang.quelle === 'anfrage' || vorgang.anfrage ? 'Anfrage' : 'Formular',
              name: kontakt.name,
              // Die Adresse steht im Abschnitt „Kontakt"; am Anfang nur, wenn es keinen Namen gibt (wie im Browser).
              adresse: kontakt.name ? null : kontakt.email,
              datum: vorgang.created_at,
              text: formularText,
            } : null}
            titelKern={vorgang.betreff}
            leer="Noch keine Mails in diesem Vorgang."
            hervorheben={hervorheben}
            menue={menue}
            nachJuengster={(
              <Antwortzeile
                an={antwortAnName}
                gesperrt={!antwort || !isOnline}
                grund={!antwort ? APP_VORGANG_TEXT.antwortzeileKeinWeg : APP_VORGANG_TEXT.antwortzeileOffline}
                onKlick={() => setModal('antworten')}
              />
            )}
          />
        </Abschnitt>

        <AngabenAbschnitte
          karten={angaben}
          gesperrt={!isOnline}
          onLink={(href) => router.push(href)}
          onAktion={(art, adresse) => {
            if (art === 'im_vorgang_antworten') {
              antwortAn(adresse ?? null);
              setModal('antworten');
            } else if (art === 'zuordnen') {
              einordnenOeffnen();
            } else if (art === 'lizenz_aendern') {
              setModal('lizenz');
            } else if (art === 'kirchenkreis_anlegen') {
              void anlegen.kirchenkreisAnlegen();
            }
          }}
        />

        <IonButton className="support-vorgang__loeschen" expand="block" fill="outline" color="danger" onClick={loeschenFragen} disabled={speichert || !isOnline}>
          <IonIcon icon={ICON_LOESCHEN} slot="start" />
          {APP_VORGANG_TEXT.loeschen(anfrage !== null)}
        </IonButton>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />

        {antwort && (
          <AntwortModal
            key={vorgang.id}
            offen={modal === 'antworten'}
            onSchliessen={() => { setModal(null); antwortAn(null); }}
            formular={antwort}
          />
        )}
        <EinordnenModal offen={modal === 'einordnen'} onSchliessen={() => setModal(null)} d={d} />
        <NotizModal offen={modal === 'notiz'} onSchliessen={() => setModal(null)} d={d} />
        <LizenzModal
          offen={modal === 'lizenz'}
          onSchliessen={() => setModal(null)}
          gemeinde={lizenzAenderbar ? vorgang.gemeinde : null}
          onLink={(href) => router.push(href)}
        />
        <GemeindeAnlegenModal
          offen={modal === 'anlegen'}
          anfrage={anlegen.anlegbar ? anfrage : null}
          d={anlegen}
          onSchliessen={() => {
            setModal(null);
            // Verworfen (ohne anzulegen): wieder die Vorbelegung aus der Anfrage.
            if (anfrage && !anlegen.angelegt) {
              anlegen.setFormular(anlegenVorbelegen(anfrage, anlegen.kirchenkreise));
              anlegen.setEigenesLimit(false);
              anlegen.setPasswortZeigen(false);
            }
          }}
        />
        {einsortieren && (
          <EinsortierenModal
            offen
            onSchliessen={() => setEinsortieren(null)}
            mail={{ id: einsortieren.mail.id, betreff: einsortieren.mail.betreff }}
            ausVorgang={vorgang.id}
            modus={einsortieren.modus}
            onFertig={() => {}}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster die Liste mit diesem
// Vorgang im Lesebereich, sonst die Darstellung der App. Beide nutzen useVorgangDetail.
const SupportVorgangDetailPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  return (
    <NurSupport titel="Vorgang">
      {breit ? <WebVorgaenge start={props.vorgangId} /> : <VorgangDetail {...props} />}
    </NurSupport>
  );
};

export default SupportVorgangDetailPage;
