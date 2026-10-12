// Die Modale der Support-Ansicht in der App (Simon, 11.10.2026: „Antwort
// öffnet etwas auf Handy … Zuordnen auch über ein Modal auf Web und App";
// docs/planung/support-detailseiten.md, App F). Kopfzeile wie jedes Modal der
// App: Abbrechen links, Titel, Hauptaktion rechts.
//
//   - Antworten: oben die Mail, auf die geantwortet wird, dann das Formular
//     mit „Danach"; „Senden" in der Kopfzeile und unten; nach dem Senden
//     schließt es sich.
//   - Einordnen: Status, Art, Bereich (Pflicht geprüft), Dringlichkeit,
//     Gemeinde und Betreff -- EIN Speichern (useEinordnenFormular, wie im
//     Browser; Frage 5).
//   - Notiz: die interne Notiz; eine ungespeicherte überlebt das Neuladen.
//   - Lizenz ändern: Tarif und Laufzeit der Gemeinde (useLizenzAendern).
//   - Gemeinde anlegen: Vollbild mit dem Formular aus der Anfrage.
//   - Einsortieren: eine Mail in einen bestehenden oder neuen Vorgang legen;
//     aus einem Vorgang heraus „In anderen Vorgang verschieben" bzw. „In
//     neuen Vorgang herauslösen" -- dann ohne Wahl dazwischen.
//
// Wer etwas eingegeben hat, wird vor dem Schließen gefragt -- auch beim
// Wischen (canDismiss). Die Web-Fassung hat eigene, kompakte Dialoge
// (web/WebDialog); die Logik dahinter ist dieselbe.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { ICON_HAKEN, ICON_LISTE, ICON_SCHLIESSEN, ICON_SENDEN_GEFUELLT } from '../shared/icons';
import {
  ARTEN,
  BEREICHE,
  DRINGLICHKEITEN,
  STATUS_REIHE,
  VORGANG_STATUS,
  bereichIstPflicht,
  type Dringlichkeit,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../utils/supportVorgaenge';
import { gemeindeName } from '../../utils/supportMail';
import { EIGENES_LIMIT, TARIF_OPTIONEN } from '../../utils/lizenzen';
import { laufzeitAngabe } from '../../utils/supportWeb';
import { tarifAngabe, type LaufzeitWahl } from '../../utils/lizenzAendern';
import { inFassung } from '../../seiten/beschreibung';
import { EINSORTIEREN_IN, EINSORTIEREN_IN_BESCHRIFTUNG, vorgangEintrag, vorgangPasstZurSuche } from '../../seiten/supportEinsortieren';
import { LIZENZ_TEXT, MAIL_MENUE } from '../../seiten/supportDetail';
import { Feld } from './SupportBausteine';
import { AntwortFormularInhalt, type AntwortFormularProps } from './SupportMailTeile';
import SupportGemeindeAnlegen from './SupportGemeindeAnlegen';
import { useAntwortEditor } from './useAntwortEditor';
import { useEinordnenFormular } from './useEinordnenFormular';
import { useEinsortieren, type EinsortierenModus, type EinsortierenVorgabe } from './useEinsortieren';
import { useLizenzAendern } from './useLizenzAendern';
import type { VorgangDetailDaten } from './useVorgangDetail';
import type { GemeindeAnlegenDaten } from './useGemeindeAnlegen';
import type { GemeindeAnfrage } from '../../types/support';
import type { VorgangGemeinde } from '../../utils/supportVorgaenge';

const INHALT_ABSTAND = { padding: 'var(--app-abstand-basis)' } as const;
const HINWEIS_STIL = { margin: '0 0 var(--app-abstand-kompakt)', color: 'var(--app-text-body)', fontSize: 'var(--app-text-sekundaer)' } as const;
const FELD_STIL = { '--background': 'transparent' } as const;

// --- Rahmen ------------------------------------------------------------------------

interface Steuerung {
  /** Schließen wie mit „Abbrechen": bei Eingaben erst die Rückfrage. */
  schliessen: () => void;
  /** Schließen ohne Rückfrage -- nach dem Speichern. */
  ohneFrage: () => void;
  /** Hat der Inhalt etwas, das beim Schließen verloren ginge? */
  schutzRef: React.MutableRefObject<(() => boolean) | null>;
}

const ModalSteuerung = createContext<Steuerung>({ schliessen: () => {}, ohneFrage: () => {}, schutzRef: { current: null } });

/** Der Inhalt eines Modals meldet, ob beim Schließen etwas verloren ginge (Rückfrage, auch beim Wischen). */
function useModalSchutz(geaendert: () => boolean): void {
  const { schutzRef } = useContext(ModalSteuerung);
  useEffect(() => {
    schutzRef.current = geaendert;
    return () => { schutzRef.current = null; };
  });
}

/**
 * Das Modal selbst: offen nach `offen`, geschlossen über Ionic, damit
 * canDismiss jeden Weg abfängt (Abbrechen, Wischen, Zurück). Ohne Ionic (in
 * den Tests) schließt „Abbrechen" direkt.
 */
const ModalRahmen: React.FC<{ offen: boolean; titel: string; onSchliessen: () => void; children: React.ReactNode }> = ({
  offen, titel, onSchliessen, children,
}) => {
  const modal = useRef<HTMLIonModalElement | null>(null);
  const schutzRef = useRef<(() => boolean) | null>(null);
  const freigegeben = useRef(false);
  const [presentAlert] = useIonAlert();

  const kannSchliessen = useCallback(async (): Promise<boolean> => {
    if (freigegeben.current || !schutzRef.current?.()) return true;
    return new Promise<boolean>((resolve) => {
      let entschieden = false;
      const entscheide = (wert: boolean) => { entschieden = true; resolve(wert); };
      presentAlert({
        header: 'Ungespeicherte Änderungen',
        message: 'Möchtest du die Änderungen verwerfen?',
        backdropDismiss: false,
        buttons: [
          { text: 'Abbrechen', role: 'cancel', handler: () => entscheide(false) },
          { text: 'Verwerfen', role: 'destructive', handler: () => entscheide(true) },
        ],
        onDidDismiss: () => { if (!entschieden) resolve(false); },
      });
    });
  }, [presentAlert]);

  const steuerung = useMemo<Steuerung>(() => {
    const schliessen = () => {
      const m = modal.current;
      if (m && typeof m.dismiss === 'function') {
        void m.dismiss();
        return;
      }
      // Ohne Ionic-Element (Tests): dieselbe Rückfrage, dann schließen.
      void kannSchliessen().then((ja) => {
        if (!ja) return;
        freigegeben.current = false;
        onSchliessen();
      });
    };
    return {
      schliessen,
      ohneFrage: () => { freigegeben.current = true; schliessen(); },
      schutzRef,
    };
  }, [kannSchliessen, onSchliessen]);

  return (
    <IonModal
      ref={modal}
      isOpen={offen}
      canDismiss={kannSchliessen}
      onDidDismiss={() => { freigegeben.current = false; onSchliessen(); }}
      aria-label={titel}
    >
      <ModalSteuerung.Provider value={steuerung}>{children}</ModalSteuerung.Provider>
    </IonModal>
  );
};

interface KopfAktion {
  label: string;
  icon: string;
  onKlick: () => void;
  gesperrt?: boolean;
  laeuft?: boolean;
}

/** Kopfzeile eines Modals: Abbrechen links, Titel, Hauptaktion rechts. */
const ModalKopf: React.FC<{ titel: string; aktion?: KopfAktion }> = ({ titel, aktion }) => {
  const { schliessen } = useContext(ModalSteuerung);
  return (
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton aria-label="Abbrechen" title="Abbrechen" className="app-modal-close-btn" onClick={schliessen}>
            <IonIcon icon={ICON_SCHLIESSEN} />
          </IonButton>
        </IonButtons>
        <IonTitle className={aktion ? undefined : 'support-modal__titel--frei'}>{titel}</IonTitle>
        {aktion && (
          <IonButtons slot="end">
            <IonButton aria-label={aktion.label} title={aktion.label} className="app-modal-submit-btn app-modal-submit-btn--settings"
              disabled={aktion.gesperrt || aktion.laeuft} onClick={aktion.onKlick}>
              {aktion.laeuft ? <IonSpinner name="crescent" /> : <IonIcon icon={aktion.icon} />}
            </IonButton>
          </IonButtons>
        )}
      </IonToolbar>
    </IonHeader>
  );
};

/** Rahmen mit Kopfzeile ohne eigene Aktion (Einsortieren). */
export const SupportModal: React.FC<{ offen: boolean; titel: string; onSchliessen: () => void; children: React.ReactNode }> = ({
  offen, titel, onSchliessen, children,
}) => (
  <ModalRahmen offen={offen} titel={titel} onSchliessen={onSchliessen}>
    <ModalKopf titel={titel} />
    <IonContent className="app-gradient-background">
      <div style={INHALT_ABSTAND}>{children}</div>
    </IonContent>
  </ModalRahmen>
);

// --- Antworten ---------------------------------------------------------------------

const AntwortInhalt: React.FC<{ formular: AntwortFormularProps }> = ({ formular }) => {
  const { ohneFrage } = useContext(ModalSteuerung);
  const editor = useAntwortEditor({
    ...formular,
    onGesendet: () => {
      formular.onGesendet?.();
      ohneFrage();
    },
  });
  useModalSchutz(() => editor.entwurf.text.trim() !== '');
  return (
    <>
      <ModalKopf
        titel="Antworten"
        aktion={{ label: 'Senden', icon: ICON_SENDEN_GEFUELLT, onKlick: editor.abschicken, gesperrt: editor.serverAus || !editor.isOnline, laeuft: editor.sendet }}
      />
      <IonContent className="app-gradient-background">
        <div style={INHALT_ABSTAND}><AntwortFormularInhalt editor={editor} /></div>
      </IonContent>
    </>
  );
};

/** Antworten: das Formular im Modal; nach dem Senden schließt es sich. */
export const AntwortModal: React.FC<{ offen: boolean; onSchliessen: () => void; formular: AntwortFormularProps }> = ({
  offen, onSchliessen, formular,
}) => (
  <ModalRahmen offen={offen} titel="Antworten" onSchliessen={onSchliessen}>
    <AntwortInhalt formular={formular} />
  </ModalRahmen>
);

// --- Einordnen ---------------------------------------------------------------------

const EinordnenInhalt: React.FC<{ d: VorgangDetailDaten }> = ({ d }) => {
  const { ohneFrage } = useContext(ModalSteuerung);
  const f = useEinordnenFormular(d);
  useModalSchutz(() => f.geaendert);
  const e = f.entwurf;
  const speichern = async () => {
    if (await f.speichern()) ohneFrage();
  };
  return (
    <>
      <ModalKopf titel="Einordnen" aktion={{ label: 'Speichern', icon: ICON_HAKEN, onKlick: () => { void speichern(); }, gesperrt: !f.isOnline || !e, laeuft: f.speichert }} />
      <IonContent className="app-gradient-background">
        {e && (
          <div style={INHALT_ABSTAND}>
            {f.fehler && <p role="alert" className="support-modal__fehler">{f.fehler}</p>}
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">Status</IonLabel>
                <IonSelect aria-label="Status" interface="popover" value={e.status}
                  onIonChange={(x) => { const w = String(x.detail.value ?? ''); if (w) f.aendern({ status: w as VorgangStatus }); }}>
                  {STATUS_REIHE.map((s) => <IonSelectOption key={s} value={s}>{VORGANG_STATUS[s].label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              {f.hinweis && <p className="support-modal__zeile" style={{ margin: 'var(--app-abstand-eng) var(--app-abstand-basis)' }}>{f.hinweis}</p>}
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">Art</IonLabel>
                <IonSelect aria-label="Art" interface="popover" value={e.art}
                  onIonChange={(x) => { const w = String(x.detail.value ?? ''); if (w) f.aendern({ art: w as VorgangArt }); }}>
                  {ARTEN.map((a) => <IonSelectOption key={a.wert} value={a.wert}>{a.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">{bereichIstPflicht(e.art) ? 'Bereich *' : 'Bereich'}</IonLabel>
                <IonSelect aria-label="Bereich" interface="popover" value={e.bereich}
                  onIonChange={(x) => f.aendern({ bereich: String(x.detail.value ?? '') as VorgangBereich | '' })}>
                  <IonSelectOption value="">{bereichIstPflicht(e.art) ? 'Bitte wählen' : 'Kein Bereich'}</IonSelectOption>
                  {BEREICHE.map((b) => <IonSelectOption key={b.wert} value={b.wert}>{b.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">Dringlichkeit</IonLabel>
                <IonSelect aria-label="Dringlichkeit" interface="popover" value={e.dringlichkeit}
                  onIonChange={(x) => { const w = String(x.detail.value ?? ''); if (w) f.aendern({ dringlichkeit: w as Dringlichkeit }); }}>
                  {DRINGLICHKEITEN.map((x) => <IonSelectOption key={x.wert} value={x.wert}>{x.hinweis ? `${x.label} – ${x.hinweis}` : x.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">Gemeinde</IonLabel>
                <IonSelect aria-label="Gemeinde" interface="popover" value={e.gemeinde}
                  onIonChange={(x) => f.aendern({ gemeinde: String(x.detail.value ?? '') })}>
                  {f.gemeindeOptionen.map((o) => <IonSelectOption key={o.wert || 'keine'} value={o.wert}>{o.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              {f.gemeindenFehlt && <p role="status" className="support-modal__fehler">Die Gemeinden konnten nicht geladen werden.</p>}
              <Feld label="Betreff" pflicht wert={e.betreff} onWert={(w) => f.aendern({ betreff: w })} />
            </IonList>
          </div>
        )}
      </IonContent>
    </>
  );
};

/** Einordnen: Status, Art, Bereich, Dringlichkeit, Gemeinde, Betreff -- gespeichert mit „Speichern". */
export const EinordnenModal: React.FC<{ offen: boolean; onSchliessen: () => void; d: VorgangDetailDaten }> = ({ offen, onSchliessen, d }) => (
  <ModalRahmen offen={offen} titel="Einordnen" onSchliessen={onSchliessen}>
    <EinordnenInhalt d={d} />
  </ModalRahmen>
);

// --- Notiz -------------------------------------------------------------------------

const NotizInhalt: React.FC<{ d: VorgangDetailDaten }> = ({ d }) => {
  const { ohneFrage } = useContext(ModalSteuerung);
  useModalSchutz(() => d.notizGeaendert);
  const speichern = async () => {
    if (await d.notizSpeichern()) ohneFrage();
  };
  return (
    <>
      <ModalKopf titel="Notiz" aktion={{ label: 'Speichern', icon: ICON_HAKEN, onKlick: () => { void speichern(); }, gesperrt: !d.notizGeaendert || !d.isOnline, laeuft: d.speichert }} />
      <IonContent className="app-gradient-background">
        <div style={INHALT_ABSTAND}>
          <p style={HINWEIS_STIL}>Nur für den Support sichtbar.</p>
          <IonList style={{ background: 'transparent' }}>
            <IonItem lines="none" style={FELD_STIL}>
              <IonLabel position="stacked">Interne Notiz</IonLabel>
              <IonTextarea aria-label="Interne Notiz" value={d.notiz} autoGrow={true} rows={6} onIonInput={(e) => d.setNotiz(String(e.detail.value ?? ''))} />
            </IonItem>
          </IonList>
        </div>
      </IonContent>
    </>
  );
};

/**
 * Notiz: ein Textfeld, „Speichern" erst nach einer Änderung. Der Entwurf
 * steht im Vorgang (useVorgangDetail) -- ein Neuladen überschreibt ihn nicht.
 * Wer ohne zu speichern schließt, verwirft ihn (nach der Rückfrage).
 */
export const NotizModal: React.FC<{ offen: boolean; onSchliessen: () => void; d: VorgangDetailDaten }> = ({ offen, onSchliessen, d }) => (
  <ModalRahmen
    offen={offen}
    titel="Notiz"
    onSchliessen={() => {
      // Geschlossen ohne Speichern: wieder der Stand des Vorgangs.
      d.setNotiz(d.vorgang?.notiz ?? '');
      onSchliessen();
    }}
  >
    <NotizInhalt d={d} />
  </ModalRahmen>
);

// --- Lizenz ändern -----------------------------------------------------------------

const LizenzInhalt: React.FC<{ gemeinde: VorgangGemeinde; onLink: (href: string) => void }> = ({ gemeinde, onLink }) => {
  const { ohneFrage, schliessen } = useContext(ModalSteuerung);
  const l = useLizenzAendern(gemeinde);
  useModalSchutz(() => l.geaendert);
  const f = l.formular;
  const speichern = async () => {
    if (await l.speichern()) ohneFrage();
  };
  // „heute: Testphase bis 20.10. · 3 von 5 Konfis" -- der Tarif nur, wenn die Laufzeit ihn nicht schon nennt.
  const tarifName = tarifAngabe(gemeinde.max_konfis).name;
  const laufzeit = laufzeitAngabe(gemeinde).text;
  const heute = [
    laufzeit.startsWith(tarifName) ? laufzeit : `${tarifName} · ${laufzeit}`,
    `${gemeinde.konfi_count ?? 0}${gemeinde.max_konfis ? ` von ${gemeinde.max_konfis}` : ''} Konfis`,
  ].join(' · ');
  const tarifWert = f ? (f.eigenesLimit ? EIGENES_LIMIT : f.tarif) : '';
  return (
    <>
      <ModalKopf titel={LIZENZ_TEXT.aendern}
        aktion={{ label: 'Speichern', icon: ICON_HAKEN, onKlick: () => { void speichern(); }, gesperrt: !l.geaendert || !l.isOnline || !!l.fehler, laeuft: l.speichert }} />
      <IonContent className="app-gradient-background">
        {f && (
          <div style={INHALT_ABSTAND}>
            <p className="support-modal__zeile">{`${gemeinde.display_name} · heute: ${heute}`}</p>
            {l.wunschUebernehmen && l.wunschName && (
              <IonButton className="support-modal__mehrzeilig" expand="block" fill="outline" onClick={l.wunschUebernehmen}>{LIZENZ_TEXT.wunschUebernehmen(l.wunschName)}</IonButton>
            )}
            <IonList style={{ background: 'transparent' }}>
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">{LIZENZ_TEXT.felder.tarif}</IonLabel>
                <IonSelect aria-label={LIZENZ_TEXT.felder.tarif} interface="popover" value={tarifWert}
                  onIonChange={(x) => {
                    const w = String(x.detail.value ?? '');
                    if (w === EIGENES_LIMIT) l.aendern({ eigenesLimit: true, tarif: f.tarif });
                    else l.aendern({ eigenesLimit: false, tarif: w });
                  }}>
                  {TARIF_OPTIONEN.map((t) => <IonSelectOption key={t.name} value={t.wert}>{t.text}</IonSelectOption>)}
                  <IonSelectOption value={EIGENES_LIMIT}>{LIZENZ_TEXT.felder.eigenesLimit}</IonSelectOption>
                </IonSelect>
              </IonItem>
              {f.eigenesLimit && (
                <Feld label={LIZENZ_TEXT.felder.limitZahl} typ="number" wert={f.tarif} onWert={(w) => l.aendern({ tarif: w })} />
              )}
              <IonItem lines="full" style={FELD_STIL}>
                <IonLabel position="stacked">{LIZENZ_TEXT.felder.laufzeit}</IonLabel>
                <IonSelect aria-label={LIZENZ_TEXT.felder.laufzeit} interface="popover" value={f.laufzeit} disabled={l.laufzeitGesperrt}
                  onIonChange={(x) => l.aendern({ laufzeit: String(x.detail.value ?? 'unveraendert') as LaufzeitWahl })}>
                  {l.laufzeitWahlen.map((w) => <IonSelectOption key={w.wert} value={w.wert}>{w.label}</IonSelectOption>)}
                </IonSelect>
              </IonItem>
              {l.laufzeitGesperrt && <p role="status" className="support-modal__fehler">{LIZENZ_TEXT.stammFehlt}</p>}
              {f.laufzeit === 'datum' && (
                <IonItem lines="full" style={FELD_STIL}>
                  <IonLabel position="stacked">{LIZENZ_TEXT.felder.datum}</IonLabel>
                  <IonInput aria-label={LIZENZ_TEXT.felder.datum} type="date" value={f.datum} onIonInput={(x) => l.aendern({ datum: String(x.detail.value ?? '') })} />
                </IonItem>
              )}
              <IonItem lines="full" style={FELD_STIL}>
                <IonToggle className="support-modal__schalter" aria-label={LIZENZ_TEXT.testphaseSchalter} checked={f.testphase} disabled={l.laufzeitGesperrt}
                  onIonChange={(x) => l.aendern({ testphase: x.detail.checked })}>
                  {LIZENZ_TEXT.testphaseSchalter}
                </IonToggle>
              </IonItem>
            </IonList>
            {/* Ein ungültiges Limit oder ein fehlendes Datum steht an der Stelle der Vorschau -- sie rechnete
                sonst mit dem alten Limit (wie im Browser, WebLizenzAendern; bis 12.10.2026 stand hier beides). */}
            {l.fehler ? (
              <p role="alert" className="support-modal__fehler">{l.fehler}</p>
            ) : l.vorschau && (
              <div role="status" style={{ margin: 'var(--app-abstand-mittel) 0' }}>
                <p className="support-modal__zeile" style={{ color: 'var(--app-text-primary)' }}>{l.vorschau.text}</p>
                {l.vorschau.warnung && <p className="support-modal__zeile" style={{ color: 'var(--app-text-warnung)' }}>{l.vorschau.warnung}</p>}
                {l.vorschau.gesperrt && <p className="support-modal__zeile" style={{ color: 'var(--app-text-warnung)' }}>{l.vorschau.gesperrt}</p>}
              </div>
            )}
            {l.formularLink && (
              <IonButton fill="clear" size="small" onClick={() => { const ziel = l.formularLink as string; schliessen(); onLink(ziel); }}>
                {LIZENZ_TEXT.formularLink}
              </IonButton>
            )}
          </div>
        )}
      </IonContent>
    </>
  );
};

/** Lizenz ändern: Tarif, Laufzeit und Testphase der Gemeinde; Speichern über die bestehenden Gemeinde-Routen. */
export const LizenzModal: React.FC<{ offen: boolean; onSchliessen: () => void; gemeinde: VorgangGemeinde | null; onLink: (href: string) => void }> = ({
  offen, onSchliessen, gemeinde, onLink,
}) => (
  <ModalRahmen offen={offen && gemeinde !== null} titel={LIZENZ_TEXT.aendern} onSchliessen={onSchliessen}>
    {gemeinde && <LizenzInhalt gemeinde={gemeinde} onLink={onLink} />}
  </ModalRahmen>
);

// --- Gemeinde anlegen --------------------------------------------------------------

const AnlegenInhalt: React.FC<{ anfrage: GemeindeAnfrage; d: GemeindeAnlegenDaten }> = ({ anfrage, d }) => {
  const { ohneFrage } = useContext(ModalSteuerung);
  // Solange nicht angelegt ist, fragt das Schließen bei Änderungen zurück -- sonst ginge etwa ein erzeugtes Passwort verloren.
  useModalSchutz(() => d.geaendert && !d.angelegt);
  // Angelegt: das Modal geht von selbst zu (einmal); der Stand zeigt den Benutzernamen.
  const angelegt = d.angelegt !== null;
  const zu = useRef(false);
  useEffect(() => {
    if (!angelegt || zu.current) return;
    zu.current = true;
    ohneFrage();
  }, [angelegt, ohneFrage]);
  return (
    <>
      <ModalKopf titel="Gemeinde anlegen" aktion={{ label: 'Anlegen', icon: ICON_HAKEN, onKlick: () => { void d.anlegen(); }, gesperrt: !d.isOnline || !d.formular, laeuft: d.legtAn }} />
      <IonContent className="app-gradient-background">
        <SupportGemeindeAnlegen anfrage={anfrage} d={d} />
      </IonContent>
    </>
  );
};

/** Gemeinde anlegen: Vollbild mit dem vorbelegten Formular; Wischen fragt bei Änderungen zurück. */
export const GemeindeAnlegenModal: React.FC<{ offen: boolean; onSchliessen: () => void; anfrage: GemeindeAnfrage | null; d: GemeindeAnlegenDaten }> = ({
  offen, onSchliessen, anfrage, d,
}) => (
  <ModalRahmen offen={offen && anfrage !== null} titel="Gemeinde anlegen" onSchliessen={onSchliessen}>
    {anfrage && <AnlegenInhalt anfrage={anfrage} d={d} />}
  </ModalRahmen>
);

// --- Einsortieren ------------------------------------------------------------------

/** Einsortieren: bestehender Vorgang mit Suche oder ein neuer Vorgang. */
const EinsortierenInhalt: React.FC<{
  mail: { id: number; betreff: string | null };
  onFertig: (vorgangId: number | null) => void;
  ausVorgang: number | null;
  modus?: EinsortierenModus;
  vorgabe: EinsortierenVorgabe | null;
}> = ({ mail, onFertig, ausVorgang, modus, vorgabe }) => {
  const z = useEinsortieren(mail, onFertig, { ausVorgang, modus, vorgabe });
  const [suche, setSuche] = useState('');
  const treffer = useMemo(() => (z.vorgaenge ?? []).filter((v) => vorgangPasstZurSuche(v, suche)), [z.vorgaenge, suche]);
  const pflicht = bereichIstPflicht(z.neu.art);
  const knopf = ausVorgang === null ? 'Einsortieren' : z.modus === 'neu' ? 'Herauslösen' : 'Verschieben';

  return (
    <>
      <p style={HINWEIS_STIL}>{z.hinweis}</p>
      {z.fehler && <p role="alert" style={{ ...HINWEIS_STIL, color: 'var(--app-text-fehler)' }}>{z.fehler}</p>}
      {/* Aus dem Menü einer Mail ist die Handlung schon gewählt (Verschieben oder Herauslösen): keine
          Wahl dazwischen, sonst liefen Titel und Knopf auseinander -- wie im Browser (WebEinsortieren). */}
      {ausVorgang === null && (
        <IonSegment value={z.modus} aria-label={EINSORTIEREN_IN_BESCHRIFTUNG} onIonChange={(e) => z.setModus((e.detail.value as EinsortierenModus) ?? 'bestehend')}>
          {inFassung(EINSORTIEREN_IN, 'app').map((m) => (
            <IonSegmentButton key={m.schluessel} value={m.schluessel}><IonLabel>{m.kurz ?? m.label}</IonLabel></IonSegmentButton>
          ))}
        </IonSegment>
      )}

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
        {knopf}
      </IonButton>
    </>
  );
};

/**
 * Einsortieren aus dem Posteingang, bzw. -- mit `ausVorgang` -- eine Mail aus
 * ihrem Vorgang „In anderen Vorgang verschieben" (Modus bestehend) oder „In
 * neuen Vorgang herauslösen" (Modus neu). Der Titel folgt dem, wenn kein
 * eigener übergeben ist.
 */
export const EinsortierenModal: React.FC<{
  offen: boolean;
  onSchliessen: () => void;
  mail: { id: number; betreff: string | null };
  /** Ein anderer Titel, wenn die Mail schon in einem Vorgang liegt. */
  titel?: string;
  onFertig: (vorgangId: number | null) => void;
  /** Die Mail liegt in diesem Vorgang: Er steht nicht zur Wahl, und die Mail geht allein. */
  ausVorgang?: number | null;
  /** Womit das Modal beginnt -- „In neuen Vorgang herauslösen" beginnt mit 'neu'. */
  modus?: EinsortierenModus;
  /**
   * Vorbelegung, wenn der Server den Absender kennt (nur aus dem Posteingang;
   * mit `ausVorgang` ohne Wirkung). Sie ist ein Startwert: Der Inhalt entsteht
   * mit jedem Öffnen neu (IonModal hängt ihn nur offen ein), so gilt die
   * Vorgabe des letzten Ladens -- ein Neuladen bei offenem Modal überschreibt
   * keine Wahl (darum steht sie nicht im key).
   */
  vorgabe?: EinsortierenVorgabe | null;
}> = ({ offen, onSchliessen, mail, titel, onFertig, ausVorgang = null, modus, vorgabe = null }) => {
  const eigenerTitel = titel ?? (ausVorgang === null ? 'Einsortieren' : modus === 'neu' ? MAIL_MENUE.herausloesen : MAIL_MENUE.verschieben);
  return (
    <SupportModal offen={offen} titel={eigenerTitel} onSchliessen={onSchliessen}>
      <EinsortierenInhalt key={`${mail.id}-${modus ?? 'bestehend'}`} mail={mail} ausVorgang={ausVorgang} modus={modus} vorgabe={vorgabe}
        onFertig={(id) => { onSchliessen(); onFertig(id); }} />
    </SupportModal>
  );
};
