import { ICON_LOESCHEN_GEFUELLT, ICON_WARNUNG_GEFUELLT } from '../components/shared/icons';

/**
 * Rückfragen vor dem Löschen bekommen ein Symbol und einen roten Knopf
 * (Simon im Seiten-Interview, 13.10.2026: „die loeschenmodal duerften ein
 * symbol haben und einen roten button").
 *
 * DAS PROBLEM: Die App fragt an rund 70 Stellen in über 40 Dateien über
 * Ionics Rückfrage (useIonAlert) nach, bevor sie löscht, entfernt, sperrt oder
 * verwirft. Der folgenreiche Knopf trägt dort `role: 'destructive'`. Auf
 * Android (Ionic-Modus md) färbt Ionic ihn nicht -- er steht blau wie
 * „Abbrechen" daneben; ein Symbol gibt es nirgends. Im Browser sehen die
 * Rückfragen aus wie Android, nicht wie die Fenster der Web-Fassung.
 *
 * DIE LÖSUNG AN EINER STELLE, wie die Namen der Modale (utils/modalNamen.ts):
 * Beim Öffnen jeder Rückfrage (Ereignis `ionAlertWillPresent`, es steigt bis
 * zum Dokument auf und fällt, bevor die Rückfrage hereinfährt) liest dieser
 * Beobachter ihre Knöpfe und kennzeichnet sie:
 *   - `app-rueckfrage app-rueckfrage--loeschen`, wenn ein Knopf mit
 *     role 'destructive' löscht, entfernt oder leert („Löschen",
 *     „Endgültig löschen", „Entfernen", „Endgültig leeren" …);
 *   - `app-rueckfrage app-rueckfrage--warnung` bei jedem anderen solchen
 *     Knopf („Abmelden", „Verwerfen", „Sperren", „Ausblenden" …);
 *   - nichts, wenn kein Knopf destructive ist (Einmalpasswort, „Zu viele
 *     Anfragen") -- diese Rückfragen bleiben, wie sie sind.
 * Dazu das Symbol als CSS-Eigenschaft `--app-rueckfrage-symbol` (Mülleimer
 * bzw. Warndreieck aus components/shared/icons.ts, der einen Stelle für
 * Icons). Wie das aussieht, steht in theme/rueckfragen.css. Kein Aufruf muss
 * daran denken; eine neue Rückfrage mit destructive-Knopf ist von selbst
 * gekennzeichnet.
 *
 * BLEIBT DIE KLASSE STEHEN? Ja. ion-alert rendert seine Klassen selbst
 * (Stencil, `Host class=…`), gleicht beim erneuten Rendern aber nur die
 * eigenen ab: Was es vorher nicht gesetzt hat, nimmt es auch nicht weg. Nach
 * genau dieser Regel verschwindet `overlay-hidden`, das Ionic beim Zeigen von
 * Hand abnimmt. Dasselbe gilt für Eigenschaften im style-Attribut. Der Test
 * rendert eine Rückfrage neu und prüft es.
 */

/** Wie eine Rückfrage aussieht: Löschen (Mülleimer) oder Warnung (Warndreieck). */
export type RueckfrageArt = 'loeschen' | 'warnung';

/** Ein Knopf, wie ihn useIonAlert annimmt: ein Text oder ein Objekt. */
export type RueckfrageKnopf = string | { text?: string; role?: string };

/** Die Klasse jeder gekennzeichneten Rückfrage. */
export const RUECKFRAGE_KLASSE = 'app-rueckfrage';

/** Die CSS-Eigenschaft mit dem Symbol (url(…) des Icons). */
export const RUECKFRAGE_SYMBOL = '--app-rueckfrage-symbol';

const ALLE_KLASSEN = [RUECKFRAGE_KLASSE, `${RUECKFRAGE_KLASSE}--loeschen`, `${RUECKFRAGE_KLASSE}--warnung`];

/**
 * Löschen, Entfernen, Leeren -- auch mitten im Knopf („Endgültig löschen",
 * „Konto löschen", „Ganze Serie löschen (5 Events)"). „Löschung" oder
 * „Entfernung" enthalten das Wort nicht und zählen nicht.
 */
const LOESCHT = /l(?:ö|oe)schen|entfernen|leeren/i;

/**
 * Welche Art Rückfrage die Knöpfe ergeben -- null, wenn keiner
 * role 'destructive' trägt. Nur der destructive-Knopf zählt: „Löschen" ohne
 * diese Rolle macht keine Rückfrage zur Lösch-Rückfrage.
 */
export function rueckfrageArt(knoepfe: readonly RueckfrageKnopf[] | null | undefined): RueckfrageArt | null {
  const folgenreich = (knoepfe ?? []).filter(
    (knopf): knopf is { text?: string; role?: string } => typeof knopf === 'object' && knopf !== null && knopf.role === 'destructive',
  );
  if (folgenreich.length === 0) return null;
  return folgenreich.some((knopf) => LOESCHT.test(knopf.text ?? '')) ? 'loeschen' : 'warnung';
}

/**
 * Das Symbol je Art, aus der zentralen Icon-Datei. Auch die Rückfragen, die
 * selbst ein Fenster der Web-Fassung sind, nehmen es von hier
 * (components/web/WebRueckfrageSymbol.tsx).
 */
export const RUECKFRAGE_SYMBOLE: Readonly<Record<RueckfrageArt, string>> = {
  loeschen: ICON_LOESCHEN_GEFUELLT,
  warnung: ICON_WARNUNG_GEFUELLT,
};

/**
 * Kennzeichnet eine Rückfrage nach ihren Knöpfen (Eigenschaft `buttons` des
 * ion-alert). Räumt vorher ab, was von einem früheren Zeigen desselben
 * Elements stammt (ein <IonAlert> mit isOpen wird wiederverwendet).
 */
export function rueckfrageKennzeichnen(alert: HTMLElement): RueckfrageArt | null {
  const art = rueckfrageArt((alert as HTMLElement & { buttons?: RueckfrageKnopf[] }).buttons);
  alert.classList.remove(...ALLE_KLASSEN);
  alert.style.removeProperty(RUECKFRAGE_SYMBOL);
  if (!art) return null;
  alert.classList.add(RUECKFRAGE_KLASSE, `${RUECKFRAGE_KLASSE}--${art}`);
  alert.style.setProperty(RUECKFRAGE_SYMBOL, `url("${RUECKFRAGE_SYMBOLE[art]}")`);
  return art;
}

/**
 * Schaltet die Kennzeichnung für alle Rückfragen an -- einmal für die ganze
 * App (App.tsx), wie modalNamenAnschalten. Gibt eine Aufräumfunktion zurück.
 */
export function rueckfragenOptikAnschalten(dokument: Document = document): () => void {
  const vorDemZeigen = (ereignis: Event) => {
    const alert = ereignis.target;
    if (!(alert instanceof HTMLElement) || alert.tagName !== 'ION-ALERT') return;
    rueckfrageKennzeichnen(alert);
  };
  dokument.addEventListener('ionAlertWillPresent', vorDemZeigen);
  return () => dokument.removeEventListener('ionAlertWillPresent', vorDemZeigen);
}
