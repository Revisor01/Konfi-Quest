// Material verwalten in der Web-Fassung, /admin/material (Browser ab 992 px;
// docs/planung/web-alle-bereiche.md, Entscheidung 6): eine Tabelle mit Titel,
// Sichtbarkeit und dem, was am Material haengt, dazu Suche und Jahrgangs-Filter
// -- oder dieselben Materialien als Kacheln (Umschalter Liste | Kacheln, die
// Wahl merkt sich der Browser; Vorgabe Liste).
//
// Rahmen, Werkzeugzeile und Zustaende stellt WebListenSeite (10.10.2026); hier
// stehen nur Spalten, Karte und Daten.
//
// Daten, Filter und Fenster kommen von der Seite (AdminMaterialPage): Das
// Formular ist dasselbe Fenster wie in der App (MaterialFormModal), das Loeschen
// fragt dieselbe Rueckfrage. Bearbeiten und Loeschen darf nur die erstellende
// Person oder die Gemeindeleitung (darfMaterialBearbeiten); wer es nicht darf,
// sieht das Material schreibgeschuetzt ("Ansehen"). Die Suche fragt wie dort den
// Server -- nach einer kurzen Pause im Tippen, nicht bei jedem Zeichen --, und
// auch der Jahrgang filtert auf dem Server: Die Huelle filtert hier nichts
// selbst, sie zeigt, was die Seite hereinreicht.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_BEARBEITEN,
  ICON_DATEI,
  ICON_DATEI_GEFUELLT,
  ICON_GRUPPE,
  ICON_HINZUFUEGEN,
  ICON_LINK,
  ICON_LOESCHEN,
  ICON_PERSON,
  ICON_SICHTBAR,
} from '../../../shared/icons';
import { mitEinheit } from '../../../../utils/supportStatistik';
import { materialStats } from '../../../../utils/materialStats';
import WebKnopf from '../../../web/WebKnopf';
import WebKreis from '../../../web/WebKreis';
import WebPill from '../../../web/WebPill';
import { WebBildKarteSymbol, type WebBildKarteProps } from '../../../web/WebBildKarte';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebSpalte } from '../../../web/WebListe';
import { WebZeilenAktionen } from './WebLeitungBausteine';
import type { MaterialEintrag } from './verwaltungTypen';
import { MATERIAL_LEITUNG_FILTER, MATERIAL_LEITUNG_TITEL, MATERIAL_LEITUNG_UNTERTITEL, materialLeitungLeer } from '../../../../seiten/materialLeitung';

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

