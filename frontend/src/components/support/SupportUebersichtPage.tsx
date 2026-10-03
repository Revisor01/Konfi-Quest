// Uebersicht der Support-Ansicht, /admin/support (Web-Version, 03.10.2026).
//
// Startseite eines Support-Kontos ohne Gemeinde (Baum super_admin) und fuer
// Simons Konto der Weg ueber "Mehr". Sie traegt
//   - die Kennzahlen aus GET /support/statistik, zusammengefasst gesamt, je
//     Landeskirche, je Kirchenkreis und je Gemeinde (aufklappbar), dazu die
//     Zahl der Gemeinden ohne Zuordnung (utils/supportStatistik.ts);
//   - die neuen Anfragen als Zahl, dazu die ungelesenen Mails als rote Kugel
//     an Anfragen und Posteingang (navigation/supportMailZaehler.ts);
//   - den Weg zu allen Bereichen und das Abmelden. Breit zeigt beides auch die
//     Seitenleiste der Web-Version; auf schmalen Bildschirmen gibt es im
//     Baum super_admin keine Reiter -- ohne diese Seite kaeme man dort weder
//     weiter noch hinaus (bis 03.10.2026 fehlte das Abmelden ganz).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonAlert,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import { SectionHeader } from '../shared';
import EmptyState from '../shared/EmptyState';
import ZaehlerKugel from '../shared/ZaehlerKugel';
import LoadingSpinner from '../common/LoadingSpinner';
import WartungsHinweis from '../shared/WartungsHinweis';
import {
  ICON_ABMELDEN,
  ICON_AUFKLAPPEN,
  ICON_GRUPPE,
  ICON_JAHRGANG,
  ICON_ORGANISATION,
  ICON_PERSON,
  ICON_PULS,
  ICON_STATISTIK,
  ICON_SUPPORT,
  ICON_WEITER_GEFUELLT,
  ICON_ZUKLAPPEN,
} from '../shared/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import type { GemeindeKennzahlen, SupportStatistik } from '../../types/support';
import { kennzahlenBaum, mitEinheit, summeKurz, summeVon, zahl, type Summe } from '../../utils/supportStatistik';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_BEREICHE, SUPPORT_START } from '../../navigation/supportMenue';
import { supportMailZahl, useSupportMailZaehler } from '../../navigation/supportMailZaehler';
import { Abschnitt, Kennzahl, KennzahlReihe, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';

/** Aufklappbare Zeile im Kennzahlen-Baum. */
const BaumZeile: React.FC<{
  schluessel: string;
  name: string;
  summe: Summe;
  ebene: 0 | 1;
  offen: boolean;
  onUmschalten: (schluessel: string) => void;
  children: React.ReactNode;
}> = ({ schluessel, name, summe, ebene, offen, onUmschalten, children }) => {
  const inhaltId = `baum-${schluessel}`;
  return (
    <div style={{ marginLeft: ebene === 1 ? 'var(--app-abstand-mittel)' : 0 }}>
      <button
        type="button"
        className={`app-list-item app-list-item--${ebene === 0 ? 'organizations' : 'users'}`}
        aria-expanded={offen}
        aria-controls={inhaltId}
        onClick={() => onUmschalten(schluessel)}
        style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
      >
        <div className="app-list-item__row">
          <div className="app-list-item__main">
            <div className="app-list-item__content">
              <div className="app-list-item__title">{name}</div>
              <div className="app-list-item__meta">
                <span className="app-list-item__meta-item">
                  {mitEinheit(summe.gemeinden, 'Gemeinde', 'Gemeinden')} · {summeKurz(summe)}
                </span>
              </div>
            </div>
          </div>
          <IonIcon icon={offen ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN} aria-hidden="true" style={{ color: 'var(--app-text-system)' }} />
        </div>
      </button>
      {offen && <div id={inhaltId}>{children}</div>}
    </div>
  );
};

const GemeindeZeile: React.FC<{ gemeinde: GemeindeKennzahlen; onOeffnen: (id: number) => void }> = ({ gemeinde, onOeffnen }) => {
  const summe = summeVon(gemeinde);
  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={tastaturKlick}
      onClick={() => onOeffnen(gemeinde.id)}
      className="app-list-item app-list-item--users"
      style={{ marginLeft: 'var(--app-abstand-weit)', opacity: gemeinde.is_active ? 1 : 0.7 }}
    >
      <div className="app-list-item__row">
        <div className="app-list-item__main">
          <div className="app-list-item__content">
            <div className="app-list-item__title">
              {gemeinde.name}{!gemeinde.is_active && ' (gesperrt)'}
            </div>
            <div className="app-list-item__meta">
              <span className="app-list-item__meta-item">
                {summeKurz(summe)} · {mitEinheit(summe.jahrgaenge, 'Jahrgang', 'Jahrgänge')}
              </span>
            </div>
          </div>
        </div>
        <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" style={{ color: 'var(--app-text-system)' }} />
      </div>
    </div>
  );
};

