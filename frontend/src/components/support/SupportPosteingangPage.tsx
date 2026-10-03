// Posteingang der Support-Ansicht, /admin/support/post (Support-Mail,
// 03.10.2026, docs/planung/support-mail.md).
//
// Oben der Zustand beider Postfaecher (eingerichtet, zuletzt abgeholt,
// Fehler beim Abholen, auf diesem Server aus), darunter die Mails, die der
// Server keiner Anfrage und keiner Gemeinde zuordnen konnte -- neueste
// zuerst, ungelesene hervorgehoben. Ein Antippen oeffnet die Mail mit ihrem
// Faden, zum Zuordnen und Antworten. Unten der Weg zum Schriftwechsel einer
// Gemeinde: die mit ungelesenen Mails (rote Zahl) und eine Auswahl aller
// Gemeinden -- der Vertrag hat keine Liste „Gemeinden mit Schriftwechsel".

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  useIonRouter,
  useIonViewWillEnter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import ZaehlerKugel from '../shared/ZaehlerKugel';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_ANHANG,
  ICON_AT_ZEICHEN,
  ICON_MAIL,
  ICON_ORGANISATION,
  ICON_UHRZEIT,
  ICON_WEITER_GEFUELLT,
} from '../shared/icons';
import api from '../../services/api';
import type { GemeindeKurz, MailEingangEintrag, MailPostfachStatus, Postfach } from '../../types/support';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, aufDiesemServer, gemeindeName, gemeindenSortiert } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { useSupportMailZaehler } from '../../navigation/supportMailZaehler';
import { Abschnitt, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { Hinweis } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPosteingang from './web/WebPosteingang';

type Filter = Postfach | 'alle';

const FILTER: Array<{ wert: Filter; label: string }> = [
  { wert: 'alle', label: 'Alle' },
  { wert: 'moin', label: POSTFACH_INFO.moin.kurz },
  { wert: 'support', label: POSTFACH_INFO.support.kurz },
];

const LEER_TEXT: Record<Filter, string> = {
  alle: 'Jede Mail ist einer Anfrage oder Gemeinde zugeordnet.',
  moin: `Keine nicht zugeordneten Mails an ${POSTFACH_INFO.moin.kurz}.`,
  support: `Keine nicht zugeordneten Mails an ${POSTFACH_INFO.support.kurz}.`,
};

/** Der Zustand eines Postfachs: eingerichtet, zuletzt abgeholt, Fehler. */
const PostfachZustand: React.FC<{ p: MailPostfachStatus }> = ({ p }) => {
  const info = POSTFACH_INFO[p.postfach];
  return (
    <div style={{ padding: 'var(--app-abstand-eng) 0', borderBottom: '1px solid var(--app-border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--app-abstand-eng)', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--app-text-emphasis)', overflowWrap: 'anywhere' }}>{p.adresse || info?.kurz}</strong>
        <Marke
          text={p.eingerichtet ? 'Eingerichtet' : 'Nicht eingerichtet'}
          farbe={p.eingerichtet ? 'var(--app-color-success)' : 'var(--app-color-neutral)'}
        />
      </div>
      <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-mini)' }}>
        {info?.aufgabe}
        {' · '}
        {p.abgeholt_am ? `zuletzt abgeholt ${datumUhrzeit(p.abgeholt_am)}` : 'noch nicht abgeholt'}
      </div>
      {!aufDiesemServer(p) && (
        <Hinweis art="warnung" titel={SERVER_AUS_HINWEIS} />
      )}
      {!p.eingerichtet && aufDiesemServer(p) && (
        <Hinweis art="hinweis" titel="Zugangsdaten fehlen">
          Ohne Benutzer, Passwort und IMAP-Server auf dem Server wird dieses Postfach nicht gelesen.
        </Hinweis>
      )}
      {p.fehler && (
        <Hinweis art="fehler" titel="Fehler beim Abholen">
          {p.fehler}{p.fehler_am ? ` (${datumUhrzeit(p.fehler_am)})` : ''}
        </Hinweis>
      )}
    </div>
  );
};

const Posteingang: React.FC = () => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_START);
  const zaehler = useSupportMailZaehler(true);

  const [filter, setFilter] = useState<Filter>('alle');
  const [eingang, setEingang] = useState<MailEingangEintrag[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [status, setStatus] = useState<MailPostfachStatus[] | null>(null);
  const [statusFehlt, setStatusFehlt] = useState(false);
  const [gemeinden, setGemeinden] = useState<GemeindeKurz[]>([]);
  const [gewaehlteGemeinde, setGewaehlteGemeinde] = useState('');

  // Erst warten, dann Zustand setzen (der Abruf laeuft im Effekt).
  const holen = useCallback(async (welcher: Filter) => {
    try {
      const antwort = await api.get('/support/mail/eingang', welcher === 'alle' ? undefined : { params: { postfach: welcher } });
      setEingang(Array.isArray(antwort.data) ? antwort.data : []);
      setFehler(false);
    } catch {
      setEingang(null);
      setFehler(true);
    } finally {
      setLaedt(false);
    }
  }, []);

  const rahmenHolen = useCallback(async () => {
    const [s, g] = await Promise.allSettled([api.get('/support/mail/status'), api.get('/organizations')]);
    if (s.status === 'fulfilled' && Array.isArray(s.value.data?.postfaecher)) {
      setStatus(s.value.data.postfaecher);
      setStatusFehlt(false);
    } else {
      setStatus(null);
      setStatusFehlt(true);
    }
    setGemeinden(g.status === 'fulfilled' && Array.isArray(g.value.data) ? gemeindenSortiert(g.value.data) : []);
  }, []);

  useEffect(() => { void holen(filter); }, [filter, holen]);
  useEffect(() => { void rahmenHolen(); }, [rahmenHolen]);

  // Zurueck aus einer Mail: still neu laden, damit gelesene Mails nicht
  // mehr hervorgehoben stehen und zugeordnete verschwinden. Beim ersten
  // Eintritt laedt schon der Effekt.
  const ersterEintritt = useRef(true);
  useIonViewWillEnter(() => {
    if (ersterEintritt.current) {
      ersterEintritt.current = false;
      return;
    }
    void holen(filter);
  });

  const laden = () => {
    setLaedt(true);
    setFehler(false);
    return Promise.all([holen(filter), rahmenHolen()]);
  };

  const filterWechseln = (neu: Filter) => {
    if (neu === filter) return;
    setLaedt(true);
    setEingang(null);
    setFilter(neu);
  };

  const jeGemeinde = Object.entries(zaehler?.je_gemeinde ?? {})
    .map(([id, n]) => ({ id: Number(id), n }))
    .filter((e) => Number.isInteger(e.id) && e.n > 0);
  const nameVon = (id: number) => {
    const g = gemeinden.find((x) => x.id === id);
    return g ? gemeindeName(g) : `Gemeinde ${id}`;
  };

  return (
    <IonPage>
      <AppKopfzeile titel="Posteingang" onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Posteingang" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void laden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <Abschnitt icon={ICON_AT_ZEICHEN} titel="Postfächer" farbe="organizations">
          {status ? (
            status.length === 0
              ? <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Der Server meldet keine Postfächer.</p>
              : status.map((p) => <PostfachZustand key={p.postfach} p={p} />)
          ) : statusFehlt ? (
            <p role="status" style={{ margin: 0, color: 'var(--app-text-fehler)' }}>
              Der Zustand der Postfächer konnte nicht geladen werden.
            </p>
          ) : (
            <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Zustand wird geladen...</p>
          )}
        </Abschnitt>

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonSegment value={filter} aria-label="Postfach" onIonChange={(e) => filterWechseln((e.detail.value as Filter) ?? 'alle')}>
            {FILTER.map((f) => (
              <IonSegmentButton key={f.wert} value={f.wert}>
                <IonLabel>{f.label}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {laedt && !eingang ? (
          <LoadingSpinner message="Mails werden geladen..." />
        ) : fehler || !eingang ? (
          <Ladefehler text="Der Posteingang konnte nicht geladen werden." onErneut={() => { void laden(); }} />
        ) : eingang.length === 0 ? (
          <EmptyState icon={ICON_MAIL} title="Nichts zuzuordnen" message={LEER_TEXT[filter]} />
        ) : (
          <Abschnitt icon={ICON_MAIL} titel={`${eingang.length} nicht zugeordnete ${eingang.length === 1 ? 'Mail' : 'Mails'}`} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {eingang.map((m) => {
                const ungelesen = !m.gelesen_am;
                const absender = m.von_name?.trim() || m.von_adresse;
                const betreff = m.betreff?.trim() || '(ohne Betreff)';
                const anhaenge = (m.anhaenge ?? []).length;
                return (
                  <div
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={tastaturKlick}
                    onClick={() => router.push(`/admin/support/post/${m.id}`)}
                    className={`app-list-item app-list-item--${ungelesen ? 'info' : 'neutral'}`}
                    aria-label={`Mail von ${absender}: ${betreff}${ungelesen ? ', ungelesen' : ''}`}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className={`app-icon-circle app-icon-circle--lg app-icon-circle--${ungelesen ? 'info' : 'neutral'}`}>
                          <IonIcon icon={ICON_MAIL} />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title" style={{ fontWeight: ungelesen ? 'var(--app-schrift-fett)' : 'var(--app-schrift-normal)' }}>
                            {betreff}
                          </div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">{absender}</span>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={ICON_UHRZEIT} style={{ color: 'var(--app-text-users)' }} />
                              {datumUhrzeit(m.gesendet_am)}
                            </span>
                            {anhaenge > 0 && (
                              <span className="app-list-item__meta-item">
                                <IonIcon icon={ICON_ANHANG} style={{ color: 'var(--app-text-users)' }} />
                                {anhaenge === 1 ? '1 Anhang' : `${anhaenge} Anhänge`}
                              </span>
                            )}
                          </div>
                          {m.auszug && (
                            <div style={{ fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)', marginTop: 'var(--app-abstand-mini)' }}>
                              {m.auszug}
                            </div>
                          )}
                        </div>
                      </div>
                      {ungelesen && <span className="app-ungelesen-punkt" aria-hidden="true" style={{ marginRight: 'var(--app-abstand-eng)' }} />}
                      <Marke text={POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach} farbe="var(--app-color-neutral)" />
                      <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" style={{ color: 'var(--app-text-system)', marginLeft: 'var(--app-abstand-eng)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Abschnitt>
        )}

        <Abschnitt icon={ICON_ORGANISATION} titel="Schriftwechsel mit Gemeinden" farbe="organizations">
          {jeGemeinde.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 'var(--app-abstand-kompakt)' }}>
              {jeGemeinde.map(({ id, n }) => (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={tastaturKlick}
                  onClick={() => router.push(`/admin/support/post/gemeinde/${id}`)}
                  className="app-list-item app-list-item--organizations"
                  aria-label={`Schriftwechsel ${nameVon(id)}, ${n} ungelesen`}
                >
                  <div className="app-list-item__row">
                    <div className="app-list-item__main">
                      <div className="app-zaehler-anker">
                        <div className="app-icon-circle app-icon-circle--organizations">
                          <IonIcon icon={ICON_ORGANISATION} />
                        </div>
                        <ZaehlerKugel anzahl={n} label="ungelesene Mails" />
                      </div>
                      <div className="app-list-item__content">
                        <div className="app-list-item__title">{nameVon(id)}</div>
                      </div>
                    </div>
                    <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" style={{ color: 'var(--app-text-system)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-system)' }}>
              Keine ungelesenen Mails von Gemeinden.
            </p>
          )}
          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="full" style={{ '--background': 'transparent' }}>
              <IonLabel position="stacked">Schriftwechsel einer Gemeinde</IonLabel>
              <IonSelect
                aria-label="Schriftwechsel einer Gemeinde"
                interface="popover"
                value={gewaehlteGemeinde}
                disabled={gemeinden.length === 0}
                onIonChange={(e) => setGewaehlteGemeinde(String(e.detail.value ?? ''))}
              >
                <IonSelectOption value="">Gemeinde wählen</IonSelectOption>
                {gemeinden.map((g) => (
                  <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonList>
          <IonButton
            expand="block"
            fill="outline"
            disabled={!gewaehlteGemeinde}
            onClick={() => router.push(`/admin/support/post/gemeinde/${gewaehlteGemeinde}`)}
          >
            <IonIcon icon={ICON_ORGANISATION} slot="start" />
            Schriftwechsel öffnen
          </IonButton>
        </Abschnitt>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite (docs/planung/support-web.md, Entscheidung 1):
// im breiten Browserfenster der Posteingang wie ein Mailprogramm, sonst die
// Darstellung der App -- unveraendert.
const SupportPosteingangPage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel="Posteingang">{breit ? <WebPosteingang /> : <Posteingang />}</NurSupport>;
};

export default SupportPosteingangPage;
