// Ein Event einer Serie löschen: welche Wege es gibt und wie sie heißen. Eine
// Stelle für das Aktionsmenü der App (AdminEventsPage, Action Sheet) und das
// kleine Fenster des Browsers ab 992 px (WebSerieLoeschenDialog; Simon,
// 15.10.2026). Nach der Wahl folgen in beiden dieselben Rückfragen der Seite
// (deleteSingleEvent bzw. deleteSeriesEvents).
//
//   Nur dieses Event löschen                    -- immer
//   Dieses + alle folgenden löschen (n Events)  -- nur, wenn nach diesem noch
//                                                  weitere kommen und nicht
//                                                  ohnehin die ganze Serie gemeint ist
//   Ganze Serie löschen (n Events)              -- immer

export interface SerienTermin {
  id: number;
  name: string;
  event_date: string;
  is_series?: boolean;
  series_id?: number;
}

export interface SerienLoeschWahl<E extends SerienTermin> {
  /** Kopf und Satz darunter -- wie im Aktionsmenü. */
  titel: string;
  satz: string;
  /** Alle Events der Serie, dieses eingeschlossen. */
  ganzeSerie: E[];
  /** Dieses und alle späteren; null, wenn es diesen Weg nicht gibt. */
  folgende: E[] | null;
  nurDiesesText: string;
  folgendeText: string | null;
  ganzeSerieText: string;
}

/**
 * Die Wahl für ein Event einer Serie; null, wenn es keine Serie ist oder die
 * Liste keine weiteren Events derselben Serie kennt -- dann wird es wie ein
 * einzelnes gelöscht.
 */
export function serienLoeschWahl<E extends SerienTermin>(event: E, alle: readonly E[]): SerienLoeschWahl<E> | null {
  if (!event.is_series || !event.series_id) return null;
  const andere = alle.filter((e) => e.series_id === event.series_id && e.id !== event.id);
  if (andere.length === 0) return null;
  const ganzeSerie = [...andere, event];
  // Dieser Termin + alle späteren der Serie (für "ab hier löschen", z.B. falsch
  // angelegte Serie oder Reihe, die früher endet)
  const folgendeRoh = ganzeSerie.filter((e) =>
    new Date(e.event_date).getTime() >= new Date(event.event_date).getTime());
  const folgende = folgendeRoh.length > 1 && folgendeRoh.length < ganzeSerie.length ? folgendeRoh : null;
  return {
    titel: 'Event einer Serie löschen',
    satz: `"${event.name}" ist Teil einer Serie mit ${ganzeSerie.length} Events.`,
    ganzeSerie,
    folgende,
    nurDiesesText: 'Nur dieses Event löschen',
    folgendeText: folgende ? `Dieses + alle folgenden löschen (${folgende.length} Events)` : null,
    ganzeSerieText: `Ganze Serie löschen (${ganzeSerie.length} Events)`,
  };
}
