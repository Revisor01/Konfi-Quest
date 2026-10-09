/**
 * Offline Erledigtes nachzaehlen (docs/messung/umami.md, S14; Simon,
 * 09.10.2026).
 *
 * Grundsatz der Messung: erst nach der erfolgreichen Server-Antwort melden.
 * Eine offline eingereihte Handlung ist deshalb beim Klick NICHT gezaehlt
 * worden. Gelingt sie spaeter beim Nachsenden der Warteschlange
 * (services/writeQueue.ts, flush), meldet diese Stelle sie nach -- mit dem
 * Merkmal `nachgesendet`, damit sich sehen laesst, wie viel Arbeit ohne Netz
 * geschieht.
 *
 * ZUORDNUNG UEBER METHODE UND ADRESSE, NIE UEBER DIE BESCHRIFTUNG: Das
 * `label` eines Eintrags ist Freitext fuer die Anzeige ("Abmeldung von
 * \"Konfifreizeit\"") und kann Titel enthalten. Die Tabelle unten ist fest;
 * Kennungen in der Adresse werden nur am Muster erkannt und nie gesendet.
 * Aus dem Rumpf werden nur Felder gelesen, deren Werte die Positivliste von
 * `trackHandlung` ohnehin prueft.
 *
 * Nicht dabei: der Chat (bewusst nie gemessen) und alle stillen Aufraeumer
 * (gelesen markieren, Einstellungen) -- sie haben kein Gegenstueck unter den
 * Ereignissen.
 */
import { track, trackHandlung, losungBibelMesswert } from './analytics';

export interface NachgesendeterEintrag {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: Record<string, unknown>;
}

const text = (wert: unknown): string | undefined => (typeof wert === 'string' ? wert : undefined);

/** Feste Zuordnung: Methode + Adressmuster -> Meldung. */
const ZUORDNUNG: Array<{
  method: NachgesendeterEintrag['method'];
  muster: RegExp;
  melden: (body: Record<string, unknown>) => void;
}> = [
  {
    method: 'POST',
    muster: /^\/(konfi|teamer)\/requests$/,
    melden: (b) => track('aktivitaet-eingereicht', {
      mit_foto: !!(b.photo_filename || b._localPhotoPath),
      nachgesendet: true
    })
  },
  {
    method: 'POST',
    muster: /^\/admin\/konfis\/\d+\/bonus-points$/,
    melden: (b) => trackHandlung('punkte-vergeben', { weg: 'bonus', punkteart: text(b.type), nachgesendet: 'true' })
  },
  {
    // Die Punkteart der Aktivitaet steht nicht im Rumpf (nur activity_id) --
    // dann ohne Merkmal, nicht geraten.
    method: 'POST',
    muster: /^\/admin\/konfis\/\d+\/activities$/,
    melden: () => trackHandlung('punkte-vergeben', { weg: 'aktivitaet', nachgesendet: 'true' })
  },
  {
    method: 'PUT',
    muster: /^\/admin\/activities\/requests\/\d+$/,
    melden: (b) => trackHandlung('antrag-entschieden', {
      entscheidung: b.status === 'approved' ? 'angenommen' : b.status === 'rejected' ? 'abgelehnt' : undefined,
      nachgesendet: 'true'
    })
  },
  {
    method: 'POST',
    muster: /^\/events$/,
    melden: () => trackHandlung('termin-angelegt', { form: 'einzeln', nachgesendet: 'true' })
  },
  {
    method: 'POST',
    muster: /^\/events\/series$/,
    melden: () => trackHandlung('termin-angelegt', { form: 'serie', nachgesendet: 'true' })
  },
  {
    method: 'POST',
    muster: /^\/material$/,
    melden: () => trackHandlung('material-bereitgestellt', { nachgesendet: 'true' })
  },
  {
    method: 'POST',
    muster: /^\/admin\/badges$/,
    melden: (b) => trackHandlung('badge-angelegt', { zielgruppe: text(b.target_role), nachgesendet: 'true' })
  },
  {
    // Pflicht-Event: Opt-out.
    method: 'POST',
    muster: /^\/konfi\/events\/\d+\/opt-out$/,
    melden: () => trackHandlung('event-abgemeldet', { pflicht: 'true', nachgesendet: 'true' })
  },
  {
    method: 'DELETE',
    muster: /^\/konfi\/events\/\d+\/register$/,
    melden: () => trackHandlung('event-abgemeldet', { pflicht: 'false', nachgesendet: 'true' })
  },
  {
    // Zu- oder Absage des Teams. Ob die Zusage auf der Warteliste landet,
    // steht erst in der Antwort -- die liest die Warteschlange nicht.
    method: 'POST',
    muster: /^\/teamer\/events\/\d+\/zusage$/,
    melden: (b) => {
      if (b.dabei === true) track('event-angemeldet', { mit_zeitfenster: false, nachgesendet: true });
      else if (b.dabei === false) trackHandlung('event-abgemeldet', { nachgesendet: 'true' });
    }
  },
  {
    method: 'PUT',
    muster: /^\/(konfi|teamer)\/bible-translation$/,
    melden: (b) => trackHandlung('losung-bibel', { bibel: losungBibelMesswert(text(b.translation)), nachgesendet: 'true' })
  }
];

/**
 * Einen nachgesendeten Eintrag melden. Faengt jeden eigenen Fehler ab -- die
 * Messung darf das Abarbeiten der Warteschlange nie stoeren.
 */
export function nachgesendetMelden(eintrag: NachgesendeterEintrag): void {
  try {
    const regel = ZUORDNUNG.find((r) => r.method === eintrag.method && r.muster.test(eintrag.url));
    regel?.melden(eintrag.body || {});
  } catch {
    /* Messung darf nie stoeren */
  }
}
