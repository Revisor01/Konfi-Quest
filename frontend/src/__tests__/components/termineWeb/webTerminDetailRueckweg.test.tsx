// Zurück aus einem Event zur Person, von deren Detailseite es kam (Simon,
// Seiten-Interview 13.10.2026: „ein angeklicktes event führt ins event, zurück
// dann aber auf alle events -- geht das auch anders? also zurück ins profil?").
//
// Die Eventliste der Personenseite verlinkt /admin/events/:id?person=:id;
// ParamSeite (MainTabs) reicht die Abfrage als `abfrage` an die Eventseite.
// Dort steht der Rückweg zur Person, beschriftet mit ihrem Namen -- aus den
// Teilnehmenden, den Abmeldungen oder, solange das Event noch lädt, dem, was
// die Personenseite sich gemerkt hat (utils/rueckweg.ts). Ohne Herkunft
// bleibt es bei „Alle Events".
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { zustand, zuruecksetzen, termin, teilnahme, oeffne, api } from '../gerueste/leitungTerminDetail';
import { gemerkteNamenVergessen, personAusAbfrage, personNameMerken, rueckwegZurPerson } from '../../../utils/rueckweg';

vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

// teilnahme(id, ...) traegt user_id = id + 100.
const KIM = 101;

beforeEach(() => {
  zuruecksetzen();
  gemerkteNamenVergessen();
  breit.wert = true;
  zustand.detail = termin({
    participants: [teilnahme(1, 'Kim Konfi'), teilnahme(2, 'Mia Muster', { attendance_status: 'present' })],
    unregistrations: [{ id: 3, user_id: 177, konfi_name: 'Ben Beispiel', unregistered_at: '2026-10-01T08:00:00Z' }],
  });
});

const zurueckLink = () => screen.getByRole('navigation', { name: 'Zurück' }).querySelector('a') as HTMLAnchorElement;

describe('Eventseite im Browser: der Weg zurück', () => {
  it('von der Personenseite (?person=): zurück zur Person, beschriftet mit ihrem Namen', async () => {
    await oeffne(7, { abfrage: `?person=${KIM}` });
    expect(zurueckLink()).toHaveAttribute('href', `/admin/konfis/${KIM}`);
    expect(zurueckLink()).toHaveTextContent('Kim Konfi');
    expect(screen.queryByRole('link', { name: 'Alle Events' })).toBeNull();
  });

  it('abgemeldete Person: der Name kommt aus den Abmeldungen', async () => {
    await oeffne(7, { abfrage: '?person=177' });
    expect(zurueckLink()).toHaveAttribute('href', '/admin/konfis/177');
    expect(zurueckLink()).toHaveTextContent('Ben Beispiel');
  });

  it('Direktaufruf ohne Herkunft (Liste, Push, Lesezeichen): „Alle Events"', async () => {
    await oeffne(7);
    expect(zurueckLink()).toHaveAttribute('href', '/admin/events');
    expect(zurueckLink()).toHaveTextContent('Alle Events');
  });

  it('unbrauchbare Abfrage: „Alle Events"', async () => {
    await oeffne(7, { abfrage: '?person=abc' });
    expect(zurueckLink()).toHaveTextContent('Alle Events');
  });

  it('solange das Event lädt, steht schon der gemerkte Name da', async () => {
    personNameMerken(KIM, 'Kim Konfi');
    api.get.mockImplementation(() => new Promise(() => {}));
    await oeffne(7, { abfrage: `?person=${KIM}` });
    expect(screen.getByRole('status')).toHaveTextContent('Das Event wird geladen.');
    expect(zurueckLink()).toHaveAttribute('href', `/admin/konfis/${KIM}`);
    expect(zurueckLink()).toHaveTextContent('Kim Konfi');
  });

  it('Person weder unter den Teilnehmenden noch gemerkt: „Zurück zum Profil"', async () => {
    await oeffne(7, { abfrage: '?person=999' });
    expect(zurueckLink()).toHaveAttribute('href', '/admin/konfis/999');
    expect(zurueckLink()).toHaveTextContent('Zurück zum Profil');
  });
});

describe('utils/rueckweg', () => {
  it.each([
    ['?person=9', 9],
    ['?filter=team&person=12', 12],
    ['', null],
    [undefined, null],
    ['?person=', null],
    ['?person=0', null],
    ['?person=-3', null],
    ['?person=9abc', null],
  ])('personAusAbfrage(%s) = %s', (abfrage, erwartet) => {
    expect(personAusAbfrage(abfrage as string | undefined)).toBe(erwartet);
  });

  it('Name: Teilnehmende vor gemerktem, ohne beides „Zurück zum Profil"; ohne Person null', () => {
    personNameMerken(5, 'Gemerkt');
    expect(rueckwegZurPerson('?person=5', () => 'Aus dem Termin')).toEqual({ href: '/admin/konfis/5', text: 'Aus dem Termin' });
    expect(rueckwegZurPerson('?person=5', () => undefined)).toEqual({ href: '/admin/konfis/5', text: 'Gemerkt' });
    expect(rueckwegZurPerson('?person=6', () => null)).toEqual({ href: '/admin/konfis/6', text: 'Zurück zum Profil' });
    expect(rueckwegZurPerson('', () => 'egal')).toBeNull();
  });
});

describe('ParamSeite reicht die Abfrage an die Seite', () => {
  it('/admin/events/7?person=9 -> eventId 7 und abfrage "?person=9"; ohne Abfrage leer', async () => {
    const { ParamSeite, elternPfad } = await import('../../../components/layout/MainTabs');
    const Seite: React.FC<{ eventId: number; abfrage?: string }> = ({ eventId, abfrage }) => (
      <span data-testid="seite">{`${eventId}|${abfrage}`}</span>
    );
    const rendere = (start: string) => render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/admin/events/:id" element={<ParamSeite Seite={Seite} prop="eventId" param="id" zurueckZu={elternPfad('/admin/events/:id')} />} />
        </Routes>
      </MemoryRouter>,
    );
    const a = rendere('/admin/events/7?person=9');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('seite')).toHaveTextContent('7|?person=9');
    a.unmount();
    rendere('/admin/events/7');
    expect(screen.getByTestId('seite')).toHaveTextContent('7|');
  });
});
