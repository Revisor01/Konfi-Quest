// Struktur der Support-Ansicht, /admin/support/struktur (Web-Version,
// Entscheidung 3, 02.10.2026).
//
// "Gemeinde zuerst": Kirchenkreis und Landeskirche sind Zuordnungen an der
// Gemeinde, vor allem fuer die Statistik. Hier entstehen sie: Landeskirchen
// und Kirchenkreise anlegen, umbenennen, loeschen und einen Kirchenkreis einer
// Landeskirche zuordnen. Verwaltungsrechte fuer diese Ebenen gibt es nicht
// (E-26 entfaellt) -- es sind nur Namen und Zuordnungen.
//
// Eine Landeskirche mit Kirchenkreisen laesst sich nicht loeschen (der Server
// antwortet 409); das sagt die Seite vorher. Ein geloeschter Kirchenkreis
// nimmt seinen Gemeinden nur die Zuordnung.

import React from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_BEARBEITEN, ICON_HINZUFUEGEN, ICON_LOESCHEN, ICON_NETZWERK, ICON_ORT } from '../shared/icons';
import type { Kirchenkreis, Landeskirche } from '../../types/support';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { Abschnitt, Feld, Ladefehler, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { useStruktur } from './useStruktur';

const OHNE = 'ohne';

/** Auswahl einer Landeskirche (oder keiner). */
const LandeskircheWahl: React.FC<{
  label: string;
  landeskirchen: Landeskirche[];
  wert: number | null;
  onWert: (id: number | null) => void;
}> = ({ label, landeskirchen, wert, onWert }) => (
  <IonItem lines="full" style={{ '--background': 'transparent' }}>
    <IonLabel position="stacked">{label}</IonLabel>
    <IonSelect
      aria-label={label}
      interface="popover"
      value={wert ?? OHNE}
      onIonChange={(e) => onWert(e.detail.value === OHNE ? null : Number(e.detail.value))}
    >
      <IonSelectOption value={OHNE}>Ohne Landeskirche</IonSelectOption>
      {landeskirchen.map((l) => (
        <IonSelectOption key={l.id} value={l.id}>{l.name}</IonSelectOption>
      ))}
    </IonSelect>
  </IonItem>
);

const Zeilenknoepfe: React.FC<{ name: string; onBearbeiten: () => void; onLoeschen: () => void }> = ({ name, onBearbeiten, onLoeschen }) => (
  <div style={{ display: 'flex', gap: 'var(--app-abstand-mini)', flexShrink: 0 }}>
    <IonButton fill="clear" size="small" aria-label={`${name} bearbeiten`} onClick={onBearbeiten}>
      <IonIcon icon={ICON_BEARBEITEN} slot="icon-only" />
    </IonButton>
    <IonButton fill="clear" size="small" color="danger" aria-label={`${name} löschen`} onClick={onLoeschen}>
      <IonIcon icon={ICON_LOESCHEN} slot="icon-only" />
    </IonButton>
  </div>
);

const Struktur: React.FC = () => {
  const zurueck = useSupportZurueck(SUPPORT_START);
  const {
    landeskirchen, kirchenkreise, laedt, fehler, beschaeftigt, neueLk, setNeueLk, neuerKk, setNeuerKk, neuerKkLk, setNeuerKkLk,
    lkBearbeiten, setLkBearbeiten, kkBearbeiten, setKkBearbeiten, laden, landeskircheAnlegen, kirchenkreisAnlegen,
    landeskircheSpeichern, kirchenkreisSpeichern, landeskircheLoeschen, kirchenkreisLoeschen,
  } = useStruktur();

  const kreisZeile = (kk: Kirchenkreis) => (
    kkBearbeiten?.id === kk.id ? (
      <div key={kk.id} className="app-list-item app-list-item--users">
        <IonList style={{ background: 'transparent' }}>
          <Feld label="Name des Kirchenkreises" pflicht wert={kkBearbeiten.name}
            onWert={(w) => setKkBearbeiten({ ...kkBearbeiten, name: w })} />
          <LandeskircheWahl label="Landeskirche" landeskirchen={landeskirchen ?? []} wert={kkBearbeiten.landeskircheId}
            onWert={(id) => setKkBearbeiten({ ...kkBearbeiten, landeskircheId: id })} />
        </IonList>
        <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
          <IonButton size="small" onClick={() => { void kirchenkreisSpeichern(); }} disabled={beschaeftigt}>Speichern</IonButton>
          <IonButton size="small" fill="clear" onClick={() => setKkBearbeiten(null)}>Abbrechen</IonButton>
        </div>
      </div>
    ) : (
      <div key={kk.id} className="app-list-item app-list-item--users">
        <div className="app-list-item__row">
          <div className="app-list-item__main">
            <div className="app-list-item__content">
              <div className="app-list-item__title">{kk.name}</div>
            </div>
          </div>
          <Zeilenknoepfe
            name={kk.name}
            onBearbeiten={() => setKkBearbeiten({ id: kk.id, name: kk.name, landeskircheId: kk.landeskirche_id })}
            onLoeschen={() => kirchenkreisLoeschen(kk)}
          />
        </div>
      </div>
    )
  );

  const ohneLandeskirche = kirchenkreise.filter((k) => k.landeskirche_id == null);

  return (
    <IonPage>
      <AppKopfzeile titel="Struktur" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Struktur" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {laedt && !landeskirchen ? (
          <LoadingSpinner message="Struktur wird geladen..." />
        ) : fehler || !landeskirchen ? (
          <Ladefehler text="Landeskirchen und Kirchenkreise konnten nicht geladen werden." onErneut={() => { void laden(); }} />
        ) : (
          <>
            <Abschnitt icon={ICON_HINZUFUEGEN} titel="Neu anlegen" farbe="organizations">
              <IonList style={{ background: 'transparent' }}>
                <Feld label="Neue Landeskirche" wert={neueLk} onWert={setNeueLk} />
              </IonList>
              <IonButton size="small" onClick={() => { void landeskircheAnlegen(); }} disabled={beschaeftigt || !neueLk.trim()}>
                Landeskirche anlegen
              </IonButton>
              <IonList style={{ background: 'transparent', marginTop: 'var(--app-abstand-mittel)' }}>
                <Feld label="Neuer Kirchenkreis" wert={neuerKk} onWert={setNeuerKk} />
                <LandeskircheWahl label="Landeskirche des neuen Kirchenkreises" landeskirchen={landeskirchen} wert={neuerKkLk} onWert={setNeuerKkLk} />
              </IonList>
              <IonButton size="small" onClick={() => { void kirchenkreisAnlegen(); }} disabled={beschaeftigt || !neuerKk.trim()}>
                Kirchenkreis anlegen
              </IonButton>
            </Abschnitt>

            {landeskirchen.length === 0 && ohneLandeskirche.length === 0 && (
              <p style={{ margin: 'var(--app-abstand-basis)', color: 'var(--app-text-system)', textAlign: 'center' }}>
                Noch keine Landeskirchen und Kirchenkreise.
              </p>
            )}

            {landeskirchen.map((lk) => {
              const kreise = kirchenkreise.filter((k) => k.landeskirche_id === lk.id);
              return (
                <Abschnitt
                  key={lk.id}
                  icon={ICON_NETZWERK}
                  titel={lk.name}
                  farbe="organizations"
                  rechts={lkBearbeiten?.id === lk.id ? undefined : (
                    <Zeilenknoepfe
                      name={lk.name}
                      onBearbeiten={() => setLkBearbeiten({ id: lk.id, name: lk.name })}
                      onLoeschen={() => landeskircheLoeschen(lk, kreise.length)}
                    />
                  )}
                >
                  {lkBearbeiten?.id === lk.id && (
                    <div style={{ marginBottom: 'var(--app-abstand-mittel)' }}>
                      <IonList style={{ background: 'transparent' }}>
                        <Feld label="Name der Landeskirche" pflicht wert={lkBearbeiten.name}
                          onWert={(w) => setLkBearbeiten({ ...lkBearbeiten, name: w })} />
                      </IonList>
                      <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                        <IonButton size="small" onClick={() => { void landeskircheSpeichern(); }} disabled={beschaeftigt}>Speichern</IonButton>
                        <IonButton size="small" fill="clear" onClick={() => setLkBearbeiten(null)}>Abbrechen</IonButton>
                      </div>
                    </div>
                  )}
                  {kreise.length === 0 ? (
                    <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Noch keine Kirchenkreise.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                      {kreise.map(kreisZeile)}
                    </div>
                  )}
                </Abschnitt>
              );
            })}

            {ohneLandeskirche.length > 0 && (
              <Abschnitt icon={ICON_ORT} titel="Kirchenkreise ohne Landeskirche" farbe="warning">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                  {ohneLandeskirche.map(kreisZeile)}
                </div>
              </Abschnitt>
            )}
          </>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

const SupportStrukturPage: React.FC = () => (
  <NurSupport titel="Struktur"><Struktur /></NurSupport>
);

export default SupportStrukturPage;
