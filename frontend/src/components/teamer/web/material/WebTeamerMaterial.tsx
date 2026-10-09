// Material fuers Team in der Web-Fassung, /teamer/profile/material (Browser ab
// 992 px; docs/planung/web-alle-bereiche.md, Entscheidung 6): die Liste mit
// Suche und Jahrgangs-Filter -- "Fuer alle" oben, danach das uebrige Material --
// und, nach dem Antippen, das Material selbst mit Beschreibung, Details, Links
// und Dateien in zwei Spalten.
//
// Daten, Filter, Auswahl und das Oeffnen von Dateien und Links kommen von der
// Seite (TeamerMaterialPage): Dateien laufen ueber den gemeinsamen Weg von Chat
// und Challenges, Links ueber die Pruefung auf http/https und die anonyme
// Messung. Wie in der App ersetzt das Material die Liste.

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_DATEI, ICON_DATEI_GEFUELLT, ICON_LINK, ICON_ZURUECK } from '../../../shared/icons';
import { materialStats } from '../../../../utils/materialStats';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { suchbegriff } from '../../../../utils/supportWeb';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebSuche from '../../../web/WebSuche';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebLaden, WebLeer } from '../../../web/WebZustaende';
import { WebFilterAuswahl, WebSymbol, WebZeilenKnopf } from '../../../admin/web/leitung/WebLeitungBausteine';
import WebMaterialInhalt from './WebMaterialInhalt';
import { MATERIAL_ALLE_JAHRGAENGE, MATERIAL_TEAM_TITEL_WEB, MATERIAL_TEAM_UNTERTITEL, materialTeamLeer } from '../../../../seiten/materialTeam';
import type { LadendeDatei, MaterialDatei, MaterialDetailDaten, MaterialListeneintrag } from './materialTypen';

export interface WebTeamerMaterialProps {
  /** Die Liste nach Suche und Jahrgang gefiltert, "Fuer alle" und uebriges getrennt. */
  fuerAlle: readonly MaterialListeneintrag[];
  uebrige: readonly MaterialListeneintrag[];
  jahrgaenge: ReadonlyArray<{ id: number; name: string }>;
  jahrgangId: number | undefined;
  onJahrgang: (id: number | undefined) => void;
  suche: string;
  onSuche: (suche: string) => void;
  laedt: boolean;
  /** Das gewaehlte Material (Detail) oder null: dann die Liste. */
  material: MaterialDetailDaten | null;
  materialLaedt: boolean;
  onOeffnen: (id: number) => void;
  onSchliessen: () => void;
  ladendeDatei?: LadendeDatei | null;
  onDatei: (datei: MaterialDatei) => void;
  onLink: (url: string) => void;
}

/** Wie viel am Material haengt (Dateien, Links, Events) -- danach sortiert die Spalte „Inhalt"; ohne Inhalt unten. */
const inhaltAnzahl = (m: MaterialListeneintrag): number | null => {
  const summe = (m.file_count ?? 0) + (m.link_count ?? (m.link_url ? 1 : 0)) + (m.event_count ?? 0);
  return summe > 0 ? summe : null;
};

const inhaltZeile = (m: MaterialListeneintrag): React.ReactNode => {
  const links = m.link_count ?? (m.link_url ? 1 : 0);
  const teile = [
    (m.file_count ?? 0) > 0 ? mitEinheit(m.file_count ?? 0, 'Datei', 'Dateien') : null,
    links > 0 ? (links === 1 ? '1 Link' : `${links} Links`) : null,
    (m.event_count ?? 0) > 0 ? mitEinheit(m.event_count ?? 0, 'Event', 'Events') : null,
  ].filter(Boolean);
  return teile.length > 0 ? <span className="web-pillreihe web-pillreihe--eine-zeile">{teile.map((t) => <WebPill key={String(t)}>{t}</WebPill>)}</span> : <span className="web-gedaempft">–</span>;
};

