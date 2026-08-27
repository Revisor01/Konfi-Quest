import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund M3 (27.08.2026): Das Papierflieger-Badge "Du hast bereits
// eingereicht" bedeutete je Baum etwas anderes.
//
// Die Konfi-Liste prueft `has_submission` -- eingereicht ist eingereicht,
// auch unmoderiert (challenges.js:310-315, mit genau dieser Begruendung).
// Die geteilte Leitungs-/Teamer-Liste prueft `has_badge`, das seit dem
// 24.08.2026 nur noch FREIGEGEBENE Beitraege zaehlt (challenges.js:305-309).
// Folge bei einer moderierten Challenge: Eine Teamer:in sah nach dem eigenen
// Einreichen kein Haekchen, eine Konfi in derselben Lage schon -- bei
// wortgleichem Tooltip.
//
// Der Fix lag ungenutzt bereit: `GET /challenges/admin` liefert
// `own_submission_count` seit jeher mit (challenges.js:1100-1101, 1125), im
// Frontend verwendete es niemand.
//
// Geprueft wird an der Quelldatei, weil die Bedingung im JSX der Kartenliste
// steht -- sie zu rendern hiesse, die halbe Challenge-Liste samt Kontexten
// nachzubauen, was mehr Annahmen einfuehrte als der Test absichert.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const geteilteListe = lies('src/components/admin/views/ChallengesManageView.tsx');
const konfiListe = lies('src/components/konfi/views/ChallengesView.tsx');

describe('"Bereits eingereicht" bedeutet ueberall dasselbe (M3)', () => {
  it('die geteilte Liste haengt das Badge an die eigene Einreichung', () => {
    expect(geteilteListe).toContain('(challenge.own_submission_count ?? 0) > 0 && (');
  });

  it('die geteilte Liste nutzt dafuer NICHT mehr has_badge', () => {
    // Der Kern des Befunds. `has_badge` steht seit dem 24.08. fuer das
    // verdiente Abzeichen, nicht fuer die Einreichung -- die beiden Dinge
    // duerfen sich nicht wieder vermischen.
    const jsxOhneKommentare = geteilteListe.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    expect(jsxOhneKommentare).not.toContain('challenge.has_badge');
  });

  it('die Konfi-Liste bleibt bei has_submission', () => {
    // Gegenprobe: Diese Seite war richtig und darf sich nicht aendern.
    expect(konfiListe).toContain('challenge.has_submission');
  });

  it('beide Wege meinen dasselbe Feld des Backends', () => {
    // has_submission ist im Backend als `own_submission_count > 0` definiert
    // (challenges.js:314). Die geteilte Liste bekommt die Zahl roh und
    // vergleicht selbst -- inhaltlich identisch, nur ein anderer Endpunkt.
    const backend = lies('../backend/routes/challenges.js');
    expect(backend).toContain('has_submission: (parseInt(row.own_submission_count, 10) || 0) > 0');
    expect(backend).toContain('own_submission_count: parseInt(row.own_submission_count, 10) || 0');
  });
});
