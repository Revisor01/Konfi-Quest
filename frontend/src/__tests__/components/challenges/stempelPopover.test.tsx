// frontend/src/__tests__/components/challenges/stempelPopover.test.tsx
//
// Simon, 14.09.2026: "Und wenn man auf einen Stempel klickt, wäre auch das
// eine Popover-Info gut. Wann erhalten, welche Challenge, etc. ... Und wie
// wollen sich die zeigen, die man nicht bekommen hat, in grau."
//
// Zwei Dinge sind hier zu halten:
//  1. Der Popover zeigt beim erhaltenen Stempel ein Datum und den
//     Challenge-Titel, beim offenen stattdessen einen brauchbaren Satz.
//  2. Die offenen Stempel landen als GESPERRTE Kacheln im Raster — derselbe
//     Weg, den die Abzeichen gehen (.app-kachel--gesperrt).
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: { icon?: unknown }) => <span data-testid="icon" data-icon={String(props.icon)} />,
}));

vi.mock('../../../utils/badgeIcons', () => ({
  getIconFromString: (name?: string) => `icon:${name || 'default'}`,
}));

import StempelPopoverContent, {
  StempelPopoverData,
  offenerHinweis,
} from '../../../components/shared/StempelPopoverContent';
import type { ChallengeMark, OffenerStempel } from '../../../types/challenges';

const ERHALTEN: ChallengeMark = {
  challenge_id: 7,
  badge_icon: 'star',
  badge_name: 'Nachtwanderer',
  title: 'Geh nachts raus',
  description: 'Mach ein Foto vom Nachthimmel.',
  earned_at: '2026-03-04T19:30:00.000Z',
};

const OFFEN_LAEUFT: OffenerStempel = {
  challenge_id: 9,
  badge_icon: 'heart',
  badge_name: 'Zuhörer',
  title: 'Hör jemandem zu',
  description: 'Nimm dir Zeit für einen Menschen.',
  status: 'active',
  ends_at: '2026-12-01T00:00:00.000Z',
};

const OFFEN_VORBEI: OffenerStempel = { ...OFFEN_LAEUFT, challenge_id: 11, status: 'ended' };

const zeige = (daten: StempelPopoverData) =>
  render(<StempelPopoverContent dataRef={{ current: daten } as React.RefObject<StempelPopoverData>} />);

describe('Stempel-Popover', () => {
  it('zeigt nichts, wenn kein Stempel da ist', () => {
    const { container } = zeige({ stempel: null, erhalten: true });
    expect(container.firstChild).toBeNull();
  });

  it('erhaltener Stempel: Name, Challenge-Titel, Beschreibung und Datum', () => {
    zeige({ stempel: ERHALTEN, erhalten: true });
    expect(screen.getByText('Nachtwanderer')).toBeInTheDocument();
    // "welche Challenge" war die ausdrueckliche Frage — der Stempelname
    // allein beantwortet sie nicht.
    expect(screen.getByText('Geh nachts raus')).toBeInTheDocument();
    expect(screen.getByText('Mach ein Foto vom Nachthimmel.')).toBeInTheDocument();
    expect(screen.getByText('Erhalten')).toBeInTheDocument();
    // Dasselbe Datumsformat wie im Abzeichen-Popover.
    expect(screen.getByText('4. März 2026')).toBeInTheDocument();
  });

  it('erhaltener Stempel ohne Datum zeigt trotzdem den Rest', () => {
    // Aeltere Server liefern earned_at nicht. Der Popover darf davon nicht
    // leer werden.
    zeige({ stempel: { ...ERHALTEN, earned_at: null }, erhalten: true });
    expect(screen.getByText('Nachtwanderer')).toBeInTheDocument();
    expect(screen.getByText('Erhalten')).toBeInTheDocument();
    expect(screen.queryByText('4. März 2026')).toBeNull();
  });

  it('offener Stempel einer laufenden Challenge sagt, wie man ihn bekommt', () => {
    zeige({ stempel: OFFEN_LAEUFT, erhalten: false });
    expect(screen.getByText('Noch nicht erhalten')).toBeInTheDocument();
    expect(screen.getByText('Mach bei dieser Challenge mit, dann gehört dir der Stempel.'))
      .toBeInTheDocument();
    // GEGENPROBE: kein "Erhalten"-Chip und kein Datum.
    expect(screen.queryByText('Erhalten')).toBeNull();
    expect(screen.queryByText('4. März 2026')).toBeNull();
  });

  it('offener Stempel einer abgelaufenen Challenge sagt, dass sie vorbei ist', () => {
    zeige({ stempel: OFFEN_VORBEI, erhalten: false });
    expect(screen.getByText('Diese Challenge ist vorbei. Den Stempel gibt es dafür nicht mehr.'))
      .toBeInTheDocument();
    // GEGENPROBE: nicht der Mitmach-Satz.
    expect(screen.queryByText('Mach bei dieser Challenge mit, dann gehört dir der Stempel.'))
      .toBeNull();
  });

  it('der Name eines offenen Stempels bleibt lesbar — kein "???"', () => {
    // Anders als bei Geheim-Abzeichen: man soll sehen, was es zu holen gibt.
    zeige({ stempel: OFFEN_LAEUFT, erhalten: false });
    expect(screen.getByText('Zuhörer')).toBeInTheDocument();
    expect(screen.queryByText('???')).toBeNull();
  });

  it('offenerHinweis unterscheidet die beiden Faelle', () => {
    expect(offenerHinweis(OFFEN_VORBEI)).toContain('vorbei');
    expect(offenerHinweis(OFFEN_LAEUFT)).toContain('Mach bei dieser Challenge mit');
    // GEGENPROBE: ohne status gilt der Mitmach-Satz, nicht der Vorbei-Satz.
    expect(offenerHinweis({ ...OFFEN_LAEUFT, status: undefined })).toContain('Mach bei dieser');
  });
});
