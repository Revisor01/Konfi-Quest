// Material verwalten in der Web-Fassung, /admin/material (Browser ab 992 px;
// docs/planung/web-alle-bereiche.md, Entscheidung 6): eine Tabelle mit Titel,
// Sichtbarkeit und dem, was am Material haengt, dazu Suche und Jahrgangs-Filter.
//
// Daten, Filter und Fenster kommen von der Seite (AdminMaterialPage): Das
// Formular ist dasselbe Fenster wie in der App (MaterialFormModal), das Loeschen
// fragt dieselbe Rueckfrage. Bearbeiten und Loeschen darf nur die erstellende
// Person oder die Gemeindeleitung (darfMaterialBearbeiten); wer es nicht darf,
// sieht das Material schreibgeschuetzt ("Ansehen"). Die Suche fragt wie dort den
// Server -- nach einer kurzen Pause im Tippen, nicht bei jedem Zeichen.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_DATEI, ICON_DATEI_GEFUELLT, ICON_HINZUFUEGEN, ICON_LINK, ICON_SICHTBAR } from '../../../shared/icons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { materialStats } from '../../../../utils/materialStats';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebSuche from '../../../web/WebSuche';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebFilterAuswahl, WebSymbol, WebZeilenAktionen, WebZeilenKnopf } from './WebLeitungBausteine';
import type { MaterialEintrag } from './verwaltungTypen';

/** "alle", "global" (nur Material fuer alle) oder die Nummer eines Jahrgangs. */
export type MaterialFilter = string;

