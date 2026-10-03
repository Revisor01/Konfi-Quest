// Was eine Nachricht zeigt, unabhaengig davon, wie sie gezeichnet wird
// (components/chat/chatNachricht.tsx): Umfrage-Stand, Ablauf, Reaktionen,
// Fortsetzung desselben Absenders, Links im Text, Vorschau der Antwort.
// Die Blase der App und die der Web-Fassung lesen dieselben Funktionen.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Message, Reaction } from '../../../types/chat';

const linkOeffnen = vi.fn();
vi.mock('../../../services/systemDialoge', () => ({ linkOeffnen: (url: string) => linkOeffnen(url) }));

import {
  antwortVorschau,
  istBildDatei,
  istVideoDatei,
  linkifyText,
  nachrichtZeit,
  reaktionenGruppieren,
  setztFort,
  umfrageAblauf,
  umfrageArt,
  umfrageOptionen,
} from '../../../components/chat/chatNachricht';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const nachricht = (id: number, zusatz: Partial<Message> = {}): Message => ({
  id, content: `Nachricht ${id}`, sender_id: 2, sender_name: 'Kim', sender_type: 'konfi',
  created_at: '2026-10-03T08:00:00.000Z', message_type: 'text', ...zusatz,
});

describe('Umfrage: Stand je Antwort', () => {
  const umfrage = nachricht(5, {
    message_type: 'poll', question: 'Welcher Termin?', options: ['Dienstag', 'Donnerstag', 'Samstag'],
    votes: [
      { user_id: 21, user_type: 'konfi', option_index: 0, user_name: 'Lena' },
      { user_id: 22, user_type: 'konfi', option_index: 1, user_name: 'Kim' },
      { user_id: 23, user_type: 'konfi', option_index: 1, user_name: 'Jules' },
      { user_id: 5, user_type: 'konfi', option_index: 1, user_name: 'Mika' },
    ],
    anonymous: false,
  });

  it('Stimmen, Anteil und die eigene Wahl', () => {
    const optionen = umfrageOptionen(umfrage, { id: 5, type: 'konfi' });
    expect(optionen.map((o) => [o.text, o.stimmen, o.prozent, o.gewaehlt])).toEqual([
      ['Dienstag', 1, 25, false],
      ['Donnerstag', 3, 75, true],
      ['Samstag', 0, 0, false],
    ]);
    // Dieselbe Kennung mit anderem Typ ist eine andere Person (Konfi 5 und Teamer 5).
    expect(umfrageOptionen(umfrage, { id: 5, type: 'teamer' }).some((o) => o.gewaehlt)).toBe(false);
    expect(umfrageOptionen(umfrage, null).some((o) => o.gewaehlt)).toBe(false);
  });

  it('die Namen der Waehlenden stehen nur bei einer Umfrage mit Namen', () => {
    expect(umfrageOptionen(umfrage, null)[1].namen).toEqual(['Kim', 'Jules', 'Mika']);
    expect(umfrageOptionen({ ...umfrage, anonymous: true }, null)[1].namen).toEqual([]);
  });

  it('Exklusiv-Wahl: eine vergebene Antwort ist fuer alle ausser der Waehlenden gesperrt', () => {
    const exklusiv = { ...umfrage, exclusive_options: true, votes: [{ user_id: 21, user_type: 'konfi' as const, option_index: 0 }] };
    expect(umfrageOptionen(exklusiv, { id: 5, type: 'konfi' }).map((o) => o.vergebenAnAndere)).toEqual([true, false, false]);
    expect(umfrageOptionen(exklusiv, { id: 21, type: 'konfi' }).map((o) => o.vergebenAnAndere)).toEqual([false, false, false]);
    // Ohne Exklusiv-Wahl sperrt nichts.
    expect(umfrageOptionen(umfrage, { id: 5, type: 'konfi' }).some((o) => o.vergebenAnAndere)).toBe(false);
  });

  it('ohne Stimmen: null Prozent, keine Teilung durch null', () => {
    const leer = umfrageOptionen({ ...umfrage, votes: [] }, null);
    expect(leer.map((o) => o.prozent)).toEqual([0, 0, 0]);
    expect(umfrageOptionen({ ...umfrage, votes: undefined }, null).map((o) => o.stimmen)).toEqual([0, 0, 0]);
    expect(umfrageOptionen(nachricht(6), null)).toEqual([]);
  });

  it('die Art in einem Wort', () => {
    expect(umfrageArt(umfrage)).toBe('Einzelauswahl');
    expect(umfrageArt({ ...umfrage, multiple_choice: true })).toBe('Mehrfachauswahl');
    expect(umfrageArt({ ...umfrage, multiple_choice: true, exclusive_options: true })).toBe('Exklusiv-Wahl');
  });
});

