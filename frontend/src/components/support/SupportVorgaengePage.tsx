// Vorgänge der Support-Ansicht, /admin/support/vorgaenge
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Jedes Anliegen -- Anfrage von der Homepage, Support-Formular, Mail, vom
// Support angelegt -- ist ein Vorgang mit Nummer, Art, Bereich, Dringlichkeit,
// Status und Gemeinde. Die App zeigt sie als einfache Liste mit denselben
// Reitern wie der Browser (Offen, Neu, In Arbeit, Wartet, Archiv -- darin auch
// die erledigten); ein Antippen öffnet den Vorgang. Art, Gemeinde und Suche
// stehen hinter dem Knopf „Filter" oben rechts (12.10.2026: vorher standen sie
// offen über der Liste, und die erste Karte begann erst bei y 431 bis 504).
// Das Plus daneben legt einen neuen Vorgang an (bei gewählter Gemeinde heißt
// es „Gemeinde anschreiben"). Sammelaktionen gibt es nur im Browser. Im
// breiten Browserfenster steht die Liste der Web-Fassung.
//
// Die Logik steht in components/support/useVorgangsliste.ts und
// useNeuerVorgang.ts, dieselbe wie in der Web-Fassung.

import React, { useId, useState } from 'react';
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
  IonTextarea,
  useIonRouter,
} from '@ionic/react';
import AppKopfzeile, { AppKopfzeileGross } from '../shared/AppKopfzeile';
import EmptyState from '../shared/EmptyState';
import ZaehlerKugel from '../shared/ZaehlerKugel';
import LoadingSpinner from '../common/LoadingSpinner';
import { ICON_FILTER, ICON_HINZUFUEGEN, ICON_LISTE, ICON_WEITER_GEFUELLT } from '../shared/icons';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { empfaengerText, gemeindeName } from '../../utils/supportMail';
import {
  ARTEN,
  ART_FARBE,
  ART_SYMBOL,
  BEREICHE,
  DRINGLICHKEITEN,
  VORGANG_STATUS,
  artKurz,
  bereichIstPflicht,
  bereichLabel,
  istZugeordnet,
  ohneGemeindeText,
  vorgaengeText,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangFilter,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { Abschnitt, Angabenzeile, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { useVorgangsliste } from './useVorgangsliste';
import { useVorgangsAuswahl } from './useVorgangsAuswahl';
import { useNeuerVorgang } from './useNeuerVorgang';
import WebVorgaenge from './web/WebVorgaenge';
import { suchbegriff } from '../../utils/supportWeb';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import {
  ALLE_ARTEN,
  ALLE_GEMEINDEN,
  VORGAENGE_TITEL,
  VORGANG_KEINE_TREFFER,
  VORGANG_LEER_TITEL,
  VORGANG_STAENDE,
  VORGANG_STAENDE_BESCHRIFTUNG,
} from '../../seiten/supportVorgaenge';
import './SupportVorgangTeile.css';

/** Farbe der Marke je Status -- dieselben Farben wie die Marken der Web-Fassung. */
const STATUS_FARBE: Record<VorgangStatus, string> = {
  neu: 'var(--app-color-warning)',
  in_arbeit: 'var(--app-color-info)',
  wartet: 'var(--app-color-neutral)',
  erledigt: 'var(--app-color-success)',
};

/** Neuer Vorgang als Abschnitt der Seite (die App hat dafuer keinen Dialog). */
const NeuerVorgangAbschnitt: React.FC<{ organizationId: string; onSchliessen: () => void }> = ({ organizationId, onSchliessen }) => {
  const { isOnline, formular, aendern, gemeinden, empfaenger, fehler, sendet, absenden } = useNeuerVorgang(
    organizationId ? { organizationId, art: 'sonstiges' } : {},
    onSchliessen,
  );
  const pflicht = bereichIstPflicht(formular.art);
  return (
    <Abschnitt icon={ICON_HINZUFUEGEN} titel={organizationId ? 'Gemeinde anschreiben' : 'Neuer Vorgang'} farbe="organizations">
      {fehler && <p role="alert" style={{ margin: '0 0 var(--app-abstand-eng)', color: 'var(--app-text-fehler)' }}>{fehler}</p>}
      <IonList style={{ background: 'transparent' }}>
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Art *</IonLabel>
          <IonSelect aria-label="Art" interface="popover" value={formular.art} placeholder="Bitte wählen"
            onIonChange={(e) => aendern({ art: String(e.detail.value ?? '') as VorgangArt | '' })}>
            {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">{pflicht ? 'Bereich *' : 'Bereich'}</IonLabel>
          <IonSelect aria-label="Bereich" interface="popover" value={formular.bereich} placeholder={pflicht ? 'Bitte wählen' : 'Kein Bereich'}
            onIonChange={(e) => aendern({ bereich: String(e.detail.value ?? '') as VorgangBereich | '' })}>
            <IonSelectOption value="">{pflicht ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
            {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Dringlichkeit</IonLabel>
          <IonSelect aria-label="Dringlichkeit" interface="popover" value={formular.dringlichkeit}
            onIonChange={(e) => aendern({ dringlichkeit: String(e.detail.value ?? 'normal') as Dringlichkeit })}>
            {DRINGLICHKEITEN.map((d) => (
              <IonSelectOption key={d.wert} value={d.wert}>{d.hinweis ? `${d.label} – ${d.hinweis}` : d.label}</IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <Feld label="Betreff" pflicht wert={formular.betreff} onWert={(w) => aendern({ betreff: w })} />
        <IonItem lines="full" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Gemeinde</IonLabel>
          <IonSelect aria-label="Gemeinde" interface="popover" value={formular.organizationId}
            onIonChange={(e) => aendern({ organizationId: String(e.detail.value ?? '') })}>
            <IonSelectOption value="">Keine Gemeinde</IonSelectOption>
            {gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        {formular.organizationId ? (
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">An (erste Mail)</IonLabel>
            <IonSelect aria-label="An" interface="popover" value={formular.an} disabled={empfaenger.length === 0}
              placeholder={empfaenger.length === 0 ? 'Keine Adresse bekannt' : 'Bitte wählen'}
              onIonChange={(e) => aendern({ an: String(e.detail.value ?? '') })}>
              <IonSelectOption value="">{empfaenger.length === 0 ? 'Keine Adresse bekannt' : 'Bitte wählen'}</IonSelectOption>
              {empfaenger.map((e) => <IonSelectOption key={e.adresse} value={e.adresse}>{empfaengerText(e)}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
        ) : (
          <Feld label="An (E-Mail-Adresse der ersten Mail)" typ="email" wert={formular.an} onWert={(w) => aendern({ an: w })} autocomplete="email" />
        )}
        <IonItem lines="none" style={{ '--background': 'transparent' }}>
          <IonLabel position="stacked">Text der ersten Mail (freiwillig)</IonLabel>
          <IonTextarea aria-label="Text der Mail" value={formular.text} autoGrow={true} rows={4}
            onIonInput={(e) => aendern({ text: String(e.detail.value ?? '') })} />
        </IonItem>
      </IonList>
      <div style={{ display: 'flex', gap: 'var(--app-abstand-eng)', marginTop: 'var(--app-abstand-eng)' }}>
        <IonButton onClick={() => { void absenden(); }} disabled={sendet || !isOnline}>Vorgang anlegen</IonButton>
        <IonButton fill="clear" onClick={onSchliessen}>Abbrechen</IonButton>
      </div>
    </Abschnitt>
  );
};

const Vorgaenge: React.FC = () => {
  const router = useIonRouter();
  const zurueck = useSupportZurueck(SUPPORT_START);
  const { auswahl, setFilter, setArt, setGemeinde, setSuche, zuruecksetzen } = useVorgangsAuswahl();
  const liste = useVorgangsliste(auswahl);
  const { sichtbar, gemeinden, laedt, fehler, neuLaden, zaehlen } = liste;
  const [neuOffen, setNeuOffen] = useState(false);
  const mitGemeinde = auswahl.gemeinde !== 'alle';
  const mitArt = auswahl.art !== 'alle';
  const sucht = suchbegriff(auswahl.suche) !== '';
  const eingegrenzt = sucht || mitArt || mitGemeinde;

  // Art, Gemeinde und Suche stehen hinter dem Knopf „Filter", wie im Browser
  // (web/WebListenSeite): Der Knopf zählt, was gerade eingrenzt -- hier auch
  // die Suche, denn sie steht mit im zugeklappten Bereich. Ist beim Laden
  // schon etwas gewählt (?art=…, ?gemeinde=…), steht der Bereich offen, sonst
  // filterte etwas, das man nicht sieht. Ionic hält die Seite im Speicher;
  // setzt eine neue Adresse Art oder Gemeinde, klappt er ebenso auf.
  const filterId = useId();
  const aktiveFilter = [mitArt, mitGemeinde, sucht].filter(Boolean).length;
  const [filterOffen, setFilterOffen] = useState(eingegrenzt);
  const filterSchluessel = `${auswahl.art}|${auswahl.gemeinde}`;
  const [gesehenerFilter, setGesehenerFilter] = useState(filterSchluessel);
  if (filterSchluessel !== gesehenerFilter) {
    setGesehenerFilter(filterSchluessel);
    if (mitArt || mitGemeinde) setFilterOffen(true);
  }

  return (
    <IonPage>
      <AppKopfzeile
        titel={VORGAENGE_TITEL}
        onZurueck={zurueck}
        gemeindeUmschalter={false}
        rechts={(
          <>
            <IonButton
              className="support-filterknopf"
              aria-label={aktiveFilter > 0 ? `Filter, ${aktiveFilter} aktiv` : 'Filter'}
              // Als Wort, nicht als boolean: An ein Ionic-Element (Custom
              // Element) schreibt React 19 ein true als leeres Attribut -- am
              // Knopf im Shadow-DOM stand dann aria-expanded="" (gemessen
              // 12.10.2026), was kein Vorleseprogramm als offen liest.
              aria-expanded={filterOffen ? 'true' : 'false'}
              aria-controls={filterId}
              onClick={() => setFilterOffen((o) => !o)}
            >
              <IonIcon icon={ICON_FILTER} slot="icon-only" aria-hidden="true" />
              {aktiveFilter > 0 && <span className="support-filterknopf__zahl" aria-hidden="true">{aktiveFilter}</span>}
            </IonButton>
            <IonButton aria-label={mitGemeinde ? 'Gemeinde anschreiben' : 'Neuer Vorgang'} onClick={() => setNeuOffen((o) => !o)}>
              <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
            </IonButton>
          </>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel={VORGAENGE_TITEL} />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void neuLaden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {neuOffen && <NeuerVorgangAbschnitt organizationId={mitGemeinde ? auswahl.gemeinde : ''} onSchliessen={() => setNeuOffen(false)} />}

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonSegment scrollable value={auswahl.filter} aria-label={VORGANG_STAENDE_BESCHRIFTUNG} onIonChange={(e) => setFilter((e.detail.value as VorgangFilter) ?? 'offen')}>
            {/* Stände aus der gemeinsamen Beschreibung (seiten/supportVorgaenge.ts). */}
            {inFassung(VORGANG_STAENDE, 'app').map((f) => (
              <IonSegmentButton key={f.schluessel} value={f.schluessel}>
                <IonLabel>{f.kurz ?? f.label}{f.schluessel !== 'archiv' && zaehlen ? ` ${zaehlen[f.schluessel]}` : ''}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        {filterOffen && (
          <div id={filterId} role="group" aria-label="Filter">
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Art</IonLabel>
                <IonSelect aria-label="Art filtern" interface="popover" value={auswahl.art}
                  onIonChange={(e) => setArt(String(e.detail.value ?? 'alle') as VorgangArt | 'alle')}>
                  <IonSelectOption value="alle">{ALLE_ARTEN}</IonSelectOption>
                  {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={{ '--background': 'transparent' }}>
                <IonLabel position="stacked">Gemeinde</IonLabel>
                <IonSelect aria-label="Gemeinde filtern" interface="popover" value={auswahl.gemeinde}
                  onIonChange={(e) => setGemeinde(String(e.detail.value ?? 'alle'))}>
                  <IonSelectOption value="alle">{ALLE_GEMEINDEN}</IonSelectOption>
                  {gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{g.name}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              <Feld label="Suche" wert={auswahl.suche} onWert={setSuche} hinweis="Nummer, Betreff oder Gemeinde" />
            </IonList>
          </div>
        )}

        {laedt ? (
          <LoadingSpinner message="Vorgänge werden geladen..." />
        ) : fehler ? (
          <Ladefehler text="Die Vorgänge konnten nicht geladen werden." onErneut={() => { void neuLaden(); }} />
        ) : sichtbar.length === 0 ? (
          // Grenzen Art, Gemeinde oder Suche ein, sagt der Leerzustand das -- wie im Browser.
          eingegrenzt ? (
            <>
              <EmptyState icon={ICON_LISTE} title={VORGANG_KEINE_TREFFER.titel} message={VORGANG_KEINE_TREFFER.text(auswahl.suche)} />
              <div style={{ margin: '0 var(--app-abstand-basis)' }}>
                <IonButton expand="block" fill="outline" onClick={zuruecksetzen}>{VORGANG_KEINE_TREFFER.zuruecksetzen}</IonButton>
              </div>
            </>
          ) : (
            <EmptyState icon={ICON_LISTE} title={VORGANG_LEER_TITEL[auswahl.filter]} message={leerVon(VORGANG_STAENDE, auswahl.filter)} />
          )
        ) : (
          <Abschnitt icon={ICON_LISTE} titel={vorgaengeText(sichtbar.length)} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sichtbar.map((v) => {
                const status = VORGANG_STATUS[v.status];
                // Der Betreff hat die volle Breite zwischen Kreis und Pfeil;
                // Nummer, Art, Bereich, Gemeinde und Zeit stehen darunter, die
                // Marken in einer eigenen Zeile (12.10.2026: vorher standen die
                // Marken rechts daneben, der Betreff lief in einer 90 px schmalen
                // Spalte über fünf Zeilen, mit erzwungener Silbentrennung).
                const angaben = [
                  `Nr. ${v.id}`,
                  `${artKurz(v.art)}${v.bereich ? ` · ${bereichLabel(v.bereich)}` : ''}`,
                  istZugeordnet(v) ? v.gemeinde_name ?? `Gemeinde ${v.organization_id}` : ohneGemeindeText(v),
                  datumUhrzeit(v.letzte_aktivitaet),
                ];
                return (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={tastaturKlick}
                    onClick={() => router.push(`/admin/support/vorgaenge/${v.id}`)}
                    className="app-list-item app-list-item--organizations"
                    aria-label={`Vorgang ${v.id}: ${v.betreff}, ${status.label}${v.ungelesen > 0 ? `, ${v.ungelesen} ungelesene ${v.ungelesen === 1 ? 'Mail' : 'Mails'}` : ''}`}
                  >
                    <div className="app-list-item__row">
                      <div className="app-list-item__main">
                        <div className="app-zaehler-anker">
                          {/* Symbol und Farbe der Art, dieselbe Zuordnung wie im Browser
                              (ART_SYMBOL, ART_FARBE); bis 12.10.2026 trug jede Zeile
                              dasselbe Gebäude. */}
                          <div className={`app-icon-circle app-icon-circle--lg app-icon-circle--${ART_FARBE[v.art] ?? 'neutral'}`}>
                            <IonIcon icon={ART_SYMBOL[v.art] ?? ART_SYMBOL.sonstiges} />
                          </div>
                          <ZaehlerKugel anzahl={v.ungelesen} label="ungelesene Mails" />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title">{v.betreff || '(ohne Betreff)'}</div>
                          <Angabenzeile angaben={angaben} />
                          <div className="support-listenzeile__marken">
                            {v.dringlichkeit === 'dringend' && <Marke text="Dringend" farbe="var(--app-color-danger)" />}
                            <Marke text={status.kurz} farbe={STATUS_FARBE[v.status]} />
                          </div>
                        </div>
                      </div>
                      <IonIcon icon={ICON_WEITER_GEFUELLT} aria-hidden="true" className="support-listenzeile__pfeil" />
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
// Darstellung der App.
const SupportVorgaengePage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel={VORGAENGE_TITEL}>{breit ? <WebVorgaenge /> : <Vorgaenge />}</NurSupport>;
};

export default SupportVorgaengePage;
