import {
  ICON_FUNKELN,
  ICON_FUNKELN_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_HAKEN,
  ICON_HINZUFUEGEN,
  ICON_JAHRGANG_GEFUELLT,
  ICON_LOESCHEN_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_SICHTBAR_GEFUELLT,
  ICON_TERMIN,
  ICON_TERMIN_GEFUELLT,
  ICON_ZURUECK,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem,
  IonLabel, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  IonModal, IonSelect, IonSelectOption, IonInput, IonButtons,
  IonSegment, IonSegmentButton, useIonAlert,
  IonItemSliding, IonItemOptions, IonItemOption, IonListHeader,
  IonCard, IonCardContent
} from '@ionic/react';
// Solid-Icons wie in der Events-Liste (dort: people, calendar, trophy,
// pricetag) -- die Outline-Varianten wichen hier als einzige Liste ab.
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { SectionHeader, EmptyState } from '../../shared';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';

/**
 * Die Rueckblick-Ausgaben verwalten.
 *
 * SIMONS VORGABE (07.09.2026), woertlich: "wir lassen das mit dem Datum. Wir
 * machen einfach immer Konfi bis jetzt von Beginn und Teamer der Rueckblick
 * des Jahres. Also immer zurueck auf den 1.1. des Jahres. Sonst ist das zu
 * kompliziert mit den rueckblicken. Dann braucht es auch keine Titel."
 *
 * DAS FORMULAR IST DAMIT FAST LEER, und das ist der Punkt:
 *   Konfi -> nur den Jahrgang waehlen, dazu einen Namen (vorgeschlagen).
 *            Gerechnet wird vom Beginn der Konfi-Zeit bis heute.
 *   Team  -> nur das Jahr waehlen. Gerechnet wird vom 1.1. bis 31.12.
 * Keine Datumsfelder. Was frueher einzustellen war, konnte man falsch
 * einstellen; jetzt gibt es nichts mehr falsch zu machen.
 *
 * DER NAME kam am 08.09.2026 zurueck (Simon: "Sonst wird es bei drei
 * Rueckblicken unuebersichtlich."). Er beschriftet nur -- er rechnet nichts,
 * anders als der abgeschaffte Zeitraum.
 *
 * WARUM EINE EIGENE SEITE STATT DES SCHALTERS IM JAHRGANG: Der Schalter dort
 * konnte nur EINEN Zustand abbilden -- an oder aus. Ein Jahrgang bekommt aber
 * mehrere Ausgaben (Zwischenstand und Abschluss), und ein Schalter kann die
 * nicht verwalten.
 *
 * RECHTE (Simons Regel):
 *   Admin      -> nur Jahrgaenge mit eigener Zuweisung
 *   org_admin  -> alle Jahrgaenge UND die Teamer-Ausgaben
 * Das Backend setzt das durch (GET/DELETE pruefen die Zuweisung); die
 * Oberflaeche zeigt nur, was zurueckkommt.
 */

interface Ausgabe {
  id: number;
  typ: 'konfi' | 'teamer';
  jahrgang_id: number | null;
  jahrgang_name: string | null;
  titel: string;
  zeitraum_start: string;
  zeitraum_ende: string;
  freigegeben: boolean;
  freigegeben_at: string | null;
  snapshots: number;
  created_at: string;
}

interface Jahrgang {
  id: number;
  name: string;
}

const datum = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

/**
 * Die waehlbaren Jahre fuer einen TEAM-Rueckblick.
 *
 * SIMONS REGEL (07.09.2026): Der Team-Rueckblick ist immer ein volles
 * Kalenderjahr. Das LAUFENDE Jahr steht deshalb sichtbar in der Liste, ist
 * aber gesperrt -- es ist noch nicht vorbei, es gibt darauf noch nichts
 * zurueckzublicken.
 *
 * WARUM SICHTBAR UND NICHT WEGGELASSEN: Wer im November 2026 nach "2026"
 * sucht und es nicht findet, haelt das fuer einen Fehler. Steht es da mit
 * dem Hinweis "verfuegbar ab 1.1.2027", ist die Regel in dem Moment erklaert,
 * in dem sie jemanden betrifft.
 *
 * Zurueck reichen fuenf Jahre. Weiter zurueck gibt es keine Daten, die einen
 * Rueckblick truegen -- und eine Liste, die bis 2019 laeuft, ist keine Hilfe.
 */
