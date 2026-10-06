// Die reinen Regeln der Web-Fassung von Mitmachen (utils/termineWeb.ts,
// 03.10.2026): Ton der Marken, Kartenlink, Zeitangaben, Filter und Suche,
// Reihenfolge der Listen, Abmeldefrist, Kennzahlen und Zahlen auf den Karten.
// Status und Angaben je Rolle vergleichen die Tests webStatusWieApp,
// webKonfiDetailWieApp und webLeitungDetailWieApp mit den Ansichten der App;
// hier stehen die Teile, die dort nicht an einer Ansicht hängen.
import { describe, it, expect } from 'vitest';
import {
  STATUS_FARBE,
  abgesagteTermine,
  kannAbmelden,
  kategorienNamen,
  kennzahlAnzeige,
  kommendeZuerst,
  konfiFakten,
  konfiKennzahlen,
  leitungFakten,
  ortKartenLink,
  statusTon,
  teamFakten,
  teamKannSichAnmelden,
  teamKennzahlen,
  terminAngaben,
  terminDatumUhrzeit,
  terminHatArt,
  terminImJahrgang,
  terminSuchtTreffer,
  zeitspanneKurz,
} from '../../utils/termineWeb';
import type { Event } from '../../types/event';

const ev = (zusatz: Record<string, unknown>): Event => ({
  id: 1, name: 'Konfi-Tag', event_date: '2026-11-14T09:00:00Z', points: 0, max_participants: 20, registered_count: 3,
  registration_status: 'open', type: 'event', ...zusatz,
} as unknown as Event);

describe('statusTon', () => {
  it.each([
    [STATUS_FARBE.danger, 'fehler'],
    [STATUS_FARBE.events, 'fehler'],
    [STATUS_FARBE.success, 'erfolg'],
    [STATUS_FARBE.teamer, 'erfolg'],
    [STATUS_FARBE.bonus, 'warnung'],
    [STATUS_FARBE.info, 'info'],
    [STATUS_FARBE.konfis, 'info'],
    [STATUS_FARBE.vorbei, 'neutral'],
    [STATUS_FARBE.neutral, 'neutral'],
  ] as const)('%s ist ein Ton "%s"', (farbe, ton) => {
    expect(statusTon(farbe)).toBe(ton);
  });
});

describe('ortKartenLink', () => {
  it('nimmt die eingetragene Adresse, wenn sie mit http(s) beginnt', () => {
    expect(ortKartenLink({ location: 'Gemeindehaus', location_maps_url: 'https://example.org/karte?x=1' })).toBe('https://example.org/karte?x=1');
  });
  it('sucht sonst den Ort in Apple Karten, richtig kodiert', () => {
    expect(ortKartenLink({ location: 'Küstenkapelle Büsum' })).toBe('https://maps.apple.com/?q=K%C3%BCstenkapelle%20B%C3%BCsum');
  });
  it('lässt fremde Schemata nicht durch (javascript:, data:)', () => {
    expect(ortKartenLink({ location: 'Kirche', location_maps_url: 'javascript:alert(1)' })).toBe('https://maps.apple.com/?q=Kirche');
    expect(ortKartenLink({ location: '', location_maps_url: 'data:text/html,x' })).toBe(null);
  });
  it('ohne Ort kein Link', () => {
    expect(ortKartenLink({ location: '', location_maps_url: '' })).toBe(null);
    expect(ortKartenLink({})).toBe(null);
  });
});

describe('kennzahlAnzeige', () => {
  it('"von 40 TN" wird zu "Teilnehmer:innen" und "6 / 40"', () => {
    expect(kennzahlAnzeige({ wert: '6', label: 'von 40 TN' })).toEqual({ label: 'Teilnehmer:innen', wert: '6 / 40' });
  });
  it('"von ∞ Team" wird zu "Team" und "2 / ∞"', () => {
    expect(kennzahlAnzeige({ wert: '2', label: 'von ∞ Team' })).toEqual({ label: 'Team', wert: '2 / ∞' });
  });
  it('alles andere bleibt, wie es ist', () => {
    expect(kennzahlAnzeige({ wert: '3', label: 'Anwesend' })).toEqual({ wert: '3', label: 'Anwesend' });
    expect(kennzahlAnzeige({ wert: '3', label: 'von 40 Personen' })).toEqual({ wert: '3', label: 'von 40 Personen' });
  });
});

