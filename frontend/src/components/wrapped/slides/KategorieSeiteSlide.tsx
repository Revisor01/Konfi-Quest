import React from 'react';
import SlideBase from './SlideBase';

/**
 * Die Kategorie- und Datums-Seiten des Rueckblicks.
 *
 * Simons Vorgabe (03.09.2026): Nicht EINE Seite mit wechselndem Inhalt,
 * sondern mehrere feste, benannte Seiten -- jede mit eigenem Bild, eigener
 * Farbe und eigenem Text. Welche erscheint, entscheidet das Backend
 * (utils/wrappedKacheln.js) und legt es als `kacheln` in den Snapshot.
 *
 * Zwei Arten von Schluesseln:
 *   kategorie:freizeit   -- aus der Kategorie des Termins/der Aktivitaet
 *   datum:weihnachten    -- aus dem event_date, unabhaengig vom Namen
 *
 * Das Datum geht vor: "Gottesdienst im Dezember ist ja immer auch Advent."
 */

interface Props {
  isActive: boolean;
  /** z. B. 'kategorie:freizeit' oder 'datum:advent' */
  kachel: string;
  /** Wie oft -- getrennt nach Terminen und Aktivitaeten. */
  anzahl: number;
  ausTerminen?: number;
}

/**
 * Text je Seite. Der Ton folgt dem Anlass: Kasualien ruhig und
 * zurueckhaltend (Taufe, Trauung, Beerdigung sind kein Anlass fuer
 * Ausrufezeichen), Fest und Konzert dagegen laut.
 *
 * KEINE Negativ-Formulierungen und keine Vergleiche nach unten
 * (Simons Regel, gilt unveraendert).
 */
const TEXTE: Record<string, { titel: string; zeile: (n: number) => string }> = {
  'kategorie:fest': { titel: 'Mitgefeiert', zeile: (n) => n === 1 ? 'Bei einem Fest warst du dabei.' : `Bei ${n} Festen warst du dabei.` },
  'kategorie:senioren': { titel: 'Zeit verschenkt', zeile: (n) => `${n} Mal warst du bei den Aelteren in der Gemeinde.` },
  'kategorie:jugend': { titel: 'Deine Leute', zeile: (n) => `${n} Mal warst du bei der Jugend.` },
  'kategorie:oeffentlichkeit': { titel: 'Nach draussen getragen', zeile: (n) => `${n} Mal hast du die Gemeinde sichtbar gemacht.` },
  'kategorie:freizeit': { titel: 'Unterwegs', zeile: (n) => n === 1 ? 'Einmal ging es raus.' : `${n} Mal ging es raus.` },
  'kategorie:weihnachten': { titel: 'Zwischen den Lichtern', zeile: (n) => `${n} Mal in der Advents- und Weihnachtszeit.` },
  'kategorie:konzert': { titel: 'Volle Kirche, volle Toene', zeile: (n) => n === 1 ? 'Ein Konzert, bei dem du dabei warst.' : `${n} Konzerte, bei denen du dabei warst.` },
  'kategorie:kinder': { titel: 'Bei den Kleinen', zeile: (n) => `${n} Mal warst du fuer die Kinder da.` },
  'kategorie:kreativ': { titel: 'Selbst gemacht', zeile: (n) => `${n} Mal hast du etwas entstehen lassen.` },
  'kategorie:seelsorge': { titel: 'Zugehoert', zeile: (n) => `${n} Mal ging es um das, was traegt.` },
  'kategorie:kasualien': { titel: 'Du warst dabei, wenn es zaehlte', zeile: (n) => `${n} Mal bei Taufe, Trauung oder Abschied.` },
  'kategorie:gottesdienst': { titel: 'Sonntagstreu', zeile: (n) => `${n} Mal im Gottesdienst.` },
  'kategorie:gemeinde': { titel: 'Mit angepackt', zeile: (n) => `${n} Mal fuer die Gemeinde im Einsatz.` },

  'datum:weihnachten': { titel: 'Heiligabend', zeile: () => 'Weihnachten in der Kirche — du warst da.' },
  'datum:advent': { titel: 'Vier Kerzen', zeile: (n) => n === 1 ? 'Einmal im Advent warst du dabei.' : `${n} Mal warst du im Advent dabei.` },
  'datum:jahreswechsel': { titel: 'Zwischen den Jahren', zeile: (n) => `${n} Mal zwischen den Jahren.` },
  'datum:ostern': { titel: 'Von Passion bis Ostern', zeile: (n) => `${n} Mal auf dem Weg durch die Karwoche.` },
  'datum:erntedank': { titel: 'Erntedank', zeile: () => 'Beim Erntedankfest warst du dabei.' },
  'datum:sommer': { titel: 'Sommer', zeile: (n) => `${n} Mal im Sommer unterwegs.` },

  'kategorie-allgemein': { titel: 'Dein Schwerpunkt', zeile: (n) => `${n} Mal in deinem Bereich unterwegs.` }
};

const KategorieSeiteSlide: React.FC<Props> = ({ isActive, kachel, anzahl, ausTerminen }) => {
  const text = TEXTE[kachel];
  // Unbekannter Schluessel: lieber gar nichts zeigen als eine leere Seite.
  if (!text) return null;

  return (
    <SlideBase isActive={isActive} className="kategorie-seite-slide" kachel={kachel}>
      <div className="w-label">{text.titel}</div>
      <div className="w-zahl">{anzahl}</div>
      <div className="w-text">{text.zeile(anzahl)}</div>
      {typeof ausTerminen === 'number' && ausTerminen > 0 && ausTerminen < anzahl && (
        <div className="w-label" style={{ marginTop: 12, opacity: 0.75 }}>
          davon {ausTerminen} {ausTerminen === 1 ? 'Termin' : 'Termine'}
        </div>
      )}
    </SlideBase>
  );
};

export default KategorieSeiteSlide;