// Die Jahre kommen seit dem 08.09.2026 vom Server (GET /wrapped/team-jahre).
// Vorher rechnete diese Datei fuenf Jahre zurueck, ohne zu wissen, ob es dort
// etwas gibt -- Simon: "Es sollen nur Teamer Jahre angezeigt werden die auch
// geliefert werden koennen. Wenn es aus 2023 nichts gibt brauchen wir auch
// kein Teamer Jahr." In Kirchspiel West beginnen die Daten 2026; vier der
// fuenf Jahre waeren leer gewesen.
type TeamJahr = { jahr: number; gesperrt: boolean };

const AdminWrappedPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const [zeigeAlert] = useIonAlert();

  // Fuer die Card-Modal-Optik (Sheet ueber der zurueckweichenden Seite),
  // wie auf den uebrigen Admin-Seiten.
  const pageRef = useRef<HTMLElement>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  // Admin ohne Jahrgangs-Zuweisung: Die Liste bleibt leer, weil er nichts
  // sehen DARF -- nicht, weil es nichts gibt. Ohne diesen Unterschied liest
  // er "lege einen an" und landet in einer Sackgasse (Simon, 31.08.2026).
  const [ohneJahrgang, setOhneJahrgang] = useState(false);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [segment, setSegment] = useState<'konfi' | 'teamer'>('konfi');

  const [modalOffen, setModalOffen] = useState(false);
  const [neuerJahrgang, setNeuerJahrgang] = useState<number | null>(null);
  // Das Jahr des TEAM-Rueckblicks. Vorbelegt mit dem zuletzt abgeschlossenen
  // Jahr -- dem einzigen, das die Leitung am 1. Januar ueberhaupt meinen
  // kann, und demselben, das der automatische Lauf am 6.1. nimmt.
  const [neuesJahr, setNeuesJahr] = useState<number>(new Date().getFullYear() - 1);
  const [teamJahre, setTeamJahre] = useState<TeamJahr[]>([]);
  // Name der Ausgabe (Simon, 08.09.2026): "Ich glaube es waere gut wenn man
  // den Rueckblicken bei Konfis doch Namen geben koennte und die dynamisch
  // aufgenommen werden auf die Folie. Sonst wird es bei drei Rueckblicken
  // unuebersichtlich." Vorbelegt, damit bei drei Ausgaben keine drei
  // namenlosen Eintraege stehen -- ueberschreibbar.
  const [neuerName, setNeuerName] = useState('');

  // Vorschlag fuer den Namen: "Zwischenstand" beim ersten, danach
  // durchnummeriert. Erst der zweite Rueckblick macht die Namen noetig --
  // bis dahin ist ohnehin klar, welcher gemeint ist.
  const namensVorschlag = React.useMemo(() => {
    if (!neuerJahrgang) return 'Zwischenstand';
    const bisher = ausgaben.filter(a => a.typ === 'konfi' && a.jahrgang_id === neuerJahrgang).length;
    return bisher === 0 ? 'Zwischenstand' : `Zwischenstand ${bisher + 1}`;
  }, [neuerJahrgang, ausgaben]);
  const [erzeugt, setErzeugt] = useState(false);

  // super_admins tragen role_name 'org_admin' -- dieselbe Pruefung wie im
  // Backend, damit die Oberflaeche nicht mehr verspricht als die Route haelt.
  const istLeitung = user?.role_name === 'org_admin' || user?.is_super_admin === true;

  const laden = useCallback(async () => {
    try {
      // team-jahre nur fuer die Leitung -- Admins duerfen keine
      // Team-Rueckblicke anlegen und bekaemen dort 403.
      const [a, j, tj] = await Promise.all([
        api.get('/wrapped/ausgaben'),
        api.get('/admin/jahrgaenge').catch(() => ({ data: [] })),
        istLeitung ? api.get('/wrapped/team-jahre').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setAusgaben(Array.isArray(a.data) ? a.data : []);
      setOhneJahrgang(a.headers?.['x-kein-jahrgang-zugewiesen'] === 'true');
      setJahrgaenge(Array.isArray(j.data) ? j.data : []);
      setTeamJahre(Array.isArray(tj.data) ? tj.data : []);
    } catch {
      setError('Rückblicke konnten nicht geladen werden');
    } finally {
      setLaedt(false);
    }
  }, [setError, istLeitung]);

  useEffect(() => { laden(); }, [laden]);
  useEffect(() => { setPresentingElement(pageRef.current); }, []);

  const erzeugen = async () => {
    if (segment === 'konfi' && !neuerJahrgang) {
      setError('Bitte einen Jahrgang wählen');
      return;
    }
    setErzeugt(true);
    try {
      // KEIN RUMPF MEHR beim Konfi-Rueckblick: kein Titel, kein Zeitraum.
      // Das Backend rechnet vom Beginn der Konfi-Zeit bis heute.
      // Beim Team geht nur das JAHR mit -- gerechnet wird 1.1. bis 31.12.
      if (segment === 'konfi') {
        // Ohne Eingabe der Vorschlag -- ein leerer Name hilft niemandem.
        const titel = (neuerName.trim() || namensVorschlag).slice(0, 40);
        await api.post(`/wrapped/generate/${neuerJahrgang}`, { titel });
        setSuccess('Rückblick erstellt und freigegeben');
      } else {
        // `benachrichtigt: false` heisst beim Team: Das Jahr stand schon da,
        // es ist NICHTS passiert. Ohne diese Unterscheidung meldete die Seite
        // "erstellt und freigegeben", obwohl sie nur die alte Ausgabe
        // wiedergefunden hat -- und die Leitung haette geglaubt, ihr Team sei
        // gerade benachrichtigt worden.
        const { data } = await api.post('/wrapped/generate-teamer', { jahr: neuesJahr });
        setSuccess(data?.benachrichtigt === false
          ? `Teamerjahr ${neuesJahr} bestand schon — es wurde nichts geändert`
          : `Teamerjahr ${neuesJahr} erstellt und freigegeben`);
      }
      setModalOffen(false);
      setNeuerJahrgang(null);
      setNeuerName('');
      await laden();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Rückblick konnte nicht erstellt werden');
    } finally {
      setErzeugt(false);
    }
  };

  const loeschen = (a: Ausgabe) => {
    zeigeAlert({
      header: 'Ausgabe löschen?',
      // Deutlich sagen, was verschwindet -- ein Rueckblick ist eine
      // Erinnerung, kein Datensatz.
      message: `„${a.titel}" und die ${a.snapshots} Rückblicke darin werden gelöscht. Andere Ausgaben bleiben bestehen.`,
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/wrapped/ausgabe/${a.id}`);
              setSuccess('Ausgabe gelöscht');
              await laden();
            } catch (e) {
              const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
              setError(msg || 'Löschen fehlgeschlagen');
            }
          },
        },
      ],
    });
  };

  const sichtbar = ausgaben.filter(a => a.typ === segment);

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          {/* Zurueck-Knopf und grosser Titel beim Hochscrollen fehlten hier
              als einziger Admin-Seite (Simons Hinweis 03.09.2026) -- die
              Seite hing ohne Rueckweg da. Gleicher Aufbau wie
              AdminMaterialPage und die uebrigen Seiten. */}
          <IonButtons slot="start">
            <IonButton aria-label="Zurück" onClick={() => window.history.back()}>
              <IonIcon icon={ICON_ZURUECK} />
            </IonButton>
          </IonButtons>
          <IonTitle>Jahresrückblick</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Neuen Rückblick anlegen" onClick={() => setModalOffen(true)} disabled={!istLeitung && segment === 'teamer'}>
              <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background" fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar className="app-condense-toolbar">
            <IonTitle size="large">Jahresrückblick</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await laden(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Stats-Kopf wie auf jeder anderen Seite: Wie viele Ausgaben gibt es,
            wie viele sind freigegeben, wie viele Rueckblicke stecken darin. */}
        <SectionHeader
          title="Jahresrückblick"
          subtitle="Ausgaben verwalten"
          icon={ICON_FUNKELN}
          colors={{ primary: 'var(--app-color-wrapped)', secondary: 'var(--app-color-wrapped-dunkel)' }}
          stats={[
            { value: sichtbar.length, label: sichtbar.length === 1 ? 'Ausgabe' : 'Ausgaben' },
            { value: sichtbar.filter(a => a.freigegeben).length, label: 'Freigegeben' },
            { value: sichtbar.reduce((summe, a) => summe + (a.snapshots || 0), 0), label: 'Rückblicke' },
          ]}
        />

        <div style={{ padding: 'var(--app-abstand-basis) var(--app-abstand-basis) 0' }}>
          <IonSegment value={segment} onIonChange={(e) => setSegment(e.detail.value as 'konfi' | 'teamer')}>
            <IonSegmentButton value="konfi">Konfis</IonSegmentButton>
            {/* Teamer-Ausgaben betreffen die ganze Gemeinde -- nur die Leitung. */}
            <IonSegmentButton value="teamer" disabled={!istLeitung}>Team</IonSegmentButton>
          </IonSegment>
        </div>

        {laedt ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--app-abstand-block)' }}>
            <IonSpinner name="crescent" />
          </div>
        ) : sichtbar.length === 0 ? (
          // Leerzustand im Muster aller anderen Seiten (Simon, 04.09.2026):
          // die geteilte EmptyState-Komponente in einer weissen Karte, mit
          // farbigem Icon -- vorher stand hier ein selbstgebauter grauer
          // Block ohne Karte.
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--wrapped">
                <IonIcon icon={ICON_FUNKELN} />
              </div>
              <IonLabel>{segment === 'konfi' ? 'Konfis' : 'Team'}</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <EmptyState
                  icon={ICON_FUNKELN}
                  title={ohneJahrgang ? 'Kein Jahrgang zugewiesen' : 'Noch kein Rückblick'}
                  // Beide Texte etwa gleich lang, damit der Leerzustand auf
                  // beiden Reitern gleich hoch steht (Simon, 05.09.2026).
                  // Der Team-Text richtet sich nach der Berechtigung: Das
                  // Plus ist fuer Admins ohne Leitungsrecht gesperrt, ein
                  // "lege einen an" waere dort eine Sackgasse.
                  // Der Zeitraum ist am 07.09. entfallen; der Name kam am
                  // 08.09. zurueck. Er wird beim Anlegen vorgeschlagen und
                  // muss hier nicht beworben werden.
                  message={ohneJahrgang
                    // Derselbe Wortlaut wie in der Konfi-Liste
                    // (KonfisView.tsx): Es GIBT Rückblicke, dieser Zugang
                    // darf sie nur nicht sehen.
                    ? 'Dir ist noch kein Jahrgang zugewiesen. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern.'
                    : segment === 'konfi'
                      ? 'Über das Plus oben legst du einen an — du wählst nur den Jahrgang, alles andere steht fest.'
                      : istLeitung
                        ? 'Über das Plus oben legst du einen an — fürs ganze Team gemeinsam, du wählst nur das Jahr.'
                        : 'Für das Team ist noch keiner erstellt. Rückblicke fürs Team legt die Leitung deiner Gemeinde an.'}
                  iconColor="var(--app-color-wrapped)"
                />
              </IonCardContent>
            </IonCard>
          </IonList>
        ) : (
          // Karten-Muster wie auf jeder anderen Seite (Simons Hinweis
          // 04.09.2026: "Listenelemente gehoeren in einen Card-Container wie
          // bei allen anderen"): IonList inset -> IonListHeader ->
          // IonCard.app-card -> IonCardContent. Vorher lag die Liste
          // freistehend auf transparentem Grund.
          <IonList inset={true} className="app-segment-wrapper">
            <IonListHeader>
              <div className="app-section-icon app-section-icon--wrapped">
                <IonIcon icon={ICON_FUNKELN} />
              </div>
              <IonLabel>{segment === 'konfi' ? 'Konfis' : 'Team'} ({sichtbar.length})</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent className="app-card-content">
                {sichtbar.map((a) => (
                  // UNSER Listen-Muster (app-list-item), nicht selbstgebaut:
                  // Farbstreifen links, Icon im farbigen Kreis, Corner-Badge oben
                  // rechts, Meta-Zeile mit farbigen Icons -- wie bei Events,
                  // Chats und der Punkte-Historie.
                  //
                  // Geloescht wird per Wischen (Simons Hinweis 03.09.2026), nicht
                  // ueber einen Knopf in der Zeile: Ein Loeschknopf direkt neben
                  // dem Titel trifft man zu leicht, und ueberall sonst in der App
                  // liegt das Loeschen unter der Wischgeste.
                  //
                  // Icons und Farben folgen der Events-Liste: Solid-Varianten mit
                  // den app-icon-color--*-Klassen, keine Inline-Farben und keine
                  // Outline-Icons -- vorher wich diese Liste als einzige ab.
                  <IonItemSliding key={a.id} style={{ marginBottom: 'var(--app-abstand-eng)' }}>
                    <IonItem
                      detail={false}
                      lines="none"
                      style={{
                        '--background': 'transparent',
                        '--padding-start': '0',
                        '--padding-end': '0',
                        '--inner-padding-end': '0',
                        '--inner-border-width': '0',
                        '--border-style': 'none',
                        '--min-height': 'auto'
                      }}
                    >
                      <div
                        className="app-list-item app-list-item--wrapped"
                        style={{ width: '100%', position: 'relative', overflow: 'hidden' }}
                      >
                        {a.freigegeben && (
                          <div className="app-corner-badges">
                            <div
                              className="app-corner-badge"
                              style={{ backgroundColor: 'var(--app-color-success)' }}
                              title="Freigegeben"
                            >
                              <IonIcon icon={ICON_SICHTBAR_GEFUELLT} />
                            </div>
                          </div>
                        )}

                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--wrapped">
                              <IonIcon icon={a.typ === 'teamer' ? ICON_GRUPPE_GEFUELLT : ICON_FUNKELN_GEFUELLT} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: a.freigegeben ? 'var(--app-abstand-block)' : '0' }}>
                                {a.titel}
                              </div>
                              <div className="app-list-item__meta">
                                {/* Wie viele Rueckblicke in der Ausgabe stecken --
                                    gehoert in die Zeile, nicht in eine Ecke. */}
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={ICON_GRUPPE_GEFUELLT} className="app-icon-color--participants" />
                                  {a.snapshots}
                                </span>
                                {a.jahrgang_name && (
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={ICON_JAHRGANG_GEFUELLT} className="app-icon-color--konfis" />
                                    {a.jahrgang_name}
                                  </span>
                                )}
                              </div>
                              <div className="app-list-item__meta" style={{ marginTop: 'var(--app-abstand-mini)' }}>
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={ICON_TERMIN_GEFUELLT} className="app-icon-color--events" />
                                  {datum(a.zeitraum_start)} – {datum(a.zeitraum_ende)}
                                </span>
                              </div>
                              {a.freigegeben_at && (
                                <div className="app-list-item__meta" style={{ marginTop: 'var(--app-abstand-mini)' }}>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={ICON_ZUSAGE_GEFUELLT} className="app-icon-color--success" />
                                    freigegeben {datum(a.freigegeben_at)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </IonItem>

                    <IonItemOptions side="end" className="app-swipe-actions">
                      <IonItemOption
                        onClick={() => { closeOpenSlidingItems(); loeschen(a); }}
                        aria-label={`${a.titel} löschen`}
                        className="app-swipe-action"
                      >
                        <div className="app-icon-circle app-icon-circle--lg app-icon-circle--danger">
                          <IonIcon icon={ICON_LOESCHEN_GEFUELLT} />
                        </div>
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                ))}
              </IonCardContent>
            </IonCard>
          </IonList>
        )}

        {/* Card-Modal wie ueberall sonst (Simons Hinweis 03.09.2026):
            presentingElement gibt die Sheet-Optik mit der zurueckweichenden
            Seite dahinter -- vorher lag das Modal ohne diesen Effekt ueber
            der Seite. Aufbau innen wie MaterialFormModal: Schliessen links,
            Speichern-Haken rechts, IonListHeader mit Section-Icon je
            Abschnitt, Felder in einer app-card. */}
        <IonModal
          isOpen={modalOffen}
          onDidDismiss={() => setModalOffen(false)}
          presentingElement={presentingElement || undefined}
        >
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => setModalOffen(false)} aria-label="Schließen">
                  <IonIcon icon={ICON_SCHLIESSEN} slot="icon-only" />
                </IonButton>
              </IonButtons>
              <IonTitle>Neuer Rückblick</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={erzeugen} disabled={erzeugt} aria-label="Rückblick erstellen und freigeben">
                  {erzeugt ? <IonSpinner name="crescent" /> : <IonIcon icon={ICON_HAKEN} slot="icon-only" />}
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="app-gradient-background">
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--wrapped">
                  <IonIcon icon={ICON_FUNKELN} />
                </div>
                <IonLabel>Grunddaten</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  {/* Jahrgangs-Auswahl im Muster des Filters aus der
                      Konfi-Liste (Simons Hinweis 04.09.2026): Icon links per
                      slot="start", kein gestapeltes Label, Popover, volle
                      Breite. */}
                  {segment === 'konfi' ? (
                    <>
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonIcon icon={ICON_TERMIN} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
                      <IonSelect
                        placeholder="Jahrgang"
                        interface="popover"
                        style={{ width: '100%' }}
                        value={neuerJahrgang}
                        onIonChange={(e) => setNeuerJahrgang(e.detail.value)}
                      >
                        {jahrgaenge.map(j => (
                          <IonSelectOption key={j.id} value={j.id}>{j.name}</IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                    {/* NAME der Ausgabe (Simon, 08.09.2026). Vorbelegt mit
                        einem Vorschlag, damit bei drei Ausgaben nicht drei
                        namenlose Eintraege stehen -- ueberschreibbar. Er
                        erscheint in der Liste UND auf der Begruessungsfolie. */}
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonIcon icon={ICON_FUNKELN} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
                      <IonInput
                        label="Name"
                        labelPlacement="floating"
                        placeholder={namensVorschlag}
                        value={neuerName}
                        maxlength={40}
                        onIonInput={(e: CustomEvent) => setNeuerName(String(e.detail.value ?? ''))}
                      />
                    </IonItem>
                    </>
                  ) : (
                    /* Nur das JAHR (Simon, 07.09.2026). Das laufende Jahr
                       steht sichtbar in der Liste, aber gesperrt -- mit dem
                       Hinweis, ab wann es geht. */
                    <IonItem lines="none" style={{ '--background': 'transparent' }}>
                      <IonIcon icon={ICON_TERMIN} slot="start" style={{ color: 'var(--app-text-system)', fontSize: 'var(--app-text-standard)' }} />
                      {/* action-sheet statt popover (Simon, 08.09.2026: "Der
                          popup schliesst zu frueh ab man kann nicht lesen das
                          2027 erst spaeter verfuegbar ist"). Das Popover legt
                          sich eng an das Feld und schliesst beim ersten
                          Antippen -- der gesperrte Eintrag mit seinem Hinweis
                          war nicht zu lesen. Das Aktionsblatt kommt von
                          unten, zeigt alle Jahre untereinander und bleibt
                          offen, bis man abbricht oder ein waehlbares Jahr
                          antippt. */}
                      <IonSelect
                        placeholder="Jahr"
                        interface="action-sheet"
                        interfaceOptions={{ header: 'Welches Jahr?' }}
                        style={{ width: '100%' }}
                        value={neuesJahr}
                        onIonChange={(e) => setNeuesJahr(e.detail.value)}
                      >
                        {teamJahre.map(({ jahr, gesperrt }) => (
                          <IonSelectOption key={jahr} value={jahr} disabled={gesperrt}>
                            {gesperrt ? `${jahr} — verfügbar ab 1.1.${jahr + 1}` : String(jahr)}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </IonItem>
                  )}
                  {/* Was der Rueckblick umfasst -- ohne dass jemand etwas
                      einstellen muss. Simon ausdruecklich: "Das erklaeren wir
                      auch." */}
                  {/* EIN Hinweis statt zwei (Simon, 08.09.2026: "Die Hinweise
                      auf den modalen fuer wrapped jeweils auf einen Hinweis
                      zusammenfuegen."). */}
                  <div className="app-info-box app-info-box--wrapped" style={{ marginTop: 'var(--app-abstand-mittel)', borderRadius: 'var(--app-radius-karte)'}}>
                    {segment === 'konfi'
                      ? 'Gezählt wird die ganze Konfi-Zeit — vom Beginn bis zu diesem Moment. Der Rückblick wird sofort freigegeben, alle bekommen eine Mitteilung. Frühere Ausgaben bleiben erhalten.'
                      : 'Gezählt wird das ganze Kalenderjahr, vom 1. Januar bis zum 31. Dezember. Der Rückblick wird sofort freigegeben, alle bekommen eine Mitteilung.'}
                  </div>
                </IonCardContent>
              </IonCard>
            </IonList>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default AdminWrappedPage;
