// useAppLocation muss ein STABILES Objekt liefern (11.09.2026).
//
// Simon: "Ruf mal die Register Seite auf. Das flickert und laedt immer neu.
// Keiner kann sich registrieren. Als waere es ein permanenter reload."
//
// Der Hook baute bei jedem Render ein neues Objekt (`return { ... }`). React
// vergleicht Abhaengigkeiten per Identitaet, also galt es jedes Mal als
// geaendert -- ein `useEffect(..., [location])` lief endlos.
//
// GEMESSEN auf https://konfi-quest.de/register?code=...: 799 Aufrufe von
// validate-invite in 15 Sekunden. Ohne Code in der Adresse blieb es
// unsichtbar, weil der Effekt dort vorher aussteigt.
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

let aktuelleLocation = { pathname: '/register', search: '?code=ABC123', state: null as unknown };

vi.mock('react-router-dom', () => ({
  useLocation: () => aktuelleLocation,
}));

import { useAppLocation } from '../../navigation/useAppLocation';

describe('useAppLocation liefert ein stabiles Objekt', () => {
  it('gibt bei erneutem Render DIESELBE Referenz zurueck', () => {
    const gesehen: unknown[] = [];
    let neuZeichnen: () => void = () => {};

    const Probe: React.FC = () => {
      const [, setZahl] = React.useState(0);
      neuZeichnen = () => setZahl((z) => z + 1);
      gesehen.push(useAppLocation());
      return null;
    };

    render(<Probe />);
    act(() => neuZeichnen());
    act(() => neuZeichnen());

    expect(gesehen.length).toBeGreaterThanOrEqual(3);
    // Genau das war der Fehler: Ohne useMemo waeren das drei verschiedene
    // Objekte, und jeder Effekt mit [location] liefe endlos.
    expect(gesehen[1]).toBe(gesehen[0]);
    expect(gesehen[2]).toBe(gesehen[0]);
  });

  it('ein useEffect mit [location] laeuft genau EINMAL', () => {
    // Der Fall aus der Register-Seite, nachgestellt: Der Effekt setzt
    // Zustand, was ein Render ausloest. Ohne stabiles Objekt beginnt hier
    // die Schleife.
    const laeufe = { n: 0 };

    const Probe: React.FC = () => {
      const location = useAppLocation();
      const [, setGeprueft] = React.useState<string | null>(null);
      React.useEffect(() => {
        laeufe.n += 1;
        const code = new URLSearchParams(location.search).get('code');
        setGeprueft(code);
      }, [location]);
      return null;
    };

    render(<Probe />);
    expect(laeufe.n).toBe(1);
  });

  it('wechselt die Adresse, gibt es ein NEUES Objekt', () => {
    // Die Gegenprobe zur Stabilitaet: Stabil heisst nicht eingefroren.
    const gesehen: unknown[] = [];
    const Probe: React.FC = () => {
      gesehen.push(useAppLocation());
      return null;
    };

    const { rerender } = render(<Probe />);
    aktuelleLocation = { pathname: '/register', search: '?code=XYZ789', state: null };
    rerender(<Probe />);

    expect(gesehen[1]).not.toBe(gesehen[0]);
    expect((gesehen[1] as { search: string }).search).toBe('?code=XYZ789');
  });
});
