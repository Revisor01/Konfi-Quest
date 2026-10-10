// /admin/activities in der Web-Fassung: der Katalog der Aktivitaeten -- die
// Vorlagen, fuer die es Punkte gibt -- als Seite unter Mehr, wie in der App
// (Simon, 06.10.2026: der Reiter unter Mitmachen heisst ueberall
// „Aktivitaeten" und zeigt die gemeldeten). Oben links fuehrt „Mehr" zurueck
// wie auf den anderen Seiten von Mehr.
//
// Tabelle oder Kacheln (07.10.2026), Reiter Konfis und Team (die
// Team-Aktivitaeten tragen keine Punkte und keine Art), Filter nach Art,
// Suche in Name und Beschreibung. Rahmen, Werkzeugzeile und Zustaende stellt
// WebListenSeite (10.10.2026, die erste Seite darauf); hier stehen nur
// Spalten, Karte und Daten. Reiter, Filter und Leertexte kommen aus der
// gemeinsamen Beschreibung (seiten/aktivitaetenKatalog.ts).
//
// Laden, Anlegen und Aendern (ActivityManagementModal) und Loeschen nach
// Rueckfrage stehen in useAktivitaetenVerwaltung -- dieselben wie bei der Seite
// der App (AdminActivitiesPage), die hier hereinreicht.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION_GEFUELLT,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_HINZUFUEGEN,
  ICON_KATEGORIE_GEFUELLT,
  ICON_POKAL_GEFUELLT,
} from '../../../shared/icons';
import { suchbegriff } from '../../../../utils/supportWeb';
import WebListenSeite from '../../../web/WebListenSeite';
import { WebNameZelle, type WebAktion, type WebSpalte } from '../../../web/WebListe';
import { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebTreffer from '../../../web/WebTreffer';
import type { Aktivitaet, AktivitaetenRolle, useAktivitaetenVerwaltung } from '../../useAktivitaetenVerwaltung';
import '../../../../theme/web/termine.css';
import {
  KATALOG_ART,
  KATALOG_ART_BESCHRIFTUNG,
  KATALOG_LEER,
  KATALOG_ROLLE,
  KATALOG_ROLLE_BESCHRIFTUNG,
  KATALOG_TITEL,
  katalogUntertitel,
} from '../../../../seiten/aktivitaetenKatalog';

const ZURUECK = { href: '/admin/settings', text: 'Mehr' };

/** Kopf der Kachel je Art: Farbe und Symbol der Punktearten der App, Team in der Teamer-Farbe. */
const FARBE = {
  gottesdienst: { akzent: 'var(--app-color-gottesdienst)', dunkel: 'var(--app-color-gottesdienst-dunkel)', icon: ICON_GOTTESDIENST_GEFUELLT, label: 'Gottesdienst' },
  gemeinde: { akzent: 'var(--app-color-gemeinde)', dunkel: 'var(--app-color-gemeinde)', icon: ICON_GEMEINDE_GEFUELLT, label: 'Gemeinde' },
  team: { akzent: 'var(--app-color-teamer)', dunkel: 'var(--app-color-teamer-dunkel)', icon: ICON_AKTION_GEFUELLT, label: 'Team' },
} as const;

/** Die Liste liefert zu jeder Aktivitaet ihre Kategorien mit. */
export type AktivitaetZeile = Aktivitaet & { categories?: Array<{ id: number; name: string }> };

const kategorienText = (a: AktivitaetZeile): string => (a.categories ?? []).map((k) => k.name).join(', ');

const WebAktivitaetenSeite: React.FC<{
  pageRef: React.Ref<HTMLElement>;
  verwaltung: ReturnType<typeof useAktivitaetenVerwaltung>;
}> = ({ pageRef, verwaltung: v }) => {
  const [art, setArt] = useState<string>('alle');
  const [suche, setSuche] = useState('');
  const team = v.rolle === 'teamer';

  // Nach Name sortiert, wie die Liste der App; die Spaltenkoepfe ordnen danach um.
  const aktivitaeten = useMemo(
    () => [...((v.aktivitaeten ?? []) as AktivitaetZeile[])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')),
    [v.aktivitaeten],
  );

  const bearbeiten: WebAktion<AktivitaetZeile> | undefined = v.darfBearbeiten
    ? { onKlick: v.bearbeiten, beschriftung: () => 'Aktivität bearbeiten' }
    : undefined;
  const loeschen: WebAktion<AktivitaetZeile> | undefined = v.darfLoeschen
    ? { onKlick: (a) => { void v.loeschen(a); }, beschriftung: () => 'Aktivität löschen' }
    : undefined;

  const spalten: Array<WebSpalte<AktivitaetZeile>> = [
    {
      schluessel: 'name',
      kopf: 'Aktivität',
      breite: '34%',
      sortWert: (a) => a.name,
      zelle: (a) => (
        <WebNameZelle
          titel={<WebTreffer text={a.name} suche={suche} />}
          onKlick={v.darfBearbeiten ? () => v.bearbeiten(a) : undefined}
          beschriftung={`${a.name} bearbeiten`}
          unterzeile={a.description || undefined}
          unterzeileTitel={a.description || undefined}
        />
      ),
    },
    {
      schluessel: 'kategorien',
      kopf: 'Kategorien',
      optional: true,
      sortWert: kategorienText,
      zelle: (a) => kategorienText(a) || <span className="web-gedaempft">–</span>,
    },
    ...(team ? [] : [
      {
        schluessel: 'art',
        kopf: 'Art',
        breite: '132px',
        sortWert: (a: AktivitaetZeile) => (a.type === 'gottesdienst' ? 'Gottesdienst' : a.type === 'gemeinde' ? 'Gemeinde' : null),
        zelle: (a: AktivitaetZeile) => (a.type === 'gottesdienst'
          ? <WebPill ton="info">Gottesdienst</WebPill>
          : a.type === 'gemeinde' ? <WebPill ton="erfolg">Gemeinde</WebPill> : <span className="web-gedaempft">–</span>),
      },
      {
        schluessel: 'punkte',
        kopf: 'Punkte',
        breite: '88px',
        zahl: true,
        sortWert: (a: AktivitaetZeile) => a.points,
        zelle: (a: AktivitaetZeile) => `+${a.points}P`,
      },
    ]),
  ];

  const sucht = suchbegriff(suche) !== '';

  return (
    <WebListenSeite<AktivitaetZeile, AktivitaetenRolle>
      bereich="Verwaltung"
      titel={KATALOG_TITEL}
      untertitel={katalogUntertitel(v.rolle)}
      zurueck={ZURUECK}
      pageRef={pageRef}
      laden={v.loading ? { text: 'Die Aktivitäten werden geladen.' } : undefined}
      fehler={!v.loading && !v.aktivitaeten ? { text: 'Die Aktivitäten konnten nicht geladen werden.', onErneut: () => { void v.refresh(); } } : undefined}
      reiter={{
        beschriftung: KATALOG_ROLLE_BESCHRIFTUNG,
        wahlen: KATALOG_ROLLE,
        wert: v.rolle,
        onWert: (r) => { setArt('alle'); v.setRolle(r); },
      }}
      // Beim Team gibt es keine Art und keinen Filter.
      filter={[!team && { beschriftung: KATALOG_ART_BESCHRIFTUNG, wahlen: KATALOG_ART, wert: art, onWert: setArt, zahlen: true }]}
      suche={{
        beschriftung: 'Aktivität suchen',
        platzhalter: 'Aktivität suchen',
        wert: suche,
        onWert: setSuche,
        felder: (a) => [a.name, a.description],
      }}
      werkzeuge={v.darfAnlegen ? (
        <WebKnopf art="primaer" onClick={v.anlegen} aria-label="Neue Aktivität anlegen">
          <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
          Neue Aktivität
        </WebKnopf>
      ) : undefined}
      // Leitung startet mit der Liste wie Events, Challenges und Konfis.
      ansicht={{ seite: 'aktivitaeten', vorgabe: 'liste' }}
      eintraege={aktivitaeten}
      liste={{
        beschriftung: 'Aktivitäten',
        spalten,
        zeileSchluessel: (a) => a.id,
        mittig: true,
        fest: true,
        bearbeiten,
        loeschen,
      }}
      kacheln={{
        beschriftung: 'Aktivitäten',
        schluessel: (a) => a.id,
        bearbeiten,
        loeschen,
        karte: (a) => {
          const farbe = team ? FARBE.team : a.type === 'gottesdienst' ? FARBE.gottesdienst : FARBE.gemeinde;
          return {
            akzent: farbe.akzent,
            akzentDunkel: farbe.dunkel,
            symbol: <WebBildKarteSymbol icon={farbe.icon} />,
            label: farbe.label,
            titelImKopf: true,
            titel: <WebTreffer text={a.name} suche={suche} />,
            onTitel: v.darfBearbeiten ? () => v.bearbeiten(a) : undefined,
            titelBeschriftung: `${a.name} bearbeiten`,
            text: a.description || undefined,
            angaben: [
              !team && { icon: ICON_POKAL_GEFUELLT, inhalt: `+${a.points} ${a.points === 1 ? 'Punkt' : 'Punkte'}`, farbe: 'var(--app-color-warning)' },
              kategorienText(a) && { icon: ICON_KATEGORIE_GEFUELLT, inhalt: kategorienText(a), farbe: 'var(--app-color-categories)' },
            ],
          };
        },
      }}
      leer={{
        icon: ICON_AKTION_GEFUELLT,
        titel: sucht ? 'Keine Treffer' : KATALOG_LEER.titel,
        text: sucht ? `Zu „${suche.trim()}“ gibt es hier keine Aktivität.` : KATALOG_LEER.text,
        aktion: sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined,
      }}
    />
  );
};

export default WebAktivitaetenSeite;
