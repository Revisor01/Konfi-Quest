// Anfragen der Support-Ansicht, /admin/support/anfragen (Web-Version,
// Entscheidung 4, 02.10.2026).
//
// Jede Anfrage aus dem Formular der Homepage (POST /api/anfragen) landet hier,
// gefiltert nach Status. Die neuen stehen vorne; ein Antippen oeffnet die
// Anfrage mit allen Angaben, Status, Notiz und "Gemeinde anlegen".
//
// Support-Mail (03.10.2026): Jede Anfrage traegt die Zahl ihrer ungelesenen
// Mails als rote Kugel (Feld `ungelesen` aus GET /support/anfragen). Der
// Filter „Ungelesen" zeigt alle Anfragen mit ungelesenen Mails, gleich in
// welchem Status -- sonst stuende eine Mail zu einer Anfrage „in Arbeit"
// hinter der roten Zahl in der Leiste, aber nicht im voreingestellten
// Filter „Neu".

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import ZaehlerKugel from '../shared/ZaehlerKugel';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_GRUPPE, ICON_MAIL, ICON_ORGANISATION, ICON_UHRZEIT, ICON_WEITER_GEFUELLT } from '../shared/icons';
import api from '../../services/api';
import type { AnfrageStatus, GemeindeAnfrage } from '../../types/support';
import { ANFRAGE_STATUS, STATUS_FILTER } from '../../utils/supportAnfragen';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { Abschnitt, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { lizenzFinden } from '../../utils/lizenzen';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebAnfragen from './web/WebAnfragen';

type Filter = AnfrageStatus | 'alle' | 'ungelesen';

/** Die Filter der Liste: die Status, „Alle" und „Ungelesen" (holt alle und behaelt die mit ungelesenen Mails). */
const FILTER: Array<{ wert: Filter; label: string }> = [...STATUS_FILTER, { wert: 'ungelesen', label: 'Ungelesen' }];

const LEER_TEXT: Record<Filter, string> = {
  neu: 'Keine neuen Anfragen.',
  in_arbeit: 'Keine Anfragen in Arbeit.',
  angelegt: 'Noch keine Anfrage wurde zur Gemeinde.',
  abgelehnt: 'Keine abgelehnten Anfragen.',
  alle: 'Noch keine Anfragen über die Homepage.',
  ungelesen: 'Keine Anfrage hat ungelesene Mails.',
};

/** Ungelesene Mails einer Anfrage; aeltere Server liefern das Feld nicht (dann 0). */
const ungelesenVon = (a: GemeindeAnfrage): number => (typeof a.ungelesen === 'number' && a.ungelesen > 0 ? a.ungelesen : 0);

const Anfragen: React.FC = () => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_START);
  const [filter, setFilter] = useState<Filter>('neu');
  const [anfragen, setAnfragen] = useState<GemeindeAnfrage[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);

  // Erst warten, dann Zustand setzen (der Abruf laeuft im Effekt); den
  // Ladezustand setzt, wer neu laden laesst.
  const holen = useCallback(async (welcher: Filter) => {
    try {
      const antwort = await api.get(
        '/support/anfragen',
        welcher === 'alle' || welcher === 'ungelesen' ? undefined : { params: { status: welcher } }
      );
      const liste: GemeindeAnfrage[] = Array.isArray(antwort.data) ? antwort.data : [];
      setAnfragen(welcher === 'ungelesen' ? liste.filter((a) => ungelesenVon(a) > 0) : liste);
      setFehler(false);
    } catch {
      setAnfragen(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => { void holen(filter); }, [filter, holen]);

  // Zurueck aus einer Anfrage: still neu laden, damit Status und rote
  // Zahl stimmen (gelesene Mails, gesendete Antwort). Beim ersten Eintritt
  // laedt schon der Effekt.
  const ersterEintritt = useRef(true);
  useIonViewWillEnter(() => {
    if (ersterEintritt.current) {
      ersterEintritt.current = false;
      return;
    }
    void holen(filter);
  });

  const laden = (welcher: Filter) => {
    setLaedt(true);
    setFehler(false);
    return holen(welcher);
  };

  const filterWechseln = (neu: Filter) => {
    if (neu === filter) return;
    setLaedt(true);
    setAnfragen(null);
    setFilter(neu);
  };

  return (
    <IonPage>
      <AppKopfzeile titel="Anfragen" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Anfragen" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden(filter).finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonSegment
            scrollable
            value={filter}
            aria-label="Status"
            onIonChange={(e) => filterWechseln((e.detail.value as Filter) ?? 'neu')}
          >
            {FILTER.map((f) => (
              <IonSegmentButton key={f.wert} value={f.wert}>
                <IonLabel>{f.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {laedt && !anfragen ? (
          <LoadingSpinner message="Anfragen werden geladen..." />
        ) : fehler || !anfragen ? (
          <Ladefehler text="Die Anfragen konnten nicht geladen werden." onErneut={() => { void laden(filter); }} />
        ) : anfragen.length === 0 ? (
          <EmptyState icon={ICON_MAIL} title="Keine Anfragen" message={LEER_TEXT[filter]} />
        ) : (
          <Abschnitt icon={ICON_MAIL} titel={`${anfragen.length} ${anfragen.length === 1 ? 'Anfrage' : 'Anfragen'}`} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {anfragen.map((a) => {
                const status = ANFRAGE_STATUS[a.status] ?? ANFRAGE_STATUS.neu;
                const zuordnung = [a.kirchenkreis, a.landeskirche].filter(Boolean).join(' · ');
                const wunsch = lizenzFinden(a.wunsch_lizenz);
                const ungelesen = ungelesenVon(a);
                return (
                  <div
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={tastaturKlick}
                    onClick={() => router.push(`/admin/support/anfragen/${a.id}`)}
                    className="app-list-item app-list-item--organizations"
                    aria-label={`Anfrage ${a.gemeinde}, ${status.label}${ungelesen > 0 ? `, ${ungelesen} ungelesene ${ungelesen === 1 ? 'Mail' : 'Mails'}` : ''}`}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-zaehler-anker">
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--organizations">
                            <IonIcon icon={ICON_ORGANISATION} />
                          </div>
                          <ZaehlerKugel anzahl={ungelesen} label="ungelesene Mails" />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">{a.gemeinde}</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={ICON_GRUPPE} style={{ color: 'var(--app-text-users)' }} />
                              {a.kontakt_name}{a.funktion ? ` (${a.funktion})` : ''}
                            </span>
                            {zuordnung && <span className="app-list-item__meta-item">{zuordnung}</span>}
                            {wunsch && <span className="app-list-item__meta-item">Lizenz {wunsch.name}</span>}
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={ICON_UHRZEIT} style={{ color: 'var(--app-text-users)' }} />
                              {datumUhrzeit(a.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Marke text={status.label} farbe={status.farbe} />
                      <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" style={{ color: 'var(--app-text-system)', marginLeft: 'var(--app-abstand-eng)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Abschnitt>
        )}

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite (docs/planung/support-web.md, Entscheidung 1):
// im breiten Browserfenster die Tabelle der Web-Fassung, sonst die
// Darstellung der App -- unveraendert.
const SupportAnfragenPage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel="Anfragen">{breit ? <WebAnfragen /> : <Anfragen />}</NurSupport>;
};

export default SupportAnfragenPage;
