// Der Verlauf (components/support/MailGespraeche.tsx) -- in App und Web
// derselbe Baustein, seit 11.10.2026 flach (Simon, Frage 2 in
// docs/planung/support-detailseiten.md): das Älteste oben, keine Treppe und
// kein Gesprächstitel; offen sind die jüngste und jede neue Mail, Gelesenes ist
// eine Zeile, ab drei eingeklappten Mails in Folge ein Stapel „N frühere
// Mails"; ausgehend „Support · Konto" mit dem Kreis KQ; der Anfang (Formular
// bzw. Anfrage) mit Marke; ein Menü (···) je offener Mail; `hervorheben`
// (?mail=) klappt auf, rollt in den Blick und markiert zwei Sekunden.
//
// Bis 11.10.2026 prüfte diese Datei die Treppe (Stufen 0 bis 3) und eine
// Gesprächskarte mit dem Betreff der ältesten Mail; beides gibt es nicht mehr.
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import type { MailNachricht } from '../../../types/support';

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe());

import MailGespraeche, { HERVORHEBEN_MS } from '../../../components/support/MailGespraeche';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });
// Die Zeiten der Mails hängen am heutigen Tag („01.10., 12:00" im selben Jahr): heute ist fest.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-11T08:00:00Z') }); });
afterEach(() => { vi.useRealTimers(); });

const FUSS = '\n\n-- \nKonfi Quest · Digitale Konfi-Arbeit';

const mail = (id: number, teil: Partial<MailNachricht> = {}): MailNachricht => ({
  id,
  postfach: 'support',
  richtung: 'ein',
  anfrage_id: null,
  organization_id: null,
  message_id: `<m${id}@x>`,
  in_reply_to: null,
  referenzen: [],
  von_adresse: 'lena@example.org',
  von_name: 'Lena Probe',
  an_adressen: ['support@konfi-quest.de'],
  betreff: 'Re: Push kommt nicht an [Vorgang 1]',
  text: `Text der Mail ${id}`,
  anhaenge: null,
  gesendet_am: `2026-10-0${id}T10:00:00Z`,
  gelesen_am: '2026-10-09T10:00:00Z',
  ...teil,
});

const aus = (id: number, teil: Partial<MailNachricht> = {}): MailNachricht => mail(id, {
  richtung: 'aus', von_adresse: 'support@konfi-quest.de', von_name: 'Konfi Quest', an_adressen: ['lena@example.org'],
  verfasst_von: 9, verfasst_von_name: 'Simon Luthe', ...teil,
});

