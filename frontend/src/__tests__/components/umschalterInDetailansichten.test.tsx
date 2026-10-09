import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffneListe, oeffneTermin, api } from './gerueste/teamerTerminSeite';
import { kopfzeileMitschreiben, nachtragZuruecksetzen, kopfzeilen } from './gerueste/nachtragKopfzeileIonic';

/**
 * Der Gemeinde-Umschalter gehoert NICHT in eine Detailansicht.
 *
 * SIMON AM GERAET (26.09.2026): "In Events Details kein org switcher zeigen."
 * und "Material sub Seiten auch weg damit."
 *
 * WARUM: Eine Detailansicht zeigt EINEN Gegenstand -- einen Termin, ein
 * Material -- und der gehoert zu genau einer Gemeinde. Ein Wechsel fuehrt
 * dort ins Leere: Den Termin gibt es in der anderen Gemeinde nicht. Die
 * Listen behalten den Umschalter, dort ist er richtig.
 *
 * AppKopfzeile hat `gemeindeUmschalter = true` als Standard (bewusst: die
 * meisten Seiten sind Listen). Eine Detailansicht muss ihn deshalb selbst
 * abschalten.
 *
 * GERENDERT (seit 09.10.2026, Audit Tests BF-02): Die Team-Terminseite
 * (Liste, Detail und Jahrgangs-Hinweis in EINER Datei), die Konfi-Liste und
 * das Material-Detail des Teams werden hier gezeichnet, und es wird gelesen,
 * welche Props ihre Kopfzeile bekommt. Termin-Detail der Konfis und der
 * Leitung: terminDetailDreiAnsichtenKonfi/-Leitung.test.tsx. Dass die
 * Kopfzeile mit gemeindeUmschalter={false} wirklich keinen Umschalter zeigt,
 * prueft appKopfzeile.test.tsx; dass genau die Reiter-Seiten der Leitung ihn
 * tragen, ebenda.
 *
 * ALS WAECHTER bleibt die allgemeine Regel ueber ALLE Kopfzeilen der App:
 * eine mit Zurueck-Knopf schaltet ihn ab. Sie faengt die Detailansicht, die
 * niemand gerendert hat -- dafuer IST das Lesen der Quellen der Zweck.
 */

kopfzeileMitschreiben();

// Die Adresse der Team-Seite (?eventId=) laesst sich je Test setzen -- das
// Geruest haelt sie fest leer.
let suche = '';
vi.doMock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ search: suche, pathname: '/teamer/events' }),
}));

beforeEach(() => {
  zuruecksetzen();
  nachtragZuruecksetzen();
  suche = '';
});

const umschalter = () => kopfzeilen.map((k) => [k.titel, k.gemeindeUmschalter ?? true]);

describe('Team-Terminseite: Liste behaelt ihn, Detail und Hinweis nicht (28.09.2026)', () => {
  it('die Liste traegt den Umschalter', async () => {
    zustand.events = [termin()];
    await oeffneListe('alle');
    expect(kopfzeilen.length).toBeGreaterThan(0);
    expect(umschalter().filter(([, u]) => u !== true)).toEqual([]);
  });

  it('das geoeffnete Termin-Detail schaltet ihn ab', async () => {
    zustand.events = [termin({ name: 'Konfi-Freizeit' })];
    await oeffneTermin('Konfi-Freizeit');
    expect(kopfzeilen.at(-1)?.titel).toBe('Konfi-Freizeit');
    expect(kopfzeilen.at(-1)?.gemeindeUmschalter).toBe(false);
  });

  it('zurueck in der Liste ist er wieder da', async () => {
    zustand.events = [termin({ name: 'Konfi-Freizeit' })];
    await oeffneTermin('Konfi-Freizeit');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Zurück' })); });
    expect(kopfzeilen.at(-1)?.gemeindeUmschalter ?? true).toBe(true);
  });

  it('der Hinweis "Nicht deinem Jahrgang zugeordnet" schaltet ihn ab', async () => {
    suche = '?eventId=99';
    zustand.events = [termin({ id: 77 })];
    api.get.mockImplementation((pfad: string) => (pfad === '/events/99'
      ? Promise.reject({ response: { status: 403, data: { error_code: 'jahrgang_nicht_zugewiesen' } } })
      : Promise.resolve({ data: pfad === '/events' ? zustand.events : [] })));
    const TeamerEventsPage = (await import('../../components/teamer/pages/TeamerEventsPage')).default;
    render(<TeamerEventsPage />);
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Nicht deinem Jahrgang zugeordnet')).toBeTruthy();
    expect(kopfzeilen.at(-1)?.titel).toBe('Event');
    expect(kopfzeilen.at(-1)?.gemeindeUmschalter).toBe(false);
  });
});

describe('Konfi-Terminliste: behaelt ihn -- dort ist der Wechsel sinnvoll', () => {
  it('jede Kopfzeile der Liste traegt ihn', async () => {
    zustand.events = [termin()];
    const KonfiEventsPage = (await import('../../components/konfi/pages/KonfiEventsPage')).default;
    render(<KonfiEventsPage />);
    await act(async () => { await Promise.resolve(); });
    expect(kopfzeilen.length).toBeGreaterThan(0);
    expect(umschalter().filter(([, u]) => u !== true)).toEqual([]);
  });
});

