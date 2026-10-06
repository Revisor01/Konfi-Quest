// Gemeinden in der Web-Fassung der Support-Ansicht, /admin/organizations
// (docs/planung/support-web.md, Entscheidung 4).
//
// Simon, 03.10.2026: "Die Gemeindeansichten sollten nach Landeskirche und nach
// Kirchenkreisen geordnet sein, mit Akkordeon und einer Live-Suche. Auch
// braucht man auf den Gemeinden eigentlich sofort einen Zugriff auf den Admin,
// nicht erst nach Klick und Details und wieder Klick."
//
// Also: Akkordeon Landeskirche -> Kirchenkreis, darin eine Tabelle je
// Gemeinde mit der Gemeindeleitung direkt in der Zeile (Name, Benutzername,
// E-Mail als Link, gesperrt, zuletzt angemeldet) und den Aktionen Bearbeiten
// (das Formular "Gemeinde") und Schreiben (Schriftwechsel). Die Suche findet
// Gemeinde, Kirchenkreis, Landeskirche und alles an der Gemeindeleitung und
// klappt die Gruppen mit Treffern auf. Welche Gruppen zu sind, merkt sich der
// Browser (localStorage, ohne ihn funktioniert alles trotzdem).
//
// Daten: GET /support/gemeinden (nur Super-Admin). Die Aktionen
// (Formular, Loeschen, ?gemeinde=<id>) teilt sich die Seite mit der App.

