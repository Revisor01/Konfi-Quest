// Jahrgaenge der Gemeinde in der Web-Fassung, /admin/settings/jahrgaenge
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): eine
// Tabelle mit Konfis, Punktezielen, Konfispruch und Rueckblick je Jahrgang.
//
// Daten, Rechte und Fenster kommen von der Seite (AdminJahrgaengeePage): Das
// Formular ist dasselbe Fenster wie in der App (JahrgangModal), das Loeschen
// fragt dieselbe Rueckfrage mit den Zahlen (Vorschau beim Server) und die
// zweite, wenn der Jahrgang Chat-Nachrichten enthaelt. Anlegen darf nur die
// Gemeindeleitung; Bearbeiten und Loeschen auch die Leitung -- die Liste
// enthaelt fuer sie nur die eigenen Jahrgaenge (der Server filtert).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_HINZUFUEGEN, ICON_JAHRGANG, ICON_JAHRGANG_GEFUELLT } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebSymbol, WebZeilenAktionen, WebZeilenKnopf } from './WebLeitungBausteine';
import type { JahrgangEintrag } from './verwaltungTypen';

export interface WebJahrgaengeProps {
  jahrgaenge: readonly JahrgangEintrag[];
  laedt: boolean;
  /** Nur die Gemeindeleitung legt Jahrgaenge an. */
  darfAnlegen: boolean;
  darfBearbeiten: boolean;
  darfLoeschen: boolean;
  pageRef?: React.Ref<HTMLElement>;
  onAnlegen: () => void;
  onBearbeiten: (jahrgang: JahrgangEintrag) => void;
  onLoeschen: (jahrgang: JahrgangEintrag) => void;
}

const WebJahrgaenge: React.FC<WebJahrgaengeProps> = ({
  jahrgaenge, laedt, darfAnlegen, darfBearbeiten, darfLoeschen, pageRef, onAnlegen, onBearbeiten, onLoeschen,
}) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };

  if (laedt) {
    return (
      <WebSeite bereich="Verwaltung" titel="Jahrgänge" zurueck={zurueck} pageRef={pageRef}>
        <WebLaden kacheln={2} karten={1} text="Die Jahrgänge werden geladen." />
      </WebSeite>
    );
  }

  const konfis = jahrgaenge.reduce((summe, j) => summe + (j.konfi_count ?? 0), 0);

  const spalten: Array<WebSpalte<JahrgangEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Jahrgang',
      breite: '22%',
      zelle: (j) => (
        <span className="web-person-zelle">
          <WebSymbol icon={ICON_JAHRGANG_GEFUELLT} ton="jahrgang" />
          {darfBearbeiten
            ? <WebZeilenKnopf onClick={() => onBearbeiten(j)} aria-label={`${j.name} bearbeiten`}>{j.name}</WebZeilenKnopf>
            : <span className="web-zelle-titel web-einzeilig">{j.name}</span>}
        </span>
      ),
    },
    {
      schluessel: 'konfis',
      kopf: 'Konfis',
      zahl: true,
      breite: '90px',
      zelle: (j) => j.konfi_count ?? 0,
    },
    {
      schluessel: 'ziele',
      kopf: 'Punkteziele',
      zelle: (j) => {
        const godi = j.gottesdienst_enabled !== false;
        const gemeinde = j.gemeinde_enabled !== false;
        if (!godi && !gemeinde) return <span className="web-gedaempft">Keine Punkte</span>;
        return (
          <span className="web-pillreihe">
            {godi && <WebPill>Gottesdienst {j.target_gottesdienst || 10}</WebPill>}
            {gemeinde && <WebPill>Gemeinde {j.target_gemeinde || 10}</WebPill>}
          </span>
        );
      },
    },
    {
      schluessel: 'spruch',
      kopf: 'Konfispruch',
      breite: '150px',
      optional: true,
      zelle: (j) => (j.konfspruch_enabled !== false
        ? <WebPill ton="erfolg" punkt>Spruch frei</WebPill>
        : <WebPill punkt>Spruch gesperrt</WebPill>),
    },
    {
      schluessel: 'rueckblick',
      kopf: 'Rückblick',
      breite: '190px',
      optional: true,
      zelle: (j) => (j.wrapped_released_at
        ? <span className="web-zelle-leise">Gestartet am {datumKurz(j.wrapped_released_at)}</span>
        : <span className="web-gedaempft">Noch kein Rückblick</span>),
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (j) => (
        <WebZeilenAktionen
          name={j.name}
          onBearbeiten={darfBearbeiten ? () => onBearbeiten(j) : undefined}
          onLoeschen={darfLoeschen ? () => onLoeschen(j) : undefined}
          loeschenTitel="Jahrgang löschen"
        />
      ),
    },
  ];

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Jahrgänge"
      untertitel="Punkteziele und Konfisprüche verwalten"
      aktionen={darfAnlegen ? (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neuer Jahrgang
        </WebKnopf>
      ) : undefined}
      zurueck={zurueck}
      pageRef={pageRef}
    >
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Jahrgänge" wert={String(jahrgaenge.length)} />
        <WebKachel label="Konfis" wert={String(konfis)} zusatz={['in diesen Jahrgängen']} />
      </div>

      <WebKarte titel="Jahrgänge" untertitel={mitEinheit(jahrgaenge.length, 'Jahrgang', 'Jahrgänge')} bund={jahrgaenge.length > 0}>
        {jahrgaenge.length === 0 ? (
          <WebLeer icon={ICON_JAHRGANG} titel="Keine Jahrgänge gefunden" text="Noch keine Jahrgänge angelegt." />
        ) : (
          <WebTabelle
            beschriftung="Jahrgänge"
            spalten={spalten}
            zeilen={jahrgaenge}
            zeileSchluessel={(j) => j.id}
            mittig
          />
        )}
      </WebKarte>
    </WebSeite>
  );
};

export default WebJahrgaenge;
