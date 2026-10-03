import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BAEUME } from '../../navigation/rollenBaeume';
import { elternPfad, ParamSeite } from '../../components/layout/MainTabs';

// Challenges als eigene Seiten (2.4.0, Simon 02.10.2026): "challenge nicht
// in modal öffnen, sondern in unterseite, damit man direkt auf die
// challenge linken kann aus einem push."
//
// Vorbild sind die Termine: Je Rolle steht eine Detail-Route mit Kennung
// VOR der Liste, MainTabs haengt die Seite ein und gibt ihr die Kennung als
// Zahl plus einen Zurueck-Weg zur Liste (elternPfad), der auch ohne Verlauf
// greift -- nach einem Push-Tipp gibt es keine Seite davor.
//
// Anders als bei den Terminen bekommt auch das Team eine eigene Seite
// (Festlegung 02.10.2026): Team und Leitung teilen sich die Ansicht, wie
// schon die Liste (shared/ChallengesPage).

const ROLLEN = ['admin', 'teamer', 'konfi'] as const;

describe('Challenge-Detailrouten je Rolle', () => {
  it.each(ROLLEN)('%s: /<rolle>/challenges/:id steht vor der Liste und reicht die Kennung als challengeId', (rolle) => {
    const routen = BAEUME[rolle].routes;
    const detail = routen.findIndex((r) => r.path === `/${rolle}/challenges/:id`);
    const liste = routen.findIndex((r) => r.path === `/${rolle}/challenges`);
    expect(detail, `${rolle}: Detailroute fehlt`).toBeGreaterThanOrEqual(0);
    expect(liste, `${rolle}: Liste fehlt`).toBeGreaterThanOrEqual(0);
    expect(detail).toBeLessThan(liste);
    expect(routen[detail].param).toBe('id');
    expect(routen[detail].propName).toBe('challengeId');
    // Eine eigene Seite, nicht die Liste ein zweites Mal.
    expect(routen[detail].page).not.toBe(routen[liste].page);
  });

  it('Team und Leitung teilen sich die Seite, Konfis haben ihre eigene', () => {
    const seite = (rolle: typeof ROLLEN[number]) =>
      BAEUME[rolle].routes.find((r) => r.path === `/${rolle}/challenges/:id`)!.page;
    expect(seite('teamer')).toBe(seite('admin'));
    expect(seite('konfi')).not.toBe(seite('admin'));
  });

  it.each(ROLLEN)('%s: der Zurueck-Weg ohne Verlauf fuehrt auf die Challenge-Liste', (rolle) => {
    expect(elternPfad(`/${rolle}/challenges/:id`)).toBe(`/${rolle}/challenges`);
  });

  it('keine Umleitung faengt die Detailroute ab (wie /teamer/events/:id)', () => {
    for (const rolle of ROLLEN) {
      expect(BAEUME[rolle].redirects.some((u) => u.from.startsWith(`/${rolle}/challenges`))).toBe(false);
    }
  });
});

describe('Im Router: Detail und Liste trennen sich sauber', () => {
  // Die Seite bekommt die Kennung als ZAHL unter ihrem Prop-Namen -- so wie
  // MainTabs sie einhaengt (ParamSeite). Gerendert wird nur, was die
  // Attrappe bekommt.
  const Detail: React.FC<{ challengeId: number; onBack: () => void }> = ({ challengeId, onBack }) => (
    <span data-testid="detail">{`${typeof challengeId}:${challengeId}:${typeof onBack}`}</span>
  );
  const Liste: React.FC = () => <span data-testid="liste">Liste</span>;

  const rendere = (rolle: typeof ROLLEN[number], start: string) => {
    const routen = BAEUME[rolle].routes.filter((r) => r.path.startsWith(`/${rolle}/challenges`));
    return render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          {routen.map((r) => (
            <Route
              key={r.path}
              path={r.path}
              element={r.param && r.propName
                ? <ParamSeite Seite={Detail} prop={r.propName} param={r.param} zurueckZu={elternPfad(r.path)} />
                : <Liste />}
            />
          ))}
        </Routes>
      </MemoryRouter>
    );
  };

  it.each(ROLLEN)('%s: /<rolle>/challenges/7 oeffnet die Seite mit challengeId 7', (rolle) => {
    rendere(rolle, `/${rolle}/challenges/7`);
    expect(screen.getByTestId('detail').textContent).toBe('number:7:function');
    expect(screen.queryByTestId('liste')).toBeNull();
  });

  it.each(ROLLEN)('%s: /<rolle>/challenges bleibt die Liste', (rolle) => {
    rendere(rolle, `/${rolle}/challenges`);
    expect(screen.getByTestId('liste')).toBeTruthy();
    expect(screen.queryByTestId('detail')).toBeNull();
  });
});
