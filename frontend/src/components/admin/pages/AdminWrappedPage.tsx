import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonList, IonItem,
  IonLabel, IonButton, IonIcon, IonSpinner, IonRefresher, IonRefresherContent,
  IonModal, IonInput, IonSelect, IonSelectOption, IonButtons, IonBadge,
  IonSegment, IonSegmentButton, useIonAlert
} from '@ionic/react';
import { addOutline, trashOutline, closeOutline, sparklesOutline, peopleOutline } from 'ionicons/icons';
import api from '../../../services/api';
import { useApp } from '../../../contexts/AppContext';

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
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Jahresrückblick</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setModalOffen(true)} disabled={!istLeitung && segment === 'teamer'}>
              <IonIcon icon={addOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="app-gradient-background">
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await laden(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>

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
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--app-text-sub-color, #8e8e93)' }}>
            <IonIcon icon={sparklesOutline} style={{ fontSize: '2.4rem', marginBottom: 12, opacity: 0.5 }} />
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {segment === 'konfi'
                ? 'Noch kein Rückblick erstellt. Über das Plus oben legst du einen an — mit eigenem Namen, etwa „Zwischenstand" oder „Dein Abschluss".'
                : 'Noch kein Teamer-Rückblick erstellt.'}
            </p>
          </div>
        ) : (
          <IonList style={{ background: 'transparent', padding: '8px 16px 24px' }}>
            {sichtbar.map((a) => (
              <IonItem
                key={a.id}
                className="app-list-item"
                style={{ '--background': 'var(--app-card-background, #fff)', marginBottom: 10, borderRadius: 14 }}
              >
                <div className="app-icon-circle app-icon-circle--lg" style={{ background: 'var(--app-color-wrapped, #7c3aed)' }}>
                  <IonIcon icon={a.typ === 'teamer' ? peopleOutline : sparklesOutline} style={{ color: '#fff' }} />
                </div>
                <IonLabel style={{ marginLeft: 12 }}>
                  <h2 style={{ fontWeight: 600, margin: 0 }}>{a.titel}</h2>
                  <p style={{ fontSize: '0.82rem', margin: '2px 0 0', whiteSpace: 'normal' }}>
                    {a.jahrgang_name ? `${a.jahrgang_name} · ` : ''}
                    {a.snapshots} {a.snapshots === 1 ? 'Rückblick' : 'Rückblicke'}
                    {a.freigegeben_at ? ` · freigegeben am ${datum(a.freigegeben_at)}` : ''}
                  </p>
                  <p style={{ fontSize: '0.78rem', margin: '2px 0 0', opacity: 0.7, whiteSpace: 'normal' }}>
                    Zeitraum {datum(a.zeitraum_start)} – {datum(a.zeitraum_ende)}
                  </p>
                </IonLabel>
                {a.freigegeben && (
                  <IonBadge slot="end" color="success" style={{ marginRight: 6 }}>sichtbar</IonBadge>
                )}
                <IonButton
                  slot="end"
                  fill="clear"
                  aria-label={`${a.titel} löschen`}
                  onClick={() => loeschen(a)}
                  style={{ '--color': 'var(--ion-color-danger)' }}
                >
                  <IonIcon icon={trashOutline} slot="icon-only" />
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}

        {/* Wer was darf -- die Regel steht in der Oberflaeche, nicht nur im
            Handbuch. Sonst raetselt ein Admin, warum er weniger sieht. */}
        <div style={{ padding: '0 20px 32px', fontSize: '0.78rem', color: 'var(--app-text-sub-color, #8e8e93)', lineHeight: 1.5 }}>
          {istLeitung
            ? 'Als Leitung siehst du alle Jahrgänge und die Rückblicke der Teamer:innen.'
            : 'Du siehst die Rückblicke deiner eigenen Jahrgänge. Teamer-Rückblicke verwaltet die Leitung.'}
        </div>

        <IonModal isOpen={modalOffen} onDidDismiss={() => setModalOffen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Neuer Rückblick</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setModalOffen(false)}>
                  <IonIcon icon={closeOutline} slot="icon-only" />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <IonList style={{ padding: 16 }}>
              {segment === 'konfi' && (
                <IonItem>
                  <IonSelect
                    label="Jahrgang"
                    labelPlacement="stacked"
                    placeholder="Jahrgang wählen"
                    value={neuerJahrgang}
                    onIonChange={(e) => setNeuerJahrgang(e.detail.value)}
                  >
                    {jahrgaenge.map(j => (
                      <IonSelectOption key={j.id} value={j.id}>{j.name}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
              <IonItem>
                <IonInput
                  label="Name"
                  labelPlacement="stacked"
                  placeholder="z. B. Zwischenstand"
                  value={neuerTitel}
                  maxlength={120}
                  onIonInput={(e) => setNeuerTitel(e.detail.value || '')}
                />
              </IonItem>
              <p style={{ padding: '4px 16px', fontSize: '0.8rem', color: 'var(--app-text-sub-color, #8e8e93)', lineHeight: 1.5 }}>
                Ohne Namen schlagen wir einen vor. Der Rückblick wird sofort
                erstellt und freigegeben; alle bekommen eine Mitteilung.
                Frühere Ausgaben bleiben erhalten.
              </p>
              <IonButton expand="block" onClick={erzeugen} disabled={erzeugt} style={{ marginTop: 8 }}>
                {erzeugt ? <IonSpinner name="crescent" /> : 'Erstellen und freigeben'}
              </IonButton>
            </IonList>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default AdminWrappedPage;
