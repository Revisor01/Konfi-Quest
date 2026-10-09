// Simons Fall (12.09.2026): Eine Mutter meldet ihre Tochter telefonisch ab,
// wegen Krankheit — nicht in der App. In der Anwesenheitsliste gab es nur
// "anwesend" (falsch) und "abwesend" (richtig, sieht aber aus wie
// unentschuldigtes Fehlen). Der Grund ging verloren, und die Kolleginnen sahen
// nicht, dass abgemeldet wurde.
//
// Zweiter Fall: Eine Konfirmandin bittet, schon um 14 Uhr zu gehen. Sie war
// da, bekommt ihre Punkte, ist ANWESEND — die Notiz soll trotzdem stehen.
//
// Zwei getrennte Felder (Entscheidung Simon): Ein gemeinsames haette je nach
// Status eine andere Bedeutung, und beide koennen nebeneinander stehen.
//
// "Vermerk" heisst seit dem 13.09.2026 ueberall NOTIZ (Simon: "nennen wir es
// lieber insgesamt Notiz."). Die Spalte attendance_note bleibt, wie sie
// heisst.
//
// Seit dem 09.10.2026 gerendert statt am Quelltext geprueft (Audit Tests
// 26.09.2026, BF-02). Hier: die echte Termin-Detailansicht der Leitung
// (Geruest leitungTerminDetail) samt Zeitfenster-Liste -- Zeilen, Farben,
// Aktionsmenue und was beim Speichern an den Server geht. Die beiden Modale
// (Abmeldung, Notiz) und die Anwesenheitsmatrix rendert
// abmeldungUndNotizModale.test.tsx. Die Typ-Zusicherungen (excuse_reason,
// attendance_note, Urheber- und Check-in-Felder in types/event.ts) sind
// entfallen: Die Ansichten lesen die Felder, `tsc` faellt, wenn sie fehlen.
//
// Was hier noch Quelltext liest, sind Waechter: Stylesheet-Regeln (die
// Klassen, die jsdom nicht auswertet), die Gefahren-Knoepfe der Profile
// (Stil-Waechter: kein abgeschriebenes Aussehen neben der globalen Klasse)
// und der Inhalt des Handbuch-Kapitels.
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { render, within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, zeileVon, api, letztesMenue, knopfIn,
  modale, zuletztGeoeffnet, presentAlert,
} from './gerueste/leitungTerminDetail';
import { TimeslotsSection } from '../../components/admin/views/EventDetailSections';
import type { Participant } from '../../components/admin/views/EventDetailSections';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const css = lies('src/theme/variables.css');
const handbuch = lies('../docs/handbuch/70-termine.md');

const PUT_PFAD = '/events/7/participants/1/attendance';
const AM = '2026-09-13T10:00:00Z';

beforeEach(zuruecksetzen);

/** Die Detailansicht mit genau einer Person. */
const mitPerson = async (zusatz: Record<string, unknown>, terminZusatz: Record<string, unknown> = {}) => {
  zustand.detail = termin({ participants: [teilnahme(1, 'Kim Konfi', zusatz)], ...terminZusatz });
  await oeffne();
  return zeileVon('Kim Konfi');
};

/** Zeile antippen, das Menue kommt zurueck. */
const menueVon = async (zusatz: Record<string, unknown>) => {
  const zeile = await mitPerson(zusatz);
  await act(async () => { fireEvent.click(zeile); });
  return letztesMenue();
};

/** Text, Farbklassen und Zusatzzeilen einer Teilnehmerzeile. */
const darstellung = (zeile: HTMLElement) => {
  const item = zeile.querySelector('.app-list-item') as HTMLElement;
  const kreis = zeile.querySelector('.app-icon-circle') as HTMLElement;
  const badge = within(zeile).getByRole('img');
  const inhalt = zeile.querySelector('.app-list-item__content') as HTMLElement;
  return {
    rand: [...item.classList].find((k) => k.startsWith('app-list-item--') && k !== 'app-list-item--badge-space-lg'),
    kreis: [...kreis.classList].find((k) => k.startsWith('app-icon-circle--')),
    badge: badge.getAttribute('aria-label'),
    badgeKlasse: [...badge.classList].find((k) => k.startsWith('app-corner-badge--')),
    // Die Zeilen unter Titel und Untertitel, in Reihenfolge.
    zusatz: [...inhalt.children].slice(2).map((el) => el.textContent),
  };
};

