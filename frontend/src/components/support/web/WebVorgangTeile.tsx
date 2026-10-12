// Kleine Bausteine der Vorgänge in der Web-Fassung -- für Liste, Vorgang,
// Posteingang und die Dialoge:
//   - die Marken für Status und Dringlichkeit und die drei Auswahlfelder
//     Art, Bereich, Dringlichkeit (dieselben Felder, wo immer ein Vorgang
//     sortiert wird: Neuer Vorgang, Einsortieren, Einordnen);
//   - seit 11.10.2026 die Teile des Lesebereichs (docs/planung/
//     support-detailseiten.md, A bis C und G): der Kreis der Art, die
//     Stand-Zeile, die Knöpfe des Kopfes, die Notiz, die Antwortzeile unter
//     der jüngsten Mail und die Karten der Angaben. Der Lesebereich einer
//     Mail (WebPostDetail) nutzt StandZeile, KopfAktionen und KopfKnopf mit.
// Was sie zeigen, entscheidet die Regel-Stelle (utils/supportVorgaenge.ts:
// vorgangStand, vorgangAngaben); hier steht nur die Darstellung.

import React, { useEffect, useId, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_ANTWORTEN,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GRUPPE_GEFUELLT,
  ICON_HINZUFUEGEN,
  ICON_INFO,
  ICON_KATEGORIE,
  ICON_MAIL_GEFUELLT,
  ICON_ORGANISATION,
  ICON_ORGANISATION_GEFUELLT,
  ICON_PERSON,
  ICON_PERSON_GEFUELLT,
  ICON_SCHILD_GEFUELLT,
  ICON_SPERRE_GEFUELLT,
  ICON_TELEFON,
  ICON_TEXTDOKUMENT,
  ICON_UHRZEIT,
  ICON_UHRZEIT_GEFUELLT,
  ICON_WARNHINWEIS,
  ICON_ZUSAGE_GEFUELLT,
} from '../../shared/icons';
import AdresseMitUmbruch from '../AdresseMitUmbruch';
import WebAngaben, { type WebAngabe } from '../../web/WebAngaben';
import WebAuswahl from '../../web/WebAuswahl';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebPill from '../../web/WebPill';
import WebTextfeld from '../../web/WebTextfeld';
import {
  ARTEN,
  ART_SYMBOL,
  BEREICHE,
  DRINGLICHKEITEN,
  VORGANG_STATUS,
  bereichIstPflicht,
  type AngabeAktion,
  type AngabenKarte,
  type Dringlichkeit,
  type StandTon,
  type VorgangArt,
  type VorgangBereich,
  type VorgangStatus,
} from '../../../utils/supportVorgaenge';

/** Die Texte dieser Bausteine (nur im Browser; die gemeinsamen stehen in seiten/supportDetail.ts). */
const TEXT = {
  notiz: 'Interne Notiz',
  notizFeld: 'Interne Notiz (nur für den Support)',
  notizBearbeiten: 'Bearbeiten',
  notizSpeichern: 'Notiz speichern',
  notizAbbrechen: 'Abbrechen',
  mehr: 'mehr',
  weniger: 'weniger',
  antwortAn: (wer: string): string => `Antwort an ${wer} schreiben …`,
  antwortOhneName: 'Antwort schreiben …',
  vonPostfach: (postfach: string): string => `von ${postfach}`,
  antwortGesperrt: 'Antworten geht erst, wenn jemand dafür da ist – siehe Stand oben.',
  leitung: (anzahl: number): string => `Gemeindeleitung (${anzahl})`,
  leitungKeine: 'Noch keine Gemeindeleitung.',
  gesperrt: 'Gesperrt',
  keineEmail: 'Keine E-Mail',
  imVorgangAntworten: 'Im Vorgang antworten',
  /** Der Name eines Knopfes, der mehrfach dasteht: mit Ziel, der sichtbare Text bleibt sein Anfang. */
  mitZiel: (aktion: string, wer: string): string => `${aktion} an ${wer}`,
} as const;

