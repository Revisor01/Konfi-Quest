// services/warteschlangenDatei: Eine Datei fuer die Schreib-Warteschlange
// landet in queue-uploads/ im dauerhaften App-Speicher -- und der Ordner wird
// dabei angelegt (Tester-Rueckmeldung Build 130: PDF im Chat ging nicht raus).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dateisystem = vi.hoisted(() => ({ writeFile: vi.fn(async () => ({ uri: 'file:///data/queue-uploads/x' })) }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: dateisystem,
  Directory: { Data: 'DATA', Cache: 'CACHE', Documents: 'DOCUMENTS' },
}));

import { warteschlangenDateiSichern, WARTESCHLANGE_ORDNER } from '../../services/warteschlangenDatei';

beforeEach(() => { dateisystem.writeFile.mockClear(); });

describe('warteschlangenDateiSichern', () => {
  it('schreibt nach queue-uploads/ im App-Speicher und legt den Ordner mit an', async () => {
    await warteschlangenDateiSichern('anhang-1.pdf', 'data:application/pdf;base64,JVBERi0=');
    expect(dateisystem.writeFile).toHaveBeenCalledTimes(1);
    expect(dateisystem.writeFile).toHaveBeenCalledWith({
      path: 'queue-uploads/anhang-1.pdf',
      data: 'data:application/pdf;base64,JVBERi0=',
      directory: 'DATA',
      recursive: true,
    });
  });

  it('gibt den Pfad zurueck, unter dem die Warteschlange die Datei wieder liest', async () => {
    await expect(warteschlangenDateiSichern('foto.jpg', 'QUJD')).resolves.toBe('queue-uploads/foto.jpg');
    expect(WARTESCHLANGE_ORDNER).toBe('queue-uploads');
  });

  it('ein Schreibfehler kommt beim Aufrufer an, statt einen Pfad ins Leere zu liefern', async () => {
    dateisystem.writeFile.mockRejectedValueOnce(new Error('Speicher voll'));
    await expect(warteschlangenDateiSichern('a.pdf', 'QUJD')).rejects.toThrow('Speicher voll');
  });
});
