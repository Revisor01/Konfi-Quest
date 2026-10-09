// utils/konfiListe: Punkte, Ordnung und Jahrgangs-Sicht der Konfi- und
// Team-Liste der Leitung (App und Web-Fassung rechnen hier).
import { describe, it, expect } from 'vitest';
import {
  konfiPunkte,
  initialen,
  jahrgangVon,
  sortiereKonfis,
  sortiereTeam,
  sichtbareJahrgaenge,
  teamerName,
  ERSTE_RICHTUNG,
  TEAM_ERSTE_RICHTUNG,
  type KonfiListenEintrag,
} from '../../utils/konfiListe';

const konfi = (id: number, name: string, mehr: Partial<KonfiListenEintrag> = {}): KonfiListenEintrag => ({ id, name, ...mehr });
const namen = (liste: { name: string }[]) => liste.map((k) => k.name);

describe('konfiPunkte', () => {
  it('summiert beide Arten gegen die Ziele des Jahrgangs', () => {
    const p = konfiPunkte(konfi(1, 'A', { gottesdienst_points: 6, gemeinde_points: 9, target_gottesdienst: 8, target_gemeinde: 12 }));
    expect(p).toEqual({
      gottesdienst: 6, gemeinde: 9, gesamt: 15,
      gottesdienstAn: true, gemeindeAn: true,
      zielGottesdienst: 8, zielGemeinde: 12, zielGesamt: 20,
      prozentGottesdienst: 75, prozentGemeinde: 75, prozentGesamt: 75,
      erreicht: false,
    });
  });

  it('eine abgeschaltete Art zaehlt weder zur Summe noch zum Ziel', () => {
    const p = konfiPunkte(konfi(1, 'A', { gottesdienst_points: 6, gemeinde_points: 9, gemeinde_enabled: false, target_gottesdienst: 6, target_gemeinde: 12 }));
    expect(p.gesamt).toBe(6);
    expect(p.zielGesamt).toBe(6);
    expect(p.gemeindeAn).toBe(false);
    expect(p.erreicht).toBe(true);
    expect(p.prozentGesamt).toBe(100);
  });

  it('ohne Ziel oder mit Ziel 0 gelten 10 je Art', () => {
    const p = konfiPunkte(konfi(1, 'A', { gottesdienst_points: 5, target_gemeinde: 0 }));
    expect(p.zielGottesdienst).toBe(10);
    expect(p.zielGemeinde).toBe(10);
    expect(p.prozentGottesdienst).toBe(50);
  });

  it('liest die Altform points, wenn die neuen Felder fehlen', () => {
    const p = konfiPunkte(konfi(1, 'A', { points: { gottesdienst: 3, gemeinde: 4 } }));
    expect(p.gottesdienst).toBe(3);
    expect(p.gemeinde).toBe(4);
    expect(p.gesamt).toBe(7);
  });

  it('beide Arten abgeschaltet: Ziel 0, nicht erreicht, 0 Prozent statt Division durch 0', () => {
    const p = konfiPunkte(konfi(1, 'A', { gottesdienst_points: 5, gottesdienst_enabled: false, gemeinde_enabled: false }));
    expect(p.zielGesamt).toBe(0);
    expect(p.erreicht).toBe(false);
    expect(p.prozentGesamt).toBe(0);
  });
});

describe('initialen und jahrgangVon', () => {
  it('erster und letzter Name, ein Name ergibt seine zwei ersten Buchstaben, leer bleibt leer', () => {
    expect(initialen('Mia Lena Beispiel')).toBe('MB');
    expect(initialen('  mia  ')).toBe('MI');
    expect(initialen('')).toBe('');
    expect(initialen(null)).toBe('');
  });

  it('der Jahrgang kommt aus jahrgang_name, sonst aus der Altform', () => {
    expect(jahrgangVon({ jahrgang_name: '2026', jahrgang: 'alt' })).toBe('2026');
    expect(jahrgangVon({ jahrgang: '2025' })).toBe('2025');
    expect(jahrgangVon({})).toBe('');
  });
});

