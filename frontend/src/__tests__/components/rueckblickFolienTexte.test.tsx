// Rueckblick-Folien, die in keinem Test vorkamen (Audit Tests 26.09.2026,
// BF-10: 16 Folien ohne jeden Bezug) -- jetzt gerendert.
//
// Jede Folie waehlt ihren Text nach Schwellen ("Zu zweit." / "Ihr wart ein
// Team."), manche zeigen eine Zahl nur ab einer Grenze. Geprueft wird, was
// dasteht -- nicht die Gestaltung. Eine Folie zeigt ihren Inhalt nur aktiv
// (SlideBase); die Zahlen, die hochzaehlen (useCountUp), laufen mit
// gefaelschter Uhr bis zum Ende.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';

import IntroSlide from '../../components/wrapped/slides/IntroSlide';
import UeberDasZielSlide from '../../components/wrapped/slides/UeberDasZielSlide';
import VielseitigSlide from '../../components/wrapped/slides/VielseitigSlide';
import WartelisteSlide from '../../components/wrapped/slides/WartelisteSlide';
import TeamerAntwortenSlide from '../../components/wrapped/slides/teamer/TeamerAntwortenSlide';
import TeamerBadgesSlide from '../../components/wrapped/slides/teamer/TeamerBadgesSlide';
import TeamerChallengesSlide from '../../components/wrapped/slides/teamer/TeamerChallengesSlide';
import TeamerIntroSlide from '../../components/wrapped/slides/teamer/TeamerIntroSlide';
import TeamerJahreSlide from '../../components/wrapped/slides/teamer/TeamerJahreSlide';
import TeamerKonfiZeitSlide from '../../components/wrapped/slides/teamer/TeamerKonfiZeitSlide';
import TeamerKonfisSlide from '../../components/wrapped/slides/teamer/TeamerKonfisSlide';
import TeamerNeuDabeiSlide from '../../components/wrapped/slides/teamer/TeamerNeuDabeiSlide';
import TeamerSegenAbschlussSlide from '../../components/wrapped/slides/teamer/TeamerSegenAbschlussSlide';
import TeamerSegenSlide from '../../components/wrapped/slides/teamer/TeamerSegenSlide';
import TeamerTeamSlide from '../../components/wrapped/slides/teamer/TeamerTeamSlide';

const nachsatz = (c: HTMLElement) => c.querySelector('.kat-nachsatz')?.textContent;
const slogan = (c: HTMLElement) => Array.from(c.querySelectorAll('.kat-slogan span')).map((s) => s.textContent).join(' ');
const zahl = (c: HTMLElement) => c.querySelector('.kat-zahl')?.textContent ?? null;

afterEach(() => { vi.useRealTimers(); });

/** Aktiv rendern und die Hochzaehl-Animation bis zum Ende laufen lassen. */
async function aktivGerendert(element: React.ReactElement) {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  const r = render(element);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  return r;
}