export interface WebMaterialVerwaltungProps {
  /** Alles, was der Server fuer Suche und Jahrgang liefert (fuer die Kennzahlen). */
  alle: readonly MaterialEintrag[];
  /** Die Zeilen nach dem Filter "nur globales Material". */
  angezeigt: readonly MaterialEintrag[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  laedt: boolean;
  /** Der Server sagt: Dieser Zugang hat keinen Jahrgang -- er sieht nur Material fuer alle. */
  ohneJahrgang: boolean;
  suche: string;
  onSuche: (suche: string) => void;
  filter: MaterialFilter;
  onFilter: (filter: MaterialFilter) => void;
  /** Darf diese Person das Material aendern und loeschen? */
  darfBearbeiten: (material: MaterialEintrag) => boolean;
  onAnlegen: () => void;
  onOeffnen: (material: MaterialEintrag) => void;
  onLoeschen: (material: MaterialEintrag) => void;
  pageRef?: React.Ref<HTMLElement>;
}

/** Wartezeit nach dem letzten Tippen, bis die Suche den Server fragt (wie in der App). */
const SUCHE_WARTEZEIT_MS = 300;

const jahrgangsText = (m: MaterialEintrag): string | null => {
  const namen = (m.jahrgaenge ?? []).map((j) => j.name);
  if (namen.length > 0) return namen.join(', ');
  return m.jahrgang_name || null;
};

const WebMaterialVerwaltung: React.FC<WebMaterialVerwaltungProps> = (p) => {
  const [eingabe, setEingabe] = useState(p.suche);
  // Der Rueckruf darf wechseln, ohne die Wartezeit neu zu starten.
  const melden = useRef(p.onSuche);
  useEffect(() => { melden.current = p.onSuche; }, [p.onSuche]);
  useEffect(() => {
    const timer = setTimeout(() => melden.current(eingabe), SUCHE_WARTEZEIT_MS);
    return () => clearTimeout(timer);
  }, [eingabe]);

  const sucht = p.suche !== '' || p.filter !== 'alle';
  const ersteLadung = p.laedt && p.alle.length === 0;
  const stats = materialStats(p.alle.map((m) => ({ file_count: m.file_count, link_url: m.link_url })));

  const spalten: Array<WebSpalte<MaterialEintrag>> = [
    {
      schluessel: 'titel',
      kopf: 'Material',
      breite: '38%',
      zelle: (m) => (
        <span className="web-person-zelle">
          <WebSymbol icon={m.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT} ton="material" />
          <span className="web-person-zelle__text">
            <WebZeilenKnopf onClick={() => p.onOeffnen(m)} aria-label={`${m.title} ${p.darfBearbeiten(m) ? 'bearbeiten' : 'ansehen'}`}>{m.title}</WebZeilenKnopf>
            {m.description && <span className="web-zelle-leise web-zwei-zeilen">{m.description}</span>}
          </span>
        </span>
      ),
    },
    {
      schluessel: 'sichtbar',
      kopf: 'Sichtbar für',
      breite: '20%',
      optional: true,
      zelle: (m) => (m.ist_global
        ? <WebPill ton="info">Für alle</WebPill>
        : (jahrgangsText(m) ?? <span className="web-gedaempft">–</span>)),
    },
    {
      schluessel: 'inhalt',
      kopf: 'Inhalt',
      zelle: (m) => {
        const links = m.link_count ?? (m.link_url ? 1 : 0);
        const teile = [
          (m.file_count ?? 0) > 0 ? mitEinheit(m.file_count ?? 0, 'Datei', 'Dateien') : null,
          links > 0 ? (links === 1 ? '1 Link' : `${links} Links`) : null,
          (m.event_count ?? 0) > 0 ? mitEinheit(m.event_count ?? 0, 'Event', 'Events') : null,
        ].filter(Boolean);
        return teile.length > 0
          ? <span className="web-pillreihe">{teile.map((t) => <WebPill key={String(t)}>{t}</WebPill>)}</span>
          : <span className="web-gedaempft">–</span>;
      },
    },
    {
      schluessel: 'ersteller',
      kopf: 'Erstellt von',
      breite: '160px',
      optional: true,
      zelle: (m) => m.created_by_name || <span className="web-gedaempft">–</span>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (m) => {
        const darf = p.darfBearbeiten(m);
        return darf ? (
          <WebZeilenAktionen name={m.title} onBearbeiten={() => p.onOeffnen(m)} onLoeschen={() => p.onLoeschen(m)} loeschenTitel="Material löschen" />
        ) : (
          <div className="web-zeilenaktionen">
            <WebKnopf klein vorn onClick={() => p.onOeffnen(m)} aria-label={`${m.title} ansehen`}>
              <IonIcon icon={ICON_SICHTBAR} aria-hidden="true" />
              <span className="web-knopf__text">Ansehen</span>
            </WebKnopf>
          </div>
        );
      },
    },
  ];

  const leer = p.ohneJahrgang && p.suche === '' && p.filter !== 'global'
    ? { titel: 'Kein Jahrgang zugewiesen', text: 'Dir ist noch kein Jahrgang zugewiesen — du siehst nur Material, das für alle freigegeben ist. Die Gemeindeleitung kann das in den Einstellungen ändern.' }
    : sucht
      ? { titel: 'Keine Materialien', text: 'Versuche andere Suchbegriffe oder einen anderen Jahrgang.' }
      : { titel: 'Keine Materialien', text: 'Lege das erste Material mit „Neues Material“ an.' };

  return (
    <WebSeite
      bereich="Verwaltung"
      titel="Material verwalten"
      untertitel="Dokumente und Dateien"
      aktionen={(
        <WebKnopf art="primaer" onClick={p.onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Material
        </WebKnopf>
      )}
      zurueck={{ href: '/admin/settings', text: 'Mehr' }}
      pageRef={p.pageRef}
    >
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Material" wert={ersteLadung ? '–' : String(stats.material)} />
        <WebKachel label="Dateien" wert={ersteLadung ? '–' : String(stats.dateien)} />
        <WebKachel label="Links" wert={ersteLadung ? '–' : String(stats.links)} />
      </div>

      <div className="web-werkzeuge">
        <WebSuche beschriftung="Material durchsuchen" platzhalter="Titel oder Beschreibung …" wert={eingabe} onWert={setEingabe} />
        {p.jahrgaenge.length > 0 && (
          <WebFilterAuswahl
            label="Jahrgang"
            wert={p.filter}
            onWert={p.onFilter}
            optionen={[
              { wert: 'alle', label: 'Alle Jahrgänge' },
              { wert: 'global', label: 'Nur globales Material' },
              ...p.jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name })),
            ]}
          />
        )}
        {sucht && !p.laedt && (
          <span className="web-gedaempft web-werkzeuge__zahl" role="status">{mitEinheit(p.angezeigt.length, 'Treffer', 'Treffer')}</span>
        )}
      </div>

      <WebKarte titel="Materialien" untertitel={mitEinheit(p.angezeigt.length, 'Material', 'Materialien')} bund={p.angezeigt.length > 0}>
        {ersteLadung ? (
          <WebLaden text="Die Materialien werden geladen." karten={1} />
        ) : p.angezeigt.length === 0 ? (
          <WebLeer icon={ICON_DATEI} titel={leer.titel} text={leer.text} />
        ) : (
          <WebTabelle beschriftung="Materialien" spalten={spalten} zeilen={p.angezeigt} zeileSchluessel={(m) => m.id} mittig />
        )}
      </WebKarte>
    </WebSeite>
  );
};

export default WebMaterialVerwaltung;
