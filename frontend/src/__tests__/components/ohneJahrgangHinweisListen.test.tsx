import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Nachzug des Kein-Jahrgang-Hinweises (01.09.2026): Nicht nur die
// Konfi-Liste, auch die Challenge-Verwaltung und die Aktivitaets-Meldungen
// werden fuer einen Admin ohne Jahrgangs-Zuweisung leer -- und sahen dabei
// nach kaputter App aus. Der Fall ist GUELTIG (Simons Entscheidung
// 31.08.2026), deshalb erklaeren die Leerzustaende jetzt den Grund.
//
// Der eigentliche Punkt dieser Tests: Der Hinweis erscheint NUR, wenn der
// Server die Leere mit dem Header X-Kein-Jahrgang-Zugewiesen begruendet hat
// -- eine Liste, die aus einem anderen Grund leer ist (es gibt wirklich
// nichts), behaelt ihren bisherigen Text. Sonst erklaerte die Oberflaeche
// etwas Falsches.
//
// Muster wie in adminOhneJahrgangHinweis.test.ts (Konfi-Liste).

import ChallengesManageView from '../../components/admin/views/ChallengesManageView';
import ActivityRequestsView from '../../components/admin/ActivityRequestsView';

// ChallengesManageView liest useApp nur fuer die Loeschen-Berechtigung.
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 4, type: 'admin' } }),
}));

describe('ChallengesManageView: Leerzustand erklaert fehlenden Jahrgang', () => {
  it('mit Header-Grund: Hinweis statt "keine Challenge"', () => {
    const { container } = render(
      <ChallengesManageView
        challenges={[]}
        ohneJahrgang={true}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    expect(container.textContent).toContain('Kein Jahrgang zugewiesen');
    expect(container.textContent).toContain('Dir ist noch kein Jahrgang zugewiesen');
    // Der alte Text wuerde etwas Falsches behaupten.
    expect(container.textContent).not.toContain('Gerade läuft keine Challenge');
  });

  it('ohne Header-Grund: leere Liste behaelt ihren bisherigen Text', () => {
    // Gegenprobe -- wirklich keine Challenges angelegt: Der Jahrgangs-Hinweis
    // waere hier falsch.
    const { container } = render(
      <ChallengesManageView
        challenges={[]}
        ohneJahrgang={false}
        onSelectChallenge={() => {}}
        onEditChallenge={() => {}}
        onDeleteChallenge={() => {}}
      />
    );
    expect(container.textContent).toContain('Gerade läuft keine Challenge');
    expect(container.textContent).not.toContain('Kein Jahrgang zugewiesen');
  });
});

describe('ActivityRequestsView: Leerzustand erklaert fehlenden Jahrgang', () => {
  it('mit Header-Grund: Hinweis statt "keine Aktivitäten"', () => {
    const { container } = render(
      <ActivityRequestsView
        requests={[]}
        ohneJahrgang={true}
        onSelectRequest={() => {}}
        onResetRequest={() => {}}
      />
    );
    expect(container.textContent).toContain('Kein Jahrgang zugewiesen');
    // Teamer-Meldungen bleiben fuer den Admin sichtbar, deshalb spricht der
    // Text ausdruecklich nur von Konfis.
    expect(container.textContent).toContain('deshalb siehst du keine Meldungen von Konfis');
    expect(container.textContent).not.toContain('Keine Aktivitäten vorhanden');
  });

  it('ohne Header-Grund: leere Liste behaelt ihren bisherigen Text', () => {
    const { container } = render(
      <ActivityRequestsView
        requests={[]}
        ohneJahrgang={false}
        onSelectRequest={() => {}}
        onResetRequest={() => {}}
      />
    );
    expect(container.textContent).toContain('Keine Aktivitäten vorhanden');
    expect(container.textContent).not.toContain('Kein Jahrgang zugewiesen');
  });
});

// Die Seiten muessen den Header auch wirklich auslesen und durchreichen --
// sonst bleiben die Props oben fuer immer false. Quelltext-Assert wie in
// adminOhneJahrgangHinweis.test.ts: Der Header wird in der Query-Funktion
// gelesen (offline aus dem Cache laeuft sie nicht, der Hinweis erscheint
// dann bewusst nicht -- ein leerer Cache ist etwas anderes als "kein
// Jahrgang").
describe('Die Seiten lesen den Header aus', () => {
  const lies = (pfad: string) =>
    readFileSync(resolve(process.cwd(), pfad), 'utf8');

  it('ChallengesPage (Admin- und Teamer-Huelle)', () => {
    const seite = lies('src/components/shared/ChallengesPage.tsx');
    expect(seite).toContain("res.headers?.['x-kein-jahrgang-zugewiesen'] === 'true'");
    expect(seite).toContain('ohneJahrgang={ohneJahrgang}');
  });

  it('AdminEventsPage (Aktivitaets-Meldungen)', () => {
    const seite = lies('src/components/admin/pages/AdminEventsPage.tsx');
    expect(seite).toContain("res.headers?.['x-kein-jahrgang-zugewiesen'] === 'true'");
    expect(seite).toContain('ohneJahrgang={ohneJahrgang}');
  });

  it('der Server setzt den Header an beiden Stellen', () => {
    const challenges = readFileSync(resolve(process.cwd(), '../backend/routes/challenges.js'), 'utf8');
    const activities = readFileSync(resolve(process.cwd(), '../backend/routes/activities.js'), 'utf8');
    expect(challenges).toContain("res.set('X-Kein-Jahrgang-Zugewiesen', 'true');");
    expect(activities).toContain("res.set('X-Kein-Jahrgang-Zugewiesen', 'true');");
  });
});
