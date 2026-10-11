// Ein Vorgang der Support-Ansicht, /admin/support/vorgaenge/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Kopf mit Betreff, Nummer und Status, darunter die zwei Handgriffe
// „Antworten" und „Einordnen" -- beide öffnen ein Modal (Simon, 11.10.2026).
// Dann der Verlauf als Gespräche (MailGespraeche: eingeklappte Mails, Antworten
// eingerückt unter ihrem Vorgänger, die Nachricht aus dem Formular vorn), der
// Kontakt, die Gemeinde mit ihrer Gemeindeleitung, bei einer Anfrage deren
// Angaben und „Gemeinde anlegen", die interne Notiz, Archivieren und Löschen
// mit Rückfrage. Im breiten Browserfenster steht der Vorgang im Lesebereich
// neben der Liste (web/WebVorgaenge).
//
// Die Logik steht in components/support/useVorgangDetail.ts, dieselbe wie in der
// Web-Fassung.

import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTextarea,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_ANTWORTEN,
  ICON_ARCHIV,
  ICON_BEARBEITEN,
  ICON_CHATS,
  ICON_INFO,
  ICON_LISTE,
  ICON_LOESCHEN,
  ICON_MAIL,
  ICON_ORGANISATION,
  ICON_PERSON,
  ICON_RUECKGAENGIG,
  ICON_TEXTDOKUMENT,
} from '../shared/icons';
import { datumKurz, datumUhrzeit } from '../../utils/dateUtils';
import { lizenzText } from '../../utils/lizenzen';
import { laufzeitAngabe } from '../../utils/supportWeb';
import {
  QUELLEN,
  VORGANG_STATUS,
  artKurz,
  gemeindeAngabeVon,
  kontaktVon,
} from '../../utils/supportVorgaenge';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { Abschnitt, Ladefehler, NurSupport } from './SupportBausteine';
import { Hinweis } from './SupportMailTeile';
import MailGespraeche from './MailGespraeche';
import { AntwortModal, EinordnenModal } from './SupportModale';
import SupportGemeindeAnlegen from './SupportGemeindeAnlegen';
import { useSupportZurueck } from './useSupportZurueck';
import { useVorgangDetail } from './useVorgangDetail';
import WebVorgaenge from './web/WebVorgaenge';

interface Props {
  vorgangId: number;
  /** Reicht MainTabs mit (ParamSeite); die Seite geht selbst zur Liste zurueck. */
  onBack?: () => void;
}

/** Eine Zeile "Bezeichnung: Wert" im Stil der Info-Karten der App. */
const Angabe: React.FC<{ icon: string; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div className="app-info-row">
    <IonIcon icon={icon} className="app-info-row__icon" style={{ color: 'var(--app-text-users)' }} />
    <div>
      <div className="app-info-row__label">{label}</div>
      <div className="app-info-row__value">{children}</div>
    </div>
  </div>
);

