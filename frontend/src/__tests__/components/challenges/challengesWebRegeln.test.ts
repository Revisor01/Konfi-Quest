import { describe, it, expect } from 'vitest';
import {
  FILTER_TEXT,
  KONFI_LISTEN_FILTER,
  LISTEN_FILTER,
  OHNE_AUSWAHL,
  challengeSuchtexte,
  challengesFiltern,
  challengesZaehlen,
  jahrgaengeDerChallenges,
  konfiEintraege,
  kugelAmEintrag,
  laufzeitKachel,
  leitungEintraege,
  passtZumFilter,
  restzeitText,
  tonVonFarbe,
  zeitraumText,
  zielgruppeVon,
  type ListenAuswahl,
} from '../../../utils/challengesWeb';
import { darfChallengesLoeschen, challengeListenPfad } from '../../../utils/challengeRechte';
import type { AdminChallenge, KonfiChallenge } from '../../../types/challenges';

// Die Regeln der Web-Fassung der Challenges (utils/challengesWeb.ts): welche
// Challenge unter welchem Filter steht, was die Suche trifft, wie die rote
// Zahl gerechnet wird. "Jetzt" ist fest: 03.10.2026, 10:30 Uhr (Berlin).

const JETZT = new Date('2026-10-03T08:30:00Z').getTime();
const tage = (n: number) => new Date(JETZT + n * 24 * 3600 * 1000).toISOString();

const challenge = (id: number, extra: Partial<AdminChallenge> = {}): AdminChallenge => ({
  id,
  title: `Challenge ${id}`,
  description: 'Eine Aufgabe',
  challenge_type: 'frei',
  audience: 'konfis_und_team',
  visibility: 'konfi_choice',
  moderated: true,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'flag',
  badge_name: `Stempel ${id}`,
  starts_at: tage(-5),
  ends_at: tage(5),
  is_draft: false,
  jahrgaenge: [],
  ...extra,
});

const LAUFEND = challenge(1, { title: 'Fürbitten zum Erntedank', description: 'Schreibt eine Bitte', badge_name: 'Fürbitter:in', jahrgaenge: [{ id: 1, name: '2026/2027' }] });
const LAUFEND_FOTO = challenge(2, { title: 'Lieblingsplatz', description: 'Ein Foto von der Kirche', badge_name: 'Fotograf:in', audience: 'konfis', jahrgaenge: [{ id: 2, name: '2025/2026' }], author_freetext: 'Pastorin Beispiel' });
const GEPLANT = challenge(3, { title: 'Weihnachtskarten', starts_at: tage(20), ends_at: tage(40), audience: 'nur_team' });
const ENTWURF = challenge(4, { title: 'Bibelvers', is_draft: true, starts_at: tage(30), ends_at: tage(44) });
const BEENDET = challenge(5, { title: 'Sommerrückblick', starts_at: tage(-60), ends_at: tage(-40) });
const ALLE = [BEENDET, GEPLANT, LAUFEND, ENTWURF, LAUFEND_FOTO];

const auswahl = (extra: Partial<ListenAuswahl> = {}): ListenAuswahl => ({ ...OHNE_AUSWAHL, ...extra });
const ids = (eintraege: Array<{ challenge: { id: number } }>) => eintraege.map((e) => e.challenge.id);

