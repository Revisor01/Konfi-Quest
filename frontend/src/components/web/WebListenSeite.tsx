// Die Huelle jeder Listen-Seite der Web-Fassung (10.10.2026; Simon: „web soll
// eine kachel-, liste-, details-logik haben für alle seiten ... ich will die
// arbeiten am web so einfach wie möglich machen"). Eine Seite besteht damit nur
// noch aus Spalten (WebListe), Karte (WebKacheln) und Daten:
//
//   Kopf (WebSeite: Titel, Untertitel, Aktionen, Weg zurueck)
//   Kennzahlen         -- eine Reihe WebKachel, mit Symbol und Bereichsfarbe
//   Werkzeugzeile      -- Reiter, Filter-Chips, Suche, Filter-Auswahlen;
//                         rechts Zaehlzeile, eigene Knoepfe, "Sortieren" (nur
//                         Kacheln) und ganz rechts der Umschalter Liste | Kacheln
//   Inhalt             -- Tabelle in einer Karte oder Kacheln frei im Raster;
//                         Laden, Fehler und Leerzustand in der Karte
//
// Reiter und Filter kommen aus der Seitenbeschreibung (seiten/*.ts, `Wahl` mit
// `passt`): Die Huelle zeigt nur die Wahlen der Web-Fassung, filtert die
// Eintraege nach `passt` und zaehlt je Chip, wenn `zahlen` gesetzt ist. Die
// Suche filtert ueber `felder` (Umlaute wie ueberall: "mueller" findet
// "Müller"). Den Zustand (Reiter, Filter, Suchtext) haelt die Seite -- sie
// braucht ihn fuer Treffer, Leertexte und Messung.
//
// Sortieren: Ohne `sortierung` sortiert die Tabelle selbst nach `sortWert`
// ihrer Spalten. Mit `sortierung` haelt die Huelle die Ordnung -- je Reiter
// eine -- und dieselbe Ordnung gilt fuer Liste und Kacheln; die Kacheln
// haben keine Spaltenkoepfe und bekommen dafuer die Auswahl "Sortieren"
// (`auswahl`), die dieselbe Sortierung setzt.

import React, { useMemo, useState } from 'react';
import WebSeite, { type WebSeiteProps } from './WebSeite';
import WebKachel, { type WebKachelProps } from './WebKachel';
import WebChips from './WebChips';
import WebSuche from './WebSuche';
import WebFilterAuswahl from './WebFilterAuswahl';
import WebAnsichtUmschalter from './WebAnsichtUmschalter';
import WebListe, { type WebListeProps, type WebSortierung } from './WebListe';
import WebKacheln, { type WebKachelnProps } from './WebKacheln';
import { WebFehler, WebLaden, WebLeer, type WebLeerProps } from './WebZustaende';
import { useAnsicht, type WebAnsicht, type WebAnsichtSeite } from './useAnsicht';
import { inFassung, type Wahl } from '../../seiten/beschreibung';
import { suchTreffer, suchbegriff } from '../../utils/supportWeb';

/** Reiter oben links (Konfis | Team): wechseln meist die ganze Liste. */
export interface WebListenReiter<R extends string> {
  /** Name der Gruppe fuer Vorleseprogramme. */
  beschriftung: string;
  wahlen: ReadonlyArray<Wahl<R>>;
  wert: R;
  onWert: (wert: R) => void;
  /** Zahl je Reiter; fehlt sie, steht keine Zahl da (z. B. noch nicht geladen). */
  zahlen?: Partial<Record<R, number>>;
}

/** Ein Filter der Werkzeugzeile: Chips (Vorgabe) oder eine Auswahl. Die erste Wahl ist "alle". */
export interface WebListenFilter<T> {
  beschriftung: string;
  darstellung?: 'chips' | 'auswahl';
  /** Die Wahlen mit `passt`; eine Wahl ohne `passt` laesst alles durch. */
  wahlen: ReadonlyArray<Wahl<string, T>>;
  wert: string;
  onWert: (wert: string) => void;
  /** Zahl je Chip, gezaehlt ueber alle Eintraege (vor Suche und anderen Filtern). */
  zahlen?: boolean;
}

export interface WebListenSuche<T> {
  beschriftung: string;
  platzhalter?: string;
  wert: string;
  onWert: (wert: string) => void;
  /** Die Texte eines Eintrags, in denen gesucht wird. */
  felder: (eintrag: T) => ReadonlyArray<string | null | undefined>;
}

