// Die Modale der Support-Ansicht in der App (Simon, 11.10.2026: „Antwort
// öffnet etwas auf Handy … Zuordnen auch über ein Modal auf Web und App").
//
//   - Antworten: das Antwortformular (Textbausteine, Vorschau, Senden mit
//     Rückfrage); nach dem Senden schließt es sich.
//   - Einordnen: Art, Bereich, Dringlichkeit, Status und Gemeinde eines
//     Vorgangs; jede Änderung wird wie bisher sofort gespeichert.
//   - Einsortieren: eine Mail in einen bestehenden oder neuen Vorgang legen.
//
// Die Web-Fassung hat eigene, kompakte Dialoge (web/WebDialog); die Logik
// dahinter ist dieselbe (useAntwortEditor, useVorgangDetail, useEinsortieren).

import React, { useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { ICON_LISTE, ICON_SCHLIESSEN } from '../shared/icons';
import { gemeindeName } from '../../utils/supportMail';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  ERLEDIGT_HINWEIS,
  STATUS_REIHE,
  VORGANG_STATUS,
  bereichIstPflicht,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { inFassung } from '../../seiten/beschreibung';
import { EINSORTIEREN_IN, EINSORTIEREN_IN_BESCHRIFTUNG, vorgangEintrag, vorgangPasstZurSuche } from '../../seiten/supportEinsortieren';
import { Feld } from './SupportBausteine';
import { AntwortFormular, type AntwortFormularProps } from './SupportMailTeile';
import { useEinsortieren, type EinsortierenModus } from './useEinsortieren';
import type { VorgangDetailDaten } from './useVorgangDetail';

const INHALT_ABSTAND = { padding: 'var(--app-abstand-basis)' } as const;
const HINWEIS_STIL = { margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' } as const;
const FELD_STIL = { '--background': 'transparent' } as const;

/** Rahmen: Kopfleiste mit Titel und Schließen, darunter der Inhalt. */
export const SupportModal: React.FC<{ offen: boolean; titel: string; onSchliessen: () => void; children: React.ReactNode }> = ({
  offen, titel, onSchliessen, children,
}) => (
  <IonModal isOpen={offen} onDidDismiss={onSchliessen} aria-label={titel}>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{titel}</IonTitle>
        <IonButtons slot="start">
          <IonButton aria-label="Schließen" className="app-modal-close-btn" onClick={onSchliessen}>
            <IonIcon icon={ICON_SCHLIESSEN} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="app-gradient-background">
      <div style={INHALT_ABSTAND}>{children}</div>
    </IonContent>
  </IonModal>
);

/** Antworten: das Formular im Modal; nach dem Senden schließt es sich. */
export const AntwortModal: React.FC<{ offen: boolean; onSchliessen: () => void; formular: AntwortFormularProps }> = ({
  offen, onSchliessen, formular,
}) => (
  <SupportModal offen={offen} titel="Antworten" onSchliessen={onSchliessen}>
    <AntwortFormular
      {...formular}
      onGesendet={() => {
        formular.onGesendet?.();
        onSchliessen();
      }}
    />
  </SupportModal>
);

/** Einordnen: Art, Bereich, Dringlichkeit, Status, Gemeinde -- jede Änderung sofort gespeichert. */
export const EinordnenModal: React.FC<{ offen: boolean; onSchliessen: () => void; d: VorgangDetailDaten }> = ({ offen, onSchliessen, d }) => {
  const { vorgang, gemeinden, einordnen, isOnline } = d;
  if (!vorgang) return null;
  const bereichFehlt = bereichIstPflicht(vorgang.art) && vorgang.bereich === null;
  const gemeindeWert = vorgang.organization_id === null ? '' : String(vorgang.organization_id);
  return (
    <SupportModal offen={offen} titel="Einordnen" onSchliessen={onSchliessen}>
      <p style={HINWEIS_STIL}>Jede Änderung wird sofort gespeichert.</p>
      <IonList style={{ background: 'transparent' }}>
        <IonItem lines="full" style={FELD_STIL}>
          <IonLabel position="stacked">Status</IonLabel>
          <IonSelect aria-label="Status" interface="popover" value={vorgang.status} disabled={!isOnline}
            onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.status) void einordnen({ status: w as VorgangStatus }); }}>
            {STATUS_REIHE.map((s) => <IonSelectOption key={s} value={s}>{VORGANG_STATUS[s].label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <p style={{ ...HINWEIS_STIL, margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-system)' }}>
          {ERLEDIGT_HINWEIS}
        </p>
        <IonItem lines="full" style={FELD_STIL}>
          <IonLabel position="stacked">Art</IonLabel>
          <IonSelect aria-label="Art" interface="popover" value={vorgang.art} disabled={!isOnline}
            onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.art) void einordnen({ art: w as VorgangArt }); }}>
            {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem lines="full" style={FELD_STIL}>
          <IonLabel position="stacked">{bereichIstPflicht(vorgang.art) ? 'Bereich *' : 'Bereich'}</IonLabel>
          <IonSelect aria-label="Bereich" interface="popover" value={vorgang.bereich ?? ''} disabled={!isOnline}
            onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w !== (vorgang.bereich ?? '')) void einordnen({ bereich: w ? (w as VorgangBereich) : null }); }}>
            <IonSelectOption value="">{bereichFehlt ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
            {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem lines="full" style={FELD_STIL}>
          <IonLabel position="stacked">Dringlichkeit</IonLabel>
          <IonSelect aria-label="Dringlichkeit" interface="popover" value={vorgang.dringlichkeit} disabled={!isOnline}
            onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w && w !== vorgang.dringlichkeit) void einordnen({ dringlichkeit: w as Dringlichkeit }); }}>
            {DRINGLICHKEITEN.map((x) => <IonSelectOption key={x.wert} value={x.wert}>{x.hinweis ? `${x.label} – ${x.hinweis}` : x.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem lines="none" style={FELD_STIL}>
          <IonLabel position="stacked">Gemeinde</IonLabel>
          <IonSelect aria-label="Gemeinde" interface="popover" value={gemeindeWert} disabled={!isOnline}
            onIonChange={(e) => { const w = String(e.detail.value ?? ''); if (w !== gemeindeWert) void einordnen({ organization_id: w ? Number(w) : null }); }}>
            <IonSelectOption value="">Keine Gemeinde</IonSelectOption>
            {vorgang.organization_id !== null && !gemeinden.some((g) => g.id === vorgang.organization_id) && (
              <IonSelectOption value={gemeindeWert}>{vorgang.gemeinde_name ?? `Gemeinde ${vorgang.organization_id}`}</IonSelectOption>
            )}
            {gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
      </IonList>
      <IonButton expand="block" fill="outline" style={{ marginTop: 'var(--app-abstand-mittel)' }} onClick={onSchliessen}>
        Fertig
      </IonButton>
    </SupportModal>
  );
};

/** Einsortieren: bestehender Vorgang mit Suche oder ein neuer Vorgang. */
const EinsortierenInhalt: React.FC<{ mail: { id: number; betreff: string | null }; onFertig: (vorgangId: number | null) => void }> = ({
  mail, onFertig,
}) => {
  const z = useEinsortieren(mail, onFertig);
  const [suche, setSuche] = useState('');
  const treffer = useMemo(() => (z.vorgaenge ?? []).filter((v) => vorgangPasstZurSuche(v, suche)), [z.vorgaenge, suche]);
  const pflicht = bereichIstPflicht(z.neu.art);

  return (
    <>
      <p style={HINWEIS_STIL}>Der ganze Faden geht mit — auch spätere Antworten darauf ordnet der Server dann selbst zu.</p>
      {z.fehler && <p role="alert" style={{ ...HINWEIS_STIL, color: 'var(--app-text-fehler)' }}>{z.fehler}</p>}
      <IonSegment value={z.modus} aria-label={EINSORTIEREN_IN_BESCHRIFTUNG} onIonChange={(e) => z.setModus((e.detail.value as EinsortierenModus) ?? 'bestehend')}>
        {inFassung(EINSORTIEREN_IN, 'app').map((m) => (
          <IonSegmentButton key={m.schluessel} value={m.schluessel}><IonLabel>{m.kurz ?? m.label}</IonLabel></IonSegmentButton>
        ))}
      </IonSegment>

      {z.modus === 'bestehend' ? (
        <IonList style={{ background: 'transparent' }}>
          <Feld label="Vorgang suchen" wert={suche} onWert={setSuche} hinweis="Nummer, Betreff oder Gemeinde" />
          <IonItem lines="full" style={FELD_STIL}>
            <IonLabel position="stacked">Vorgang</IonLabel>
            <IonSelect aria-label="Vorgang" interface="popover" value={z.vorgangWahl} disabled={treffer.length === 0}
              placeholder={z.vorgaenge && z.vorgaenge.length === 0 ? 'Es gibt keinen offenen Vorgang' : 'Bitte wählen'}
              onIonChange={(e) => z.setVorgangWahl(String(e.detail.value ?? ''))}>
              <IonSelectOption value="">Bitte wählen</IonSelectOption>
              {treffer.map((v) => (
                <IonSelectOption key={v.id} value={String(v.id)}>
                  {`${vorgangEintrag(v).titel} · ${vorgangEintrag(v).beschreibung}`}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          {z.vorgaengeFehlen && (
            <p role="status" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)', fontSize: 'var(--app-text-meta)', color: 'var(--app-text-fehler)' }}>
              Die Vorgänge konnten nicht geladen werden.
            </p>
          )}
        </IonList>
      ) : (
        <IonList style={{ background: 'transparent' }}>
          <IonItem lines="full" style={FELD_STIL}>
            <IonLabel position="stacked">Art *</IonLabel>
            <IonSelect aria-label="Art" interface="popover" value={z.neu.art} placeholder="Bitte wählen"
              onIonChange={(e) => z.aendernNeu({ art: String(e.detail.value ?? '') as VorgangArt | '' })}>
              {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full" style={FELD_STIL}>
            <IonLabel position="stacked">{pflicht ? 'Bereich *' : 'Bereich'}</IonLabel>
            <IonSelect aria-label="Bereich" interface="popover" value={z.neu.bereich} placeholder={pflicht ? 'Bitte wählen' : 'Kein Bereich'}
              onIonChange={(e) => z.aendernNeu({ bereich: String(e.detail.value ?? '') as VorgangBereich | '' })}>
              <IonSelectOption value="">{pflicht ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
              {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <IonItem lines="full" style={FELD_STIL}>
            <IonLabel position="stacked">Dringlichkeit</IonLabel>
            <IonSelect aria-label="Dringlichkeit" interface="popover" value={z.neu.dringlichkeit}
              onIonChange={(e) => z.aendernNeu({ dringlichkeit: String(e.detail.value ?? 'normal') as Dringlichkeit })}>
              {DRINGLICHKEITEN.map((x) => <IonSelectOption key={x.wert} value={x.wert}>{x.hinweis ? `${x.label} – ${x.hinweis}` : x.label}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
          <Feld label="Betreff" pflicht wert={z.neu.betreff} onWert={(w) => z.aendernNeu({ betreff: w })} />
          <IonItem lines="none" style={FELD_STIL}>
            <IonLabel position="stacked">Gemeinde</IonLabel>
            <IonSelect aria-label="Gemeinde" interface="popover" value={z.neu.organizationId}
              onIonChange={(e) => z.aendernNeu({ organizationId: String(e.detail.value ?? '') })}>
              <IonSelectOption value="">Keine Gemeinde</IonSelectOption>
              {z.gemeinden.map((g) => <IonSelectOption key={g.id} value={String(g.id)}>{gemeindeName(g)}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
        </IonList>
      )}
      <IonButton expand="block" style={{ marginTop: 'var(--app-abstand-mittel)' }} onClick={() => { void z.absenden(); }} disabled={z.sendet || !z.isOnline}>
        <IonIcon icon={ICON_LISTE} slot="start" />
        Einsortieren
      </IonButton>
    </>
  );
};

export const EinsortierenModal: React.FC<{
  offen: boolean;
  onSchliessen: () => void;
  mail: { id: number; betreff: string | null };
  /** Ein anderer Titel, wenn die Mail schon in einem Vorgang liegt. */
  titel?: string;
  onFertig: (vorgangId: number | null) => void;
}> = ({ offen, onSchliessen, mail, titel = 'Einsortieren', onFertig }) => (
  <SupportModal offen={offen} titel={titel} onSchliessen={onSchliessen}>
    <EinsortierenInhalt mail={mail} onFertig={(id) => { onSchliessen(); onFertig(id); }} />
  </SupportModal>
);