describe('Eintraege der Leitungsliste: die Reihenfolge der drei Reiter', () => {
  it('erst was laeuft (juengster Start zuerst), dann Entwuerfe vor Geplantem, zuletzt das Archiv', () => {
    const eintraege = leitungEintraege(ALLE, JETZT);
    // LAUFEND (id 1) und LAUFEND_FOTO (id 2) starten beide vor 5 Tagen: stabile Reihenfolge der Eingabe.
    expect(ids(eintraege).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(eintraege.map((e) => e.status)).toEqual(expect.arrayContaining(['active', 'draft', 'scheduled', 'ended']));
    const status = eintraege.map((e) => e.status);
    // laufend vor geplant/Entwurf vor beendet
    expect(status.indexOf('ended')).toBe(status.length - 1);
    expect(status.lastIndexOf('active')).toBeLessThan(status.indexOf('draft'));
    // Entwuerfe zuerst innerhalb von "geplant"
    expect(status.indexOf('draft')).toBeLessThan(status.indexOf('scheduled'));
  });

  it('traegt die wartenden Freigaben je Challenge ein, ohne Angabe 0', () => {
    const eintraege = leitungEintraege(ALLE, JETZT, { 1: 3, 5: 1 });
    expect(eintraege.find((e) => e.challenge.id === 1)?.wartend).toBe(3);
    expect(eintraege.find((e) => e.challenge.id === 5)?.wartend).toBe(1);
    expect(eintraege.find((e) => e.challenge.id === 2)?.wartend).toBe(0);
  });
});

describe('Eintraege der Konfi-Liste: wie die App', () => {
  it('Laufendes mit der knappsten Frist zuerst, danach das Archiv, zuletzt Beendetes zuerst', () => {
    const k = (id: number, ende: number): KonfiChallenge => ({ ...challenge(id), ends_at: tage(ende) });
    const eintraege = konfiEintraege([k(1, 9), k(2, 2), k(3, 5)], [k(4, -50), k(5, -10)]);
    expect(ids(eintraege)).toEqual([2, 3, 1, 5, 4]);
    expect(eintraege.map((e) => e.status)).toEqual(['active', 'active', 'active', 'ended', 'ended']);
  });
});

describe('Filter nach Zustand', () => {
  const eintraege = leitungEintraege(ALLE, JETZT, { 1: 2, 5: 1 });

  it('laufend, geplant (mit Entwuerfen), beendet, alle', () => {
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'laufend' }))).sort()).toEqual([1, 2]);
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'geplant' }))).sort()).toEqual([3, 4]);
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'beendet' })))).toEqual([5]);
    expect(challengesFiltern(eintraege, auswahl({ filter: 'alle' }))).toHaveLength(5);
  });

  it('"Wartet auf Freigabe" nimmt jede Challenge mit wartenden Beitraegen, in jedem Zustand', () => {
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'wartet' }))).sort()).toEqual([1, 5]);
  });

  it('die Zahl an den Chips: Challenges je Zustand, an "Wartet" die wartenden Beitraege', () => {
    expect(challengesZaehlen(eintraege, auswahl())).toEqual({ laufend: 2, geplant: 2, beendet: 1, alle: 5, wartet: 3 });
  });

  it('passtZumFilter: nur ein Entwurf ist "geplant", nur ein beendeter "beendet"', () => {
    expect(passtZumFilter({ status: 'draft' }, 'geplant')).toBe(true);
    expect(passtZumFilter({ status: 'draft' }, 'laufend')).toBe(false);
    expect(passtZumFilter({ status: 'ended' }, 'beendet')).toBe(true);
    expect(passtZumFilter({ status: 'active', wartend: 0 }, 'wartet')).toBe(false);
  });

  it('die Filterlisten: Team und Leitung haben "wartet", Konfis weder "geplant" noch "wartet"', () => {
    expect(LISTEN_FILTER).toEqual(['laufend', 'geplant', 'beendet', 'alle', 'wartet']);
    expect(KONFI_LISTEN_FILTER).toEqual(['laufend', 'beendet', 'alle']);
    expect(FILTER_TEXT.wartet).toBe('Wartet auf Freigabe');
  });
});

