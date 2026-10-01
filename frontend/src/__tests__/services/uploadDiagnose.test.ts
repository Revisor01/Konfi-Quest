import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wo ein Datei-Upload scheitert (01.10.2026, Android: Word und PDF gingen
// weder in den Chat noch ins Material, am Server kam nichts an). Geprüft: die
// festen Orte, die grobe Ursache, und dass nur Werte aus dem Code hinausgehen.
import { trackFehler, istGueltigeArt, istGueltigerOrt } from '../../services/analytics';
import {
  leseFehlerOrt,
  lesefehlerMelden,
  uploadFehlerMelden,
  warteschlangenFehlerMelden,
} from '../../services/uploadDiagnose';

vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  trackFehler: vi.fn(),
}));

const netzabbruch = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });

beforeEach(() => { vi.mocked(trackFehler).mockClear(); });

describe('leseFehlerOrt: der Name des Browser-Fehlers bestimmt den Ort', () => {
  it.each([
    ['NotReadableError', 'dateiauswahl-nicht-lesbar'],
    ['NotFoundError', 'dateiauswahl-nicht-gefunden'],
    ['SecurityError', 'dateiauswahl-kein-zugriff'],
    ['NotAllowedError', 'dateiauswahl-kein-zugriff'],
    ['AbortError', 'dateiauswahl-lesefehler'],
  ])('%s -> %s', (name, ort) => {
    expect(leseFehlerOrt(new DOMException('x', name))).toBe(ort);
  });

  it('ohne Namen oder ohne Fehlerobjekt: allgemeiner Lesefehler', () => {
    expect(leseFehlerOrt(null)).toBe('dateiauswahl-lesefehler');
    expect(leseFehlerOrt('kaputt')).toBe('dateiauswahl-lesefehler');
    expect(leseFehlerOrt({ name: 'Brief Meier.pdf' })).toBe('dateiauswahl-lesefehler');
  });

  it('jeder Ort hat die erlaubte Form', () => {
    for (const name of ['NotReadableError', 'NotFoundError', 'SecurityError', 'x']) {
      expect(istGueltigerOrt(leseFehlerOrt({ name }))).toBe(true);
    }
    for (const ort of ['chat-datei-direkt', 'chat-datei-sichern', 'chat-datei-warteschlange']) {
      expect(istGueltigerOrt(ort)).toBe(true);
    }
  });
});

describe('Meldungen', () => {
  it('Lesefehler: art intern, Ort nach Fehlername', () => {
    lesefehlerMelden(new DOMException('geaendert', 'NotReadableError'));
    expect(trackFehler).toHaveBeenCalledWith('andere-meldung', 'intern', 'dateiauswahl-nicht-lesbar');
  });

  it('direkter Chat-Versand ohne Antwort: art netz', () => {
    uploadFehlerMelden('chat-datei-direkt', netzabbruch());
    expect(trackFehler).toHaveBeenCalledWith('andere-meldung', 'netz', 'chat-datei-direkt');
  });

  it('direkter Chat-Versand mit Zeitgrenze: art timeout', () => {
    uploadFehlerMelden('chat-datei-direkt', Object.assign(new Error('timeout of 60000ms exceeded'), { code: 'ECONNABORTED' }));
    expect(trackFehler).toHaveBeenCalledWith('andere-meldung', 'timeout', 'chat-datei-direkt');
  });

  it('Sichern für die Warteschlange scheitert am Lesen: art intern', () => {
    uploadFehlerMelden('chat-datei-sichern', new DOMException('geaendert', 'NotReadableError'));
    expect(trackFehler).toHaveBeenCalledWith('andere-meldung', 'intern', 'chat-datei-sichern');
  });

  it.each([
    [0, 'netz'],
    [500, 'http-500'],
    [413, 'http-413'],
  ])('Warteschlange gibt auf mit Status %s -> art %s', (status, art) => {
    warteschlangenFehlerMelden(status);
    expect(trackFehler).toHaveBeenCalledWith('andere-meldung', art, 'chat-datei-warteschlange');
    expect(istGueltigeArt(art)).toBe(true);
  });

  it('nichts aus der Nachricht oder dem Fehlertext geht hinaus', () => {
    uploadFehlerMelden('chat-datei-direkt', Object.assign(new Error('Elternbrief Meier.pdf'), { code: 'ERR_NETWORK' }));
    expect(JSON.stringify(vi.mocked(trackFehler).mock.calls)).not.toContain('Meier');
  });
});