const WebTeamerMaterial: React.FC<WebTeamerMaterialProps> = (p) => {
  const sucht = suchbegriff(p.suche) !== '';

  // Das Material ist gewaehlt (oder wird geladen): es ersetzt die Liste wie in der App.
  if (p.materialLaedt || p.material) {
    const zurueck = (
      <WebKnopf onClick={p.onSchliessen}>
        <IonIcon icon={ICON_ZURUECK} aria-hidden="true" />
        Alle Materialien
      </WebKnopf>
    );
    if (!p.material) {
      return (
        <WebSeite bereich="Material" titel="Material" aktionen={zurueck}>
          <WebLaden karten={2} text="Das Material wird geladen." />
        </WebSeite>
      );
    }
    return (
      <WebSeite bereich="Material" titel={p.material.title} untertitel="Material" aktionen={zurueck}>
        <WebMaterialInhalt material={p.material} ladendeDatei={p.ladendeDatei} onDatei={p.onDatei} onLink={p.onLink} spalten />
      </WebSeite>
    );
  }

  if (p.laedt) {
    return (
      <WebSeite bereich="Material" titel={MATERIAL_TEAM_TITEL_WEB}>
        <WebLaden kacheln={3} karten={1} text="Die Materialien werden geladen." />
      </WebSeite>
    );
  }

  const spalten: Array<WebSpalte<MaterialListeneintrag>> = [
    {
      schluessel: 'titel',
      kopf: 'Material',
      breite: '46%',
      sortWert: (m) => m.title,
      zelle: (m) => (
        <span className="web-person-zelle">
          <WebSymbol icon={m.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT} ton="material" />
          <span className="web-person-zelle__text">
            <WebZeilenKnopf onClick={() => p.onOeffnen(m.id)} aria-label={`${m.title} öffnen`}>{m.title}</WebZeilenKnopf>
            {m.description && <span className="web-zelle-leise web-zwei-zeilen">{m.description}</span>}
          </span>
        </span>
      ),
    },
    {
      schluessel: 'jahrgaenge',
      kopf: 'Jahrgänge',
      optional: true,
      breite: '22%',
      sortWert: (m) => (m.jahrgaenge ?? []).map((j) => j.name).join(', ') || null,
      zelle: (m) => {
        const namen = (m.jahrgaenge ?? []).map((j) => j.name);
        return namen.length > 0 ? <span className="web-zelle-leise">{namen.join(', ')}</span> : <span className="web-gedaempft">–</span>;
      },
    },
    { schluessel: 'inhalt', kopf: 'Inhalt', sortWert: inhaltAnzahl, zelle: inhaltZeile },
  ];

  const tabelle = (titel: string, zeilen: readonly MaterialListeneintrag[], beschriftung: string) => (
    <WebKarte titel={titel} untertitel={mitEinheit(zeilen.length, 'Material', 'Materialien')} bund>
      <WebTabelle beschriftung={beschriftung} spalten={spalten} zeilen={zeilen} zeileSchluessel={(m) => m.id} mittig fest />
    </WebKarte>
  );

  const alle = [...p.fuerAlle, ...p.uebrige];
  const stats = materialStats(alle);

  return (
    <WebSeite bereich="Material" titel={MATERIAL_TEAM_TITEL_WEB} untertitel={MATERIAL_TEAM_UNTERTITEL}>
      <div className="web-raster web-raster--kacheln">
        <WebKachel label="Material" wert={String(stats.material)} />
        <WebKachel label="Dateien" wert={String(stats.dateien)} />
        <WebKachel label="Links" wert={String(stats.links)} />
      </div>

      <div className="web-werkzeuge">
        <WebSuche beschriftung="Material durchsuchen" platzhalter="Titel oder Beschreibung …" wert={p.suche} onWert={p.onSuche} />
        {p.jahrgaenge.length > 0 && (
          <WebFilterAuswahl
            label="Jahrgang"
            wert={p.jahrgangId === undefined ? 'alle' : String(p.jahrgangId)}
            onWert={(w) => p.onJahrgang(w === 'alle' ? undefined : Number(w))}
            optionen={[{ wert: 'alle', label: MATERIAL_ALLE_JAHRGAENGE }, ...p.jahrgaenge.map((j) => ({ wert: String(j.id), label: j.name }))]}
          />
        )}
        {(sucht || p.jahrgangId !== undefined) && (
          <span className="web-gedaempft web-werkzeuge__zahl" role="status">{mitEinheit(alle.length, 'Treffer', 'Treffer')}</span>
        )}
      </div>

      {alle.length === 0 ? (
        <WebKarte titel="Material">
          <WebLeer
            icon={ICON_DATEI}
            titel={materialTeamLeer(sucht || p.jahrgangId !== undefined).titel}
            text={materialTeamLeer(sucht || p.jahrgangId !== undefined).text}
          />
        </WebKarte>
      ) : (
        <>
          {p.fuerAlle.length > 0 && tabelle('Für alle', p.fuerAlle, 'Material für alle')}
          {p.uebrige.length > 0 && tabelle('Materialien', p.uebrige, 'Materialien')}
        </>
      )}
    </WebSeite>
  );
};

export default WebTeamerMaterial;
