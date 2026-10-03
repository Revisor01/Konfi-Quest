// Ionic-Attrappe fuer die gerenderten Tests der Support-Ansicht.
//
// Ionic-Felder lassen sich in jsdom nicht bedienen (das native Feld steckt im
// Shadow-DOM). Hier werden sie zu nativen Elementen mit demselben Namen
// (aria-label), damit die Tests tippen, waehlen und klicken koennen wie eine
// Person. Ereignisse kommen in derselben Form an wie bei Ionic
// (`detail.value`, `detail.checked`). Alerts und Router reicht der Test
// selbst herein, um festzuhalten, was Ionic anzeigen bzw. wohin es gehen
// wuerde.
import React, { createContext, useContext } from 'react';

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
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    // Fuer das Formular "Gemeinde": Datum, Wischaktionen und verschachtelte
    // Modale spielen in diesen Tests keine Rolle.
    IonDatetime: () => null,
    IonDatetimeButton: () => null,
    IonModal: () => null,
    IonItemSliding: durch,
    IonItemOptions: () => null,
    IonItemOption: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label, title }: Kinder & {
      onClick?: () => void; disabled?: boolean; 'aria-label'?: string; title?: string;
    }) => (
      <button type="button" aria-label={label} title={title} disabled={disabled} onClick={onClick}>{children}</button>
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
    // Rueckkehr auf eine Seite (stilles Neuladen) spielt in diesen Tests keine Rolle.
    useIonViewWillEnter: () => {},
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
