// Gemeinsame Attrappen fuer die gerenderten Tests der Web-Fassung des Chats.
//
// Ionic-Bausteine werden zu schlichten Elementen mit demselben Namen
// (aria-label), damit die Tests klicken und tippen koennen wie eine Person.
// ion-content bekommt die zwei Aufrufe, die useChatScroll braucht
// (scrollToBottom, getScrollElement). Alerts und Router reicht der Test
// selbst herein, um festzuhalten, was Ionic anzeigen bzw. wohin es gehen
// wuerde.
import React, { useImperativeHandle, useRef } from 'react';
import { vi } from 'vitest';

type Kinder = { children?: React.ReactNode };

export interface AlertKnopf { text: string; role?: string; handler?: () => unknown }
export interface AlertOptionen { header?: string; message?: string; buttons?: AlertKnopf[] }

/** Der Verlauf als Element mit den Methoden von ion-content; die Aufrufe zaehlt der Test. */
export const scrollAufrufe = { zumEnde: vi.fn() };

const IonContentAttrappe = React.forwardRef<unknown, Kinder & {
  className?: string;
  onClick?: () => void;
  onIonScroll?: () => void;
}>(({ children, className, onClick, onIonScroll }, ref) => {
  const div = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => {
    const el = div.current!;
    return Object.assign(el, {
      getScrollElement: async () => el,
      scrollToBottom: (ms?: number) => { scrollAufrufe.zumEnde(ms); },
    });
  });
  return (
    <div ref={div} className={className} data-testid="verlauf" onClick={onClick} onScroll={() => onIonScroll?.()}>
      {children}
    </div>
  );
});
IonContentAttrappe.displayName = 'IonContentAttrappe';

export function ionicAttrappe(optionen: {
  presentAlert?: (o: AlertOptionen) => void;
  presentActionSheet?: (o: unknown) => void;
  presentModal?: (komponente: unknown, props: unknown) => ((o?: unknown) => void);
  router?: { push: (...args: unknown[]) => void };
} = {}) {
  const durch = ({ children }: Kinder) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, Kinder>(({ children }, ref) => <div ref={ref} data-testid="seite">{children}</div>),
    IonContent: IonContentAttrappe,
    IonHeader: durch,
    IonToolbar: durch,
    IonButtons: durch,
    IonTitle: ({ children }: Kinder) => <h1>{children}</h1>,
    IonIcon: ({ icon, className, 'aria-label': label }: { icon?: string; className?: string; 'aria-label'?: string }) => (
      <span data-icon={typeof icon === 'string' ? icon.slice(0, 40) : ''} className={className} aria-label={label} />
    ),
    IonSpinner: () => <span data-testid="spinner" />,
    IonButton: ({ children, onClick, 'aria-label': label }: Kinder & { onClick?: () => void; 'aria-label'?: string }) => (
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>
    ),
    useIonAlert: () => [optionen.presentAlert ?? (() => {}), () => {}],
    useIonActionSheet: () => [optionen.presentActionSheet ?? (() => {}), () => {}],
    useIonModal: (komponente: unknown, props: unknown) => [optionen.presentModal ? optionen.presentModal(komponente, props) : () => {}, () => {}],
    useIonRouter: () => optionen.router ?? { push: () => {}, goBack: () => {}, canGoBack: () => false },
    useIonViewWillEnter: () => {},
    useIonViewDidLeave: () => {},
  };
}

/** Die Kopfzeile der App als einfache Attrappe. */
export const KopfzeileAttrappe = {
  default: ({ titel }: { titel: React.ReactNode }) => <header><h1>{titel}</h1></header>,
  AppKopfzeileGross: () => null,
};

/** Ein Socket, dessen Ereignisse der Test selbst ausloest; off entfernt genau den uebergebenen Horcher. */
export const socketNachbau = {
  connected: true,
  handler: new Map<string, Array<(daten?: unknown) => void>>(),
  on(ereignis: string, fn: (daten?: unknown) => void) {
    this.handler.set(ereignis, [...(this.handler.get(ereignis) ?? []), fn]);
  },
  off(ereignis: string, fn?: (daten?: unknown) => void) {
    if (!fn) this.handler.delete(ereignis);
    else this.handler.set(ereignis, (this.handler.get(ereignis) ?? []).filter((h) => h !== fn));
  },
  ausloesen(ereignis: string, daten?: unknown) {
    for (const fn of [...(this.handler.get(ereignis) ?? [])]) fn(daten);
  },
};
