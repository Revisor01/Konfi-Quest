import { ICON_ZURUECK } from '../../shared/icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem,
  IonLabel, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  IonModal, IonInput, IonSelect, IonSelectOption, IonButtons,
  IonSegment, IonSegmentButton, useIonAlert,
  IonItemSliding, IonItemOptions, IonItemOption, IonListHeader,
  IonCard, IonCardContent
} from '@ionic/react';
// Solid-Icons wie in der Events-Liste (dort: people, calendar, trophy,
// pricetag) -- die Outline-Varianten wichen hier als einzige Liste ab.
import { addOutline, closeOutline, checkmarkOutline, sparklesOutline, calendarOutline, trash, people, sparkles, school, calendar, checkmarkCircle, eye } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';
import { SectionHeader, EmptyState } from '../../shared';
import { closeOpenSlidingItems } from '../../../utils/slidingItems';

/**
 * Die Rueckblick-Ausgaben verwalten.
 *
 * SIMONS VORGABE (03.09.2026): "Volle Flexibilitaet fuer Wrapped. Damit man
 * etwa auch einen Zwischenstand mit Titel machen kann." Und: "Es gibt keine
 * Admin-Sektionen, um sie freizugeben, zu benennen, zu loeschen."
 *
 * WARUM EINE EIGENE SEITE STATT DES SCHALTERS IM JAHRGANG: Der Schalter dort
 * konnte nur EINEN Zustand abbilden -- an oder aus. Mit mehreren Ausgaben je
 * Jahrgang ("Dein erstes Jahr", "Zwischenstand", "Dein Abschluss") passt das
 * nicht mehr: Ein Schalter kann keine drei benannten Ausgaben verwalten.
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

const AdminWrappedPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const [zeigeAlert] = useIonAlert();

  // Fuer die Card-Modal-Optik (Sheet ueber der zurueckweichenden Seite),
  // wie auf den uebrigen Admin-Seiten.
  const pageRef = useRef<HTMLElement>(null);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [segment, setSegment] = useState<'konfi' | 'teamer'>('konfi');

  const [modalOffen, setModalOffen] = useState(false);
  const [neuerTitel, setNeuerTitel] = useState('');
  const [neuerJahrgang, setNeuerJahrgang] = useState<number | null>(null);
  const [erzeugt, setErzeugt] = useState(false);

  // super_admins tragen role_name 'org_admin' -- dieselbe Pruefung wie im
  // Backend, damit die Oberflaeche nicht mehr verspricht als die Route haelt.
  const istLeitung = user?.role_name === 'org_admin' || user?.is_super_admin === true;

  const laden = useCallback(async () => {
    try {
      const [a, j] = await Promise.all([
        api.get('/wrapped/ausgaben'),
        api.get('/admin/jahrgaenge').catch(() => ({ data: [] })),
      ]);
      setAusgaben(Array.isArray(a.data) ? a.data : []);
      setJahrgaenge(Array.isArray(j.data) ? j.data : []);
    } catch {
      setError('Rückblicke konnten nicht geladen werden');
    } finally {
      setLaedt(false);
    }
  }, [setError]);

  useEffect(() => { laden(); }, [laden]);
  useEffect(() => { setPresentingElement(pageRef.current); }, []);

  const erzeugen = async () => {
    if (segment === 'konfi' && !neuerJahrgang) {
      setError('Bitte einen Jahrgang wählen');
      return;
    }
    setErzeugt(true);
    try {
      const titel = neuerTitel.trim();
      if (segment === 'konfi') {
        await api.post(`/wrapped/generate/${neuerJahrgang}`, titel ? { titel } : {});
      } else {
        await api.post('/wrapped/generate-teamer', titel ? { titel } : {});
      }
      setSuccess(titel ? `„${titel}" wurde erstellt und freigegeben` : 'Rückblick erstellt und freigegeben');
      setModalOffen(false);
      setNeuerTitel('');
      setNeuerJahrgang(null);
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
              <IonIcon icon={addOutline} slot="icon-only" />
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
          icon={sparklesOutline}
          colors={{ primary: 'var(--app-color-wrapped)', secondary: '#6d28d9' }}
          stats={[
            { value: sichtbar.length, label: sichtbar.length === 1 ? 'Ausgabe' : 'Ausgaben' },
            { value: sichtbar.filter(a => a.freigegeben).length, label: 'Freigegeben' },
            { value: sichtbar.reduce((summe, a) => summe + (a.snapshots || 0), 0), label: 'Rückblicke' },
          ]}
        />

        <div style={{ padding: '16px 16px 0' }}>
          <IonSegment value={segment} onIonChange={(e) => setSegment(e.detail.value as 'konfi' | 'teamer')}>
            <IonSegmentButton value="konfi">Konfis</IonSegmentButton>
            {/* Teamer-Ausgaben betreffen die ganze Gemeinde -- nur die Leitung. */}
            <IonSegmentButton value="teamer" disabled={!istLeitung}>Teamer:innen</IonSegmentButton>
          </IonSegment>
        </div>

        {laedt ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
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
                <IonIcon icon={sparklesOutline} />
              </div>
              <IonLabel>{segment === 'konfi' ? 'Konfis' : 'Team'}</IonLabel>
            </IonListHeader>
            <IonCard className="app-card">
              <IonCardContent>
                <EmptyState
                  icon={sparklesOutline}
                  title="Noch kein Rückblick"
                  // Beide Texte etwa gleich lang, damit der Leerzustand auf
                  // beiden Reitern gleich hoch steht (Simon, 05.09.2026).
                  // Der Team-Text richtet sich nach der Berechtigung: Das
                  // Plus ist fuer Admins ohne Leitungsrecht gesperrt, ein
                  // "lege einen an" waere dort eine Sackgasse.
                  message={segment === 'konfi'
                    ? 'Über das Plus oben legst du einen an — mit eigenem Namen, etwa „Zwischenstand" oder „Dein Abschluss".'
                    : istLeitung
                      ? 'Über das Plus oben legst du einen an — für alle Teamer:innen gemeinsam, mit eigenem Namen.'
                      : 'Für das Team ist noch keiner erstellt. Rückblicke für Teamer:innen legt die Leitung deiner Gemeinde an.'}
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
                <IonIcon icon={sparklesOutline} />
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
                  <IonItemSliding key={a.id} style={{ marginBottom: '8px' }}>
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
                              <IonIcon icon={eye} />
                            </div>
                          </div>
                        )}

                        <div className="app-list-item__row">
                          <div className="app-list-item__main">
                            <div className="app-icon-circle app-icon-circle--lg app-icon-circle--wrapped">
                              <IonIcon icon={a.typ === 'teamer' ? people : sparkles} />
                            </div>
                            <div className="app-list-item__content">
                              <div className="app-list-item__title" style={{ paddingRight: a.freigegeben ? '48px' : '0' }}>
                                {a.titel}
                              </div>
                              <div className="app-list-item__meta">
                                {/* Wie viele Rueckblicke in der Ausgabe stecken --
                                    gehoert in die Zeile, nicht in eine Ecke. */}
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={people} className="app-icon-color--participants" />
                                  {a.snapshots}
                                </span>
                                {a.jahrgang_name && (
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={school} className="app-icon-color--konfis" />
                                    {a.jahrgang_name}
                                  </span>
                                )}
                              </div>
                              <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                                <span className="app-list-item__meta-item">
                                  <IonIcon icon={calendar} className="app-icon-color--events" />
                                  {datum(a.zeitraum_start)} – {datum(a.zeitraum_ende)}
                                </span>
                              </div>
                              {a.freigegeben_at && (
                                <div className="app-list-item__meta" style={{ marginTop: '4px' }}>
                                  <span className="app-list-item__meta-item">
                                    <IonIcon icon={checkmarkCircle} className="app-icon-color--success" />
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
                          <IonIcon icon={trash} />
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
                  <IonIcon icon={closeOutline} slot="icon-only" />
                </IonButton>
              </IonButtons>
              <IonTitle>Neuer Rückblick</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={erzeugen} disabled={erzeugt} aria-label="Rückblick erstellen und freigeben">
                  {erzeugt ? <IonSpinner name="crescent" /> : <IonIcon icon={checkmarkOutline} slot="icon-only" />}
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="app-gradient-background">
            <IonList inset={true} className="app-segment-wrapper">
              <IonListHeader>
                <div className="app-section-icon app-section-icon--wrapped">
                  <IonIcon icon={sparklesOutline} />
                </div>
                <IonLabel>Grunddaten</IonLabel>
              </IonListHeader>
              <IonCard className="app-card">
                <IonCardContent className="app-card-content">
                  {/* Jahrgangs-Auswahl im Muster des Filters aus der
                      Konfi-Liste (Simons Hinweis 04.09.2026): Icon links per
                      slot="start", kein gestapeltes Label, Popover, volle
                      Breite. */}
                  {segment === 'konfi' && (
                    <IonItem lines="full" style={{ '--background': 'transparent' }}>
                      <IonIcon icon={calendarOutline} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
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
                  )}
                  <IonItem lines="none" style={{ '--background': 'transparent' }}>
                    <IonInput
                      label="Name"
                      labelPlacement="stacked"
                      placeholder="z. B. Zwischenstand"
                      value={neuerTitel}
                      maxlength={120}
                      onIonInput={(e) => setNeuerTitel(e.detail.value || '')}
                    />
                  </IonItem>
                  {/* Hinweis im gemeinsamen Muster statt als loser Absatz
                      (Simon, 05.09.2026). Der Satz "Ohne Namen schlagen wir
                      einen vor" ist raus: Er nannte den Vorschlag nicht und
                      liess offen, was passiert. */}
                  <div className="app-info-box app-info-box--blue" style={{ marginTop: 12, borderRadius: 12 }}>
                    Der Rückblick wird sofort erstellt und freigegeben; alle
                    bekommen eine Mitteilung. Frühere Ausgaben bleiben erhalten.
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
