// Angaben und Material der Event-Detailseiten in der Web-Fassung (10.10.2026,
// aus WebTerminBausteine.tsx): die Angaben eines Events als Eintraege der
// Angaben-Karte (WebDetailSeite `angaben`) und der Sprung zum Material. Ohne Komponenten-Logik der Seiten -- die drei Rollen
// (Leitung, Team, Konfis) nehmen sie gleich. Der Link nach draussen steht in
// WebExternLink.tsx.

import React from 'react';
import { ICON_GEMEINDE_GEFUELLT, ICON_GOTTESDIENST_GEFUELLT } from '../../icons';
import WebExternLink from './WebExternLink';
import type { WebAngabe } from '../../../web/WebAngaben';
import type { TerminAngabe } from '../../../../utils/termineWeb';

/**
 * Die Punkteart haengt am Wert: "Typ" zeigt Kirche oder Gemeinde wie die App.
 * Alle uebrigen Angaben holen ihr Symbol aus components/web/angabeSymbole.ts.
 */
const typSymbol = (a: TerminAngabe): { icon?: string; iconKlasse?: string } => {
  if (a.label !== 'Typ') return {};
  const gottesdienst = a.zeilen[0] === 'Gottesdienst';
  return {
    icon: gottesdienst ? ICON_GOTTESDIENST_GEFUELLT : ICON_GEMEINDE_GEFUELLT,
    iconKlasse: gottesdienst ? 'app-icon-color--gottesdienst' : 'app-icon-color--gemeinde',
  };
};

/** Die Angaben eines Events fuer WebAngaben bzw. die Angaben-Karte der Detailseite (WebDetailSeite `angaben`). */
export function terminWebAngaben(angaben: readonly TerminAngabe[], onMaterial?: () => void): WebAngabe[] {
  return angaben.map((a) => ({
    label: a.label,
    ...typSymbol(a),
    wert: a.ortLink
      ? <WebExternLink href={a.ortLink} title="Auf der Karte zeigen">{a.zeilen[0]}</WebExternLink>
      : a.materialSprung && onMaterial
        ? <button type="button" className="web-link web-link--knopf" onClick={onMaterial}>{a.zeilen[0]}</button>
        : a.zeilen.length > 1
          ? <>{a.zeilen.map((z) => <span key={z} className="web-angabe-zeile">{z}</span>)}</>
          : a.zeilen[0],
  }));
}

/** Anker des Material-Abschnitts: dorthin springt "Material" in den Angaben, wenn es mehrere gibt. */
export const MATERIAL_ANKER = 'web-event-material';

/**
 * Was "Material" in den Angaben tut: genau ein Material oeffnet es, mehrere
 * springen zum Abschnitt (dort ist jedes einzeln waehlbar).
 */
export const materialSprung = (materialien: readonly { id: number }[], onOeffnen: (id: number) => void) => () => {
  if (materialien.length === 1) { onOeffnen(materialien[0].id); return; }
  document.getElementById(MATERIAL_ANKER)?.scrollIntoView({ block: 'start' });
};
