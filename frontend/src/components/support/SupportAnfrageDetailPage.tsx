// Eine Anfrage der Support-Ansicht, /admin/support/anfragen/:id (Web-Version,
// Entscheidung 4 und 5, 02.10.2026).
//
// Alle Angaben aus dem Formular der Homepage, Status und Notiz der
// Bearbeitung und -- solange keine Gemeinde daraus entstanden ist -- das
// Formular "Gemeinde anlegen", vorbelegt aus der Anfrage: Name, Kirchenkreis
// (gesucht in der Struktur), Kontakt, Testphase mit 5 Konfis und die erste
// Gemeindeleitung. Angelegt wird mit POST /support/anfragen/:id/anlegen, das
// Gemeinde und Gemeindeleitung in EINER Transaktion anlegt, mit derselben
// Logik wie POST /organizations, und die Anfrage auf "angelegt" setzt.
//
// Es gibt keine Route fuer eine einzelne Anfrage; die Seite holt die Liste
// (GET /support/anfragen) und nimmt sich ihren Eintrag.
//
// Support-Mail (03.10.2026, docs/planung/support-mail.md): Der Verlauf zeigt
// alle Mails zur Anfrage, aelteste zuerst, ein- und ausgehend
// unterscheidbar, Zitate eingeklappt; ungelesene werden beim Anzeigen als
// gelesen gemeldet. Darunter „Antworten" von moin@ mit Bausteinen, deren
// Platzhalter GET /support/mail/platzhalter?anfrage_id= fuellt. Der Verlauf
// laedt fuer sich -- scheitert er, bleibt die Anfrage bedienbar.

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
  IonToggle,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_AKTUALISIEREN,
  ICON_ANTWORTEN,
  ICON_BEARBEITEN,
  ICON_CHATS,
  ICON_GRUPPE,
  ICON_HINZUFUEGEN,
  ICON_INFO,
  ICON_MAIL,
  ICON_NETZWERK,
  ICON_ORGANISATION,
  ICON_PERSON,
  ICON_SCHLUESSEL,
  ICON_SICHTBAR,
  ICON_TELEFON,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
  ICON_VERBORGEN,
  ICON_ZUSAGE_GEFUELLT,
} from '../shared/icons';
import api from '../../services/api';
import type { AnfrageStatus, MailAntwortDaten } from '../../types/support';
import {
  ANFRAGE_STATUS,
  STATUS_VON_HAND,
  TESTPHASE_KONFIS,
  TESTPHASE_TAGE,
  testphaseUmschalten,
} from '../../utils/supportAnfragen';
import { generateStrongPassword } from '../../utils/passwortVorschlag';
import { datumUhrzeit } from '../../utils/dateUtils';
import { EIGENES_LIMIT, TARIF_OPTIONEN, lizenzLimit, lizenzText } from '../../utils/lizenzen';
import { ANFRAGE_BETREFF, standardBetreff } from '../../utils/supportMail';
import { Abschnitt, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useAnfrageDetail } from './useAnfrageDetail';
import { AntwortFormular, MailListe } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebAnfrageDetail from './web/WebAnfrageDetail';

interface Props {
  anfrageId: number;
  /**
   * Reicht MainTabs mit (ParamSeite). Ohne Verlauf fuehrte er auf
   * /admin/support (elternPfad nimmt zwei Pfadteile); die Seite geht
   * stattdessen selbst zur Liste der Anfragen zurueck.
   */
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

const AnfrageDetail: React.FC<Props> = ({ anfrageId }) => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck('/admin/support/anfragen');
  const {
    isOnline, anfrage, kirchenkreise, strukturFehlt, laedt, fehler, status, setStatus, notiz, setNotiz, speichert,
    formular, setFormular, aendern, eigenesLimit, setEigenesLimit, passwortZeigen, setPasswortZeigen, legtAn, angelegt,
    verlauf, verlaufFehler, neueMails, verlaufHolen, nachDemSenden, laden, bearbeitungSpeichern, kirchenkreisAnlegen,
    anlegen, statusInfo, wunsch, gemeindeId, kkGefunden, geaendert, gewaehlterKreis,
  } = useAnfrageDetail(anfrageId);

