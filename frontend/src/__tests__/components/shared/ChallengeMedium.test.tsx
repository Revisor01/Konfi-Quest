import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { MedienDatei, MedienDateiOptionen } from '../../../hooks/useMedienDatei';

// Foto, Video oder Aufnahme eines Challenge-Beitrags -- EINE Anzeige für die
// Konfi- und die Leitungsansicht (Audit Tests 26.09.2026, BF-10: ohne Test).
//
// Gerendert wird ChallengeMedium selbst samt echtem AudioPlayer und
// MedienPlatzhalter. Nachgestellt sind die Bild- und Video-Anzeige aus dem
// Chat (eigene Tests in medienAnzeigeGemeinsam) und der Lade-Hook: Hier zählt,
// WAS ChallengeMedium ihnen übergibt.

const bildProps = vi.fn();
const videoProps = vi.fn();
vi.mock('../../../components/chat/LazyImage', () => ({
  default: (p: Record<string, unknown> & { onClick?: () => void }) => {
    bildProps(p);
    return <div data-testid="bild" onClick={p.onClick} />;
  },
}));
vi.mock('../../../components/chat/VideoPreview', () => ({
  default: (p: Record<string, unknown>) => { videoProps(p); return <div data-testid="video" />; },
}));

let medien: MedienDatei;
const hookAufrufe: Array<[string | null | undefined, MedienDateiOptionen]> = [];
vi.mock('../../../hooks/useMedienDatei', () => ({
  useMedienDatei: (datei: string | null | undefined, optionen: MedienDateiOptionen) => {
    hookAufrufe.push([datei, optionen]);
    return medien;
  },
}));

import ChallengeMedium from '../../../components/shared/ChallengeMedium';

const erneut = vi.fn();
const stand = (zusatz: Partial<MedienDatei>): MedienDatei => ({
  url: '', zustand: 'laedt', prozent: null, sofortDa: false, laden: vi.fn(), erneutVersuchen: erneut, ...zusatz,
});

beforeEach(() => {
  vi.clearAllMocks();
  hookAufrufe.length = 0;
  medien = stand({});
});

describe('ChallengeMedium: Foto', () => {
  it('lädt über die Challenge-Route, vollbreit, mit Standardhöhe 320', () => {
    render(<ChallengeMedium filePath="ab12" fileName="sonne.jpg" mediaType="photo" />);
    expect(screen.getByTestId('bild')).toBeInTheDocument();
    expect(bildProps).toHaveBeenCalledWith(expect.objectContaining({
      quelle: 'challenges', filePath: 'ab12', fileName: 'sonne.jpg', vollbreite: true, maxHoehe: 320,
    }));
    expect(screen.queryByTestId('video')).toBeNull();
  });

  it('Antippen öffnet das Foto mit Pfad und Namen', () => {
    const onOeffnen = vi.fn();
    render(<ChallengeMedium filePath="ab12" fileName="sonne.jpg" mediaType="photo" maxHoehe={200} onOeffnen={onOeffnen} />);
    expect(bildProps.mock.calls[0][0].maxHoehe).toBe(200);
    fireEvent.click(screen.getByTestId('bild'));
    expect(onOeffnen).toHaveBeenCalledWith('ab12', 'sonne.jpg');
  });

  it('ohne Namen heißt die Datei "Beitrag" -- auch beim Öffnen', () => {
    const onOeffnen = vi.fn();
    render(<ChallengeMedium filePath="ab12" fileName={null} mediaType="photo" onOeffnen={onOeffnen} />);
    expect(bildProps.mock.calls[0][0].fileName).toBe('Beitrag');
    fireEvent.click(screen.getByTestId('bild'));
    expect(onOeffnen).toHaveBeenCalledWith('ab12', 'Beitrag');
  });

  it('ohne onOeffnen ist das Foto nicht antippbar', () => {
    render(<ChallengeMedium filePath="ab12" fileName="sonne.jpg" mediaType="photo" />);
    expect(bildProps.mock.calls[0][0].onClick).toBeUndefined();
  });
});

describe('ChallengeMedium: Video', () => {
  it('lädt über die Challenge-Route und reicht den Originalnamen durch', () => {
    render(<ChallengeMedium filePath="cd34" fileName="clip.mp4" mediaType="video" />);
    expect(screen.getByTestId('video')).toBeInTheDocument();
    expect(videoProps).toHaveBeenCalledWith(expect.objectContaining({
      quelle: 'challenges', filePath: 'cd34', fileName: 'clip.mp4', vollbreite: true,
    }));
    expect(screen.queryByTestId('bild')).toBeNull();
  });
});

describe('ChallengeMedium: Aufnahme', () => {
  it('lädt über die Challenge-Route mit dem Typ aus dem Originalnamen', () => {
    render(<ChallengeMedium filePath="ef56" fileName="stimme.m4a" mediaType="audio" />);
    expect(hookAufrufe[0][0]).toBe('ef56');
    expect(hookAufrufe[0][1].quelle).toBe('challenges');
    expect(hookAufrufe[0][1].typ).toBe('audio/mp4');
  });

  it('solange sie lädt: die Ladeanzeige für "Die Aufnahme", noch kein Player', () => {
    medien = stand({ zustand: 'laedt', prozent: 40 });
    const { container } = render(<ChallengeMedium filePath="ef56" fileName="stimme.m4a" mediaType="audio" />);
    expect(screen.getByText('Wird geladen… 40 %')).toBeInTheDocument();
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Die Aufnahme wird geladen: 40 Prozent');
    expect(container.querySelector('audio')).toBeNull();
  });

  it('Fehler: "Erneut versuchen" startet den zweiten Versuch des Hooks', () => {
    medien = stand({ zustand: 'fehler' });
    const { container } = render(<ChallengeMedium filePath="ef56" fileName="stimme.m4a" mediaType="audio" />);
    expect(screen.getByText('Die Aufnahme konnte nicht geladen werden.')).toBeInTheDocument();
    fireEvent.click(container.querySelector('ion-button')!);
    expect(erneut).toHaveBeenCalledTimes(1);
  });

  it('geladen: der Player spielt die geladene Datei', () => {
    medien = stand({ zustand: 'bereit', url: 'blob:stimme' });
    const { container } = render(<ChallengeMedium filePath="ef56" fileName="stimme.m4a" mediaType="audio" />);
    expect(container.querySelector('audio')!.getAttribute('src')).toBe('blob:stimme');
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
    expect(screen.queryByText(/Wird geladen/)).toBeNull();
  });
});

describe('ChallengeMedium: Beitrag ohne Medium', () => {
  it.each(['text', 'link'] as const)('ein Beitrag vom Typ "%s" zeigt nichts und lädt nichts', (typ) => {
    const { container } = render(<ChallengeMedium filePath="gh78" fileName={null} mediaType={typ} />);
    expect(container.innerHTML).toBe('');
    expect(bildProps).not.toHaveBeenCalled();
    expect(videoProps).not.toHaveBeenCalled();
    expect(hookAufrufe).toHaveLength(0);
  });
});
