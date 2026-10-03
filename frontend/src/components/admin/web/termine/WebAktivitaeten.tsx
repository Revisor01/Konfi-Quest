// Die Aktivitaeten der Leitung -- die Vorlagen, fuer die es Punkte gibt -- als
// Tabelle (Web-Fassung von Mitmachen, 03.10.2026). Reiter Konfis und Team
// (die Team-Aktivitaeten tragen keine Punkte), Filter nach Art, Suche.
// Anlegen und Aendern im vorhandenen Fenster (ActivityManagementModal),
// Loeschen nach Rueckfrage -- die Logik steht in useAktivitaetenVerwaltung,
// dieselbe wie bei der Seite der App (AdminActivitiesPage).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION_GEFUELLT,
  ICON_BEARBEITEN,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
} from '../../../shared/icons';
import { suchTreffer, suchbegriff } from '../../../../utils/supportWeb';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebTreffer from '../../../web/WebTreffer';
import { WebFehler, WebLaden, WebLeer } from '../../../web/WebZustaende';
import { useAktivitaetenVerwaltung, type Aktivitaet, type AktivitaetenRolle } from '../../useAktivitaetenVerwaltung';
import '../../../../theme/web/termine.css';

type ArtFilter = 'alle' | 'gemeinde' | 'gottesdienst';

/** Die Liste liefert zu jeder Aktivitaet ihre Kategorien mit. */
export type AktivitaetZeile = Aktivitaet & { categories?: Array<{ id: number; name: string }> };

export interface WebAktivitaetenTabelleProps {
  aktivitaeten: readonly AktivitaetZeile[];
  rolle: AktivitaetenRolle;
  onRolle: (rolle: AktivitaetenRolle) => void;
  darfAnlegen: boolean;
  darfBearbeiten: boolean;
  darfLoeschen: boolean;
  onAnlegen: () => void;
  onBearbeiten: (aktivitaet: Aktivitaet) => void;
  onLoeschen: (aktivitaet: Aktivitaet) => void;
}