import React, { useCallback, useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import {
  ICON_BEARBEITEN,
  ICON_HINZUFUEGEN,
  ICON_LOESCHEN,
  ICON_MAIL,
  ICON_ORGANISATION,
} from '../../shared/icons';
import api from '../../../services/api';
import { useLiveRefresh } from '../../../contexts/LiveUpdateContext';
import { lizenzFinden } from '../../../utils/lizenzen';
import { datumKurz } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { mitEinheit, zahl } from '../../../utils/supportStatistik';
import {
  gemeindePasst,
  gemeindenGruppieren,
  gemeindenLesen,
  gruppenSchluessel,
  laufzeitAngabe,
  limitAnteil,
  limitTon,
  suchbegriff,
  type KirchenkreisGruppe,
  type SupportGemeinde,
} from '../../../utils/supportWeb';
import { useGemeindeAktionen } from '../../admin/pages/useGemeindeAktionen';
import WebSeite from '../../web/WebSeite';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebSuche from '../../web/WebSuche';
import WebAkkordeon from '../../web/WebAkkordeon';
import WebTabelle, { type WebSpalte } from '../../web/WebTabelle';
import WebTreffer from '../../web/WebTreffer';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import { useSupportDaten } from '../useSupportDaten';

/** Wo sich der Browser merkt, welche Gruppen zugeklappt sind (Liste der Schluessel). */
export const SCHLUESSEL_GEMEINDEN_ZU = 'konfiquest.support.gemeinden.zu';

// Speicher kann fehlen oder werfen (privates Fenster, gesperrte Website-Daten):
// dann stehen alle Gruppen offen und nichts wird gemerkt -- die Seite geht trotzdem.
const leseZu = (): string[] => {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL_GEMEINDEN_ZU);
    const liste: unknown = roh ? JSON.parse(roh) : [];
    return Array.isArray(liste) ? liste.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

const merkeZu = (zu: ReadonlySet<string>): void => {
  try {
    window.localStorage.setItem(SCHLUESSEL_GEMEINDEN_ZU, JSON.stringify([...zu]));
  } catch {
    // Nicht merkbar -- bis zum Neuladen gilt der Zustand trotzdem.
  }
};

async function ladeGemeinden(): Promise<SupportGemeinde[]> {
  const antwort = await api.get('/support/gemeinden');
  const liste = gemeindenLesen(antwort.data);
  if (!liste) throw new Error('Die Gemeinden kamen in einer unbekannten Form');
  return liste;
}

const Leitung: React.FC<{ gemeinde: SupportGemeinde; suche: string }> = ({ gemeinde, suche }) => {
  if (gemeinde.leitung.length === 0) return <span className="web-gedaempft">Keine Gemeindeleitung eingetragen</span>;
  return (
    <>
      {gemeinde.leitung.map((l) => (
        <div key={l.id} className="web-person">
          <div className="web-person__kopf">
            <span className="web-person__name"><WebTreffer text={l.display_name} suche={suche} /></span>
            {!l.is_active && <WebPill ton="fehler">gesperrt</WebPill>}
          </div>
          <div className="web-person__zeile">
            <span>@<WebTreffer text={l.username} suche={suche} /></span>
            {l.email && (
              <a className="web-link" href={`mailto:${l.email}`}><WebTreffer text={l.email} suche={suche} /></a>
            )}
            <span>{l.last_login_at ? `zuletzt angemeldet ${zeitpunktText(l.last_login_at)}` : 'noch nie angemeldet'}</span>
          </div>
        </div>
      ))}
    </>
  );
};

const Tabelle: React.FC<{
  gruppe: KirchenkreisGruppe;
  suche: string;
  onBearbeiten: (g: SupportGemeinde) => void;
  onLoeschen: (g: SupportGemeinde) => void;
}> = ({ gruppe, suche, onBearbeiten, onLoeschen }) => {
  const spalten: Array<WebSpalte<SupportGemeinde>> = [
    {
      schluessel: 'name',
      kopf: 'Gemeinde',
      breite: '20%',
      zelle: (g) => (
        <>
          <span className="web-zelle-titel"><WebTreffer text={g.display_name} suche={suche} /></span>
          <span className="web-zelle-leise">angelegt {datumKurz(g.created_at)}</span>
        </>
      ),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '16%',
      zelle: (g) => {
        const laufzeit = laufzeitAngabe(g);
        return (
          <span className="web-pillreihe">
            {!g.is_active && <WebPill ton="fehler" punkt>Gesperrt</WebPill>}
            <WebPill ton={laufzeit.ton} title={laufzeit.titel}>{laufzeit.text}</WebPill>
          </span>
        );
      },
    },
    {
      schluessel: 'konfis',
      kopf: 'Konfis',
      breite: '9%',
      zahl: true,
      zelle: (g) => {
        const anteil = limitAnteil(g);
        const ton = anteil === null ? 'info' : limitTon(anteil);
        return (
          <>
            <span>{g.max_konfis !== null ? `${zahl(g.konfi_count)} / ${zahl(g.max_konfis)}` : zahl(g.konfi_count)}</span>
            {anteil !== null ? (
              <span className="web-limit" aria-hidden="true" title={`${Math.round(anteil * 100)} % des Limits`}>
                <span
                  className={ton === 'fehler' || ton === 'warnung' ? `web-limit__fuellung web-limit__fuellung--${ton}` : 'web-limit__fuellung'}
                  style={{ width: `${Math.min(100, Math.round(anteil * 100))}%` }}
                />
              </span>
            ) : (
              <span className="web-zelle-leise">ohne Limit</span>
            )}
          </>
        );
      },
    },
    { schluessel: 'team', kopf: 'Team', breite: '6%', zahl: true, optional: true, zelle: (g) => zahl(g.team_count) },
    {
      schluessel: 'lizenz',
      kopf: 'Wunschlizenz',
      breite: '10%',
      optional: true,
      zelle: (g) => lizenzFinden(g.wunsch_lizenz)?.name ?? <span className="web-gedaempft">–</span>,
    },
    { schluessel: 'leitung', kopf: 'Gemeindeleitung', zelle: (g) => <Leitung gemeinde={g} suche={suche} /> },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      klasse: 'web-spalte-aktionen',
      kopfVersteckt: true,
      zelle: (g) => (
        <div className="web-aktionen">
          <WebKnopf klein onClick={() => onBearbeiten(g)} aria-label={`${g.display_name} bearbeiten`}>
            <IonIcon icon={ICON_BEARBEITEN} aria-hidden="true" />
            <span className="web-knopf__text">Bearbeiten</span>
          </WebKnopf>
          <WebKnopf klein href={`/admin/support/post/gemeinde/${g.id}`} aria-label={`Schriftwechsel mit ${g.display_name}, schreiben`}>
            <IonIcon icon={ICON_MAIL} aria-hidden="true" />
            <span className="web-knopf__text">Schreiben</span>
          </WebKnopf>
          <WebKnopf klein symbol art="gefahr" onClick={() => onLoeschen(g)} aria-label={`${g.display_name} löschen`} title="Gemeinde löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </div>
      ),
    },
  ];
  return (
    <WebTabelle
      beschriftung={gruppe.name ? `Gemeinden im ${gruppe.name}` : 'Gemeinden ohne Zuordnung'}
      spalten={spalten}
      zeilen={gruppe.gemeinden}
      zeileSchluessel={(g) => g.id}
      zeileKlasse={(g) => (g.is_active ? undefined : 'web-zeile--gesperrt')}
      fest
    />
  );
};

