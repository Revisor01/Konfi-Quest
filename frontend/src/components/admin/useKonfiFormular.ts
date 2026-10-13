// „Konfi anlegen" und „Konfi bearbeiten" -- als Logik ohne Darstellung (Simon,
// 13.10.2026: „Das konfi anlegen modal ist noch nicht im neuen web modal look";
// „Konfi bearbeiten hat noch kein eigenes web modal"). Die App zeigt sie im
// Modal (modals/KonfiModal.tsx), der Browser ab 992 px im Dialog
// (web/leitung/WebKonfiDialog.tsx). Felder, Prüfung, die Warnungen beim
// Jahrgangswechsel, die Kennung gegen doppeltes Anlegen, die beiden Wege zum
// Server und ihre Texte stehen nur hier, damit beide nicht auseinanderlaufen.
//
// Anlegen:    POST /admin/konfis { name, jahrgang_id, client_id[, confirm] }
// Bearbeiten: PUT /admin/konfis/:id { name, jahrgang_id }
//
// Was der Server beim Anlegen antwortet, ordnet konfiAnlegen() ein. Die App
// zeigt das Ergebnis nach dem Schließen des Modals als Rückfrage bzw. Meldung
// (AdminKonfisPage), der Dialog des Browsers im Fenster selbst.

import { useRef, useState } from 'react';
import { useActionGuard } from '../../hooks/useActionGuard';
import api from '../../services/api';
import type { KonfiAngelegtAntwort, KonfiFormDaten } from '../../types/user';
import { endgueltigAbgelehnt, fehlerDaten, fehlerStatus, fehlerText } from '../../utils/fehler';
import { safeUUID } from '../../utils/uuid';

export interface KonfiJahrgang {
  id: number;
  name: string;
  // Punktearten des Jahrgangs. Sie kommen aus GET /admin/jahrgaenge (SELECT j.*)
  // und werden fuer die Warnung beim Wechsel gebraucht.
  gottesdienst_enabled?: boolean;
  gemeinde_enabled?: boolean;
}

/** Die bearbeitete Konfi; fehlt sie, wird angelegt. */
export interface KonfiZumBearbeiten {
  id: number;
  display_name: string;
  jahrgang_id: number | null;
  gottesdienst_points?: number;
  gemeinde_points?: number;
}

export interface KonfiFormularOptionen {
  jahrgaenge: KonfiJahrgang[];
  /**
   * Gesetzt = BEARBEITEN, nicht gesetzt = ANLEGEN. Ein Formular für beides:
   * Felder, Jahrgangs-Auswahl und Prüfung sind identisch, nur Überschrift,
   * Hinweis und die Warnungen unterscheiden sich.
   */
  konfi?: KonfiZumBearbeiten;
  /** Jahrgänge, denen die angemeldete Person zugewiesen ist (nur `admin`). */
  eigeneJahrgangIds?: number[];
}

// --- Texte: dieselben in App und Browser ---
export const NAME_FEHLT = 'Bitte einen Namen eingeben.';
export const JAHRGANG_FEHLT = 'Bitte einen Jahrgang wählen.';
export const KONFI_NAME_VERGEBEN = 'Ein Konfi mit diesem Namen existiert bereits.';
export const AENDERUNGEN_GESPEICHERT = 'Änderungen gespeichert';
export const LIMIT_RUECKFRAGE_TITEL = 'Konfi-Limit erreicht';
export const TARIF_GRENZE_TITEL = 'Tarif-Upgrade nötig';
export const KEINE_ANTWORT_TITEL = 'Keine Antwort vom Server';
export const EINMALPASSWORT_TITEL = 'Einmalpasswort';

/** Der Hinweis beim Anlegen: Das Passwort steht nur einmal da. */
export const ANLEGEN_HINWEIS = 'Benutzername und Passwort werden automatisch generiert. Das Passwort wird dir nach dem Anlegen einmal angezeigt — kopiere es und gib es weiter. Einsehen lässt es sich danach nicht mehr; in der Detailansicht kannst du nur ein neues erzeugen.';
/** Der Hinweis beim Bearbeiten. Das Backend generiert den Benutzernamen bewusst NICHT neu. */
export const BEARBEITEN_HINWEIS = 'Der Benutzername zum Anmelden ändert sich nicht — auch dann nicht, wenn du den Namen korrigierst.';
/** Was ein Wechsel des Jahrgangs bewirkt (Entscheidungen 27.08.2026). */
export const WECHSEL_FOLGEN = [
  'Anmeldungen zu künftigen Events des alten Jahrgangs fallen weg.',
  'Pflicht-Events des neuen Jahrgangs kommen dazu.',
  'Der Jahrgangs-Chat wechselt mit.',
  'Der Jahresrückblick erscheint erst wieder, wenn der neue Jahrgang freigegeben ist.',
] as const;
export const WECHSEL_BLEIBT = 'Bereits erfasste Anwesenheiten und vergangene Events bleiben unberührt.';

