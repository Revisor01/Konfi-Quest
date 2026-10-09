// Abgesagte Termine in der Detailansicht der Leitung (15.09.2026) --
// gerendert (Audit Tests 26.09.2026, BF-02; bis 09.10.2026 am Quelltext
// geprueft in abgesagteTermineAnsichten.test.ts, dort steht der Befund).
//
// Gerendert wird die echte Ansicht (Geruest leitungTerminDetail) und ihre
// Zeitfenster-Liste. Geprueft wird, was die Leitung sieht: der Absage-Kasten
// mit beiden Urhebern, kein durchgestrichener Titel, die Kachel
// "Abgemeldet" nach einer Absage (Befund G) und beide Teilnehmerlisten mit
// derselben Darstellung (Befund H).
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, teilnahme, oeffne, zeileVon, statusText } from './gerueste/leitungTerminDetail';
import { TimeslotsSection } from '../../components/admin/views/EventDetailSections';
import type { Participant } from '../../components/admin/views/EventDetailSections';

const GRUND = 'Heizung im Gemeindehaus defekt';
const ABGESAGT = {
  cancelled: true, registration_status: 'cancelled', cancelled_reason: GRUND,
  cancelled_by_name: 'Anna Meier', cancelled_at: '2026-09-15T08:00:00+02:00',
  cancelled_reason_set_by_name: 'Bernd Schulz', cancelled_reason_set_at: '2026-09-16T09:30:00+02:00',
};

const kacheln = () => Object.fromEntries(
  [...document.querySelectorAll('.app-stats-row__item')].map((k) => [
    k.querySelector('.app-stats-row__label')?.textContent,
    Number(k.querySelector('.app-stats-row__value')?.textContent),
  ]),
);

/** Badge-Text und Farbklassen einer Teilnehmerzeile. */
const zeilenBild = (zeile: HTMLElement) => {
  const badge = within(zeile).getByRole('img');
  const klasse = (el: Element, praefix: string) => [...el.classList].find((k) => k.startsWith(praefix) && !k.includes('badge-space'));
  return {
    text: badge.getAttribute('aria-label'),
    rand: klasse(zeile.querySelector('.app-list-item')!, 'app-list-item--'),
    badge: klasse(badge, 'app-corner-badge--'),
    kreis: klasse(zeile.querySelector('.app-icon-circle')!, 'app-icon-circle--'),
  };
};

beforeEach(zuruecksetzen);

describe('der Absage-Kasten steht im Leitungs-Detail', () => {
  it('mit Grund, Absagender und der Person, die den Grund geaendert hat -- je genau einmal', async () => {
    zustand.detail = termin(ABGESAGT);
    await oeffne();
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
    expect(screen.getAllByText('Anna Meier, 15.09.')).toHaveLength(1);
    expect(screen.getAllByText('Geändert von Bernd Schulz, 16.09.')).toHaveLength(1);
    expect(statusText()).toBe('Abgesagt');
  });

  it('ohne Grund steht der Platzhaltersatz', async () => {
    zustand.detail = termin({ ...ABGESAGT, cancelled_reason: null });
    await oeffne();
    expect(screen.getAllByText('Kein Grund zur Absage angegeben.')).toHaveLength(1);
  });

  it('erkennt die Absage auch allein am Feld cancelled', async () => {
    zustand.detail = termin({ ...ABGESAGT, registration_status: 'open' });
    await oeffne();
    expect(statusText()).toBe('Abgesagt');
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
  });

  it('Befund B: der Titel ist NICHT durchgestrichen', async () => {
    zustand.detail = termin(ABGESAGT);
    await oeffne();
    const gestrichen = [...document.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.textDecoration === 'line-through');
    expect(gestrichen).toEqual([]);
  });

  it('ein offener Termin hat keinen Kasten', async () => {
    zustand.detail = termin();
    await oeffne();
    expect(screen.queryByText(/Kein Grund zur Absage|Geändert von/)).toBeNull();
  });
});