describe('Zeitangaben', () => {
  it('ein Termin am selben Tag: Datum mit Wochentag, Beginn und Ende', () => {
    expect(zeitspanneKurz({ event_date: '2026-11-14T09:00:00Z', event_end_time: '2026-11-14T11:00:00Z' })).toEqual({ datum: 'Sa., 14.11.2026', zeit: '10:00 – 12:00' });
  });
  it('ohne Ende nur der Beginn', () => {
    expect(zeitspanneKurz({ event_date: '2026-11-14T09:00:00Z' })).toEqual({ datum: 'Sa., 14.11.2026', zeit: '10:00' });
  });
  it('über mehrere Tage nennt das Ende mit Datum', () => {
    expect(zeitspanneKurz({ event_date: '2026-11-20T15:30:00Z', event_end_time: '2026-11-22T11:30:00Z' })).toEqual({ datum: 'Fr., 20.11.2026', zeit: '16:30 – So., 22.11.2026, 12:30' });
  });
  it('Karte: Datum und Uhrzeit getrennt', () => {
    expect(terminDatumUhrzeit({ event_date: '2026-11-14T09:00:00Z' })).toEqual({ datum: '14.11.2026', uhrzeit: '10:00' });
  });
});

describe('Filter und Suche', () => {
  it('Kategorien: aus der Liste, sonst aus der Kommaliste, ohne Leerstellen und Leeres', () => {
    expect(kategorienNamen({ categories: [{ id: 1, name: 'Gottesdienst' }, { id: 2, name: 'Fest' }], category_names: 'x' })).toEqual(['Gottesdienst', 'Fest']);
    expect(kategorienNamen({ categories: [], category_names: 'Fest, Freizeit ,' })).toEqual(['Fest', 'Freizeit']);
    expect(kategorienNamen({})).toEqual([]);
  });

  it('Jahrgang: die Kommaliste der Ids, nur ganze Treffer', () => {
    expect(terminImJahrgang({ jahrgang_ids: '1, 12,3' }, 12)).toBe(true);
    expect(terminImJahrgang({ jahrgang_ids: '1, 12,3' }, 2)).toBe(false);
    expect(terminImJahrgang({ jahrgang_ids: '' }, 1)).toBe(false);
    expect(terminImJahrgang({}, 1)).toBe(false);
  });

  it('Art: Pflicht, Konfirmation, nur Team; "alle" lässt alles durch', () => {
    const e = ev({ mandatory: true, is_konfirmation: false, teamer_only: false });
    expect(terminHatArt(e, 'pflicht')).toBe(true);
    expect(terminHatArt(e, 'konfirmation')).toBe(false);
    expect(terminHatArt(e, 'team')).toBe(false);
    expect(terminHatArt(e, 'alle')).toBe(true);
    expect(terminHatArt(ev({ teamer_only: true }), 'team')).toBe(true);
  });

  it('Suche: Name und Ort, Groß- und Kleinschreibung egal, Umlaute austauschbar', () => {
    const e = ev({ name: 'Gemeindefest', title: 'Sommerfest', location: 'Küstenkapelle Büsum', description: 'Grillen am Strand' });
    expect(terminSuchtTreffer(e, 'GEMEINDE')).toBe(true);
    expect(terminSuchtTreffer(e, 'sommer')).toBe(true);
    expect(terminSuchtTreffer(e, 'buesum')).toBe(true);
    expect(terminSuchtTreffer(e, 'kuestenkapelle')).toBe(true);
    expect(terminSuchtTreffer(e, 'zelt')).toBe(false);
  });

  it('Suche: die Beschreibung zählt nur, wenn sie verlangt wird (Konfis)', () => {
    const e = ev({ name: 'Gemeindefest', location: '', description: 'Grillen am Strand' });
    expect(terminSuchtTreffer(e, 'strand')).toBe(false);
    expect(terminSuchtTreffer(e, 'strand', true)).toBe(true);
  });

  it('leere Suche trifft alles', () => {
    expect(terminSuchtTreffer(ev({}), '')).toBe(true);
    expect(terminSuchtTreffer(ev({}), '   ')).toBe(true);
  });
});