describe('Umfrage: Ablauf', () => {
  const jetzt = new Date('2026-10-03T10:00:00+02:00');

  it('ohne Ende: nichts; abgelaufen: Beendet', () => {
    expect(umfrageAblauf(undefined, jetzt)).toBeNull();
    expect(umfrageAblauf('2026-10-03T09:59:00+02:00', jetzt)).toEqual({ beendet: true, text: 'Beendet' });
  });

  it('unter 24 Stunden mit Restzeit, darueber nur das Ende', () => {
    expect(umfrageAblauf('2026-10-03T12:30:00+02:00', jetzt)).toEqual({ beendet: false, text: 'Endet: 03.10., 12:30 (2h 30min)' });
    expect(umfrageAblauf('2026-10-03T10:20:00+02:00', jetzt)).toEqual({ beendet: false, text: 'Endet: 03.10., 10:20 (20min)' });
    expect(umfrageAblauf('2026-10-05T18:00:00+02:00', jetzt)).toEqual({ beendet: false, text: 'Endet: 05.10., 18:00' });
  });
});

describe('Reaktionen und Fortsetzung', () => {
  const r = (id: number, emoji: string, user: number): Reaction => ({ id, emoji, user_id: user, user_type: 'konfi', user_name: `Person ${user}` });

  it('Reaktionen nach Emoji gruppiert, in der Reihenfolge des ersten Auftretens', () => {
    const gruppen = reaktionenGruppieren([r(1, 'heart', 1), r(2, 'like', 2), r(3, 'heart', 3)]);
    expect(gruppen.map(([emoji, liste]) => [emoji, liste.map((x) => x.user_id)])).toEqual([['heart', [1, 3]], ['like', [2]]]);
    expect(reaktionenGruppieren(undefined)).toEqual([]);
  });

  it('dieselbe Person am selben Tag innerhalb von fuenf Minuten setzt fort -- sonst nicht', () => {
    const erste = nachricht(1, { created_at: '2026-10-03T08:00:00Z' });
    expect(setztFort(erste, nachricht(2, { created_at: '2026-10-03T08:04:59Z' }))).toBe(true);
    expect(setztFort(erste, nachricht(2, { created_at: '2026-10-03T08:05:00Z' }))).toBe(false);
    expect(setztFort(erste, nachricht(2, { sender_id: 3, created_at: '2026-10-03T08:01:00Z' }))).toBe(false);
    expect(setztFort(erste, nachricht(2, { sender_type: 'teamer', created_at: '2026-10-03T08:01:00Z' }))).toBe(false);
    expect(setztFort(undefined, erste)).toBe(false);
  });

  it('ueber Mitternacht (Berlin) oder nach einer geloeschten Nachricht beginnt wieder mit Namen', () => {
    // 21:58 UTC am 03.10. ist 23:58 in Berlin, 22:02 UTC schon 00:02 am 04.10.
    const spaet = nachricht(1, { created_at: '2026-10-03T21:58:00Z' });
    expect(setztFort(spaet, nachricht(2, { created_at: '2026-10-03T22:02:00Z' }))).toBe(false);
    expect(setztFort(nachricht(1, { deleted: true }), nachricht(2, { created_at: '2026-10-03T08:01:00Z' }))).toBe(false);
    expect(setztFort(erste(), nachricht(2, { deleted: true, created_at: '2026-10-03T08:01:00Z' }))).toBe(false);
    function erste() { return nachricht(1, { created_at: '2026-10-03T08:00:00Z' }); }
  });
});