// Die Zahlen kommen ungeprüft aus der Antwort des Servers (count, limit,
// next_tier) und stehen so im Satz, wie sie kommen -- wie bisher in der App.
const tarifHinweis = (nextTier: unknown, sonst: string): string =>
  (nextTier ? `Der nächste Tarif gibt dir Platz für bis zu ${String(nextTier)} Konfis.` : sonst);

/** Die Rückfrage nach 409 limit_grace: „Trotzdem anlegen" schickt confirm mit. */
export const limitRueckfrageText = (count?: unknown, limit?: unknown, nextTier?: unknown): string => {
  const standText = count !== undefined && limit !== undefined ? `${String(count)} von ${String(limit)} Konfis` : 'das Konfi-Limit';
  return `Du hast ${standText} angelegt. Du kannst noch bis zu 5 weitere Konfis anlegen, danach ist ein Tarif-Upgrade nötig. ${tarifHinweis(nextTier, 'Eine höhere Tarif-Stufe ist nicht verfügbar.')}`;
};

/** 403 limit_exceeded: nur Hinweis, kein Override. */
export const tarifGrenzeText = (nextTier?: unknown): string =>
  `Das Konfi-Limit ist ausgeschöpft. Um weitere Konfis anzulegen, ist ein Tarif-Upgrade nötig. ${tarifHinweis(nextTier, 'Bitte wende dich an den Support für ein passendes Angebot.')}`;

/** Keine Antwort, Zeitlimit oder Serverfehler: ob das Konto steht, ist offen. */
export const keineAntwortText = (name: string): string =>
  `Ob "${name}" angelegt wurde, ist unklar. Ein neuer Versuch legt kein zweites Konto an.`;

export const einmalpasswortText = (name: string): string =>
  `Konfi "${name}" erstellt. Kopiere das Passwort und gib es dem Konfi weiter.`;

/** Wie das Anlegen ausging -- die App und der Dialog zeigen es je auf ihre Art. */
export type KonfiAnlegenErgebnis =
  | { art: 'angelegt'; passwort?: string; benutzername?: string }
  /** 409 limit_grace: Rückfrage „Trotzdem anlegen" (derselbe Rumpf mit confirm). */
  | { art: 'limit-rueckfrage'; text: string }
  /** 403 limit_exceeded: kein Weg ohne Tarif-Upgrade. */
  | { art: 'tarif-grenze'; text: string }
  /** 409 ohne Code: Der Name ist vergeben (KONFI_NAME_VERGEBEN). */
  | { art: 'name-vergeben' }
  /** Ohne Antwort oder 5xx: „Erneut versuchen" mit derselben Kennung. */
  | { art: 'keine-antwort'; text: string }
  /** Alles andere, auch 409 bereits_angelegt (Text des Servers). */
  | { art: 'fehler'; text: string };

/**
 * POST /admin/konfis und die Einordnung der Antwort. Wirft nicht.
 *
 * Wiederholungsschutz (Migration 203): Ein zweiter Versuch mit derselben
 * Kennung (client_id) legt kein zweites Konto an, sondern liefert dasselbe mit
 * neuem Einmalpasswort. Hat sich das Konto schon angemeldet, antwortet der
 * Server 409 bereits_angelegt -- das ist keine Namens-Kollision.
 */
export async function konfiAnlegen(daten: KonfiFormDaten): Promise<KonfiAnlegenErgebnis> {
  try {
    const antwort = await api.post<KonfiAngelegtAntwort>('/admin/konfis', daten);
    return { art: 'angelegt', passwort: antwort.data?.temporaryPassword, benutzername: antwort.data?.username };
  } catch (err) {
    const fehler = fehlerDaten(err);
    const code = fehler?.error_code;
    if (code === 'limit_grace') {
      return { art: 'limit-rueckfrage', text: limitRueckfrageText(fehler?.count, fehler?.limit, fehler?.next_tier) };
    }
    if (code === 'limit_exceeded') return { art: 'tarif-grenze', text: tarifGrenzeText(fehler?.next_tier) };
    if (code === 'bereits_angelegt') {
      // Kein neues Passwort, kein zweites Konto. Der Server sagt, wo es weitergeht.
      return { art: 'fehler', text: fehlerText(err, 'Fehler beim Hinzufügen des Konfis') };
    }
    if (fehlerStatus(err) === 409) return { art: 'name-vergeben' };
    if (daten.client_id && !endgueltigAbgelehnt(fehlerStatus(err))) {
      return { art: 'keine-antwort', text: keineAntwortText(daten.name) };
    }
    return { art: 'fehler', text: fehlerText(err, 'Fehler beim Hinzufügen des Konfis') };
  }
}

