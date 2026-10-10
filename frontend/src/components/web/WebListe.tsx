// Die EINE Tabelle der Web-Fassung (Ansicht "Liste", 10.10.2026): echte
// <table> mit Kopfzeile (bleibt beim Scrollen oben stehen), Hover,
// rechtsbuendigen Zahlen (tabular-nums). Die Zellen liefert die Seite -- die
// Tabelle kennt nur Spalten und Zeilen, dazu drei feste Teile:
//
//   - WebNameZelle: der Name in der ersten Spalte, mit Kreis (WebKreis) und
//     leiser Zeile darunter; ein echter Link (`href`) oder ein Knopf
//     (`onKlick`), dessen Netz sich ueber die ganze Zeile spannt
//     (`web-link--zeile`, theme/web-ansicht.css) -- Mittelklick geht auch auf
//     der Zeile;
//   - die Aktionen am Ende der Zeile (`bearbeiten`, `loeschen`): kleine Knoepfe
//     mit Symbol, je mit dem Namen der Zeile fuer Vorleseprogramme;
//   - der Leerzustand (`leer`) statt einer Tabelle ohne Zeilen.
//
// Sortieren: Eine Spalte mit `sortWert` hat einen Kopf zum Anklicken -- erst
// aufsteigend, dann absteigend (Simon, 07.10.2026: „bitte alle listen
// sortierbar machen durch klick auf den spaltennamen"). Bis zum ersten Klick
// gilt die Reihenfolge der Seite. Haelt die Seite die Ordnung selbst
// (`sortierung` + `onSortieren`: Liste und Kacheln in derselben Ordnung,
// WebListenSeite), sortiert die Tabelle nicht, sondern meldet nur den Klick;
// sortierbar ist dann jede Spalte mit `sortWert` oder `sortierbar`.
// Der Zustand steht als aria-sort am Kopf, der Pfeil daneben ist Zierde.
//
// Bis 10.10.2026 gab es zwei Tabellen: WebTabelle (sortiert selbst) und
// WebSortTabelle (Ordnung von der Seite). Beide reichen jetzt hierher durch,
// bis keine Seite sie mehr nutzt.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_BEARBEITEN, ICON_LOESCHEN, ICON_ZUKLAPPEN } from '../shared/icons';
import {
  ariaSortVon,
  naechsteSortierung,
  sortiereZeilen,
  type SortWert,
  type TabellenSortierung,
} from '../../utils/tabelleSortieren';
import WebKnopf from './WebKnopf';
import WebLink from './WebLink';
import { WebLeer, type WebLeerProps } from './WebZustaende';

export interface WebSpalte<T> {
  schluessel: string;
  kopf: string;
  zelle: (zeile: T, index: number) => React.ReactNode;
  /** Zahlen stehen rechts. */
  zahl?: boolean;
  /** Weicht auf schmaler Flaeche zuerst (unter 900 px Tabellenbreite). */
  optional?: boolean;
  /** Spaltenbreite als CSS-Wert, z. B. '16%' oder '120px'. */
  breite?: string;
  /** Kopf nur fuer Vorleseprogramme (z. B. Aktionen). */
  kopfVersteckt?: boolean;
  /** Eigene Klasse an Kopf und Zellen der Spalte (Breite im Stylesheet statt inline). */
  klasse?: string;
  /** Wonach die Spalte sortiert (Text, Zahl, Datum); ohne ihn ist der Kopf nicht anklickbar. */
  sortWert?: (zeile: T) => SortWert;
  /** Sortierbar, obwohl die Seite sortiert (ohne `sortWert`; nur mit `onSortieren`). */
  sortierbar?: boolean;
}

export type WebSortierung = TabellenSortierung;

/** Eine Aktion an einer Zeile oder Kachel: was sie tut und wie der Knopf fuer Vorleseprogramme heisst. */
export interface WebAktion<T> {
  onKlick: (eintrag: T) => void;
  /** Name des Knopfs ("Anna Müller löschen", "Aktivität bearbeiten"). */
  beschriftung: (eintrag: T) => string;
  /** Text beim Darueberfahren; Vorgabe ist die Beschriftung. */
  titel?: (eintrag: T) => string;
}