/** Der Status als Marke, Kurzform („Wartet") mit dem ganzen Namen als Tooltip. */
export const StatusPill: React.FC<{ status: VorgangStatus }> = ({ status }) => {
  const info = VORGANG_STATUS[status] ?? VORGANG_STATUS.neu;
  return <WebPill ton={info.ton} title={info.label}>{info.kurz}</WebPill>;
};

/** „Dringend" als rote Marke -- bei „Normal" steht nichts da. */
export const DringlichPill: React.FC<{ dringlichkeit: Dringlichkeit }> = ({ dringlichkeit }) => (
  dringlichkeit === 'dringend' ? <WebPill ton="fehler">Dringend</WebPill> : null
);

/**
 * Der Kreis vor dem Titel eines Vorgangs und in seiner Listenzeile: das
 * Symbol der Art (ART_SYMBOL) auf ihrer Farbe. Zierde (aria-hidden) -- die
 * Art steht immer auch als Wort daneben.
 */
export const VorgangKreis: React.FC<{ art: VorgangArt; gross?: boolean }> = ({ art, gross = false }) => (
  <span className={`web-vorgang-kreis web-vorgang-kreis--${art}${gross ? ' web-vorgang-kreis--gross' : ''}`} aria-hidden="true">
    <IonIcon icon={ART_SYMBOL[art] ?? ART_SYMBOL.sonstiges} />
  </span>
);

export interface AuswahlfelderProps {
  art: VorgangArt | '';
  bereich: VorgangBereich | '';
  dringlichkeit: Dringlichkeit;
  onArt: (art: VorgangArt | '') => void;
  onBereich: (bereich: VorgangBereich | '') => void;
  onDringlichkeit: (dringlichkeit: Dringlichkeit) => void;
  /** Die Art ist noch nicht gewaehlt (neue Vorgaenge): „Bitte wählen" steht vorn. */
  artOffen?: boolean;
  deaktiviert?: boolean;
  /** Art und Bereich nebeneinander (Dialoge, wo die Höhe knapp ist); sonst untereinander. */
  paar?: boolean;
  /** Mit `paar`: ein Feld, das links neben der Dringlichkeit steht (Einordnen: Status). */
  nebenDringlichkeit?: React.ReactNode;
}

/**
 * Art, Bereich und Dringlichkeit als Auswahlfelder. Der Bereich ist bei Frage,
 * Fehler und Wunsch Pflicht (er traegt den Stern), sonst freiwillig.
 */
export const VorgangAuswahlfelder: React.FC<AuswahlfelderProps> = ({
  art, bereich, dringlichkeit, onArt, onBereich, onDringlichkeit, artOffen = false, deaktiviert = false, paar = false, nebenDringlichkeit,
}) => {
  const pflicht = bereichIstPflicht(art);
  const artFeld = (
    <WebAuswahl
      label="Art"
      pflicht
      deaktiviert={deaktiviert}
      wert={art}
      onWert={(w) => onArt(w as VorgangArt | '')}
      optionen={[
        ...(artOffen || art === '' ? [{ wert: '', label: 'Bitte wählen' }] : []),
        ...ARTEN.map((a) => ({ wert: a.wert, label: a.label })),
      ]}
    />
  );
  const bereichFeld = (
    <WebAuswahl
      label="Bereich"
      pflicht={pflicht}
      deaktiviert={deaktiviert}
      wert={bereich}
      onWert={(w) => onBereich(w as VorgangBereich | '')}
      optionen={[
        { wert: '', label: pflicht ? 'Bitte wählen' : 'Kein Bereich' },
        ...BEREICHE.map((b) => ({ wert: b.wert, label: b.label })),
      ]}
      hinweis={pflicht && !bereich ? 'Bei Frage, Fehler und Wunsch gehört ein Bereich dazu.' : undefined}
    />
  );
  const dringlichkeitFeld = (
    <WebAuswahl
      label="Dringlichkeit"
      deaktiviert={deaktiviert}
      wert={dringlichkeit}
      onWert={(w) => onDringlichkeit(w as Dringlichkeit)}
      optionen={DRINGLICHKEITEN.map((d) => ({ wert: d.wert, label: d.hinweis ? `${d.label} – ${d.hinweis}` : d.label }))}
    />
  );
  if (paar && nebenDringlichkeit) {
    return (
      <>
        <div className="web-feldpaar">{nebenDringlichkeit}{dringlichkeitFeld}</div>
        <div className="web-feldpaar">{artFeld}{bereichFeld}</div>
      </>
    );
  }
  return paar ? (
    <>
      <div className="web-feldpaar">{artFeld}{bereichFeld}</div>
      {dringlichkeitFeld}
    </>
  ) : (
    <>
      {artFeld}
      {bereichFeld}
      {dringlichkeitFeld}
    </>
  );
};