  if (laedt && !anfrage) {
    return (
      <IonPage>
        <AppKopfzeile titel="Anfrage" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel="Anfrage" />
          <LoadingSpinner message="Anfrage wird geladen..." />
        </IonContent>
      </IonPage>
    );
  }

  if (fehler || !anfrage) {
    return (
      <IonPage>
        <AppKopfzeile titel="Anfrage" onZurueck={zurueck} gemeindeUmschalter={false} />
        <IonContent className="app-gradient-background" fullscreen>
          <AppKopfzeileGross titel="Anfrage" />
          {fehler ? (
            <Ladefehler text="Die Anfrage konnte nicht geladen werden." onErneut={() => { void laden(); }} />
          ) : (
            <EmptyState icon={ICON_MAIL} title="Anfrage nicht gefunden" message="Diese Anfrage gibt es nicht (mehr)." />
          )}
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <AppKopfzeile titel="Anfrage" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Anfrage" />

        <SectionHeader
          title={anfrage.gemeinde}
          subtitle={`Anfrage vom ${datumUhrzeit(anfrage.created_at)}`}
          icon={ICON_ORGANISATION}
          preset="organizations"
          stats={[
            { value: anfrage.anzahl_konfis ?? '–', label: 'Konfis (ca.)' },
            { value: anfrage.anzahl_teamer ?? '–', label: 'Team (ca.)' },
            { value: statusInfo.label, label: 'Status' },
          ]}
        />

        {anfrage.status === 'angelegt' && gemeindeId && (
          <div role="status" className="app-card" style={{ margin: 'var(--app-abstand-basis)', padding: 'var(--app-abstand-basis)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-kompakt)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
              <IonIcon icon={ICON_ZUSAGE_GEFUELLT} style={{ color: 'var(--app-color-success)', fontSize: 'var(--app-text-titel)' }} aria-hidden="true" />
              Die Gemeinde ist angelegt.
            </div>
            {angelegt && (
              <p style={{ margin: 'var(--app-abstand-kompakt) 0', color: 'var(--app-text-body)' }}>
                Benutzername der Gemeindeleitung: <strong>{angelegt.username}</strong>. Benutzername und Passwort
                auf getrennten Wegen weitergeben — nicht beides in derselben Mail.
              </p>
            )}
            <IonButton fill="outline" onClick={() => router.push(`/admin/organizations?gemeinde=${gemeindeId}`)}>
              <IonIcon icon={ICON_ORGANISATION} slot="start" />
              Gemeinde öffnen
            </IonButton>
          </div>
        )}

        <Abschnitt icon={ICON_INFO} titel="Angaben" farbe="organizations">
          <Angabe icon={ICON_ORGANISATION} label="Gemeinde">{anfrage.gemeinde}</Angabe>
          <Angabe icon={ICON_NETZWERK} label="Kirchenkreis">{anfrage.kirchenkreis || '–'}</Angabe>
          <Angabe icon={ICON_NETZWERK} label="Landeskirche">{anfrage.landeskirche || '–'}</Angabe>
          <Angabe icon={ICON_PERSON} label="Verantwortlich">
            {anfrage.kontakt_name}{anfrage.funktion ? ` (${anfrage.funktion})` : ''}
          </Angabe>
          <Angabe icon={ICON_MAIL} label="E-Mail"><a href={`mailto:${anfrage.email}`}>{anfrage.email}</a></Angabe>
          <Angabe icon={ICON_TELEFON} label="Mobilnummer">
            {anfrage.mobil ? <a href={`tel:${anfrage.mobil.replace(/[^\d+]/g, '')}`}>{anfrage.mobil}</a> : '–'}
          </Angabe>
          <Angabe icon={ICON_GRUPPE} label="Ungefähre Zahl">
            {anfrage.anzahl_konfis ?? '–'} Konfis · {anfrage.anzahl_teamer ?? '–'} Teamer:innen
          </Angabe>
          <Angabe icon={ICON_ZUSAGE_GEFUELLT} label="Wunschlizenz">
            {wunsch ? `${lizenzText(wunsch)}, ${wunsch.euro} € pro Jahr` : 'Noch offen'}
          </Angabe>
          <Angabe icon={ICON_TEXTDOKUMENT} label="Nachricht">
            <span style={{ whiteSpace: 'pre-wrap' }}>{anfrage.nachricht || '–'}</span>
          </Angabe>
          <Angabe icon={ICON_UHRZEIT} label="Eingegangen">
            {datumUhrzeit(anfrage.created_at)}
            {anfrage.updated_at && anfrage.updated_at !== anfrage.created_at ? ` · zuletzt geändert ${datumUhrzeit(anfrage.updated_at)}` : ''}
          </Angabe>
        </Abschnitt>

        <Abschnitt icon={ICON_CHATS} titel="Verlauf" farbe="organizations">
          {verlaufFehler && !verlauf ? (
            <div role="status">
              <p style={{ margin: '0 0 var(--app-abstand-eng)', color: 'var(--app-text-fehler)' }}>Der Verlauf konnte nicht geladen werden.</p>
              <IonButton size="small" fill="outline" onClick={() => { void verlaufHolen(true); }}>
                <IonIcon icon={ICON_AKTUALISIEREN} slot="start" />
                Verlauf neu laden
              </IonButton>
            </div>
          ) : verlauf ? (
            <MailListe mails={verlauf} neu={neueMails} leer="Noch keine Mails zu dieser Anfrage." />
          ) : (
            <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Verlauf wird geladen...</p>
          )}
        </Abschnitt>

        <Abschnitt icon={ICON_ANTWORTEN} titel="Antworten" farbe="organizations">
          <AntwortFormular
            postfach="moin"
            platzhalterFuer={{ anfrage_id: anfrage.id }}
            betreffVorschlag={standardBetreff(verlauf && verlauf.length > 0 ? verlauf[verlauf.length - 1].betreff : ANFRAGE_BETREFF)}
            an={anfrage.email}
            senden={(koerper: MailAntwortDaten) => api.post(`/support/anfragen/${anfrage.id}/antworten`, koerper)}
            onGesendet={nachDemSenden}
          />
        </Abschnitt>

        <Abschnitt icon={ICON_BEARBEITEN} titel="Bearbeitung" farbe="organizations" rechts={<Marke text={statusInfo.label} farbe={statusInfo.farbe} />}>
          <IonList style={{ background: 'transparent' }}>
            {anfrage.status !== 'angelegt' && (
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Status</IonLabel>
                <IonSelect
                  aria-label="Status"
                  interface="popover"
                  value={status}
                  onIonChange={(e) => setStatus(e.detail.value as AnfrageStatus)}
                >
                  {STATUS_VON_HAND.map((s) => (
                    <IonSelectOption key={s} value={s}>{ANFRAGE_STATUS[s].label}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            )}
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Notiz (nur für den Support)</IonLabel>
              <IonTextarea
                aria-label="Notiz"
                value={notiz}
                autoGrow={true}
                rows={3}
                onIonInput={(e) => setNotiz(String(e.detail.value ?? ''))}
              />
            </IonItem>
          </IonList>
          <IonButton expand="block" onClick={() => { void bearbeitungSpeichern(); }} disabled={!geaendert || speichert || !isOnline}>
            Speichern
          </IonButton>
        </Abschnitt>

        {anfrage.status !== 'angelegt' && formular && (
          <Abschnitt icon={ICON_HINZUFUEGEN} titel="Gemeinde anlegen" farbe="organizations">
            <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' }}>
              Vorbelegt aus der Anfrage. Angelegt werden die Gemeinde mit allen Vorlagen und ihre erste
              Gemeindeleitung; alles Weitere richtet die Gemeinde selbst ein.
            </p>
            <IonList style={{ background: 'transparent' }}>
              <Feld label="Name der Gemeinde" pflicht wert={formular.name} onWert={(w) => aendern({ name: w })} />
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Kirchenkreis</IonLabel>
                <IonSelect
                  aria-label="Kirchenkreis"
                  interface="popover"
                  value={formular.kirchenkreisId ?? 'ohne'}
                  onIonChange={(e) => aendern({ kirchenkreisId: e.detail.value === 'ohne' ? null : Number(e.detail.value) })}
                >
                  <IonSelectOption value="ohne">Ohne Kirchenkreis</IonSelectOption>
                  {kirchenkreise.map((k) => (
                    <IonSelectOption key={k.id} value={k.id}>
                      {k.landeskirche ? `${k.name} (${k.landeskirche})` : k.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              {gewaehlterKreis && (
                <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                  Landeskirche: {gewaehlterKreis.landeskirche || 'noch keine zugeordnet'}
                </p>
              )}
              {strukturFehlt && (
                <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
                  Die Kirchenkreise konnten nicht geladen werden; die Gemeinde lässt sich auch ohne Zuordnung anlegen.
                </p>
              )}
              {!strukturFehlt && anfrage.kirchenkreis && !kkGefunden && (
                <div style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)' }}>
                  <p style={{ margin: 0, fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                    „{anfrage.kirchenkreis}“ steht noch nicht in der Struktur.
                  </p>
                  <IonButton size="small" fill="clear" onClick={() => { void kirchenkreisAnlegen(); }}>
                    <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
                    Als Kirchenkreis anlegen
                  </IonButton>
                </div>
              )}
              <Feld label="Ansprechperson" wert={formular.kontaktName} onWert={(w) => aendern({ kontaktName: w })} autocomplete="name" />
              <Feld label="E-Mail der Gemeinde" typ="email" wert={formular.kontaktEmail} onWert={(w) => aendern({ kontaktEmail: w })} autocomplete="email" />
              <Feld label="Telefon" typ="tel" wert={formular.kontaktTelefon} onWert={(w) => aendern({ kontaktTelefon: w })} autocomplete="tel" />
              {/* Tarif mit Preis wie unter Gemeinden (utils/lizenzen.ts); Unbegrenzt
                  und ein eigenes Limit gehen immer. */}
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Tarif</IonLabel>
                <IonSelect
                  aria-label="Tarif"
                  interface="popover"
                  value={eigenesLimit ? EIGENES_LIMIT : formular.maxKonfis.trim()}
                  onIonChange={(e) => {
                    const wert = String(e.detail.value ?? '');
                    if (wert === EIGENES_LIMIT) { setEigenesLimit(true); return; }
                    setEigenesLimit(false);
                    aendern({ maxKonfis: wert });
                  }}
                >
                  {TARIF_OPTIONEN.map((t) => (
                    <IonSelectOption key={t.name} value={t.wert}>{t.text}</IonSelectOption>
                  ))}
                  <IonSelectOption value={EIGENES_LIMIT}>Eigenes Limit…</IonSelectOption>
                </IonSelect>
              </IonItem>
              {eigenesLimit && (
                <Feld label="Eigenes Limit" typ="number" wert={formular.maxKonfis} onWert={(w) => aendern({ maxKonfis: w })}
                  hinweis="Zahl der Konfis; leer = unbegrenzt." />
              )}
              <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                {wunsch && wunsch.konfis !== null
                  ? `In der Testphase ${TESTPHASE_KONFIS}, danach ${wunsch.konfis} (Wunschlizenz ${wunsch.name}).`
                  : `In der Testphase ${TESTPHASE_KONFIS}, danach unbegrenzt${wunsch ? ' (Verbund: Limit nach Absprache)' : ''}.`}
              </p>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonToggle
                  aria-label={`Testphase (${TESTPHASE_TAGE} Tage)`}
                  checked={formular.testphase}
                  onIonChange={(e) => {
                    const an = e.detail.checked;
                    setFormular((f) => (f ? testphaseUmschalten(f, an, lizenzLimit(anfrage.wunsch_lizenz)) : f));
                  }}
                >
                  Testphase ({TESTPHASE_TAGE} Tage)
                </IonToggle>
              </IonItem>
              <p style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                {formular.testphase
                  ? `Zugang ${TESTPHASE_TAGE} Tage ab heute, mit Hinweis auf den Startseiten. Verlängern unter Gemeinden.`
                  : 'Ohne Ablaufdatum. Laufzeit und Lizenz lassen sich später unter Gemeinden setzen.'}
              </p>
            </IonList>

            <h3 style={{ margin: 'var(--app-abstand-mittel) 0 var(--app-abstand-eng)', fontSize: 'var(--app-text-standard)', fontWeight: 'var(--app-schrift-halbfett)', color: 'var(--app-text-emphasis)' }}>
              Erste Gemeindeleitung
            </h3>
            <IonList style={{ background: 'transparent' }}>
              <Feld label="Benutzername" pflicht wert={formular.adminUsername} onWert={(w) => aendern({ adminUsername: w })} autocomplete="username"
                hinweis="Buchstaben, Ziffern, Punkt und Bindestrich; im ganzen System frei." />
              <Feld label="Anzeigename" pflicht wert={formular.adminDisplayName} onWert={(w) => aendern({ adminDisplayName: w })} autocomplete="name" />
              <Feld label="E-Mail der Gemeindeleitung" typ="email" wert={formular.adminEmail} onWert={(w) => aendern({ adminEmail: w })} autocomplete="email"
                hinweis="Dorthin geht „Passwort vergessen“." />
              <Feld label="Passwort" pflicht typ={passwortZeigen ? 'text' : 'password'} wert={formular.adminPassword}
                onWert={(w) => aendern({ adminPassword: w })} autocomplete="new-password"
                hinweis="Mindestens 8 Zeichen, Groß- und Kleinbuchstabe, Ziffer, Sonderzeichen, keine Leerzeichen." />
            </IonList>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--app-abstand-eng)', margin: 'var(--app-abstand-eng) 0' }}>
              <IonButton size="small" fill="outline" onClick={() => { aendern({ adminPassword: generateStrongPassword() }); setPasswortZeigen(true); }}>
                <IonIcon icon={ICON_SCHLUESSEL} slot="start" />
                Sicheres Passwort vorschlagen
              </IonButton>
              <IonButton size="small" fill="clear" onClick={() => setPasswortZeigen((z) => !z)}>
                <IonIcon icon={passwortZeigen ? ICON_VERBORGEN : ICON_SICHTBAR} slot="start" />
                {passwortZeigen ? 'Passwort verbergen' : 'Passwort zeigen'}
              </IonButton>
            </div>
            <IonButton expand="block" onClick={() => { void anlegen(); }} disabled={legtAn || !isOnline}>
              <IonIcon icon={ICON_HINZUFUEGEN} slot="start" />
              Gemeinde anlegen
            </IonButton>
          </Abschnitt>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite: im breiten Browserfenster die zweispaltige
// Web-Fassung, sonst die Darstellung der App. Beide nutzen useAnfrageDetail.
const SupportAnfrageDetailPage: React.FC<Props> = (props) => {
  const breit = useBreitesLayout();
  return (
    <NurSupport titel="Anfrage">
      {breit ? <WebAnfrageDetail anfrageId={props.anfrageId} /> : <AnfrageDetail {...props} />}
    </NurSupport>
  );
};

export default SupportAnfrageDetailPage;