const WebGemeinden: React.FC = () => {
  const { daten, laedt, neuLaden } = useSupportDaten(ladeGemeinden);
  const aktionen = useGemeindeAktionen(neuLaden);
  useLiveRefresh('organizations', neuLaden);

  const [suche, setSuche] = useState('');
  // Zugeklappte Gruppen (Voreinstellung: alle offen, damit neue Gruppen sofort zu sehen sind).
  const [zu, setZu] = useState<ReadonlySet<string>>(() => new Set(leseZu()));
  // Waehrend der Suche gilt ein eigener Stand, der mit jedem neuen Suchbegriff zurueckgesetzt wird.
  const [suchZu, setSuchZu] = useState<{ begriff: string; zu: ReadonlySet<string> }>({ begriff: '', zu: new Set() });

  const begriff = suchbegriff(suche);
  const sucht = begriff !== '';
  const alle = useMemo(() => daten ?? [], [daten]);
  const gefunden = useMemo(() => alle.filter((g) => gemeindePasst(g, suche)), [alle, suche]);
  const gruppen = useMemo(() => gemeindenGruppieren(gefunden), [gefunden]);
  const schluessel = useMemo(() => gruppenSchluessel(gruppen), [gruppen]);

  const aktuellZu: ReadonlySet<string> = sucht ? (suchZu.begriff === begriff ? suchZu.zu : new Set<string>()) : zu;
  const istOffen = (s: string) => !aktuellZu.has(s);

  const setzeZu = useCallback((neu: ReadonlySet<string>) => {
    if (sucht) {
      setSuchZu({ begriff, zu: neu });
    } else {
      setZu(neu);
      merkeZu(neu);
    }
  }, [sucht, begriff]);

  const umschalten = (s: string) => {
    const neu = new Set(aktuellZu);
    if (neu.has(s)) neu.delete(s); else neu.add(s);
    setzeZu(neu);
  };

  const konfisGesamt = alle.reduce((s, g) => s + g.konfi_count, 0);
  const teamGesamt = alle.reduce((s, g) => s + g.team_count, 0);
  const untertitel = daten
    ? `${mitEinheit(alle.length, 'Gemeinde', 'Gemeinden')} · ${zahl(konfisGesamt)} Konfis · ${zahl(teamGesamt)} Team`
    : 'Alle Gemeinden nach Landeskirche und Kirchenkreis';

  const neueGemeinde = (
    <WebKnopf art="primaer" onClick={aktionen.neu}>
      <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
      Neue Gemeinde
    </WebKnopf>
  );

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden karten={2} text="Die Gemeinden werden geladen." />;
  } else if (!daten) {
    inhalt = <WebFehler text="Die Gemeinden konnten nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else if (alle.length === 0) {
    inhalt = (
      <div className="web-karte">
        <WebLeer
          icon={ICON_ORGANISATION}
          titel="Noch keine Gemeinden"
          text="Sobald eine Gemeinde angelegt ist, steht sie hier mit ihrer Gemeindeleitung."
          aktion={neueGemeinde}
        />
      </div>
    );
  } else {
    inhalt = (
      <>
        <div className="web-werkzeuge">
          <WebSuche
            beschriftung="Gemeinden durchsuchen"
            platzhalter="Gemeinde, Kirchenkreis, Landeskirche oder Leitung suchen"
            wert={suche}
            onWert={setSuche}
          />
          <div className="web-werkzeuge__rechts">
            <span className="web-gedaempft" role="status">
              {sucht ? `${gefunden.length} von ${mitEinheit(alle.length, 'Gemeinde', 'Gemeinden')}` : ''}
            </span>
            <WebKnopf art="text" klein onClick={() => setzeZu(new Set())}>Alle aufklappen</WebKnopf>
            <WebKnopf art="text" klein onClick={() => setzeZu(new Set(schluessel))}>Alle zuklappen</WebKnopf>
          </div>
        </div>

        {gefunden.length === 0 ? (
          <div className="web-karte">
            <WebLeer
              icon={ICON_ORGANISATION}
              titel="Keine Treffer"
              text={`Zu „${suche.trim()}“ gibt es keine Gemeinde, keinen Kirchenkreis, keine Landeskirche und keine Gemeindeleitung.`}
              aktion={<WebKnopf onClick={() => setSuche('')}>Suche leeren</WebKnopf>}
            />
          </div>
        ) : (
          <div className="web-gruppen">
            {gruppen.map((lk) => (
              <WebAkkordeon
                key={lk.schluessel}
                id={lk.schluessel}
                titel={<WebTreffer text={lk.name} suche={suche} />}
                meta={`${mitEinheit(lk.gemeinden, 'Gemeinde', 'Gemeinden')} · ${mitEinheit(lk.konfis, 'Konfi', 'Konfis')}`}
                offen={istOffen(lk.schluessel)}
                onUmschalten={() => umschalten(lk.schluessel)}
              >
                {lk.kirchenkreise.map((kk) => {
                  const tabelle = (
                    <Tabelle
                      gruppe={kk}
                      suche={suche}
                      onBearbeiten={(g) => aktionen.bearbeiten(g.id, { direkt: true })}
                      onLoeschen={(g) => aktionen.loeschen({ id: g.id, name: g.name, display_name: g.display_name })}
                    />
                  );
                  return kk.name === null ? (
                    <React.Fragment key={kk.schluessel}>{tabelle}</React.Fragment>
                  ) : (
                    <WebAkkordeon
                      key={kk.schluessel}
                      id={kk.schluessel}
                      innen
                      ebene={3}
                      titel={<WebTreffer text={kk.name} suche={suche} />}
                      meta={`${mitEinheit(kk.gemeinden.length, 'Gemeinde', 'Gemeinden')} · ${mitEinheit(kk.konfis, 'Konfi', 'Konfis')}`}
                      offen={istOffen(kk.schluessel)}
                      onUmschalten={() => umschalten(kk.schluessel)}
                    >
                      {tabelle}
                    </WebAkkordeon>
                  );
                })}
              </WebAkkordeon>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <WebSeite bereich="Verwaltung" titel="Gemeinden" untertitel={untertitel} aktionen={neueGemeinde} pageRef={aktionen.pageRef} wartung>
      {inhalt}
    </WebSeite>
  );
};

export default WebGemeinden;
