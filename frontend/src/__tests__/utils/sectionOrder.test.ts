// utils/sectionOrder: Eine gespeicherte Reihenfolge der Startseite bleibt,
// eine neu dazugekommene Sektion erscheint trotzdem -- an ihrer Standardstelle.
import { describe, it, expect } from 'vitest';
import { mergeSectionOrder, DEFAULT_KONFI_SECTION_ORDER, DEFAULT_TEAMER_SECTION_ORDER } from '../../utils/sectionOrder';

describe('mergeSectionOrder', () => {
  const standard = ['a', 'b', 'c', 'd'];

  it('ohne gespeicherte Liste gilt der Standard (als Kopie)', () => {
    expect(mergeSectionOrder(null, standard)).toEqual(standard);
    expect(mergeSectionOrder(undefined, standard)).toEqual(standard);
    expect(mergeSectionOrder([], standard)).toEqual(standard);
    expect(mergeSectionOrder(null, standard)).not.toBe(standard);
  });

  it('die gespeicherte Sortierung bleibt erhalten', () => {
    expect(mergeSectionOrder(['d', 'c', 'b', 'a'], standard)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('eine neue Sektion steht hinter ihrem letzten gespeicherten Vorgaenger', () => {
    expect(mergeSectionOrder(['d', 'b', 'a'], standard)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('ohne gespeicherten Vorgaenger kommt sie nach vorn', () => {
    expect(mergeSectionOrder(['c', 'd'], ['neu', 'c', 'd'])).toEqual(['neu', 'c', 'd']);
  });

  it('mehrere neue Sektionen behalten untereinander die Standardfolge', () => {
    expect(mergeSectionOrder(['a'], standard)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('entfernte Sektionen werden durchgereicht, Nicht-Texte verworfen', () => {
    expect(mergeSectionOrder(['alt', 'a', 7 as unknown as string, 'b', 'c', 'd'], standard)).toEqual(['alt', 'a', 'b', 'c', 'd']);
  });

  it('veraendert die gespeicherte Liste nicht', () => {
    const gespeichert = ['b'];
    mergeSectionOrder(gespeichert, standard);
    expect(gespeichert).toEqual(['b']);
  });

  it('eine Bestands-Gemeinde ohne Konfirmation in der Liste bekommt sie zu sehen', () => {
    const alt = ['challenges', 'konfispruch', 'events', 'losung', 'badges', 'ranking'];
    expect(mergeSectionOrder(alt, DEFAULT_KONFI_SECTION_ORDER)).toEqual(DEFAULT_KONFI_SECTION_ORDER);
  });

  it('die Standardfolgen der Konfi- und der Team-Startseite', () => {
    expect(DEFAULT_KONFI_SECTION_ORDER).toEqual(['konfirmation', 'challenges', 'konfispruch', 'events', 'losung', 'badges', 'ranking']);
    expect(DEFAULT_TEAMER_SECTION_ORDER).toEqual(['zertifikate', 'challenges', 'konfispruch', 'events', 'badges', 'losung']);
  });
});
