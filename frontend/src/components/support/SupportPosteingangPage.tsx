// Posteingang der Support-Ansicht, /admin/support/post
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Oben der Zustand der Postfächer -- eine Zeile, solange beide laufen, sonst
// je gestörtem Postfach eine Zeile mit dem Grund (nicht eingerichtet, Fehler
// beim Abholen, auf diesem Server aus) --, darunter die Mails, die in keinem
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
  ICON_ARCHIV,
  ICON_INFO,
  ICON_MAIL,
  ICON_WARNHINWEIS,
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
import { Abschnitt, Angabenzeile, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { usePosteingang } from './usePosteingang';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import WebPosteingang from './web/WebPosteingang';
import './SupportVorgangTeile.css';

/**
 * Ein gestörtes Postfach als eine Zeile: Postfach und Grund, mit denselben
 * Sätzen wie im Browser (web/WebPosteingang). Bis 12.10.2026 stand je Postfach
 * ein Kasten mit Adresse, Marke, Aufgabe und einem eigenen Hinweis-Kasten --
 * bei zwei nicht eingerichteten Postfächern begann die erste Mail erst bei
 * y 616 bis 623.
 */
const PostfachStoerung: React.FC<{ p: MailPostfachStatus }> = ({ p }) => {
  const aus = !aufDiesemServer(p);
  const gruende = [
    aus ? SERVER_AUS_HINWEIS : null,
    !p.eingerichtet && !aus ? `${ZUGANGSDATEN_FEHLEN.titel}: ${ZUGANGSDATEN_FEHLEN.text}` : null,
    p.fehler ? `Fehler beim Abholen: ${p.fehler}${p.fehler_am ? ` (${datumUhrzeit(p.fehler_am)})` : ''}` : null,
  ].filter((g): g is string => Boolean(g));
  const ton = p.fehler ? 'fehler' : aus ? 'warnung' : 'hinweis';
  return (
    <li className={`support-postfach-stoerung support-postfach-stoerung--${ton}`}>
      <IonIcon icon={ton === 'hinweis' ? ICON_INFO : ICON_WARNHINWEIS} aria-hidden="true" />
      <span>
        <strong>{POSTFACH_INFO[p.postfach]?.kurz || p.adresse || p.postfach}</strong>
        {` · ${gruende.join(' · ')}`}
      </span>
    </li>
  );
};

const Posteingang: React.FC = () => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_START);
  const [filter, setFilter] = useState<EingangFilter>('alle');
  const { sichtbar, zaehlen, status, laedt, fehler, neuLaden } = usePosteingang(filter);
  const archiv = filter === 'archiv';
  const stoerungen = (status ?? []).filter((p) => Boolean(p.fehler) || !p.eingerichtet || !aufDiesemServer(p));
  const zuletztAbgeholt = (status ?? []).map((p) => p.abgeholt_am).filter((t): t is string => Boolean(t)).sort().pop();

  return (
    <IonPage>
      <AppKopfzeile titel={POSTEINGANG_TITEL} onZurueck={zurueck} gemeindeUmschalter={false} />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={POSTEINGANG_TITEL} />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void neuLaden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Laufen beide Postfächer, steht nur eine Zeile da; stört eines, eine
            Zeile je gestörtem Postfach mit dem Grund (Simon, 10.10.2026: „mega
            unübersichtlich"; als Zeilen statt Kästen seit 12.10.2026). */}
        {status && status.length > 0 && stoerungen.length === 0 ? (
          <p role="status" className="support-postfach-zeile">
            {status.map((p) => POSTFACH_INFO[p.postfach]?.kurz ?? p.postfach).join(' und ')} eingerichtet
            {zuletztAbgeholt ? ` · zuletzt abgeholt ${datumUhrzeit(zuletztAbgeholt)}` : ''}
          </p>
        ) : status && status.length > 0 ? (
          <div role="status" aria-label="Postfächer">
            <ul className="support-postfach-stoerungen">
              {stoerungen.map((p) => <PostfachStoerung key={p.postfach} p={p} />)}
            </ul>
          </div>
        ) : status ? (
          <p role="status" className="support-postfach-zeile">Der Server meldet keine Postfächer.</p>
        ) : laedt ? (
          <p className="support-postfach-zeile">Zustand der Postfächer wird geladen...</p>
        ) : (
          <p role="status" className="support-postfach-zeile support-postfach-zeile--fehler">
            Der Zustand der Postfächer konnte nicht geladen werden.
          </p>
        )}

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
                // Wie die Zeile eines Vorgangs: Betreff über die volle Breite,
                // darunter Absender und Zeit, der Auszug und das Postfach als
                // Marke (bis 12.10.2026 stand die Marke rechts neben dem Betreff).
                const angaben = [
                  absender,
                  datumUhrzeit(m.gesendet_am),
                  anhaenge > 0 ? (anhaenge === 1 ? '1 Anhang' : `${anhaenge} Anhänge`) : null,
                ];
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
                          <Angabenzeile angaben={angaben} />
                          {m.auszug && <div className="support-listenzeile__auszug">{m.auszug}</div>}
                          <div className="support-listenzeile__marken">
                            <Marke text={POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach} farbe="var(--app-color-neutral)" />
                          </div>
                        </div>
                      </div>
                      {ungelesen && <span className="app-ungelesen-punkt support-listenzeile__punkt" aria-hidden="true" />}
                      <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" className="support-listenzeile__pfeil" />
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
