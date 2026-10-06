// Eine Mail aus dem Posteingang, /admin/support/post/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Die Mail mit ihrem ganzen Faden (älteste zuerst, Zitate eingeklappt,
// Anhänge nur als Namen). „Einsortieren": in einen bestehenden Vorgang (mit
// Suche) oder in einen neuen mit Art, Bereich, Dringlichkeit, Betreff und
// Gemeinde -- der Server nimmt den ganzen Faden mit. Archivieren,
// Wiederherstellen und Löschen mit Rückfrage. Solange die Mail in keinem
// Vorgang liegt, lässt sie sich von hier beantworten (vom selben Postfach an
// den Absender); liegt sie in einem Vorgang, führt ein Link dorthin und die
// Antwort geht über den Vorgang, damit die Nummer im Betreff steht.
//
// Beim Öffnen werden die ungelesenen eingehenden Mails des Fadens als gelesen
// gemeldet; sie tragen auf dieser Seite noch die Marke „Neu".

import React, { useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_ANTWORTEN, ICON_ARCHIV, ICON_CHATS, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG, ICON_WECHSEL } from '../shared/icons';
import api from '../../services/api';
import type { MailAntwortDaten } from '../../types/support';
import { POSTFACH_INFO, gemeindeName } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import { suchTreffer, suchbegriff } from '../../utils/supportWeb';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  VORGANG_STATUS,
  artKurz,
  bereichIstPflicht,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
} from '../../utils/supportVorgaenge';
import { SUPPORT_POSTEINGANG } from '../../navigation/supportMenue';
import { Abschnitt, Feld, Ladefehler, NurSupport } from './SupportBausteine';
import { AntwortFormular, Hinweis, MailListe } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPostDetail from './web/WebPostDetail';
import { usePostDetail } from './usePostDetail';
import { useEinsortieren, type EinsortierenModus } from './useEinsortieren';

interface Props {
  nachrichtId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zum Posteingang zurueck. */
  onBack?: () => void;
}

