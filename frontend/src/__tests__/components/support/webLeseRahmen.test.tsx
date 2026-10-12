// Der Lese-Rahmen der Web-Fassung (components/support/web/WebLeseRahmen.tsx;
// docs/planung/support-detailseiten.md, F; Simon, 11.10.2026, Fragen 6 und
// 9): „Breit lesen" je Gerät gemerkt -- ohne localStorage lauffähig --,
// Direktlinks mit Liste, voriger und nächster Eintrag, nach einem Abschluss
// der nächste, ?mail= nur für den ersten Eintrag; der Kopf des Lesebereichs
// (WebLesen) und die Leiste zum Blättern nur, wenn breit.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe());

import {
  LESE_RAHMEN_NEUTRAL,
  LeseRahmenProvider,
  SCHLUESSEL_BREIT_LESEN,
  WebLeseNavigation,
  WebLesen,
  type LeseRahmen,
} from '../../../components/support/web/WebLeseRahmen';
import { leseRahmenVon, useBreitLesen, useLeseRahmen } from '../../../components/support/web/leseRahmen';

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/admin/support/vorgaenge/2');
});
afterEach(() => { vi.restoreAllMocks(); });

const rahmen = (teil: Partial<LeseRahmen> = {}): LeseRahmen => ({ ...LESE_RAHMEN_NEUTRAL, ...teil });

describe('useLeseRahmen und leseRahmenVon', () => {
  it('ohne Liste (Provider) gilt der neutrale Rahmen', () => {
    const { result } = renderHook(() => useLeseRahmen());
    expect(result.current).toBe(LESE_RAHMEN_NEUTRAL);
    expect(result.current).toMatchObject({ breit: false, vorheriger: null, naechster: null, hervorheben: null });
  });

  it('voriger und nächster Eintrag um den gewählten; am Rand keiner', () => {
    const teile = { ids: [5, 2, 9], waehlen: vi.fn(), listeLabel: 'Alle Vorgänge', breit: true, setBreit: vi.fn() };
    expect(leseRahmenVon({ ...teile, gewaehlt: 2 })).toMatchObject({ vorheriger: 5, naechster: 9 });
    expect(leseRahmenVon({ ...teile, gewaehlt: 5 })).toMatchObject({ vorheriger: null, naechster: 2 });
    expect(leseRahmenVon({ ...teile, gewaehlt: 9 })).toMatchObject({ vorheriger: 2, naechster: null });
    expect(leseRahmenVon({ ...teile, gewaehlt: null })).toMatchObject({ vorheriger: null, naechster: null });
    expect(leseRahmenVon({ ...teile, gewaehlt: 77 })).toMatchObject({ vorheriger: null, naechster: null });
  });

  it('nach einem Abschluss der Eintrag danach, sonst der davor, sonst keiner (Frage 6)', () => {
    const waehlen = vi.fn();
    const r = leseRahmenVon({ ids: [5, 2, 9], gewaehlt: 2, waehlen, listeLabel: 'Alle Vorgänge', breit: false, setBreit: vi.fn() });
    r.abgeschlossen(2);
    r.abgeschlossen(9);
    leseRahmenVon({ ids: [2], gewaehlt: 2, waehlen, listeLabel: '', breit: false, setBreit: vi.fn() }).abgeschlossen(2);
    expect(waehlen.mock.calls).toEqual([[9], [2], [null]]);
  });

  it('Wählen nimmt ?mail= aus der Adresse -- die übrige Abfrage bleibt', () => {
    window.history.replaceState(null, '', '/admin/support/vorgaenge/2?mail=13&filter=offen');
    const waehlen = vi.fn(() => { expect(window.location.search).toBe('?filter=offen'); });
    leseRahmenVon({ ids: [2, 9], gewaehlt: 2, waehlen, listeLabel: '', breit: false, setBreit: vi.fn(), hervorheben: 13 }).waehlen(9);
    expect(waehlen).toHaveBeenCalledWith(9);
    expect(window.location.pathname).toBe('/admin/support/vorgaenge/2');
  });

  it('blättern wählt den vorigen bzw. nächsten Eintrag; am Rand nichts. Ohne Liste merkt sich nichts einen Fokus', () => {
    const waehlen = vi.fn();
    const r = leseRahmenVon({ ids: [5, 2, 9], gewaehlt: 2, waehlen, listeLabel: '', breit: true, setBreit: vi.fn() });
    r.blaettern('vorher');
    r.blaettern('weiter');
    leseRahmenVon({ ids: [5, 2, 9], gewaehlt: 9, waehlen, listeLabel: '', breit: true, setBreit: vi.fn() }).blaettern('weiter');
    expect(waehlen.mock.calls).toEqual([[5], [9]]);
    expect(r.fokusAbholen()).toBeNull();
    expect(LESE_RAHMEN_NEUTRAL.fokusAbholen()).toBeNull();
  });

  it('„Breit lesen“ umschalten setzt das Gegenteil', () => {
    const setBreit = vi.fn();
    leseRahmenVon({ ids: [], gewaehlt: null, waehlen: vi.fn(), listeLabel: '', breit: true, setBreit }).breitUmschalten();
    expect(setBreit).toHaveBeenCalledWith(false);
  });
});