// --- Stand ---------------------------------------------------------------------------

const STAND_SYMBOL: Readonly<Record<StandTon, string>> = {
  warnung: ICON_UHRZEIT,
  neutral: ICON_UHRZEIT,
  hinweis: ICON_INFO,
  erfolg: ICON_ZUSAGE_GEFUELLT,
};

export interface StandZeileProps {
  /** Wer dran ist und seit wann (vorgangStand bzw. mailStand). */
  satz: string;
  ton: StandTon;
  /** Eine zweite, leisere Zeile (Lizenz heute …) in ihrem eigenen Ton. */
  zusatz?: { text: string; ton: StandTon } | null;
}

/** Der Stand in einer Zeile unter dem Kopf: wer dran ist und seit wann -- im Ton des Falls. */
export const StandZeile: React.FC<StandZeileProps> = ({ satz, ton, zusatz }) => (
  <div className={`web-stand web-stand--${ton}`} role="status">
    <IonIcon icon={STAND_SYMBOL[ton]} className="web-stand__symbol" aria-hidden="true" />
    <div className="web-stand__text">
      <p className="web-stand__satz">{satz}</p>
      {zusatz && <p className={`web-stand__zusatz web-stand__zusatz--${zusatz.ton}`}>{zusatz.text}</p>}
    </div>
  </div>
);

// --- Knöpfe des Kopfes -----------------------------------------------------------------

export interface KopfKnopfProps {
  icon: string;
  label: string;
  /** Tooltip; ohne: das Label. */
  titel?: string;
  /** primaer: der eine Hauptknopf rechts außen. */
  art?: 'primaer' | 'sekundaer' | 'gefahr';
  /**
   * Wann nur das Symbol bleibt (Name dann in aria-label und Tooltip):
   * 'immer' (Löschen, Archivieren, Ablehnen), unter 760 bzw. 600 px Breite des
   * Lesebereichs; ohne Angabe trägt der Knopf immer Text (Hauptknopf).
   */
  symbol?: 'immer' | 'unter760' | 'unter600';
  onClick?: () => void;
  /** Ein Link (Gemeinde öffnen) statt eines Knopfes. */
  href?: string;
  disabled?: boolean;
}

/**
 * Ein Knopf im Kopf des Lesebereichs. Wie schmal er wird, richtet sich nach
 * der Breite des Lesebereichs, nicht des Fensters (Container-Abfragen in
 * theme/web/support.css): Neben der Liste (740 px) wird „Einordnen" zum
 * Symbol, bei 580 px tragen nur noch der Hauptknopf Text.
 */
