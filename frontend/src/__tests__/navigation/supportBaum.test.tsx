import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BAEUME } from '../../navigation/rollenBaeume';
import { rollenStart } from '../../navigation/routes';
import { SUPPORT_BEREICHE } from '../../navigation/supportMenue';
import { ParamSeite, elternPfad } from '../../components/layout/MainTabs';

// Die Support-Ansicht im Navigationsbaum (Web-Version, 03.10.2026).
//
// Ein Support-Konto ohne Gemeinde (Systemrolle super_admin) startete bis
// dahin auf /admin/organizations, ohne Reiter und ohne Abmelden. Jetzt
// startet es auf der Uebersicht /admin/support; die Bereiche stehen als
// `menue` im Baum (Seitenleiste der Web-Version) und dieselben auf der
// Uebersicht (schmale Bildschirme, dort auch das Abmelden). Simons Konto --
// Gemeindeleitung mit Merkmal -- erreicht dieselben Seiten im Baum der
// Leitung ueber "Mehr", ohne dass sie fuer andere Leitungen in einer
// Navigation stehen.

const SUPPORT_PFADE = [
  '/admin/support',
  '/admin/support/anfragen/:id',
  '/admin/support/anfragen',
  '/admin/support/struktur',
  '/admin/support/konten',
];

/** Bildet den Routen-Abgleich des Outlets nach. */
const trifft = (rolle: keyof typeof BAEUME, pfad: string) => BAEUME[rolle].routes.some((r) => {
  const muster = r.path.split('/').map((t) => (t.startsWith(':') ? '[^/]+' : t)).join('/');
  return new RegExp(`^${muster}$`).test(pfad);
});

describe('Baum super_admin: Support-Ansicht', () => {
  it('startet auf der Uebersicht /admin/support -- auch von /admin aus', () => {
    expect(rollenStart('super_admin')).toBe('/admin/support');
    expect(BAEUME.super_admin.redirects).toContainEqual({ from: '/admin', to: '/admin/support' });
  });

  it('traegt alle Seiten der Support-Ansicht plus Gemeinden und Betrieb', () => {
    const pfade = BAEUME.super_admin.routes.map((r) => r.path);
    expect(pfade).toEqual([...SUPPORT_PFADE, '/admin/organizations', '/admin/metrics']);
  });

  it('menue: die sechs Bereiche in fester Reihenfolge, jeder mit Symbol und Ziel im Baum', () => {
    const menue = BAEUME.super_admin.menue ?? [];
    expect(menue.map((m) => m.label)).toEqual(['Übersicht', 'Anfragen', 'Gemeinden', 'Struktur', 'Support-Konten', 'Betrieb']);
    for (const m of menue) {
      expect(m.icon, m.label).toBeTruthy();
      expect(trifft('super_admin', m.path), `${m.label}: ${m.path} ist keine Route`).toBe(true);
    }
    // Dieselbe Liste wie auf der Uebersicht -- eine Quelle.
    expect(menue.map((m) => m.path)).toEqual(SUPPORT_BEREICHE.map((b) => b.path));
    expect(menue.map((m) => m.gruppe)).toEqual(['Support', 'Support', 'Verwaltung', 'Verwaltung', 'Verwaltung', 'Betrieb']);
  });

  it('weiter keine Reiterleiste', () => {
    expect(BAEUME.super_admin.tabs).toEqual([]);
  });
});

describe('Baum der Leitung: Support-Seiten fuer Simons Konto, ohne Navigation fuer andere', () => {
  it('dieselben Seiten liegen auch hier', () => {
    const admin = new Map(BAEUME.admin.routes.map((r) => [r.path, r.page]));
    for (const r of BAEUME.super_admin.routes) {
      expect(admin.get(r.path), r.path).toBe(r.page);
    }
  });

  it('kein Reiter und kein Menue-Eintrag der Leitung fuehrt dorthin', () => {
    expect(BAEUME.admin.tabs.some((t) => t.href.startsWith('/admin/support'))).toBe(false);
    expect(BAEUME.admin.menue ?? []).toEqual([]);
  });
});

describe('Eine Anfrage: Kennung als Zahl', () => {
  const Detail: React.FC<{ anfrageId: number }> = ({ anfrageId }) => (
    <span data-testid="detail">{`${typeof anfrageId}:${anfrageId}`}</span>
  );
  const Liste: React.FC = () => <span data-testid="liste">Liste</span>;

  const rendere = (start: string) => {
    const routen = BAEUME.super_admin.routes.filter((r) => r.path.startsWith('/admin/support/anfragen'));
    return render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          {routen.map((r) => (
            <Route key={r.path} path={r.path} element={r.param && r.propName
              ? <ParamSeite Seite={Detail} prop={r.propName} param={r.param} zurueckZu={elternPfad(r.path)} />
              : <Liste />} />
          ))}
        </Routes>
      </MemoryRouter>
    );
  };

  it('/admin/support/anfragen/12 oeffnet die Anfrage mit anfrageId 12', () => {
    rendere('/admin/support/anfragen/12');
    expect(screen.getByTestId('detail').textContent).toBe('number:12');
  });

  it('/admin/support/anfragen bleibt die Liste', () => {
    rendere('/admin/support/anfragen');
    expect(screen.getByTestId('liste')).toBeTruthy();
  });
});
