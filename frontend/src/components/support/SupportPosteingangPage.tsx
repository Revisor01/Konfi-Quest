// Posteingang der Support-Ansicht, /admin/support/post
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Oben der Zustand beider Postfächer (eingerichtet, zuletzt abgeholt, Fehler
// beim Abholen, auf diesem Server aus), darunter die Mails, die in keinem
// Vorgang liegen und nicht archiviert sind -- neueste zuerst, ungelesene
// hervorgehoben. Filter: Alle, Ungelesen, moin@, support@ und Archiv. Ein
// Antippen öffnet die Mail mit ihrem Faden, zum Einsortieren, Archivieren,
// Löschen und Antworten. Alles andere -- Anfragen, Formulare, der Schriftwechsel
// einer Gemeinde -- steht in den Vorgängen.
//
// Die Logik steht in components/support/usePosteingang.ts, dieselbe wie in der
// Web-Fassung (web/WebPosteingang).

import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  ICON_ANHANG,
  ICON_ARCHIV,
  ICON_AT_ZEICHEN,
  ICON_MAIL,
  ICON_UHRZEIT,
  ICON_WEITER_GEFUELLT,
} from '../shared/icons';
import type { MailPostfachStatus } from '../../types/support';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, aufDiesemServer } from '../../utils/supportMail';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { mailsText } from '../../utils/supportVorgaenge';
import type { EingangFilter } from '../../utils/supportWeb';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import {
  POSTEINGANG_FILTER,
  POSTEINGANG_FILTER_BESCHRIFTUNG,
  POSTEINGANG_LEER_TITEL,
  POSTEINGANG_TITEL,
  ZUGANGSDATEN_FEHLEN,
} from '../../seiten/supportPosteingang';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { Abschnitt, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { Hinweis } from './SupportMailTeile';
import { useSupportZurueck } from './useSupportZurueck';
import { usePosteingang } from './usePosteingang';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPosteingang from './web/WebPosteingang';

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
        <Hinweis art="hinweis" titel={ZUGANGSDATEN_FEHLEN.titel}>
          {ZUGANGSDATEN_FEHLEN.text}
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
  const [filter, setFilter] = useState<EingangFilter>('alle');
  const { sichtbar, zaehlen, status, laedt, fehler, neuLaden } = usePosteingang(filter);
  const archiv = filter === 'archiv';

  return (
    <IonPage>
      <AppKopfzeile titel={POSTEINGANG_TITEL} onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={POSTEINGANG_TITEL} />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void neuLaden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        <Abschnitt icon={ICON_AT_ZEICHEN} titel="Postfächer" farbe="organizations">
          {status ? (
            status.length === 0
              ? <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Der Server meldet keine Postfächer.</p>
              : status.map((p) => <PostfachZustand key={p.postfach} p={p} />)
          ) : laedt ? (
            <p style={{ margin: 0, color: 'var(--app-text-system)' }}>Zustand wird geladen...</p>
          ) : (
            <p role="status" style={{ margin: 0, color: 'var(--app-text-fehler)' }}>
              Der Zustand der Postfächer konnte nicht geladen werden.
            </p>
          )}
        </Abschnitt>

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonSegment scrollable value={filter} aria-label={POSTEINGANG_FILTER_BESCHRIFTUNG} onIonChange={(e) => setFilter((e.detail.value as EingangFilter) ?? 'alle')}>
            {/* Filter aus der gemeinsamen Beschreibung (seiten/supportPosteingang.ts). */}
            {inFassung(POSTEINGANG_FILTER, 'app').map((f) => (
              <IonSegmentButton key={f.schluessel} value={f.schluessel}>
                <IonLabel>{f.kurz ?? f.label}{f.schluessel !== 'archiv' ? ` ${zaehlen[f.schluessel]}` : ''}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {laedt ? (
          <LoadingSpinner message="Mails werden geladen..." />
        ) : fehler ? (
          <Ladefehler text="Der Posteingang konnte nicht geladen werden." onErneut={() => { void neuLaden(); }} />
        ) : sichtbar.length === 0 ? (
          <EmptyState icon={archiv ? ICON_ARCHIV : ICON_MAIL} title={POSTEINGANG_LEER_TITEL[filter]} message={leerVon(POSTEINGANG_FILTER, filter)} />
        ) : (
          <Abschnitt icon={archiv ? ICON_ARCHIV : ICON_MAIL} titel={`${mailsText(sichtbar.length)} ${archiv ? 'im Archiv' : 'zum Einsortieren'}`} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sichtbar.map((m) => {
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
                          <div className="app-list-item__title" style={{ fontWeight: ungelesen ? 'var(--app-schrift-fett)' : 'var(--app-schrift-normal)', hyphens: 'auto', overflowWrap: 'break-word' }}>
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

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonButton expand="block" fill="outline" onClick={() => router.push('/admin/support/vorgaenge')}>
            Zu den Vorgängen
          </IonButton>
        </div>

        <div style={{ height: 'var(--app-abstand-riesig)' }} />
      </IonContent>
    </IonPage>
  );
};

// Zwei Gesichter, eine Seite (docs/planung/support-web.md, Entscheidung 1):
// im breiten Browserfenster der Posteingang wie ein Mailprogramm, sonst die
// Darstellung der App.
const SupportPosteingangPage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel={POSTEINGANG_TITEL}>{breit ? <WebPosteingang /> : <Posteingang />}</NurSupport>;
};

export default SupportPosteingangPage;
