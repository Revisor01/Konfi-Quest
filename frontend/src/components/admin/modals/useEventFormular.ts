// Event anlegen, bearbeiten und kopieren -- die Logik ohne Darstellung
// (11.10.2026, Simon: „Web braucht eigene kompaktere Modale überall").
//
// Bis hierher stand alles im Modal der App (EventModal.tsx). Die Web-Fassung
// (admin/web/termine/WebEventDialog) zeigt dasselbe Formular als Dialog;
// beide nutzen diesen Hook, damit Laden, Vorbelegung, Prüfen, Speichern und
// die Warteschlange ohne Netz nicht auseinanderlaufen (Vorbild: die
// Support-Hooks, z. B. components/support/useNeuerVorgang.ts). Was ein
// Schalter am übrigen Formular ändert, steht in eventFormularRegeln.ts.
//
// Speichern:
//   PUT  /events/:id        Bearbeiten (ohne Serienfelder)
//   POST /events/series     neue Serie, EINE Kennung für die ganze Serie
//   POST /events            neues Event (auch eine Kopie: id 0)
// Ohne Netz landet derselbe Aufruf in der Warteschlange.

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../../contexts/AppContext';
import { useActionGuard } from '../../../hooks/useActionGuard';
import { useZeitgeber } from '../../../hooks/useZeitgeber';
import api from '../../../services/api';
import { writeQueue } from '../../../services/writeQueue';
import { networkMonitor } from '../../../services/networkMonitor';
import { trackHandlung } from '../../../services/analytics';
import type { Event, Category, Timeslot, Jahrgang } from '../../../types/event';
import type { EventFormData } from './EventFormSections';
import { safeUUID } from '../../../utils/uuid';
import { fehlerDaten, fehlerText } from '../../../utils/fehler';
import {
  anmeldeschlussVorschlag, toIonDatetimeISO, neuerTerminBeginn, endeVorBeginn, ENDE_VOR_BEGINN,
} from '../../../utils/terminVorbelegung';
import { mitAnmeldungAbSofort, nachDatumswechsel, type TeamerZugang } from './eventFormularRegeln';

export interface EventFormularOptionen {
  /** Bestehendes Event (bearbeiten) oder Vorlage einer Kopie (id 0); leer = neu. */
  event?: Event | null;
  /**
   * Zeitfenster einer Kopie. Ein bestehender Termin lädt seine selbst nach;
   * eine Kopie hat keine id, unter der das ginge.
   */
  vorbelegteTimeslots?: Timeslot[];
  /** Nach dem Speichern (Liste neu laden, Fenster zu). */
  onSuccess: () => void;
  /** Schließt das Fenster nach dem Speichern, ohne Rückfrage. */
  schliessen: () => void;
  /** Meldet den Stand „ungespeicherte Änderungen" nach außen (canDismiss der Seite). */
  onDirtyChange?: (dirty: boolean) => void;
  /**
   * Wohin Prüf- und Speicherfehler gehen. Vorgabe: die Meldung oben
   * (setError). Der Dialog der Web-Fassung zeigt sie in sich selbst.
   */
  meldeFehler?: (meldung: string) => void;
}

/** Vorgabe eines leeren Formulars (vor dem ersten Füllen; der Effekt unten füllt es sofort). */
const leeresFormular = (): EventFormData => ({
  name: '', description: '', event_date: new Date().toISOString(), event_end_time: '',
  location: '', points: 1, point_type: 'gemeinde', category_ids: [], jahrgang_ids: [],
  type: 'event', max_participants: 5, registration_opens_at: '', registration_closes_at: '',
  has_timeslots: false, waitlist_enabled: true, max_waitlist_size: 3,
  is_series: false, series_count: 1, series_interval: 'week',
  mandatory: false, is_konfirmation: false, bring_items: '', checkin_window: 30,
  teamer_max_participants: 0, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3,
});