/** Der Kopf einer sortierbaren Spalte: der Name als Knopf, daneben der Pfeil. */
export const WebSortKopf: React.FC<{ kopf: string; aktiv: boolean; richtung?: 'auf' | 'ab'; onKlick: () => void }> = ({ kopf, aktiv, richtung, onKlick }) => (
  <button type="button" className="web-sortkopf" onClick={onKlick}>
    {kopf}
    <IonIcon
      icon={aktiv && richtung === 'auf' ? ICON_ZUKLAPPEN : ICON_AUFKLAPPEN}
      className={aktiv ? 'web-sortkopf__pfeil web-sortkopf__pfeil--aktiv' : 'web-sortkopf__pfeil'}
      aria-hidden="true"
    />
  </button>
);

export interface WebNameZelleProps {
  /** Der Name (oft mit WebTreffer fuer die Suche). */
  titel: React.ReactNode;
  /** Kreis davor (WebKreis); mit Kreis bleibt der Name einzeilig. */
  kreis?: React.ReactNode;
  /** Ziel als echter Link ... */
  href?: string;
  /** ... oder ein Klick (oeffnet ein Fenster statt einer Seite). */
  onKlick?: () => void;
  /** Name des Knopfs fuer Vorleseprogramme, wenn `onKlick` gesetzt ist. */
  beschriftung?: string;
  /** Leise Zeile darunter (Benutzername, Beschreibung). */
  unterzeile?: React.ReactNode;
  /** Langer Text der Unterzeile zum Darueberfahren. */
  unterzeileTitel?: string;
}

/** Die erste Zelle einer Zeile: Kreis, Name als Link oder Knopf, leise Zeile darunter. */
export const WebNameZelle: React.FC<WebNameZelleProps> = ({ titel, kreis, href, onKlick, beschriftung, unterzeile, unterzeileTitel }) => {
  const einzeilig = kreis ? ' web-einzeilig' : '';
  const name = href ? (
    <WebLink href={href} className={`web-link--zeile web-link--text${einzeilig}`}>{titel}</WebLink>
  ) : onKlick ? (
    <button type="button" className={`web-link web-link--zeile web-link--text web-link--knopf${einzeilig}`} aria-label={beschriftung} onClick={onKlick}>
      {titel}
    </button>
  ) : (
    <span className={`web-zelle-titel${einzeilig}`}>{titel}</span>
  );
  const darunter = unterzeile ? <span className="web-zelle-leise web-einzeilig" title={unterzeileTitel}>{unterzeile}</span> : null;
  if (!kreis) return <>{name}{darunter}</>;
  return (
    <span className="web-person-zelle">
      {kreis}
      <span className="web-person-zelle__text">{name}{darunter}</span>
    </span>
  );
};

/** Die Knoepfe am Ende einer Zeile: nur Symbol, der Name steht in der Beschriftung. */
function WebZeilenKnoepfe<T>({ eintrag, bearbeiten, loeschen }: { eintrag: T; bearbeiten?: WebAktion<T>; loeschen?: WebAktion<T> }): React.ReactElement {
  return (
    <div className="web-liste-aktionen">
      {bearbeiten && (
        <WebKnopf klein symbol vorn aria-label={bearbeiten.beschriftung(eintrag)} title={(bearbeiten.titel ?? bearbeiten.beschriftung)(eintrag)} onClick={() => bearbeiten.onKlick(eintrag)}>
          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
        </WebKnopf>
      )}
      {loeschen && (
        <WebKnopf klein symbol vorn art="gefahr" aria-label={loeschen.beschriftung(eintrag)} title={(loeschen.titel ?? loeschen.beschriftung)(eintrag)} onClick={() => loeschen.onKlick(eintrag)}>
          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
        </WebKnopf>
      )}
    </div>
  );
}