const Uebersicht: React.FC = () => {
  const { user, signOut } = useApp();
  const router = useIonRouter();
  const [presentAlert] = useIonAlert();
  const zurueck = useSupportZurueck('/admin/settings');
  // Im Baum super_admin ist diese Seite die Startseite -- dort gibt es kein
  // Zurueck. Simons Konto kommt ueber "Mehr" und geht dorthin zurueck.
  const istStartseite = user?.role_name === 'super_admin';
  const mailZaehler = useSupportMailZaehler(true);

  const [statistik, setStatistik] = useState<SupportStatistik | null>(null);
  const [neueAnfragen, setNeueAnfragen] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set());

  // Erst warten, dann Zustand setzen: Der erste Abruf laeuft im Effekt, und
  // dort soll kein Zustand synchron wechseln (Ladezustand ist vorbelegt).
  const holen = useCallback(async () => {
    const [stat, anfragen] = await Promise.allSettled([
      api.get('/support/statistik'),
      api.get('/support/anfragen', { params: { status: 'neu' } }),
    ]);
    if (stat.status === 'fulfilled' && Array.isArray(stat.value.data?.gemeinden)) {
      setStatistik(stat.value.data);
    } else {
      setStatistik(null);
      setFehler(true);
    }
    setNeueAnfragen(anfragen.status === 'fulfilled' && Array.isArray(anfragen.value.data) ? anfragen.value.data.length : null);
    setLaedt(false);
  }, []);

  useEffect(() => { void holen(); }, [holen]);

  const laden = useCallback(() => {
    setLaedt(true);
    setFehler(false);
    return holen();
  }, [holen]);

  const baum = useMemo(() => (statistik ? kennzahlenBaum(statistik.gemeinden) : null), [statistik]);

  const umschalten = (schluessel: string) => setOffen((vorher) => {
    const neu = new Set(vorher);
    if (neu.has(schluessel)) neu.delete(schluessel); else neu.add(schluessel);
    return neu;
  });

  const abmelden = () => presentAlert({
    header: 'Abmelden',
    message: 'Möchtest du dich wirklich abmelden?',
    buttons: [
      { text: 'Abbrechen', role: 'cancel' },
      { text: 'Abmelden', role: 'destructive', handler: () => { void signOut(); } },
    ],
  });

  const gemeindeOeffnen = (id: number) => router.push(`/admin/organizations?gemeinde=${id}`);
  const bereiche = SUPPORT_BEREICHE.filter((b) => b.path !== SUPPORT_START);
  const g = baum?.gesamt;

  return (
    <IonPage>
      <AppKopfzeile
        titel="Support"
        onZurueck={istStartseite ? undefined : zurueck}
        gemeindeUmschalter={false}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Support" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <WartungsHinweis />

        <SectionHeader
          title="Support-Ansicht"
          subtitle="Gemeinden, Anfragen und Konten an einer Stelle"
          icon={ICON_SUPPORT}
          preset="organizations"
          stats={[
            { value: g ? zahl(g.gemeinden) : '–', label: 'Gemeinden' },
            { value: g ? zahl(g.konten) : '–', label: 'Konten' },
            { value: neueAnfragen === null ? '–' : zahl(neueAnfragen), label: 'Neue Anfragen', onClick: () => router.push('/admin/support/anfragen') },
          ]}
        />

        <Abschnitt icon={ICON_SUPPORT} titel="Bereiche" farbe="organizations">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {bereiche.map((b) => {
              const ungelesen = b.badge === 'supportAnfragen' || b.badge === 'supportPost' ? supportMailZahl(mailZaehler, b.badge) : 0;
              return (
              <div
                key={b.path}
                role="button"
                tabIndex={0}
                onKeyDown={tastaturKlick}
                onClick={() => router.push(b.path)}
                className="app-list-item app-list-item--organizations"
              >
                <div className="app-list-item__row">
                  <div className="app-list-item__main">
                    <div className="app-zaehler-anker">
                      <div className="app-icon-circle app-icon-circle--lg app-icon-circle--organizations">
                        <IonIcon icon={b.icon} />
                      </div>
                      <ZaehlerKugel anzahl={ungelesen} label="ungelesene Mails" />
                    </div>
                    <div className="app-list-item__content">
                      <div className="app-list-item__title">{b.label}</div>
                      <div className="app-list-item__meta">
                        <span className="app-list-item__meta-item">{b.beschreibung}</span>
                      </div>
                    </div>
                  </div>
                  {b.path === '/admin/support/anfragen' && neueAnfragen !== null && neueAnfragen > 0 && (
                    <Marke text={`${zahl(neueAnfragen)} neu`} farbe="var(--app-color-warning)" />
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </Abschnitt>

        {laedt && !statistik ? (
          <LoadingSpinner message="Kennzahlen werden geladen..." />
        ) : fehler || !baum || !g ? (
          <Ladefehler text="Die Kennzahlen konnten nicht geladen werden." onErneut={() => { void laden(); }} />
        ) : g.gemeinden === 0 ? (
          <EmptyState icon={ICON_ORGANISATION} title="Noch keine Gemeinden" message="Sobald eine Gemeinde angelegt ist, stehen hier ihre Kennzahlen." />
        ) : (
          <>
            <KennzahlReihe>
              <Kennzahl icon={ICON_ORGANISATION} label="Gemeinden" wert={zahl(g.gemeinden)} farbe="var(--app-color-users)"
                zusatz={`${zahl(g.aktiveGemeinden)} aktiv · ${zahl(baum.ohneZuordnung)} ohne Zuordnung`} />
              <Kennzahl icon={ICON_GRUPPE} label="Konfis" wert={zahl(g.konfis)} farbe="var(--app-color-konfis)" />
              <Kennzahl icon={ICON_PERSON} label="Teamer:innen" wert={zahl(g.teamer)} farbe="var(--app-color-teamer)" />
              <Kennzahl icon={ICON_PERSON} label="Leitung" wert={zahl(g.leitung + g.gemeindeleitung)} farbe="var(--app-color-leitung)"
                zusatz={`davon ${zahl(g.gemeindeleitung)} Gemeindeleitung`} />
              <Kennzahl icon={ICON_PULS} label="Aktiv (30 Tage)" wert={zahl(g.aktiv30)} farbe="var(--app-color-success)"
                zusatz={`von ${zahl(g.konten)} Konten`} />
              <Kennzahl icon={ICON_JAHRGANG} label="Jahrgänge" wert={zahl(g.jahrgaenge)} farbe="var(--app-color-jahrgang)" />
            </KennzahlReihe>

            <Abschnitt icon={ICON_STATISTIK} titel="Je Landeskirche und Kirchenkreis" farbe="organizations">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)' }}>
                {baum.landeskirchen.map((lk) => (
                  <BaumZeile key={lk.schluessel} schluessel={lk.schluessel} name={lk.name} summe={lk.summe}
                    ebene={0} offen={offen.has(lk.schluessel)} onUmschalten={umschalten}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                      {lk.kirchenkreise.map((kk) => (
                        <BaumZeile key={kk.schluessel} schluessel={kk.schluessel} name={kk.name} summe={kk.summe}
                          ebene={1} offen={offen.has(kk.schluessel)} onUmschalten={umschalten}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
                            {kk.gemeinden.map((gemeinde) => (
                              <GemeindeZeile key={gemeinde.id} gemeinde={gemeinde} onOeffnen={gemeindeOeffnen} />
                            ))}
                          </div>
                        </BaumZeile>
                      ))}
                    </div>
                  </BaumZeile>
                ))}
              </div>
              <p style={{ margin: 'var(--app-abstand-mittel) 0 0', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
                Stand {datumUhrzeit(statistik?.stand ?? '')}. Ein Konto, das in zwei Gemeinden mitarbeitet, zählt in beiden.
              </p>
            </Abschnitt>
          </>
        )}

        <Abschnitt icon={ICON_PERSON} titel="Konto" farbe="users">
          <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)' }}>
            Angemeldet als <strong>{user?.display_name ?? ''}</strong>{user?.username ? ` (${user.username})` : ''}
          </p>
          <IonButton expand="block" fill="outline" color="danger" onClick={abmelden}>
            <IonIcon icon={ICON_ABMELDEN} slot="start" />
            Abmelden
          </IonButton>
        </Abschnitt>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

const SupportUebersichtPage: React.FC = () => (
  <NurSupport titel="Support"><Uebersicht /></NurSupport>
);

export default SupportUebersichtPage;