describe('Konfi-Rueckblick', () => {
  it('Intro: Name, Jahrgang und "(bis jetzt)", solange die Konfirmation mehr als 30 Tage entfernt ist', async () => {
    const { container } = await aktivGerendert(
      <IntroSlide isActive displayName="Kim" jahrgangName="2025/2026" year={2026}
        konfirmation="2027-05-02" stand="2026-09-29" ausgabeTitel="Halbzeit-Rueckblick" />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('DeineKonfi-Zeit(bis jetzt)');
    expect(container.textContent).toContain('Kim');
    expect(container.textContent).toContain('2025/2026');
    expect(container.textContent).toContain('Halbzeit-Rueckblick');
  });

  it('Intro: kurz vor der Konfirmation ohne "(bis jetzt)", der Standardtitel wird nicht wiederholt', async () => {
    const { container } = await aktivGerendert(
      <IntroSlide isActive displayName="Kim" jahrgangName="2025/2026" year={2026}
        konfirmation="2026-10-10" stand="2026-09-29" ausgabeTitel="Konfi-Rückblick 2026" />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('DeineKonfi-Zeit');
    expect(container.textContent).not.toContain('Konfi-Rückblick 2026');
  });

  it('Ueber dem Ziel: der Ueberschuss, nie negativ', async () => {
    const { container } = await aktivGerendert(
      <UeberDasZielSlide isActive endspurt={{ aktiv: false, fehlende_punkte: 0, ziel_total: 20, aktuell_total: 27 }} />,
    );
    expect(container.querySelector('.wrapped-big-number')?.textContent).toBe('+7');
    expect(container.textContent).toContain('Punkte über dem Ziel!');
  });

  it('Vielseitig: Zahl der Arten und ihre Namen', async () => {
    const { container } = await aktivGerendert(<VielseitigSlide isActive medienarten={['text', 'photo', 'audio']} />);
    expect(slogan(container)).toBe('Du hast auf 3 Arten geantwortet.');
    expect(nachsatz(container)).toBe('Text, Foto, Audio');
  });

  it.each([
    [1, null, 'Ein Platz wurde frei — und er war deiner.'],
    [2, '2', 'Beide Male hat es geklappt.'],
    [5, '5', '5 Mal bist du von der Warteliste nachgerückt.'],
  ])('Warteliste: %i Mal nachgerueckt', async (n, erwarteteZahl, text) => {
    const { container } = await aktivGerendert(<WartelisteSlide isActive warteliste={{ nachgerueckt: n }} />);
    expect(zahl(container)).toBe(erwarteteZahl);
    expect(nachsatz(container)).toBe(text);
  });
});

describe('Teamer-Rueckblick', () => {
  it('Intro und Abschluss nennen das Teamerjahr', async () => {
    const intro = await aktivGerendert(<TeamerIntroSlide isActive displayName="Tom" year={2026} />);
    expect(slogan(intro.container)).toBe('Dein Teamerjahr 2026');
    expect(nachsatz(intro.container)).toBe('Tom');
    const ende = await aktivGerendert(<TeamerSegenAbschlussSlide isActive year={2026} />);
    expect(ende.container.querySelector('.kat-auge')?.textContent).toBe('Dein Teamerjahr 2026');
    expect(slogan(ende.container)).toBe('Danke, dass es dich gibt.');
  });

  it.each([
    [3, '3 Mal bist du auf jemanden eingegangen.'],
    [15, '15 Antworten von dir.'],
    [40, '40 Mal hast du reagiert.'],
    [120, '120 Mal hast du geantwortet.'],
  ])('Antworten: %i', async (n, text) => {
    const { container } = await aktivGerendert(<TeamerAntwortenSlide isActive chat={{ antworten: n }} />);
    expect(nachsatz(container)).toBe(text);
  });

  it.each([
    [0, 'Nicht alles bekommt ein Badge.'],
    [1, 'Ein Badge für deinen Einsatz.'],
    [4, '4 Badges hast du bekommen.'],
    [12, '12 Badges für deine Arbeit.'],
  ])('Badges: %i', async (n, text) => {
    const { container } = await aktivGerendert(
      <TeamerBadgesSlide isActive badges={{ total_earned: n, badges: [{ name: 'Treu', icon: 'star', color: '#123456' }] }} />,
    );
    expect(nachsatz(container)).toBe(text);
  });

  it('Challenges: Zahl und die Titel; "Zuletzt", wenn nicht alle gezeigt sind', async () => {
    const alle = await aktivGerendert(<TeamerChallengesSlide isActive gestellt={2} titel={['Foto', 'Lied']} />);
    expect(zahl(alle.container)).toBe('2');
    expect(alle.container.querySelector('.w-merkzettel')?.textContent).toBe('Und zwarFoto · Lied');
    const teil = await aktivGerendert(<TeamerChallengesSlide isActive gestellt={5} titel={['Foto', '']} />);
    expect(teil.container.querySelector('.w-merkzettel')?.textContent).toBe('ZuletztFoto');
    const ohne = await aktivGerendert(<TeamerChallengesSlide isActive gestellt={1} />);
    expect(ohne.container.querySelector('.w-merkzettel')).toBe(null);
  });

  it.each([
    [1, '1 Jahr', 'Dein erstes Jahr im Team.', 'Willkommen im Team — schön, dass du da bist.'],
    [2, '2 Jahre', 'Schon wieder dabei.', '2 Jahre begleitest du jetzt schon Konfis.'],
    [5, '5 Jahre', 'Du gehörst zum Inventar.', '5 Jahre begleitest du jetzt schon Konfis.'],
  ])('Jahre im Team: %i', async (j, z, s, n) => {
    const { container } = await aktivGerendert(<TeamerJahreSlide isActive engagement={{ teamer_seit: '2021-01-01', jahre_aktiv: j }} />);
    expect(zahl(container)).toBe(z);
    expect(slogan(container)).toBe(s);
    expect(nachsatz(container)).toBe(n);
  });

  it('Jahre im Team: ohne Angabe keine Zahl "0 Jahre"', async () => {
    const { container } = await aktivGerendert(<TeamerJahreSlide isActive engagement={{ teamer_seit: null, jahre_aktiv: 0 }} />);
    expect(zahl(container)).toBe(null);
  });

  it('Eigene Konfi-Zeit: mit und ohne Jahrgang', async () => {
    const mit = await aktivGerendert(<TeamerKonfiZeitSlide isActive konfiZeit={{ jahrgang: '2019/2020' }} />);
    expect(nachsatz(mit.container)).toBe('Selbst Konfi im Jahrgang 2019/2020 — heute gestaltest du es mit.');
    const ohne = await aktivGerendert(<TeamerKonfiZeitSlide isActive konfiZeit={{ jahrgang: null }} />);
    expect(nachsatz(ohne.container)).toBe('Selbst Konfi in dieser Gemeinde — heute gestaltest du es mit.');
  });

  it.each([
    [0, 'Das nächste Jahr wartet.', null],
    [1, 'Manchmal ist eine genug.', 'Jahrgang 2025/2026'],
    [3, '3 Konfis — jede einzeln.', 'Jahrgang 2025/2026'],
    [45, '45 Konfis hast du begleitet.', 'Jahrgänge 2025/2026, 2026/2027'],
  ])('Konfis begleitet: %i', async (n, text, jahrgaenge) => {
    const liste = n >= 45 ? ['2025/2026', '2026/2027'] : n > 0 ? ['2025/2026'] : [];
    const { container } = await aktivGerendert(<TeamerKonfisSlide isActive konfis={{ total_konfis: n, jahrgaenge: liste }} />);
    expect(nachsatz(container)).toBe(text);
    if (jahrgaenge) expect(container.textContent).toContain(jahrgaenge);
  });

  it('Neu dabei und Segen', async () => {
    const neu = await aktivGerendert(<TeamerNeuDabeiSlide isActive />);
    expect(nachsatz(neu.container)).toBe('Dein erstes Jahr im Team — und du warst mittendrin.');
    const segen = await aktivGerendert(<TeamerSegenSlide isActive text="Der Herr segne dich" quelle="4. Mose 6,24" />);
    expect(segen.container.querySelector('.teamer-segen-slide__spruch')?.textContent).toBe('„Der Herr segne dich"');
    expect(nachsatz(segen.container)).toBe('4. Mose 6,24');
    const ohneQuelle = await aktivGerendert(<TeamerSegenSlide isActive text="Sei gesegnet" quelle="" />);
    expect(nachsatz(ohneQuelle.container)).toBe(undefined);
  });

  it.each([
    [1, 'Eine andere Person war mit dir da.'],
    [2, '2 andere waren mit dir da.'],
    [5, '5 andere waren mit dir da.'],
    [11, 'Mit 11 anderen zusammen.'],
  ])('Team: %i andere', async (n, text) => {
    const { container } = await aktivGerendert(<TeamerTeamSlide isActive team={{ mitstreitende: n }} />);
    expect(nachsatz(container)).toBe(text);
  });
});
