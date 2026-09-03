import React from 'react';
import SlideBase from './SlideBase';

/**
 * Die Kategorie- und Datums-Seiten des Rueckblicks.
 *
 * SIMONS KRITIK AM ERSTEN ANLAUF (03.09.2026): "Sie sehen scheisse aus, ich
 * wollte mit Hintergrundbildern, coolen Slogans, nur Zahlen sind ultra
 * uninteressant. Bisschen witzig, bisschen nett."
 *
 * Der erste Entwurf war: kleines Label, riesige Zahl, ein Satz. Das ist eine
 * Statistikkachel, keine Erinnerung. Eine 8 sagt nichts -- "Achtmal Kirche.
 * Und jedes Mal warst du da." schon.
 *
 * DESHALB JETZT:
 *   - Der SLOGAN traegt die Seite, nicht die Zahl (Bebas Neue, gross).
 *   - Die Zahl steht klein darueber als Beiwerk ("8 MAL").
 *   - Darunter ein warmer Nachsatz, der die Zahl einordnet.
 *   - Bei kleinen Zahlen ein ANDERER Text als bei grossen: "Einmal" ist
 *     keine schlechtere 8, sondern eine eigene Geschichte.
 *
 * Bild und Farbverlauf kommen aus SlideBase (hintergrundbilder.ts).
 */

interface Props {
  isActive: boolean;
  /** z. B. 'kategorie:freizeit' oder 'datum:advent' */
  kachel: string;
  anzahl: number;
  ausTerminen?: number;
}

interface SeitenText {
  /** Kleines Label ganz oben. */
  auge: string;
  /** Der Slogan -- traegt die Seite. Bekommt die Zahl als Argument. */
  slogan: (n: number) => string;
  /** Warmer Nachsatz darunter. */
  nachsatz: (n: number) => string;
}

/**
 * Ein Text je Seite. Regeln, die dabei gelten (Simons Vorgaben):
 *   - Keine Negativ-Aussagen, keine Vergleiche nach unten.
 *   - Kasualien ruhig und zurueckhaltend -- Taufe, Trauung und Abschied sind
 *     kein Anlass fuer Ausrufezeichen.
 *   - Sonst gern augenzwinkernd.
 */