/** „Einsortieren" als Abschnitt der Seite: bestehender Vorgang mit Suche oder neuer Vorgang. */
const EinsortierenAbschnitt: React.FC<{ mail: { id: number; betreff: string | null }; imVorgang: boolean }> = ({ mail, imVorgang }) => {
  const router = useIonRouter();
  const z = useEinsortieren(mail, (id) => { if (id) router.push(`/admin/support/vorgaenge/${id}`); });
  const [suche, setSuche] = useState('');
  const treffer = useMemo(() => {
    const liste = z.vorgaenge ?? [];
    return suchbegriff(suche)
      ? liste.filter((v) => [String(v.id), v.betreff, v.gemeinde_name ?? ''].some((t) => suchTreffer(t, suche).length > 0))
      : liste;
  }, [z.vorgaenge, suche]);
  const pflicht = bereichIstPflicht(z.neu.art);

  return (
    <Abschnitt icon={ICON_WECHSEL} titel={imVorgang ? 'Anderem Vorgang zuordnen' : 'Einsortieren'} farbe="organizations">
      <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' }}>
        Der ganze Faden geht mit — auch spätere Antworten darauf ordnet der Server dann selbst zu.
      </p>
      {z.fehler && <p role="alert" style={{ margin: '0 0 var(--app-abstand-eng)', color: 'var(--app-text-fehler)' }}>{z.fehler}</p>}
      <IonSegment value={z.modus} aria-label="Einsortieren in" onIonChange={(e) => z.setModus((e.detail.value as EinsortierenModus) ?? 'bestehend')}>
        <IonSegmentButton value="bestehend"><IonLabel>Bestehender Vorgang</IonLabel></IonSegmentButton>
        <IonSegmentButton value="neu"><IonLabel>Neuer Vorgang</IonLabel></IonSegmentButton>
      </IonSegment>

      {z.modus === 'bestehend' ? (
        <IonList style={{ background: 'transparent' }}>
          <Feld label="Vorgang suchen" wert={suche} onWert={setSuche} hinweis="Nummer, Betreff oder Gemeinde" />
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Vorgang</IonLabel>
            <IonSelect aria-label="Vorgang" interface="popover" value={z.vorgangWahl} disabled={treffer.length === 0}
              placeholder={z.vorgaenge && z.vorgaenge.length === 0 ? 'Es gibt keinen offenen Vorgang' : 'Bitte wählen'}
              onIonChange={(e) => z.setVorgangWahl(String(e.detail.value ?? ''))}>
              <IonSelectOption value="">Bitte wählen</IonSelectOption>
              {treffer.map((v) => (
                <IonSelectOption key={v.id} value={String(v.id)}>
                  {`Nr. ${v.id} · ${v.betreff || '(ohne Betreff)'} · ${v.gemeinde_name ?? 'Keine Gemeinde'} · ${artKurz(v.art)} · ${VORGANG_STATUS[v.status].kurz}`}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          {z.vorgaengeFehlen && <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>Die Vorgänge konnten nicht geladen werden.</p>}
        </IonList>
      ) : (
        <IonList style={{ background: 'transparent' }}>
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Art *</IonLabel>
            <IonSelect aria-label="Art" interface="popover" value={z.neu.art} placeholder="Bitte wählen"
              onIonChange={(e) => z.aendernNeu({ art: String(e.detail.value ?? '') as VorgangArt | '' })}>
              {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">{pflicht ? 'Bereich *' : 'Bereich'}</IonLabel>
            <IonSelect aria-label="Bereich" interface="popover" value={z.neu.bereich} placeholder={pflicht ? 'Bitte wählen' : 'Kein Bereich'}
              onIonChange={(e) => z.aendernNeu({ bereich: String(e.detail.value ?? '') as VorgangBereich | '' })}>
              <IonSelectOption value="">{pflicht ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
              {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Dringlichkeit</IonLabel>
            <IonSelect aria-label="Dringlichkeit" interface="popover" value={z.neu.dringlichkeit}
              onIonChange={(e) => z.aendernNeu({ dringlichkeit: String(e.detail.value ?? 'normal') as Dringlichkeit })}>
              {DRINGLICHKEITEN.map((d) => <IonSelectOption key={d.wert} value={d.wert}>{d.hinweis ? `${d.label} – ${d.hinweis}` : d.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <Feld label="Betreff" pflicht wert={z.neu.betreff} onWert={(w) => z.aendernNeu({ betreff: w })} />
          <IonItem lines="none" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Gemeinde</IonLabel>
            <IonSelect aria-label="Gemeinde" interface="popover" value={z.neu.organizationId}
              onIonChange={(e) => z.aendernNeu({ organizationId: String(e.detail.value ?? '') })}>
              <IonSelectOption value="">Keine Gemeinde</IonSelectOption>
              {z.gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
        </IonList>
      )}
      <IonButton expand="block" style={{ marginTop: 'var(--app-abstand-mittel)' }} onClick={() => { void z.absenden(); }} disabled={z.sendet || !z.isOnline}>
        <IonIcon icon={ICON_LISTE} slot="start" />
        Einsortieren
      </IonButton>
    </Abschnitt>
  );
};

const PostDetail: React.FC<Props> = ({ nachrichtId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_POSTEINGANG);
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, laden, letzteEingehende, betreffVorschlag, vorgangId, archiviert,
    archivieren, wiederherstellen, loeschenFragen,
  } = usePostDetail(nachrichtId);

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

  return (
    <IonPage>
      {kopf}
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Mail" />

        {archiviert && (
          <div style={{ margin: 'var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel="Diese Mail liegt im Archiv">
              {mail.archiviert_am ? `Archiviert am ${datumUhrzeit(mail.archiviert_am)}. ` : ''}Nach 180 Tagen wird sie gelöscht.
            </Hinweis>
          </div>
        )}

        {imVorgang && (
          <div style={{ margin: 'var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel={`Einsortiert in Vorgang ${vorgangId}`}>
              Antworten gehen über den Vorgang, damit die Nummer im Betreff steht.
            </Hinweis>
            <IonButton fill="outline" onClick={() => router.push(`/admin/support/vorgaenge/${vorgangId}`)}>
              <IonIcon icon={ICON_LISTE} slot="start" />
              Vorgang öffnen
            </IonButton>
          </div>
        )}

        <Abschnitt icon={ICON_CHATS} titel={faden.length === 1 ? 'Mail' : `Faden mit ${faden.length} Mails`} farbe="organizations">
          <p style={{ margin: '0 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
            Über {POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach}
          </p>
          <MailListe mails={faden} neu={neu} />
        </Abschnitt>

        <EinsortierenAbschnitt mail={{ id: mail.id, betreff: mail.betreff }} imVorgang={imVorgang} />

        {!imVorgang && !archiviert && letzteEingehende && (
          <Abschnitt icon={ICON_ANTWORTEN} titel="Antworten" farbe="organizations">
            <AntwortFormular
              postfach={mail.postfach}
              betreffVorschlag={betreffVorschlag}
              an={letzteEingehende.von_adresse}
              senden={(koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper)}
            />
          </Abschnitt>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-basis)' }}>
          {archiviert ? (
            <IonButton expand="block" fill="outline" onClick={() => { void wiederherstellen(); }} disabled={!isOnline}>
              <IonIcon icon={ICON_RUECKGAENGIG} slot="start" />
              Wiederherstellen
            </IonButton>
          ) : (
            <IonButton expand="block" fill="outline" onClick={() => { void archivieren(); }} disabled={!isOnline}>
              <IonIcon icon={ICON_ARCHIV} slot="start" />
              Archivieren
            </IonButton>
          )}
          <IonButton expand="block" fill="outline" color="danger" onClick={loeschenFragen} disabled={!isOnline}>
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            Löschen
          </IonButton>
        </div>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster die Web-Fassung (wie
// ein Mailprogramm), sonst die Darstellung der App. Beide nutzen usePostDetail.
const SupportPostDetailPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  return (
    <NurSupport titel="Mail">
      {breit ? <WebPostDetail nachrichtId={props.nachrichtId} /> : <PostDetail {...props} />}
    </NurSupport>
  );
};

export default SupportPostDetailPage;