export interface WebListenSortierung<T> {
  /** Die Ordnung beim ersten Oeffnen (je Reiter). */
  start: WebSortierung;
  /** Ordnet die Eintraege (stabil, mit eigenem Gleichstand -- z. B. nach Name). */
  sortiere: (eintraege: readonly T[], sortierung: WebSortierung) => T[];
  /** Die Richtung beim ersten Klick auf einen Kopf; Vorgabe aufsteigend. */
  ersteRichtung?: (schluessel: string) => 'auf' | 'ab';
  /** Die Stellungen fuer die Auswahl "Sortieren" in der Ansicht Kacheln. */
  auswahl?: ReadonlyArray<{ schluessel: string; richtung: 'auf' | 'ab'; label: string }>;
}

export interface WebListenSeiteProps<T, R extends string = string> extends Omit<WebSeiteProps, 'children'> {
  /** Hinweise ueber den Kennzahlen (Probezeit, Neuerungen). */
  oben?: React.ReactNode;
  kennzahlen?: ReadonlyArray<WebKachelProps>;
  reiter?: WebListenReiter<R>;
  filter?: ReadonlyArray<WebListenFilter<T> | false | null | undefined>;
  suche?: WebListenSuche<T>;
  /** Eigene Knoepfe rechts in der Werkzeugzeile (vor dem Umschalter). */
  werkzeuge?: React.ReactNode;
  /** "2 von 5 Konfis" -- steht nur da, wenn gesucht oder gefiltert wird. */
  zaehlzeile?: (sichtbar: number, gesamt: number) => string;
  /** Welche Seite (die Wahl Liste/Kacheln wird je Seite gemerkt) und womit sie startet. */
  ansicht: { seite: WebAnsichtSeite; vorgabe: WebAnsicht };
  eintraege: readonly T[];
  sortierung?: WebListenSortierung<T>;
  liste: Omit<WebListeProps<T>, 'zeilen' | 'leer' | 'sortierung' | 'onSortieren'>;
  kacheln: Omit<WebKachelnProps<T>, 'eintraege'>;
  /** Steht statt Liste und Kacheln, wenn nach Suche und Filtern nichts bleibt. */
  leer: WebLeerProps;
  /** Die ganze Seite laedt: nur Platzhalter unter dem Kopf. */
  laden?: { text: string; kacheln?: number; karten?: number };
  /** Die ganze Seite konnte nicht geladen werden. */
  fehler?: { text: string; onErneut: () => void };
  /** Nur der Inhalt unter der Werkzeugzeile laedt (Reiter wird nachgeladen). */
  inhaltLaden?: string;
  inhaltFehler?: { text: string; onErneut: () => void };
  /** Nach dem Inhalt (Fenster der Seite). */
  children?: React.ReactNode;
}

const sortierWert = (s: { schluessel: string; richtung: 'auf' | 'ab' }): string => `${s.schluessel}:${s.richtung}`;