describe('Reihenfolge der Listen', () => {
  const jetzt = new Date('2026-10-03T08:30:00Z');

  it('abgesagte Termine aus beiden Quellen, einmal je Termin: Kommende nach Datum aufsteigend, dann Vergangene, die jüngsten voran', () => {
    const kommend2 = ev({ id: 2, event_date: '2026-10-20T09:00:00Z', registration_status: 'cancelled' });
    const kommend1 = ev({ id: 1, event_date: '2026-10-10T09:00:00Z', registration_status: 'cancelled' });
    const vorbeiAlt = ev({ id: 3, event_date: '2026-08-01T09:00:00Z', cancelled: true });
    const vorbeiNeu = ev({ id: 4, event_date: '2026-09-20T09:00:00Z', cancelled: true });
    const nichtAbgesagt = ev({ id: 5, event_date: '2026-10-05T09:00:00Z' });
    // Termin 1 steht in beiden Quellen.
    const aus = abgesagteTermine([kommend2, nichtAbgesagt, kommend1], [vorbeiAlt, kommend1, vorbeiNeu], jetzt);
    expect(aus.map((e) => e.id)).toEqual([1, 2, 4, 3]);
  });

  it('Konfis und Team: Nächstes zuerst, Vergangenes danach', () => {
    const a = ev({ id: 1, event_date: '2026-10-20T09:00:00Z' });
    const b = ev({ id: 2, event_date: '2026-10-05T09:00:00Z' });
    const c = ev({ id: 3, event_date: '2026-09-01T09:00:00Z' });
    const d = ev({ id: 4, event_date: '2026-09-25T09:00:00Z' });
    expect(kommendeZuerst([c, a, d, b], jetzt).map((e) => e.id)).toEqual([2, 1, 3, 4]);
  });

  it('verändert die übergebene Liste nicht', () => {
    const liste = [ev({ id: 1, event_date: '2026-10-20T09:00:00Z' }), ev({ id: 2, event_date: '2026-10-05T09:00:00Z' })];
    kommendeZuerst(liste, jetzt);
    expect(liste.map((e) => e.id)).toEqual([1, 2]);
  });
});

describe('Abmeldefrist und Team', () => {
  const beginn = '2026-10-10T09:00:00Z';
  const e = ev({ event_date: beginn, is_registered: true });

  it('abmelden geht bis genau 2 Tage vor Beginn -- nicht eine Sekunde länger', () => {
    expect(kannAbmelden(e, new Date('2026-10-08T08:59:59Z'))).toBe(true);
    expect(kannAbmelden(e, new Date('2026-10-08T09:00:00Z'))).toBe(false);
    expect(kannAbmelden(e, new Date('2026-10-09T09:00:00Z'))).toBe(false);
  });

  it('wer nicht angemeldet ist, kann sich nicht abmelden', () => {
    expect(kannAbmelden(ev({ event_date: beginn, is_registered: false }), new Date('2026-10-01T09:00:00Z'))).toBe(false);
  });

  it('das Team meldet sich nur zu "Team gesucht" und "Nur Team" an', () => {
    expect(teamKannSichAnmelden({ teamer_needed: true, teamer_only: false })).toBe(true);
    expect(teamKannSichAnmelden({ teamer_needed: false, teamer_only: true })).toBe(true);
    expect(teamKannSichAnmelden({ teamer_needed: false, teamer_only: false })).toBe(false);
  });
});

