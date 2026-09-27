// backend/tests/utils/liveSignaleOhneInhalt.test.js
//
// Audit "Wer bekommt was" 27.09.2026, Befund BF-15: Die Live-Signale an die
// ganze Gemeinde (utils/liveUpdate.js: sendToOrgAdmins an das ganze Team,
// sendToOrgKonfis an alle Konfis, sendToOrg an beide) erreichen auch Personen,
// die den Vorgang nach der Regel in CLAUDE.md ("Wer sieht und bekommt was")
// nicht sehen -- Admins und Teamer:innen fremder Jahrgaenge, Konfis anderer
// Jahrgaenge.
//
// Geprueft am 27.09.2026: Das ist mit der Regel vereinbar, SOLANGE die Signale
// keinen Inhalt tragen. Sie sagen nur "lade neu" (Art, Aktion, Kennungen);
// die App wertet `data` gar nicht aus (frontend LiveUpdateContext /
// useLiveRefresh, ebenso Tag 2.2.0) und laedt ueber die Routen nach, die die
// Regel pruefen. Namen, Texte, Gruende oder Punkte an die ganze Gemeinde
// waeren dagegen ein Verstoss -- Signale an eine Person (sendToUser,
// sendToUserByRole) und an einen Jahrgang (sendToJahrgang) sind hier nicht
// gemeint, sie erreichen nur die Betroffenen.
//
// Dieser Test haelt das fest: Jeder Aufruf eines gemeindeweiten Signals im
// Backend traegt als Nutzdaten nichts oder ein Objekt aus Kennungen, einer
// Aktion als kurzem Wort und einer Anzahl. Kommt ein Name oder Text dazu,
// faellt er -- und wer ihn liest, grenzt die Empfaenger ein statt die Liste
// hier zu erweitern.
const fs = require('fs');
const path = require('path');

const BACKEND = path.join(__dirname, '..', '..');
const ORDNER = ['routes', 'services', 'utils'];

/** Was ein gemeindeweites Signal tragen darf. */
const ERLAUBTE_SCHLUESSEL = new Set(['eventId', 'konfiId', 'userId', 'challengeId', 'seriesId', 'count', 'action']);

/**
 * Weiterreichungen: Funktionen, die ihre Nutzdaten unveraendert an ein
 * gemeindeweites Signal geben. Ihr Weiterreichen selbst ist erlaubt, dafuer
 * wird jeder IHRER Aufrufe geprueft wie ein direkter.
 */
const WEITERREICHUNGEN = [
  { datei: 'routes/challenges.js', funktion: 'notifyLeadership', nutzdatenIndex: 2, weitergereicht: 'data' }
];

const SIGNALE = [
  { muster: /liveUpdate\.(sendToOrgAdmins|sendToOrgKonfis|sendToOrg)\(/g, nutzdatenIndex: 3 },
  ...WEITERREICHUNGEN.map((w) => ({ muster: new RegExp(`\\b${w.funktion}\\(`, 'g'), nutzdatenIndex: w.nutzdatenIndex, nurIn: w.datei }))
];

function jsDateien(ordner) {
  const ergebnis = [];
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) ergebnis.push(...jsDateien(voll));
    else if (eintrag.name.endsWith('.js')) ergebnis.push(voll);
  }
  return ergebnis;
}

// Die Argumente eines Aufrufs ab der oeffnenden Klammer, auf oberster Ebene
// an Kommas getrennt. Zeichenketten werden uebersprungen, damit ein Komma
// oder eine Klammer darin nichts zerteilt.
function argumente(text, start) {
  const teile = [];
  let tiefe = 0;
  let aktuell = '';
  for (let i = start; i < text.length; i++) {
    const z = text[i];
    if (z === '\'' || z === '"' || z === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== z) j += text[j] === '\\' ? 2 : 1;
      aktuell += text.slice(i, j + 1);
      i = j;
      continue;
    }
    if (z === '(' || z === '{' || z === '[') {
      tiefe++;
      if (tiefe === 1 && z === '(') continue;
    }
    if (z === ')' || z === '}' || z === ']') {
      tiefe--;
      if (tiefe === 0) { teile.push(aktuell.trim()); return teile; }
    }
    if (z === ',' && tiefe === 1) { teile.push(aktuell.trim()); aktuell = ''; continue; }
    aktuell += z;
  }
  throw new Error('Aufruf ohne schliessende Klammer');
}

// Ein Objekt-Literal in seine Eintraege (Schluessel, Wert) zerlegen.
function eintraege(objekt) {
  const innen = objekt.trim().replace(/^\{/, '').replace(/\}$/, '');
  return argumente(`(${innen})`, 0)
    .filter((e) => e !== '')
    .map((e) => {
      const m = e.match(/^([A-Za-z_$][\w$]*)\s*(?::\s*([\s\S]+))?$/);
      return m ? { schluessel: m[1], wert: m[2] === undefined ? m[1] : m[2].trim() } : { schluessel: null, wert: e };
    });
}

