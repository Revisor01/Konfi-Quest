// Die Konfi-Historie des Teams in der Web-Fassung (Browser ab 992 px): was die
// Person in ihrer Konfi-Zeit gesammelt hat -- Punkte (gesamt, Gottesdienst,
// Gemeinde), der Verlauf als Tabelle, die erreichten Badges als Raster, die
// besuchten Events und der persönliche Rückblick. Die Daten sind eingefroren;
// beide Punktearten zählen immer.
//
// Die Seite lädt nichts selbst: Profil, Konfi-Zeit und Rückblick kommen aus
// der App-Fassung (teamer/pages/TeamerKonfiStatsPage.tsx); nur der Verlauf holt
// seine Tabelle über dieselbe Route wie die Punkte-Übersicht.

import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_UHRZEIT } from '../../shared/icons';
import { datumKurz } from '../../../utils/dateUtils';
import { getIconFromString } from '../../../utils/badgeIcons';
import { konfiZeitTerminStatus } from '../../../utils/konfiZeit';
import { punkteText } from '../../../utils/punkteText';
import type { KonfiZeitTermin } from '../../../types/konfiZeit';
import type { WrappedHistoryEntry } from '../../../types/wrapped';
import { getBadgeColor } from '../../shared/BadgePopoverContent';
import WebKarte from '../../web/WebKarte';
import WebKachel from '../../web/WebKachel';
import WebKnopf from '../../web/WebKnopf';
import WebSpalten from '../../web/WebSpalten';
import WebTabelle from '../../web/WebTabelle';
import WebPill from '../../web/WebPill';
import WebBadgeDialog from '../../konfi/web/WebBadgeDialog';
import WebBadgeSymbol from '../../konfi/web/WebBadgeSymbol';
import { WebPunkteVerlauf } from '../../konfi/web/WebProfilBausteine';
import '../../../theme/web/start.css';

export interface KonfiHistorieBadge {
  badge_id: number;
  name: string;
  description?: string;
  icon: string;
  color: string;
  awarded_date: string;
  criteria_type?: string;
  criteria_value?: number;
}

export interface WebKonfiHistorieProps {
  punkte: { gesamt: number; gottesdienst: number; gemeinde: number };
  badges: KonfiHistorieBadge[];
  termine: KonfiZeitTermin[];
  rueckblick: WrappedHistoryEntry | null;
  onRueckblick: (eintrag: WrappedHistoryEntry) => void;
}

const WebKonfiHistorie: React.FC<WebKonfiHistorieProps> = ({ punkte, badges, termine, rueckblick, onRueckblick }) => {
  const [offen, setOffen] = useState<number | null>(null);
  const sortiert = [...badges].sort((a, b) => new Date(b.awarded_date).getTime() - new Date(a.awarded_date).getTime());
  const gewaehlt = offen === null ? null : badges.find((b) => b.badge_id === offen) ?? null;

  const haupt = (
    <>
      <WebPunkteVerlauf endpunkt="/teamer/konfi-history" gottesdienstAktiv gemeindeAktiv />

      {termine.length > 0 && (
        <WebKarte titel="Events der Konfi-Zeit" untertitel={`${termine.length} ${termine.length === 1 ? 'Event' : 'Events'}`} bund>
          <WebTabelle<KonfiZeitTermin>
            beschriftung="Events der Konfi-Zeit"
            zeilen={termine}
            zeileSchluessel={(t) => t.event_id}
            spalten={[
              { schluessel: 'datum', kopf: 'Datum', breite: '110px', zelle: (t) => datumKurz(t.datum) },
              { schluessel: 'name', kopf: 'Event', zelle: (t) => <span className="web-zelle-titel">{t.name}</span> },
              { schluessel: 'status', kopf: 'Stand', breite: '150px', zelle: (t) => <WebPill>{konfiZeitTerminStatus(t)}</WebPill> },
              { schluessel: 'punkte', kopf: 'Punkte', zahl: true, breite: '90px', zelle: (t) => ((t.punkte ?? 0) > 0 ? <strong>+{t.punkte}</strong> : <span className="web-gedaempft">–</span>) },
            ]}
          />
        </WebKarte>
      )}
    </>
  );

  const seite = (
    <>
      {rueckblick && (
        <WebKarte titel="Konfi-Rückblick">
          <p className="web-start-notiz">Dein persönlicher Rückblick aus der Konfi-Zeit {rueckblick.year}.</p>
          <div className="web-konfi-historie__aktion">
            <WebKnopf klein art="primaer" onClick={() => onRueckblick(rueckblick)}>
              <IonIcon icon={ICON_UHRZEIT} aria-hidden="true" />
              Rückblick ansehen
            </WebKnopf>
          </div>
        </WebKarte>
      )}

      <WebKarte titel="Konfi-Badges" untertitel={`${badges.length} ${badges.length === 1 ? 'Badge' : 'Badges'} erreicht`}>
        {sortiert.length === 0 ? (
          <p className="web-gedaempft">Aus der Konfi-Zeit sind keine Badges erhalten.</p>
        ) : (
          <ul className="web-abzeichen-reihe web-abzeichen-reihe--eng" aria-label="Erreichte Konfi-Badges">
            {sortiert.map((b) => (
              <li key={b.badge_id}>
                <button
                  type="button"
                  className="web-abzeichen-knopf"
                  onClick={() => setOffen(b.badge_id)}
                  aria-label={`${b.name}: Einzelheiten ansehen`}
                >
                  <WebBadgeSymbol icon={getIconFromString(b.icon)} farbe={getBadgeColor(b)} erreicht groesse="mittel" />
                  <span className="web-abzeichen-knopf__name">{b.name}</span>
                  <span className="web-abzeichen-knopf__datum">{datumKurz(b.awarded_date, { ohneJahr: true })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </WebKarte>
    </>
  );

  return (
    <div className="web-start web-rolle web-rolle--team">
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Punkte gesamt" wert={String(punkte.gesamt)} zusatz={[punkteText(punkte.gesamt)]} />
        <WebKachel label="Gottesdienst" wert={String(punkte.gottesdienst)} zusatz={['Gottesdienst-Punkte']} />
        <WebKachel label="Gemeinde" wert={String(punkte.gemeinde)} zusatz={['Gemeinde-Punkte']} />
        <WebKachel label="Badges" wert={String(badges.length)} zusatz={['aus der Konfi-Zeit']} />
      </div>
      <WebSpalten haupt={haupt} seite={seite} seiteBeschriftung="Rückblick und Badges" />
      {gewaehlt && (
        <WebBadgeDialog
          badge={{ ...gewaehlt, id: gewaehlt.badge_id }}
          erreicht
          onSchliessen={() => setOffen(null)}
        />
      )}
    </div>
  );
};

export default WebKonfiHistorie;