describe('sortiereKonfis', () => {
  const liste = [
    konfi(1, 'Ben', { gottesdienst_points: 4, gemeinde_points: 1, badgeCount: 2, jahrgang_name: '2026', letzte_aktivitaet: '2026-10-01T10:00:00Z' }),
    konfi(2, 'Anna', { gottesdienst_points: 4, gemeinde_points: 5, badgeCount: 0, jahrgang_name: '2025', letzte_aktivitaet: null }),
    konfi(3, 'Cem', { gottesdienst_points: 9, gemeinde_points: 0, gottesdienst_enabled: false, badgeCount: 2, jahrgang_name: '2024', letzte_aktivitaet: '2026-10-05T10:00:00Z' }),
  ];

  it('nach Punkten absteigend zaehlt nur die aktiven Arten', () => {
    expect(namen(sortiereKonfis(liste, 'punkte', 'ab'))).toEqual(['Anna', 'Ben', 'Cem']);
  });

  it('bei gleichem Wert entscheidet der Name A-Z', () => {
    expect(namen(sortiereKonfis(liste, 'gottesdienst', 'ab'))).toEqual(['Anna', 'Ben', 'Cem']);
    expect(namen(sortiereKonfis(liste, 'badges', 'ab'))).toEqual(['Ben', 'Cem', 'Anna']);
  });

  it('eine abgeschaltete Art und eine fehlende Aktivitaet stehen in beiden Richtungen unten', () => {
    expect(namen(sortiereKonfis(liste, 'gottesdienst', 'auf'))).toEqual(['Anna', 'Ben', 'Cem']);
    expect(namen(sortiereKonfis(liste, 'aktivitaet', 'ab'))).toEqual(['Cem', 'Ben', 'Anna']);
    expect(namen(sortiereKonfis(liste, 'aktivitaet', 'auf'))).toEqual(['Ben', 'Cem', 'Anna']);
  });

  it('nach Jahrgang und Name als Text, ohne die Liste selbst umzustellen', () => {
    expect(namen(sortiereKonfis(liste, 'jahrgang', 'auf'))).toEqual(['Cem', 'Anna', 'Ben']);
    expect(namen(sortiereKonfis(liste, 'name', 'ab'))).toEqual(['Cem', 'Ben', 'Anna']);
    expect(namen(liste)).toEqual(['Ben', 'Anna', 'Cem']);
  });

  it('ohne Jahrgang (auch leerer Name) steht in beiden Richtungen unten', () => {
    const mitOhne = [...liste, konfi(4, 'Aaron'), konfi(5, 'Dana', { jahrgang_name: '' })];
    expect(namen(sortiereKonfis(mitOhne, 'jahrgang', 'auf'))).toEqual(['Cem', 'Anna', 'Ben', 'Aaron', 'Dana']);
    expect(namen(sortiereKonfis(mitOhne, 'jahrgang', 'ab'))).toEqual(['Ben', 'Anna', 'Cem', 'Aaron', 'Dana']);
  });

  it('erste Richtung: Namen A-Z, Zahlen und Daten groesste zuerst', () => {
    expect(ERSTE_RICHTUNG).toEqual({ name: 'auf', jahrgang: 'auf', gottesdienst: 'ab', gemeinde: 'ab', punkte: 'ab', badges: 'ab', aktivitaet: 'ab' });
    expect(TEAM_ERSTE_RICHTUNG).toEqual({ name: 'auf', jahrgaenge: 'auf', badges: 'ab', zertifikate: 'ab', seit: 'ab' });
  });
});

describe('sortiereTeam und teamerName', () => {
  const team = [
    { name: 'zoe', display_name: 'Zoe Teamerin', jahrgang_name: '2026', badge_count: 1, cert_count: 3, teamer_since: '2024-09-01' },
    { name: 'adam', jahrgang_name: undefined, badge_count: 4, cert_count: 0, teamer_since: undefined },
    { name: 'bea', display_name: 'Bea', jahrgang_name: '2025', badge_count: 1, cert_count: 3, teamer_since: '2025-09-01' },
  ];
  const anzeige = (l: typeof team) => l.map(teamerName);

  it('der Anzeigename geht vor dem Namen der Abfrage', () => {
    expect(teamerName({ name: 'zoe', display_name: 'Zoe Teamerin' })).toBe('Zoe Teamerin');
    expect(teamerName({ name: 'adam' })).toBe('adam');
  });

  it('ordnet nach Anzeigename und laesst Gleichstand nach Name entscheiden', () => {
    expect(anzeige(sortiereTeam(team, 'name', 'auf'))).toEqual(['adam', 'Bea', 'Zoe Teamerin']);
    expect(anzeige(sortiereTeam(team, 'zertifikate', 'ab'))).toEqual(['Bea', 'Zoe Teamerin', 'adam']);
  });

  it('ohne Jahrgang oder "seit" steht man unten', () => {
    expect(anzeige(sortiereTeam(team, 'jahrgaenge', 'auf'))).toEqual(['Bea', 'Zoe Teamerin', 'adam']);
    expect(anzeige(sortiereTeam(team, 'seit', 'ab'))).toEqual(['Bea', 'Zoe Teamerin', 'adam']);
    expect(anzeige(sortiereTeam(team, 'jahrgaenge', 'ab'))).toEqual(['Zoe Teamerin', 'Bea', 'adam']);
  });
});

describe('sichtbareJahrgaenge', () => {
  const jahrgaenge = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('ERLAUBT: die Gemeindeleitung und Super-Admins sehen alle', () => {
    expect(sichtbareJahrgaenge(jahrgaenge, { role_name: 'org_admin' })).toEqual(jahrgaenge);
    expect(sichtbareJahrgaenge(jahrgaenge, { role_name: 'admin', is_super_admin: true })).toEqual(jahrgaenge);
  });

  it('eine Leitung sieht nur die zugewiesenen mit Sicht', () => {
    const konto = { role_name: 'admin', assigned_jahrgaenge: [{ id: 1, can_view: true }, { id: 3 }, { id: 2, can_view: false }] };
    expect(sichtbareJahrgaenge(jahrgaenge, konto)).toEqual([{ id: 1 }, { id: 3 }]);
  });

  it('VERBOTEN: ohne Zuweisung oder ohne Konto sieht man keinen', () => {
    expect(sichtbareJahrgaenge(jahrgaenge, { role_name: 'admin' })).toEqual([]);
    expect(sichtbareJahrgaenge(jahrgaenge, null)).toEqual([]);
  });
});
