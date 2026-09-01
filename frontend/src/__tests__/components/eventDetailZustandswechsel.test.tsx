import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState, useEffect, useRef } from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Nutzerhinweis 01.09.2026: In der Teilnehmerliste eines Termins standen
// Abmeldungen von Personen, die dort gar keine Buchung hatten. Gemessen an
// Produktionsdaten (Hennstedt, "Spendenlauf (Helfen)" und "Spendenlauf
// (Laufen)" — fast gleicher Name, selber Tag): Backend und API lieferten
// beide Male genau das Richtige. Es waren die Teilnehmer und Abmeldungen des
// zuvor geoeffneten Termins, die stehen geblieben waren.
//
// Ursache: Der IonRouterOutlet behaelt gemountete Seiten im Speicher, und
// ParamSeite (MainTabs.tsx) reicht die ID als Prop in DIESELBE Instanz. Ein
// Wechsel des Termins ist also KEIN Neu-Einhaengen — die Zustandswerte des
// vorigen Termins bleiben stehen, bis die neue Antwort sie ersetzt. Offline
// werden sie nie ersetzt.
//
// Die beiden Hooks unten bilden genau dieses Muster nach: einmal ohne den
// Fix (zeigt den Fehler) und einmal mit ihm. Der Rest der Ansicht — Ionic,
// Modals, Kontexte — spielt fuer den Fehler keine Rolle.

type Antwort = { teilnehmer: string[] };

/** Ohne Fix: Werte bleiben beim Wechsel stehen, spaete Antworten gewinnen. */
const useOhneFix = (eventId: number, laden: (id: number) => Promise<Antwort>) => {
  const [teilnehmer, setTeilnehmer] = useState<string[]>([]);
  useEffect(() => {
    laden(eventId).then((a) => setTeilnehmer(a.teilnehmer));
  }, [eventId]);
  return teilnehmer;
};

/** Mit Fix: Wechsel leert, und nur die Antwort zum offenen Termin zaehlt. */
const useMitFix = (eventId: number, laden: (id: number) => Promise<Antwort>) => {
  const [teilnehmer, setTeilnehmer] = useState<string[]>([]);
  const aktuelleEventId = useRef(eventId);

  useEffect(() => {
    aktuelleEventId.current = eventId;
    setTeilnehmer([]);
  }, [eventId]);

  useEffect(() => {
    const fuerEventId = eventId;
    const gilt = () => aktuelleEventId.current === fuerEventId;
    laden(fuerEventId).then((a) => { if (gilt()) setTeilnehmer(a.teilnehmer); });
  }, [eventId]);

  return teilnehmer;
};

describe('Terminwechsel in derselben Seiteninstanz', () => {
  it('zeigt ohne den Fix die Teilnehmer des VORIGEN Termins', async () => {
    // Termin 2 antwortet nie — das ist der Offline-Fall: Der Abruf kommt
    // nicht durch, und ohne Leeren bleibt Termin 1 dauerhaft stehen.
    const laden = vi.fn((id: number) =>
      id === 1 ? Promise.resolve({ teilnehmer: ['Anna', 'Ben'] }) : new Promise<Antwort>(() => {})
    );

    const { result, rerender } = renderHook(({ id }) => useOhneFix(id, laden), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current).toEqual(['Anna', 'Ben']));

    await act(async () => { rerender({ id: 2 }); });

    // Der Fehler, den Simon gesehen hat: Termin 2 zeigt Termin 1.
    expect(result.current).toEqual(['Anna', 'Ben']);
  });

  it('leert mit dem Fix beim Wechsel sofort', async () => {
    const laden = vi.fn((id: number) =>
      id === 1 ? Promise.resolve({ teilnehmer: ['Anna', 'Ben'] }) : new Promise<Antwort>(() => {})
    );

    const { result, rerender } = renderHook(({ id }) => useMitFix(id, laden), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current).toEqual(['Anna', 'Ben']));

    await act(async () => { rerender({ id: 2 }); });

    // Leer ist ehrlich: Termin 2 hat noch keine Daten geliefert.
    expect(result.current).toEqual([]);
  });

  it('laesst mit dem Fix eine verspaetete Antwort nicht mehr gewinnen', async () => {
    // Schneller Wechsel 1 -> 2: Die Antwort fuer 1 trifft NACH der fuer 2 ein.
    let loeseEins: (a: Antwort) => void = () => {};
    const laden = vi.fn((id: number) => {
      if (id === 1) return new Promise<Antwort>((res) => { loeseEins = res; });
      return Promise.resolve({ teilnehmer: ['Clara'] });
    });

    const { result, rerender } = renderHook(({ id }) => useMitFix(id, laden), {
      initialProps: { id: 1 },
    });

    await act(async () => { rerender({ id: 2 }); });
    await waitFor(() => expect(result.current).toEqual(['Clara']));

    await act(async () => { loeseEins({ teilnehmer: ['Anna', 'Ben'] }); });

    // Termin 2 bleibt stehen — die alte Antwort wird verworfen.
    expect(result.current).toEqual(['Clara']);
  });
});

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Beide Detailansichten tragen den Fix', () => {
  const adminDetail = lies('src/components/admin/views/EventDetailView.tsx');
  const konfiDetail = lies('src/components/konfi/views/EventDetailView.tsx');

  it('leert in der Leitungsansicht beim Wechsel', () => {
    // Ohne diese Zeilen stehen Teilnehmer und Abmeldungen des vorigen Termins.
    expect(adminDetail).toContain('aktuelleEventId.current = eventId;');
    expect(adminDetail).toContain('setParticipants([]);');
    expect(adminDetail).toContain('setUnregistrations([]);');
  });

  it('leert in der Konfi-Ansicht beim Wechsel', () => {
    // Dort haengen Zeitfenster, Teilnehmerliste und der Konfirmations-Check
    // am Nachlade-Effekt, der offline gar nicht erst laeuft.
    expect(konfiDetail).toContain('aktuelleEventId.current = eventId;');
    expect(konfiDetail).toContain('setTimeslots([]);');
    expect(konfiDetail).toContain('setHasExistingKonfirmation(false);');
  });

  it('verwirft in beiden Ansichten Antworten zu einem anderen Termin', () => {
    expect(adminDetail).toContain('const gilt = () => aktuelleEventId.current === fuerEventId;');
    expect(konfiDetail).toContain('const gilt = () => aktuelleEventId.current === fuerEventId;');
  });
});
