// Das Dashboard einrichten in der Web-Fassung, /admin/settings/dashboard
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): zwei
// Karten nebeneinander, eine fuer die Konfis und eine fuers Team. Jede Zeile ist
// ein Bereich mit Schalter (sichtbar oder nicht) und zwei Knoepfen, um ihn nach
// oben oder unten zu schieben -- in der App zieht man die Zeilen.
//
// Zustand und Speichern kommen von der Seite (AdminDashboardSettingsPage): jeder
// Schalter und jede Verschiebung speichert sofort, wie dort, und geht bei
// fehlendem Netz in die Warteschlange. Die Seite ist nur fuer die
// Gemeindeleitung erreichbar.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AUFKLAPPEN, ICON_ZUKLAPPEN } from '../../../shared/icons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebSchalter from '../../../web/WebSchalter';
import { WebLaden } from '../../../web/WebZustaende';
import { verschiebeEintrag } from './dashboardReihenfolge';
import { DASHBOARD_LISTE_TITEL } from '../../../../seiten/dashboardEinstellungen';

export type DashboardZielgruppe = 'konfi' | 'teamer';

export interface DashboardBereich {
  schluessel: string;
  label: string;
  an: boolean;
}

export interface WebDashboardEinstellungenProps {
  /** Die Bereiche in der gespeicherten Reihenfolge. */
  konfi: readonly DashboardBereich[];
  team: readonly DashboardBereich[];
  laedt: boolean;
  onSchalten: (zielgruppe: DashboardZielgruppe, schluessel: string, an: boolean) => void;
  /** Die neue Reihenfolge aller Schluessel der Zielgruppe. */
  onVerschieben: (zielgruppe: DashboardZielgruppe, reihenfolge: string[]) => void;
}

const Liste: React.FC<{
  zielgruppe: DashboardZielgruppe;
  titel: string;
  bereiche: readonly DashboardBereich[];
  onSchalten: WebDashboardEinstellungenProps['onSchalten'];
  onVerschieben: WebDashboardEinstellungenProps['onVerschieben'];
}> = ({ zielgruppe, titel, bereiche, onSchalten, onVerschieben }) => {
  const reihenfolge = bereiche.map((b) => b.schluessel);
  const sichtbar = bereiche.filter((b) => b.an).length;
  return (
    <WebKarte titel={titel} untertitel={`${sichtbar} von ${mitEinheit(bereiche.length, 'Bereich', 'Bereichen')} sichtbar`}>
      <ol className="web-reihenfolge" aria-label={titel}>
        {bereiche.map((b, i) => (
          <li key={b.schluessel} className="web-reihenfolge__zeile">
            <span className="web-reihenfolge__nr" aria-hidden="true">{i + 1}</span>
            <div className="web-reihenfolge__schalter">
              <WebSchalter label={b.label} an={b.an} onAn={(an) => onSchalten(zielgruppe, b.schluessel, an)} />
            </div>
            <div className="web-reihenfolge__pfeile">
              <WebKnopf
                art="text" klein symbol
                aria-label={`${b.label} nach oben`}
                title="Nach oben"
                disabled={i === 0}
                onClick={() => onVerschieben(zielgruppe, verschiebeEintrag(reihenfolge, i, 'hoch'))}
              >
                <IonIcon icon={ICON_ZUKLAPPEN} aria-hidden="true" />
              </WebKnopf>
              <WebKnopf
                art="text" klein symbol
                aria-label={`${b.label} nach unten`}
                title="Nach unten"
                disabled={i === bereiche.length - 1}
                onClick={() => onVerschieben(zielgruppe, verschiebeEintrag(reihenfolge, i, 'runter'))}
              >
                <IonIcon icon={ICON_AUFKLAPPEN} aria-hidden="true" />
              </WebKnopf>
            </div>
          </li>
        ))}
      </ol>
    </WebKarte>
  );
};

const WebDashboardEinstellungen: React.FC<WebDashboardEinstellungenProps> = ({ konfi, team, laedt, onSchalten, onVerschieben }) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Dashboard" zurueck={zurueck}>
        <WebLaden karten={2} text="Die Einstellungen werden geladen." />
      </WebSeite>
    );
  }

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Dashboard"
      untertitel="Welche Bereiche Konfis und Team sehen – und in welcher Reihenfolge"
      zurueck={zurueck}
    >
      <div className="web-raster web-raster--zwei">
        <Liste zielgruppe="konfi" titel={DASHBOARD_LISTE_TITEL.konfi} bereiche={konfi} onSchalten={onSchalten} onVerschieben={onVerschieben} />
        <Liste zielgruppe="teamer" titel={DASHBOARD_LISTE_TITEL.teamer} bereiche={team} onSchalten={onSchalten} onVerschieben={onVerschieben} />
      </div>
    </WebSeite>
  );
};

export default WebDashboardEinstellungen;
