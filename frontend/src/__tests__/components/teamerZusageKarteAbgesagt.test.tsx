// "BIST DU DABEI?" AN EINEM ABGESAGTEN ODER VERGANGENEN TERMIN
// (17.09.2026, Simons Befund) -- gerendert (Audit Tests 26.09.2026, BF-02;
// vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// WÖRTLICH: "Außerdem steht in abgesagten Elementen noch die Card mit
// [Bist du dabei] aber ohne Button. Ganze Card muss raus."
//
// ZWEI FEHLER AN DERSELBEN STELLE (TeamerEventsPage, renderDetail):
//
// 1. LEERE KARTE. Der Zweig für vergangene Termine endete mit `) : null` --
//    wer nicht angemeldet war, sah die Überschrift "Bist du dabei?" über
//    einer völlig leeren weißen Karte.
// 2. DIE TEAMER-SEITE KANNTE `cancelled` NICHT als Riegel. An einem
//    abgesagten, aber noch nicht vergangenen Termin standen die
//    Zusage-Knöpfe weiter da; das Backend lehnt die Zusage seit dem
//    16.09.2026 ab.
//
// SO IST ES JETZT -- gleich in allen drei Rollen:
//   abgesagt  -> Hinweis "Dieses Event ist abgesagt", keine Knöpfe
//   vergangen, nicht dabei -> gar keine Karte
//
// Die anderen beiden Rollen sind ebenfalls gerendert geprüft: Konfi
// (konfiAbgemeldetUndWarteliste: "Dieses Event ist abgesagt" statt der
// Knöpfe) und Leitung (terminRechteGerendert, "Abgesagter Termin (Leitung)").
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, inTagen, oeffneTermin, zusageKarte } from './gerueste/teamerTerminSeite';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

const ABGESAGT: Partial<Event> = { cancelled: true, registration_status: 'cancelled', cancelled_reason: 'Sturmwarnung' };
const ZUSAGE_TEXTE = /^(Dabei|Nicht dabei|Nicht mehr dabei|Doch dabei|Warteliste.*|Du bist offline)$/;

describe('Die Teamer-Seite kennt abgesagte Termine', () => {
  it('an einem abgesagten Termin steht der Hinweis statt der Knöpfe', async () => {
    zustand.events = [termin(ABGESAGT)];
    await oeffneTermin();
    const karte = zusageKarte()!;
    expect(within(karte).getByText('Dieses Event ist abgesagt')).toBeInTheDocument();
    expect(within(karte).queryAllByRole('button')).toHaveLength(0);
  });

  it('bietet dort KEINE Zusage mehr an -- auch nicht, wer schon zugesagt hatte', async () => {
    zustand.events = [termin({ ...ABGESAGT, is_registered: true, booking_status: 'confirmed' })];
    await oeffneTermin();
    const texte = screen.queryAllByRole('button').map((k) => k.textContent ?? '');
    expect(texte.filter((t) => ZUSAGE_TEXTE.test(t))).toEqual([]);
    expect(within(zusageKarte()!).getByText('Dieses Event ist abgesagt')).toBeInTheDocument();
  });

  it('die Absage schlägt auch die Kontingent-Zweige (volles Team, Warteliste offen)', async () => {
    zustand.events = [termin({
      ...ABGESAGT, teamer_max_participants: 2, teamer_count: 2, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 3,
    })];
    await oeffneTermin();
    expect(within(zusageKarte()!).queryAllByRole('button')).toHaveLength(0);
  });

  it('erkennt die Absage an beiden Feldern: nur registration_status "cancelled" reicht', async () => {
    zustand.events = [termin({ registration_status: 'cancelled' })];
    await oeffneTermin();
    expect(within(zusageKarte()!).getByText('Dieses Event ist abgesagt')).toBeInTheDocument();
  });

  it('ein nicht abgesagter Termin zeigt keinen Absage-Hinweis, sondern die Knöpfe', async () => {
    zustand.events = [termin()];
    await oeffneTermin();
    expect(screen.queryByText('Dieses Event ist abgesagt')).toBeNull();
    expect(within(zusageKarte()!).getAllByRole('button').map((k) => k.textContent)).toEqual(['Dabei', 'Nicht dabei']);
  });

  it('der Kopf der Ansicht nennt den Termin "Abgesagt" -- derselbe Status wie in Liste und Legende', async () => {
    zustand.events = [termin(ABGESAGT)];
    await oeffneTermin();
    expect(screen.getAllByText('Abgesagt').length).toBeGreaterThan(0);
  });
});

describe('Keine leere Karte mehr', () => {
  it('vergangener Termin ohne eigene Zusage: keine Karte, auch keine Überschrift', async () => {
    zustand.events = [termin({ event_date: inTagen(-3), is_registered: false })];
    await oeffneTermin();
    expect(zusageKarte()).toBeNull();
    expect(screen.queryByText('Bist du dabei?')).toBeNull();
  });

  it('vergangener Termin mit Zusage: die Karte bleibt und sagt, dass die Anwesenheit aussteht', async () => {
    zustand.events = [termin({ event_date: inTagen(-3), is_registered: true, booking_status: 'confirmed' })];
    await oeffneTermin();
    expect(within(zusageKarte()!).getByText('Anwesenheit ausstehend')).toBeInTheDocument();
    expect(within(zusageKarte()!).queryAllByRole('button')).toHaveLength(0);
  });
});
