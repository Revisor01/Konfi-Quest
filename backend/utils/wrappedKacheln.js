// wrappedKacheln.js — welche Kacheln ein Rückblick zeigt.
//
// Simons Vorgabe (02.09.2026): "Im Grunde brauchen wir so 20 oder 25 Kacheln,
// jeder bekommt aber nur 8. Davon 4 immer, die anderen dynamisch. Wer nicht
// viel geschrieben hat, braucht keine Chat-Kachel."
//
// Die Regel dahinter ist die schon bestehende Highlight-Logik, nur auf alle
// Kacheln ausgeweitet: Gezeigt wird, was diese Person tatsächlich getan hat.
// Eine Kachel mit einer Null darauf ist keine Erinnerung, sondern ein Vorwurf.
//
// KEINE Negativ-Kacheln: Absagen, Fehlzeiten und Ähnliches tauchen nicht auf
// (Simons Entscheidung 01.09.2026, gilt unverändert weiter). Verlässlichkeit
// erscheint nur in ihrer positiven Wendung ("nie abgesagt").
//
// Vergleiche mit dem Jahrgang bleiben anonym und nur nach oben: Wer unter dem
// Schnitt liegt, bekommt die Kachel gar nicht erst -- nicht die Kachel mit
// einem schlechten Vergleich.

// Die vier festen Kacheln. Sie erscheinen bei jeder Person, auch mit kleinen
// Zahlen: Sie tragen die Erzählung (Auftakt, Mitte, Schluss) und ohne sie
// entstünde bei einer stillen Konfi gar kein Rückblick.
const FESTE_KACHELN = ['intro', 'punkte', 'events', 'abschluss'];

// Wie viele Kacheln eine Person insgesamt sieht.
const KACHELN_PRO_PERSON = 8;

/**
 * Alle dynamischen Kacheln mit ihrer Bedingung und ihrem Gewicht.
 *
 * `relevanz` entscheidet die Reihenfolge, wenn mehr Kacheln in Frage kommen
 * als Plätze da sind: Je persönlicher und seltener eine Kachel, desto höher.
 * Ein Foto aus einer Challenge sagt mehr über ein Jahr aus als die Zahl der
 * gesammelten Punkte -- deshalb steht es oben.
 *
 * `bedingung` bekommt die Slides des Snapshots und den Jahrgangsschnitt.
 */
const DYNAMISCHE_KACHELN = [
  {
    key: 'challenge-momente',
    relevanz: 100,
    thema: 'challenges',
    bedingung: (s) => (s.challenge_momente?.length || 0) > 0
  },
  {
    key: 'highlight',
    relevanz: 95,
    thema: 'person',
    // Das persönliche Highlight (Chat-Star, Reaktions-Magnet, ...). Nur wenn
    // das Backend eines bestimmt hat und ein Wert dahintersteht.
    bedingung: (s) => Boolean(s.highlight?.type) && (s.highlight?.wert || 0) > 0
  },
  {
    key: 'challenges',
    relevanz: 85,
    thema: 'challenges',
    bedingung: (s) => (s.challenges?.beitraege || 0) > 0
  },
  {
    key: 'verlaesslich',
    relevanz: 80,
    thema: 'haltung',
    // Nur die positive Wendung. `nie_abgesagt` allein reicht nicht: Wer bei
    // nichts war, hat auch nichts abgesagt -- das ist keine Leistung.
    bedingung: (s) => s.verlaesslichkeit?.nie_abgesagt === true
      && (s.events?.total_attended || 0) >= 3
  },
  {
    key: 'chat',
    relevanz: 70,
    thema: 'gemeinschaft',
    // Simons Regel wörtlich: "Wer nicht viel geschrieben hat, braucht keine
    // Chat-Kachel." Eine einzelne Nachricht ist keine Geschichte -- die
    // Schwelle liegt bei 5 UND mindestens dem Jahrgangsschnitt.
    bedingung: (s, schnitt) => {
      const eigene = s.chat?.nachrichten_gesendet || 0;
      if (eigene < 5) return false;
      const mittel = schnitt?.chat;
      return typeof mittel !== 'number' || eigene >= mittel;
    }
  },
  {
    key: 'reaktionen',
    relevanz: 68,
    thema: 'gemeinschaft',
    bedingung: (s) => (s.chat?.reaktionen_bekommen || 0) >= 5
  },
  {
    key: 'badges',
    relevanz: 60,
    thema: 'sammeln',
    bedingung: (s) => (s.badges?.total_earned || 0) > 0
  },
  {
    key: 'aktivster-monat',
    relevanz: 55,
    thema: 'rhythmus',
    bedingung: (s) => (s.aktivster_monat?.aktivitaeten || 0) > 0
  },
  {
    key: 'kategorie',
    relevanz: 50,
    thema: 'rhythmus',
    bedingung: (s) => (s.kategorie?.verteilung?.length || 0) > 1
  },
  {
    key: 'lieblings-event',
    relevanz: 45,
    thema: 'termine',
    bedingung: (s) => Boolean(s.events?.lieblings_event?.name)
  },
  {
    key: 'ueber-das-ziel',
    relevanz: 40,
    thema: 'ziel',
    bedingung: (s) => {
      const e = s.endspurt;
      return Boolean(e) && e.ziel_total > 0 && e.aktuell_total >= e.ziel_total;
    }
  },
  {
    key: 'endspurt',
    relevanz: 38,
    thema: 'ziel',
    // Gegenstück zu 'ueber-das-ziel' -- nie beide zusammen.
    bedingung: (s) => s.endspurt?.aktiv === true
  },
  {
    key: 'gottesdienst',
    relevanz: 35,
    thema: 'punkte',
    bedingung: (s) => (s.punkte?.gottesdienst || 0) > 0
  },
  {
    key: 'gemeinde',
    relevanz: 34,
    thema: 'punkte',
    bedingung: (s) => (s.punkte?.gemeinde || 0) > 0
  },
  {
    key: 'bonus',
    relevanz: 30,
    thema: 'punkte',
    bedingung: (s) => (s.punkte?.bonus || 0) > 0
  },
  {
    key: 'konfirmation',
    relevanz: 25,
    thema: 'weg',
    bedingung: (s) => Boolean(s.zeitraum?.konfirmation)
  },
  {
    key: 'pflicht',
    relevanz: 20,
    thema: 'termine',
    bedingung: (s) => (s.pflicht?.besucht || 0) > 0
  },
  {
    key: 'zeitraum',
    relevanz: 15,
    thema: 'weg',
    bedingung: (s) => Boolean(s.zeitraum?.start)
  },
  {
    key: 'stempel',
    relevanz: 90,
    thema: 'challenges',
    // Die Challenge-Abzeichen als eigene Seite. Anders als 'badges' (Punkte-
    // Abzeichen) hängen sie an abgegebenen Beiträgen.
    bedingung: (s) => (s.challenges?.beitraege || 0) > 0
      && Boolean(s.challenges?.top_challenge)
  },
  {
    key: 'jahrgang-vergleich',
    relevanz: 10,
    thema: 'gemeinschaft',
    // Nur wenn es überhaupt einen Schnitt gibt UND die Person darüber liegt.
    bedingung: (s, schnitt) => {
      if (!schnitt || typeof schnitt.events !== 'number') return false;
      return (s.events?.total_attended || 0) > schnitt.events;
    }
  }
];

