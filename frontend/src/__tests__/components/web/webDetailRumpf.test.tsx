// Der Rumpf jeder Detailseite der Web-Fassung (components/web/WebDetailRumpf.tsx,
// 11.10.2026 aus WebDetailSeite herausgelöst): Hinweis, Kennzahlen über beide
// Spalten, links das Eigentliche, rechts die Angaben-Karte und was zu ihr
// gehört. WebDetailSeite setzt ihn unter ihren Kopf, der Lesebereich des
// Supports (WebVorgangDetail) unter seinen -- derselbe Code, dasselbe Gerüst.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));

import WebDetailRumpf, { type WebDetailRumpfProps } from '../../../components/web/WebDetailRumpf';
import WebDetailSeite from '../../../components/web/WebDetailSeite';

const INHALT: WebDetailRumpfProps = {
  hinweis: <p role="status">Abgesagt am 02.10.2026</p>,
  kennzahlen: [{ label: 'Mails', wert: '3' }, { label: 'Neu', wert: '1' }, { label: 'Tage offen', wert: '2' }],
  haupt: <section aria-label="Verlauf">Verlauf</section>,
  angaben: [{ label: 'Jahrgang', wert: '2026' }, { label: 'Ort', wert: '' }],
  angabenBeschriftung: 'Angaben zum Vorgang',
  angabenVorspann: <p>Offline nicht aktuell</p>,
  seite: <section aria-label="Gemeinde">Gemeinde-Karte</section>,
};

/** Die Kennungen aus useId unterscheiden sich je Rendern -- für den Vergleich gleich machen. */
const ohneKennungen = (html: string) => html.replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:/g, 'ID');

describe('WebDetailRumpf', () => {
  it('Reihenfolge: Hinweis, Kennzahlen über beide Spalten, dann die Spalten', () => {
    const { container } = render(<WebDetailRumpf {...INHALT} />);
    const rumpf = container.firstElementChild as HTMLElement;
    expect(rumpf.className).toBe('web-detail');
    const [hinweis, kennzahlen, spalten] = [...rumpf.children] as HTMLElement[];
    expect(hinweis).toHaveTextContent('Abgesagt am 02.10.2026');
    expect(kennzahlen.className).toBe('web-raster web-raster--kacheln web-detail__kennzahlen');
    expect([...kennzahlen.children].map((k) => k.textContent)).toEqual(['Mails3', 'Neu1', 'Tage offen2']);
    expect(spalten.className).toContain('web-spalten');
    expect(rumpf.children).toHaveLength(3);
  });

  it('links das Eigentliche, rechts zuerst die Angaben-Karte mit Vorspann, dann die übrige Seite', () => {
    render(<WebDetailRumpf {...INHALT} />);
    expect(screen.getByRole('region', { name: 'Verlauf' }).closest('.web-spalten__haupt')).not.toBeNull();
    const spalte = screen.getByRole('complementary', { name: 'Angaben' });
    const [angaben, gemeinde] = [...spalte.children] as HTMLElement[];
    expect(within(angaben).getByRole('heading', { level: 2 }).textContent).toBe('Angaben');
    expect(angaben).toHaveTextContent('Offline nicht aktuell');
    const liste = within(angaben).getByLabelText('Angaben zum Vorgang');
    expect([...liste.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['2026', '–']);
    expect(gemeinde).toHaveTextContent('Gemeinde-Karte');
    expect(spalte.children).toHaveLength(2);
  });

  it('ohne Kennzahlen kein Raster, ohne Angaben nur die übrige Seite; die Spalte lässt sich anders benennen', () => {
    const { container } = render(<WebDetailRumpf haupt={<p>Haupt</p>} seite={<p>Karten</p>} seiteBeschriftung="Angaben zum Vorgang" />);
    expect(container.querySelector('.web-detail__kennzahlen')).toBeNull();
    const spalte = screen.getByRole('complementary', { name: 'Angaben zum Vorgang' });
    expect(spalte.textContent).toBe('Karten');
  });

  it('WebDetailSeite rendert ihren Rumpf mit WebDetailRumpf -- Zeichen für Zeichen derselbe', () => {
    const rumpf = render(<WebDetailRumpf {...INHALT} />);
    const allein = ohneKennungen((rumpf.container.querySelector('.web-detail') as HTMLElement).outerHTML);
    rumpf.unmount();
    const seite = render(<WebDetailSeite bereich="Support" titel="Vorgang" zurueck={{ href: '/admin/support/vorgaenge', text: 'Alle Vorgänge' }} {...INHALT} />);
    const inDerSeite = ohneKennungen((seite.container.querySelector('.web-detail') as HTMLElement).outerHTML);
    expect(inDerSeite).toBe(allein);
    expect(seite.container.querySelectorAll('.web-detail')).toHaveLength(1);
  });
});