export function useEventFormular({ event, vorbelegteTimeslots, onSuccess, schliessen, onDirtyChange, meldeFehler }: EventFormularOptionen) {
  const { setSuccess, setError: meldungOben } = useApp();
  // Prüf- und Speicherfehler: in der App oben als Meldung, im Dialog der
  // Web-Fassung in ihm selbst. Der Name bleibt setError -- an ihm erkennt
  // die Positivliste der Fehlertexte die Aufrufstellen (bekannteFehlertexte).
  const setError = meldeFehler ?? meldungOben;
  const { isSubmitting, guard } = useActionGuard();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jahrgaenge, setJahrgaenge] = useState<Jahrgang[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Datumspicker-Obergrenze: 2 Jahre in der Zukunft, damit Termine weit im
  // Voraus (z.B. Konfis 12 Monate vorher eintragen) waehlbar sind. Ohne max
  // zeigt das IonDatetime-Wheel nur einen schmalen Bereich des laufenden Jahres.
  const datePickerMax = `${new Date().getFullYear() + 2}-12-31T23:59:59`;

  // isDirty-Stand nach aussen melden (für canDismiss der praesentierenden Seite).
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

  const [formData, setFormData] = useState<EventFormData>(leeresFormular);

  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [teamerAccess, setTeamerAccess] = useState<TeamerZugang>('normal');
  const initializedRef = useRef(false);
  const zeitgeber = useZeitgeber();
  // Wiederholungsschutz beim Anlegen eines Events oder einer Serie
  // (08.10.2026): eine Kennung je offenem Fenster. Erreicht die Warteschlange
  // den Server zweimal mit derselben, legt er das Event bzw. die ganze Serie
  // nur einmal an (die Serie traegt EINE Kennung, nicht eine je Termin).
  const anlegeKennung = useRef(safeUUID());

  useEffect(() => {
    if (initializedRef.current) setIsDirty(true);
  }, [formData]);

  const loadCategories = async () => {
    try { const response = await api.get('/admin/categories'); setCategories(response.data); }
    catch (error) { console.error('Error loading categories:', error); }
  };

  const loadJahrgaenge = async () => {
    try { const response = await api.get('/admin/jahrgaenge'); setJahrgaenge(response.data); }
    catch (error) { console.error('Error loading jahrgaenge:', error); }
  };

  const loadTimeslots = async (eventId: number) => {
    try { const response = await api.get(`/events/${eventId}/timeslots`); setTimeslots(response.data); }
    catch (error) { console.error('Error loading timeslots:', error); }
  };

  useEffect(() => {
    loadCategories();
    loadJahrgaenge();
    if (event) {
      const utcToLocalISO = (utcString: string) => {
        if (!utcString) return '';
        const date = new Date(utcString);
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };
      setFormData({
        name: event.name, description: event.description || '',
        event_date: utcToLocalISO(event.event_date),
        event_end_time: utcToLocalISO(event.event_end_time || ''),
        location: event.location || '', points: event.points,
        point_type: event.point_type || 'gemeinde',
        category_ids: event.categories?.map(c => c.id) || [],
        jahrgang_ids: event.jahrgaenge?.map(j => j.id) || [],
        type: event.type, max_participants: event.max_participants,
        registration_opens_at: utcToLocalISO(event.registration_opens_at || ''),
        registration_closes_at: utcToLocalISO(event.registration_closes_at || ''),
        has_timeslots: event.has_timeslots || false,
        waitlist_enabled: event.waitlist_enabled !== undefined ? event.waitlist_enabled : true,
        max_waitlist_size: event.max_waitlist_size || 3,
        is_series: event.is_series || false, series_count: 1, series_interval: 'week',
        mandatory: event.mandatory || false,
        is_konfirmation: event.is_konfirmation || false,
        bring_items: event.bring_items || '',
        checkin_window: event.checkin_window || 30,
        teamer_max_participants: event.teamer_max_participants ?? 0,
        teamer_waitlist_enabled: event.teamer_waitlist_enabled !== undefined ? event.teamer_waitlist_enabled : true,
        teamer_max_waitlist_size: event.teamer_max_waitlist_size ?? 3
      });
      if (event.teamer_only) setTeamerAccess('teamer_only');
      else if (event.teamer_needed) setTeamerAccess('teamer_needed');
      else setTeamerAccess('normal');
      // Zeitfenster: Ein bestehender Termin laedt sie nach. Eine Kopie (und die
      // Serien-Vorlage) hat id 0 -- dort gaebe es /events/0/timeslots, also
      // einen Fehlgriff, und die Zeitfenster blieben stillschweigend leer.
      // Deshalb bringt die Kopie sie ueber vorbelegteTimeslots selbst mit.
      if (event.has_timeslots) {
        if (event.id > 0) loadTimeslots(event.id);
        else setTimeslots(vorbelegteTimeslots ?? []);
      } else {
        setTimeslots([]);
      }
    } else {
      const roundedEventStart = neuerTerminBeginn();
      const eventEnd = new Date(roundedEventStart);
      eventEnd.setHours(eventEnd.getHours() + 2);
      // Hier stand `beginn - 1 Stunde`. Der voreingestellte Beginn ist aber
      // "jetzt + 30 Minuten" — der Schluss lag also schon beim OEFFNEN des
      // Formulars eine halbe Stunde in der Vergangenheit. Wer nur den Namen
      // eintrug und speicherte, bekam einen Termin, zu dem sich niemand
      // anmelden kann. Jetzt ueber denselben Vorschlag wie beim Aendern des
      // Datums (siehe anmeldeschlussVorschlag).
      const regCloses = anmeldeschlussVorschlag(roundedEventStart);
      setFormData({
        name: '', description: '', event_date: toIonDatetimeISO(roundedEventStart),
        event_end_time: toIonDatetimeISO(eventEnd), location: '', points: 1,
        point_type: 'gemeinde', category_ids: [], jahrgang_ids: [], type: 'event',
        // Anmeldung standardmaessig AB SOFORT (leer = kein Startzeitpunkt) —
        // der Normalfall ist "Event steht, Anmeldung läuft"; ein Startdatum in
        // der Zukunft ist die Ausnahme und lässt sich per Schalter setzen.
        max_participants: 5, registration_opens_at: '',
        registration_closes_at: toIonDatetimeISO(regCloses), has_timeslots: false,
        waitlist_enabled: true, max_waitlist_size: 3, is_series: false,
        series_count: 1, series_interval: 'week', mandatory: false, is_konfirmation: false, bring_items: '',
        checkin_window: 30,
        teamer_max_participants: 0, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3
      });
      setTimeslots([]);
      setTeamerAccess('normal');
    }
    zeitgeber.nach(100, () => { initializedRef.current = true; });
    // Nur ein anderes Event füllt das Formular neu. Die Zeitfenster einer
    // Kopie kommen mit ihrer Vorlage; ein neues Array bei jedem Zeichnen der
    // Seite darf die Eingaben nicht zurücksetzen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  const addTimeslot = () => {
    const eventDate = new Date(formData.event_date);
    let startTime: Date;
    let participants: number;
    if (timeslots.length === 0) {
      startTime = new Date(eventDate);
      participants = Math.max(1, Math.floor(formData.max_participants / 2));
    } else {
      const lastTimeslot = timeslots[timeslots.length - 1];
      startTime = new Date(lastTimeslot.end_time);
      participants = timeslots[0].max_participants;
    }
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    setTimeslots([...timeslots, { start_time: toIonDatetimeISO(startTime), end_time: toIonDatetimeISO(endTime), max_participants: participants }]);
  };

  const removeTimeslot = (index: number) => { setTimeslots(timeslots.filter((_, i) => i !== index)); };
  const updateTimeslot = (index: number, field: keyof Timeslot, value: string | number | boolean) => {
    const updated = [...timeslots]; updated[index] = { ...updated[index], [field]: value }; setTimeslots(updated);
  };

  /** Neuer Beginn aus dem Datumsfeld: Ende und (beim Anlegen) Anmeldeschluss ziehen mit. */
  const datumWechseln = (neuerBeginn: string) => {
    setFormData(nachDatumswechsel(formData, neuerBeginn, !!event));
  };

  /** Schalter „Anmeldung ab sofort". */
  const anmeldungAbSofort = (abSofort: boolean) => {
    setFormData(mitAnmeldungAbSofort(formData, abSofort));
  };

  /** Schalter „Zeitfenster aktivieren": aus verwirft die Zeitfenster. */
  const zeitfensterAktivieren = (an: boolean) => {
    setFormData({ ...formData, has_timeslots: an });
    if (!an) setTimeslots([]);
  };

  const handleSubmit = async () => {
    // Pflichtfelder prüfen und SAGEN, was fehlt. Vorher brach die Funktion
    // hier stumm ab (return ohne Meldung) — man tippte auf Speichern und es
    // passierte sichtbar nichts (User-Hinweis 10.08.).
    if (!formData.name.trim()) { setError('Bitte gib dem Event einen Namen'); return; }
    if (!formData.event_date) { setError('Bitte lege Datum und Uhrzeit fest'); return; }
    // Ende vor Beginn (Audit 26.09.2026, Leitung BF-03): Der Ende-Picker hat
    // ein min, aber ein bestehender Termin aus der Zeit davor kann den
    // Widerspruch noch mitbringen. Das Backend lehnt ihn ebenso ab.
    if (endeVorBeginn(formData.event_date, formData.event_end_time)) { setError(ENDE_VOR_BEGINN); return; }
    if (teamerAccess !== 'teamer_only' && formData.mandatory && formData.jahrgang_ids.length === 0) {
      setError('Pflicht-Events brauchen mindestens einen Jahrgang');
      return;
    }
    // guard() wirft, wenn schon eine Speicherung läuft (Doppel-Tap). Dieser
    // Wurf lag bisher außerhalb jedes catch -> unbehandelte Rejection, kein
    // Hinweis an die Nutzerin. Hier abfangen statt durchschlagen lassen.
    try {
      await guard(async () => {
    setLoading(true);
    try {
      const toBackendTimestamp = (localTimeString: string) => {
        if (!localTimeString) return null;
        return new Date(localTimeString).toISOString();
      };
      const isTeamerOnly = teamerAccess === 'teamer_only';
      const payload = {
        name: formData.name.trim(), description: formData.description.trim() || null,
        event_date: toBackendTimestamp(formData.event_date),
        event_end_time: toBackendTimestamp(formData.event_end_time),
        location: formData.location.trim() || null,
        // Reine Teamer-Events vergeben keine Konfi-Punkte (das Formular zeigt
        // die Konfis-Karte dort gar nicht) — sonst bliebe ein alter Punktwert
        // an einem umgestellten Event hängen.
        points: (formData.mandatory || formData.is_konfirmation || isTeamerOnly) ? 0 : formData.points,
        point_type: isTeamerOnly ? 'gemeinde' : formData.point_type,
        category_ids: formData.category_ids,
        jahrgang_ids: isTeamerOnly ? [] : formData.jahrgang_ids,
        type: formData.type,
        max_participants: (formData.mandatory || isTeamerOnly) ? 0 : formData.max_participants,
        // Kein Anmeldefenster bei Pflicht-Events (alle sind gesetzt) und bei
        // reinen Teamer-Events (dort gilt es nicht) — sonst bliebe an einem
        // umgestellten Event ein wirkungsloses Fenster stehen, das die
        // Statusanzeige faelschlich auf "geschlossen" setzt.
        registration_opens_at: (formData.mandatory || isTeamerOnly) ? null : toBackendTimestamp(formData.registration_opens_at),
        registration_closes_at: (formData.mandatory || isTeamerOnly) ? null : toBackendTimestamp(formData.registration_closes_at),
        has_timeslots: (formData.mandatory || formData.is_konfirmation) ? false : formData.has_timeslots,
        // Unbegrenzte Plaetze => keine Warteliste (das Formular zeigt den
        // Schalter dann gar nicht, der Payload muss dazu passen).
        waitlist_enabled: (formData.mandatory || isTeamerOnly || formData.max_participants === 0)
          ? false : formData.waitlist_enabled,
        max_waitlist_size: (formData.mandatory || isTeamerOnly || formData.max_participants === 0)
          ? 0 : formData.max_waitlist_size,
        timeslots: (!formData.mandatory && !formData.is_konfirmation && formData.has_timeslots) ? timeslots.map(ts => ({
          ...ts, start_time: toBackendTimestamp(ts.start_time), end_time: toBackendTimestamp(ts.end_time)
        })) : [],
        is_series: formData.is_series,
        series_count: formData.is_series ? formData.series_count : undefined,
        series_interval: formData.is_series ? formData.series_interval : undefined,
        // "Nur Teamer:innen" schließt Pflicht-Event und Konfirmation aus
        // (beides sind Konfi-Kategorien) — das Formular blendet sie dort aus,
        // der Payload haelt es konsistent, auch bei umgestellten Bestands-Events.
        mandatory: isTeamerOnly ? false : formData.mandatory,
        is_konfirmation: isTeamerOnly ? false : formData.is_konfirmation,
        bring_items: formData.bring_items.trim() || null,
        checkin_window: formData.checkin_window,
        teamer_needed: teamerAccess === 'teamer_needed', teamer_only: teamerAccess === 'teamer_only',
        teamer_max_participants: teamerAccess === 'normal' ? 0 : formData.teamer_max_participants,
        // Auch hier: unbegrenzte Teamer-Plaetze => keine Warteliste.
        teamer_waitlist_enabled: (teamerAccess === 'normal' || formData.teamer_max_participants === 0)
          ? false : formData.teamer_waitlist_enabled,
        teamer_max_waitlist_size: (teamerAccess === 'normal' || formData.teamer_max_participants === 0)
          ? 0 : formData.teamer_max_waitlist_size
      };

      if (networkMonitor.isOnline) {
        if (event && event.id && event.id > 0) {
          // Serienfelder gehoeren nicht in ein Update einzelner Events.
          const updatePayload = { ...payload } as Record<string, unknown>;
          delete updatePayload.is_series;
          delete updatePayload.series_count;
          delete updatePayload.series_interval;
          await api.put(`/events/${event.id}`, updatePayload);
        } else {
          if (formData.is_series) {
            await api.post('/events/series', { ...payload, client_id: anlegeKennung.current });
            // Anonyme Messung NACH der erfolgreichen Antwort. Nur Form und
            // Zielgruppe — kein Titel, kein Datum, kein Jahrgang, keine
            // Teilnehmerzahl und auch nicht die Laenge der Serie.
            trackHandlung('termin-angelegt', {
              form: 'serie',
              zielgruppe: isTeamerOnly ? 'teamer' : 'konfi'
            });
            setSuccess(`Event-Serie mit ${formData.series_count} Events erstellt`);
          } else {
            await api.post('/events', { ...payload, client_id: anlegeKennung.current });
            trackHandlung('termin-angelegt', {
              form: 'einzeln',
              zielgruppe: isTeamerOnly ? 'teamer' : 'konfi'
            });
          }
        }
      } else {
        if (event && event.id && event.id > 0) {
          const updatePayload = { ...payload } as Record<string, unknown>;
          delete updatePayload.is_series;
          delete updatePayload.series_count;
          delete updatePayload.series_interval;
          await writeQueue.enqueue({ method: 'PUT', url: `/events/${event.id}`, body: updatePayload, maxRetries: 5, hasFileUpload: false, metadata: { type: 'admin', clientId: safeUUID(), label: 'Event bearbeiten' } });
          setSuccess('Event wird aktualisiert sobald du wieder online bist');
        } else if (formData.is_series) {
          await writeQueue.enqueue({ method: 'POST', url: '/events/series', body: { ...payload, client_id: anlegeKennung.current }, maxRetries: 5, hasFileUpload: false, metadata: { type: 'admin', clientId: anlegeKennung.current, label: 'Event-Serie erstellen' } });
          setSuccess('Event-Serie wird erstellt sobald du wieder online bist');
        } else {
          await writeQueue.enqueue({ method: 'POST', url: '/events', body: { ...payload, client_id: anlegeKennung.current }, maxRetries: 5, hasFileUpload: false, metadata: { type: 'admin', clientId: anlegeKennung.current, label: 'Event erstellen' } });
          setSuccess('Event wird erstellt sobald du wieder online bist');
        }
      }
      // Dirty-Stand SYNCHRON nach aussen melden, bevor onSuccess/schliessen über
      // canDismiss schließt (sonst blockiert canDismiss -> Modal bleibt offen).
      setIsDirty(false); onDirtyChange?.(false); onSuccess(); schliessen();
    } catch (error) {
      // Validierungsfehler des Backends kommen als { error, details: [...] } —
      // ohne die details liest man nur "Validierungsfehler" und weiß nicht,
      // welches Feld gemeint ist.
      const data = fehlerDaten(error);
      const details = (Array.isArray(data?.details) ? data.details : [])
        .map((d: unknown) => (typeof d === 'object' && d !== null ? (d as { message?: unknown }).message : undefined))
        .filter((m): m is string => typeof m === 'string' && m !== '')
        .join(', ');
      if (details) setError(details);
      else setError(fehlerText(error, 'Fehler beim Speichern des Events'));
    } finally { setLoading(false); }
      });
    } catch {
      // guard() hat abgelehnt: es läuft bereits eine Speicherung. Nichts tun —
      // der Button ist ohnehin disabled, das ist kein Fehler für die Nutzerin.
    }
  };

  const isFormValid = formData.name.trim().length > 0 && formData.event_date && (teamerAccess === 'teamer_only' || !formData.mandatory || formData.jahrgang_ids.length > 0);

  return {
    formData, setFormData,
    timeslots, addTimeslot, removeTimeslot, updateTimeslot,
    teamerAccess, setTeamerAccess,
    categories, jahrgaenge,
    loading, isSubmitting, isDirty, isFormValid,
    datePickerMax,
    datumWechseln, anmeldungAbSofort, zeitfensterAktivieren,
    handleSubmit,
  };
}

export type EventFormularZustand = ReturnType<typeof useEventFormular>;