describe('Zielgruppe, Jahrgang und Suche', () => {
  const eintraege = leitungEintraege(ALLE, JETZT);

  it('Zielgruppe: fehlt sie (Altdaten), gilt "Nur Konfis"', () => {
    expect(zielgruppeVon({})).toBe('konfis');
    expect(zielgruppeVon({ audience: 'nur_team' })).toBe('nur_team');
    expect(ids(challengesFiltern(eintraege, auswahl({ zielgruppe: 'nur_team' })))).toEqual([3]);
    expect(ids(challengesFiltern(eintraege, auswahl({ zielgruppe: 'konfis' })))).toEqual([2]);
  });

  it('Jahrgang: nur Challenges, die dem Jahrgang zugeordnet sind', () => {
    expect(ids(challengesFiltern(eintraege, auswahl({ jahrgang: '1' })))).toEqual([1]);
    expect(ids(challengesFiltern(eintraege, auswahl({ jahrgang: '2' })))).toEqual([2]);
  });

  it('die Jahrgaenge der Liste, nach Namen, jeder einmal', () => {
    expect(jahrgaengeDerChallenges([LAUFEND_FOTO, LAUFEND, { ...LAUFEND, id: 9 }])).toEqual([
      { id: 2, name: '2025/2026' },
      { id: 1, name: '2026/2027' },
    ]);
  });

  it('Suche trifft Titel, Aufgabe, Stempel, Urheber:in und Jahrgang', () => {
    const treffer = (suche: string) => ids(challengesFiltern(eintraege, auswahl({ suche })));
    expect(treffer('erntedank')).toEqual([1]);       // Titel
    expect(treffer('ein foto')).toEqual([2]);        // Aufgabe
    expect(treffer('fotograf')).toEqual([2]);        // Stempel
    expect(treffer('pastorin')).toEqual([2]);        // Urheber:in
    expect(treffer('2026/2027')).toEqual([1]);       // Jahrgang
    expect(treffer('xyz')).toEqual([]);
  });

  it('Suche ignoriert Gross- und Kleinschreibung und rechnet Umlaute um (buero findet Büro, fuerbitten findet Fürbitten)', () => {
    expect(ids(challengesFiltern(eintraege, auswahl({ suche: 'FUERBITTEN' })))).toEqual([1]);
    expect(ids(challengesFiltern(eintraege, auswahl({ suche: 'sommerrueckblick' })))).toEqual([5]);
  });

  it('die Suchtexte: ohne Urheber und Jahrgang bleiben nur leere Stuecke, keine Fehler', () => {
    expect(challengeSuchtexte(BEENDET)).toEqual(['Sommerrückblick', 'Eine Aufgabe', 'Stempel 5', '']);
  });

  it('Zaehler an den Chips folgen Zielgruppe und Suche, nicht dem Zustand', () => {
    const z = challengesZaehlen(eintraege, auswahl({ suche: 'fuerbitten' }));
    expect(z).toMatchObject({ laufend: 1, geplant: 0, beendet: 0, alle: 1 });
  });

  it('alles zusammen: laufend UND Zielgruppe UND Suche', () => {
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'laufend', zielgruppe: 'konfis_und_team', suche: 'bitte' })))).toEqual([1]);
    expect(ids(challengesFiltern(eintraege, auswahl({ filter: 'beendet', zielgruppe: 'konfis_und_team', suche: 'bitte' })))).toEqual([]);
  });
});

describe('Die rote Zahl am Eintrag: dieselbe Rechnung wie in der Liste der App', () => {
  it('mit dem Feld des Servers: jeder neue Beitrag seit dem Oeffnen, auch der wartende', () => {
    const k = kugelAmEintrag(7, { neueBeitraege: { 7: 4 }, neueWartend: { 7: 3 }, offeneFreigaben: { 7: 3 }, neuigkeiten: { 7: 9 } });
    expect(k).toEqual({ anzahl: 4, text: 'neue Beiträge, davon warten 3 auf Freigabe', wartend: 3 });
  });

  it('ohne das Feld (aelterer Server): wartende Freigaben plus neue freigegebene', () => {
    const k = kugelAmEintrag(7, { offeneFreigaben: { 7: 2 }, neuigkeiten: { 7: 3 } });
    expect(k.anzahl).toBe(5);
    expect(k.wartend).toBe(2);
    expect(k.text).toBe('offen: 2 Beiträge warten auf Freigabe, 3 neue Beiträge');
  });

  it('ohne irgendetwas: 0', () => {
    expect(kugelAmEintrag(7, {})).toEqual({ anzahl: 0, text: 'neue Beiträge', wartend: 0 });
  });

  it('ein einzelner neuer Beitrag steht in der Einzahl', () => {
    expect(kugelAmEintrag(7, { neueBeitraege: { 7: 1 } }).text).toBe('neuer Beitrag');
  });
});

