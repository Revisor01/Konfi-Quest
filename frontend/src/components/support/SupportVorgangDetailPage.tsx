// Ein Vorgang der Support-Ansicht, /admin/support/vorgaenge/:id
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Kopf mit Betreff, Nummer und Status. Darunter „Einordnen" -- Art, Bereich,
// Dringlichkeit, Status und Gemeinde als Auswahlfelder, jede Änderung sofort
// gespeichert --, der Kontakt, die Gemeinde mit ihrer Gemeindeleitung, bei einer
// Anfrage deren Angaben und „Gemeinde anlegen", der Verlauf mit der Antwort
// (Textbausteine, Vorschau mit Fußzeile), die interne Notiz, Archivieren und
// Löschen mit Rückfrage. Im breiten Browserfenster stehen sie in zwei Spalten
// (web/WebVorgangDetail).
//
// Die Logik steht in components/support/useVorgangDetail.ts, dieselbe wie in der
// Web-Fassung.

import React from 'react';
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
import api from '../../services/api';
import type { MailAntwortDaten } from '../../types/support';
import { datumKurz, datumUhrzeit } from '../../utils/dateUtils';
import { lizenzText } from '../../utils/lizenzen';
import { gemeindeName } from '../../utils/supportMail';
import { laufzeitAngabe } from '../../utils/supportWeb';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  ERLEDIGT_HINWEIS,
  QUELLEN,
  STATUS_REIHE,
  VORGANG_STATUS,
  artKurz,
  bereichIstPflicht,
  gemeindeAngabeVon,
  kontaktVon,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { SUPPORT_VORGAENGE } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { Abschnitt, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { AntwortFormular, Hinweis, MailListe } from './SupportMailTeile';
import SupportGemeindeAnlegen from './SupportGemeindeAnlegen';
import { useSupportZurueck } from './useSupportZurueck';
import { useVorgangDetail } from './useVorgangDetail';
import WebVorgangDetail from './web/WebVorgangDetail';

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

const STATUS_FARBE: Record<VorgangStatus, string> = {
  neu: 'var(--app-color-warning)',
  in_arbeit: 'var(--app-color-info)',
  wartet: 'var(--app-color-neutral)',
  erledigt: 'var(--app-color-success)',
};

const VorgangDetail: React.FC<Props> = ({ vorgangId }) => {
  const zurueck = useSupportZurueck(SUPPORT_VORGAENGE);
  const d = useVorgangDetail(vorgangId);
  const {
    isOnline, vorgang, neu, laedt, fehler, nichtGefunden, speichert, laden, gemeinden, empfaenger, empfaengerFehlt, antwortWeg,
    betreffVorschlag, einordnen, notiz, setNotiz, notizGeaendert, notizSpeichern, archivieren, wiederherstellen, loeschenFragen,
    archiviert, anlegen,
  } = d;

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
  const bereichFehlt = bereichIstPflicht(vorgang.art) && vorgang.bereich === null;

  return (
    <IonPage>
      <AppKopfzeile titel="Vorgang" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Vorgang" />

        <SectionHeader
          title={vorgang.betreff || '(ohne Betreff)'}
          subtitle={`Vorgang ${vorgang.id} · ${QUELLEN[vorgang.quelle]}`}
          icon={ICON_LISTE}
          preset="organizations"
          stats={[
            { value: VORGANG_STATUS[vorgang.status].kurz, label: 'Status' },
            { value: artKurz(vorgang.art), label: 'Art' },
            { value: vorgang.dringlichkeit === 'dringend' ? 'Dringend' : 'Normal', label: 'Dringlichkeit' },
          ]}
        />

        {archiviert && (
          <div role="status" className="app-card" style={{ margin: 'var(--app-abstand-basis)', padding: 'var(--app-abstand-basis)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
              {vorgang.status === 'erledigt' ? 'Erledigt und im Archiv' : 'Dieser Vorgang liegt im Archiv'}
            </div>
            <p style={{ margin: 'var(--app-abstand-kompakt) 0', color: 'var(--app-text-body)' }}>
              {vorgang.archiviert_am ? `Archiviert am ${datumUhrzeit(vorgang.archiviert_am)}. ` : ''}
              Eine neue Mail holt ihn zurück; oder du stellst ihn wieder her — er steht dann „In Arbeit“ in der Liste.
            </p>
            <IonButton fill="outline" onClick={() => { void wiederherstellen(); }} disabled={speichert || !isOnline}>
              <IonIcon icon={ICON_RUECKGAENGIG} slot="start" />
              Wiederherstellen
            </IonButton>
          </div>
        )}

        {vorgang.organization_id === null && (
          <div style={{ margin: '0 var(--app-abstand-basis)' }}>
            <Hinweis art="warnung" titel="Noch keiner Gemeinde zugeordnet">
              {gemeindeAngabe ? <>Angegeben im Formular: <strong>{gemeindeAngabe}</strong>. </> : 'Im Formular wurde keine Gemeinde genannt. '}
              Wähle unter „Einordnen“ die passende Gemeinde.
            </Hinweis>
          </div>
        )}

        <Abschnitt icon={ICON_BEARBEITEN} titel="Einordnen" farbe="organizations" rechts={<Marke text={VORGANG_STATUS[vorgang.status].kurz} farbe={STATUS_FARBE[vorgang.status]} />}>
          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Art</IonLabel>
              <IonSelect aria-label="Art" interface="popover" value={vorgang.art} disabled={!isOnline}
                onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.art) void einordnen({ art: w as VorgangArt }); }}>
                {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">{bereichIstPflicht(vorgang.art) ? 'Bereich *' : 'Bereich'}</IonLabel>
              <IonSelect aria-label="Bereich" interface="popover" value={vorgang.bereich ?? ''} disabled={!isOnline}
                onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w !== (vorgang.bereich ?? '')) void einordnen({ bereich: w ? (w as VorgangBereich) : null }); }}>
                <IonSelectOption value="">{bereichFehlt ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
                {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Dringlichkeit</IonLabel>
              <IonSelect aria-label="Dringlichkeit" interface="popover" value={vorgang.dringlichkeit} disabled={!isOnline}
                onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.dringlichkeit) void einordnen({ dringlichkeit: w as Dringlichkeit }); }}>
                {DRINGLICHKEITEN.map((x) => <IonSelectOption key={x.wert} value={x.wert}>{x.hinweis ? `${x.label} – ${x.hinweis}` : x.label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Status</IonLabel>
              <IonSelect aria-label="Status" interface="popover" value={vorgang.status} disabled={!isOnline}
                onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.status) void einordnen({ status: w as VorgangStatus }); }}>
                {STATUS_REIHE.map((s) => <IonSelectOption key={s} value={s}>{VORGANG_STATUS[s].label}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
            <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>{ERLEDIGT_HINWEIS}</p>
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Gemeinde</IonLabel>
              <IonSelect aria-label="Gemeinde" interface="popover" value={vorgang.organization_id === null ? '' : String(vorgang.organization_id)} disabled={!isOnline}
                onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w !== (vorgang.organization_id === null ? '' : String(vorgang.organization_id))) void einordnen({ organization_id: w ? Number(w) : null }); }}>
                <IonSelectOption value="">Keine Gemeinde</IonSelectOption>
                {vorgang.organization_id !== null && !gemeinden.some((g) => g.id === vorgang.organization_id) && (
                  <IonSelectOption value={String(vorgang.organization_id)}>{vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}`}</IonSelectOption>
                )}
                {gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>)}
              </IonSelect>
            </IonItem>
          </IonList>
        </Abschnitt>

        {formularText && (
          <Abschnitt icon={ICON_TEXTDOKUMENT} titel={vorgang.quelle === 'anfrage' ? 'Nachricht aus dem Formular' : 'Anliegen'} farbe="organizations">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--app-text-body)' }}>{formularText}</p>
          </Abschnitt>
        )}

        <Abschnitt icon={ICON_PERSON} titel="Kontakt" farbe="organizations">
          <Angabe icon={ICON_PERSON} label="Name">{kontakt.name ?? '–'}</Angabe>
          <Angabe icon={ICON_MAIL} label="E-Mail">{kontakt.email ? <a href={`mailto:${kontakt.email}`}>{kontakt.email}</a> : '–'}</Angabe>
          <Angabe icon={ICON_INFO} label="Funktion">{kontakt.funktion ?? '–'}</Angabe>
          <Angabe icon={ICON_ORGANISATION} label="Gemeinde laut Formular">{gemeindeAngabe ?? '–'}</Angabe>
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

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations">
          <MailListe mails={vorgang.verlauf} neu={neu} leer="Noch keine Mails in diesem Vorgang." />
        </Abschnitt>

        <Abschnitt icon={ICON_ANTWORTEN} titel="Antworten" farbe="organizations">
          {antwortWeg && antwortWeg.art !== 'keiner' ? (
            <AntwortFormular
              key={vorgang.id}
              postfach={antwortWeg.postfach}
              platzhalterFuer={anfrage ? { anfrage_id: anfrage.id } : vorgang.organization_id !== null ? { organization_id: vorgang.organization_id } : null}
              betreffVorschlag={betreffVorschlag}
              an={antwortWeg.art === 'gemeinde' ? null : antwortWeg.an}
              empfaenger={antwortWeg.art === 'gemeinde' ? empfaenger : null}
              empfaengerFehlt={empfaengerFehlt}
              senden={(koerper: MailAntwortDaten) => api.post(`/support/vorgaenge/${vorgang.id}/antworten`, koerper)}
            />
          ) : (
            <Hinweis art="hinweis" titel="Es gibt noch niemanden, dem sich antworten ließe">
              Ordne oben eine Gemeinde zu — dann stehen ihre Gemeindeleitung und Leitung als Empfänger zur Wahl.
            </Hinweis>
          )}
        </Abschnitt>

        {anfrage && anlegen.anlegbar && <SupportGemeindeAnlegen anfrage={anfrage} d={anlegen} />}

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-basis)' }}>
          {!archiviert && (
            <IonButton expand="block" fill="outline" onClick={() => { void archivieren(); }} disabled={speichert || !isOnline}>
              <IonIcon icon={ICON_ARCHIV} slot="start" />
              Archivieren
            </IonButton>
          )}
          <IonButton expand="block" fill="outline" color="danger" onClick={loeschenFragen} disabled={speichert || !isOnline}>
            <IonIcon icon={ICON_LOESCHEN} slot="start" />
            Löschen
          </IonButton>
        </div>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster die zweispaltige
// Web-Fassung, sonst die Darstellung der App. Beide nutzen useVorgangDetail.
const SupportVorgangDetailPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  return (
    <NurSupport titel="Vorgang">
      {breit ? <WebVorgangDetail vorgangId={props.vorgangId} /> : <VorgangDetail {...props} />}
    </NurSupport>
  );
};

export default SupportVorgangDetailPage;