/** Wie viel am Material haengt: Dateien, Links und Events als kurze Texte. */
const inhaltTeile = (m: MaterialEintrag): string[] => {
  const links = m.link_count ?? (m.link_url ? 1 : 0);
  return [
    (m.file_count ?? 0) > 0 ? mitEinheit(m.file_count ?? 0, 'Datei', 'Dateien') : null,
    links > 0 ? (links === 1 ? '1 Link' : `${links} Links`) : null,
    (m.event_count ?? 0) > 0 ? mitEinheit(m.event_count ?? 0, 'Event', 'Events') : null,
  ].filter((t): t is string => Boolean(t));
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

  const ersteLadung = p.laedt && p.alle.length === 0;
  const stats = materialStats(p.alle.map((m) => ({ file_count: m.file_count, link_url: m.link_url })));
  const beschriftung = (m: MaterialEintrag) => `${m.title} ${p.darfBearbeiten(m) ? 'bearbeiten' : 'ansehen'}`;

  const spalten: Array<WebSpalte<MaterialEintrag>> = [
    {
      schluessel: 'titel',
      kopf: 'Material',
      breite: '32%',
      sortWert: (m) => m.title,
      zelle: (m) => (
        <WebNameZelle
          kreis={<WebKreis icon={m.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT} ton="material" />}
          titel={m.title}
          onKlick={() => p.onOeffnen(m)}
          beschriftung={beschriftung(m)}
          unterzeile={m.description || undefined}
          unterzeileTitel={m.description || undefined}
        />
      ),
    },
    {
      schluessel: 'sichtbar',
      kopf: 'Sichtbar für',
      breite: '18%',
      optional: true,
      sortWert: (m) => (m.ist_global ? 'Für alle' : jahrgangsText(m)),
      zelle: (m) => (m.ist_global
        ? <WebPill ton="info">Für alle</WebPill>
        : (jahrgangsText(m) ?? <span className="web-gedaempft">–</span>)),
    },
    {
      schluessel: 'inhalt',
      kopf: 'Inhalt',
      // Wie viel dranhaengt: Dateien, Links und Events zusammen
      sortWert: (m) => (m.file_count ?? 0) + (m.link_count ?? (m.link_url ? 1 : 0)) + (m.event_count ?? 0),
      zelle: (m) => {
        const teile = inhaltTeile(m);
        return teile.length > 0
          ? <span className="web-pillreihe web-pillreihe--eine-zeile">{teile.map((t) => <WebPill key={t}>{t}</WebPill>)}</span>
          : <span className="web-gedaempft">–</span>;
      },
    },
    {
      schluessel: 'ersteller',
      kopf: 'Erstellt von',
      breite: '140px',
      optional: true,
      sortWert: (m) => m.created_by_name,
      zelle: (m) => m.created_by_name || <span className="web-gedaempft">–</span>,
    },
    {
      // Je Zeile andere Knoepfe (eigenes Material: Bearbeiten und Loeschen, fremdes: Ansehen),
      // deshalb nicht die festen Aktionen der Liste.
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      klasse: 'web-spalte-aktionen-breit',
      zelle: (m) => (p.darfBearbeiten(m) ? (
        <WebZeilenAktionen name={m.title} onBearbeiten={() => p.onOeffnen(m)} onLoeschen={() => p.onLoeschen(m)} loeschenTitel="Material löschen" />
      ) : (
        <div className="web-zeilenaktionen">
          <WebKnopf klein vorn onClick={() => p.onOeffnen(m)} aria-label={`${m.title} ansehen`}>
            <IonIcon icon={ICON_SICHTBAR} aria-hidden="true" />
            <span className="web-knopf__text">Ansehen</span>
          </WebKnopf>
        </div>
      )),
    },
  ];

  /** Die Karte: Symbol (Link oder Datei) und Sichtbarkeit im Kopf, darunter Beschreibung und was dranhaengt. */
  const karte = (m: MaterialEintrag): Omit<WebBildKarteProps, 'fuss'> => ({
    akzent: 'var(--app-color-material)',
    symbol: <WebBildKarteSymbol icon={m.link_url ? ICON_LINK : ICON_DATEI_GEFUELLT} />,
    label: m.ist_global ? 'Für alle' : (jahrgangsText(m) ?? 'Material'),
    titelImKopf: true,
    titel: m.title,
    onTitel: () => p.onOeffnen(m),
    titelBeschriftung: beschriftung(m),
    text: m.description || undefined,
    angaben: [
      inhaltTeile(m).length > 0 && { icon: ICON_DATEI_GEFUELLT, inhalt: inhaltTeile(m).join(' · ') },
      !m.ist_global && jahrgangsText(m) && { icon: ICON_GRUPPE, inhalt: jahrgangsText(m) },
      m.created_by_name && { icon: ICON_PERSON, inhalt: `Erstellt von ${m.created_by_name}` },
    ],
  });

  // Der Leerzustand aus der gemeinsamen Beschreibung (seiten/materialLeitung.ts).
  const leer = materialLeitungLeer({ ohneJahrgang: p.ohneJahrgang, suche: p.suche, filter: p.filter }, 'web');

  return (
    <WebListenSeite<MaterialEintrag>
      bereich="Verwaltung"
      titel={MATERIAL_LEITUNG_TITEL}
      untertitel={MATERIAL_LEITUNG_UNTERTITEL}
      aktionen={(
        <WebKnopf art="primaer" onClick={p.onAnlegen}>
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neues Material
        </WebKnopf>
      )}
      zurueck={{ href: '/admin/settings', text: 'Mehr' }}
      pageRef={p.pageRef}
      kennzahlen={[
        { label: 'Material', wert: ersteLadung ? '–' : String(stats.material) },
        { label: 'Dateien', wert: ersteLadung ? '–' : String(stats.dateien) },
        { label: 'Links', wert: ersteLadung ? '–' : String(stats.links) },
      ]}
      // Suche ohne `felder`: Sie fragt den Server (oben, nach der Pause im Tippen).
      suche={{ beschriftung: 'Material durchsuchen', platzhalter: 'Titel oder Beschreibung …', wert: eingabe, onWert: setEingabe }}
      // Der Jahrgang filtert auf dem Server, "Nur globales Material" die Seite -- die Wahlen ohne `passt`.
      filter={[p.jahrgaenge.length > 0 && {
        beschriftung: 'Jahrgang',
        darstellung: 'auswahl',
        wahlen: [
          ...MATERIAL_LEITUNG_FILTER.map((f) => ({ schluessel: f.schluessel as string, label: f.label })),
          ...p.jahrgaenge.map((j) => ({ schluessel: String(j.id), label: j.name })),
        ],
        wert: p.filter,
        onWert: p.onFilter,
      }]}
      zaehlzeile={(n) => (p.laedt ? '' : mitEinheit(n, 'Treffer', 'Treffer'))}
      ansicht={{ seite: 'material', vorgabe: 'liste' }}
      eintraege={p.angezeigt}
      liste={{ beschriftung: 'Materialien', spalten, zeileSchluessel: (m) => m.id, mittig: true }}
      kacheln={{
        beschriftung: 'Materialien',
        schluessel: (m) => m.id,
        karte,
        // Wie am Zeilenende: eigenes Material Bearbeiten und Loeschen, fremdes Ansehen.
        fuss: (m) => (p.darfBearbeiten(m) ? (
          <>
            <WebKnopf klein vorn onClick={() => p.onOeffnen(m)} aria-label={`${m.title} bearbeiten`}>
              <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
              Bearbeiten
            </WebKnopf>
            <WebKnopf klein vorn art="gefahr" onClick={() => p.onLoeschen(m)} aria-label={`${m.title} löschen`}>
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
              Löschen
            </WebKnopf>
          </>
        ) : (
          <WebKnopf klein vorn onClick={() => p.onOeffnen(m)} aria-label={`${m.title} ansehen`}>
            <IonIcon icon={ICON_SICHTBAR} aria-hidden="true" />
            Ansehen
          </WebKnopf>
        )),
      }}
      leer={{ icon: ICON_DATEI, titel: leer.titel, text: leer.text }}
      inhaltLaden={ersteLadung ? 'Die Materialien werden geladen.' : undefined}
    />
  );
};

export default WebMaterialVerwaltung;