export const KopfKnopf: React.FC<KopfKnopfProps> = ({ icon, label, titel, art = 'sekundaer', symbol, onClick, href, disabled = false }) => {
  const klassen = [
    'web-knopf',
    'web-kopfknopf',
    art === 'primaer' ? 'web-knopf--primaer' : '',
    art === 'gefahr' ? 'web-knopf--gefahr' : '',
    symbol === 'immer' ? 'web-knopf--symbol' : '',
    symbol === 'unter760' ? 'web-kopfknopf--unter760' : '',
    symbol === 'unter600' ? 'web-kopfknopf--unter600' : '',
  ].filter(Boolean).join(' ');
  const inhalt = (
    <>
      <IonIcon icon={icon} aria-hidden="true" />
      {symbol !== 'immer' && <span className="web-kopfknopf__text">{label}</span>}
    </>
  );
  // Ohne sichtbaren Text trägt der Knopf seinen Namen im aria-label; mit Text ist er sein Name.
  const name = symbol ? label : undefined;
  if (href) {
    return <WebLink href={href} className={klassen} title={titel ?? label} aria-label={name}>{inhalt}</WebLink>;
  }
  return (
    <button type="button" className={klassen} onClick={onClick} disabled={disabled} title={titel ?? label} aria-label={name}>
      {inhalt}
    </button>
  );
};

/**
 * Alle Aktionen rechts im Kopf, in dieser Reihenfolge: Symbole (Löschen,
 * Archivieren, Einordnen, Ablehnen), Nebenknöpfe, ganz rechts der Hauptknopf.
 */
export const KopfAktionen: React.FC<{ symbole?: React.ReactNode; neben?: React.ReactNode; haupt?: React.ReactNode }> = ({ symbole, neben, haupt }) => (
  <div className="web-kopfaktionen">
    {symbole}
    {neben}
    {haupt}
  </div>
);

// --- Notiz -------------------------------------------------------------------------------

export interface WebNotizProps {
  /** Der Entwurf (bleibt beim Neuladen stehen, solange er nicht gespeichert ist). */
  notiz: string;
  setNotiz: (notiz: string) => void;
  /** Die Notiz, wie sie gespeichert ist. */
  gespeichert: string;
  geaendert: boolean;
  speichern: () => Promise<boolean>;
  gesperrt: boolean;
}

/** Ab wann eine Notiz mehr als drei Zeilen braucht und „mehr" bekommt. */
const istLang = (text: string): boolean => text.split('\n').length > 3 || text.length > 240;

/**
 * Die interne Notiz oben, beim Öffnen sichtbar: höchstens drei Zeilen, dann
 * „mehr"; „Bearbeiten" macht sie zum Feld, „Notiz speichern" erscheint erst
 * nach einer Änderung. Leer steht dort nur „+ Interne Notiz". Ein Entwurf,
 * der noch nicht gespeichert ist, hält das Feld offen -- auch nach dem
 * Neuladen (useVorgangDetail).
 */