describe('Kennzahlen', () => {
  it('Konfis: Frei, Punkte, Dabei', () => {
    expect(konfiKennzahlen(ev({ max_participants: 10, registered_count: 4, points: 2 }))).toEqual([
      { wert: '6', label: 'Frei' }, { wert: '2', label: 'Punkte' }, { wert: '4', label: 'Dabei' },
    ]);
  });
  it('Konfis: unbegrenzt heißt ∞ frei; überbucht nie unter 0', () => {
    expect(konfiKennzahlen(ev({ max_participants: 0, registered_count: 4 }))[0]).toEqual({ wert: '∞', label: 'Frei' });
    expect(konfiKennzahlen(ev({ max_participants: 4, registered_count: 6 }))[0]).toEqual({ wert: '0', label: 'Frei' });
  });
  it('Konfis: Pflicht und Konfirmation geben keine Punkte, abgesagt zählt Abgemeldete statt freier Plätze', () => {
    expect(konfiKennzahlen(ev({ points: 2, mandatory: true })).map((k) => k.label)).toEqual(['Frei', 'Dabei']);
    expect(konfiKennzahlen(ev({ points: 2, is_konfirmation: true })).map((k) => k.label)).toEqual(['Frei', 'Dabei']);
    expect(konfiKennzahlen(ev({ cancelled: true, abgemeldet_count: 5 }))[0]).toEqual({ wert: '5', label: 'Abgemeldet' });
  });
  it('Team: Konfis, Team, Punkte -- bei "Nur Team" Team und Warteliste', () => {
    expect(teamKennzahlen(ev({ registered_count: 12, teamer_count: 3, points: 1 }))).toEqual([
      { wert: '12', label: 'Konfis' }, { wert: '3', label: 'Team' }, { wert: '1', label: 'Punkte' },
    ]);
    expect(teamKennzahlen(ev({ teamer_only: true, teamer_count: 4, teamer_waitlist_count: 2 }))).toEqual([
      { wert: '4', label: 'Team' }, { wert: '2', label: 'Warteliste' },
    ]);
  });
});

describe('Zahlen auf Karten und in Zeilen', () => {
  it('Leitung: Plätze, Team, Warteliste, Punkte und Art; bei Pflicht "n Konfis", "Nur Team" ohne Konfi-Zahlen und ohne Punkte', () => {
    const offen = ev({ registered_count: 3, max_participants: 0, teamer_needed: true, teamer_count: 2, teamer_max_participants: 6, waitlist_enabled: true, waitlist_count: 1, points: 2, point_type: 'gottesdienst' });
    expect(leitungFakten(offen).map((f) => f.text)).toEqual(['3/∞', '2/6 Team', '1/10', '2P', 'Gottesdienst']);
    expect(leitungFakten(ev({ mandatory: true, registered_count: 12 })).map((f) => f.text)).toEqual(['12 Konfis']);
    expect(leitungFakten(ev({ teamer_only: true, teamer_count: 4, teamer_max_participants: 0, points: 2 })).map((f) => f.text)).toEqual(['4/∞ Team']);
  });
  it('Konfis: Pflicht-Events zählen keine Plätze', () => {
    expect(konfiFakten(ev({ mandatory: true, registered_count: 12 }))).toEqual([]);
    expect(konfiFakten(ev({ registered_count: 12, max_participants: 30, points: 1, point_type: 'gemeinde' })).map((f) => f.text)).toEqual(['12/30', '1P', 'Gemeinde']);
  });
  it('Team: Konfis und Team; die Warteliste des Teams nennt, ob sie begrenzt ist', () => {
    expect(teamFakten(ev({ registered_count: 12, max_participants: 30, teamer_count: 3, teamer_waitlist_count: 2, teamer_max_waitlist_size: 5 })).map((f) => f.text)).toEqual(['12/30', '3 Team', '2/5 wartet']);
    expect(teamFakten(ev({ teamer_only: true, teamer_count: 4, teamer_max_participants: 6, teamer_waitlist_count: 1, teamer_max_waitlist_size: 0 })).map((f) => f.text)).toEqual(['4/6 Team', '1']);
  });
});

