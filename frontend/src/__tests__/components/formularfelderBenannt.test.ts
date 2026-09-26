import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-01: 170 von 186 Formularfeldern hatten
// keinen zugaenglichen Namen. Die App beschriftet Felder mit einem
// Geschwister-<IonLabel> im <IonItem>; Ionic 9 bindet das nicht mehr an das
// Feld (getLabelledById() kennt nur label-Prop, slot="label" und ein
// geerbtes aria-label). Vorlesehilfen sagten „Textfeld", „Schalter, aus",
// „Schieberegler" -- nicht „Pflicht-Event" oder „Max. Teilnehmer:innen".
//
// Die Anmeldeseiten wurden zuerst umgestellt (anmeldeseitenBarrierefrei),
// die uebrigen Felder im Barrierefreiheits-Paket: aria-label als ERSTES
// Attribut, das sichtbare IonLabel bleibt fuer das Layout.
//
// Dieser Test haelt den Stand mit der Zaehlmethode des Berichts fest -- und
// zwar in BEIDEN Lesarten:
//   1. „Berichtsmethode": der Tag endet am ersten '>' (so zaehlte das
//      Audit-Skript; ein '=>' in onIonInput schneidet den Tag ab). Damit die
//      Zahl 0 wird, muss der Name VOR dem ersten Handler stehen.
//   2. klammerbewusst: der ganze Oeffnungstag.
// Beide muessen 0 ergeben. Neue Felder ohne Namen lassen den Test fallen.
// ---------------------------------------------------------------------------

const wurzel = resolve(process.cwd(), 'src/components');

const alleTsx = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return alleTsx(pfad);
    return pfad.endsWith('.tsx') ? [pfad] : [];
  });

const FELDER = ['IonInput', 'IonTextarea', 'IonSelect', 'IonSearchbar', 'IonToggle', 'IonCheckbox', 'IonRange', 'IonDatetime'];
const FELD_START = new RegExp(`<(${FELDER.join('|')})\\b`, 'g');
const NAME = /(?:^|\s)(label|aria-label|aria-labelledby|placeholder)\s*=/;

/** Index des schliessenden '>' eines JSX-Oeffnungstags (Klammern und Anfuehrungszeichen beachtet). */
const tagEnde = (quelle: string, start: number): number => {
  let tiefe = 0;
  let anfuehrung: string | null = null;
  for (let i = start; i < quelle.length; i++) {
    const z = quelle[i];
    if (anfuehrung) {
      if (z === anfuehrung) anfuehrung = null;
    } else if (z === "'" || z === '"' || z === '`') {
      anfuehrung = z;
    } else if (z === '{') {
      tiefe++;
    } else if (z === '}') {
      tiefe--;
    } else if (z === '>' && tiefe === 0) {
      return i;
    }
  }
  throw new Error(`Oeffnungstag ohne Ende ab Position ${start}`);
};

interface Feld { ort: string; art: string; naiv: string; ganz: string }

const alleFelder = (): Feld[] =>
  alleTsx(wurzel).flatMap((pfad) => {
    const quelle = readFileSync(pfad, 'utf8');
    const funde: Feld[] = [];
    for (const m of quelle.matchAll(FELD_START)) {
      const start = m.index!;
      const zeile = quelle.slice(0, start).split('\n').length;
      funde.push({
        ort: `${relative(wurzel, pfad)}:${zeile}`,
        art: m[1],
        naiv: quelle.slice(start, quelle.indexOf('>', start) + 1),
        ganz: quelle.slice(start, tagEnde(quelle, start) + 1),
      });
    }
    return funde;
  });

describe('Formularfelder haben einen zugaenglichen Namen (UI BF-01)', () => {
  const felder = alleFelder();

  it('findet die Felder der App (Plausibilitaet der Zaehlung)', () => {
    // Der Bericht zaehlte 186. Weniger als 150 hiesse: der Scanner uebersieht Dateien.
    expect(felder.length).toBeGreaterThanOrEqual(150);
  });

  it('Berichtsmethode (Tag bis zum ersten ">"): kein Feld ohne label/aria-label/aria-labelledby/placeholder', () => {
    const ohne = felder.filter((f) => !NAME.test(f.naiv)).map((f) => `${f.ort} ${f.art}`);
    expect(ohne).toEqual([]);
  });

  it('klammerbewusst (ganzer Oeffnungstag): kein Feld ohne Namen', () => {
    const ohne = felder.filter((f) => !NAME.test(f.ganz)).map((f) => `${f.ort} ${f.art}`);
    expect(ohne).toEqual([]);
  });

  it('kein Feld verlaesst sich allein auf den Platzhalter (der verschwindet beim Tippen)', () => {
    const ECHTER_NAME = /(?:^|\s)(label|aria-label|aria-labelledby)\s*=/;
    const nurPlatzhalter = felder.filter((f) => !ECHTER_NAME.test(f.ganz)).map((f) => `${f.ort} ${f.art}`);
    expect(nurPlatzhalter).toEqual([]);
  });

  it('Pflichtfelder mit Stern im sichtbaren Label tragen aria-required', () => {
    // Stichprobe an den Stellen, die der Bericht nennt.
    const quelle = readFileSync(join(wurzel, 'admin/modals/EventFormSections.tsx'), 'utf8');
    expect(quelle).toMatch(/<IonLabel position="stacked">Event Name \*<\/IonLabel>\s*<IonInput aria-label="Event Name" aria-required="true"/);
  });
});