function alleAufrufe() {
  const aufrufe = [];
  for (const ordner of ORDNER) {
    for (const datei of jsDateien(path.join(BACKEND, ordner))) {
      const relativ = path.relative(BACKEND, datei).split(path.sep).join('/');
      if (relativ === 'utils/liveUpdate.js') continue;
      const text = fs.readFileSync(datei, 'utf8');
      for (const signal of SIGNALE) {
        if (signal.nurIn && signal.nurIn !== relativ) continue;
        for (const treffer of text.matchAll(signal.muster)) {
          const zeilenAnfang = text.lastIndexOf('\n', treffer.index) + 1;
          const davor = text.slice(zeilenAnfang, treffer.index);
          if (davor.includes('//') || /^\s*\*/.test(davor)) continue; // Kommentar
          if (/function\s*$/.test(davor)) continue;                   // Definition
          const zeile = text.slice(0, treffer.index).split('\n').length;
          const args = argumente(text, treffer.index + treffer[0].length - 1);
          aufrufe.push({ ort: `${relativ}:${zeile}`, datei: relativ, nutzdaten: args[signal.nutzdatenIndex] });
        }
      }
    }
  }
  return aufrufe;
}

function verstoesse(aufruf) {
  const { nutzdaten, datei } = aufruf;
  if (nutzdaten === undefined || nutzdaten === 'null') return [];
  const weiter = WEITERREICHUNGEN.find((w) => w.datei === datei && w.weitergereicht === nutzdaten);
  if (weiter) return [];
  if (!nutzdaten.startsWith('{')) return [`Nutzdaten nicht als Objekt-Literal: ${nutzdaten}`];
  const fehler = [];
  for (const { schluessel, wert } of eintraege(nutzdaten)) {
    if (!schluessel || !ERLAUBTE_SCHLUESSEL.has(schluessel)) {
      fehler.push(`Schluessel ${schluessel || wert} traegt moeglicherweise Inhalt`);
      continue;
    }
    if (schluessel === 'action') {
      if (!/^'[a-z_]+'$/.test(wert)) fehler.push(`action ist kein kurzes Wort: ${wert}`);
      continue;
    }
    if (/['"`]/.test(wert)) fehler.push(`${schluessel} ist Text: ${wert}`);
  }
  return fehler;
}

describe('Gemeindeweite Live-Signale tragen keinen Inhalt (BF-15)', () => {
  const aufrufe = alleAufrufe();

  it('der Scan findet die bekannten Stellen (sonst prueft er nichts)', () => {
    const orte = aufrufe.map((a) => a.datei);
    // Stichproben aus allen drei Arten und der Weiterreichung.
    expect(orte).toContain('routes/konfi-management.js');  // sendToOrgAdmins mit konfiId
    expect(orte).toContain('routes/events/verwaltung.js'); // sendToOrg mit eventId
    expect(orte).toContain('routes/badges.js');            // sendToOrgKonfis
    expect(orte).toContain('routes/challenges.js');        // notifyLeadership
    const mitNutzdaten = aufrufe.filter((a) => a.nutzdaten !== undefined && a.nutzdaten.startsWith('{'));
    expect(mitNutzdaten.some((a) => a.nutzdaten.includes('konfiId'))).toBe(true);
  });

  it('jede Nutzlast besteht nur aus Kennungen, Aktion und Anzahl', () => {
    const befunde = aufrufe.flatMap((a) => verstoesse(a).map((f) => `${a.ort}: ${f}`));
    expect(befunde).toEqual([]);
  });

  it('der Pruefer schlaegt bei Namen und Texten an (Gegenprobe im Kleinen)', () => {
    const probe = (nutzdaten) => verstoesse({ datei: 'routes/x.js', nutzdaten });
    expect(probe("{ konfiId, konfiName: konfi.display_name }")).toHaveLength(1);
    expect(probe("{ eventId, reason }")).toHaveLength(1);
    expect(probe("{ userId: 'Test Konfi 1' }")).toHaveLength(1);
    expect(probe("{ eventId, action: `abgemeldet: ${grund}` }")).toHaveLength(1);
    expect(probe('payload')).toHaveLength(1);
    expect(probe("{ eventId, action: 'attendance' }")).toEqual([]);
    expect(probe('{ userId: parseInt(id) }')).toEqual([]);
    expect(probe('{ seriesId, count: seriesDates.length }')).toEqual([]);
    expect(probe(undefined)).toEqual([]);
  });
});
