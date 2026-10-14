// Die Anwesenheit der Pflicht-Events und die Konfisprüche eines Jahrgangs --
// als Logik ohne Darstellung. Die App zeigt sie im Modal
// (AttendanceMatrixModal), der Browser ab 992 px im Dialog
// (web/leitung/WebAnwesenheitDialog; Simon, 13.10.2026: „anwesenheiten
// glaube ich auch nicht" im neuen Look). Laden, Suche, Umschalten, die
// Zellen und die Summe stehen nur hier, damit beide nicht auseinanderlaufen.
//
// Laden:   GET /admin/jahrgaenge/:id/attendance-matrix,
//          GET /admin/jahrgaenge/:id/sprueche (erst beim Umschalten)
// E-Mail:  POST /admin/jahrgaenge/:id/matrix-email { type }
// Meldungen: in der App wie bisher oben (setError, setSuccess); im Dialog des
// Browsers (`meldungenImFenster`) stehen sie im Fenster selbst.

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import api from '../../../services/api';
import { datumKurz } from '../../../utils/dateUtils';
import { fehlerText } from '../../../utils/fehler';
import {
  berechneZeilenStats,
  getZellStatus,
  type MatrixZeilenStats,
  type MatrixZellStatus,
} from '../../../utils/anwesenheitsMatrix';

export interface MatrixJahrgang {
  id: number;
  name: string;
}

export interface MatrixKonfi {
  user_id: number;
  display_name: string;
  username?: string;
}

export interface MatrixEvent {
  id: number;
  name: string;
  event_date: string;
}

export interface MatrixBuchung {
  event_id: number;
  user_id: number;
  status: string | null;
  // 'excused' (12.09.2026): von der Leitung nachgetragene Abmeldung.
  attendance_status: 'present' | 'absent' | 'excused' | null;
  excuse_reason?: string | null;
  attendance_note?: string | null;
}

export interface MatrixAntwort {
  jahrgang: { id: number; name: string };
  konfis: MatrixKonfi[];
  events: MatrixEvent[];
  bookings: MatrixBuchung[];
}

export interface Konfspruch {
  source: 'liste' | 'freitext';
  id?: number;
  reference?: string | null;
  text: string;
  translation?: string | null;
}

export interface SpruchZeile {
  user_id: number;
  display_name: string;
  konfspruch: Konfspruch | null;
  konfirmation_date?: string | null;
}

export type MatrixAnsicht = 'anwesenheit' | 'sprueche';

export interface MatrixMeldung {
  art: 'fehler' | 'erfolg';
  text: string;
}

/** Datum im Kopf einer Event-Spalte, ohne Jahr ("14.09."). */
export const matrixDatum = (iso: string): string => {
  try {
    return datumKurz(new Date(iso), { ohneJahr: true });
  } catch {
    return iso;
  }
};

export const LEERE_ZEILE: MatrixZeilenStats = { present: 0, absent: 0, excused: 0, open: 0, opted_out: 0, nenner: 0 };
export const EMAIL_GESENDET = 'E-Mail an deine Adresse gesendet';

/** Die Zeichen der Zellen in Worten (Legende, Vorleseprogramm). */
export const ZELL_TEXT: Record<MatrixZellStatus, string> = {
  present: 'Anwesend',
  absent: 'Fehlt',
  opted_out: 'Abgemeldet',
  // Zweiter Abmelde-Weg: die Leitung traegt nach, was ausserhalb der App
  // gemeldet wurde. Gleiches Zeichen, gleiche Wirkung auf den Nenner -- aber
  // eine andere Herkunft, deshalb ein eigener Eintrag.
  excused: 'Abgemeldet (nachgetragen)',
  open: 'Offen',
};

export interface AnwesenheitsMatrixOptionen {
  jahrgaenge: MatrixJahrgang[];
  initialJahrgangId?: number;
  /** Fehler und Erfolg im Fenster zeigen (Dialog des Browsers) statt als Meldung der App. */
  meldungenImFenster?: boolean;
}

