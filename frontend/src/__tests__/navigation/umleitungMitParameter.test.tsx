import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Umleitung, umleitungsZiel } from '../../components/layout/MainTabs';
import { BAEUME } from '../../navigation/rollenBaeume';

// Umleitungen mit Parameter (24.09.2026).
//
// Anlass: Teamer:innen hatten keine Termin-Detailroute. Die Termin-Pushes
// bauen fuer alle Rollen /<rolle>/events/<id>; bei Teamer:innen fiel der Link
// in den Catch-all und landete auf dem Dashboard. Ihre Detailansicht lebt in
// der Terminliste und oeffnet sich seit jeher ueber ?eventId= -- also leitet
// /teamer/events/:id dorthin um. Dafuer muss die Umleitung den Platzhalter
// aus der URL fuellen; <Navigate to="/teamer/events?eventId=:id"> allein
// haette woertlich ":id" in die Adresse geschrieben.

const ROLLEN = Object.keys(BAEUME) as (keyof typeof BAEUME)[];

describe('umleitungsZiel: Platzhalter aus den URL-Parametern fuellen', () => {
  it('setzt den Wert des Parameters ein', () => {
    expect(umleitungsZiel('/teamer/events?eventId=:id', { id: '7' })).toBe('/teamer/events?eventId=7');
  });

  it('laesst Umleitungen ohne Platzhalter unveraendert', () => {
    expect(umleitungsZiel('/teamer/events?segment=antraege', {})).toBe('/teamer/events?segment=antraege');
    expect(umleitungsZiel('/teamer/dashboard', { id: '7' })).toBe('/teamer/dashboard');
  });

  it('ein Platzhalter ohne Wert faellt weg, statt woertlich stehen zu bleiben', () => {
    // Die Zielseite sieht dann keinen Parameter und zeigt die Liste -- besser
    // als "?eventId=:id", das parseInt zu NaN machte.
    expect(umleitungsZiel('/teamer/events?eventId=:id', {})).toBe('/teamer/events?eventId=');
  });

  it('fuellt mehrere Platzhalter unabhaengig voneinander', () => {
    expect(umleitungsZiel('/x/:a/y/:b', { a: '1', b: '2' })).toBe('/x/1/y/2');
  });
});

describe('Jede Umleitung mit Platzhalter kann ihn auch fuellen', () => {
  // Ein Platzhalter im Ziel, den der Quellpfad nicht kennt, waere ein Ziel,
  // das nie einen Wert bekommt. Iteriert ueber dieselbe Tabelle wie der
  // Renderer -- eine kuenftige Umleitung wird automatisch mitgeprueft.
  it.each(ROLLEN)('%s: Platzhalter im Ziel stehen auch im Quellpfad', (rolle) => {
    for (const um of BAEUME[rolle].redirects) {
      const imZiel = [...um.to.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
      const inQuelle = [...um.from.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
      for (const name of imZiel) {
        expect(inQuelle, `${rolle}: ${um.from} -> ${um.to} fuellt :${name} nie`).toContain(name);
      }
    }
  });

  it('teamer: /teamer/events/:id leitet auf die Liste mit geoeffnetem Termin', () => {
    const um = BAEUME.teamer.redirects.find((r) => r.from === '/teamer/events/:id');
    expect(um).toBeTruthy();
    expect(um!.to).toBe('/teamer/events?eventId=:id');
  });
});

describe('Umleitung im Router', () => {
  const Standort: React.FC = () => {
    const loc = useLocation();
    return <span data-testid="standort">{loc.pathname + loc.search}</span>;
  };

  const rendere = (start: string) =>
    render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/teamer/events/:id" element={<Umleitung to="/teamer/events?eventId=:id" />} />
          <Route path="/teamer/requests" element={<Umleitung to="/teamer/events?segment=antraege" />} />
          <Route path="/teamer/events" element={<Standort />} />
        </Routes>
      </MemoryRouter>
    );

  it('/teamer/events/7 landet auf /teamer/events?eventId=7', () => {
    rendere('/teamer/events/7');
    expect(screen.getByTestId('standort').textContent).toBe('/teamer/events?eventId=7');
  });

  it('eine statische Umleitung laeuft unveraendert durch', () => {
    rendere('/teamer/requests');
    expect(screen.getByTestId('standort').textContent).toBe('/teamer/events?segment=antraege');
  });
});
