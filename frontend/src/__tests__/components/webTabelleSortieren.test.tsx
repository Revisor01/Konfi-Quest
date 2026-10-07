// WebTabelle sortiert selbst: eine Spalte mit sortWert hat einen anklickbaren
// Kopf, erst auf-, dann absteigend; aria-sort steht am Kopf.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@ionic/react', () => ({ IonIcon: () => null }));

import WebTabelle, { type WebSpalte } from '../../components/web/WebTabelle';

interface Z { id: number; name: string; punkte: number }
const ZEILEN: Z[] = [{ id: 1, name: 'Ben', punkte: 3 }, { id: 2, name: 'Anna', punkte: 12 }, { id: 3, name: 'Carla', punkte: 7 }];
const SPALTEN: Array<WebSpalte<Z>> = [
  { schluessel: 'name', kopf: 'Name', zelle: (z) => z.name, sortWert: (z) => z.name },
  { schluessel: 'punkte', kopf: 'Punkte', zahl: true, zelle: (z) => z.punkte, sortWert: (z) => z.punkte },
  { schluessel: 'notiz', kopf: 'Notiz', zelle: () => '' },
];
const reihe = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('WebTabelle: nach Spalte sortieren', () => {
  it('bis zum ersten Klick die Reihenfolge der Seite; Klick auf- und absteigend; aria-sort folgt', () => {
    render(<WebTabelle beschriftung="Test" spalten={SPALTEN} zeilen={ZEILEN} zeileSchluessel={(z) => z.id} />);
    expect(reihe()).toEqual(['Ben', 'Anna', 'Carla']);
    const kopfName = screen.getByRole('columnheader', { name: /Name/ });
    expect(kopfName).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(within(kopfName).getByRole('button', { name: /Name/ }));
    expect(reihe()).toEqual(['Anna', 'Ben', 'Carla']);
    expect(kopfName).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(kopfName).getByRole('button', { name: /Name/ }));
    expect(reihe()).toEqual(['Carla', 'Ben', 'Anna']);
    expect(kopfName).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /Punkte/ })).getByRole('button'));
    expect(reihe()).toEqual(['Ben', 'Carla', 'Anna']);
    expect(kopfName).toHaveAttribute('aria-sort', 'none');
  });

  it('eine Spalte ohne sortWert hat keinen Knopf und kein aria-sort', () => {
    render(<WebTabelle beschriftung="Test" spalten={SPALTEN} zeilen={ZEILEN} zeileSchluessel={(z) => z.id} />);
    const notiz = screen.getByRole('columnheader', { name: 'Notiz' });
    expect(within(notiz).queryByRole('button')).toBeNull();
    expect(notiz).not.toHaveAttribute('aria-sort');
  });
});
