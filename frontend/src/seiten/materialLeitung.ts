// Material verwalten (/admin/material).
// App: components/admin/pages/AdminMaterialPage.tsx. Web:
// components/admin/web/leitung/WebMaterialVerwaltung.tsx. Die Suche fragt in
// beiden Fassungen den Server; der Filter „Nur globales Material" wirkt auf
// der Oberfläche.
//
// Die Suchfelder selbst (Beschriftung, Platzhalter) stehen als Literale in
// den Seiten: begriffeEinheitlich.test.ts und rollenGleichbehandlung.test.ts
// lesen sie dort.

import { wahlen, type Fassung } from './beschreibung';

export const MATERIAL_LEITUNG_TITEL = 'Material verwalten';
export const MATERIAL_LEITUNG_UNTERTITEL = 'Dokumente und Dateien';

/**
 * Die festen Optionen der Auswahl „Jahrgang"; danach folgen die Jahrgänge
 * der Gemeinde mit ihrer Nummer als Wert.
 */
export const MATERIAL_LEITUNG_FILTER = wahlen([
  { schluessel: 'alle', label: 'Alle Jahrgänge' },
  { schluessel: 'global', label: 'Nur globales Material', passt: (m: { ist_global?: boolean }) => m.ist_global === true },
]);

export interface MaterialLeerLage {
  /** Der Server sagt: kein Jahrgang zugewiesen (Header X-Kein-Jahrgang-Zugewiesen). */
  ohneJahrgang: boolean;
  suche: string;
  /** 'alle', 'global' oder die Nummer eines Jahrgangs (als Text). */
  filter: string;
}

/**
 * Der Leerzustand der Liste. Der Jahrgangs-Hinweis nur, wenn der Server die
 * Leere damit begründet hat und weder die Suche noch „Nur globales Material"
 * sie erklärt (Muster wie KonfisView, 01.09.2026). Grenzen Suche oder Filter
 * ein, sagt der Text das -- bis 09.10.2026 bot die App dann an, „das erste
 * Material" anzulegen.
 */
export function materialLeitungLeer(lage: MaterialLeerLage, fassung: Fassung): { titel: string; text: string } {
  if (lage.ohneJahrgang && lage.suche === '' && lage.filter !== 'global') {
    return {
      titel: 'Kein Jahrgang zugewiesen',
      text: 'Dir ist noch kein Jahrgang zugewiesen — du siehst nur Material, das für alle freigegeben ist. Die Gemeindeleitung kann das in den Einstellungen ändern.',
    };
  }
  if (lage.suche !== '' || lage.filter !== 'alle') {
    return { titel: 'Keine Materialien', text: 'Versuche andere Suchbegriffe oder einen anderen Jahrgang.' };
  }
  // Bewusst verschieden: Der Knopf zum Anlegen ist in der App das Plus oben, im Browser „Neues Material".
  return {
    titel: 'Keine Materialien',
    text: fassung === 'app' ? 'Erstelle dein erstes Material mit dem + Button' : 'Lege das erste Material mit „Neues Material“ an.',
  };
}