export function useAnwesenheitsMatrix({ jahrgaenge, initialJahrgangId, meldungenImFenster = false }: AnwesenheitsMatrixOptionen) {
  const { setError, setSuccess } = useApp();
  const [jahrgangId, setJahrgangIdState] = useState<number | null>(
    initialJahrgangId ?? (jahrgaenge.length > 0 ? jahrgaenge[0].id : null)
  );
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MatrixAntwort | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewModeState] = useState<MatrixAnsicht>('anwesenheit');
  const [sprueche, setSprueche] = useState<SpruchZeile[] | null>(null);
  const [spruecheLoading, setSpruecheLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [meldung, setMeldung] = useState<MatrixMeldung | null>(null);

  // Eine Meldung im Fenster gilt dem Jahrgang und der Ansicht, für die sie
  // kam; ein Wechsel räumt sie weg (Gegenprüfung 13.10.2026: Sonst stand ein
  // Ladefehler über der fehlerfrei geladenen Tabelle des nächsten Jahrgangs
  // und „E-Mail gesendet" über den Konfisprüchen, die niemand verschickt
  // hatte). In der App ist `meldung` immer leer; ihre Meldungen sind Toasts,
  // die von selbst gehen.
  const setJahrgangId = (id: number | null) => {
    setMeldung(null);
    setJahrgangIdState(id);
  };
  const setViewMode = (ansicht: MatrixAnsicht) => {
    setMeldung(null);
    setViewModeState(ansicht);
  };

  const meldeFehler = (text: string) => {
    if (meldungenImFenster) setMeldung({ art: 'fehler', text });
    else setError(text);
  };

  const loadMatrix = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/jahrgaenge/${id}/attendance-matrix`);
      setData(res.data);
    } catch (err) {
      meldeFehler(fehlerText(err, 'Fehler beim Laden der Anwesenheit'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSprueche = async (id: number) => {
    setSprueche(null); // alte Sprueche sofort verwerfen (kein kurzes Aufblitzen beim Jahrgang-Wechsel)
    setSpruecheLoading(true);
    try {
      const res = await api.get(`/admin/jahrgaenge/${id}/sprueche`);
      setSprueche(res.data);
    } catch (err) {
      meldeFehler(fehlerText(err, 'Fehler beim Laden der Konfisprüche'));
      setSprueche(null);
    } finally {
      setSpruecheLoading(false);
    }
  };

  useEffect(() => {
    if (jahrgangId) loadMatrix(jahrgangId);
  }, [jahrgangId]);

  useEffect(() => {
    if (jahrgangId && viewMode === 'sprueche') loadSprueche(jahrgangId);
  }, [jahrgangId, viewMode]);

  // Schickt die aktuelle Ansicht (Anwesenheit oder Sprüche) per E-Mail an die eigene Adresse.
  const handleSendEmail = async () => {
    if (!jahrgangId) return;
    setSending(true);
    setMeldung(null);
    try {
      await api.post(`/admin/jahrgaenge/${jahrgangId}/matrix-email`, { type: viewMode });
      if (meldungenImFenster) setMeldung({ art: 'erfolg', text: EMAIL_GESENDET });
      else setSuccess(EMAIL_GESENDET);
    } catch (err) {
      meldeFehler(fehlerText(err, 'Fehler beim Senden der E-Mail'));
    } finally {
      setSending(false);
    }
  };

  // Sprüche-Liste nach Suchbegriff filtern (gleiches Suchfeld wie die Matrix).
  const filteredSprueche = useMemo(() => {
    if (!sprueche) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sprueche;
    return sprueche.filter(s => s.display_name.toLowerCase().includes(term));
  }, [sprueche, searchTerm]);

  // Schneller Lookup: bookings nach (user, event) gruppieren
  const bookingMap = useMemo(() => {
    const map = new Map<string, MatrixBuchung>();
    if (data) {
      data.bookings.forEach(b => map.set(`${b.user_id}-${b.event_id}`, b));
    }
    return map;
  }, [data]);

  // Zellstatus kommt aus utils/anwesenheitsMatrix (Befund 4, 25.08.2026):
  // Abgemeldete ('opted_out') sind ein eigener Status und fallen nicht mehr
  // auf "ausstehend" — sie waren sonst von "noch nicht verbucht" nicht
  // unterscheidbar (Prod-Events 105, 129, 132).
  const getCellStatus = (userId: number, eventId: number): MatrixZellStatus =>
    getZellStatus(bookingMap.get(`${userId}-${eventId}`));

  /** Grund und Notiz einer Zelle: Die Matrix ist die Übersicht, in der die Kolleginnen nachsehen. */
  const zellHinweis = (userId: number, eventId: number): string => {
    const b = bookingMap.get(`${userId}-${eventId}`);
    return [
      getCellStatus(userId, eventId) === 'excused' ? b?.excuse_reason : null,
      b?.attendance_note
    ].filter(Boolean).join(' · ');
  };

  // Pro-Konfi-Statistik (inkl. Nenner ohne Abmeldungen, Befund 4)
  const konfiStats = useMemo(() => {
    const stats = new Map<number, MatrixZeilenStats>();
    if (!data) return stats;
    data.konfis.forEach(k => {
      stats.set(k.user_id, berechneZeilenStats(
        data.events.map(e => getCellStatus(k.user_id, e.id))
      ));
    });
    return stats;
  }, [data, bookingMap]);

  // Live-Suche: Konfi-Zeilen nach Name/Benutzername filtern
  const filteredKonfis = useMemo(() => {
    if (!data) return [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.konfis;
    return data.konfis.filter(k =>
      k.display_name.toLowerCase().includes(term) ||
      (k.username || '').toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  return {
    jahrgangId,
    setJahrgangId,
    loading,
    data,
    searchTerm,
    setSearchTerm,
    viewMode,
    setViewMode,
    sprueche,
    spruecheLoading,
    sending,
    handleSendEmail,
    filteredSprueche,
    filteredKonfis,
    bookingMap,
    getCellStatus,
    zellHinweis,
    konfiStats,
    /** Die Meldung im Fenster (nur mit `meldungenImFenster`). */
    meldung,
  };
}

export type AnwesenheitsMatrixZustand = ReturnType<typeof useAnwesenheitsMatrix>;
