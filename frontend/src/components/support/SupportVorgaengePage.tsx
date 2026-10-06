// Vorgänge der Support-Ansicht, /admin/support/vorgaenge
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Jedes Anliegen -- Anfrage von der Homepage, Support-Formular, Mail, vom
// Support angelegt -- ist ein Vorgang mit Nummer, Art, Bereich, Dringlichkeit,
// Status und Gemeinde. Die App zeigt sie als einfache Liste mit denselben
// Filtern wie der Browser (Offen, Neu, In Arbeit, Wartet, Archiv -- darin auch
// die erledigten), der Auswahl nach Art und Gemeinde und einer Suche; ein
// Antippen öffnet den Vorgang. Das Plus oben rechts legt einen neuen Vorgang an
// (bei gewählter Gemeinde heißt es „Schreiben"). Sammelaktionen gibt es nur im
// Browser. Im breiten Browserfenster steht die Tabelle der Web-Fassung.
//
// Die Logik steht in components/support/useVorgangsliste.ts und
// useNeuerVorgang.ts, dieselbe wie in der Web-Fassung.

import React, { useState } from 'react';
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
import { ICON_HINZUFUEGEN, ICON_LISTE, ICON_ORGANISATION, ICON_UHRZEIT, ICON_WEITER_GEFUELLT } from '../shared/icons';
import { datumUhrzeit } from '../../utils/dateUtils';
import { tastaturKlick } from '../../utils/tastatur';
import { triggerPullHaptic } from '../../utils/haptics';
import { empfaengerText, gemeindeName } from '../../utils/supportMail';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  VORGANG_FILTER,
  VORGANG_STATUS,
  artKurz,
  bereichIstPflicht,
  bereichLabel,
  vorgaengeText,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangFilter,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { SUPPORT_START } from '../../navigation/supportMenue';
import { useBreitesLayout } from '../../navigation/breitesLayout';
import { Abschnitt, Feld, Ladefehler, Marke, NurSupport } from './SupportBausteine';
import { useSupportZurueck } from './useSupportZurueck';
import { useVorgangsliste } from './useVorgangsliste';
import { useVorgangsAuswahl } from './useVorgangsAuswahl';
import { useNeuerVorgang } from './useNeuerVorgang';
import WebVorgaenge from './web/WebVorgaenge';

/** Farbe der Marke je Status -- dieselben Farben wie die Marken der Web-Fassung. */
const STATUS_FARBE: Record<VorgangStatus, string> = {
  neu: 'var(--app-color-warning)',
  in_arbeit: 'var(--app-color-info)',
  wartet: 'var(--app-color-neutral)',
  erledigt: 'var(--app-color-success)',
};

const FILTER_NAME: Record<VorgangFilter, string> = {
  offen: 'Offen',
  neu: VORGANG_STATUS.neu.kurz,
  in_arbeit: VORGANG_STATUS.in_arbeit.kurz,
  wartet: VORGANG_STATUS.wartet.kurz,
  archiv: 'Archiv',
};

