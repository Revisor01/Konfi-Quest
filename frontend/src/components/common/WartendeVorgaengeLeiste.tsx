import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_UHRZEIT, ICON_WARNHINWEIS } from '../shared/icons';
import { useWartendeVorgaenge } from '../../hooks/useWartendeVorgaenge';
import { oeffnePostfach } from '../../utils/postfach';

/**
 * Kompakter Knopf, der erscheint, sobald etwas in der Offline-Warteschlange
 * liegt oder endgueltig gescheitert ist. Antippen oeffnet das Postfach.
 *
 * UEBERGANGSLOESUNG (seit 25.09.2026): Simon zum Knopf — "sitzt an einer
 * komischen Stelle", "falsch im Layout". Seine Aufgabe uebernimmt die Glocke
 * in der gemeinsamen Kopfzeile (shared/AppKopfzeile, shared/PostfachGlocke),
 * die Warteschlange steht dort im Postfach (common/PostfachModal). Die
 * Umstellung laeuft GESTUFT: zuerst die Konfi-Rolle; App.tsx blendet diesen
 * Knopf fuer Konfis deshalb aus. Team und Leitung behalten ihn, bis auch ihre
 * Kopfzeilen umgestellt sind — ohne ihn saehen sie bis dahin gar nicht, dass
 * noch etwas aussteht. Danach kann diese Datei weg.
 *
 * War bis zum 30.08.2026 eine vollbreite orange Leiste. Simons Einwand:
 * "fast ein bisschen doll" — fuer drei Vorgangsarten (Abmeldung, Aktivitaet
 * melden, Chat) ein Dauerbalken ueber der ganzen App. Anmelden und
 * Warteliste sind offline naemlich GESPERRT, nicht eingereiht; die Leiste
 * versprach mehr, als die Warteschlange traegt.
 *
 * Seither: runder Knopf mit Zaehler-Badge, Farbe nur am Badge. Der volle Satz
 * steht im aria-label (Screenreader lesen ihn weiter) und im Postfach. Sitzt
 * LINKS: unten rechts steht auf TeamerEventsPage ein IonFab
 * (TeamerEventsPage.tsx:1566), links ist in allen drei Baeumen frei.
 *
 * Wartend ist Information, Fehlschlag ist eine Aufgabe — deshalb bleibt
 * data-variante="danger" auffaelliger (rot statt orange). Dieselbe Regel
 * traegt die Glocke (glockeZustand in PostfachGlocke).
 *
 * Haengt wie GlobalToasts auf App-Ebene. Grund: Die rund zwanzig
 * Leitungs-Aktionen (Kategorien, Jahrgaenge, Abzeichen, Level, Termine,
 * Material, Zertifikate) verteilen sich ueber ebenso viele Seiten mit je
 * eigener Kopfzeile — solange es dort keine gemeinsame Huelle gibt, wirkt
 * nur eine Stelle ueberall.
 *
 * Die Termin-Seiten zeigen ihre wartenden Vorgaenge zusaetzlich in der Liste
 * selbst (WartendeVorgaengeKarte) — dort steht der Hinweis im Zusammenhang,
 * direkt neben den Antraegen, um die es geht. Das ist Absicht und keine
 * Dopplung: Der Knopf sagt "da ist noch was", die Karte sagt "und zwar das".
 */
const WartendeVorgaengeLeiste: React.FC = () => {
  const { wartend, gescheitert } = useWartendeVorgaenge();

  const anzahl = wartend.length + gescheitert.length;
  if (anzahl === 0) return null;

  const nurGescheitert = wartend.length === 0;
  const text = nurGescheitert
    ? `${gescheitert.length} ${gescheitert.length === 1 ? 'Vorgang wurde' : 'Vorgänge wurden'} nicht gesendet`
    : `${wartend.length} ${wartend.length === 1 ? 'Vorgang wird' : 'Vorgänge werden'} gesendet`;

  return (
    <button
      type="button"
      className="app-wartende-leiste"
      data-variante={nurGescheitert ? 'danger' : 'warning'}
      onClick={oeffnePostfach}
      aria-label={`${text} — antippen zeigt die Liste`}
    >
      <IonIcon icon={nurGescheitert ? ICON_WARNHINWEIS : ICON_UHRZEIT} aria-hidden="true" />
      <span className="app-wartende-leiste__zahl" aria-hidden="true">{anzahl}</span>
    </button>
  );
};

export default WartendeVorgaengeLeiste;