// 1 Support schreibt, 2 Lena antwortet darauf, 3 Hans antwortet ebenfalls auf 1 (nicht auf 2).
const VERLAUF = [
  aus(1, { text: `Hallo Lena,\n\nprüft bitte die Einstellungen.${FUSS}` }),
  mail(2, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'], text: 'Das war es, danke!\n\nAm 1.10. schrieb Konfi Quest <support@konfi-quest.de>:\n> Hallo Lena' }),
  mail(3, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'], von_name: 'Küster Hans', von_adresse: 'hans@example.org', text: 'Bei mir auch.', anhaenge: [{ name: 'bildschirm.png' }] }),
];

/** Der Kopf einer Mail: der Knopf zum Auf- und Zuklappen, sein Name beginnt mit dem Absender. */
const knopf = (absender: string | RegExp) => screen.getByRole('button', { name: typeof absender === 'string' ? new RegExp(`^${absender}`) : absender });
const zeile = (absender: string | RegExp) => knopf(absender).closest('li') as HTMLElement;
/** Die Zeilen des Verlaufs in der Reihenfolge auf der Seite (Mails, Stapel, Anfang). */
const eintraege = () => [...document.querySelectorAll('ol.mail-verlauf > li')] as HTMLElement[];
const art = (li: HTMLElement) => li.className.split(' ')[0];

describe('MailGespraeche: flach, das Älteste oben', () => {
  it('jede Mail eine Zeile in voller Breite, keine Stufen und kein Gesprächstitel; offen ist die jüngste, die übrigen zeigen eine Zeile Vorschau', () => {
    render(<MailGespraeche mails={[VERLAUF[2], VERLAUF[0], VERLAUF[1]]} />);
    expect(eintraege().map(art)).toEqual(['mail-zeile', 'mail-zeile', 'mail-zeile']);
    expect(eintraege().map((li) => li.dataset.mailId)).toEqual(['1', '2', '3']);
    // Keine Treppe mehr und keine Karte je Gespräch.
    expect(document.querySelector('[class*="tiefe"]')).toBeNull();
    expect(document.querySelector('.mail-gespraech')).toBeNull();
    expect(screen.getAllByRole('region')).toHaveLength(1);

    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'false');
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'false');
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'true');
    // Eingeklappt: eine Zeile ohne Signatur und ohne Zitat.
    expect(knopf('Support')).toHaveTextContent('Hallo Lena, prüft bitte die Einstellungen.');
    expect(knopf('Support')).not.toHaveTextContent('Digitale Konfi-Arbeit');
    expect(knopf('Lena Probe')).toHaveTextContent('Das war es, danke!');
    expect(knopf('Lena Probe')).not.toHaveTextContent('Am 1.10.');
    // Offen: Empfänger, Text, Anhang als Name.
    expect(knopf('Küster Hans')).toHaveTextContent('An support@konfi-quest.de');
    expect(within(zeile('Küster Hans')).getByText('Bei mir auch.')).toBeInTheDocument();
    expect(within(zeile('Küster Hans')).getByRole('list', { name: 'Anhänge' })).toHaveTextContent('bildschirm.png');
    expect(screen.getByText('3 Nachrichten')).toBeInTheDocument();
  });

  it('ausgehend heißt „Support" mit dem Konto klein daneben, Kreis KQ und „Gesendet"; ohne Konto (automatische Bestätigung) nur „Support"', () => {
    render(<MailGespraeche mails={[aus(1, { verfasst_von: null, verfasst_von_name: null }), mail(2), aus(3)]} />);
    const [bestaetigung, eingang, antwort] = eintraege();
    expect(bestaetigung.querySelector('.mail-zeile__absender')).toHaveTextContent('Support');
    expect(bestaetigung.querySelector('.mail-zeile__konto')).toBeNull();
    expect(antwort.querySelector('.mail-zeile__absender')).toHaveTextContent('Support');
    expect(antwort.querySelector('.mail-zeile__konto')).toHaveTextContent('· Simon Luthe');
    expect(antwort.querySelector('.mail-kreis--aus')).toHaveTextContent('KQ');
    expect(within(antwort).getByText('Gesendet')).toBeInTheDocument();
    // „Konfi Quest" (der Absendername des Postfachs) steht nirgends.
    expect(document.body).not.toHaveTextContent('Konfi Quest');
    // Eingehend: Name und Initialen, kein „Gesendet".
    expect(eingang.querySelector('.mail-kreis--aus')).toBeNull();
    expect(eingang.querySelector('.mail-kreis')).toHaveTextContent('LP');
    expect(within(eingang).queryByText('Gesendet')).toBeNull();
  });

  it('Antippen klappt auf und zu; aufgeklappt stehen Signatur und Zitat hinter je einem Knopf', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    fireEvent.click(knopf('Support'));
    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'true');
    const offen = zeile('Support');
    expect(within(offen).getByText('Hallo Lena,\n\nprüft bitte die Einstellungen.', { normalizer: (t) => t })).toBeInTheDocument();
    expect(within(offen).queryByText(/Digitale Konfi-Arbeit/)).toBeNull();
    fireEvent.click(within(offen).getByRole('button', { name: 'Signatur einblenden' }));
    expect(within(offen).getByText(/Digitale Konfi-Arbeit/)).toBeInTheDocument();

    fireEvent.click(knopf('Lena Probe'));
    const antwort = zeile('Lena Probe');
    expect(within(antwort).queryByText(/Am 1\.10\./)).toBeNull();
    fireEvent.click(within(antwort).getByRole('button', { name: 'Zitat einblenden' }));
    expect(within(antwort).getByText(/Am 1\.10\. schrieb/)).toBeInTheDocument();

    fireEvent.click(knopf('Support'));
    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'false');
    // Auch die jüngste lässt sich zuklappen.
    fireEvent.click(knopf('Küster Hans'));
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'false');
  });

  it('neue Mails sind offen und tragen „Neu"; „Alle aufklappen" öffnet den Rest, „Alle einklappen" stellt das Bild beim Öffnen wieder her', () => {
    render(<MailGespraeche mails={VERLAUF} neu={new Set([2])} />);
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
    expect(within(knopf('Lena Probe')).getByText('Neu')).toBeInTheDocument();
    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('3 Nachrichten, 1 neu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Alle einklappen' }));
    expect(['Support', 'Lena Probe', 'Küster Hans'].map((n) => knopf(n).getAttribute('aria-expanded'))).toEqual(['false', 'true', 'true']);
  });

  it('kommt eine Mail dazu (Antwort gesendet), steht sie offen da -- die bisher jüngste und selbst geöffnete bleiben offen', () => {
    const { rerender } = render(<MailGespraeche mails={VERLAUF.slice(0, 2)} />);
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(knopf('Support'));
    rerender(<MailGespraeche mails={VERLAUF} />);
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'true');
    expect(knopf('Support')).toHaveAttribute('aria-expanded', 'true');
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
  });

  it('ohne Mails steht der Leertext', () => {
    render(<MailGespraeche mails={[]} leer="Noch keine Mails in diesem Vorgang." />);
    expect(screen.getByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});

describe('MailGespraeche: Anfang, Stapel, Bezug', () => {
  const ANFANG = { marke: 'Formular' as const, name: 'Pastorin Lena Probe', adresse: 'lena@example.org', datum: '2026-10-01T08:00:00Z', text: 'Push kommt nicht an.\nSeit Montag nicht mehr.' };

  it('der Anfang steht vorn mit der Marke „Formular", offen, solange der Support nicht geantwortet hat -- die automatische Bestätigung zählt nicht', () => {
    render(<MailGespraeche mails={[aus(2, { verfasst_von: null, verfasst_von_name: null, text: 'Euer Anliegen ist angekommen.' })]} anfang={ANFANG} />);
    const vorn = screen.getByRole('region', { name: 'Anliegen aus dem Formular' });
    expect(eintraege()[0]).toContainElement(vorn);
    expect(within(vorn).getByText('Formular')).toBeInTheDocument();
    expect(within(vorn).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(within(vorn).getByText('lena@example.org')).toBeInTheDocument();
    const text = within(vorn).getByText(/Push kommt nicht an\./);
    expect(text).not.toHaveClass('mail-text--kurz');
    expect(within(vorn).queryByRole('button', { name: 'ganz lesen' })).toBeNull();
    expect(screen.getByText('2 Nachrichten')).toBeInTheDocument();
  });

  it('nach der ersten Antwort des Supports: zwei Zeilen und „ganz lesen"; eine Anfrage trägt die Marke „Anfrage"', () => {
    render(<MailGespraeche mails={[aus(2)]} anfang={{ ...ANFANG, marke: 'Anfrage' }} />);
    const vorn = screen.getByRole('region', { name: 'Nachricht aus der Anfrage' });
    expect(within(vorn).getByText('Anfrage')).toBeInTheDocument();
    expect(within(vorn).getByText(/Push kommt nicht an\./)).toHaveClass('mail-text--kurz');
    fireEvent.click(within(vorn).getByRole('button', { name: 'ganz lesen' }));
    expect(within(vorn).getByText(/Push kommt nicht an\./)).not.toHaveClass('mail-text--kurz');
    fireEvent.click(within(vorn).getByRole('button', { name: 'kürzer' }));
    expect(within(vorn).getByText(/Push kommt nicht an\./)).toHaveClass('mail-text--kurz');
  });

  it('ab drei eingeklappten Mails in Folge ein Stapel „N frühere Mails" mit Absendern und Anhängen; Antippen löst ihn auf', () => {
    const mails = [aus(1), mail(2, { anhaenge: [{ name: 'a.pdf' }, { name: 'b.pdf' }] }), aus(3), mail(4)];
    render(<MailGespraeche mails={mails} anfang={ANFANG} />);
    expect(eintraege().map(art)).toEqual(['mail-anfang', 'mail-stapel', 'mail-zeile']);
    const stapel = screen.getByRole('button', { name: /frühere Mails/ });
    expect(stapel).toHaveTextContent('3 frühere Mails · Support, Lena Probe · 2 Anhänge');
    expect(stapel).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(stapel);
    expect(eintraege().map(art)).toEqual(['mail-anfang', 'mail-zeile', 'mail-zeile', 'mail-zeile', 'mail-zeile']);
    expect(eintraege().slice(1).map((li) => li.querySelector('button')!.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true']);
  });

  it('zwei eingeklappte Mails bleiben einzeln; Neues wird nie gestapelt; „Alle aufklappen" öffnet auch den Stapel', () => {
    const { unmount } = render(<MailGespraeche mails={[aus(1), mail(2), aus(3)]} />);
    expect(eintraege().map(art)).toEqual(['mail-zeile', 'mail-zeile', 'mail-zeile']);
    unmount();

    render(<MailGespraeche mails={[aus(1), mail(2), aus(3), mail(4), aus(5)]} neu={new Set([2])} />);
    // 2 ist neu und offen: davor eine Mail, danach zwei -- kein Lauf von drei.
    expect(eintraege().map(art)).toEqual(['mail-zeile', 'mail-zeile', 'mail-zeile', 'mail-zeile', 'mail-zeile']);
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(eintraege().every((li) => li.querySelector('button')!.getAttribute('aria-expanded') === 'true')).toBe(true);
  });

  it('antwortet eine Mail nicht auf die direkt davor, steht „Antwort auf {Name}, {Zeit}" dabei; sonst nicht', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    // 2 antwortet auf 1 (direkt davor), 3 ebenfalls auf 1 -- über 2 hinweg.
    expect(zeile('Lena Probe').querySelector('.mail-zeile__bezug')).toBeNull();
    expect(zeile('Küster Hans').querySelector('.mail-zeile__bezug')).toHaveTextContent('Antwort auf Support, 01.10., 12:00');
  });

  it('kein Betreff, solange der Kern dem Titel entspricht; weicht er ab, „Betreff: …" ohne Vorsilben und Kennung', () => {
    render(<MailGespraeche mails={[mail(1), mail(2, { betreff: 'AW: [Vorgang 1] Re: Andere Frage' })]} titelKern="Push kommt nicht an" />);
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    const [erste, zweite] = eintraege();
    expect(erste.querySelector('.mail-zeile__betreff')).toBeNull();
    expect(zweite.querySelector('.mail-zeile__betreff')).toHaveTextContent('Betreff: Andere Frage');
    expect(document.body).not.toHaveTextContent('[Vorgang 1]');
  });
});

describe('MailGespraeche: Menü, Hervorheben, Antwort', () => {
  it('das Menü (···) steht an jeder offenen Mail, nicht an eingeklappten; es nennt die Aktionen der Seite und „Kopfzeilen zeigen"', () => {
    const verschieben = vi.fn();
    render(<MailGespraeche mails={VERLAUF} menue={(m) => [{ schluessel: 'verschieben', label: 'In anderen Vorgang verschieben', onKlick: () => verschieben(m.id) }]} />);
    expect(within(zeile('Support')).queryByRole('button', { name: /^Aktionen/ })).toBeNull();
    const menueKnopf = within(zeile('Küster Hans')).getByRole('button', { name: 'Aktionen zur Mail von Küster Hans' });
    expect(menueKnopf).toHaveAttribute('aria-haspopup', 'menu');
    expect(menueKnopf).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(menueKnopf);
    expect(menueKnopf).toHaveAttribute('aria-expanded', 'true');
    const menue = screen.getByRole('menu', { name: 'Aktionen zur Mail von Küster Hans' });
    expect(within(menue).getAllByRole('menuitem').map((p) => p.textContent)).toEqual(['In anderen Vorgang verschieben', 'Kopfzeilen zeigen']);
    expect(document.activeElement).toBe(within(menue).getAllByRole('menuitem')[0]);
    fireEvent.click(within(menue).getByRole('menuitem', { name: 'In anderen Vorgang verschieben' }));
    expect(verschieben).toHaveBeenCalledWith(3);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ohne Aktionen der Seite (Posteingang) nur „Kopfzeilen zeigen" -- es zeigt die rohen Kopfzeilen; Escape schließt das Menü', () => {
    render(<MailGespraeche mails={[mail(1, { betreff: 'AW: [Vorgang 1] Re: Push', in_reply_to: '<m0@x>', referenzen: ['<m0@x>'] })]} />);
    const menueKnopf = screen.getByRole('button', { name: 'Aktionen zur Mail von Lena Probe' });
    fireEvent.click(menueKnopf);
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((p) => p.textContent)).toEqual(['Kopfzeilen zeigen']);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(menueKnopf);

    fireEvent.click(menueKnopf);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Kopfzeilen zeigen' }));
    const kopf = document.querySelector('dl.mail-kopfzeilen') as HTMLElement;
    expect([...kopf.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Von', 'An', 'Betreff', 'Datum', 'Message-ID', 'In-Reply-To', 'References']);
    expect(kopf).toHaveTextContent('AW: [Vorgang 1] Re: Push');
    expect(kopf).toHaveTextContent('<m1@x>');
    fireEvent.click(menueKnopf);
    expect(screen.getByRole('menuitem', { name: 'Kopfzeilen ausblenden' })).toBeInTheDocument();
  });

  it('hervorheben (?mail=): die Mail ist offen -- auch aus einem Stapel --, wird in die Mitte gerollt und zwei Sekunden markiert', () => {
    vi.useFakeTimers({ now: new Date('2026-10-11T08:00:00Z') });
    try {
      const gerollt = vi.fn();
      const vorher = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = gerollt;
      try {
        render(<MailGespraeche mails={[aus(1), mail(2), aus(3), mail(4)]} hervorheben={2} />);
        // 1 und 3 bleiben einzeln: Die hervorgehobene 2 trennt sie, ein Stapel entsteht nicht.
        expect(document.querySelector('.mail-stapel')).toBeNull();
        const li = document.querySelector('[data-mail-id="2"]') as HTMLElement;
        expect(li.querySelector('button')).toHaveAttribute('aria-expanded', 'true');
        expect(li).toHaveClass('mail-zeile--hervorgehoben');
        expect(gerollt).toHaveBeenCalledWith({ block: 'center' });
        expect(gerollt.mock.contexts[0]).toBe(li);
        act(() => { vi.advanceTimersByTime(HERVORHEBEN_MS - 1); });
        expect(li).toHaveClass('mail-zeile--hervorgehoben');
        act(() => { vi.advanceTimersByTime(1); });
        expect(li).not.toHaveClass('mail-zeile--hervorgehoben');
        expect(li.querySelector('button')).toHaveAttribute('aria-expanded', 'true');
      } finally {
        Element.prototype.scrollIntoView = vorher;
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('die Antwortzeile steht im Verlauf direkt unter der jüngsten Mail; ohne Mails unter dem Anfang, ohne beides unter dem Leertext', () => {
    const antwort = <button type="button">Antwort schreiben …</button>;
    const { rerender } = render(<MailGespraeche mails={[VERLAUF[2], VERLAUF[0], VERLAUF[1]]} nachJuengster={antwort} />);
    const reihe = eintraege();
    expect(reihe.map(art)).toEqual(['mail-zeile', 'mail-zeile', 'mail-zeile', 'mail-verlauf__nachher']);
    expect(reihe[2].dataset.mailId).toBe('3');
    expect(within(reihe[3]).getByRole('button', { name: 'Antwort schreiben …' })).toBeInTheDocument();

    rerender(<MailGespraeche key="anfang" mails={[]} anfang={{ marke: 'Formular', name: 'Lena Probe', adresse: null, datum: '2026-10-01T08:00:00Z', text: 'Hallo' }} nachJuengster={antwort} />);
    expect(eintraege().map(art)).toEqual(['mail-anfang', 'mail-verlauf__nachher']);

    rerender(<MailGespraeche key="leer" mails={[]} leer="Noch keine Mails." nachJuengster={antwort} />);
    expect(screen.getByText('Noch keine Mails.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Antwort schreiben …' })).toBeInTheDocument();
  });
});
