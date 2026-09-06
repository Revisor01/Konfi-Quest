// Die Teilen-Karte zeigt fuer jede Seite echten Inhalt, nicht nur ein
// Wasserzeichen.
//
// WAS SCHIEFGING (gemeldet 06.09.2026): Fuer die Haelfte der Seiten gab die
// Karte `null` zurueck. Herausgekommen ist ein schwarzes Bild, auf dem nur
// "Konfi Quest" stand -- ohne Absturz und ohne Meldung.
//
// Der Waechter daneben (wrappedTeilenAlleSeiten) haelt die Listen
// gegeneinander; DIESER Test rendert wirklich und prueft, dass die Zahlen
// und Saetze der jeweiligen Seite auch ankommen. Ein `case`-Zweig, der
// versehentlich nichts ausgibt, faellt sonst durch beide Netze.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: { icon?: unknown }) => <span data-icon={String(props.icon)} />,
}));

import ShareCard from '../../components/wrapped/share/ShareCard';
import type { KonfiWrappedData } from '../../types/wrapped';

// Ein Rueckblick mit Inhalt auf jeder Seite. Die Zahlen sind bewusst
// unverwechselbar, damit der Test nicht versehentlich auf einem anderen
// Feld trifft.
const KONFI = {
  version: 3,
  highlight_type: 'events_held',
  formulierung_seed: 0,
  kacheln: [],
  slides: {
    punkte: { total: 137, gottesdienst: 81, gemeinde: 56 },
    events: { total_attended: 23, lieblings_event: { name: 'Konfi-Freizeit Ratzeburg', datum: '2026-05-01' } },
    badges: {
      total_earned: 9,
      total_available: 20,
      badges: [{ name: 'Frühaufsteher', icon: 'star', color: '#f00' }],
      seltenstes: { name: 'Nachteule', icon: 'moon', color: '#123456', haben_es: 2, konfis: 40, prozent: 5 },
    },
    aktivster_monat: { monat: 5, monat_name: 'Mai', aktivitaeten: 11 },
    endspurt: { aktiv: false, aktuell_total: 137, ziel_total: 100, fehlende_punkte: 0 },
    zeitraum: { start: '2025-09-01', ende: '2026-05-10', konfirmation: '2026-05-10' },
    kategorie: {
      top_kategorie: 'gottesdienst',
      verteilung: [
        { kategorie: 'gottesdienst', count: 12, seite: 'kategorie:gottesdienst' },
        { kategorie: 'freizeit', count: 4, seite: 'kategorie:freizeit' },
      ],
    },
    datums_fenster: { advent: 3 },
    challenge_momente: [{ challenge_title: 'Sternenhimmel', text_content: 'War schoen.' }],
  },
} as unknown as KonfiWrappedData;

function zeige(slideKey: string) {
  const { container } = render(
    <ShareCard
      slideKey={slideKey}
      data={KONFI}
      wrappedType="konfi"
      displayName="Emilia"
      jahrgangName="Jahrgang 2026"
      year={2026}
    />
  );
  return container;
}

/** Alles ausser dem Wasserzeichen. */
function inhaltOhneWasserzeichen(container: HTMLElement): string {
  const karte = container.querySelector('.share-card') as HTMLElement;
  const kopie = karte.cloneNode(true) as HTMLElement;
  kopie.querySelector('.share-card-watermark')?.remove();
  return (kopie.textContent || '').trim();
}

// Was auf der jeweiligen Karte stehen MUSS. Konkrete Werte, keine weichen
// Pruefungen: "irgendein Text" waere auch ein falscher Text.
const ERWARTET: Array<[string, string[]]> = [
  ['intro', ['Emilia', 'Jahrgang 2026', 'Dein Konfi-Jahr 2026']],
  ['punkte', ['137', '81', '56']],
  ['events', ['23', 'Konfi-Freizeit Ratzeburg']],
  ['badges', ['9']],
  ['aktivster-monat', ['Mai', '11 Aktivitäten']],
  ['challenge-momente', ['Sternenhimmel', 'War schoen.']],
  ['abschluss', ['137', '23', '9']],
  // Die fuenf Seiten, die bis zum 06.09.2026 schwarz blieben:
  ['kategorie', ['Gottesdienst', 'Freizeit', '12', '4']],
  ['konfirmation', ['Deine Konfirmation', '10. Mai 2026']],
  ['ueber-das-ziel', ['+37', 'Punkte über dem Ziel!', '137 / 100 Punkte']],
  ['seltenstes', ['Nachteule', '5', 'haben das auch', 'Fast niemand hat das']],
  ['werde-teamer', ['Und jetzt?', 'Bleib', 'dabei.']],
  // Die dynamischen Seiten:
  ['kategorie:gottesdienst', ['Sonntagstreu', '12']],
  ['kategorie:freizeit', ['Unterwegs', '4']],
  ['datum:advent', ['Advent', '3']],
];

describe('Teilen-Karte zeigt echten Inhalt', () => {
  it.each(ERWARTET)('%s zeigt die Angaben der Seite', (slideKey, teile) => {
    const container = zeige(slideKey);
    const text = inhaltOhneWasserzeichen(container);
    expect(text, `${slideKey} ist leer -- die Karte kennt die Seite nicht`).not.toBe('');
    for (const teil of teile) {
      expect(text, `${slideKey}: "${teil}" fehlt (steht da: ${text.slice(0, 200)})`).toContain(teil);
    }
  });

  it('das Wasserzeichen steht auf jeder Karte', () => {
    for (const [slideKey] of ERWARTET) {
      const container = zeige(slideKey);
      expect(container.querySelector('.share-card-watermark')?.textContent).toBe('Konfi Quest');
    }
  });

  it('jede Karte traegt eine Hintergrundklasse', () => {
    // Ohne Klasse ist die Flaeche schwarz. Die dynamischen Seiten teilen
    // sich eine Sammelklasse -- der Doppelpunkt ist in CSS ungueltig.
    const erwarteteKlasse: Record<string, string> = {
      'kategorie:gottesdienst': 'share-card--kategorie-seite',
      'kategorie:freizeit': 'share-card--kategorie-seite',
      'datum:advent': 'share-card--datums-seite',
    };
    for (const [slideKey] of ERWARTET) {
      const karte = zeige(slideKey).querySelector('.share-card') as HTMLElement;
      expect(karte.className, slideKey)
        .toContain(erwarteteKlasse[slideKey] || `share-card--${slideKey}`);
    }
  });

  it('eine unbekannte Seite bleibt leer statt zu stuerzen', () => {
    // Die Karte darf nie werfen -- sonst reisst sie beim Blaettern den
    // ganzen Rueckblick mit. Leer ist hier richtig; dass keine Seite
    // dorthin faellt, sichert der Waechter-Test daneben.
    const container = zeige('gibt-es-nicht');
    expect(inhaltOhneWasserzeichen(container)).toBe('');
  });
});
