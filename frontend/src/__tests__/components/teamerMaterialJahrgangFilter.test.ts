import { describe, it, expect } from 'vitest';

// Befund 31.08.2026: Der Jahrgangs-Filter in der Material-Ansicht der
// Teamer:innen lieferte IMMER eine leere Liste.
//
// Ursache: Er filterte clientseitig auf `m.jahrgang_id`
// (TeamerMaterialPage.tsx:115) -- ein Feld, das GET /material gar nicht
// liefert. Die Abfrage (backend/routes/material.js:99-104) waehlt nur
// `jahrgang_count`; die Zuordnung haengt danach als ARRAY `jahrgaenge`
// an jedem Eintrag (material.js:177). `m.jahrgang_id` war also immer
// undefined, der Vergleich immer falsch.
//
// Das Feld stammt aus der Legacy-Spalte `materials.jahrgang_id`, die seit
// Migration 064 (Umstellung auf die M:N-Tabelle material_jahrgaenge) von
// keiner Route mehr gelesen oder geschrieben wird.

type Material = {
  id: number;
  title: string;
  jahrgaenge?: { id: number; name: string }[];
};

const liste: Material[] = [
  { id: 1, title: 'Konfi-Tag Ablauf', jahrgaenge: [{ id: 15, name: '2026/27' }] },
  { id: 2, title: 'Liederheft', jahrgaenge: [{ id: 15, name: '2026/27' }, { id: 16, name: '2027/28' }] },
  { id: 3, title: 'Gottesbilder', jahrgaenge: [] },
  { id: 4, title: 'Nur naechster Jahrgang', jahrgaenge: [{ id: 16, name: '2027/28' }] },
];

// FALSCH (bis 31.08.2026)
const alterFilter = (ms: Material[], jgId: number) =>
  ms.filter(m => (m as unknown as { jahrgang_id?: number }).jahrgang_id === jgId);

// RICHTIG
const filter = (ms: Material[], jgId?: number) =>
  jgId ? ms.filter(m => m.jahrgaenge?.some(j => j.id === jgId)) : ms;

describe('Material der Teamer:innen: Filter nach Jahrgang', () => {
  it('der alte Filter fand NICHTS -- das war der Fehler', () => {
    expect(alterFilter(liste, 15)).toHaveLength(0);
  });

  it('findet Material des gewaehlten Jahrgangs', () => {
    expect(filter(liste, 15).map(m => m.id)).toEqual([1, 2]);
  });

  it('findet Material, das mehreren Jahrgaengen zugeordnet ist', () => {
    expect(filter(liste, 16).map(m => m.id)).toEqual([2, 4]);
  });

  it('blendet Material ohne Jahrgang aus, wenn ein Jahrgang gewaehlt ist', () => {
    // Eintrag 3 ist fuer alle sichtbar, gehoert aber zu keinem Jahrgang.
    expect(filter(liste, 15).some(m => m.id === 3)).toBe(false);
  });

  it('zeigt ohne Auswahl die ganze Liste, auch das Material ohne Jahrgang', () => {
    expect(filter(liste, undefined).map(m => m.id)).toEqual([1, 2, 3, 4]);
  });
});
