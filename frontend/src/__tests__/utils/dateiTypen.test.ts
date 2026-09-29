import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { resolve } from 'path';

// Endung -> Typ an EINER Stelle (Simons Befund 29.09.2026, Android-Testbuild
// 128: eine .docx aus Android liess sich im Chat nicht senden). Nennt das
// Gerät keinen Typ, kommt er aus der Endung — nie mehr image/jpeg für ein
// Word-Dokument.

import {
  mimeAusDateiname,
  istAllgemeinerTyp,
  typFuerUpload,
  mitTypAusEndung,
  CHAT_DATEIAUSWAHL,
  CHAT_DATEIENDUNGEN,
} from '../../utils/dateiTypen';
import { mimeAusDateiname as ausDemCache } from '../../services/mediaCache';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('mimeAusDateiname', () => {
  it.each([
    ['Einladung.docx', DOCX],
    ['FOTO.JPG', 'image/jpeg'],
    ['plan.pdf', 'application/pdf'],
    ['vortrag.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['liste.csv', 'text/csv'],
    ['notiz.txt', 'text/plain'],
    ['aufnahme.m4a', 'audio/mp4'],
    ['ohne-endung', 'application/octet-stream'],
    ['programm.exe', 'application/octet-stream'],
    ['', 'application/octet-stream'],
  ])('%s -> %s', (name, typ) => {
    expect(mimeAusDateiname(name)).toBe(typ);
  });

  it('null und undefined -> application/octet-stream', () => {
    expect(mimeAusDateiname(null)).toBe('application/octet-stream');
    expect(mimeAusDateiname(undefined)).toBe('application/octet-stream');
  });

  it('eine Tabelle: der Medien-Cache liefert dieselbe Funktion', () => {
    expect(ausDemCache).toBe(mimeAusDateiname);
  });

  it('eine geerbte Eigenschaft ist keine Endung', () => {
    expect(mimeAusDateiname('x.constructor')).toBe('application/octet-stream');
    expect(mimeAusDateiname('x.__proto__')).toBe('application/octet-stream');
  });
});

describe('Typ fürs Hochladen', () => {
  it('allgemeine Angaben erkennt die App', () => {
    expect(istAllgemeinerTyp('')).toBe(true);
    expect(istAllgemeinerTyp(undefined)).toBe(true);
    expect(istAllgemeinerTyp('application/octet-stream')).toBe(true);
    expect(istAllgemeinerTyp(' Application/Octet-Stream ')).toBe(true);
    expect(istAllgemeinerTyp('binary/octet-stream')).toBe(true);
    expect(istAllgemeinerTyp('image/jpeg')).toBe(false);
  });

  it('ein Typ, der etwas sagt, bleibt; sonst gilt die Endung', () => {
    expect(typFuerUpload('image/png', 'bild.jpg')).toBe('image/png');
    expect(typFuerUpload('', 'Einladung.docx')).toBe(DOCX);
    expect(typFuerUpload(undefined, 'Einladung.docx')).toBe(DOCX);
    expect(typFuerUpload('application/octet-stream', 'Einladung.docx')).toBe(DOCX);
    // Ohne brauchbare Endung KEIN geratener Bildtyp mehr (vorher image/jpeg).
    expect(typFuerUpload('', 'Einladung')).toBe('application/octet-stream');
  });

  it('eine Word-Datei ohne Typ bekommt ihren Typ — Name, Inhalt und Datum bleiben', async () => {
    const ohne = new File(['PK-Inhalt'], 'Einladung.docx', { type: '', lastModified: 1_700_000_000_000 });

    const mit = mitTypAusEndung(ohne);

    expect(mit.type).toBe(DOCX);
    expect(mit.name).toBe('Einladung.docx');
    expect(mit.lastModified).toBe(1_700_000_000_000);
    expect(mit.size).toBe(ohne.size);
    expect(await mit.text()).toBe('PK-Inhalt');
  });

  it('eine Datei mit Typ bleibt dieselbe Datei', () => {
    const pdf = new File(['%PDF'], 'plan.pdf', { type: 'application/pdf' });
    expect(mitTypAusEndung(pdf)).toBe(pdf);
  });

  it('kennt auch die Endung keinen Typ, bleibt die Datei, wie sie ist', () => {
    const unbekannt = new File(['x'], 'setup.exe', { type: '' });
    expect(mitTypAusEndung(unbekannt)).toBe(unbekannt);
  });
});

describe('Die Auswahl im Chat und die Liste des Servers', () => {
  // Der Server ist die Quelle (backend/utils/uploadTypen.js). Die App bietet
  // Fotos und Videos über image/* und video/* an (mit Kamera) und alles
  // andere über die Endungen — genau die, die der Server annimmt.
  const require = createRequire(import.meta.url);
  const server = require(resolve(process.cwd(), '../backend/utils/uploadTypen.js')) as {
    erlaubteEndungen: (route: string) => string[];
    TYP_ZUR_ENDUNG: Record<string, string>;
  };
  const serverEndungen = server.erlaubteEndungen('chat');
  const ohneBildUndVideo = serverEndungen
    .filter((e) => !/^(image|video)\//.test(server.TYP_ZUR_ENDUNG[e]))
    .sort();

  it('jede Endung der Auswahl nimmt der Server an', () => {
    for (const endung of CHAT_DATEIENDUNGEN) expect(serverEndungen).toContain(endung);
  });

  it('jede Nicht-Bild-, Nicht-Video-Endung des Servers steht in der Auswahl', () => {
    expect([...CHAT_DATEIENDUNGEN].sort()).toEqual(ohneBildUndVideo);
  });

  it('die Auswahl selbst: Fotos, Videos und die Endungen', () => {
    expect(CHAT_DATEIAUSWAHL).toBe('image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.mp3,.m4a,.ogg,.wav');
  });

  it('Endung -> Typ stimmt für jede Chat-Endung mit dem Server überein', () => {
    for (const endung of CHAT_DATEIENDUNGEN) {
      expect(`${endung}: ${mimeAusDateiname(`x.${endung}`)}`).toBe(`${endung}: ${server.TYP_ZUR_ENDUNG[endung]}`);
    }
  });
});
