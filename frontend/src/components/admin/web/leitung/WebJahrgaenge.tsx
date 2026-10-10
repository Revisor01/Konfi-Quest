// Jahrgaenge der Gemeinde in der Web-Fassung, /admin/settings/jahrgaenge
// (Browser ab 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6):
// Kennzahlen, dann Liste oder Kacheln mit Konfis, Punktezielen, Konfispruch
// und Rueckblick je Jahrgang.
//
// Rahmen, Umschalter Liste | Kacheln und Zustaende stellt WebListenSeite
// (10.10.2026); hier stehen nur Spalten, Karte und Daten.
//
// Daten, Rechte und Fenster kommen von der Seite (AdminJahrgaengeePage): Das
// Formular ist dasselbe Fenster wie in der App (JahrgangModal), das Loeschen
// fragt dieselbe Rueckfrage mit den Zahlen (Vorschau beim Server) und die
// zweite, wenn der Jahrgang Chat-Nachrichten enthaelt. Anlegen darf nur die
// Gemeindeleitung; Bearbeiten und Loeschen auch die Leitung -- die Liste
// enthaelt fuer sie nur die eigenen Jahrgaenge (der Server filtert).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_BUCH, ICON_FUNKELN, ICON_HINZUFUEGEN, ICON_JAHRGANG, ICON_JAHRGANG_GEFUELLT, ICON_POKAL } from '../../../shared/icons';
import { datumKurz } from '../../../../utils/dateUtils';
import { mitEinheit } from '../../../../utils/supportStatistik';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import WebPill from '../../../web/WebPill';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import { KENNZAHL_SYMBOL } from '../../../web/kennzahlSymbole';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
import type { JahrgangEintrag } from './verwaltungTypen';
import { konfispruchStatusRang } from '../../../../utils/statusReihenfolge';

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

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

const godiAn = (j: JahrgangEintrag): boolean => j.gottesdienst_enabled !== false;
const gemeindeAn = (j: JahrgangEintrag): boolean => j.gemeinde_enabled !== false;
const spruchFrei = (j: JahrgangEintrag): boolean => j.konfspruch_enabled !== false;

/** Die Punkteziele, die gelten (ohne Wert gilt 10), als Text fuer die Karte. */
const zieleText = (j: JahrgangEintrag): string => {
  const teile = [
    godiAn(j) && `Gottesdienst ${j.target_gottesdienst || 10}`,
    gemeindeAn(j) && `Gemeinde ${j.target_gemeinde || 10}`,
  ].filter(Boolean);
  return teile.length > 0 ? teile.join(' · ') : 'Keine Punkte';
};