export const WebNotiz: React.FC<WebNotizProps> = ({ notiz, setNotiz, gespeichert, geaendert, speichern, gesperrt }) => {
  const [offen, setOffen] = useState(false);
  const [ganz, setGanz] = useState(false);
  const feld = useRef<HTMLDivElement>(null);
  // Wohin der Fokus nach dem Bearbeiten zurückgeht: „+ Interne Notiz" bzw. „Bearbeiten".
  const leerKnopf = useRef<HTMLButtonElement>(null);
  const notizKopf = useRef<HTMLDivElement>(null);
  const zurueck = useRef(false);
  const textId = useId();
  const bearbeiten = offen || geaendert;

  useEffect(() => {
    if (offen) feld.current?.querySelector('textarea')?.focus();
  }, [offen]);

  // Nach „Abbrechen" oder „Notiz speichern" verschwinden Feld und Knöpfe: Der
  // Fokus geht dorthin zurück, wo das Bearbeiten begann (bis 11.10.2026 stand
  // er danach auf <body>).
  useEffect(() => {
    if (bearbeiten || !zurueck.current) return;
    zurueck.current = false;
    (leerKnopf.current ?? notizKopf.current?.querySelector<HTMLButtonElement>('button'))?.focus();
  }, [bearbeiten]);

  const schliessen = () => {
    zurueck.current = true;
    setOffen(false);
  };

  if (bearbeiten) {
    return (
      <div ref={feld} className="web-notiz web-notiz--offen">
        <WebTextfeld label={TEXT.notizFeld} zeilen={3} wert={notiz} onWert={setNotiz} />
        <div className="web-notiz__knoepfe">
          <WebKnopf klein onClick={() => { setNotiz(gespeichert); schliessen(); }}>{TEXT.notizAbbrechen}</WebKnopf>
          {geaendert && (
            <WebKnopf klein art="primaer" disabled={gesperrt} onClick={() => { void speichern().then((ok) => { if (ok) schliessen(); }); }}>
              {TEXT.notizSpeichern}
            </WebKnopf>
          )}
        </div>
      </div>
    );
  }

  if (!gespeichert.trim()) {
    return (
      <button ref={leerKnopf} type="button" className="web-notiz web-notiz--leer" onClick={() => setOffen(true)}>
        <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
        {TEXT.notiz}
      </button>
    );
  }

  const lang = istLang(gespeichert);
  return (
    <section className="web-notiz" aria-label={TEXT.notiz}>
      <div ref={notizKopf} className="web-notiz__kopf">
        <span className="web-notiz__titel">
          <IonIcon icon={ICON_TEXTDOKUMENT} aria-hidden="true" />
          {TEXT.notiz}
        </span>
        <WebKnopf art="text" klein onClick={() => setOffen(true)}>{TEXT.notizBearbeiten}</WebKnopf>
      </div>
      <p id={textId} className={`web-notiz__text${lang && !ganz ? ' web-notiz__text--kurz' : ''}`}>{gespeichert}</p>
      {lang && (
        <button type="button" className="web-notiz__mehr" aria-expanded={ganz} aria-controls={textId} onClick={() => setGanz((g) => !g)}>
          {ganz ? TEXT.weniger : TEXT.mehr}
        </button>
      )}
    </section>
  );
};

// --- Antwortzeile ----------------------------------------------------------------------------

/**
 * Unter der jüngsten Mail: der Editor im zugeklappten Zustand -- „Antwort an
 * {Name} schreiben …" und das Postfach. Ein Klick öffnet ihn an derselben
 * Stelle. Ohne Antwortweg ist sie gesperrt und verweist auf den Stand.
 */
export const Antwortzeile: React.FC<{
  wer: string | null;
  postfach: string | null;
  onOeffnen: () => void;
  gesperrt?: boolean;
  disabled?: boolean;
  /** Der Knopf selbst -- dorthin geht der Fokus zurück, wenn der Editor schließt. */
  knopfRef?: React.Ref<HTMLButtonElement>;
}> = ({
  wer, postfach, onOeffnen, gesperrt = false, disabled = false, knopfRef,
}) => {
  if (gesperrt) {
    return (
      <p className="web-antwortzeile web-antwortzeile--gesperrt">
        <IonIcon icon={ICON_WARNHINWEIS} aria-hidden="true" />
        {TEXT.antwortGesperrt}
      </p>
    );
  }
  return (
    <button ref={knopfRef} type="button" className="web-antwortzeile" onClick={onOeffnen} disabled={disabled}>
      <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" className="web-antwortzeile__symbol" />
      <span className="web-antwortzeile__text">{wer ? TEXT.antwortAn(wer) : TEXT.antwortOhneName}</span>
      {postfach && <span className="web-antwortzeile__postfach">{TEXT.vonPostfach(postfach)}</span>}
    </button>
  );
};

// --- Karten der Angaben ------------------------------------------------------------------------