describe('Zeitraum und Restzeit', () => {
  it('im selben Jahr faellt das Jahr beim Start weg', () => {
    expect(zeitraumText({ starts_at: '2026-10-03T08:30:00Z', ends_at: '2026-10-17T18:00:00Z' }, 'active')).toBe('03.10. – 17.10.2026');
  });

  it('ueber den Jahreswechsel steht das Jahr an beiden', () => {
    expect(zeitraumText({ starts_at: '2026-12-20T08:30:00Z', ends_at: '2027-01-05T18:00:00Z' }, 'scheduled')).toBe('20.12.2026 – 05.01.2027');
  });

  it('ein Entwurf hat noch keinen Zeitraum: das gespeicherte Datum ist nur ein Platzhalter', () => {
    expect(zeitraumText({ starts_at: '2026-10-03T08:30:00Z', ends_at: '2026-10-17T18:00:00Z' }, 'draft')).toBe('Zeitraum noch offen');
  });

  it('Restzeit als Satzteil: "Noch 3 Tage", "Endet gleich"', () => {
    expect(restzeitText('3 Tage')).toBe('Noch 3 Tage');
    expect(restzeitText('1 Stunde')).toBe('Noch 1 Stunde');
    expect(restzeitText('endet gleich')).toBe('Endet gleich');
    expect(restzeitText('')).toBe('');
  });
});

describe('Kachel "Laufzeit" auf der Seite einer Challenge', () => {
  const zeit = { starts_at: '2026-10-03T08:30:00Z', ends_at: '2026-10-17T18:00:00Z' };

  it('laufend: wie lange noch, dazu das Ende', () => {
    expect(laufzeitKachel(zeit, 'active', '9 Tage')).toEqual({ wert: 'Noch 9 Tage', zusatz: ['bis 17.10.2026'] });
    expect(laufzeitKachel(zeit, 'active', 'endet gleich')).toEqual({ wert: 'Endet gleich', zusatz: ['bis 17.10.2026'] });
  });

  it('laufend ohne lesbare Restzeit: "Läuft"', () => {
    expect(laufzeitKachel(zeit, 'active', '')).toEqual({ wert: 'Läuft', zusatz: ['bis 17.10.2026'] });
  });

  it('sonst der Zustand: Entwurf ohne Datum, Geplant mit Beginn, Beendet mit Ende', () => {
    expect(laufzeitKachel(zeit, 'draft', '9 Tage')).toEqual({ wert: 'Entwurf', zusatz: ['Zeitraum noch offen'] });
    expect(laufzeitKachel(zeit, 'scheduled', '9 Tage')).toEqual({ wert: 'Geplant', zusatz: ['Beginnt am 03.10.2026'] });
    expect(laufzeitKachel(zeit, 'ended', 'Zeit abgelaufen')).toEqual({ wert: 'Beendet', zusatz: ['am 17.10.2026'] });
  });
});

describe('Marken aus den Farben der App-Zuordnung', () => {
  it('Wartendes orange, Freigegebenes gruen, Ausgeblendetes rot, "nur Leitung" grau, anonym blau', () => {
    expect(tonVonFarbe('var(--app-color-warning)')).toBe('warnung');
    expect(tonVonFarbe('var(--app-color-success-strong)')).toBe('erfolg');
    expect(tonVonFarbe('var(--app-color-danger)')).toBe('fehler');
    expect(tonVonFarbe('var(--app-color-neutral)')).toBe('neutral');
    expect(tonVonFarbe('var(--app-color-wrapped)')).toBe('info');
    expect(tonVonFarbe('irgendwas')).toBe('neutral');
  });
});

describe('Rechte und Pfade', () => {
  it('loeschen darf nur die Leitung -- Teamer:innen moderieren, loeschen nicht', () => {
    expect(darfChallengesLoeschen({ type: 'admin' })).toBe(true);
    expect(darfChallengesLoeschen({ type: 'teamer' })).toBe(false);
    expect(darfChallengesLoeschen({ type: 'konfi' })).toBe(false);
    expect(darfChallengesLoeschen(null)).toBe(false);
  });

  it('die Liste liegt je Rolle unter ihrem Pfad', () => {
    expect(challengeListenPfad({ type: 'admin' })).toBe('/admin/challenges');
    expect(challengeListenPfad({ type: 'teamer' })).toBe('/teamer/challenges');
    expect(challengeListenPfad({ type: 'konfi' })).toBe('/konfi/challenges');
  });
});
