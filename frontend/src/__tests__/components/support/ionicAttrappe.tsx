// Ionic-Attrappe fuer die gerenderten Tests der Support-Ansicht.
//
// Ionic-Felder lassen sich in jsdom nicht bedienen (das native Feld steckt im
// Shadow-DOM). Hier werden sie zu nativen Elementen mit demselben Namen
// (aria-label), damit die Tests tippen, waehlen und klicken koennen wie eine
// Person. Ereignisse kommen in derselben Form an wie bei Ionic
// (`detail.value`, `detail.checked`). Alerts und Router reicht der Test
// selbst herein, um festzuhalten, was Ionic anzeigen bzw. wohin es gehen
// wuerde.
import React, { createContext, useContext, useEffect, useRef } from 'react';

type Kinder = { children?: React.ReactNode };
type Wert = { detail: { value?: unknown; checked?: boolean } };

export interface AlertKnopf { text: string; role?: string; handler?: () => unknown }
export interface AlertOptionen { header?: string; message?: string; buttons?: AlertKnopf[] }
export interface RouterAttrappe {
  push: (pfad: string, richtung?: string, art?: string) => void;
  goBack: () => void;
  canGoBack: () => boolean;
}

const durch = ({ children }: Kinder) => <>{children}</>;

// Ionic ruft useIonViewWillEnter, wenn eine im Speicher gehaltene Seite wieder
// betreten wird. Die Attrappe merkt sich die Rueckrufe; ein Test ruft
// `seiteBetreten()` und spielt so das Zurueckkehren auf die Seite nach.
const betretenHorcher = new Set<() => void>();

/** Spielt „die Seite wird (wieder) betreten" nach: ruft alle Rueckrufe von useIonViewWillEnter. */
export function seiteBetreten(): void {
  for (const h of [...betretenHorcher]) h();
}
// Ebenso das Verlassen (useIonViewWillLeave): `seiteVerlassen()`.
const verlassenHorcher = new Set<() => void>();

/** Spielt „die Seite wird verlassen" nach: ruft alle Rueckrufe von useIonViewWillLeave. */
export function seiteVerlassen(): void {
  for (const h of [...verlassenHorcher]) h();
}
// „Ziehen zum Aktualisieren": IonRefresher zeigt nichts, merkt sich aber
// seinen onIonRefresh; ein Test spielt das Ziehen mit
// `ziehenZumAktualisieren()` nach.
type ZiehenEreignis = { detail: { complete: () => void } };
const ziehenHorcher = new Set<(e: ZiehenEreignis) => void>();

/**
 * Spielt „Ziehen zum Aktualisieren" nach: ruft onIonRefresh jedes gezeigten
 * IonRefresher. Zurück kommt, wie viele es gab und wie oft complete() fiel
 * (der Kreisel verschwindet erst damit).
 */
export function ziehenZumAktualisieren(): { refresher: number; fertig: () => number } {
  let fertig = 0;
  const horcher = [...ziehenHorcher];
  for (const h of horcher) h({ detail: { complete: () => { fertig += 1; } } });
  return { refresher: horcher.length, fertig: () => fertig };
}

const Segment = createContext<{ wert: unknown; waehlen: (w: unknown) => void }>({ wert: undefined, waehlen: () => {} });

