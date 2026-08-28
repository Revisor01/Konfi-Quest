// frontend/src/__tests__/components/BadgePopoverContent.test.tsx
//
// Der Abzeichen-Popover lag bis zum 28.08.2026 fuenfmal getrennt im Code, mit
// lauter zufaelligen Unterschieden — und ohne einen einzigen Test. Genau die
// Regression, die beim Zusammenlegen niemand bemerkt haette, ist die
// Maskierung: Das Teamer-Dashboard verbarg nicht erreichte Abzeichen als
// "???", die Konfi-Startseite nicht.
//
// Entscheidung (Simon): Nicht erreichte Abzeichen zeigen ihren Namen — man
// soll sehen, was es zu holen gibt. ECHTE Geheim-Abzeichen (`is_hidden`)
// bleiben unkenntlich, und dafuer sorgt jetzt die Komponente selbst statt
// jeder Aufrufer fuer sich.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: any) => <span data-testid="icon" data-icon={String(props.icon)} />,
}));

vi.mock('../../utils/badgeIcons', () => ({
  getIconFromString: (name?: string) => `icon:${name || 'default'}`,
}));

import BadgePopoverContent, {
  BadgePopoverData,
  getBadgeColor,
} from '../../components/shared/BadgePopoverContent';

const zeige = (daten: BadgePopoverData) =>
  render(<BadgePopoverContent dataRef={{ current: daten } as React.RefObject<BadgePopoverData>} />);

describe('BadgePopoverContent', () => {
  it('zeigt nichts, wenn kein Abzeichen da ist', () => {
    const { container } = zeige({ badge: null });
    expect(container.firstChild).toBeNull();
  });

  it('zeigt ein erreichtes Abzeichen mit Datum', () => {
    zeige({
      badge: { name: 'Fleissige Biene', description: '5 Aktivitäten', is_earned: true, earned_at: '2026-08-24T10:00:00Z' },
    });
    expect(screen.getByText('Fleissige Biene')).toBeTruthy();
    expect(screen.getByText('5 Aktivitäten')).toBeTruthy();
    expect(screen.getByText('Erreicht')).toBeTruthy();
    expect(screen.getByText('24. Aug. 2026')).toBeTruthy();
  });

  it('liest das Datum auch aus awarded_date', () => {
    // Die Teamer-Ansichten fuehren dasselbe Datum unter anderem Namen.
    zeige({ badge: { name: 'Treue Seele', earned: true, awarded_date: '2026-08-24T10:00:00Z' } });
    expect(screen.getByText('24. Aug. 2026')).toBeTruthy();
  });

  it('gilt ohne Statusangabe als erreicht', () => {
    // Zwei Ansichten laden ausschliesslich erreichte Abzeichen und hatten das
    // vorher hart kodiert.
    zeige({ badge: { name: 'Nur Erreichte' } });
    expect(screen.getByText('Erreicht')).toBeTruthy();
  });

  it('zeigt bei einem nicht erreichten Abzeichen den Namen (die Entscheidung)', () => {
    // Der verbotene Fall waere '???' — das Teamer-Dashboard machte das
    // vorher, die Konfi-Startseite nicht.
    zeige({ badge: { name: 'Noch offen', description: 'Mach 10 Sachen' }, isEarned: false });
    expect(screen.getByText('Noch offen')).toBeTruthy();
    expect(screen.getByText('Mach 10 Sachen')).toBeTruthy();
    expect(screen.getByText('Noch nicht erreicht')).toBeTruthy();
    expect(screen.queryByText('???')).toBeNull();
  });

  it('maskiert ein echtes Geheim-Abzeichen, solange es nicht erreicht ist', () => {
    // Die Startseiten filtern diese Abzeichen zwar vorher heraus — aber diese
    // Absicherung lag bisher ALLEIN beim Aufrufer. Eine neue Fundstelle ohne
    // Vorfilterung haette den Namen preisgegeben.
    zeige({ badge: { name: 'Streng geheim', description: 'Verrate ich nicht', is_hidden: true }, isEarned: false });
    expect(screen.getByText('???')).toBeTruthy();
    expect(screen.queryByText('Streng geheim')).toBeNull();
    expect(screen.queryByText('Verrate ich nicht')).toBeNull();
  });

  it('zeigt ein ERREICHTES Geheim-Abzeichen im Klartext', () => {
    // Der erlaubte Fall: Wer es hat, darf wissen, was er hat.
    zeige({ badge: { name: 'Streng geheim', is_hidden: true }, isEarned: true });
    expect(screen.getByText('Streng geheim')).toBeTruthy();
    expect(screen.queryByText('???')).toBeNull();
  });

  it('zeigt den Fortschritt nur, wenn er angefordert wird', () => {
    const badge = { name: 'In Arbeit', progress_percentage: 40, progress_points: 2, criteria_value: 5 };

    zeige({ badge, isEarned: false, showProgress: true });
    expect(screen.getByText('40% - In Arbeit')).toBeTruthy();
    expect(screen.getByText('2 / 5')).toBeTruthy();
  });

  it('laesst den Fortschritt weg, wo die Daten fehlen', () => {
    // Ohne showProgress stuende in den Ansichten, deren Endpunkt die Felder
    // gar nicht liefert, sonst "0 / undefined".
    zeige({
      badge: { name: 'In Arbeit', progress_percentage: 40, progress_points: 2, criteria_value: 5 },
      isEarned: false,
    });
    expect(screen.queryByText('40% - In Arbeit')).toBeNull();
    expect(screen.getByText('Noch nicht erreicht')).toBeTruthy();
  });

  it('erklaert das Zeitfenster bei zeitbasierten Abzeichen', () => {
    zeige({
      badge: { name: 'Letzte Wochen', criteria_type: 'time_based', criteria_extra: '{"days":30}' },
      isEarned: false,
      showProgress: true,
    });
    expect(screen.getByText(/Zählt die letzten 30 Tage/)).toBeTruthy();
  });

  it('erklaert Serien', () => {
    zeige({
      badge: { name: 'Serie', criteria_type: 'streak' },
      isEarned: false,
      showProgress: true,
    });
    expect(screen.getByText(/aufeinanderfolgende Wochen/)).toBeTruthy();
  });

  it('verkraftet unlesbares criteria_extra', () => {
    zeige({
      badge: { name: 'Kaputt', criteria_type: 'time_based', criteria_extra: 'kein json {' },
      isEarned: false,
      showProgress: true,
    });
    // Kein Absturz, nur kein Hinweis.
    expect(screen.getByText('Kaputt')).toBeTruthy();
  });
});

describe('getBadgeColor', () => {
  it('nimmt die eigene Farbe des Abzeichens', () => {
    expect(getBadgeColor({ name: 'x', color: '#123456' })).toBe('#123456');
  });

  it('staffelt Punkte-Abzeichen nach Bronze, Silber, Gold', () => {
    expect(getBadgeColor({ name: 'x', criteria_type: 'total_points', criteria_value: 5 })).toBe('#cd7f32');
    expect(getBadgeColor({ name: 'x', criteria_type: 'total_points', criteria_value: 15 })).toBe('#c0c0c0');
    expect(getBadgeColor({ name: 'x', criteria_type: 'total_points', criteria_value: 16 })).toBe('#ffd700');
  });

  it('faellt sonst auf den Standardton zurueck', () => {
    // Lag vorher viermal im Code, dreimal mit diesem Wert, einmal mit
    // '#f59e0b'. Die Mehrheit gewinnt.
    expect(getBadgeColor({ name: 'x' })).toBe('#667eea');
  });
});