const WebJahrgaenge: React.FC<WebJahrgaengeProps> = ({
  jahrgaenge, laedt, darfAnlegen, darfBearbeiten, darfLoeschen, pageRef, onAnlegen, onBearbeiten, onLoeschen,
}) => {
  const konfis = jahrgaenge.reduce((summe, j) => summe + (j.konfi_count ?? 0), 0);
  const mitRueckblick = jahrgaenge.filter((j) => !!j.wrapped_released_at).length;

  const bearbeiten: WebAktion<JahrgangEintrag> | undefined = darfBearbeiten
    ? { onKlick: onBearbeiten, beschriftung: (j) => `${j.name} bearbeiten`, titel: () => 'Bearbeiten' }
    : undefined;
  const loeschen: WebAktion<JahrgangEintrag> | undefined = darfLoeschen
    ? { onKlick: onLoeschen, beschriftung: (j) => `${j.name} löschen`, titel: () => 'Jahrgang löschen' }
    : undefined;

  const spalten: Array<WebSpalte<JahrgangEintrag>> = [
    {
      schluessel: 'name',
      kopf: 'Jahrgang',
      breite: '20%',
      sortWert: (j) => j.name,
      zelle: (j) => (
        <WebNameZelle
          kreis={<WebKreis icon={ICON_JAHRGANG_GEFUELLT} ton="jahrgang" />}
          titel={j.name}
          onKlick={darfBearbeiten ? () => onBearbeiten(j) : undefined}
          beschriftung={`${j.name} bearbeiten`}
        />
      ),
    },
    {
      schluessel: 'konfis',
      kopf: 'Konfis',
      zahl: true,
      breite: '90px',
      sortWert: (j) => j.konfi_count ?? 0,
      zelle: (j) => j.konfi_count ?? 0,
    },
    {
      schluessel: 'ziele',
      kopf: 'Punkteziele',
      // Summe der Ziele, die gelten (wie angezeigt: ohne Wert gilt 10)
      sortWert: (j) => (godiAn(j) ? j.target_gottesdienst || 10 : 0) + (gemeindeAn(j) ? j.target_gemeinde || 10 : 0),
      zelle: (j) => {
        if (!godiAn(j) && !gemeindeAn(j)) return <span className="web-gedaempft">Keine Punkte</span>;
        return (
          <span className="web-pillreihe web-pillreihe--eine-zeile">
            {godiAn(j) && <WebPill>Gottesdienst {j.target_gottesdienst || 10}</WebPill>}
            {gemeindeAn(j) && <WebPill>Gemeinde {j.target_gemeinde || 10}</WebPill>}
          </span>
        );
      },
    },
    {
      schluessel: 'spruch',
      kopf: 'Konfispruch',
      breite: '150px',
      optional: true,
      sortWert: (j) => konfispruchStatusRang(spruchFrei(j)),
      zelle: (j) => (spruchFrei(j)
        ? <WebPill ton="erfolg" punkt>Spruch frei</WebPill>
        : <WebPill punkt>Spruch gesperrt</WebPill>),
    },
    {
      schluessel: 'rueckblick',
      kopf: 'Rückblick',
      breite: '190px',
      optional: true,
      sortWert: (j) => (j.wrapped_released_at ? new Date(j.wrapped_released_at) : null),
      zelle: (j) => (j.wrapped_released_at
        ? <span className="web-zelle-leise">Gestartet am {datumKurz(j.wrapped_released_at)}</span>
        : <span className="web-gedaempft">Noch kein Rückblick</span>),
    },
  ];

  return (
    <WebListenSeite<JahrgangEintrag>
      bereich="Verwaltung"
      titel="Jahrgänge"
      untertitel={laedt ? undefined : 'Punkteziele und Konfisprüche verwalten'}
      aktionen={!laedt && darfAnlegen ? (
        <WebKnopf art="primaer" onClick={onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neuer Jahrgang
        </WebKnopf>
      ) : undefined}
      zurueck={ZURUECK}
      pageRef={pageRef}
      laden={laedt ? { text: 'Die Jahrgänge werden geladen.', kacheln: 2, karten: 1 } : undefined}
      kennzahlen={[
        { symbol: KENNZAHL_SYMBOL.jahrgaenge, label: 'Jahrgänge', wert: String(jahrgaenge.length) },
        { symbol: KENNZAHL_SYMBOL.konfis, label: 'Konfis', wert: String(konfis), zusatz: ['in diesen Jahrgängen'] },
        { label: 'Rückblick gestartet', wert: String(mitRueckblick), zusatz: [`von ${mitEinheit(jahrgaenge.length, 'Jahrgang', 'Jahrgängen')}`] },
      ]}
      ansicht={{ seite: 'jahrgaenge', vorgabe: 'liste' }}
      eintraege={jahrgaenge}
      liste={{ beschriftung: 'Jahrgänge', spalten, zeileSchluessel: (j) => j.id, mittig: true, bearbeiten, loeschen }}
      kacheln={{
        beschriftung: 'Jahrgänge',
        schluessel: (j) => j.id,
        bearbeiten,
        loeschen,
        karte: (j) => ({
          akzent: 'var(--app-color-jahrgang)',
          akzentDunkel: 'var(--app-color-jahrgang-dunkel)',
          symbol: <WebBildKarteSymbol icon={ICON_JAHRGANG_GEFUELLT} />,
          label: 'Jahrgang',
          titelImKopf: true,
          titel: j.name,
          onTitel: darfBearbeiten ? () => onBearbeiten(j) : undefined,
          titelBeschriftung: `${j.name} bearbeiten`,
          angaben: [
            { ...KENNZAHL_SYMBOL.konfis, inhalt: mitEinheit(j.konfi_count ?? 0, 'Konfi', 'Konfis') },
            { icon: ICON_POKAL, farbe: 'var(--app-color-warning)', inhalt: zieleText(j) },
            { icon: ICON_BUCH, inhalt: spruchFrei(j) ? 'Spruch frei' : 'Spruch gesperrt' },
            {
              icon: ICON_FUNKELN,
              farbe: 'var(--app-color-wrapped)',
              inhalt: j.wrapped_released_at ? `Rückblick gestartet am ${datumKurz(j.wrapped_released_at)}` : 'Noch kein Rückblick',
            },
          ],
        }),
      }}
      leer={{ icon: ICON_JAHRGANG, titel: 'Keine Jahrgänge gefunden', text: 'Noch keine Jahrgänge angelegt.' }}
    />
  );
};

export default WebJahrgaenge;