export function ionicAttrappe(optionen: {
  presentAlert?: (o: AlertOptionen) => void;
  router?: RouterAttrappe;
} = {}) {
  return {
    IonPage: durch,
    IonContent: durch,
    IonHeader: durch,
    IonToolbar: durch,
    IonButtons: durch,
    IonList: durch,
    IonListHeader: durch,
    IonCard: durch,
    IonCardContent: durch,
    IonItem: durch,
    IonItemGroup: durch,
    IonTitle: ({ children }: Kinder) => <h1>{children}</h1>,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonNote: ({ children }: Kinder) => <span>{children}</span>,
    IonBadge: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonSpinner: () => null,
    IonRefresher: function Refresher({ onIonRefresh }: { onIonRefresh?: (e: ZiehenEreignis) => void }) {
      const neueste = useRef(onIonRefresh);
      useEffect(() => { neueste.current = onIonRefresh; });
      useEffect(() => {
        const horcher = (e: ZiehenEreignis) => neueste.current?.(e);
        ziehenHorcher.add(horcher);
        return () => { ziehenHorcher.delete(horcher); };
      }, []);
      return null;
    },
    IonRefresherContent: () => null,
    // Fuer das Formular "Gemeinde": Datum, Wischaktionen und verschachtelte
    // Modale spielen in diesen Tests keine Rolle.
    IonDatetime: () => null,
    IonDatetimeButton: () => null,
    // Ein Modal mit isOpen (Antworten, Einordnen, Einsortieren; 11.10.2026)
    // steht als Dialog da, solange es offen ist. Modale ohne isOpen (Datum)
    // bleiben weg.
    IonModal: ({ isOpen, children, 'aria-label': label }: Kinder & { isOpen?: boolean; 'aria-label'?: string }) =>
      (isOpen ? <div role="dialog" aria-label={label}>{children}</div> : null),
    IonItemSliding: durch,
    IonItemOptions: () => null,
    IonItemOption: () => null,
    // Aufklappen (Filter der Vorgänge, 12.10.2026): aria-expanded und
    // aria-controls reicht Ionic an den Knopf im Shadow-DOM weiter, die
    // Attrappe an den nativen Knopf -- mit derselben Falle wie echt: React 19
    // schreibt ein boolean true an ein Ionic-Element als leeres Attribut
    // (gemessen mit dem echten IonButton in jsdom: true -> "", false ->
    // "false", "true" -> "true"). Wer aria-expanded={true} übergibt, sieht
    // hier wie am Gerät aria-expanded="".
    IonButton: ({ children, onClick, disabled, 'aria-label': label, title, 'aria-expanded': offen, 'aria-controls': steuert }: Kinder & {
      onClick?: () => void; disabled?: boolean; 'aria-label'?: string; title?: string; 'aria-expanded'?: boolean | 'true' | 'false'; 'aria-controls'?: string;
    }) => (
      <button type="button" aria-label={label} title={title} disabled={disabled} aria-expanded={offen === true ? ('' as unknown as boolean) : offen} aria-controls={steuert} onClick={onClick}>{children}</button>
    ),
    IonInput: ({ 'aria-label': label, 'aria-required': pflicht, value, type, disabled, onIonInput }: {
      'aria-label'?: string; 'aria-required'?: string; value?: string | number | null; type?: string; disabled?: boolean;
      onIonInput?: (e: Wert) => void;
    }) => (
      <input
        aria-label={label}
        aria-required={pflicht === 'true' ? true : undefined}
        type={type === 'password' ? 'password' : 'text'}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })}
      />
    ),
    IonTextarea: ({ 'aria-label': label, value, onIonInput }: {
      'aria-label'?: string; value?: string | null; onIonInput?: (e: Wert) => void;
    }) => (
      <textarea aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
    IonSelect: ({ 'aria-label': label, value, disabled, onIonChange, children }: Kinder & {
      'aria-label'?: string; value?: unknown; disabled?: boolean; onIonChange?: (e: Wert) => void;
    }) => (
      <select aria-label={label} value={String(value ?? '')} disabled={disabled}
        onChange={(e) => onIonChange?.({ detail: { value: e.target.value } })}>
        {children}
      </select>
    ),
    IonSelectOption: ({ value, children }: Kinder & { value?: unknown }) => <option value={String(value)}>{children}</option>,
    IonToggle: ({ 'aria-label': label, checked, onIonChange }: {
      'aria-label'?: string; checked?: boolean; onIonChange?: (e: Wert) => void;
    }) => (
      <input type="checkbox" aria-label={label} checked={!!checked}
        onChange={(e) => onIonChange?.({ detail: { checked: e.target.checked } })} />
    ),
    IonSegment: ({ 'aria-label': label, value, onIonChange, children }: Kinder & {
      'aria-label'?: string; value?: unknown; onIonChange?: (e: Wert) => void;
    }) => (
      <Segment.Provider value={{ wert: value, waehlen: (w) => onIonChange?.({ detail: { value: w } }) }}>
        <div role="tablist" aria-label={label}>{children}</div>
      </Segment.Provider>
    ),
    IonSegmentButton: function SegmentKnopf({ value, children }: Kinder & { value?: unknown }) {
      const segment = useContext(Segment);
      return (
        <button type="button" role="tab" aria-selected={segment.wert === value} onClick={() => segment.waehlen(value)}>
          {children}
        </button>
      );
    },
    useIonAlert: () => [optionen.presentAlert ?? (() => {}), () => {}],
    useIonRouter: () => optionen.router ?? { push: () => {}, goBack: () => {}, canGoBack: () => false },
    useIonModal: () => [() => {}, () => {}],
    // Rueckkehr auf eine Seite: der Test loest sie mit seiteBetreten() aus.
    useIonViewWillEnter: (rueckruf: () => void) => {
      const neueste = useRef(rueckruf);
      useEffect(() => { neueste.current = rueckruf; });
      useEffect(() => {
        const horcher = () => neueste.current();
        betretenHorcher.add(horcher);
        return () => { betretenHorcher.delete(horcher); };
      }, []);
    },
    // Verlassen einer Seite: der Test loest es mit seiteVerlassen() aus.
    useIonViewWillLeave: (rueckruf: () => void) => {
      const neueste = useRef(rueckruf);
      useEffect(() => { neueste.current = rueckruf; });
      useEffect(() => {
        const horcher = () => neueste.current();
        verlassenHorcher.add(horcher);
        return () => { verlassenHorcher.delete(horcher); };
      }, []);
    },
  };
}

/** Die Kopfzeile als einfache Attrappe: Titel, Zurueck, Knoepfe rechts. */
export const KopfzeileAttrappe = {
  default: ({ titel, onZurueck, rechts }: { titel: React.ReactNode; onZurueck?: () => void; rechts?: React.ReactNode }) => (
    <header>
      <h1>{titel}</h1>
      {onZurueck && <button type="button" aria-label="Zurück" onClick={onZurueck}>Zurück</button>}
      {rechts}
    </header>
  ),
  AppKopfzeileGross: () => null,
};