function WebListenSeite<T, R extends string = string>(props: WebListenSeiteProps<T, R>): React.ReactElement {
  const {
    oben, kennzahlen, reiter, filter, suche, werkzeuge, zaehlzeile, ansicht, eintraege, sortierung, liste, kacheln, leer,
    laden, fehler, inhaltLaden, inhaltFehler, children, ...seite
  } = props;
  const [darstellung, setDarstellung] = useAnsicht(ansicht.seite, ansicht.vorgabe);
  // Je Reiter eine Ordnung: Wer im Team nach Badges sortiert, findet die Konfis unveraendert.
  const [sortierungen, setSortierungen] = useState<Record<string, WebSortierung>>({});
  const reiterSchluessel = reiter?.wert ?? '';
  const aktuelleSortierung = sortierung ? sortierungen[reiterSchluessel] ?? sortierung.start : undefined;
  const setzeSortierung = (s: WebSortierung) => setSortierungen((alt) => ({ ...alt, [reiterSchluessel]: s }));

  const filterListe = useMemo(() => (filter ?? []).filter((f): f is WebListenFilter<T> => Boolean(f)), [filter]);
  const sucht = suche ? suchbegriff(suche.wert) !== '' : false;
  const gefiltert = filterListe.some((f) => f.wert !== f.wahlen[0]?.schluessel);

  const sichtbar = useMemo(() => {
    const passend = eintraege.filter((e) =>
      filterListe.every((f) => f.wahlen.find((w) => w.schluessel === f.wert)?.passt?.(e) ?? true)
      && (!suche || !sucht || suche.felder(e).some((t) => !!t && suchTreffer(t, suche.wert).length > 0)));
    return sortierung && aktuelleSortierung ? sortierung.sortiere(passend, aktuelleSortierung) : passend;
  }, [eintraege, filterListe, suche, sucht, sortierung, aktuelleSortierung]);

  if (laden || fehler) {
    return (
      <WebSeite {...seite}>
        {laden
          ? <WebLaden kacheln={laden.kacheln} karten={laden.karten ?? 1} text={laden.text} />
          : fehler && <WebFehler text={fehler.text} onErneut={fehler.onErneut} />}
      </WebSeite>
    );
  }

  const sortiereNach = (schluessel: string) => {
    if (!sortierung || !aktuelleSortierung) return;
    if (aktuelleSortierung.schluessel === schluessel) setzeSortierung({ schluessel, richtung: aktuelleSortierung.richtung === 'auf' ? 'ab' : 'auf' });
    else setzeSortierung({ schluessel, richtung: sortierung.ersteRichtung?.(schluessel) ?? 'auf' });
  };

  let inhalt: React.ReactNode;
  // Wahr, sobald Karten im Raster zu sehen sind (nicht Laden, Fehler oder Leerzustand).
  let kachelnSichtbar = false;
  if (inhaltLaden) {
    inhalt = <WebLaden karten={1} text={inhaltLaden} />;
  } else if (inhaltFehler) {
    inhalt = <WebFehler text={inhaltFehler.text} onErneut={inhaltFehler.onErneut} />;
  } else if (sichtbar.length === 0) {
    inhalt = <WebLeer {...leer} />;
  } else if (darstellung === 'kacheln') {
    inhalt = <WebKacheln {...kacheln} eintraege={sichtbar} />;
    kachelnSichtbar = true;
  } else {
    inhalt = sortierung
      ? <WebListe {...liste} zeilen={sichtbar} sortierung={aktuelleSortierung} onSortieren={sortiereNach} />
      : <WebListe {...liste} zeilen={sichtbar} />;
  }

  const mitSortierAuswahl = kachelnSichtbar && Boolean(sortierung?.auswahl?.length);
  const zahl = zaehlzeile && (sucht || gefiltert) ? zaehlzeile(sichtbar.length, eintraege.length) : undefined;
  const chipFilter = filterListe.filter((f) => (f.darstellung ?? 'chips') === 'chips');
  const auswahlFilter = filterListe.filter((f) => f.darstellung === 'auswahl');

  return (
    <WebSeite {...seite}>
      {oben}

      {kennzahlen && kennzahlen.length > 0 && (
        <div className="web-raster web-raster--kacheln">
          {kennzahlen.map((k) => <WebKachel key={k.label} {...k} />)}
        </div>
      )}

      <div className={`web-werkzeuge${mitSortierAuswahl ? ' web-werkzeuge--kacheln' : ''}`}>
        {reiter && (
          <WebChips<R>
            beschriftung={reiter.beschriftung}
            wert={reiter.wert}
            onWert={reiter.onWert}
            chips={inFassung(reiter.wahlen, 'web').map((w) => {
              const n = reiter.zahlen?.[w.schluessel];
              return { wert: w.schluessel, label: w.label, zahl: n, zahlText: n === undefined ? undefined : w.zahlText?.(n) };
            })}
          />
        )}
        {chipFilter.map((f) => (
          <WebChips<string>
            key={f.beschriftung}
            beschriftung={f.beschriftung}
            wert={f.wert}
            onWert={f.onWert}
            chips={inFassung(f.wahlen, 'web').map((w) => ({
              wert: w.schluessel,
              label: w.label,
              zahl: f.zahlen ? eintraege.filter((e) => w.passt?.(e) ?? true).length : undefined,
            }))}
          />
        ))}
        {suche && <WebSuche beschriftung={suche.beschriftung} platzhalter={suche.platzhalter} wert={suche.wert} onWert={suche.onWert} />}
        {auswahlFilter.map((f) => (
          <WebFilterAuswahl
            key={f.beschriftung}
            label={f.beschriftung}
            wert={f.wert}
            onWert={f.onWert}
            optionen={inFassung(f.wahlen, 'web').map((w) => ({ wert: w.schluessel, label: w.label }))}
          />
        ))}
        <div className="web-werkzeuge__rechts">
          {zahl && <span className="web-gedaempft web-werkzeuge__zahl" role="status">{zahl}</span>}
          {werkzeuge}
          {mitSortierAuswahl && sortierung?.auswahl && aktuelleSortierung && (
            <WebFilterAuswahl
              label="Sortieren"
              wert={sortierWert(aktuelleSortierung)}
              onWert={(w) => {
                const [schluessel, richtung] = w.split(':');
                setzeSortierung({ schluessel, richtung: richtung === 'ab' ? 'ab' : 'auf' });
              }}
              optionen={sortierung.auswahl.map((s) => ({ wert: sortierWert(s), label: s.label }))}
            />
          )}
          {/* Der Umschalter steht immer ganz rechts. */}
          <WebAnsichtUmschalter wert={darstellung} onWert={setDarstellung} />
        </div>
      </div>

      {/* Die Kacheln stehen frei im Raster, die Tabelle und jeder Hinweis in einer Karte. */}
      {kachelnSichtbar ? inhalt : <div className="web-karte">{inhalt}</div>}

      {children}
    </WebSeite>
  );
}

export default WebListenSeite;