describe('Vorschau, Dateiart und Zeit', () => {
  it('die Antwortzeile nennt bei Medien den Dateinamen, bei Umfragen "Umfrage", sonst den Text', () => {
    expect(antwortVorschau('text', undefined, 'Bis morgen')).toBe('Bis morgen');
    expect(antwortVorschau('image', 'foto.png', 'Unterschrift')).toBe('foto.png');
    expect(antwortVorschau('video', undefined, undefined)).toBe('Medieninhalt');
    expect(antwortVorschau('file', 'Plan.pdf', undefined)).toBe('Plan.pdf');
    expect(antwortVorschau('file', undefined, undefined)).toBe('Datei');
    expect(antwortVorschau('poll', undefined, 'egal')).toBe('Umfrage');
    expect(antwortVorschau(undefined, undefined, undefined)).toBe('');
  });

  it('Bild und Video erkennt man an der Endung, unabhaengig von der Schreibweise', () => {
    expect(['a.JPG', 'b.png', 'c.webp', 'd.gif', 'e.jpeg'].map(istBildDatei)).toEqual([true, true, true, true, true]);
    expect(['a.pdf', 'b.png.txt', undefined, null, ''].map(istBildDatei)).toEqual([false, false, false, false, false]);
    expect(['a.MP4', 'b.mov', 'c.webm', 'd.m4v', 'e.avi'].map(istVideoDatei)).toEqual([true, true, true, true, true]);
    expect(['a.pdf', 'b.mp3', undefined].map(istVideoDatei)).toEqual([false, false, false]);
  });

  it('heute die Uhrzeit, sonst Datum ohne Jahr und Uhrzeit', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    try {
      expect(nachrichtZeit('2026-10-03T08:10:00Z')).toBe('10:10');
      expect(nachrichtZeit('2026-09-30T17:05:00Z')).toBe('30.09., 19:05');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Links im Text', () => {
  const zeige = (text: string, link?: Parameters<typeof linkifyText>[1]) => render(<p>{linkifyText(text, link)}</p>);

  it('http, https und www. werden zu Links; Satzzeichen am Ende gehoeren nicht dazu', () => {
    zeige('Siehe https://example.org/konfi-tag, oder www.example.org.');
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.org/konfi-tag', 'https://www.example.org']);
    expect(links.map((a) => a.textContent)).toEqual(['https://example.org/konfi-tag', 'www.example.org']);
  });

  it('ein Klick oeffnet ausserhalb der App und bleibt in der Blase stecken (kein Auswahlklick)', () => {
    const aussen = vi.fn();
    render(<div onClick={aussen}>{linkifyText('https://example.org')}</div>);
    fireEvent.click(screen.getByRole('link'));
    expect(linkOeffnen).toHaveBeenCalledWith('https://example.org');
    expect(aussen).not.toHaveBeenCalled();
  });

  it('nur http und https -- ein javascript:-Ziel wird nie zum Link', () => {
    zeige('javascript:alert(1) und data:text/html,<b>x</b> und ftp://example.org');
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('die Web-Fassung gibt eine Klasse mit, die App ihr Aussehen', () => {
    zeige('https://example.org', { className: 'web-chat-link' });
    expect(screen.getByRole('link')).toHaveClass('web-chat-link');
    expect(screen.getByRole('link').getAttribute('style')).toBeNull();
    document.body.innerHTML = '';
    zeige('https://example.org');
    expect(screen.getByRole('link').getAttribute('style')).toContain('underline');
  });

  it('leerer Text bleibt leer', () => {
    expect(linkifyText('')).toBe('');
  });
});