/** PUT /admin/konfis/:id -- Name und Jahrgang. Fehler gehen an den Aufrufer. */
export async function konfiAendern(konfiId: number, daten: KonfiFormDaten): Promise<void> {
  await api.put(`/admin/konfis/${konfiId}`, daten);
}

export function useKonfiFormular({ jahrgaenge, konfi, eigeneJahrgangIds }: KonfiFormularOptionen) {
  const bearbeiten = !!konfi;
  const [name, setName] = useState(konfi?.display_name ?? '');
  const [jahrgangId, setJahrgangId] = useState<number | null>(konfi?.jahrgang_id ?? null);
  const { isSubmitting, guard } = useActionGuard();
  // Wiederholungsschutz beim Anlegen: eine Kennung je offenem Fenster. Ein
  // zweiter Versuch (keine Antwort, "Erneut versuchen", "Trotzdem anlegen")
  // legt damit kein zweites Konto an.
  const anlegeKennung = useRef(safeUUID());

  /** Was fehlt, als Satz; null, wenn alles da ist. */
  const pruefen = (): string | null => {
    if (!name.trim()) return NAME_FEHLT;
    if (jahrgangId === null) return JAHRGANG_FEHLT;
    return null;
  };

  /** Der Rumpf an den Server; nur nach erfolgreichem pruefen() aufrufen. */
  const daten = (): KonfiFormDaten => ({
    name: name.trim(),
    jahrgang_id: jahrgangId as number,
    ...(bearbeiten ? {} : { client_id: anlegeKennung.current })
  });

  // --- Warnungen beim Jahrgangswechsel (Entscheidungen 27.08.2026) ---
  //
  // Beide warnen nur, sie blockieren nicht: Der Wechsel ist ein legitimer
  // Vorgang — meist "falsch angelegt, muss in den richtigen Jahrgang".
  // Ueberraschend sind nur die Folgen, und genau die stehen da.
  const wechselt = !!konfi && jahrgangId !== null && jahrgangId !== konfi.jahrgang_id;
  const ziel = jahrgaenge.find((jg) => jg.id === jahrgangId);

  // 1. Punktearten: Ist im Ziel-Jahrgang eine Punkteart abgeschaltet, die die
  //    Konfi schon gesammelt hat, verschwinden diese Punkte aus jeder Anzeige.
  //    Sie bleiben in der Datenbank — sichtbar sind sie dort nicht mehr.
  const verlorenePunkte: string[] = [];
  if (wechselt && ziel) {
    if (ziel.gottesdienst_enabled === false && (konfi.gottesdienst_points ?? 0) > 0) {
      verlorenePunkte.push(`${konfi.gottesdienst_points} Gottesdienstpunkte`);
    }
    if (ziel.gemeinde_enabled === false && (konfi.gemeinde_points ?? 0) > 0) {
      verlorenePunkte.push(`${konfi.gemeinde_points} Gemeindepunkte`);
    }
  }

  // 2. Eigene Zuweisung: Ein `admin` sieht nur Konfis seiner Jahrgaenge. Schiebt
  //    er eine Konfi in einen fremden, verschwindet sie aus seiner Liste.
  //    `eigeneJahrgangIds` bleibt fuer org_admin leer — dort gibt es die Grenze
  //    nicht, also auch keine Warnung.
  const verliertSicht = wechselt
    && Array.isArray(eigeneJahrgangIds)
    && eigeneJahrgangIds.length > 0
    && !eigeneJahrgangIds.includes(jahrgangId as number);

  /** Die Warnsätze zum Wechsel, wie App und Browser sie zeigen. */
  const wechselAchtung: string[] = [
    ...(verlorenePunkte.length > 0
      ? [`Achtung: In ${ziel?.name} ${verlorenePunkte.length === 1 ? 'ist diese Punkteart' : 'sind diese Punktearten'} abgeschaltet — ${verlorenePunkte.join(' und ')} werden dort nicht mehr angezeigt.`]
      : []),
    ...(verliertSicht
      ? [`Achtung: Du bist ${ziel?.name} nicht zugewiesen — nach dem Speichern siehst du ${name.trim() || 'diese Konfi'} nicht mehr in deiner Liste.`]
      : []),
  ];

  return {
    bearbeiten,
    name,
    setName,
    jahrgangId,
    setJahrgangId,
    isSubmitting,
    guard,
    pruefen,
    /** Der Haken der App ist nur frei, wenn das stimmt. */
    isValid: pruefen() === null,
    daten,
    wechselt,
    ziel,
    verlorenePunkte,
    verliertSicht,
    wechselAchtung,
  };
}

export type KonfiFormularZustand = ReturnType<typeof useKonfiFormular>;