const TEXTE: Record<string, SeitenText> = {
  'kategorie:fest': {
    auge: 'Gefeiert',
    slogan: (n) => n === 1 ? 'Ein Fest.\nUnd du mittendrin.' : 'Kein Fest\nohne dich.',
    nachsatz: (n) => n === 1 ? 'Einmal dabei — und alle haben es gemerkt.' : `${n} Feste, bei denen du dabei warst.`
  },
  'kategorie:senioren': {
    auge: 'Zeit verschenkt',
    slogan: () => 'Du hast\nzugehört.',
    nachsatz: (n) => n === 1 ? 'Einmal Zeit mitgebracht — die zählt doppelt.' : `${n} Mal bei denen, die sich über Besuch freuen.`
  },
  'kategorie:jugend': {
    auge: 'Deine Leute',
    slogan: () => 'Da, wo\ndeine Leute sind.',
    nachsatz: (n) => `${n} Mal bei der Jugend — freiwillig, versteht sich.`
  },
  'kategorie:oeffentlichkeit': {
    auge: 'Nach draußen',
    slogan: () => 'Du hast es\nnach draußen\ngetragen.',
    nachsatz: (n) => `${n} Mal hast du gezeigt, was hier passiert.`
  },
  'kategorie:freizeit': {
    auge: 'Unterwegs',
    slogan: (n) => n === 1 ? 'Einmal raus.\nUnd was für ein\nMal.' : 'Koffer packen\nkannst du.',
    nachsatz: (n) => n === 1 ? 'Eine Fahrt, die bleibt.' : `${n} Mal ging es raus aus dem Alltag.`
  },
  'kategorie:weihnachten': {
    auge: 'Zwischen den Lichtern',
    slogan: () => 'Zwischen\nden Lichtern.',
    nachsatz: (n) => `${n} Mal in der Zeit, in der es früh dunkel wird.`
  },
  'kategorie:konzert': {
    auge: 'Volle Töne',
    slogan: (n) => n === 1 ? 'Ein Konzert.\nGänsehaut\ninklusive.' : 'Volle Kirche,\nvolle Töne.',
    nachsatz: (n) => n === 1 ? 'Einmal Musik, die im Raum stand.' : `${n} Konzerte, bei denen du zugehört hast.`
  },
  'kategorie:kinder': {
    auge: 'Bei den Kleinen',
    slogan: () => 'Die Kleinen\nkennen\ndeinen Namen.',
    nachsatz: (n) => `${n} Mal warst du für sie da.`
  },
  'kategorie:kreativ': {
    auge: 'Selbst gemacht',
    slogan: () => 'Aus nichts\nwurde etwas.',
    nachsatz: (n) => `${n} Mal hast du etwas entstehen lassen.`
  },
  'kategorie:seelsorge': {
    auge: 'Zugehört',
    slogan: () => 'Manchmal\nreicht dasein.',
    nachsatz: (n) => `${n} Mal ging es um das, was wirklich trägt.`
  },
  // Ruhiger Ton -- hier wird nicht gescherzt.
  'kategorie:kasualien': {
    auge: 'Dabei, wenn es zählte',
    slogan: () => 'Du warst da,\nals es\ndarauf ankam.',
    nachsatz: (n) => n === 1
      ? 'Einmal bei Taufe, Trauung oder Abschied.'
      : `${n} Mal bei Taufe, Trauung oder Abschied.`
  },
  'kategorie:gottesdienst': {
    auge: 'Sonntagstreu',
    slogan: (n) => n >= 10 ? 'Der Sonntag\ngehört dir.' : 'Sonntags\nwarst du da.',
    nachsatz: (n) => `${n} Mal im Gottesdienst — und keiner war umsonst.`
  },
  'kategorie:gemeinde': {
    auge: 'Mit angepackt',
    slogan: () => 'Ohne Leute\nwie dich\nläuft hier nichts.',
    nachsatz: (n) => `${n} Mal hast du mit angepackt.`
  },

  'datum:weihnachten': {
    auge: 'Heiligabend',
    slogan: () => 'Heiligabend.\nDu warst\nin der Kirche.',
    nachsatz: () => 'Während andere die Geschenke suchten.'
  },
  'datum:advent': {
    auge: 'Advent',
    slogan: (n) => n >= 4 ? 'Vier Kerzen.\nUnd du bei\njeder dabei.' : 'Es wurde dunkel.\nDu kamst\ntrotzdem.',
    nachsatz: (n) => n === 1 ? 'Einmal im Advent — mitten in der vollsten Zeit des Jahres.' : `${n} Mal im Advent dabei.`
  },
  'datum:jahreswechsel': {
    auge: 'Zwischen den Jahren',
    slogan: () => 'Zwischen\nden Jahren.',
    nachsatz: (n) => `${n} Mal in den Tagen, an denen sonst niemand weiß, welcher Tag ist.`
  },
  'datum:ostern': {
    auge: 'Passion und Ostern',
    slogan: () => 'Den ganzen Weg.\nBis Ostern.',
    nachsatz: (n) => `${n} Mal auf dem Weg durch die Karwoche.`
  },
  'datum:erntedank': {
    auge: 'Erntedank',
    slogan: () => 'Danke sagen\nfür das,\nwas da ist.',
    nachsatz: () => 'Beim Erntedankfest warst du dabei.'
  },
  'datum:sommer': {
    auge: 'Sommer',
    slogan: () => 'Sommer.\nUnd du\nmittendrin.',
    nachsatz: (n) => `${n} Mal, als es draußen am schönsten war.`
  },

  'kategorie-allgemein': {
    auge: 'Dein Schwerpunkt',
    slogan: () => 'Du hast\ndein Ding\ngefunden.',
    nachsatz: (n) => `${n} Mal in deinem Bereich unterwegs.`
  }
};

const KategorieSeiteSlide: React.FC<Props> = ({ isActive, kachel, anzahl, ausTerminen }) => {
  const text = TEXTE[kachel];
  // Unbekannter Schluessel: lieber gar nichts zeigen als eine leere Seite.
  if (!text) return null;

  // Farbklasse je Seite ('kategorie:fest' -> 'k-fest', 'datum:advent' ->
  // 'd-advent'). SlideBase liest den Verlauf aus dem CSS und legt ihn als
  // Schleier ueber das Foto -- Farbe und Bild gehoeren zusammen.
  const farbklasse = kachel.startsWith('datum:')
    ? `d-${kachel.slice('datum:'.length)}`
    : kachel.startsWith('kategorie:')
      ? `k-${kachel.slice('kategorie:'.length)}`
      : 'k-allgemein';

  return (
    <SlideBase
      isActive={isActive}
      className={`kategorie-seite-slide ${farbklasse}`}
      kachel={kachel}
    >
      <div className="kat-auge">{text.auge}</div>

      {/* Die Zahl klein und beilaeufig -- sie ordnet ein, traegt aber nicht. */}
      <div className="kat-zahl">
        {anzahl}<span className="kat-zahl__mal">×</span>
      </div>

      {/* Der Slogan traegt die Seite. Zeilenumbrueche stehen im Text und
          sind Absicht: Sie geben den Rhythmus vor. */}
      <div className="kat-slogan">
        {text.slogan(anzahl).split('\n').map((zeile, i) => (
          <span key={i} style={{ display: 'block' }}>{zeile}</span>
        ))}
      </div>

      <div className="kat-nachsatz">{text.nachsatz(anzahl)}</div>

      {typeof ausTerminen === 'number' && ausTerminen > 0 && ausTerminen < anzahl && (
        <div className="kat-fussnote">
          davon {ausTerminen} {ausTerminen === 1 ? 'Termin' : 'Termine'}
        </div>
      )}
    </SlideBase>
  );
};

export default KategorieSeiteSlide;
