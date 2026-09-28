// Die Rueckfrage vor dem Loeschen eines Jahrgangs (28.09.2026).
//
// Seit Simons Entscheidung vom 28.09.2026 nimmt das Loeschen eines Jahrgangs
// die Events und Challenges mit, die nur zu ihm gehoeren (Backend:
// utils/jahrgangLoeschen.js). Das muss in der Rueckfrage stehen -- mit
// Zahlen, damit niemand zwanzig Termine loescht, weil er einen leeren
// Jahrgang vermutet hat. Die Zahlen kommen aus
// GET /admin/jahrgaenge/:id/loeschvorschau, derselben Regel-Stelle wie das
// Loeschen selbst.
//
// Liefert der Server keine Vorschau (aelterer Server, Netzfehler), steht die
// allgemeine Fassung da -- sie sagt dasselbe ohne Zahlen.

export interface JahrgangLoeschVorschau {
  aktive_konfis: number;
  befoerderte: number;
  chat_nachrichten: number;
  events_geloescht: number;
  events_kuenftig: number;
  events_behalten: number;
  challenges_geloescht: number;
  challenges_behalten: number;
}

const anzahl = (n: number, einzahl: string, mehrzahl: string) => `${n} ${n === 1 ? einzahl : mehrzahl}`;

/** Ist das eine brauchbare Vorschau? Schuetzt vor halben Antworten. */
export const istLoeschVorschau = (wert: unknown): wert is JahrgangLoeschVorschau => {
  if (!wert || typeof wert !== 'object') return false;
  const v = wert as Record<string, unknown>;
  return ['aktive_konfis', 'befoerderte', 'chat_nachrichten', 'events_geloescht', 'events_kuenftig',
    'events_behalten', 'challenges_geloescht', 'challenges_behalten']
    .every((schluessel) => typeof v[schluessel] === 'number');
};

/**
 * Der Text der Rueckfrage.
 *
 * @param name     Name des Jahrgangs
 * @param vorschau Antwort der Vorschau-Route oder null
 */
export function jahrgangLoeschHinweis(name: string, vorschau: JahrgangLoeschVorschau | null): string {
  const absaetze: string[] = [`Jahrgang "${name}" wirklich löschen?`];

  if (!vorschau) {
    absaetze.push(
      'Der Jahrgang, sein Chatverlauf und die Events und Challenges, die nur zu ihm gehören, werden '
      + 'unwiderruflich entfernt. Solange dem Jahrgang noch aktive Konfis zugeordnet sind, ist das Löschen '
      + 'nicht möglich. Zu Teamer:innen beförderte Konfis behalten ihre Konfi-Zeit mit Punkten und Badges.'
    );
    return absaetze.join('\n\n');
  }

  if (vorschau.aktive_konfis > 0) {
    absaetze.push(`Dem Jahrgang sind noch ${anzahl(vorschau.aktive_konfis, 'aktive Konfi', 'aktive Konfis')} `
      + 'zugeordnet — solange ist das Löschen nicht möglich.');
  }

  const weg: string[] = [];
  if (vorschau.events_geloescht > 0) weg.push(anzahl(vorschau.events_geloescht, 'Event', 'Events'));
  if (vorschau.challenges_geloescht > 0) weg.push(anzahl(vorschau.challenges_geloescht, 'Challenge', 'Challenges'));
  if (weg.length > 0) {
    let satz = `Mit dem Jahrgang werden ${weg.join(' und ')} gelöscht — samt Anmeldungen, Chats und Beiträgen.`;
    if (vorschau.events_kuenftig > 0) {
      satz += ` ${vorschau.events_kuenftig === 1 ? 'Ein Event liegt' : `${vorschau.events_kuenftig} Events liegen`} noch in der Zukunft.`;
    }
    absaetze.push(satz);
  } else {
    absaetze.push('Zum Jahrgang gehören keine eigenen Events und Challenges.');
  }

  const bleiben: string[] = [];
  if (vorschau.events_behalten > 0) bleiben.push(anzahl(vorschau.events_behalten, 'Event', 'Events'));
  if (vorschau.challenges_behalten > 0) bleiben.push(anzahl(vorschau.challenges_behalten, 'Challenge', 'Challenges'));
  if (bleiben.length > 0) {
    absaetze.push(`${bleiben.join(' und ')} gehören auch zu anderen Jahrgängen oder dem Team und bleiben bestehen; `
      + 'nur die Zuordnung zu diesem Jahrgang fällt weg.');
  }

  if (vorschau.challenges_geloescht > 0) {
    absaetze.push('Stempel, die Teamer:innen und Leitung in diesen Challenges bekommen haben, bleiben ihnen erhalten.');
  }
  if (vorschau.befoerderte > 0) {
    absaetze.push(`${anzahl(vorschau.befoerderte, 'zur Teamer:in beförderte Konfi behält', 'zu Teamer:innen beförderte Konfis behalten')} `
      + 'ihre Konfi-Zeit mit Punkten und Badges.');
  }
  if (vorschau.chat_nachrichten > 0) {
    absaetze.push(`Der Chat des Jahrgangs enthält ${anzahl(vorschau.chat_nachrichten, 'Nachricht', 'Nachrichten')}.`);
  }

  absaetze.push('Das lässt sich nicht rückgängig machen.');
  return absaetze.join('\n\n');
}