describe('Material-Detail des Teams: kein Umschalter (26.09.2026, "Material sub Seiten auch weg damit")', () => {
  it('weder beim Laden noch mit geladenem Material', async () => {
    vi.doUnmock('../../components/teamer/pages/TeamerMaterialDetailPage');
    vi.doMock('../../services/materialDetail', () => ({
      materialDetailLaden: async () => ({ daten: { id: 3, title: 'Liedblatt', files: [] }, ausSpeicher: false }),
    }));
    vi.doMock('../../hooks/useDateiOeffnen', () => ({
      useDateiOeffnen: () => ({ dateiOeffnen: vi.fn(), ladendeDatei: null }),
    }));
    const Detail = (await import('../../components/teamer/pages/TeamerMaterialDetailPage')).default;
    render(<Detail materialId={3} onClose={() => undefined} />);
    for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
    expect(kopfzeilen.map((k) => k.titel)).toContain('Liedblatt');
    expect(umschalter().filter(([, u]) => u !== false)).toEqual([]);
  });
});



const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle <AppKopfzeile ...>-Aufrufe einer Datei, je als Text. */
function kopfzeilenIn(quelle: string): string[] {
  const raus: string[] = [];
  const muster = /<AppKopfzeile(?![a-zA-Z])/g;
  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(quelle)) !== null) {
    // Bis zum schliessenden > des Tags -- Verschachtelung in Props (etwa
    // rechts={<IonButton ...>}) mitzaehlen, sonst endet das Tag zu frueh.
    let tiefe = 0;
    let i = treffer.index;
    for (; i < quelle.length; i++) {
      const z = quelle[i];
      if (z === '{') tiefe++;
      else if (z === '}') tiefe--;
      else if (z === '>' && tiefe === 0) break;
    }
    raus.push(quelle.slice(treffer.index, i + 1));
  }
  return raus;
}

describe('Waechter: jede Kopfzeile mit Zurueck-Knopf schaltet ihn ab', () => {
  // DIE ALLGEMEINE REGEL, ueber alle drei Rollen (28.09.2026): Eine
  // Kopfzeile mit Zurueck-Knopf gehoert zu einer Unter- oder Detailseite --
  // dort gibt es keinen Wechsel. So faellt eine Detailansicht auf, die
  // niemand in die Liste oben eingetragen hat (genau so blieb die
  // Teamer-Terminansicht zwei Tage stehen).
  //
  // Die einzige Ausnahme: die Material-LISTE der Teamer:innen. Laeuft
  // Material nicht als eigener Reiter, fuehrt ein Zurueck zur Startseite --
  // es bleibt aber die Liste der Gemeinde, und die behaelt den Umschalter
  // (Test unten).
  const AUSNAHMEN_MIT_ZURUECK: Array<{ datei: string; merkmal: string }> = [
    { datei: 'src/components/teamer/pages/TeamerMaterialPage.tsx', merkmal: 'titel={MATERIAL_TEAM_TITEL}' },
  ];

  it('jede Kopfzeile mit Zurueck-Knopf schaltet ihn ab (Konfi, Teamer, Leitung)', () => {
    const alleDateien = (verzeichnis: string): string[] =>
      readdirSync(resolve(process.cwd(), verzeichnis), { withFileTypes: true }).flatMap((e) => {
        const pfad = `${verzeichnis}/${e.name}`;
        if (e.isDirectory()) return alleDateien(pfad);
        return pfad.endsWith('.tsx') ? [pfad] : [];
      });

    const verstoesse: string[] = [];
    let geprueft = 0;
    for (const datei of alleDateien('src/components')) {
      if (datei.endsWith('shared/AppKopfzeile.tsx')) continue;
      for (const kopf of kopfzeilenIn(lies(datei))) {
        if (!/onZurueck=/.test(kopf)) continue;
        if (AUSNAHMEN_MIT_ZURUECK.some((a) => a.datei === datei && kopf.includes(a.merkmal))) continue;
        geprueft++;
        if (!/gemeindeUmschalter=\{false\}/.test(kopf)) {
          verstoesse.push(`${datei}: ${kopf.split('\n')[0]} ${kopf.match(/titel=\S+/)?.[0] ?? ''}`);
        }
      }
    }

    // Stand 28.09.2026: 35 Kopfzeilen mit Zurueck-Knopf. Die Untergrenze
    // stellt sicher, dass die Suche ueberhaupt etwas findet.
    expect(geprueft).toBeGreaterThanOrEqual(30);
    expect(verstoesse).toEqual([]);
  });

  it('die Ausnahme wird noch gebraucht: die Material-Liste des Teams hat eine Kopfzeile mit Zurueck und behaelt den Umschalter', () => {
    const liste = kopfzeilenIn(lies(AUSNAHMEN_MIT_ZURUECK[0].datei)).filter((k) => k.includes(AUSNAHMEN_MIT_ZURUECK[0].merkmal));
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatch(/onZurueck=/);
    expect(liste[0]).not.toMatch(/gemeindeUmschalter=\{false\}/);
  });

  it('die Gegenprobe der Pruefhilfe: sie findet verschachtelte Props', () => {
    // Eine Kopfzeile mit einem Knopf in `rechts` darf nicht vorzeitig enden,
    // sonst laege gemeindeUmschalter ausserhalb des gefundenen Tags.
    const beispiel = `
      <AppKopfzeile
        titel="Test"
        rechts={<IonButton onClick={() => tu({ a: 1 })}>x</IonButton>}
        gemeindeUmschalter={false}
      />`;
    const gefunden = kopfzeilenIn(beispiel);
    expect(gefunden).toHaveLength(1);
    expect(gefunden[0]).toMatch(/gemeindeUmschalter=\{false\}/);
  });
});
