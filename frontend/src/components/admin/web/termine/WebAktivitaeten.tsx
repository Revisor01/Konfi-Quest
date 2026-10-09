// Die Aktivitaeten der Leitung -- die Vorlagen, fuer die es Punkte gibt -- als
// Tabelle oder Kacheln (Web-Fassung, 03.10.2026; Kacheln wie die Challenges
// seit 07.10.2026; Seite unter Mehr: WebAktivitaetenSeite). Reiter Konfis und
// Team (die Team-Aktivitaeten tragen keine Punkte), Filter nach Art, Suche.
// Anlegen und Aendern im vorhandenen Fenster (ActivityManagementModal),
// Loeschen nach Rueckfrage -- die Logik steht in useAktivitaetenVerwaltung,
// dieselbe wie bei der Seite der App (AdminActivitiesPage).

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_AKTION_GEFUELLT,
  ICON_BEARBEITEN,
  ICON_GEMEINDE_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_HINZUFUEGEN,
  ICON_KATEGORIE_GEFUELLT,
  ICON_LOESCHEN,
  ICON_POKAL_GEFUELLT,
} from '../../../shared/icons';
import { suchTreffer, suchbegriff } from '../../../../utils/supportWeb';
import WebChips from '../../../web/WebChips';
import WebSuche from '../../../web/WebSuche';
import WebKnopf from '../../../web/WebKnopf';
import WebPill from '../../../web/WebPill';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import WebTreffer from '../../../web/WebTreffer';
import WebAnsichtUmschalter from '../../../web/WebAnsichtUmschalter';
import WebBildKarte, { WebBildKarteSymbol } from '../../../web/WebBildKarte';
import { useAnsicht } from '../../../web/useAnsicht';
import { WebLeer } from '../../../web/WebZustaende';
import type { Aktivitaet, AktivitaetenRolle } from '../../useAktivitaetenVerwaltung';
import '../../../../theme/web/termine.css';
import { inFassung, wahlVon } from '../../../../seiten/beschreibung';
import {
  KATALOG_ART,
  KATALOG_ART_BESCHRIFTUNG,
  KATALOG_LEER,
  KATALOG_ROLLE,
  KATALOG_ROLLE_BESCHRIFTUNG,
  type KatalogArt,
} from '../../../../seiten/aktivitaetenKatalog';

type ArtFilter = KatalogArt;

