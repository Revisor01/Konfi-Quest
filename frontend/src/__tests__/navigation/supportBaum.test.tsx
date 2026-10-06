import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BAEUME } from '../../navigation/rollenBaeume';
import { rollenStart } from '../../navigation/routes';
import { SUPPORT_BEREICHE } from '../../navigation/supportMenue';
import { ParamSeite, Umleitung, elternPfad } from '../../components/layout/MainTabs';

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
//
// Vorgaenge (03.10.2026, docs/planung/support-vorgaenge.md): „Anfragen" ist kein
// eigener Bereich mehr, sondern ein Filter der Vorgaenge (Art „Neue Gemeinde").
// Die alten Adressen bleiben als Umleitung bzw. als Seite, die zum Vorgang fuehrt.

const SUPPORT_PFADE = [
  '/admin/support',
  // Vorgaenge (03.10.2026, docs/planung/support-vorgaenge.md)
  '/admin/support/vorgaenge/:id',
  '/admin/support/vorgaenge',
  // Die alte Adresse einer Anfrage fuehrt zu ihrem Vorgang.
  '/admin/support/anfragen/:id',
  // Support-Mail (03.10.2026, docs/planung/support-mail.md)
  '/admin/support/post/:id',
  '/admin/support/post',
  '/admin/support/bausteine',
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

  it('menue: die acht Bereiche in fester Reihenfolge -- „Vorgänge“ statt „Anfragen“ --, jeder mit Symbol und Ziel im Baum', () => {
    const menue = BAEUME.super_admin.menue ?? [];
    expect(menue.map((m) => m.label)).toEqual([
      'Übersicht', 'Vorgänge', 'Posteingang', 'Gemeinden', 'Struktur', 'Support-Konten', 'Textbausteine', 'Betrieb',
    ]);
    for (const m of menue) {
      expect(m.icon, m.label).toBeTruthy();
      expect(trifft('super_admin', m.path), `${m.label}: ${m.path} ist keine Route`).toBe(true);
    }
    // Dieselbe Liste wie auf der Uebersicht -- eine Quelle.
    expect(menue.map((m) => m.path)).toEqual(SUPPORT_BEREICHE.map((b) => b.path));
    expect(menue.map((m) => m.gruppe)).toEqual([
      'Support', 'Support', 'Support', 'Verwaltung', 'Verwaltung', 'Verwaltung', 'Verwaltung', 'Betrieb',
    ]);
  });

  // Support-Mail, Entscheidung 5: „rote Zahl in der Support-Ansicht, kein Push".
  it('menue: rote Zahl an Vorgängen und Posteingang, sonst nirgends', () => {
    const menue = BAEUME.super_admin.menue ?? [];
    expect(menue.filter((m) => m.badge).map((m) => [m.label, m.badge])).toEqual([
      ['Vorgänge', 'supportVorgaenge'],
      ['Posteingang', 'supportPosteingang'],
    ]);
  });

  it('die alten Adressen leiten um -- in beiden Baeumen: die Anfragen auf die Vorgaenge der Art „Neue Gemeinde“, der Schriftwechsel einer Gemeinde auf ihre Vorgaenge', () => {
    for (const rolle of ['super_admin', 'admin'] as const) {
      expect(BAEUME[rolle].redirects, rolle).toContainEqual({ from: '/admin/support/anfragen', to: '/admin/support/vorgaenge?art=neue_gemeinde' });
      expect(BAEUME[rolle].redirects, rolle).toContainEqual({ from: '/admin/support/post/gemeinde/:id', to: '/admin/support/vorgaenge?gemeinde=:id' });
      expect(BAEUME[rolle].redirects, rolle).toContainEqual({ from: '/admin/support/post/gemeinde', to: '/admin/support/post' });
    }
  });

  it('die alten Adressen sind keine Seiten mehr -- sonst stuende eine Seite vor der Umleitung', () => {
    for (const pfad of ['/admin/support/anfragen', '/admin/support/post/gemeinde/7', '/admin/support/post/gemeinde']) {
      // „post/gemeinde" wuerde als Mail mit der Kennung „gemeinde" gelesen -- die Umleitung muss davor greifen.
      if (pfad === '/admin/support/post/gemeinde') continue;
      expect(trifft('super_admin', pfad), pfad).toBe(false);
    }
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

describe('Ein Vorgang und die alte Adresse einer Anfrage: Kennung als Zahl', () => {
  const Vorgang: React.FC<{ vorgangId: number }> = ({ vorgangId }) => (
    <span data-testid="vorgang">{`${typeof vorgangId}:${vorgangId}`}</span>
  );
  const Anfrage: React.FC<{ anfrageId: number }> = ({ anfrageId }) => (
    <span data-testid="anfrage">{`${typeof anfrageId}:${anfrageId}`}</span>
  );
  const Liste: React.FC = () => <span data-testid="liste">Liste</span>;

  const rendere = (start: string) => {
    const routen = BAEUME.super_admin.routes.filter((r) => r.path.startsWith('/admin/support/vorgaenge') || r.path.startsWith('/admin/support/anfragen'));
    return render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          {routen.map((r) => {
            const Seite = r.propName === 'anfrageId' ? Anfrage : Vorgang;
            return (
              <Route key={r.path} path={r.path} element={r.param && r.propName
                ? <ParamSeite Seite={Seite} prop={r.propName} param={r.param} zurueckZu={elternPfad(r.path)} />
                : <Liste />} />
            );
          })}
        </Routes>
      </MemoryRouter>
    );
  };

  it('/admin/support/vorgaenge/12 oeffnet den Vorgang mit vorgangId 12', () => {
    rendere('/admin/support/vorgaenge/12');
    expect(screen.getByTestId('vorgang').textContent).toBe('number:12');
  });

  it('/admin/support/vorgaenge bleibt die Liste -- nicht ein Vorgang', () => {
    rendere('/admin/support/vorgaenge');
    expect(screen.getByTestId('liste')).toBeTruthy();
    expect(screen.queryByTestId('vorgang')).toBeNull();
  });

  it('/admin/support/anfragen/12 oeffnet die Seite, die zum Vorgang der Anfrage 12 fuehrt (anfrageId)', () => {
    rendere('/admin/support/anfragen/12');
    expect(screen.getByTestId('anfrage').textContent).toBe('number:12');
  });
});

describe('Alte Adressen im Router: die Umleitung fuellt den Platzhalter', () => {
  const Standort: React.FC = () => {
    const loc = useLocation();
    return <span data-testid="standort">{loc.pathname + loc.search}</span>;
  };
  const rendere = (start: string) => {
    const umleitungen = BAEUME.super_admin.redirects.filter((r) => r.from.startsWith('/admin/support'));
    return render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          {umleitungen.map((r) => <Route key={r.from} path={r.from} element={<Umleitung to={r.to} />} />)}
          <Route path="/admin/support/vorgaenge" element={<Standort />} />
          <Route path="/admin/support/post" element={<Standort />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('/admin/support/anfragen landet auf den Vorgaengen der Art „Neue Gemeinde“', () => {
    rendere('/admin/support/anfragen');
    expect(screen.getByTestId('standort').textContent).toBe('/admin/support/vorgaenge?art=neue_gemeinde');
  });

  it('/admin/support/post/gemeinde/7 landet auf den Vorgaengen der Gemeinde 7 -- nicht auf ":id"', () => {
    rendere('/admin/support/post/gemeinde/7');
    expect(screen.getByTestId('standort').textContent).toBe('/admin/support/vorgaenge?gemeinde=7');
  });

  it('/admin/support/post/gemeinde ohne Kennung landet im Posteingang', () => {
    rendere('/admin/support/post/gemeinde');
    expect(screen.getByTestId('standort').textContent).toBe('/admin/support/post');
  });
});

describe('Support-Mail: eine Mail, Kennung als Zahl', () => {
  const Mail: React.FC<{ nachrichtId: number }> = ({ nachrichtId }) => (
    <span data-testid="mail">{`${typeof nachrichtId}:${nachrichtId}`}</span>
  );
  const Posteingang: React.FC = () => <span data-testid="posteingang">Posteingang</span>;

  // Wie das Outlet: Detailseiten bekommen ihre Kennung ueber ParamSeite.
  const rendere = (start: string) => {
    const routen = BAEUME.super_admin.routes.filter((r) => r.path.startsWith('/admin/support/post'));
    return render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          {routen.map((r) => {
            return (
              <Route key={r.path} path={r.path} element={r.param && r.propName
                ? <ParamSeite Seite={Mail} prop={r.propName} param={r.param} zurueckZu={elternPfad(r.path)} />
                : <Posteingang />} />
            );
          })}
        </Routes>
      </MemoryRouter>
    );
  };

  it('/admin/support/post/31 oeffnet die Mail mit nachrichtId 31', () => {
    rendere('/admin/support/post/31');
    expect(screen.getByTestId('mail').textContent).toBe('number:31');
  });

  it('/admin/support/post bleibt der Posteingang', () => {
    rendere('/admin/support/post');
    expect(screen.getByTestId('posteingang')).toBeTruthy();
  });
});
