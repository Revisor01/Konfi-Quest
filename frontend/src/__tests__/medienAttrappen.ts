import { vi } from 'vitest';

// Gemeinsame Attrappen für Tests rund um den Medien-Cache.
//
// Ein Dateisystem im Speicher statt Capacitor-Filesystem: Es verhält sich wie
// das Plugin (Base64 rein, Base64 raus, Fehler bei fehlender Datei), damit der
// ECHTE mediaCache laufen kann. Gezählt wird damit, was zählt: wie oft der
// Server gefragt wird und was auf dem Gerät liegt.
//
// Einbinden im Test:
//   vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);
// (Pfad je nach Ordner anpassen). Kein vi.resetModules() in solchen Tests —
// sonst entstünde eine zweite Instanz dieses Moduls und die Zählung liefe ins
// Leere.

export interface GespeicherteDatei {
  data: string;
  size: number;
  mtime: number;
}

/** Alle Dateien, Schlüssel ist der Pfad ("media-cache/chat-ab12"). */
export const dateien = new Map<string, GespeicherteDatei>();

const fehlt = () => Object.assign(new Error('File does not exist.'), { code: 'OS-PLUG-FILE-0008' });

export const Filesystem = {
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async ({ path, data }: { path: string; data: string }) => {
    dateien.set(path, { data, size: Math.floor((data.length * 3) / 4), mtime: Date.now() });
    return { uri: `file:///cache/${path}` };
  }),
  readFile: vi.fn(async ({ path }: { path: string }) => {
    const d = dateien.get(path);
    if (!d) throw fehlt();
    return { data: d.data };
  }),
  stat: vi.fn(async ({ path }: { path: string }) => {
    const d = dateien.get(path);
    if (!d) throw fehlt();
    return { type: 'file', size: d.size, mtime: d.mtime, uri: `file:///cache/${path}` };
  }),
  readdir: vi.fn(async ({ path }: { path: string }) => {
    const praefix = `${path}/`;
    const files = [...dateien.entries()]
      .filter(([p]) => p.startsWith(praefix))
      .map(([p, d]) => ({ name: p.slice(praefix.length), type: 'file', size: d.size, mtime: d.mtime, uri: '' }));
    if (files.length === 0) throw fehlt();
    return { files };
  }),
  deleteFile: vi.fn(async ({ path }: { path: string }) => {
    if (!dateien.delete(path)) throw fehlt();
  }),
  rmdir: vi.fn(async ({ path }: { path: string }) => {
    for (const p of [...dateien.keys()]) {
      if (p.startsWith(`${path}/`)) dateien.delete(p);
    }
  }),
  getUri: vi.fn(async ({ path }: { path: string }) => ({ uri: `file:///cache/${path}` })),
};

export const Directory = { Cache: 'CACHE', Documents: 'DOCUMENTS', Data: 'DATA' };
export const Encoding = { UTF8: 'utf8' };

/** Für vi.mock('@capacitor/filesystem', …). */
export const dateisystemModul = { Filesystem, Directory, Encoding };

/** Die Dateien des Medien-Caches, ohne Verzeichnis-Präfix, sortiert. */
export const cacheInhalt = (): string[] =>
  [...dateien.keys()]
    .filter((p) => p.startsWith('media-cache/'))
    .map((p) => p.slice('media-cache/'.length))
    .sort();

/** Blob -> Text über FileReader (jsdom kennt Blob.text() nicht überall). */
export const blobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });

/**
 * Object-URLs zählbar machen: jsdom hat weder createObjectURL noch
 * revokeObjectURL. Jede URL ist eindeutig, damit sich Freigaben zuordnen
 * lassen.
 */
export const objectUrlAttrappe = () => {
  let zaehler = 0;
  const erzeugt: string[] = [];
  const freigegeben: string[] = [];
  URL.createObjectURL = vi.fn(() => {
    zaehler += 1;
    const url = `blob:attrappe-${zaehler}`;
    erzeugt.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    freigegeben.push(url);
  });
  return { erzeugt, freigegeben };
};

/**
 * Ein Ionic-Knopf nach seiner Beschriftung für Vorlesehilfen. Ionic reicht
 * aria-label beim Einhängen an den Knopf in seinem Schatten-DOM weiter und
 * nimmt es vom äußeren Element — je nach Zeitpunkt (und Last der Maschine)
 * steht es hier oder dort. Ein querySelector allein fand den Knopf deshalb
 * mal, mal nicht.
 */
export const knopf = (container: HTMLElement, beschriftung: string): Element => {
  const aussen = container.querySelector(`[aria-label="${beschriftung}"]`);
  if (aussen) return aussen;
  const innen = [...container.querySelectorAll('ion-button')]
    .find((b) => b.shadowRoot?.querySelector(`[aria-label="${beschriftung}"]`));
  if (!innen) throw new Error(`Knopf "${beschriftung}" nicht gefunden`);
  return innen;
};