const LEER_TEXT: Record<VorgangFilter, string> = {
  offen: 'Es gibt keinen offenen Vorgang. Neue Anfragen, Formulare und Mails erscheinen hier.',
  neu: 'Alle Vorgänge sind schon in Arbeit.',
  in_arbeit: 'Gerade ist kein Vorgang in Arbeit.',
  wartet: 'Kein Vorgang wartet auf eine Rückmeldung.',
  archiv: 'Erledigte und archivierte Vorgänge liegen hier.',
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
  const { auswahl, setFilter, setArt, setGemeinde, setSuche } = useVorgangsAuswahl();
  const liste = useVorgangsliste(auswahl);
  const { sichtbar, gemeinden, laedt, fehler, neuLaden, zaehlen } = liste;
  const [neuOffen, setNeuOffen] = useState(false);
  const mitGemeinde = auswahl.gemeinde !== 'alle';

  return (
    <IonPage>
      <AppKopfzeile
        titel="Vorgänge"
        onZurueck={zurueck}
        gemeindeUmschalter={false}
        rechts={(
          <IonButton aria-label={mitGemeinde ? 'Gemeinde anschreiben' : 'Neuer Vorgang'} onClick={() => setNeuOffen((o) => !o)}>
            <IonIcon icon={ICON_HINZUFUEGEN} slot="icon-only" />
          </IonButton>
        )}
      />
      <IonContent className="app-gradient-background" fullscreen>
        <AppKopfzeileGross titel="Vorgänge" />
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void neuLaden().finally(() => e.detail.complete()); }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent />
        </IonRefresher>

        {neuOffen && <NeuerVorgangAbschnitt organizationId={mitGemeinde ? auswahl.gemeinde : ''} onSchliessen={() => setNeuOffen(false)} />}

        <div style={{ margin: 'var(--app-abstand-basis)' }}>
          <IonSegment scrollable value={auswahl.filter} aria-label="Stand" onIonChange={(e) => setFilter((e.detail.value as VorgangFilter) ?? 'offen')}>
            {VORGANG_FILTER.map((f) => (
              <IonSegmentButton key={f} value={f}>
                <IonLabel>{FILTER_NAME[f]}{f !== 'archiv' && zaehlen ? ` ${zaehlen[f]}` : ''}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </div>

        <IonList style={{ background: 'transparent' }}>
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Art</IonLabel>
            <IonSelect aria-label="Art filtern" interface="popover" value={auswahl.art}
              onIonChange={(e) => setArt(String(e.detail.value ?? 'alle') as VorgangArt | 'alle')}>
              <IonSelectOption value="alle">Alle Arten</IonSelectOption>
              {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full" style={{ '--background': 'transparent' }}>
            <IonLabel position="stacked">Gemeinde</IonLabel>
            <IonSelect aria-label="Gemeinde filtern" interface="popover" value={auswahl.gemeinde}
              onIonChange={(e) => setGemeinde(String(e.detail.value ?? 'alle'))}>
              <IonSelectOption value="alle">Alle Gemeinden</IonSelectOption>
              {gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{g.name}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <Feld label="Suche" wert={auswahl.suche} onWert={setSuche} hinweis="Nummer, Betreff oder Gemeinde" />
        </IonList>

        {laedt ? (
          <LoadingSpinner message="Vorgänge werden geladen..." />
        ) : fehler ? (
          <Ladefehler text="Die Vorgänge konnten nicht geladen werden." onErneut={() => { void neuLaden(); }} />
        ) : sichtbar.length === 0 ? (
          <EmptyState icon={ICON_LISTE} title="Keine Vorgänge" message={LEER_TEXT[auswahl.filter]} />
        ) : (
          <Abschnitt icon={ICON_LISTE} titel={vorgaengeText(sichtbar.length)} farbe="organizations">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sichtbar.map((v) => {
                const status = VORGANG_STATUS[v.status];
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
                          <div className="app-icon-circle app-icon-circle--lg app-icon-circle--organizations">
                            <IonIcon icon={ICON_ORGANISATION} />
                          </div>
                          <ZaehlerKugel anzahl={v.ungelesen} label="ungelesene Mails" />
                        </div>
                        <div className="app-list-item__content">
                          <div className="app-list-item__title" style={{ hyphens: 'auto', overflowWrap: 'break-word' }}>{v.betreff || '(ohne Betreff)'}</div>
                          <div className="app-list-item__meta">
                            <span className="app-list-item__meta-item">Nr. {v.id}</span>
                            <span className="app-list-item__meta-item">{artKurz(v.art)}{v.bereich ? ` · ${bereichLabel(v.bereich)}` : ''}</span>
                            <span className="app-list-item__meta-item">{v.gemeinde_name ?? 'Nicht zugeordnet'}</span>
                            <span className="app-list-item__meta-item">
                              <IonIcon icon={ICON_UHRZEIT} style={{ color: 'var(--app-text-users)' }} />
                              {datumUhrzeit(v.letzte_aktivitaet)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {v.dringlichkeit === 'dringend' && <span style={{ marginRight: 'var(--app-abstand-eng)' }}><Marke text="Dringend" farbe="var(--app-color-danger)" /></span>}
                      <Marke text={status.kurz} farbe={STATUS_FARBE[v.status]} />
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
// Darstellung der App.
const SupportVorgaengePage: React.FC = () => {
  const breit = useBreitesLayout();
  return <NurSupport titel="Vorgänge">{breit ? <WebVorgaenge /> : <Vorgaenge />}</NurSupport>;
};

export default SupportVorgaengePage;