export interface WebListeProps<T> {
  /** Name der Tabelle fuer Vorleseprogramme. */
  beschriftung: string;
  spalten: ReadonlyArray<WebSpalte<T>>;
  zeilen: readonly T[];
  zeileSchluessel: (zeile: T) => string | number;
  /** Zusaetzliche Klasse je Zeile (z. B. web-ungelesen). */
  zeileKlasse?: (zeile: T) => string | undefined;
  /** Zellen mittig statt oben ausrichten. */
  mittig?: boolean;
  /**
   * Feste Spaltenbreiten (`breite` der Spalten): mehrere Tabellen untereinander
   * -- eine je Kirchenkreis -- halten so ihre Spalten auf einer Linie. Eine
   * Spalte ohne Breite nimmt den Rest.
   */
  fest?: boolean;
  /** Zusaetzliche Klasse an der Tabelle. */
  klasse?: string;
  /** Die Ordnung haelt die Seite: aktuelle Sortierung ... */
  sortierung?: WebSortierung;
  /** ... und der Klick auf einen Kopf (Schluessel der Spalte). */
  onSortieren?: (schluessel: string) => void;
  /** Bearbeiten am Ende der Zeile; fehlt es, steht der Knopf nicht da. */
  bearbeiten?: WebAktion<T>;
  /** Loeschen am Ende der Zeile; fehlt es, steht der Knopf nicht da. */
  loeschen?: WebAktion<T>;
  /** Steht statt der Tabelle, wenn es keine Zeilen gibt. */
  leer?: WebLeerProps;
}

function WebListe<T>({
  beschriftung, spalten, zeilen, zeileSchluessel, zeileKlasse, mittig = false, fest = false, klasse,
  sortierung, onSortieren, bearbeiten, loeschen, leer,
}: WebListeProps<T>): React.ReactElement {
  const aussen = Boolean(onSortieren);
  const [eigene, setEigene] = useState<TabellenSortierung | null>(null);
  const aktuell = aussen ? sortierung ?? null : eigene;

  const alleSpalten = useMemo<ReadonlyArray<WebSpalte<T>>>(() => {
    if (!bearbeiten && !loeschen) return spalten;
    const zwei = Boolean(bearbeiten && loeschen);
    return [...spalten, {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: zwei ? '112px' : undefined,
      klasse: zwei ? 'web-spalte-liste-aktionen' : 'web-spalte-liste-aktionen web-spalte-aktionen-schmal',
      zelle: (z: T) => <WebZeilenKnoepfe eintrag={z} bearbeiten={bearbeiten} loeschen={loeschen} />,
    }];
  }, [spalten, bearbeiten, loeschen]);

  const sortierbar = (s: WebSpalte<T>) => Boolean(s.sortWert) || (aussen && Boolean(s.sortierbar));
  const sortSpalte = !aussen && eigene ? alleSpalten.find((s) => s.schluessel === eigene.schluessel && s.sortWert) : undefined;
  const geordnet = useMemo(
    () => (sortSpalte?.sortWert && eigene ? sortiereZeilen(zeilen, sortSpalte.sortWert, eigene.richtung) : zeilen),
    [zeilen, eigene, sortSpalte],
  );

  if (zeilen.length === 0 && leer) return <WebLeer {...leer} />;

  const klick = (schluessel: string) => {
    if (onSortieren) onSortieren(schluessel);
    else setEigene((jetzt) => naechsteSortierung(jetzt, schluessel));
  };
  const zellKlasse = (s: WebSpalte<T>) =>
    [s.zahl ? 'web-zahl' : '', s.optional ? 'web-optional' : '', s.klasse ?? ''].filter(Boolean).join(' ') || undefined;

  return (
    <div className="web-tabelle-huelle">
      <div className="web-tabelle-scroll">
        <table className={['web-tabelle', mittig ? 'web-tabelle--mittig' : '', fest ? 'web-tabelle--fest' : '', klasse ?? ''].filter(Boolean).join(' ')} aria-label={beschriftung}>
          <thead>
            <tr>
              {alleSpalten.map((s) => (
                <th
                  key={s.schluessel}
                  scope="col"
                  className={zellKlasse(s)}
                  style={s.breite ? { width: s.breite } : undefined}
                  aria-sort={ariaSortVon(sortierbar(s), aktuell, s.schluessel)}
                >
                  {sortierbar(s) && !s.kopfVersteckt ? (
                    <WebSortKopf kopf={s.kopf} aktiv={aktuell?.schluessel === s.schluessel} richtung={aktuell?.richtung} onKlick={() => klick(s.schluessel)} />
                  ) : s.kopfVersteckt ? <span className="web-nur-vorlesen">{s.kopf}</span> : s.kopf}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {geordnet.map((zeile, index) => (
              <tr key={zeileSchluessel(zeile)} className={['web-zeile', zeileKlasse?.(zeile) ?? ''].filter(Boolean).join(' ')}>
                {alleSpalten.map((s) => (
                  <td key={s.schluessel} className={zellKlasse(s)}>{s.zelle(zeile, index)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WebListe;
