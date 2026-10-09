// utils/slidingItems: Nach einer Wisch-Aktion schliesst das offene Element --
// und ein Fehler beim Schliessen haelt die Aktion nie auf.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { closeOpenSlidingItems } from '../../utils/slidingItems';

type Gleiter = HTMLElement & { closeOpened?: () => Promise<boolean> };

const gleiter = (klasse: string | null, schliessen?: () => Promise<boolean>): Gleiter => {
  const el = document.createElement('ion-item-sliding') as Gleiter;
  if (klasse) el.classList.add(klasse);
  if (schliessen) el.closeOpened = schliessen;
  document.body.appendChild(el);
  return el;
};

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

describe('closeOpenSlidingItems', () => {
  it('schliesst die nach rechts und nach links offenen Elemente', async () => {
    const ende = vi.fn(async () => true);
    const anfang = vi.fn(async () => true);
    gleiter('item-sliding-active-options-end', ende);
    gleiter('item-sliding-active-options-start', anfang);
    await closeOpenSlidingItems();
    expect(ende).toHaveBeenCalledTimes(1);
    expect(anfang).toHaveBeenCalledTimes(1);
  });

  it('laesst geschlossene Elemente in Ruhe', async () => {
    const zu = vi.fn(async () => true);
    gleiter(null, zu);
    gleiter('item-sliding-active-slide', zu);
    await closeOpenSlidingItems();
    expect(zu).not.toHaveBeenCalled();
  });

  it('nichts offen: kein Fehler', async () => {
    await expect(closeOpenSlidingItems()).resolves.toBeUndefined();
  });

  it('ein scheiterndes Schliessen bricht nicht ab: die anderen schliessen fertig, bevor es weitergeht', async () => {
    const kaputt = vi.fn(async () => { throw new Error('weg'); });
    let heilFertig = false;
    const heil = vi.fn(() => new Promise<boolean>((fertig) => setTimeout(() => { heilFertig = true; fertig(true); }, 20)));
    gleiter('item-sliding-active-options-end', kaputt);
    gleiter('item-sliding-active-options-end', heil);
    await expect(closeOpenSlidingItems()).resolves.toBeUndefined();
    expect(kaputt).toHaveBeenCalledTimes(1);
    expect(heil).toHaveBeenCalledTimes(1);
    expect(heilFertig).toBe(true);
  });

  it('ein Element ohne closeOpened (Ionic noch nicht geladen) stoert nicht', async () => {
    gleiter('item-sliding-active-options-end');
    await expect(closeOpenSlidingItems()).resolves.toBeUndefined();
  });

  it('selbst ein Fehler beim Suchen bleibt im Hilfsmittel', async () => {
    vi.spyOn(document, 'querySelectorAll').mockImplementation(() => { throw new Error('DOM weg'); });
    await expect(closeOpenSlidingItems()).resolves.toBeUndefined();
  });
});
