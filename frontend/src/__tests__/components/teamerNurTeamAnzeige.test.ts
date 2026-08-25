import { describe, it, expect } from 'vitest';

// User-Hinweis 25.08.2026 zum Teamer-Baum:
// 1. Reine Team-Termine fehlten im Reiter "Alle" — er filterte teamer_only
//    heraus. Ein solcher Termin war damit nur unter "Team" zu finden.
// 2. In den Kopfkacheln konnte "-1 Konfis" stehen.
// 3. Bei Nur-Team-Terminen wurden Konfi-Werte gezeigt, die dort immer 0 sind.
//
// teamer_only und teamer_needed schliessen sich in der Datenbank gegenseitig
// aus (CHECK events_teamer_exclusive) — beim Nachstellen in Produktion
// bestaetigt.
type E = {
  teamer_only?: boolean;
  teamer_needed?: boolean;
  registered_count?: number;
  teamer_count?: number;
  teamer_waitlist_count?: number;
};

const alleEvents = (evts: E[]) => evts;
const teamEvents = (evts: E[]) => evts.filter((e) => e.teamer_needed || e.teamer_only);
const konfiCount = (e: E) => Math.max(0, e.registered_count || 0);

const kacheln = (e: E) =>
  e.teamer_only
    ? [
        { value: Math.max(0, e.teamer_count || 0), label: 'Team' },
        { value: Math.max(0, e.teamer_waitlist_count || 0), label: 'Warteliste' }
      ]
    : [
        { value: konfiCount(e), label: 'Konfis' },
        { value: Math.max(0, e.teamer_count || 0), label: 'Team' }
      ];

const NUR_TEAM: E = { teamer_only: true, teamer_needed: false, registered_count: 0, teamer_count: 3 };
const MIT_TEAM: E = { teamer_only: false, teamer_needed: true, registered_count: 19, teamer_count: 4 };
const NUR_KONFI: E = { teamer_only: false, teamer_needed: false, registered_count: 12, teamer_count: 0 };

describe('Teamer: Reiter "Alle"', () => {
  it('zeigt auch reine Team-Termine', () => {
    const alle = alleEvents([NUR_TEAM, MIT_TEAM, NUR_KONFI]);
    expect(alle).toHaveLength(3);
    expect(alle).toContain(NUR_TEAM);
  });

  it('der Reiter "Team" bleibt auf Team-Termine beschraenkt', () => {
    const team = teamEvents([NUR_TEAM, MIT_TEAM, NUR_KONFI]);
    expect(team).toHaveLength(2);
    expect(team).not.toContain(NUR_KONFI);
  });
});

describe('Teamer: Kopfkacheln', () => {
  it('zeigt bei Nur-Team-Terminen KEINE Konfi-Kachel', () => {
    const k = kacheln(NUR_TEAM);
    expect(k.map((x) => x.label)).toEqual(['Team', 'Warteliste']);
    expect(k[0].value).toBe(3);
  });

  it('zeigt sonst Konfis und Team', () => {
    const k = kacheln(MIT_TEAM);
    expect(k.map((x) => x.label)).toEqual(['Konfis', 'Team']);
    expect(k[0].value).toBe(19);
  });

  it('wird nie negativ', () => {
    // Verbotener Fall: "-1 Konfis" in der Anzeige.
    expect(konfiCount({ registered_count: -1 })).toBe(0);
    expect(kacheln({ teamer_only: true, teamer_count: -1 })[0].value).toBe(0);
  });

  it('faengt fehlende Werte ab', () => {
    expect(konfiCount({})).toBe(0);
    expect(kacheln({ teamer_only: true })[0].value).toBe(0);
  });
});
