// Material am Termin: Link-Material zeigt "Link" statt einer Dateizahl
// (31.08.2026, Teil von materialLink.test.tsx; seit 09.10.2026 gerendert --
// die Team-Terminseite ueber ihr Geruest, der Abschnitt der Leitung direkt).
//
// Ohne die Unterscheidung stand bei einem reinen Link "0 Dateien" -- als
// waere das Material leer.
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffneTermin, abschnitt, api,
} from './gerueste/teamerTerminSeite';
import { EventMaterialSection } from '../../components/admin/views/EventDetailSections';
import type { EventMaterial } from '../../types/event';

const MATERIAL = [
  { id: 1, title: 'Packliste', file_count: 2, link_url: null },
  { id: 2, title: 'Gottesbilder', file_count: 0, link_url: 'https://example.org/gottesbilder' },
  { id: 3, title: 'Liedblatt', file_count: 1, link_url: null },
] as unknown as EventMaterial[];

const zeileVonMaterial = (titel: string) => screen.getByText(titel).closest('.app-list-item') as HTMLElement;

beforeEach(zuruecksetzen);

describe('Die Material-Liste am Termin zeigt Link statt Dateizahl', () => {
  it('Team-Terminseite: "Link" beim Link-Material, sonst die Dateizahl', async () => {
    zustand.events = [termin({})];
    const vorher = api.get.getMockImplementation()!;
    api.get.mockImplementation((pfad: string) =>
      pfad.startsWith('/material/by-event/') ? Promise.resolve({ data: MATERIAL }) : vorher(pfad));
    await oeffneTermin();
    await screen.findByText('Gottesbilder');
    expect(abschnitt('Material (3)')).not.toBeNull();
    expect(within(zeileVonMaterial('Gottesbilder')).getByText('Link')).toBeTruthy();
    expect(within(zeileVonMaterial('Gottesbilder')).queryByText(/Datei/)).toBeNull();
    expect(within(zeileVonMaterial('Packliste')).getByText('2 Dateien')).toBeTruthy();
    expect(within(zeileVonMaterial('Packliste')).queryByText('Link')).toBeNull();
    expect(within(zeileVonMaterial('Liedblatt')).getByText('1 Datei')).toBeTruthy();
  });

  it('Termin-Detail der Leitung: dasselbe', () => {
    render(<EventMaterialSection eventMaterials={MATERIAL} onMaterialClick={() => {}} />);
    expect(screen.getByText('Material (3)')).toBeTruthy();
    expect(within(zeileVonMaterial('Gottesbilder')).getByText('Link')).toBeTruthy();
    expect(within(zeileVonMaterial('Gottesbilder')).queryByText(/Datei/)).toBeNull();
    expect(within(zeileVonMaterial('Packliste')).getByText('2 Dateien')).toBeTruthy();
    expect(within(zeileVonMaterial('Liedblatt')).getByText('1 Datei')).toBeTruthy();
    cleanup();
  });
});