/** Die Tabelle samt Reitern, Filtern und Suche -- ohne Laden und Seitenrahmen. */
export const WebAktivitaetenTabelle: React.FC<WebAktivitaetenTabelleProps> = ({
  aktivitaeten, rolle, onRolle, darfAnlegen, darfBearbeiten, darfLoeschen, onAnlegen, onBearbeiten, onLoeschen,
}) => {
  const [art, setArt] = useState<ArtFilter>('alle');
  const [suche, setSuche] = useState('');
  const team = rolle === 'teamer';

  const zaehlen = useMemo(() => ({
    alle: aktivitaeten.length,
    gemeinde: aktivitaeten.filter((a) => a.type === 'gemeinde').length,
    gottesdienst: aktivitaeten.filter((a) => a.type === 'gottesdienst').length,
  }), [aktivitaeten]);

  // Nach Name sortiert, wie die Liste der App.
  const sichtbar = useMemo(() => aktivitaeten
    .filter((a) => team || art === 'alle' || a.type === art)
    .filter((a) => !suchbegriff(suche)
      || suchTreffer(a.name || '', suche).length > 0
      || suchTreffer(a.description || '', suche).length > 0)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')), [aktivitaeten, art, suche, team]);

  const sucht = suchbegriff(suche) !== '';

  const spalten: Array<WebSpalte<AktivitaetZeile>> = [
    {
      schluessel: 'name',
      kopf: 'Aktivität',
      breite: '34%',
      zelle: (a) => (
        <>
          {darfBearbeiten ? (
            <button
              type="button"
              className="web-link web-link--zeile web-link--text web-link--knopf"
              aria-label={`${a.name} bearbeiten`}
              onClick={() => onBearbeiten(a)}
            >
              <WebTreffer text={a.name} suche={suche} />
            </button>
          ) : (
            <span className="web-zelle-titel"><WebTreffer text={a.name} suche={suche} /></span>
          )}
          {a.description && <span className="web-zelle-leise web-einzeilig" title={a.description}>{a.description}</span>}
        </>
      ),
    },
    {
      schluessel: 'kategorien',
      kopf: 'Kategorien',
      optional: true,
      zelle: (a) => (a.categories && a.categories.length > 0
        ? a.categories.map((k) => k.name).join(', ')
        : <span className="web-gedaempft">–</span>),
    },
  ];

  if (!team) {
    spalten.push(
      {
        schluessel: 'art',
        kopf: 'Art',
        breite: '132px',
        zelle: (a) => (a.type === 'gottesdienst'
          ? <WebPill ton="info">Gottesdienst</WebPill>
          : a.type === 'gemeinde' ? <WebPill ton="erfolg">Gemeinde</WebPill> : <span className="web-gedaempft">–</span>),
      },
      {
        schluessel: 'punkte',
        kopf: 'Punkte',
        breite: '88px',
        zahl: true,
        zelle: (a) => `+${a.points}P`,
      },
    );
  }

  if (darfBearbeiten || darfLoeschen) {
    spalten.push({
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '112px',
      klasse: 'web-spalte-termin-aktionen',
      zelle: (a) => (
        <div className="web-termin-aktionen">
          {darfBearbeiten && (
            <WebKnopf klein symbol vorn aria-label="Aktivität bearbeiten" title="Aktivität bearbeiten" onClick={() => onBearbeiten(a)}>
              <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
            </WebKnopf>
          )}
          {darfLoeschen && (
            <WebKnopf klein symbol vorn art="gefahr" aria-label="Aktivität löschen" title="Aktivität löschen" onClick={() => onLoeschen(a)}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          )}
        </div>
      ),
    });
  }

  return (
    <>
      <div className="web-werkzeuge">
        <WebChips<AktivitaetenRolle>
          beschriftung="Aktivitäten für"
          wert={rolle}
          onWert={(r) => { setArt('alle'); onRolle(r); }}
          chips={[
            { wert: 'konfi', label: 'Konfis' },
            { wert: 'teamer', label: 'Team' },
          ]}
        />
        {!team && (
          <WebChips<ArtFilter>
            beschriftung="Aktivitäten nach Art"
            wert={art}
            onWert={setArt}
            chips={[
              { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
              { wert: 'gemeinde', label: 'Gemeinde', zahl: zaehlen.gemeinde },
              { wert: 'gottesdienst', label: 'Gottesdienst', zahl: zaehlen.gottesdienst },
            ]}
          />
        )}
        <div className="web-werkzeuge__rechts">
          <WebSuche beschriftung="Aktivität suchen" platzhalter="Aktivität suchen" wert={suche} onWert={setSuche} />
          {darfAnlegen && (
            <WebKnopf art="primaer" onClick={onAnlegen} aria-label="Neue Aktivität anlegen">
              <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
              Neue Aktivität
            </WebKnopf>
          )}
        </div>
      </div>

      <div className="web-karte">
        {sichtbar.length > 0 ? (
          <WebTabelle
            beschriftung="Aktivitäten"
            spalten={spalten}
            zeilen={sichtbar}
            zeileSchluessel={(a) => a.id}
            mittig
            fest
          />
        ) : (
          <WebLeer
            icon={ICON_AKTION_GEFUELLT}
            titel={sucht ? 'Keine Treffer' : 'Keine Aktivitäten gefunden'}
            text={sucht ? `Zu „${suche.trim()}“ gibt es hier keine Aktivität.` : 'Noch keine Aktivitäten angelegt'}
            aktion={sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined}
          />
        )}
      </div>
    </>
  );
};

/** Laedt die Aktivitaeten und zeigt die Tabelle -- fuer den Reiter unter Mitmachen. */
const WebAktivitaeten: React.FC<{ presentingElement?: HTMLElement | null }> = ({ presentingElement }) => {
  const v = useAktivitaetenVerwaltung(() => presentingElement || undefined);
  if (v.loading) return <WebLaden karten={1} text="Die Aktivitäten werden geladen." />;
  if (!v.aktivitaeten) {
    return <WebFehler text="Die Aktivitäten konnten nicht geladen werden." onErneut={() => { void v.refresh(); }} />;
  }
  return (
    <WebAktivitaetenTabelle
      aktivitaeten={v.aktivitaeten}
      rolle={v.rolle}
      onRolle={v.setRolle}
      darfAnlegen={v.darfAnlegen}
      darfBearbeiten={v.darfBearbeiten}
      darfLoeschen={v.darfLoeschen}
      onAnlegen={v.anlegen}
      onBearbeiten={v.bearbeiten}
      onLoeschen={(a) => { void v.loeschen(a); }}
    />
  );
};

export default WebAktivitaeten;
