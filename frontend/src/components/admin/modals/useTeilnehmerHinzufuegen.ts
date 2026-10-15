// Konfis, Team oder Leitung zu einem Event hinzufügen -- als Logik ohne
// Darstellung (Simon, 15.10.2026, Seiten-Inventar: im Browser ab 992 px jedes
// Formular als kompaktes Fenster der Web-Fassung, in den Apps und darunter
// das Modal wie bisher). Die App zeigt sie im Modal
// (ParticipantManagementModal), der Browser im Dialog
// (web/termine/WebTeilnehmerHinzufuegenDialog). Wer wählbar ist, die Filter,
// die Prüfung, der Weg zum Server und seine Texte stehen nur hier, damit
// beide nicht auseinanderlaufen.
//
// Wählbar (die Regel „Wer sieht und bekommt was" in CLAUDE.md; den Rest
// prüft der Server):
//   Konfis       GET /admin/konfis          (der Server liefert, was diese Person sieht)
//   Team         GET /admin/konfis/teamer
//   Leitung      GET /admin/konfis/leitung  (nur, wenn Leitung gewählt wird)
// Wer schon eingetragen ist, fällt heraus; wer zu keinem Jahrgang des Events
// gehört, ebenso (utils/jahrgangsPassung.ts) -- außer bei „Nur Team" und
// Events ohne Jahrgang.
// Eintragen: je Person POST /events/:id/participants
//   { user_id, status: 'confirmed', [timeslot_id], ueberbuchen }
// Ist das Event voll, fragt die Rückfrage „Trotzdem eintragen" (App: Alert,
// Browser: kleiner Dialog) einmal je Kontingent (utils/ueberbuchen.ts).
//
// Meldungen: in der App wie bisher oben (setError); im Dialog des Browsers
// (`fehlerImDialog`) im Dialog selbst (`fehler`). Ist nach dem Eintragen
// schon jemand drin, schließt der Aufrufer (onSuccess) -- ein Fehler bei den
// Übrigen geht dann wie in der App als Meldung oben, denn das Fenster ist fort.

import { useEffect, useRef, useState } from 'react';
import api from '../../../services/api';
import { useApp, type FehlerDiagnose } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import type { Participant } from '../../../types/event';
// Die Jahrgangsregel liegt in utils/jahrgangsPassung.ts (25.09.2026) — sie
// spiegelt gehoertZumTermin im Backend und hat dort ihre Erklaerung.
import { passtZumTermin } from '../../../utils/jahrgangsPassung';
import { fehlerText } from '../../../utils/fehler';
import { uhrzeit } from '../../../utils/dateUtils';
import { eintragenMitRueckfrage, type UeberbuchenFrage } from '../../../utils/ueberbuchen';

export type HinzufuegenRolle = 'teamer' | 'konfi' | 'leitung';

export interface WaehlbarePerson {
  id: number;
  name: string;
  // Konfis: EIN Jahrgang (konfi_profiles). Team und Leitung: MEHRERE
  // (user_jahrgang_assignments) — /admin/konfis/teamer und /admin/konfis/leitung
  // liefern sie seit dem 25.09.2026 als jahrgang_ids.
  jahrgang_id?: number;
  jahrgang_ids?: number[];
  jahrgang_name?: string;
  role_name?: string;
  is_super_admin?: boolean;
}

// Participant kommt zentral aus types/event. Die fruehere Fassung im Modal
// kannte nur 'confirmed' | 'pending' — dieselbe Antwort liefert aber auch
// 'waitlist' und 'opted_out' (backend/routes/events/lesen.js).

export interface HinzufuegenZeitfenster {
  id: number;
  start_time: string;
  end_time: string;
  max_participants: number;
  registered_count: number;
}

interface EventJahrgang {
  id: number;
  name: string;
}

interface EventDaten {
  has_timeslots?: boolean;
  timeslots?: HinzufuegenZeitfenster[];
  teamer_only?: boolean;
  jahrgang_id?: number;
  jahrgang_name?: string;
  jahrgaenge?: EventJahrgang[];
}

export interface TeilnehmerHinzufuegenOptionen {
  eventId: number;
  // 'leitung' = Admins/Org-Admins zuordnen (31.08.2026). Bewusst pro Termin;
  // niemand rutscht automatisch in einen Event-Chat.
  filterRole?: HinzufuegenRolle | null;
  /** Mindestens eine Person ist eingetragen: Der Aufrufer schließt und lädt neu. */
  onSuccess: () => void;
  /** Die Rückfrage „voll -- trotzdem eintragen?"; true = trotzdem. */
  frageUeberbuchen: (frage: UeberbuchenFrage) => Promise<boolean>;
  /** Meldungen im Fenster zeigen (`fehler`; der Dialog des Browsers) statt oben (App). */
  fehlerImDialog?: boolean;
}

