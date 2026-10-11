// Mails als Gespräche (components/support/MailGespraeche.tsx, 11.10.2026) --
// in App und Web derselbe Baustein: eingeklappte Zeilen mit Vorschau, die
// jüngste und ungelesene offen, Antworten eingerückt, Signatur und Zitate
// eingeklappt, Gesendetes mit dem Wort „Gesendet".
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { MailNachricht } from '../../../types/support';

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe());

import MailGespraeche from '../../../components/support/MailGespraeche';

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

const VERLAUF = [
  mail(1, { richtung: 'aus', von_adresse: 'support@konfi-quest.de', von_name: 'Konfi Quest', an_adressen: ['lena@example.org'], text: `Hallo Lena,\n\nprüft bitte die Einstellungen.${FUSS}`, verfasst_von_name: 'Simon Luthe' }),
  mail(2, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'], text: 'Das war es, danke!\n\nAm 1.10. schrieb Konfi Quest <support@konfi-quest.de>:\n> Hallo Lena' }),
  mail(3, { in_reply_to: '<m1@x>', referenzen: ['<m1@x>'], von_name: 'Küster Hans', von_adresse: 'hans@example.org', text: 'Bei mir auch.', anhaenge: [{ name: 'bildschirm.png' }] }),
];

/** Die Zeile einer Mail: der Knopf mit ihrem Absender. */
const knopf = (absender: string) => screen.getByRole('button', { name: new RegExp(`^${absender}`) });
const zeile = (absender: string) => knopf(absender).closest('li') as HTMLElement;

describe('MailGespraeche', () => {
  it('ein Gespräch mit Überschrift ohne Re: und Kennung; die jüngste Mail offen, die übrigen mit einer Zeile Vorschau', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    const gespraech = screen.getByRole('region', { name: 'Push kommt nicht an' });
    // Drei Mails, jede ein Knopf zum Auf- und Zuklappen.
    expect(within(gespraech).getAllByRole('button', { expanded: false })).toHaveLength(2);
    expect(within(gespraech).getAllByRole('button', { expanded: true })).toHaveLength(1);

    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'false');
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'false');
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'true');

    // Eingeklappt: eine Zeile ohne Signatur und ohne Zitat.
    expect(knopf('Simon Luthe')).toHaveTextContent('Hallo Lena, prüft bitte die Einstellungen.');
    expect(knopf('Simon Luthe')).not.toHaveTextContent('Digitale Konfi-Arbeit');
    expect(knopf('Lena Probe')).toHaveTextContent('Das war es, danke!');
    expect(knopf('Lena Probe')).not.toHaveTextContent('Am 1.10.');
    // Offen: Empfänger, Text, Anhang als Name.
    expect(knopf('Küster Hans')).toHaveTextContent('An support@konfi-quest.de');
    expect(within(zeile('Küster Hans')).getByText('Bei mir auch.')).toBeInTheDocument();
    expect(within(zeile('Küster Hans')).getByRole('list', { name: 'Anhänge' })).toHaveTextContent('bildschirm.png');
  });

  it('Antworten stehen eingerückt unter der Mail, auf die sie antworten -- beide auf Stufe 1', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    expect(zeile('Simon Luthe')).toHaveClass('mail-zeile--tiefe-0');
    expect(zeile('Lena Probe')).toHaveClass('mail-zeile--tiefe-1');
    expect(zeile('Küster Hans')).toHaveClass('mail-zeile--tiefe-1');
  });

  it('Gesendetes trägt das Wort „Gesendet" und den grünen Kreis, Eingegangenes nicht', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    expect(within(knopf('Simon Luthe')).getByText('Gesendet')).toBeInTheDocument();
    expect(zeile('Simon Luthe').querySelector('.mail-kreis--aus')).toHaveTextContent('SL');
    expect(within(knopf('Lena Probe')).queryByText('Gesendet')).toBeNull();
    expect(zeile('Lena Probe').querySelector('.mail-kreis--aus')).toBeNull();
    expect(zeile('Lena Probe').querySelector('.mail-kreis')).toHaveTextContent('LP');
  });

  it('Antippen klappt auf und zu; aufgeklappt sind Signatur und Zitat hinter je einem Knopf', () => {
    render(<MailGespraeche mails={VERLAUF} />);
    fireEvent.click(knopf('Simon Luthe'));
    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'true');
    const offen = zeile('Simon Luthe');
    expect(within(offen).getByText('Hallo Lena,\n\nprüft bitte die Einstellungen.', { normalizer: (t) => t })).toBeInTheDocument();
    expect(within(offen).queryByText(/Digitale Konfi-Arbeit/)).toBeNull();
    fireEvent.click(within(offen).getByRole('button', { name: 'Signatur einblenden' }));
    expect(within(offen).getByText(/Digitale Konfi-Arbeit/)).toBeInTheDocument();

    fireEvent.click(knopf('Lena Probe'));
    const antwort = zeile('Lena Probe');
    expect(within(antwort).queryByText(/Am 1\.10\./)).toBeNull();
    fireEvent.click(within(antwort).getByRole('button', { name: 'Zitat einblenden' }));
    expect(within(antwort).getByText(/Am 1\.10\. schrieb/)).toBeInTheDocument();

    fireEvent.click(knopf('Simon Luthe'));
    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'false');
  });

  it('ungelesene sind beim Öffnen offen und tragen „Neu"; „Alle aufklappen" öffnet den Rest', () => {
    render(<MailGespraeche mails={VERLAUF} neu={new Set([2])} />);
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
    expect(within(knopf('Lena Probe')).getByText('Neu')).toBeInTheDocument();
    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Alle aufklappen' }));
    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Alle einklappen' }));
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'false');
  });

  it('kommt eine Mail dazu (Antwort gesendet), steht sie offen da -- die übrigen bleiben, wie sie waren', () => {
    const { rerender } = render(<MailGespraeche mails={VERLAUF.slice(0, 2)} />);
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(knopf('Simon Luthe'));
    rerender(<MailGespraeche mails={VERLAUF} />);
    expect(knopf('Küster Hans')).toHaveAttribute('aria-expanded', 'true');
    expect(knopf('Simon Luthe')).toHaveAttribute('aria-expanded', 'true');
    expect(knopf('Lena Probe')).toHaveAttribute('aria-expanded', 'true');
  });

  it('die Nachricht aus dem Formular steht vorn, offen, mit Absender und Adresse', () => {
    render(
      <MailGespraeche
        mails={VERLAUF}
        anfang={{ marke: 'Anliegen aus dem Formular', name: 'Pastorin Lena Probe', adresse: 'lena@example.org', datum: '2026-10-01T08:00:00Z', text: 'Push kommt nicht an.' }}
      />,
    );
    const vorn = screen.getAllByRole('region')[1];
    expect(vorn).toHaveAccessibleName('Anliegen aus dem Formular');
    expect(within(vorn).getByText('Pastorin Lena Probe')).toBeInTheDocument();
    expect(within(vorn).getByText('lena@example.org')).toBeInTheDocument();
    expect(within(vorn).getByText('Push kommt nicht an.')).toBeInTheDocument();
  });

  it('ohne Mails steht der Leertext; zwei Fäden ergeben zwei Gespräche', () => {
    const { rerender } = render(<MailGespraeche mails={[]} leer="Noch keine Mails in diesem Vorgang." />);
    expect(screen.getByText('Noch keine Mails in diesem Vorgang.')).toBeInTheDocument();
    rerender(<MailGespraeche mails={[...VERLAUF, mail(5, { message_id: '<neu@x>', betreff: 'Andere Frage' })]} />);
    expect(screen.getByText('4 Mails in 2 Gesprächen')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Andere Frage' })).toBeInTheDocument();
  });
});