/**
 * Wählt die Kacheln für einen Snapshot.
 *
 * @param {object} slides   die `slides` des Snapshots
 * @param {object} [schnitt] anonyme Jahrgangsmittelwerte ({chat, events, ...})
 * @param {number} [anzahl]  wie viele Kacheln insgesamt (Standard 8)
 * @returns {string[]} Kachel-Schlüssel in Anzeigereihenfolge
 */
function waehleKacheln(slides, schnitt = null, anzahl = KACHELN_PRO_PERSON) {
  if (!slides || typeof slides !== 'object') return [...FESTE_KACHELN];

  const passend = DYNAMISCHE_KACHELN
    .filter(k => {
      try {
        return k.bedingung(slides, schnitt) === true;
      } catch {
        // Eine kaputte Bedingung darf nie den ganzen Rückblick verhindern.
        return false;
      }
    })
    .sort((a, b) => b.relevanz - a.relevanz);

  // 'endspurt' und 'ueber-das-ziel' schließen einander aus: Beides zugleich
  // wäre widersprüchlich ("fast geschafft" neben "geschafft").
  const gefiltert = [];
  let zielGesetzt = false;
  for (const k of passend) {
    if (k.key === 'endspurt' || k.key === 'ueber-das-ziel') {
      if (zielGesetzt) continue;
      zielGesetzt = true;
    }
    gefiltert.push(k);
  }

  const freiePlaetze = Math.max(0, anzahl - FESTE_KACHELN.length);

  // Nach Themen streuen. Ohne diesen Schritt gewinnen bei einer aktiven
  // Person die vier obersten Plätze ALLE das Thema "challenges"
  // (challenge-momente 100, stempel 90, challenges 85 -- gemessen am
  // 02.09.2026): vier Kacheln über dasselbe, während Chat und
  // Verlässlichkeit ganz herausfielen. In der ersten Runde bekommt jedes
  // Thema höchstens eine Kachel, erst danach wird aufgefüllt.
  const dynamisch = [];
  const themenVergeben = new Set();
  for (const k of gefiltert) {
    if (dynamisch.length >= freiePlaetze) break;
    const thema = k.thema || k.key;
    if (themenVergeben.has(thema)) continue;
    themenVergeben.add(thema);
    dynamisch.push(k.key);
  }
  // Zweite Runde: verbleibende Plätze mit dem Nächstbesten füllen.
  for (const k of gefiltert) {
    if (dynamisch.length >= freiePlaetze) break;
    if (dynamisch.includes(k.key)) continue;
    dynamisch.push(k.key);
  }

  // Reihenfolge der Erzählung: Auftakt, dann das Persönliche, dann die
  // Zahlen, zum Schluss der Abschluss.
  return [
    'intro',
    ...dynamisch,
    'punkte',
    'events',
    'abschluss'
  ].filter((k, i, arr) => arr.indexOf(k) === i);
}

module.exports = {
  waehleKacheln,
  FESTE_KACHELN,
  KACHELN_PRO_PERSON,
  DYNAMISCHE_KACHELN
};
