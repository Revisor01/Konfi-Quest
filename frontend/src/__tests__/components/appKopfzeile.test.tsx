import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

// Die gemeinsame Kopfzeile (25.09.2026). Simon: "Könnte man in dem Zuge auf
// ne gemeinsame Zeile per Rolle umstellen? Und dann nur pro Seite ein und
// ausblenden." -- "Dann kann der Gemeindeumschalter auch auf jede Seite,
// dann weiß ich wo ich bin."
//
// Umstellung gestuft: zuerst die Konfi-Rolle. Dieser Test haelt fest, dass
// die Konfi-Seiten keine eigene Kopfzeile mehr bauen -- sonst fehlt dort die
// Glocke, und genau das war der Zustand, den die Kopfzeile beenden soll.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonHeader: (props: StubProps & { collapse?: string }) => <div data-testid={props.collapse ? 'kopfzeile-gross' : 'kopfzeile'}>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps & { size?: string }) => <div data-testid={props.size === 'large' ? 'titel-gross' : 'titel'}>{props.children}</div>,
  IonButtons: (props: StubProps & { slot?: string }) => <div data-testid={`knoepfe-${props.slot}`}>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; 'aria-label'?: string }) =>
    <button type="button" onClick={props.onClick} aria-label={props['aria-label']}>{props.children}</button>,
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

vi.mock('../../components/shared/OrgSwitcherButton', () => ({
  default: () => <span data-testid="gemeinde-umschalter" />,
}));
vi.mock('../../components/shared/PostfachGlocke', () => ({
  default: () => <span data-testid="glocke" />,
}));

import AppKopfzeile, { AppKopfzeileGross } from '../../components/shared/AppKopfzeile';

const lies = (relativ: string) => readFileSync(join(process.cwd(), relativ), 'utf8');

describe('AppKopfzeile', () => {
  it('zeigt Titel, Gemeinde-Umschalter und Glocke -- ohne dass die Seite etwas dazu sagen muss', () => {
    render(<AppKopfzeile titel="Badges" />);
    expect(screen.getByTestId('titel').textContent).toBe('Badges');
    expect(screen.getByTestId('gemeinde-umschalter')).toBeTruthy();
    expect(screen.getByTestId('glocke')).toBeTruthy();
    // Kein Zurueck-Knopf und keine linken Knoepfe -> kein leerer Start-Slot.
    expect(screen.queryByTestId('knoepfe-start')).toBeNull();
  });

  it('beides laesst sich pro Seite abschalten', () => {
    render(<AppKopfzeile titel="Detail" glocke={false} gemeindeUmschalter={false} />);
    expect(screen.queryByTestId('glocke')).toBeNull();
    expect(screen.queryByTestId('gemeinde-umschalter')).toBeNull();
    // Ohne Glocke und ohne rechte Knoepfe auch kein leerer End-Slot.
    expect(screen.queryByTestId('knoepfe-end')).toBeNull();
  });

  it('die Knoepfe der Seite stehen rechts VOR der Glocke', () => {
    render(<AppKopfzeile titel="Mitmachen" rechts={<button type="button" aria-label="QR-Code scannen" />} />);
    const ende = screen.getByTestId('knoepfe-end');
    const kinder = Array.from(ende.children);
    expect(kinder.length).toBe(2);
    expect(kinder[0].getAttribute('aria-label')).toBe('QR-Code scannen');
    expect(kinder[1].getAttribute('data-testid')).toBe('glocke');
  });

  it('der Zurueck-Knopf ruft die uebergebene Funktion', () => {
    const zurueck = vi.fn();
    render(<AppKopfzeile titel="Profil" onZurueck={zurueck} />);
    fireEvent.click(screen.getByLabelText('Zurück'));
    expect(zurueck).toHaveBeenCalledTimes(1);
  });

  it('die grosse Zweitzeile traegt denselben Titel im Condense-Kopf', () => {
    render(<AppKopfzeileGross titel="Challenges" />);
    expect(screen.getByTestId('kopfzeile-gross')).toBeTruthy();
    expect(screen.getByTestId('titel-gross').textContent).toBe('Challenges');
  });
});

describe('Die Konfi-Rolle baut keine eigene Kopfzeile mehr', () => {
  const konfiSeiten = [
    'src/components/konfi/pages/KonfiDashboardPage.tsx',
    'src/components/konfi/pages/KonfiEventsPage.tsx',
    'src/components/konfi/pages/KonfiBadgesPage.tsx',
    'src/components/konfi/pages/KonfiChallengesPage.tsx',
    'src/components/konfi/pages/KonfiProfilePage.tsx',
    'src/components/konfi/views/EventDetailView.tsx',
  ];

  it('alle sechs Konfi-Seiten nutzen AppKopfzeile und AppKopfzeileGross', () => {
    for (const seite of konfiSeiten) {
      const quelle = lies(seite);
      expect(quelle, seite).toContain('<AppKopfzeile');
      expect(quelle, seite).toContain('<AppKopfzeileGross');
      expect(quelle, seite).not.toContain('<IonHeader');
    }
  });

  it('der schwebende Warteschlangen-Knopf bleibt nur fuer Team und Leitung', () => {
    // Die Glocke uebernimmt ihn fuer Konfis; die anderen Rollen behalten ihn,
    // bis ihre Kopfzeilen umgestellt sind (gestufte Umstellung).
    const app = lies('src/App.tsx');
    expect(app).toContain("{user?.type !== 'konfi' && <WartendeVorgaengeLeiste />}");
    expect(app).toContain('<PostfachModal />');
  });
});