/** Die zweite Zeile einer Person: Rolle und Jahrgang -- dieselbe in App und Browser. */
export const personUnterzeile = (person: WaehlbarePerson, rollenName: (rolle: string) => string): string => {
  if (person.role_name === 'teamer') return `${rollenName('teamer')}${person.jahrgang_name ? ` · ${person.jahrgang_name}` : ''}`;
  if (person.role_name === 'admin' || person.role_name === 'org_admin') return rollenName(person.role_name);
  return person.jahrgang_name || '';
};

const formatTime = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return uhrzeit(date);
};

/** Ein Zeitfenster zur Wahl: „10:00 - 11:00 (3/8)", voll mit „ - Voll" -- derselbe Text in App und Browser. */
export const zeitfensterBeschriftung = (slot: HinzufuegenZeitfenster): string => {
  const isFull = slot.max_participants > 0 && (slot.registered_count || 0) >= slot.max_participants;
  const capacityText = slot.max_participants === 0
    ? `(${slot.registered_count || 0})`
    : `(${slot.registered_count || 0}/${slot.max_participants})`;
  return `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)} ${capacityText}${isFull ? ' - Voll' : ''}`;
};

export function useTeilnehmerHinzufuegen({
  eventId, filterRole, onSuccess, frageUeberbuchen, fehlerImDialog = false,
}: TeilnehmerHinzufuegenOptionen) {
  const { setError: meldungOben, isOnline } = useApp();
  // Die Meldung im Dialog; leer, sobald jemand etwas ändert.
  const [fehler, setFehler] = useState<string | null>(null);
  // Ist schon jemand eingetragen, schließt der Aufrufer das Fenster: Eine
  // Meldung danach käme im Dialog nirgends an.
  const geschlossen = useRef(false);
  // Wohin eine Meldung geht (siehe oben). Bewusst unter dem Namen setError:
  // Die Positivliste der Fehlertexte (utils/bekannteFehlertexte.ts) liest die
  // Texte an den Aufrufstellen von setError.
  const setError = (meldung: string, diagnose?: FehlerDiagnose) => {
    if (fehlerImDialog && !geschlossen.current) setFehler(meldung || null);
    else if (diagnose) meldungOben(meldung, diagnose);
    else meldungOben(meldung);
  };

  const [searchTerm, setSearchTermRoh] = useState('');
  const [availableKonfis, setAvailableKonfis] = useState<WaehlbarePerson[]>([]);
  const [selectedKonfis, setSelectedKonfis] = useState<number[]>([]);
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [eventData, setEventData] = useState<EventDaten | null>(null);
  const [selectedTimeslot, setSelectedTimeslotRoh] = useState<number | null>(null);
  const [availableJahrgaenge, setAvailableJahrgaenge] = useState<string[]>([]);
  const [selectedJahrgang, setSelectedJahrgangRoh] = useState<string>('alle');
  const [currentParticipants, setCurrentParticipants] = useState<Participant[]>([]);
  // Die Personen sind da (oder das Laden ist gescheitert).
  const [geladen, setGeladen] = useState(false);

  // Event-Jahrgänge ermitteln (für Filter)
  const eventJahrgaenge = eventData?.jahrgaenge?.map(j => j.name) ||
    (eventData?.jahrgang_name ? [eventData.jahrgang_name] : []);
  const eventJahrgangIds: number[] = eventData?.jahrgaenge?.map(j => j.id) ||
    (eventData?.jahrgang_id ? [eventData.jahrgang_id] : []);
  const hasEventJahrgaenge = eventJahrgaenge.length > 0;
  // Greift die Jahrgangsgrenze fuer die Auswahl? Nicht bei 'Nur Team' und
  // nicht ohne Jahrgang — dann steht auch kein Hinweis auf der Seite.
  const jahrgangsGrenzeAktiv = hasEventJahrgaenge && !eventData?.teamer_only;
  const zeitfenster = eventData?.has_timeslots && eventData.timeslots && eventData.timeslots.length > 0
    ? eventData.timeslots
    : [];

  const loadAvailableKonfis = async (participantsList?: Participant[]) => {
    try {
      // Die Leitungsliste nur laden, wenn sie auch gebraucht wird — sonst
      // holt jedes Oeffnen des Konfi-Modals eine Liste, die es nie zeigt.
      const [konfisRes, teamerRes, leitungRes] = await Promise.all([
        api.get('/admin/konfis'),
        api.get('/admin/konfis/teamer'),
        filterRole === 'leitung' ? api.get('/admin/konfis/leitung') : Promise.resolve({ data: [] })
      ]);
      const allKonfis = konfisRes.data.map((k: WaehlbarePerson) => ({ ...k, role_name: 'konfi' }));
      const teamerUsers = teamerRes.data.map((u: WaehlbarePerson) => ({ ...u, role_name: 'teamer' }));
      // role_name kommt hier ECHT aus dem Backend ('admin' oder 'org_admin')
      // und wird nicht ueberschrieben — die Unterscheidung wird unten gebraucht.
      const leitungUsers = leitungRes.data as WaehlbarePerson[];
      const allPersons = [...allKonfis, ...teamerUsers, ...leitungUsers];

      // Aktuelle Participants nutzen (Parameter oder State)
      const activeParticipants = participantsList || currentParticipants;

      // Filter out already registered participants based on user_id (not booking id)
      const participantUserIds = activeParticipants.map(p => p.user_id || p.id);
      const available = allPersons.filter((p: WaehlbarePerson) => !participantUserIds.includes(p.id));

      // Filter by role if filterRole prop is set
      let roleFiltered = available;
      if (filterRole === 'teamer') {
        roleFiltered = available.filter((p: WaehlbarePerson) => p.role_name === 'teamer');
      } else if (filterRole === 'leitung') {
        roleFiltered = available.filter((p: WaehlbarePerson) => p.role_name === 'admin' || p.role_name === 'org_admin');
      } else if (filterRole === 'konfi') {
        // Positiv auf 'konfi' pruefen: Ein '!== teamer' liesse seit der
        // Leitungs-Zuordnung auch Admins in die Konfi-Auswahl.
        roleFiltered = available.filter((p: WaehlbarePerson) => p.role_name === 'konfi');
      }

      // Extract available Jahrgänge (wird nur für Dropdown gebraucht wenn Event keine Jahrgänge hat)
      const jahrgaenge = [...new Set(
        roleFiltered
          .filter((k: WaehlbarePerson) => k.jahrgang_name)
          .map((k: WaehlbarePerson) => k.jahrgang_name!)
      )].sort() as string[];
      setAvailableJahrgaenge(jahrgaenge);

      setAvailableKonfis(roleFiltered);
    } catch {
      setError('Fehler beim Laden der Personen');
    }
  };

  const loadInitialData = async () => {
    try {
      // Zuerst Event-Daten und Participants laden
      const eventResponse = await api.get(`/events/${eventId}`);
      setEventData(eventResponse.data);
      const loadedParticipants: Participant[] = eventResponse.data.participants || [];
      setCurrentParticipants(loadedParticipants);

      // Dann verfügbare Konfis laden (braucht Participants für Filterung)
      await loadAvailableKonfis(loadedParticipants);
    } catch (err) {
      setError('Fehler beim Laden der Daten', { ort: 'teilnehmer-verwaltung-laden', fehler: err });
    } finally {
      setGeladen(true);
    }
  };

  useEffect(() => {
    void loadInitialData();
  }, []);

  const filteredKonfis = availableKonfis.filter(konfi => {
    // Search filter
    const matchesSearch = konfi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (konfi.jahrgang_name && konfi.jahrgang_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (konfi.role_name === 'teamer' && 'teamer'.includes(searchTerm.toLowerCase())) ||
      ((konfi.role_name === 'admin' || konfi.role_name === 'org_admin') &&
        'leitung'.includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Wer zu keinem Jahrgang des Termins gehoert, wird gar nicht erst
    // angeboten — Konfis, Team und Leitung gleichermassen (25.09.2026). Bis
    // dahin galt hier "Teamer:innen und Leitung sind immer sichtbar", und
    // nur die Konfis wurden ueber den Namen des Jahrgangs gefiltert.
    if (!passtZumTermin(konfi, eventData, eventJahrgangIds)) return false;

    // Der Jahrgangs-Filter im Kopf betrifft nur Konfis: Team und Leitung
    // tragen mehrere Jahrgaenge und stehen ohnehin nur bei Ueberschneidung hier.
    if (konfi.role_name !== 'konfi') return true;

    // Spezifischer Jahrgang gewählt (bei "alle" reicht passtZumTermin oben)
    if (selectedJahrgang !== 'alle') {
      return konfi.jahrgang_name === selectedJahrgang;
    }

    return true;
  });

  /** Jede Eingabe räumt eine alte Meldung im Dialog weg. */
  const aendern = <T,>(setzen: (wert: T) => void) => (wert: T) => {
    setFehler(null);
    setzen(wert);
  };

  const handleKonfiSelection = (konfiId: number) => {
    setFehler(null);
    setSelectedKonfis(prev =>
      prev.includes(konfiId)
        ? prev.filter(id => id !== konfiId)
        : [...prev, konfiId]
    );
  };

  /** Sind alle sichtbaren (gefilterten) Personen gewählt? Dann heißt der Knopf „Keine". */
  const alleGewaehlt = filteredKonfis.length > 0 && filteredKonfis.every(k => selectedKonfis.includes(k.id));

  // Alle sichtbaren (gefilterten) Personen aus-/abwaehlen.
  const alleUmschalten = () => {
    setFehler(null);
    const allIds = filteredKonfis.map(k => k.id);
    const allSelected = allIds.every(id => selectedKonfis.includes(id));
    setSelectedKonfis(allSelected ? [] : allIds);
  };

  const handleAddParticipants = async () => {
    if (selectedKonfis.length === 0) return;

    // For events with timeslots, require timeslot selection
    if (eventData?.has_timeslots && !selectedTimeslot) {
      setError('Bitte wähle einen Zeitslot aus');
      return;
    }
    setFehler(null);

    // guard() wirft bei Doppel-Tap ('Aktion läuft bereits'). Ungefangen
    // bliebe loading auf true hängen — dann liess sich das Modal nur
    // noch per Swipe schliessen (User-Hinweis 12.08.).
    try {
      await guard(async () => {
        setLoading(true);
        try {
          // Von Hand Eingetragene sind bestaetigt, auch ueber die Grenze -- aber
          // erst nach einer Rueckfrage (Simon, 28.09.2026: "Die sollten wir auch
          // einfügen, wenn wir Konfi hinzufügen ... oder auch bei Teamern").
          // Jede Person geht zuerst mit ueberbuchen: false hinaus; meldet der
          // Server "voll", fragt die App einmal je Kontingent (Konfi/Team) fuer
          // alle Uebrigen (utils/ueberbuchen.ts).
          const auswahl = selectedKonfis.map(
            (id) => availableKonfis.find((k) => k.id === id) ?? { id, name: '' }
          );
          const ergebnis = await eintragenMitRueckfrage(
            auswahl,
            (person, ueberbuchen) => api.post(`/events/${eventId}/participants`, {
              user_id: person.id,
              status: 'confirmed',
              // timeslot_id kommt nur dazu, wenn der Termin Zeitfenster hat.
              ...(eventData?.has_timeslots && selectedTimeslot ? { timeslot_id: selectedTimeslot } : {}),
              ueberbuchen
            }).then(() => undefined),
            frageUeberbuchen,
            (person) => ({ name: person.name || undefined, seite: person.role_name === 'konfi' ? 'konfi' : 'team' })
          );

          // Wer drin ist, bleibt drin -- auch nach Abbruch oder Fehler. Die
          // Uebrigen bleiben ausgewaehlt, damit man sie abwaehlen oder die
          // Teilnehmerzahl erhoehen und es noch einmal versuchen kann.
          setSelectedKonfis(ergebnis.offen.map((person) => person.id));
          // Participants und verfügbare Konfis neu laden
          const eventResponse = await api.get(`/events/${eventId}`);
          const updatedParticipants: Participant[] = eventResponse.data.participants || [];
          setCurrentParticipants(updatedParticipants);
          await loadAvailableKonfis(updatedParticipants);
          if (ergebnis.eingetragen.length > 0) {
            geschlossen.current = true;
            onSuccess();
          }
          if (ergebnis.fehler) throw ergebnis.fehler;
        } catch (err) {
          // Die Meldung des Servers zeigen, wenn er eine hat — etwa "… gehört
          // zu keinem Jahrgang dieses Termins" (403). Sonst der Sammelbegriff.
          // Ueber fehlerText, damit die Fehlermessung statt des Server-Textes
          // (er traegt den Namen der Person) den Sammelbegriff meldet.
          setError(fehlerText(err, 'Fehler beim Hinzufügen der Teilnehmer:innen'));
        } finally {
          setLoading(false);
        }
      });
    } catch {
      // Zweiter Aufruf verworfen — Ladezustand sicher zuruecknehmen.
      setLoading(false);
    }
  };

  return {
    isOnline,
    searchTerm,
    setSearchTerm: aendern(setSearchTermRoh),
    selectedJahrgang,
    setSelectedJahrgang: aendern(setSelectedJahrgangRoh),
    selectedTimeslot,
    setSelectedTimeslot: aendern(setSelectedTimeslotRoh),
    eventData,
    eventJahrgaenge,
    hasEventJahrgaenge,
    availableJahrgaenge,
    jahrgangsGrenzeAktiv,
    zeitfenster,
    filteredKonfis,
    selectedKonfis,
    handleKonfiSelection,
    alleGewaehlt,
    alleUmschalten,
    handleAddParticipants,
    /** Es wird gesendet (Knopf gesperrt, Dialog gesperrt). */
    sendet: loading || isSubmitting,
    loading,
    isSubmitting,
    geladen,
    fehler,
  };
}

export type TeilnehmerHinzufuegenZustand = ReturnType<typeof useTeilnehmerHinzufuegen>;
