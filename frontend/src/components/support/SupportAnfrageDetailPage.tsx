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

import React, { useCallback, useEffect, useState } from 'react';
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
  useIonAlert,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_BEARBEITEN,
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
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { AnfrageAngelegt, AnfrageStatus, GemeindeAnfrage, Kirchenkreis, Landeskirche } from '../../types/support';
import {
  ANFRAGE_STATUS,
  STATUS_VON_HAND,
  TESTPHASE_KONFIS,
  TESTPHASE_TAGE,
  anlegenFehler,
  anlegenKoerper,
  anlegenVorbelegen,
  kirchenkreisFinden,
  landeskircheFinden,
  testphaseUmschalten,
  type AnlegenFormular,
} from '../../utils/supportAnfragen';
import { fehlerText } from '../../utils/fehler';
import { offlineBlockiert } from '../../utils/offlineAktion';
import { generateStrongPassword } from '../../utils/passwortVorschlag';
import { datumUhrzeit } from '../../utils/dateUtils';
import { Abschnitt, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';

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
  const { setError, setSuccess, isOnline } = useApp();
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();
  const zurueck = useSupportZurueck('/admin/support/anfragen');

  const [anfrage, setAnfrage] = useState<GemeindeAnfrage | null>(null);
  const [kirchenkreise, setKirchenkreise] = useState<Kirchenkreis[]>([]);
  const [landeskirchen, setLandeskirchen] = useState<Landeskirche[]>([]);
  const [strukturFehlt, setStrukturFehlt] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);

  // Bearbeitung
  const [status, setStatus] = useState<AnfrageStatus>('neu');
  const [notiz, setNotiz] = useState('');
  const [speichert, setSpeichert] = useState(false);

  // Gemeinde anlegen
  const [formular, setFormular] = useState<AnlegenFormular | null>(null);
  const [passwortZeigen, setPasswortZeigen] = useState(false);
  const [legtAn, setLegtAn] = useState(false);
  const [angelegt, setAngelegt] = useState<(AnfrageAngelegt & { username: string }) | null>(null);

  const strukturLaden = useCallback(async (): Promise<Kirchenkreis[]> => {
    const [kk, lk] = await Promise.allSettled([
      api.get('/support/kirchenkreise'),
      api.get('/support/landeskirchen'),
    ]);
    const kreise = kk.status === 'fulfilled' && Array.isArray(kk.value.data) ? kk.value.data : [];
    setKirchenkreise(kreise);
    setLandeskirchen(lk.status === 'fulfilled' && Array.isArray(lk.value.data) ? lk.value.data : []);
    setStrukturFehlt(kk.status !== 'fulfilled');
    return kreise;
  }, []);

  // Erst warten, dann Zustand setzen (der erste Abruf laeuft im Effekt).
  const holen = useCallback(async () => {
    try {
      const [antwort, kreise] = await Promise.all([
        api.get('/support/anfragen'),
        strukturLaden(),
      ]);
      const gefunden = (Array.isArray(antwort.data) ? antwort.data : []).find((a) => a.id === anfrageId) ?? null;
      setAnfrage(gefunden);
      if (gefunden) {
        setStatus(gefunden.status);
        setNotiz(gefunden.notiz ?? '');
        setFormular((vorher) => vorher ?? anlegenVorbelegen(gefunden, kreise));
      }
      setFehler(false);
    } catch {
      setAnfrage(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, [anfrageId, strukturLaden]);

  useEffect(() => { void holen(); }, [holen]);

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return holen();
  };

  const aendern = (teil: Partial<AnlegenFormular>) => setFormular((f) => (f ? { ...f, ...teil } : f));

  const bearbeitungSpeichern = async () => {
    if (!anfrage || offlineBlockiert(isOnline, setError)) return;
    setSpeichert(true);
    try {
      const koerper: { status?: AnfrageStatus; notiz: string | null } = { notiz: notiz.trim() || null };
      if (status !== anfrage.status) koerper.status = status;
      const antwort = await api.patch(`/support/anfragen/${anfrage.id}`, koerper);
      const neu = antwort.data && typeof antwort.data === 'object' ? { ...anfrage, ...antwort.data } : { ...anfrage, ...koerper };
      setAnfrage(neu);
      setStatus(neu.status);
      setNotiz(neu.notiz ?? '');
      setSuccess('Anfrage gespeichert');
    } catch (err) {
      setError(fehlerText(err, 'Anfrage konnte nicht gespeichert werden'));
    } finally {
      setSpeichert(false);
    }
  };

  // Steht der Kirchenkreis der Anfrage noch nicht in der Struktur, legt ihn
  // ein Schritt an (mit der Landeskirche, wenn es sie schon gibt) und waehlt
  // ihn aus.
  const kirchenkreisAnlegen = async () => {
    if (!anfrage?.kirchenkreis || offlineBlockiert(isOnline, setError)) return;
    try {
      const lk = landeskircheFinden(anfrage.landeskirche, landeskirchen);
      await api.post('/support/kirchenkreise', { name: anfrage.kirchenkreis.trim(), landeskirche_id: lk ? lk.id : null });
      const kreise = await strukturLaden();
      const neu = kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kreise);
      if (neu) aendern({ kirchenkreisId: neu.id });
      setSuccess('Kirchenkreis angelegt');
    } catch (err) {
      setError(fehlerText(err, 'Kirchenkreis konnte nicht angelegt werden'));
    }
  };

  const anlegen = async () => {
    if (!anfrage || !formular || offlineBlockiert(isOnline, setError)) return;
    const meldung = anlegenFehler(formular);
    if (meldung) {
      setError(meldung);
      return;
    }
    const koerper = anlegenKoerper(formular);
    presentAlert({
      header: 'Gemeinde anlegen',
      message: `„${koerper.display_name}“ mit der Gemeindeleitung „${koerper.admin_display_name}“ (${koerper.admin_username}) anlegen?`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Anlegen',
          handler: () => {
            void (async () => {
              setLegtAn(true);
              try {
                const antwort = await api.post(`/support/anfragen/${anfrage.id}/anlegen`, koerper);
                setAngelegt({ ...antwort.data, username: koerper.admin_username });
                setAnfrage({ ...anfrage, status: 'angelegt', organization_id: antwort.data?.organization_id ?? null });
                setStatus('angelegt');
                setSuccess('Gemeinde angelegt');
              } catch (err) {
                setError(fehlerText(err, 'Gemeinde konnte nicht angelegt werden'));
              } finally {
                setLegtAn(false);
              }
            })();
          },
        },
      ],
    });
  };

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

  const statusInfo = ANFRAGE_STATUS[anfrage.status] ?? ANFRAGE_STATUS.neu;
  const gemeindeId = angelegt?.organization_id ?? anfrage.organization_id;
  const kkGefunden = kirchenkreisFinden(anfrage.kirchenkreis, anfrage.landeskirche, kirchenkreise);
  const geaendert = status !== anfrage.status || (notiz.trim() || null) !== (anfrage.notiz?.trim() || null);
  const gewaehlterKreis = formular ? kirchenkreise.find((k) => k.id === formular.kirchenkreisId) : undefined;

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
          <Angabe icon={ICON_TEXTDOKUMENT} label="Nachricht">
            <span style={{ whiteSpace: 'pre-wrap' }}>{anfrage.nachricht || '–'}</span>
          </Angabe>
          <Angabe icon={ICON_UHRZEIT} label="Eingegangen">
            {datumUhrzeit(anfrage.created_at)}
            {anfrage.updated_at && anfrage.updated_at !== anfrage.created_at ? ` · zuletzt geändert ${datumUhrzeit(anfrage.updated_at)}` : ''}
          </Angabe>
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
              <Feld
                label="Konfi-Limit"
                typ="number"
                wert={formular.maxKonfis}
                onWert={(w) => aendern({ maxKonfis: w })}
                hinweis={`In der Testphase ${TESTPHASE_KONFIS}, ohne Testphase leer = unbegrenzt. Tarife wie 15, 50, 75 oder 100 gehen auch.`}
              />
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonToggle
                  aria-label={`Testphase (${TESTPHASE_TAGE} Tage)`}
                  checked={formular.testphase}
                  onIonChange={(e) => {
                    const an = e.detail.checked;
                    setFormular((f) => (f ? testphaseUmschalten(f, an) : f));
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

const SupportAnfrageDetailPage: React.FC<Props> = (props) => (
  <NurSupport titel="Anfrage"><AnfrageDetail {...props} /></NurSupport>
);

export default SupportAnfrageDetailPage;