/** Symbol und Farbe je Zeile (die allgemeine Tabelle components/web/angabeSymbole.ts kennt diese Bezeichnungen nicht). */
const ZEILEN_SYMBOL: Readonly<Record<string, { icon: string; klasse: string }>> = {
  person: { icon: ICON_PERSON_GEFUELLT, klasse: 'app-icon-color--users' },
  email: { icon: ICON_MAIL_GEFUELLT, klasse: 'app-icon-color--users' },
  mobil: { icon: ICON_TELEFON, klasse: 'app-icon-color--users' },
  zuordnung: { icon: ICON_GEMEINDE_GEFUELLT, klasse: 'app-icon-color--gemeinde' },
  gemeinde: { icon: ICON_GEMEINDE_GEFUELLT, klasse: 'app-icon-color--gemeinde' },
  gemeinde_fehlt: { icon: ICON_GEMEINDE_GEFUELLT, klasse: 'app-icon-color--gemeinde' },
  eingang: { icon: ICON_MAIL_GEFUELLT, klasse: 'app-icon-color--system' },
  angelegt_von: { icon: ICON_PERSON_GEFUELLT, klasse: 'app-icon-color--system' },
  tarif: { icon: ICON_SCHILD_GEFUELLT, klasse: 'app-icon-color--organizations' },
  wunsch: { icon: ICON_SCHILD_GEFUELLT, klasse: 'app-icon-color--organizations' },
  konfis: { icon: ICON_GRUPPE_GEFUELLT, klasse: 'app-icon-color--konfis' },
  laufzeit: { icon: ICON_UHRZEIT_GEFUELLT, klasse: 'app-icon-color--challenges' },
  zugang: { icon: ICON_SPERRE_GEFUELLT, klasse: 'app-icon-color--danger' },
  kreis: { icon: ICON_ORGANISATION_GEFUELLT, klasse: 'app-icon-color--organizations' },
};

const KARTEN_SYMBOL: Readonly<Record<AngabenKarte['schluessel'], string>> = {
  lizenz: ICON_KATEGORIE,
  anfrage: ICON_ORGANISATION,
  kontakt: ICON_PERSON,
  gemeinde: ICON_ORGANISATION,
};

export interface AngabenKartenProps {
  karten: readonly AngabenKarte[];
  /** Eine Aktion an einer Zeile oder Karte (Im Vorgang antworten, Zuordnen, Lizenz ändern, Kirchenkreis anlegen). */
  onAktion: (art: AngabeAktion, adresse?: string) => void;
  /** Ohne Netz: Aktionen gesperrt. */
  gesperrt?: boolean;
  /** Tooltip der gesperrten Kartenaktion (Lizenz ohne Gemeinde). */
  gesperrtTitel?: string;
}

/**
 * Die Angaben als offene Karten (Lizenz, Anfrage, Kontakt, Gemeinde), in
 * der Reihenfolge von vorgangAngaben -- keine Angabe doppelt, kein
 * Akkordeon. Neben der Liste stehen zwei nebeneinander, breit eine unter
 * der anderen in der schmalen Spalte.
 */
export const AngabenKarten: React.FC<AngabenKartenProps> = ({ karten, onAktion, gesperrt = false, gesperrtTitel }) => (
  <div className="web-vorgang-karten">
    {karten.map((k) => <AngabenKarteAnzeige key={k.schluessel} karte={k} onAktion={onAktion} gesperrt={gesperrt} gesperrtTitel={gesperrtTitel} />)}
  </div>
);