describe('useBreitLesen: je Gerät gemerkt, ohne Speicher lauffähig', () => {
  it('zuerst mit Liste; die Wahl wird gemerkt und gilt beim nächsten Öffnen', () => {
    const erste = renderHook(() => useBreitLesen({ direktlink: false }));
    expect(erste.result.current[0]).toBe(false);
    act(() => erste.result.current[1](true));
    expect(erste.result.current[0]).toBe(true);
    expect(window.localStorage.getItem(SCHLUESSEL_BREIT_LESEN)).toBe('1');
    const zweite = renderHook(() => useBreitLesen({ direktlink: false }));
    expect(zweite.result.current[0]).toBe(true);
    act(() => zweite.result.current[1](false));
    expect(window.localStorage.getItem(SCHLUESSEL_BREIT_LESEN)).toBe('0');
  });

  it('ein Direktlink öffnet mit Liste -- die gemerkte Wahl bleibt', () => {
    window.localStorage.setItem(SCHLUESSEL_BREIT_LESEN, '1');
    const { result } = renderHook(() => useBreitLesen({ direktlink: true }));
    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(SCHLUESSEL_BREIT_LESEN)).toBe('1');
  });

  it('wirft der Speicher (privates Fenster), gilt „mit Liste“ und der Schalter wirkt trotzdem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt'); });
    const { result } = renderHook(() => useBreitLesen({ direktlink: false }));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});

