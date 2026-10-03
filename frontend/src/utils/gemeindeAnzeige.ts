import type { UserOrganization } from '../contexts/AppContext';
import { rollenName } from './rollenNamen';

// Wie eine Gemeinde im Gemeinde-Umschalter der Leiste aussieht (Web-Version,
// 03.10.2026, components/layout/LeistenGemeinde.tsx): voller Name, die Rolle
// dort, ein Buchstabe fuers Symbol. Reine Funktionen, damit sich die Regeln
// ohne Rendern pruefen lassen.

/** Der volle Name, wie ihn auch die Liste im Popover der Kopfzeile zeigt. */
export const gemeindeName = (org: Pick<UserOrganization, 'name' | 'display_name'> | undefined): string =>
  org?.display_name || org?.name || '';

// Das Wort vorn, das fast jede Gemeinde traegt und deshalb nichts
// unterscheidet: Aus „Kirchengemeinde Musterdorf" und „Kirchengemeinde
// Beispielstadt" wuerde sonst zweimal ein K. Wiederholt abgezogen, damit auch
// „Ev.-Luth. Kirchengemeinde Musterdorf" beim Ort landet.
const ALLGEMEINES_VORWORT =
  /^(?:ev\.?[\s-]*luth\.?|ev\.?|evangelisch[\s-]*lutherische[rn]?|evangelische[rn]?|kirchengemeinde|kirchspiel|kirche|gemeinde|pfarrei)(?![\p{L}\p{N}])[\s\-–]*/iu;

/**
 * Der Buchstabe im Symbol der Gemeinde: der erste Buchstabe oder die erste
 * Ziffer des Namens, ohne allgemeines Vorwort. Besteht der Name nur daraus
 * („Kirchengemeinde"), gilt der volle Name. Ohne Buchstaben: „G".
 */
export const gemeindeInitiale = (name: string): string => {
  let rest = name.trim();
  for (let i = 0; i < 4; i++) {
    const ohne = rest.replace(ALLGEMEINES_VORWORT, '');
    if (ohne === rest || ohne.trim() === '') break;
    rest = ohne;
  }
  const zeichen = rest.match(/[\p{L}\p{N}]/u)?.[0] ?? name.match(/[\p{L}\p{N}]/u)?.[0];
  return zeichen ? zeichen.toLocaleUpperCase('de-DE') : 'G';
};

/**
 * Die Rolle in dieser Gemeinde, mit den Begriffen der App (utils/rollenNamen):
 * Gemeindeleitung, Leitung, Teamer:in, Konfi. Eine unbekannte Rolle ergibt
 * nichts -- lieber keine Zeile als ein technischer Name.
 */
export const rolleInGemeinde = (org: Pick<UserOrganization, 'role_name'> | undefined): string => {
  const name = org?.role_name;
  if (!name) return '';
  if (name === 'konfi') return 'Konfi';
  const text = rollenName(name);
  // rollenName reicht Unbekanntes unveraendert zurueck.
  return text === name ? '' : text;
};