const AngabenKarteAnzeige: React.FC<{ karte: AngabenKarte } & Omit<AngabenKartenProps, 'karten'>> = ({ karte, onAktion, gesperrt, gesperrtTitel }) => {
  const titelId = useId();
  const [oeffnen, ...weitere] = karte.links;
  const angaben: WebAngabe[] = karte.zeilen.map((z) => {
    const symbol = ZEILEN_SYMBOL[z.schluessel];
    const text = z.ton && z.ton !== 'neutral' ? <WebPill ton={z.ton} title={z.titel}>{z.wert}</WebPill>
      : z.href ? <a className="web-link" href={z.href}>{z.href.startsWith('mailto:') ? <AdresseMitUmbruch adresse={z.wert} /> : z.wert}</a>
        : <span title={z.titel}>{z.wert}</span>;
    return {
      label: z.label,
      icon: symbol?.icon,
      iconKlasse: symbol?.klasse,
      wert: (
        <span className="web-vorgang-karte__wert">
          {text}
          {z.aktion && (
            <WebKnopf
              art="text"
              klein
              disabled={gesperrt}
              onClick={() => onAktion(z.aktion!.art, z.aktion!.adresse)}
              // „Im Vorgang antworten" steht an Kontakt und Leitung mehrfach: Der Name sagt, an wen.
              aria-label={z.aktion.art === 'im_vorgang_antworten' && z.aktion.adresse ? TEXT.mitZiel(z.aktion.label, z.aktion.adresse) : undefined}
            >
              {z.aktion.label}
            </WebKnopf>
          )}
        </span>
      ),
    };
  });
  return (
    <section className="web-karte web-vorgang-karte" aria-labelledby={titelId}>
      <header className="web-karte__kopf web-vorgang-karte__kopf">
        <h3 id={titelId} className="web-karte__titel web-vorgang-karte__titel">
          <IonIcon icon={KARTEN_SYMBOL[karte.schluessel]} aria-hidden="true" />
          {karte.titel}
        </h3>
        {karte.aktion && (
          <WebKnopf
            art="text"
            klein
            disabled={gesperrt || karte.aktion.gesperrt}
            title={karte.aktion.gesperrt ? gesperrtTitel : undefined}
            onClick={() => onAktion(karte.aktion!.art)}
          >
            {karte.aktion.label}
          </WebKnopf>
        )}
        {!karte.aktion && oeffnen && <WebLink href={oeffnen.href} className="web-vorgang-karte__link">{oeffnen.label}</WebLink>}
      </header>
      <div className="web-karte__inhalt web-vorgang-karte__inhalt">
        <WebAngaben angaben={angaben} beschriftung={karte.titel} />
        {karte.leitung && (
          <div className="web-vorgang-karte__leitung">
            <h4 className="web-vorgang-karte__untertitel">{TEXT.leitung(karte.leitung.length)}</h4>
            {karte.leitung.length === 0 ? <p className="web-gedaempft">{TEXT.leitungKeine}</p> : (
              <ul className="web-personen" aria-label="Gemeindeleitung">
                {karte.leitung.map((l) => (
                  <li key={l.id} className="web-person">
                    <div className="web-person__kopf">
                      <span className="web-person__name">{l.name}</span>
                      {l.gesperrt && <WebPill ton="neutral">{TEXT.gesperrt}</WebPill>}
                    </div>
                    <div className="web-person__zeile">
                      {l.email ? <a className="web-link" href={`mailto:${l.email}`}><AdresseMitUmbruch adresse={l.email} /></a> : <span>{TEXT.keineEmail}</span>}
                      <span>{l.anmeldung}</span>
                      {l.email && (
                        <WebKnopf
                          art="text"
                          klein
                          disabled={gesperrt}
                          onClick={() => onAktion('im_vorgang_antworten', l.email ?? undefined)}
                          aria-label={TEXT.mitZiel(TEXT.imVorgangAntworten, l.name)}
                        >
                          {TEXT.imVorgangAntworten}
                        </WebKnopf>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {(weitere.length > 0 || (karte.aktion && oeffnen)) && (
          <p className="web-vorgang-karte__links">
            {(karte.aktion ? karte.links : weitere).map((l) => <WebLink key={l.href} href={l.href}>{l.label}</WebLink>)}
          </p>
        )}
      </div>
    </section>
  );
};