describe('WebLeseNavigation und WebLesen', () => {
  it('schmal: keine Leiste zum Blättern', () => {
    render(<LeseRahmenProvider wert={rahmen({ breit: false, listeLabel: 'Alle Vorgänge', naechster: 9 })}><WebLeseNavigation /></LeseRahmenProvider>);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('breit: „‹ Alle Vorgänge“ blendet die Liste ein, (‹)(›) blättern zum vorigen bzw. nächsten -- am Rand gesperrt', () => {
    const breitUmschalten = vi.fn();
    const blaettern = vi.fn();
    render(
      <LeseRahmenProvider wert={rahmen({ breit: true, listeLabel: 'Alle Vorgänge', vorheriger: null, naechster: 9, breitUmschalten, blaettern })}>
        <WebLeseNavigation />
      </LeseRahmenProvider>,
    );
    const leiste = screen.getByRole('navigation', { name: 'Blättern' });
    const zurueck = screen.getByRole('button', { name: 'Zurück zu „Alle Vorgänge“' });
    expect(zurueck).toHaveTextContent('Alle Vorgänge');
    expect(leiste).toContainElement(zurueck);
    fireEvent.click(zurueck);
    expect(breitUmschalten).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Voriger Eintrag' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Eintrag' }));
    expect(blaettern).toHaveBeenCalledWith('weiter');
    // Die Pfeiltasten wirken in der Leiste wie in der Liste; der Fokus soll auf dem Knopf bleiben, auf dem er stand.
    fireEvent.keyDown(zurueck, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Nächster Eintrag' }), { key: 'ArrowUp' });
    fireEvent.keyDown(zurueck, { key: 'Enter' });
    expect(blaettern.mock.calls).toEqual([['weiter'], ['weiter', 'zurueck'], ['vorher', 'weiter']]);
  });

  it('WebLesen: ein Artikel mit dem Titel als Name, voller Betreff im Tooltip, Kennzeichen und Aktionen im Kopf, darunter der Inhalt', () => {
    render(
      <WebLesen titel="Konfis sehen den Termin am Samstag nicht" kreis={<span>K</span>} kennzeichen={<span>Nr. 2</span>} aktionen={<button type="button">Antworten</button>}>
        <p>Inhalt</p>
      </WebLesen>,
    );
    const artikel = screen.getByRole('article', { name: 'Konfis sehen den Termin am Samstag nicht' });
    const titel = screen.getByRole('heading', { level: 2, name: 'Konfis sehen den Termin am Samstag nicht' });
    expect(titel).toHaveAttribute('title', 'Konfis sehen den Termin am Samstag nicht');
    const kopf = artikel.querySelector('header.web-lesen__kopf') as HTMLElement;
    expect(kopf).toHaveTextContent('K');
    expect(kopf).toHaveTextContent('Nr. 2');
    expect(kopf).toContainElement(screen.getByRole('button', { name: 'Antworten' }));
    expect(artikel.querySelector('.web-lesen__inhalt')).toHaveTextContent('Inhalt');
    // Ohne Rahmen (schmal) keine Leiste.
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  // Bis 12.10.2026 stand die Leiste im klebenden Kopf des Eintrags und fehlte,
  // solange er lud oder fehlte. Jetzt steht sie über dem Lesebereich
  // (WebPostfach, `leiste`; webBreitLesen.test.tsx) und rollt dort nicht mit.
  it('WebLesen breit: keine eigene Leiste im Kopf -- sie steht über dem Lesebereich', () => {
    render(
      <LeseRahmenProvider wert={rahmen({ breit: true, listeLabel: 'Posteingang' })}>
        <WebLesen titel="Frage">Inhalt</WebLesen>
      </LeseRahmenProvider>,
    );
    expect(document.querySelector('header.web-lesen__kopf')).not.toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('am Ende der Liste wird der Knopf gesperrt, mit dem man geblättert hat: Der Fokus geht auf den der anderen Richtung', () => {
    const Leiste: React.FC<{ naechster: number | null }> = ({ naechster }) => (
      <LeseRahmenProvider wert={rahmen({ breit: true, listeLabel: 'Alle Vorgänge', vorheriger: 2, naechster })}>
        <WebLeseNavigation />
      </LeseRahmenProvider>
    );
    const { rerender } = render(<Leiste naechster={9} />);
    const weiter = screen.getByRole('button', { name: 'Nächster Eintrag' });
    weiter.focus();
    fireEvent.click(weiter);
    // Der Rahmen meldet den letzten Eintrag: „Nächster“ ist gesperrt.
    rerender(<Leiste naechster={null} />);
    expect(weiter).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Voriger Eintrag' }));
  });

  it('wer nach dem Blättern woanders steht, bleibt dort; ohne Blättern rückt der Fokus nicht', () => {
    const Leiste: React.FC<{ naechster: number | null }> = ({ naechster }) => (
      <>
        <input aria-label="Suche" />
        <LeseRahmenProvider wert={rahmen({ breit: true, listeLabel: 'Alle Vorgänge', vorheriger: 2, naechster })}>
          <WebLeseNavigation />
        </LeseRahmenProvider>
      </>
    );
    const { rerender } = render(<Leiste naechster={9} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nächster Eintrag' }));
    screen.getByLabelText('Suche').focus();
    rerender(<Leiste naechster={null} />);
    expect(document.activeElement).toBe(screen.getByLabelText('Suche'));
    // Ohne Blättern über die Leiste (etwa wenn die Liste neu lädt) rückt sie den Fokus nicht.
    rerender(<Leiste naechster={9} />);
    screen.getByRole('button', { name: 'Nächster Eintrag' }).focus();
    rerender(<Leiste naechster={null} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Nächster Eintrag' }));
  });
});