describe('Angaben: Ort, Anmeldung und Material', () => {
  it('der Ort trägt seinen Kartenlink', () => {
    const angabe = terminAngaben(ev({ location: 'Gemeindehaus' }), { rolle: 'konfi' }).find((a) => a.label === 'Ort')!;
    expect(angabe.zeilen).toEqual(['Gemeindehaus']);
    expect(angabe.ortLink).toBe('https://maps.apple.com/?q=Gemeindehaus');
  });

  it('Anmeldung: ohne Beginn "Sofort möglich", sonst von und bis; die Leitung sieht zusätzlich die Abmeldefrist', () => {
    const sofort = terminAngaben(ev({}), { rolle: 'konfi' }).find((a) => a.label === 'Anmeldung')!;
    expect(sofort.zeilen).toEqual(['Sofort möglich']);
    const mitFrist = terminAngaben(ev({ registration_opens_at: '2026-09-01T08:00:00Z', registration_closes_at: '2026-10-09T08:00:00Z' }), { rolle: 'leitung' }).find((a) => a.label === 'Anmeldung')!;
    expect(mitFrist.zeilen).toEqual(['von 01.09.2026 – 10:00', 'bis 09.10.2026 – 10:00', 'Konfis können sich bis 2 Tage vorher selbst abmelden']);
  });

  it('Pflicht-Events haben keine Anmeldung, dafür den Satz "Teilnahme erforderlich"', () => {
    const angaben = terminAngaben(ev({ mandatory: true }), { rolle: 'konfi' });
    expect(angaben.find((a) => a.label === 'Anmeldung')).toBeUndefined();
    expect(angaben.find((a) => a.label === 'Pflicht-Event')!.zeilen).toEqual(['Teilnahme erforderlich']);
  });

  it('Material: ein Titel oder die Zahl; nur für Leitung und Team, Konfis sehen es nicht', () => {
    const eins = [{ id: 1, title: 'Packliste' }];
    const zwei = [{ id: 1, title: 'Packliste' }, { id: 2, title: 'Programm' }];
    expect(terminAngaben(ev({}), { rolle: 'team', materialien: eins as never }).find((a) => a.label === 'Material')).toMatchObject({ zeilen: ['Packliste'], materialSprung: true });
    expect(terminAngaben(ev({}), { rolle: 'leitung', materialien: zwei as never }).find((a) => a.label === 'Material')!.zeilen).toEqual(['2 Materialien']);
    expect(terminAngaben(ev({}), { rolle: 'konfi', materialien: zwei as never }).find((a) => a.label === 'Material')).toBeUndefined();
  });

  it('Punkte und Art nur, wenn es für Konfis welche gibt', () => {
    const mit = terminAngaben(ev({ points: 2, point_type: 'gottesdienst' }), { rolle: 'konfi' });
    expect(mit.find((a) => a.label === 'Punkte')!.zeilen).toEqual(['2']);
    expect(mit.find((a) => a.label === 'Typ')!.zeilen).toEqual(['Gottesdienst']);
    for (const zusatz of [{ points: 0 }, { points: 2, mandatory: true }, { points: 2, is_konfirmation: true }]) {
      expect(terminAngaben(ev(zusatz), { rolle: 'konfi' }).find((a) => a.label === 'Punkte')).toBeUndefined();
    }
    expect(terminAngaben(ev({ points: 2, teamer_only: true }), { rolle: 'team' }).find((a) => a.label === 'Punkte')).toBeUndefined();
  });
});