/** Kopf der Kachel je Art: Farbe und Symbol der Punktearten der App, Team in der Teamer-Farbe. */
const FARBE = {
  gottesdienst: { akzent: 'var(--app-color-gottesdienst)', dunkel: 'var(--app-color-gottesdienst-dunkel)', icon: ICON_GOTTESDIENST_GEFUELLT, label: 'Gottesdienst' },
  gemeinde: { akzent: 'var(--app-color-gemeinde)', dunkel: 'var(--app-color-gemeinde)', icon: ICON_GEMEINDE_GEFUELLT, label: 'Gemeinde' },
  team: { akzent: 'var(--app-color-teamer)', dunkel: 'var(--app-color-teamer-dunkel)', icon: ICON_AKTION_GEFUELLT, label: 'Team' },
} as const;

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
  // Leitung startet mit der Liste wie Events, Challenges und Konfis.
  const [ansicht, setAnsicht] = useAnsicht('aktivitaeten', 'liste');
  const team = rolle === 'teamer';

  // Zahl je Art und die Art selbst aus der gemeinsamen Beschreibung (seiten/aktivitaetenKatalog.ts).
  const zaehlen = useMemo(() => Object.fromEntries(
    KATALOG_ART.map((r) => [r.schluessel, aktivitaeten.filter((a) => r.passt?.(a) ?? true).length]),
  ) as Record<ArtFilter, number>, [aktivitaeten]);

  // Nach Name sortiert, wie die Liste der App.
  const sichtbar = useMemo(() => aktivitaeten
    .filter((a) => team || (wahlVon(KATALOG_ART, art).passt?.(a) ?? true))
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
      sortWert: (a) => a.name,
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
      sortWert: (a) => (a.categories ?? []).map((k) => k.name).join(', '),
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
        sortWert: (a) => (a.type === 'gottesdienst' ? 'Gottesdienst' : a.type === 'gemeinde' ? 'Gemeinde' : null),
        zelle: (a) => (a.type === 'gottesdienst'
          ? <WebPill ton="info">Gottesdienst</WebPill>
          : a.type === 'gemeinde' ? <WebPill ton="erfolg">Gemeinde</WebPill> : <span className="web-gedaempft">–</span>),
      },
      {
        schluessel: 'punkte',
        kopf: 'Punkte',
        breite: '88px',
        zahl: true,
        sortWert: (a) => a.points,
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
          beschriftung={KATALOG_ROLLE_BESCHRIFTUNG}
          wert={rolle}
          onWert={(r) => { setArt('alle'); onRolle(r); }}
          chips={inFassung(KATALOG_ROLLE, 'web').map((r) => ({ wert: r.schluessel, label: r.label }))}
        />
        {!team && (
          <WebChips<ArtFilter>
            beschriftung={KATALOG_ART_BESCHRIFTUNG}
            wert={art}
            onWert={setArt}
            chips={inFassung(KATALOG_ART, 'web').map((r) => ({ wert: r.schluessel, label: r.label, zahl: zaehlen[r.schluessel] }))}
          />
        )}
        <div className="web-werkzeuge__rechts">
          {darfAnlegen && (
            <WebKnopf art="primaer" onClick={onAnlegen} aria-label="Neue Aktivität anlegen">
              <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
              Neue Aktivität
            </WebKnopf>
          )}
          <WebSuche beschriftung="Aktivität suchen" platzhalter="Aktivität suchen" wert={suche} onWert={setSuche} />
          {/* Der Umschalter steht immer ganz rechts neben der Suche. */}
          <WebAnsichtUmschalter wert={ansicht} onWert={setAnsicht} />
        </div>
      </div>

      {sichtbar.length > 0 && ansicht === 'kacheln' ? (
        <ul className="web-bildkarten" aria-label="Aktivitäten">
          {sichtbar.map((a) => {
            const art = team ? FARBE.team : a.type === 'gottesdienst' ? FARBE.gottesdienst : FARBE.gemeinde;
            return (
              <li key={a.id} className="web-bildkarten__eintrag">
                <WebBildKarte
                  akzent={art.akzent}
                  akzentDunkel={art.dunkel}
                  symbol={<WebBildKarteSymbol icon={art.icon} />}
                  label={art.label}
                  titelImKopf
                  titel={<WebTreffer text={a.name} suche={suche} />}
                  onTitel={darfBearbeiten ? () => onBearbeiten(a) : undefined}
                  titelBeschriftung={`${a.name} bearbeiten`}
                  text={a.description || undefined}
                  angaben={[
                    !team && { icon: ICON_POKAL_GEFUELLT, inhalt: `+${a.points} ${a.points === 1 ? 'Punkt' : 'Punkte'}`, farbe: 'var(--app-color-warning)' },
                    a.categories && a.categories.length > 0 && {
                      icon: ICON_KATEGORIE_GEFUELLT,
                      inhalt: a.categories.map((k) => k.name).join(', '),
                      farbe: 'var(--app-color-categories)',
                    },
                  ]}
                  fuss={(darfBearbeiten || darfLoeschen) ? (
                    <>
                      {darfBearbeiten && (
                        <WebKnopf klein vorn onClick={() => onBearbeiten(a)} aria-label="Aktivität bearbeiten">
                          <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
                          Bearbeiten
                        </WebKnopf>
                      )}
                      {darfLoeschen && (
                        <WebKnopf klein vorn art="gefahr" onClick={() => onLoeschen(a)} aria-label="Aktivität löschen">
                          <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
                          Löschen
                        </WebKnopf>
                      )}
                    </>
                  ) : undefined}
                />
              </li>
            );
          })}
        </ul>
      ) : (
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
            titel={sucht ? 'Keine Treffer' : KATALOG_LEER.titel}
            text={sucht ? `Zu „${suche.trim()}“ gibt es hier keine Aktivität.` : KATALOG_LEER.text}
            aktion={sucht ? <WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf> : undefined}
          />
        )}
      </div>
      )}
    </>
  );
};