describe('Befund G: die Kachel "Abgemeldet" zaehlt nach einer Terminabsage richtig', () => {
  // Eine Absage setzt alle Buchungen auf status='excused' (Migration 153).
  // Die alte Bedingung `status === 'opted_out' && !attendance_status` traf
  // dann niemanden mehr -- die Kachel meldete "Abgemeldet: 0".
  it('zaehlt alle durch die Absage Abgemeldeten -- und die Selbstabmeldung', async () => {
    zustand.detail = termin({
      ...ABGESAGT, points: 0, teamer_needed: false,
      participants: [
        teilnahme(1, 'Kim Konfi', { status: 'excused' }),
        teilnahme(2, 'Lea Konfi', { status: 'excused' }),
        teilnahme(3, 'Mia Konfi', { status: 'opted_out' }),
        teilnahme(4, 'Ole Konfi', { status: 'waitlist' }),
      ],
    });
    await oeffne();
    expect(kacheln()).toMatchObject({ Abgemeldet: 3, Warteliste: 1 });
  });
});

describe('Befund H: beide Teilnehmerlisten zeigen dieselbe Darstellung', () => {
  const PERSONEN: Array<[string, Record<string, unknown>, ReturnType<typeof zeilenBild>]> = [
    ['durch die Absage abgemeldet', { status: 'excused' }, { text: 'Abgemeldet', rand: 'app-list-item--danger', badge: 'app-corner-badge--danger', kreis: 'app-icon-circle--danger' }],
    ['selbst abgemeldet', { status: 'opted_out' }, { text: 'Abgemeldet', rand: 'app-list-item--danger', badge: 'app-corner-badge--danger', kreis: 'app-icon-circle--danger' }],
    ['nachgetragen abgemeldet', { status: 'excused', attendance_status: 'excused' }, { text: 'Abgemeldet (nachgetragen)', rand: 'app-list-item--neutral', badge: 'app-corner-badge--neutral', kreis: 'app-icon-circle--neutral' }],
    ['gebucht', {}, { text: 'Gebucht', rand: 'app-list-item--info', badge: 'app-corner-badge--info', kreis: 'app-icon-circle--info' }],
  ];

  it.each(PERSONEN)('Liste ohne Zeitfenster: %s', async (_name, zusatz, erwartet) => {
    zustand.detail = termin({ participants: [teilnahme(1, 'Kim Konfi', zusatz)] });
    await oeffne();
    expect(zeilenBild(zeileVon('Kim Konfi'))).toEqual(erwartet);
  });

  it.each(PERSONEN)('Zeitfenster-Liste: %s -- dasselbe Bild', (_name, zusatz, erwartet) => {
    const person = teilnahme(1, 'Kim Konfi', { timeslot_id: 1, ...zusatz }) as unknown as Participant;
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
    expect(zeilenBild(zeileVon('Kim Konfi'))).toEqual(erwartet);
  });

  it('die Zeitfenster-Liste wirft abgemeldete Zeilen nicht heraus -- Wartende stehen getrennt darunter', () => {
    // Der alte Filter liess nur 'confirmed' durch -- seit eine Abmeldung
    // status='excused' setzt, verschwand die Zeile ganz aus dem Zeitfenster.
    const personen = [
      teilnahme(1, 'Kim Konfi', { timeslot_id: 1 }),
      teilnahme(2, 'Lea Konfi', { timeslot_id: 1, status: 'excused', excuse_reason: 'krank' }),
      teilnahme(3, 'Mia Konfi', { timeslot_id: 1, status: 'opted_out', opt_out_reason: 'Turnier' }),
      teilnahme(4, 'Ole Konfi', { timeslot_id: 1, status: 'waitlist' }),
    ] as unknown as Participant[];
    render(
      <TimeslotsSection
        timeslots={[{ id: 1, start_time: '2026-10-10T08:00:00Z', end_time: '2026-10-10T10:00:00Z', max_participants: 10, registered_count: 1 }]}
        participants={personen}
        formatTime={() => '10:00'}
        showAttendanceActionSheet={() => undefined}
        handleDemoteParticipant={() => undefined}
        handleRemoveParticipant={() => undefined}
      />
    );
    const [teilnehmende] = [...document.querySelectorAll<HTMLElement>('.app-event-detail__slot-participants')];
    const namen = [...teilnehmende.querySelectorAll('.app-list-item__title')].map((t) => t.textContent);
    expect(namen).toEqual(['Kim Konfi', 'Lea Konfi', 'Mia Konfi']);
    expect(within(zeileVon('Mia Konfi')).getByText('Turnier')).toBeTruthy();
    // Die Wartende steht nicht unter den Teilnehmenden, sondern im eigenen Block.
    const warteliste = screen.getByText('Warteliste').parentElement as HTMLElement;
    expect(within(warteliste).getByText('Ole Konfi')).toBeTruthy();
  });
});