/** Die Zeitfenster-Liste mit genau einer Person in Slot 1. */
const zeitfensterMit = (zusatz: Record<string, unknown>) => {
  const person = { ...teilnahme(1, 'Kim Konfi', { timeslot_id: 1, ...zusatz }) } as unknown as Participant;
  render(
    <TimeslotsSection
      timeslots={[{ id: 1, start_time: '2026-10-10T08:00:00Z', end_time: '2026-10-10T10:00:00Z', max_participants: 10, registered_count: 1 }]}
      participants={[person]}
      formatTime={() => '10:00'}
      showAttendanceActionSheet={() => undefined}
      handleDemoteParticipant={() => undefined}
      handleRemoveParticipant={() => undefined}
    />
  );
  return zeileVon('Kim Konfi');
};

const kacheln = () => Object.fromEntries(
  [...document.querySelectorAll('.app-stats-row__item')].map((k) => [
    k.querySelector('.app-stats-row__label')?.textContent,
    Number(k.querySelector('.app-stats-row__value')?.textContent),
  ]),
);

const NACHGETRAGEN = { status: 'excused', attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen' };

describe('Abmeldung nachtragen (excused)', () => {
  it('das Auswahlmenue bietet "Abgemeldet" an -- und "Abmeldung bearbeiten", wenn schon eingetragen', async () => {
    const menue = await menueVon({});
    expect(menue.buttons.map((b) => b.text)).toEqual(['Anwesend', 'Abwesend', 'Abgemeldet', 'Abbrechen']);
    document.body.innerHTML = '';
    const bearbeiten = await menueVon(NACHGETRAGEN);
    expect(knopfIn(bearbeiten, 'Abmeldung bearbeiten')).toBeDefined();
    expect(knopfIn(bearbeiten, 'Abgemeldet')).toBeUndefined();
  });

  it('der Grund wird als eigenes Feld erfragt und geschickt -- der dritte Status geht an den Server', async () => {
    const menue = await menueVon({});
    await act(async () => { knopfIn(menue, 'Abgemeldet')!.handler!(); });
    const modal = zuletztGeoeffnet('AbmeldungNachtragenModal')!;
    expect(modal.props.teilnehmerName).toBe('Kim Konfi');
    await act(async () => { await (modal.props.onSave as (g: string, n: string) => Promise<void>)('krank', 'Attest liegt vor'); });
    expect(api.put).toHaveBeenCalledWith(PUT_PFAD, {
      attendance_status: 'excused', excuse_reason: 'krank', attendance_note: 'Attest liegt vor',
    });
    expect(darstellung(zeileVon('Kim Konfi')).zusatz).toContain('Abgemeldet: krank');
  });

  it('der Grund wird nur bei excused gesetzt -- wer danach anwesend ist, verliert ihn', async () => {
    // Sonst bliebe "krank" an einer Buchung stehen, die inzwischen auf
    // anwesend steht.
    const menue = await menueVon(NACHGETRAGEN);
    await act(async () => { await knopfIn(menue, 'Anwesend')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith(PUT_PFAD, { attendance_status: 'present' });
    const d = darstellung(zeileVon('Kim Konfi'));
    expect(d.badge).toBe('Anwesend');
    expect(d.zusatz.some((z) => z?.startsWith('Abgemeldet'))).toBe(false);
  });

  it('die Zeile wird grau, nicht rot', async () => {
    // Rot hiesse "hat gefehlt" — die Abmeldung war gemeldet.
    const d = darstellung(await mitPerson(NACHGETRAGEN));
    expect(d).toMatchObject({
      rand: 'app-list-item--neutral', kreis: 'app-icon-circle--neutral',
      badge: 'Abgemeldet (nachgetragen)', badgeKlasse: 'app-corner-badge--neutral',
    });
  });

  it('die grauen Klassen sind im CSS definiert (Stil-Waechter)', () => {
    expect(css).toContain('.app-list-item--neutral, ion-item.app-list-item--neutral { border-left-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-corner-badge--neutral { background-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-icon-circle--neutral { background-color: var(--app-color-neutral); }');
  });

  it('die Selbstabmeldung bleibt rot — sie wird nicht mit umgefaerbt', async () => {
    const d = darstellung(await mitPerson({ status: 'opted_out', opt_out_reason: 'Fussballturnier' }));
    expect(d).toMatchObject({ rand: 'app-list-item--danger', kreis: 'app-icon-circle--danger', badge: 'Abgemeldet' });
  });

  it('der Grund steht in der Teilnehmerliste, nicht nur im Menue', async () => {
    // "Damit das auch die Kolleginnen sehen."
    expect(darstellung(await mitPerson(NACHGETRAGEN)).zusatz).toEqual(['Abgemeldet: krank, Mutter hat angerufen']);
  });

  it('die Zeitfenster-Liste zeigt den Grund ebenso -- und auch den einer SELBSTabmeldung', () => {
    expect(darstellung(zeitfensterMit(NACHGETRAGEN)).zusatz).toEqual(['Abgemeldet: krank, Mutter hat angerufen']);
    document.body.innerHTML = '';
    expect(darstellung(zeitfensterMit({ status: 'opted_out', opt_out_reason: 'Fussballturnier' })).zusatz)
      .toEqual(['Fussballturnier']);
  });

  it('der Zeitfenster-Abschnitt faerbt ebenfalls grau -- aus derselben Quelle wie die Liste', () => {
    expect(darstellung(zeitfensterMit(NACHGETRAGEN))).toMatchObject({
      rand: 'app-list-item--neutral', kreis: 'app-icon-circle--neutral', badge: 'Abgemeldet (nachgetragen)',
    });
  });
});

describe('Notiz (unabhaengig vom Status)', () => {
  it.each([
    ['anwesend', { attendance_status: 'present' }, 'Notiz hinzufügen'],
    ['abwesend', { attendance_status: 'absent' }, 'Notiz hinzufügen'],
    ['nachgetragen abgemeldet', NACHGETRAGEN, 'Notiz hinzufügen'],
    ['anwesend mit Notiz', { attendance_status: 'present', attendance_note: 'ging um 14 Uhr' }, 'Notiz bearbeiten'],
  ])('wird bei JEDEM gesetzten Status angeboten (%s)', async (_name, zusatz, text) => {
    const menue = await menueVon(zusatz);
    expect(knopfIn(menue, text)).toBeDefined();
  });

  it('ohne gesetzten Status gibt es keine Notiz -- erst die Anwesenheit', async () => {
    const menue = await menueVon({});
    expect(menue.buttons.some((b) => b.text.startsWith('Notiz'))).toBe(false);
  });

  it('behaelt den Grund, wenn nur die Notiz geaendert wird', async () => {
    // Die Route setzt excuse_reason bei jedem 'excused'-Schreiben neu —
    // ohne Mitschicken waere er nach dem Speichern der Notiz weg.
    const menue = await menueVon(NACHGETRAGEN);
    await act(async () => { knopfIn(menue, 'Notiz hinzufügen')!.handler!(); });
    const modal = zuletztGeoeffnet('AnwesenheitNotizModal')!;
    await act(async () => { await (modal.props.onSave as (n: string) => Promise<void>)('Attest folgt'); });
    expect(api.put).toHaveBeenCalledWith(PUT_PFAD, {
      attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen', attendance_note: 'Attest folgt',
    });
    expect(darstellung(zeileVon('Kim Konfi')).zusatz).toContain('Abgemeldet: krank, Mutter hat angerufen');
  });

  it('steht in der Teilnehmerliste bei jedem Status -- auch bei Anwesenheit', async () => {
    // Nicht an isExcused gebunden: "ging um 14 Uhr" gilt bei Anwesenheit.
    expect(darstellung(await mitPerson({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' })).zusatz)
      .toEqual(['Notiz: ging um 14 Uhr']);
    document.body.innerHTML = '';
    expect(darstellung(zeitfensterMit({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' })).zusatz)
      .toEqual(['Notiz: ging um 14 Uhr']);
  });

  it('heisst in der Oberflaeche ueberall "Notiz", nicht mehr "Vermerk"', async () => {
    const zeile = await mitPerson({ ...NACHGETRAGEN, attendance_note: 'Attest' });
    await act(async () => { fireEvent.click(zeile); });
    expect(letztesMenue().buttons.map((b) => b.text)).toContain('Notiz bearbeiten');
    expect(document.body.textContent).toContain('Notiz: Attest');
    expect(document.body.textContent).not.toMatch(/Vermerk/);
    expect(letztesMenue().buttons.some((b) => /Vermerk/.test(b.text))).toBe(false);
  });
});

describe('Abmeldung und Notiz laufen ueber Modale, nicht ueber Rueckfragen', () => {
  it('die Ansicht meldet beide Modale an', async () => {
    await mitPerson({});
    expect([...modale.angemeldet]).toEqual(expect.arrayContaining(['AbmeldungNachtragenModal', 'AnwesenheitNotizModal']));
  });

  it('"Abgemeldet" oeffnet das Abmelde-Modal mit Grund und Notiz -- kein Alert', async () => {
    const menue = await menueVon({ ...NACHGETRAGEN, attendance_note: 'Attest' });
    await act(async () => { knopfIn(menue, 'Abmeldung bearbeiten')!.handler!(); });
    const modal = zuletztGeoeffnet('AbmeldungNachtragenModal')!;
    expect(modal.props.grund).toBe('krank, Mutter hat angerufen');
    expect(modal.props.notiz).toBe('Attest');
    expect(presentAlert).not.toHaveBeenCalled();
  });

  it('"Notiz hinzufügen" oeffnet das Notiz-Modal -- kein Alert', async () => {
    const menue = await menueVon({ attendance_status: 'present' });
    await act(async () => { knopfIn(menue, 'Notiz hinzufügen')!.handler!(); });
    expect(zuletztGeoeffnet('AnwesenheitNotizModal')!.props.teilnehmerName).toBe('Kim Konfi');
    expect(presentAlert).not.toHaveBeenCalled();
  });
});

describe('Eine Notiz laesst sich loeschen', () => {
  it('die Ansicht schickt den leeren Wert weiter, statt ihn wegzufiltern -- und die Zeile verliert die Notiz', async () => {
    // Die Unterscheidung "Feld fehlt" gegen "Feld ist leer" traegt das
    // Loeschen. Ein `|| undefined` haette sie eingeebnet.
    const menue = await menueVon({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });
    await act(async () => { knopfIn(menue, 'Notiz bearbeiten')!.handler!(); });
    const modal = zuletztGeoeffnet('AnwesenheitNotizModal')!;
    await act(async () => { await (modal.props.onSave as (n: string) => Promise<void>)(''); });
    expect(api.put).toHaveBeenCalledWith(PUT_PFAD, { attendance_status: 'present', attendance_note: '' });
    expect(darstellung(zeileVon('Kim Konfi')).zusatz).toEqual([]);
  });

  it('ohne Notiz-Aenderung bleibt die Notiz: das Feld fehlt im Aufruf', async () => {
    const menue = await menueVon({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });
    await act(async () => { await knopfIn(menue, 'Abwesend')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith(PUT_PFAD, { attendance_status: 'absent' });
    expect(darstellung(zeileVon('Kim Konfi')).zusatz).toEqual(['Notiz: ging um 14 Uhr']);
  });
});

// Simon in TestFlight (13.09.2026): "wenn die sich selbst abgemeldet haben
// kann ich deren Status nicht ändern. Kein Action Sheet." Auf Rueckfrage:
// "Ich als Admin will eine Selbstabmeldung bearbeiten können. Doch anwesend.
// Vermerk etc."
describe('Selbstabmeldung bearbeiten', () => {
  it.each(['opted_out', 'excused'])('der Tipp oeffnet auch bei %s das Anwesenheits-Menue', async (status) => {
    const menue = await menueVon({ status });
    expect(menue.subHeader).toBe('Anwesenheit verwalten');
  });

  it('es ist DASSELBE Menue wie bei einer Buchung, kein eigenes mit weniger Auswahl', async () => {
    const gebucht = (await menueVon({})).buttons.map((b) => b.text);
    document.body.innerHTML = '';
    const abgemeldet = (await menueVon({ status: 'opted_out' })).buttons.map((b) => b.text);
    expect(abgemeldet).toEqual(gebucht);
  });

  it('die Warteliste behaelt ihr eigenes Menue', async () => {
    const menue = await menueVon({ status: 'waitlist' });
    expect(menue.subHeader).toBe('Warteliste verwalten');
    expect(menue.buttons.map((b) => b.text)).toEqual(['Bestätigen', 'Entfernen', 'Abbrechen']);
  });

  it.each(['opted_out', 'excused'])(
    'verbucht die Leitung eine Abmeldung (%s), faerbt die Zeile nach dem Anwesenheits-Status',
    async (status) => {
      const d = darstellung(await mitPerson({ status, attendance_status: 'present' }));
      expect(d).toMatchObject({ rand: 'app-list-item--success', badge: 'Anwesend' });
    },
  );

  it('der Absagegrund bleibt als Vorgeschichte stehen', async () => {
    const d = darstellung(await mitPerson({ status: 'opted_out', attendance_status: 'present', opt_out_reason: 'Turnier' }));
    expect(d.zusatz).toEqual(['Hatte sich abgemeldet: Turnier']);
  });

  it('die Kachel zaehlt eine verbuchte Selbstabmeldung nicht mehr als abgemeldet', async () => {
    // Sonst stuende dieselbe Person zugleich unter "Anwesend" und unter
    // "Abgemeldet".
    zustand.detail = termin({
      mandatory: true, registration_status: 'mandatory', points: 0,
      participants: [
        teilnahme(1, 'Kim Konfi', { status: 'opted_out', attendance_status: 'present' }),
        teilnahme(2, 'Lea Konfi', { status: 'opted_out' }),
        teilnahme(3, 'Mia Konfi', { status: 'excused', attendance_status: 'excused' }),
        teilnahme(4, 'Ole Konfi', { attendance_status: 'present' }),
      ],
    });
    await oeffne();
    expect(kacheln()).toMatchObject({ Anwesend: 2, Abgemeldet: 2 });
  });
});

describe('Wer hat den Eintrag gemacht (Urheber)', () => {
  const MIT_URHEBERN = {
    ...NACHGETRAGEN, attendance_set_by_name: 'Simon Luthe', attendance_set_at: AM,
    attendance_note: 'Attest folgt', note_set_by_name: 'Anna Meier', note_set_at: AM,
  };

  it('jede Zeile steht direkt unter dem, was sie erklaert: Status-Urheber unter dem Grund, Notiz-Urheber unter der Notiz', async () => {
    expect(darstellung(await mitPerson(MIT_URHEBERN)).zusatz).toEqual([
      'Abgemeldet: krank, Mutter hat angerufen',
      'Eingetragen von Simon Luthe, 13.09.',
      'Notiz: Attest folgt',
      'Notiz von Anna Meier, 13.09.',
    ]);
  });

  it('der Zeitfenster-Abschnitt zeigt dieselben Zeilen in derselben Folge', () => {
    expect(darstellung(zeitfensterMit(MIT_URHEBERN)).zusatz).toEqual([
      'Abgemeldet: krank, Mutter hat angerufen',
      'Eingetragen von Simon Luthe, 13.09.',
      'Notiz: Attest folgt',
      'Notiz von Anna Meier, 13.09.',
    ]);
  });

  it('die Notiz-Urheber-Zeile haengt an der Notiz, nicht am Status', async () => {
    // Ohne die Bedingung auf attendance_note stuende "Notiz von ..." auch
    // dort, wo es gar keine Notiz gibt.
    const ohneNotiz = { ...MIT_URHEBERN, attendance_note: null };
    expect(darstellung(await mitPerson(ohneNotiz)).zusatz).toEqual([
      'Abgemeldet: krank, Mutter hat angerufen', 'Eingetragen von Simon Luthe, 13.09.',
    ]);
    document.body.innerHTML = '';
    expect(darstellung(zeitfensterMit(ohneNotiz)).zusatz).toEqual([
      'Abgemeldet: krank, Mutter hat angerufen', 'Eingetragen von Simon Luthe, 13.09.',
    ]);
  });
});

// Simon (15.09.2026): "Checkin via QR-Code am ..." — eine per QR-Code
// gesetzte Anwesenheit soll als solche gekennzeichnet sein. Der Urheber bleibt
// dabei leer (Migration 148); die Quelle (Migration 151) sagt es ohne Namen.
describe('Selbst-Check-in per QR-Code kennzeichnen', () => {
  const QR = { attendance_status: 'present', checkin_quelle: 'qr', checked_in_at: '2026-09-15T08:00:00Z' };

  it('die Zeile steht in der Teilnehmerliste -- genau einmal, mit Text', async () => {
    expect(darstellung(await mitPerson(QR)).zusatz).toEqual(['Eingecheckt per QR-Code, 15.09.']);
  });

  it('der Zeitfenster-Abschnitt zeigt dieselbe Zeile', () => {
    expect(darstellung(zeitfensterMit(QR)).zusatz).toEqual(['Eingecheckt per QR-Code, 15.09.']);
  });

  it('von Hand eingetragen: keine Check-in-Zeile', async () => {
    expect(darstellung(await mitPerson({ ...QR, checkin_quelle: 'manuell' })).zusatz).toEqual([]);
  });

  it('sie traegt dieselben Styles wie die Urheber-Zeilen', async () => {
    // Sie gehoert in dieselbe leise Reihe -- eine abweichende Farbe machte
    // aus einer Randnotiz eine Meldung.
    for (const zeile of [await mitPerson({ ...QR, attendance_set_by_name: 'Simon Luthe' })]) {
      const qr = within(zeile).getByText(/^Eingecheckt per QR-Code/) as HTMLElement;
      const urheber = within(zeile).getByText(/^Eingetragen von/) as HTMLElement;
      expect(qr.style.color).toBe('var(--app-text-tertiary)');
      expect(qr.style.fontSize).toBe('var(--app-text-hinweis)');
      expect(qr.getAttribute('style')).toBe(urheber.getAttribute('style'));
    }
  });

  it('sie steht direkt unter der Urheber-Zeile, vor der Notiz -- in beiden Listen', async () => {
    const alles = { ...QR, attendance_set_by_name: 'Simon Luthe', attendance_set_at: AM, attendance_note: 'kam spaeter' };
    const erwartet = ['Eingetragen von Simon Luthe, 13.09.', 'Eingecheckt per QR-Code, 15.09.', 'Notiz: kam spaeter'];
    expect(darstellung(await mitPerson(alles)).zusatz).toEqual(erwartet);
    document.body.innerHTML = '';
    expect(darstellung(zeitfensterMit(alles)).zusatz).toEqual(erwartet);
  });
});

// Waechter: Stylesheet, Profile, Handbuch.
describe('Gefahren-Knoepfe nutzen eine globale Klasse (Stil-Waechter)', () => {
  it('die Klasse ist in der globalen CSS definiert, mit Tokens', () => {
    expect(css).toContain('.app-gefahr-knopf {');
    expect(css).toContain('height: var(--app-abstand-block);');
    expect(css).toContain('--border-radius: var(--app-radius-karte);');
    expect(css).toContain('font-weight: var(--app-schrift-halbfett);');
  });

  it('die Profile schreiben das Aussehen nicht mehr selbst ab', () => {
    const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
    const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
    for (const datei of [konfiProfil, teamerProfil]) {
      const knoepfe = datei.match(/<IonButton[\s\S]*?>/g) || [];
      const gefahrKnoepfe = knoepfe.filter(k => k.includes('color="danger"'));
      expect(gefahrKnoepfe.length).toBeGreaterThanOrEqual(2);
      for (const knopf of gefahrKnoepfe) {
        expect(knopf).toContain('className="app-gefahr-knopf"');
        expect(knopf).not.toContain("height: '48px'");
        expect(knopf).not.toContain("borderRadius:");
        expect(knopf).not.toContain('fontWeight:');
      }
    }
  });
});

describe('Das Handbuch erklaert Abmeldung, Notiz und Check-in (Inhalts-Waechter)', () => {
  it('die alte Zusage "erfährt davon nichts" steht nicht mehr drin -- die Konfi bekommt eine Mitteilung', () => {
    expect(handbuch).not.toContain('erfährt davon nichts');
  });

  it('der Erklaertext zur Abmeldung steht im Handbuch', () => {
    expect(handbuch).toContain('### Eine Abmeldung nachtragen');
    expect(handbuch).toContain('Abgemeldet (nachgetragen)');
  });

  it('das Handbuch erklaert die Notiz', () => {
    expect(handbuch).toContain('## Die Anwesenheit verbuchen');
    expect(handbuch).toContain('Eine Notiz hinzufügen');
  });

  it('das Handbuch beschreibt die Check-in-Zeile', () => {
    expect(handbuch).toContain('Eingecheckt per QR-Code');
  });
});
