import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AudioPlayer from '../../../components/shared/AudioPlayer';

// Der Player für Tonaufnahmen in Challenges (Audit Tests 26.09.2026, BF-10:
// ohne Test). Gerendert; die Wiedergabe selbst stellt jsdom nicht bereit --
// play/pause sind gezählt, Dauer und Position werden am <audio> gesetzt und
// die Ereignisse gefeuert, die der Browser feuern würde.

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
const echtPlay = HTMLMediaElement.prototype.play;
const echtPause = HTMLMediaElement.prototype.pause;

beforeEach(() => {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement['pause'];
});
afterEach(() => {
  HTMLMediaElement.prototype.play = echtPlay;
  HTMLMediaElement.prototype.pause = echtPause;
});

/** Dauer und Position am Element steuerbar machen (jsdom: NaN und 0 fest). */
const steuerbar = (audio: HTMLAudioElement) => {
  let dauer = NaN;
  let position = 0;
  const gesetzt: number[] = [];
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => dauer });
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => position,
    set: (v: number) => { position = v; gesetzt.push(v); },
  });
  return {
    dauer: (d: number) => { dauer = d; },
    position: (p: number) => { position = p; },
    gesetzt,
  };
};

const oeffne = (src = 'blob:aufnahme-1', color?: string) => {
  const r = render(<AudioPlayer src={src} color={color} />);
  const audio = r.container.querySelector('audio') as HTMLAudioElement;
  return { ...r, audio, steuer: steuerbar(audio) };
};
const zeit = (c: HTMLElement) => c.querySelector('span')!.textContent;
const regler = () => screen.getByRole('slider') as HTMLInputElement;

describe('AudioPlayer', () => {
  it('Anfang: "Abspielen", Dauer unbekannt, Regler gesperrt', () => {
    const { container, audio } = oeffne();
    expect(audio.getAttribute('src')).toBe('blob:aufnahme-1');
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
    expect(zeit(container)).toBe('0:00 / -:--');
    expect(regler().disabled).toBe(true);
  });

  it('Antippen spielt ab, der Knopf heißt dann "Pause" und hält an', () => {
    const { audio } = oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.play(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pause).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.pause(audio);
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
  });

  it('eine brauchbare Dauer schaltet den Regler frei und steht als m:ss da', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    expect(zeit(container)).toBe('0:00 / 2:05');
    expect(regler().disabled).toBe(false);
    expect(regler().max).toBe('125');
  });

  it('iOS-Falle: Dauer "Infinity" wird nicht übernommen, es bleibt "-:--"', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(Infinity);
    fireEvent.durationChange(audio);
    expect(zeit(container)).toBe('0:00 / -:--');
    expect(regler().disabled).toBe(true);
  });

  it('iOS-Falle: eine spätere unbrauchbare Dauer (Infinity, NaN, 0) verdrängt die brauchbare nicht', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    for (const unbrauchbar of [Infinity, NaN, 0]) {
      steuer.dauer(unbrauchbar);
      fireEvent.durationChange(audio);
      fireEvent.loadedMetadata(audio);
    }
    expect(zeit(container)).toBe('0:00 / 2:05');
    expect(regler().disabled).toBe(false);
  });

  it('iOS-Falle: bei "Infinity" in den Metadaten ans Ende springen, Dauer lesen, zurück an den Anfang', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(Infinity);
    fireEvent.loadedMetadata(audio);
    expect(steuer.gesetzt).toEqual([1e7]);

    steuer.dauer(42);
    fireEvent.timeUpdate(audio);
    expect(steuer.gesetzt).toEqual([1e7, 0]);
    // Der Sprung zurück löst im Browser ein weiteres timeupdate aus. Der
    // Hilfs-Hörer hat sich da schon abgemeldet und springt nicht noch einmal.
    fireEvent.timeUpdate(audio);
    expect(steuer.gesetzt).toEqual([1e7, 0]);
    expect(zeit(container)).toBe('0:00 / 0:42');
  });

  it('die laufende Position steht links', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    steuer.position(65.4);
    fireEvent.timeUpdate(audio);
    expect(zeit(container)).toBe('1:05 / 2:05');
  });

  it('Ziehen am Regler springt an die Stelle', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    fireEvent.change(regler(), { target: { value: '30' } });
    expect(steuer.gesetzt).toEqual([30]);
    expect(zeit(container)).toBe('0:30 / 2:05');
  });

  it('am Ende: zurück auf Anfang und wieder "Abspielen"', () => {
    const { container, audio, steuer } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    fireEvent.play(audio);
    steuer.position(125);
    fireEvent.timeUpdate(audio);
    fireEvent.ended(audio);
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
    expect(zeit(container)).toBe('0:00 / 2:05');
    expect(steuer.gesetzt).toEqual([0]);
  });

  it('eine neue Aufnahme beginnt von vorn: Dauer unbekannt, nicht am Spielen', () => {
    const { container, audio, steuer, rerender } = oeffne();
    steuer.dauer(125);
    fireEvent.durationChange(audio);
    fireEvent.play(audio);
    steuer.position(20);
    fireEvent.timeUpdate(audio);

    rerender(<AudioPlayer src="blob:aufnahme-2" />);
    expect(zeit(container)).toBe('0:00 / -:--');
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument();
    expect(regler().disabled).toBe(true);
  });

  it('der Knopf trägt die übergebene Farbe, ohne Angabe die Challenge-Farbe', () => {
    const ohne = oeffne();
    expect(screen.getByRole('button', { name: 'Abspielen' }).getAttribute('style')).toContain('background: var(--app-color-challenges)');
    ohne.unmount();
    oeffne('blob:x', 'rgb(1, 2, 3)');
    expect(screen.getByRole('button', { name: 'Abspielen' }).style.background).toBe('rgb(1, 2, 3)');
  });
});