const VorgangDetail: React.FC<Props> = ({ vorgangId }) => {
  const zurueck = useSupportZurueck(SUPPORT_VORGAENGE);
  const d = useVorgangDetail(vorgangId);
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, antwort, notiz, setNotiz, notizGeaendert,
    notizSpeichern, archivieren, wiederherstellen, loeschenFragen, archiviert, anlegen,
  } = d;
  const [antwortOffen, setAntwortOffen] = useState(false);
  const [einordnenOffen, setEinordnenOffen] = useState(false);

  if (laedt && !vorgang) {
    return (
      <IonPage>
        <AppKopfzeile titel="Vorgang" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel="Vorgang" />
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
          <AppKopfzeileGross titel="Vorgang" />
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
  const gemeindeAngabe = gemeindeAngabeVon(vorgang);
  const gemeinde = vorgang.gemeinde;
  const formularText = vorgang.beschreibung ?? anfrage?.nachricht ?? null;

  return (
    <IonPage>
      <AppKopfzeile titel="Vorgang" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Vorgang" />

        <SectionHeader
          title={vorgang.betreff || '(ohne Betreff)'}
          subtitle={`Vorgang ${vorgang.id} · ${vorgang.gemeinde_name ?? 'keine Gemeinde'}`}
          icon={ICON_LISTE}
          preset="organizations"
          stats={[
            { value: VORGANG_STATUS[vorgang.status].kurz, label: 'Status' },
            { value: artKurz(vorgang.art), label: 'Art' },
            { value: vorgang.dringlichkeit === 'dringend' ? 'Dringend' : 'Normal', label: 'Dringlichkeit' },
          ]}
        />

        {/* Die zwei Handgriffe eines Vorgangs stehen oben; beide öffnen ein Modal. */}
        <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', margin: '0 var(--app-abstand-basis) var(--app-abstand-eng)' }}>
          <IonButton style={{ flex: 1 }} onClick={() => setAntwortOffen(true)} disabled={!antwort || !isOnline}>
            <IonIcon icon={ICON_ANTWORTEN} slot="start" />
            Antworten
          </IonButton>
          <IonButton style={{ flex: 1 }} fill="outline" onClick={() => setEinordnenOffen(true)} disabled={!isOnline}>
            <IonIcon icon={ICON_BEARBEITEN} slot="start" />
            Einordnen
          </IonButton>
        </div>

        {archiviert && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel={vorgang.status === 'erledigt' ? 'Erledigt und im Archiv' : 'Dieser Vorgang liegt im Archiv'}>
              {vorgang.archiviert_am ? `Archiviert am ${datumUhrzeit(vorgang.archiviert_am)}. ` : ''}
              Eine neue Mail holt ihn zurück.
              <div style={{ marginTop: 'var(--app-abstand-eng)' }}>
                <IonButton size="small" fill="outline" onClick={() => { void wiederherstellen(); }} disabled={speichert || !isOnline}>
                  <IonIcon icon={ICON_RUECKGAENGIG} slot="start" />
                  Wiederherstellen
                </IonButton>
              </div>
            </Hinweis>
          </div>
        )}

        {vorgang.organization_id === null && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="warnung" titel="Noch keiner Gemeinde zugeordnet">
              {gemeindeAngabe ? <>Angegeben im Formular: <strong>{gemeindeAngabe}</strong>. </> : 'Im Formular wurde keine Gemeinde genannt. '}
              Unter „Einordnen“ lässt sie sich zuordnen.
            </Hinweis>
          </div>
        )}

        {!antwort && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="hinweis" titel="Es gibt noch niemanden, dem sich antworten ließe">
              Ordne unter „Einordnen“ eine Gemeinde zu — dann stehen ihre Gemeindeleitung und Leitung als Empfänger zur Wahl.
            </Hinweis>
          </div>
        )}

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations" ohneKarte>
          <MailGespraeche
            mails={vorgang.verlauf}
            neu={neu}
            anfang={formularText ? {
              marke: vorgang.quelle === 'anfrage' ? 'Nachricht aus der Anfrage' : 'Anliegen aus dem Formular',
              name: kontakt.name,
              adresse: kontakt.email,
              datum: vorgang.created_at,
              text: formularText,
            } : null}
            leer="Noch keine Mails in diesem Vorgang."
          />
        </Abschnitt>

        {anfrage && anlegen.gemeindeId !== null && (anlegen.angelegt || anfrage.status === 'angelegt') && (
          <div role="status" className="app-card" style={{ margin: 'var(--app-abstand-basis)', padding: 'var(--app-abstand-basis)' }}>
            <div style={{ fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>Die Gemeinde ist angelegt.</div>
            {anlegen.angelegt && (
              <p style={{ margin: 'var(--app-abstand-kompakt) 0', color: 'var(--app-text-body)' }}>
                Benutzername der Gemeindeleitung: <strong>{anlegen.angelegt.username}</strong>. Benutzername und Passwort
                auf getrennten Wegen weitergeben — nicht beides in derselben Mail.
              </p>
            )}
            <IonButton fill="outline" routerLink={`/admin/organizations?gemeinde=${anlegen.gemeindeId}`}>
              <IonIcon icon={ICON_ORGANISATION} slot="start" />
              Gemeinde öffnen
            </IonButton>
          </div>
        )}
        {anfrage && anlegen.anlegbar && <SupportGemeindeAnlegen anfrage={anfrage} d={anlegen} />}

        <Abschnitt icon={ICON_PERSON} titel="Kontakt" farbe="organizations">
          <Angabe icon={ICON_PERSON} label="Name">{kontakt.name ?? '–'}</Angabe>
          <Angabe icon={ICON_MAIL} label="E-Mail">{kontakt.email ? <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a> : '–'}</Angabe>
          {kontakt.funktion && <Angabe icon={ICON_INFO} label="Funktion">{kontakt.funktion}</Angabe>}
          {gemeindeAngabe && <Angabe icon={ICON_ORGANISATION} label="Gemeinde laut Formular">{gemeindeAngabe}</Angabe>}
          <Angabe icon={ICON_INFO} label="Eingegangen">{`${QUELLEN[vorgang.quelle]}, ${datumUhrzeit(vorgang.created_at)}`}</Angabe>
        </Abschnitt>

        {(gemeinde || vorgang.organization_id !== null) && (
          <Abschnitt icon={ICON_ORGANISATION} titel="Gemeinde" farbe="organizations">
            <Angabe icon={ICON_ORGANISATION} label="Gemeinde">{gemeinde?.display_name ?? vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}`}</Angabe>
            {gemeinde && <Angabe icon={ICON_INFO} label="Laufzeit">{laufzeitAngabe(gemeinde).text}</Angabe>}
            {gemeinde && gemeinde.konfi_count !== null && (
              <Angabe icon={ICON_INFO} label="Konfis">{gemeinde.konfi_count}{gemeinde.max_konfis ? ` von ${gemeinde.max_konfis}` : ''}</Angabe>
            )}
            {vorgang.leitung.map((l) => (
              <Angabe key={l.id} icon={ICON_PERSON} label="Gemeindeleitung">
                {l.display_name || l.username}
                {l.email ? <> · <a href={`mailto:${l.email}`}>{l.email}</a></> : ''}
                {l.last_login_at ? ` · zuletzt angemeldet ${datumKurz(l.last_login_at)}` : ''}
              </Angabe>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
              <IonButton size="small" fill="outline" routerLink={`/admin/organizations?gemeinde=${vorgang.organization_id}`}>Gemeinde öffnen</IonButton>
              <IonButton size="small" fill="outline" routerLink={`/admin/support/vorgaenge?gemeinde=${vorgang.organization_id}`}>Alle Vorgänge</IonButton>
            </div>
          </Abschnitt>
        )}

        {anfrage && (
          <Abschnitt icon={ICON_INFO} titel="Angaben aus der Anfrage" farbe="organizations">
            <Angabe icon={ICON_ORGANISATION} label="Gemeinde">{anfrage.gemeinde}</Angabe>
            <Angabe icon={ICON_INFO} label="Kirchenkreis">{anfrage.kirchenkreis || '–'}</Angabe>
            <Angabe icon={ICON_INFO} label="Landeskirche">{anfrage.landeskirche || '–'}</Angabe>
            <Angabe icon={ICON_PERSON} label="Verantwortlich">{anfrage.kontakt_name}{anfrage.funktion ? ` (${anfrage.funktion})` : ''}</Angabe>
            <Angabe icon={ICON_INFO} label="Ungefähre Zahl">{anfrage.anzahl_konfis ?? '–'} Konfis · {anfrage.anzahl_teamer ?? '–'} Teamer:innen</Angabe>
            <Angabe icon={ICON_INFO} label="Wunschlizenz">{anlegen.wunsch ? `${lizenzText(anlegen.wunsch)}, ${anlegen.wunsch.euro} € pro Jahr` : 'Noch offen'}</Angabe>
          </Abschnitt>
        )}

        <Abschnitt icon={ICON_TEXTDOKUMENT} titel="Notiz (nur für den Support)" farbe="organizations">
          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Interne Notiz</IonLabel>
              <IonTextarea aria-label="Notiz" value={notiz} autoGrow={true} rows={3} onIonInput={(e) => setNotiz(String(e.detail.value ?? ''))} />
            </IonItem>
          </IonList>
          <IonButton expand="block" onClick={() => { void notizSpeichern(); }} disabled={!notizGeaendert || speichert || !isOnline}>
            Notiz speichern
          </IonButton>
        </Abschnitt>

        <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-basis)' }}>
          {!archiviert && (
            <IonButton style={{ flex: 1 }} fill="outline" onClick={() => { void archivieren(); }} disabled={speichert || !isOnline}>
              <IonIcon icon={ICON_ARCHIV} slot="start" />
              Archivieren
            </IonButton>
          )}
          <IonButton style={{ flex: 1 }} fill="outline" color="danger" onClick={loeschenFragen} disabled={speichert || !isOnline}>
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            Löschen
          </IonButton>
        </div>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />

        {antwort && <AntwortModal key={vorgang.id} offen={antwortOffen} onSchliessen={() => setAntwortOffen(false)} formular={antwort} />}
        <EinordnenModal offen={einordnenOffen} onSchliessen={() => setEinordnenOffen(false)} d={d} />
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
