// Betrieb in der Web-Fassung, /admin/metrics (Browser ab 992 px;
// docs/planung/web-alle-bereiche.md, Entscheidung 6): zuerst das Urteil "Laeuft
// gerade alles?", dann die Kennzahlen und vier Reiter -- Ueberblick, Fehler,
// Routen, Verlauf -- mit Karten und Tabellen statt langer Listen.
//
// Laden, Aktualisieren (alle 5 Sekunden) und alle Urteile kommen von der Seite
// (AdminMetricsPage): Sie holt GET /metrics, rechnet Zustand, Apdex, den
// Vergleich "heute gegen die Vortage" und die Routenliste (utils/
// betriebsKennzahlen.ts) und schreibt Zahlen und Dauern ueber utils/
// betriebsFormat.ts. Die Seite ist nur fuer Konten mit Super-Admin-Recht
// erreichbar (der Server haelt ohnehin 403).

import React from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_PULS } from '../../../shared/icons';
import { datumUhrzeit, uhrzeit } from '../../../../utils/dateUtils';
import { fmtDauer, fmtSeit, fmtUptime, fmtZahl, msColor, statusBezeichnung, statusColor, vergleichAnzeige } from '../../../../utils/betriebsFormat';
import { METRIK_AMPEL } from '../../../../theme/colors';
import type { HistorieDelta, RoutenSortierung, RoutenZeile, Tagesbilanz, vergleichHeuteGegenVortage } from '../../../../utils/betriebsKennzahlen';
import WebSeite from '../../../web/WebSeite';
import WebKarte from '../../../web/WebKarte';
import WebKachel from '../../../web/WebKachel';
import WebKnopf from '../../../web/WebKnopf';
import WebChips from '../../../web/WebChips';
import WebPill from '../../../web/WebPill';
import WebSchalter from '../../../web/WebSchalter';
import WebTabelle, { type WebSpalte } from '../../../web/WebTabelle';
import { WebFehler, WebLaden, WebLeer } from '../../../web/WebZustaende';
import type { BetriebsAnsicht, BetriebsEinzelfehler, BetriebsFehlerGruppe, BetriebsReiter } from './betriebTypen';

export interface WebBetriebProps {
  snap: BetriebsAnsicht | null;
  laedt: boolean;
  fehler: string | null;
  tab: BetriebsReiter;
  onTab: (tab: BetriebsReiter) => void;
  autoAktualisieren: boolean;
  onAutoAktualisieren: (an: boolean) => void;
  routenSicht: RoutenSortierung;
  onRoutenSicht: (sicht: RoutenSortierung) => void;
  zustand: { stufe: 'gut' | 'auffaellig' | 'stoerung'; titel: string; satz: string } | null;
  apdexInfo: { text: string; farbe: string; rat: string };
  veraenderung: ReturnType<typeof vergleichHeuteGegenVortage>;
  routenZeilen: readonly RoutenZeile[];
  tage: readonly Tagesbilanz[];
  schritte: readonly HistorieDelta[];
  onNeuLaden: () => void;
}

// --- Anteile: ein Balken aus mehreren Abschnitten mit Legende ------------------------

interface Anteil { name: string; wert: number; farbe: string }

const Anteile: React.FC<{ teile: readonly Anteil[]; beschriftung: string }> = ({ teile, beschriftung }) => {
  const summe = teile.reduce((s, t) => s + t.wert, 0);
  if (summe === 0) return <p className="web-gedaempft">Noch keine Anfragen gezählt.</p>;
  const sichtbar = teile.filter((t) => t.wert > 0);
  return (
    <div className="web-anteile">
      <div className="web-anteile__balken" role="img" aria-label={`${beschriftung}: ${sichtbar.map((t) => `${t.name} ${Math.round((t.wert / summe) * 100)} %`).join(', ')}`}>
        {sichtbar.map((t) => (
          <span key={t.name} className="web-anteile__teil" style={{ width: `${(t.wert / summe) * 100}%`, background: t.farbe }} title={`${t.name}: ${fmtZahl(t.wert)}`} />
        ))}
      </div>
      <ul className="web-anteile__legende">
        {sichtbar.map((t) => (
          <li key={t.name}>
            <span className="web-anteile__punkt" style={{ background: t.farbe }} aria-hidden="true" />
            {t.name} {fmtZahl(t.wert)} ({Math.round((t.wert / summe) * 100)} %)
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- Eine Zeile "heute gegen sonst" -----------------------------------------------------

const Vergleichszeile: React.FC<{ name: string; jetzt: string; vorher: string; delta: number | null; bewertung: 'neutral' | 'wenigerIstBesser' }> = ({
  name, jetzt, vorher, delta, bewertung,
}) => {
  const { merklich, farbe, pfeil } = vergleichAnzeige(delta, bewertung);
  return (
    <li className="web-vergleich">
      <div className="web-vergleich__links">
        <span>{name}</span>
        <span className="web-zelle-leise web-einzeilig">{vorher}</span>
      </div>
      <div className="web-vergleich__rechts">
        <strong className="web-vergleich__jetzt">{jetzt}</strong>
        {delta !== null && (
          <span className="web-vergleich__delta" style={{ color: farbe, fontWeight: merklich ? 'var(--app-schrift-halbfett)' : undefined }}>
            {pfeil} {Math.abs(delta)} %
          </span>
        )}
      </div>
    </li>
  );
};

const WebBetrieb: React.FC<WebBetriebProps> = (p) => {
  const zurueck = { href: '/admin/settings', text: 'Mehr' };
  const kopfAktion = (
    <WebKnopf onClick={p.onNeuLaden} aria-label="Daten neu laden">
      <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
      Neu laden
    </WebKnopf>
  );

  if (p.fehler) {
    return (
      <WebSeite bereich="Verwaltung" titel="Betrieb" zurueck={zurueck}>
        <WebFehler text={p.fehler} onErneut={p.onNeuLaden} />
      </WebSeite>
    );
  }
  const { snap, zustand } = p;
  if (p.laedt || !snap || !zustand) {
    return (
      <WebSeite bereich="Verwaltung" titel="Betrieb" zurueck={zurueck}>
        <WebLaden kacheln={4} karten={2} text="Die Kennzahlen werden geladen." />
      </WebSeite>
    );
  }

  const gruppen = snap.fehlerGruppen ?? [];

  // --- Fehler ---
  const fehlerSpalten: Array<WebSpalte<BetriebsFehlerGruppe>> = [
    { schluessel: 'route', kopf: 'Route', sortWert: (g) => g.route, zelle: (g) => <span className="web-mono web-einzeilig">{g.route}</span> },
    {
      schluessel: 'art',
      kopf: 'Art',
      breite: '200px',
      sortWert: (g) => g.status,
      zelle: (g) => <span style={{ color: statusColor(g.status), fontWeight: 'var(--app-schrift-halbfett)' }}>{g.status} · {statusBezeichnung(g.status)}</span>,
    },
    { schluessel: 'anzahl', kopf: 'Anzahl', zahl: true, breite: '100px', sortWert: (g) => g.anzahl, zelle: (g) => `${fmtZahl(g.anzahl)}×` },
    { schluessel: 'seit', kopf: 'Erstmals', breite: '120px', optional: true, sortWert: (g) => new Date(g.seit), zelle: (g) => fmtSeit(g.seit) },
    { schluessel: 'zuletzt', kopf: 'Zuletzt', breite: '120px', sortWert: (g) => new Date(g.zuletzt), zelle: (g) => fmtSeit(g.zuletzt) },
    { schluessel: 'url', kopf: 'Zuletzt aufgerufen', optional: true, sortWert: (g) => g.beispielUrl, zelle: (g) => <span className="web-mono web-einzeilig web-gedaempft">{g.beispielUrl}</span> },
  ];
  const einzelSpalten: Array<WebSpalte<BetriebsEinzelfehler>> = [
    { schluessel: 'url', kopf: 'Adresse', sortWert: (e) => e.url, zelle: (e) => <span className="web-mono web-einzeilig">{e.url}</span> },
    { schluessel: 'status', kopf: 'Status', breite: '90px', sortWert: (e) => e.status, zelle: (e) => <span style={{ color: statusColor(e.status), fontWeight: 'var(--app-schrift-halbfett)' }}>{e.status}</span> },
    { schluessel: 'zeit', kopf: 'Uhrzeit', breite: '120px', sortWert: (e) => new Date(e.at), zelle: (e) => `${uhrzeit(e.at)} Uhr` },
    { schluessel: 'dauer', kopf: 'Dauer', zahl: true, breite: '100px', sortWert: (e) => e.durationMs, zelle: (e) => `${e.durationMs} ms` },
  ];

  // --- Routen ---
  const routenSpalten: Array<WebSpalte<RoutenZeile>> = [
    { schluessel: 'route', kopf: 'Route', sortWert: (r) => r.route, zelle: (r) => <span className="web-mono web-einzeilig">{r.route}</span> },
    {
      schluessel: 'median',
      kopf: 'Median',
      zahl: true,
      breite: '95px',
      sortWert: (r) => r.mitteMs,
      zelle: (r) => <span className="web-nowrap" title="Median: die Hälfte aller Anfragen war schneller" style={{ color: msColor(r.mitteMs), fontWeight: 'var(--app-schrift-halbfett)' }}>{r.mitteMs} ms</span>,
    },
    { schluessel: 'aufrufe', kopf: 'Aufrufe', zahl: true, breite: '80px', sortWert: (r) => r.count, zelle: (r) => fmtZahl(r.count) },
    { schluessel: 'schnitt', kopf: 'Durchschnitt', zahl: true, breite: '100px', optional: true, sortWert: (r) => r.schnittMs, zelle: (r) => `${Math.round(r.schnittMs)} ms` },
    {
      schluessel: 'p95',
      kopf: 'p95',
      zahl: true,
      breite: '170px',
      optional: true,
      sortWert: (r) => r.p95,
      // Bei wenigen Messwerten IST der p95 der langsamste Einzelwert -- dann steht er so da
      // und nennt die Zahl der Messwerte statt eines "hoechstens", das dasselbe sagte.
      zelle: (r) => (r.p95Duenn ? (
        <span className="web-zweizeilig" title={`Nur ${r.stichproben} Messwerte — bei so wenigen ist der p95 der langsamste einzelne Aufruf, kein Merkmal der Route.`}>
          <span className="web-nowrap">langsamster {r.p95} ms</span>
          <span className="web-zelle-leise web-nowrap">nur {r.stichproben} Messwerte</span>
        </span>
      ) : (
        <span className="web-zweizeilig">
          <span className="web-nowrap" title="95 von 100 Anfragen waren schneller">{r.p95} ms</span>
          <span className="web-zelle-leise web-nowrap">höchstens {r.serverMaxMs ?? r.maxMs} ms</span>
        </span>
      )),
    },
    { schluessel: 'anteil', kopf: 'Anteil Serverzeit', zahl: true, breite: '90px', sortWert: (r) => r.anteilProzent, zelle: (r) => <span title="Anteil an der gesamten Serverzeit aller Routen">{r.anteilProzent} %</span> },
    {
      schluessel: 'hinweise',
      kopf: 'Hinweise',
      optional: true,
      zelle: (r) => {
        const pills: React.ReactNode[] = [];
        if (r.errors > 0) pills.push(<WebPill key="f" ton="fehler">{r.errors} Fehler</WebPill>);
        if (r.langsam !== undefined && r.langsam > 0) {
          pills.push(<WebPill key="l" ton="warnung" title="Anfragen, die insgesamt über einer Sekunde gedauert haben">{fmtZahl(r.langsam)}× über 1 s ({r.langsamQuote} %)</WebPill>);
        }
        if (r.cacheQuote !== undefined && r.cacheQuote > 0) {
          pills.push(<WebPill key="c" ton={r.cacheQuote >= 50 ? 'erfolg' : 'neutral'}>{r.cacheQuote} % aus dem Zwischenspeicher</WebPill>);
        }
        if (r.netzAvgMs !== undefined && r.netzAvgMs > 0) {
          pills.push(<WebPill key="n" title="Warten auf die Verbindung des Geräts — nicht vom Server beeinflussbar">+ {r.netzAvgMs} ms Leitung</WebPill>);
        }
        return pills.length > 0 ? <span className="web-pillreihe">{pills}</span> : <span className="web-gedaempft">–</span>;
      },
    },
  ];

  // --- Verlauf ---
  const tageNeuesteZuerst = [...p.tage].reverse();
  const tagSpalten: Array<WebSpalte<Tagesbilanz>> = [
    { schluessel: 'tag', kopf: 'Tag', breite: '120px', sortWert: (t) => p.tage.indexOf(t), zelle: (t) => <span className="web-zelle-titel">{t.tag}</span> },
    { schluessel: 'anfragen', kopf: 'Anfragen', zahl: true, breite: '120px', sortWert: (t) => t.anfragen, zelle: (t) => fmtZahl(t.anfragen) },
    {
      schluessel: 'fehler',
      kopf: 'Fehler',
      zahl: true,
      breite: '100px',
      sortWert: (t) => t.fehler,
      zelle: (t) => <span style={{ color: t.fehler > 0 ? METRIK_AMPEL.kritisch : METRIK_AMPEL.gut, fontWeight: t.fehler > 0 ? 'var(--app-schrift-halbfett)' : undefined }}>{t.fehler}</span>,
    },
    { schluessel: 'dauer', kopf: 'Langsamste', zahl: true, breite: '120px', sortWert: (t) => t.schlimmsteMs, zelle: (t) => <span style={{ color: msColor(t.schlimmsteMs) }}>{fmtDauer(t.schlimmsteMs)}</span> },
    { schluessel: 'route', kopf: 'Langsamste Route', optional: true, sortWert: (t) => t.schlimmsteRoute, zelle: (t) => (t.schlimmsteRoute ? <span className="web-mono web-einzeilig web-gedaempft">{t.schlimmsteRoute}</span> : <span className="web-gedaempft">–</span>) },
  ];
  const schrittSpalten: Array<WebSpalte<HistorieDelta>> = [
    { schluessel: 'zeit', kopf: 'Zeitpunkt', breite: '170px', sortWert: (d) => new Date(d.at), zelle: (d) => datumUhrzeit(d.at, { ohneJahr: true }) },
    { schluessel: 'anfragen', kopf: 'Anfragen', zahl: true, breite: '120px', sortWert: (d) => d.requests, zelle: (d) => fmtZahl(d.requests) },
    {
      schluessel: 'fehler',
      kopf: 'Fehler',
      zahl: true,
      breite: '100px',
      sortWert: (d) => d.errors,
      zelle: (d) => (d.errors > 0 ? <span style={{ color: METRIK_AMPEL.kritisch, fontWeight: 'var(--app-schrift-halbfett)' }}>{d.errors}</span> : <span className="web-gedaempft">0</span>),
    },
    { schluessel: 'dauer', kopf: 'Langsamste', zahl: true, breite: '120px', sortWert: (d) => d.worstP95, zelle: (d) => <span style={{ color: msColor(d.worstP95) }}>{fmtDauer(d.worstP95)}</span> },
  ];

  const chips = [
    { wert: 'ueberblick' as const, label: 'Überblick' },
    { wert: 'fehler' as const, label: 'Fehler', ...(gruppen.length > 0 ? { zahl: gruppen.length, rot: true } : {}) },
    { wert: 'routen' as const, label: 'Routen' },
    { wert: 'verlauf' as const, label: 'Verlauf' },
  ];

  const { apdex, statusKlassen, replicas, ueber1s, nutzer } = snap;

  const ueberblick = (
    <div className="web-raster web-raster--zwei">
      {apdex && (
        <WebKarte titel="Merken Nutzer:innen etwas?">
          <div className="web-apdex">
            <span className="web-grosszahl" style={{ color: p.apdexInfo.farbe }}>{apdex.wert === null ? '–' : apdex.wert.toFixed(2).replace('.', ',')}</span>
            <span className="web-zelle-leise">von 1,00 — {p.apdexInfo.text}</span>
          </div>
          <Anteile
            beschriftung="Antwortzeiten"
            teile={[
              { name: 'zügig', wert: apdex.zufrieden, farbe: METRIK_AMPEL.gut },
              { name: 'erträglich', wert: apdex.toleriert, farbe: METRIK_AMPEL.maessig },
              { name: 'zu langsam', wert: apdex.frustriert, farbe: METRIK_AMPEL.kritisch },
            ]}
          />
          <p className="web-karte__text web-karte__text--unten">
            Gemessen an der Serverzeit ohne Warten auf die Verbindung. Zügig heißt hier bis {apdex.schwelleMs} ms, erträglich bis {apdex.toleriertBisMs} ms. {p.apdexInfo.rat}
          </p>
        </WebKarte>
      )}

      <WebKarte titel="Heute gegen die Vortage">
        {!p.veraenderung ? (
          <p className="web-gedaempft">Für einen Vergleich braucht es mindestens zwei Tage Aufzeichnung.</p>
        ) : (
          <>
            <ul className="web-vergleiche">
              <Vergleichszeile
                name="Anfragen je Stunde"
                jetzt={fmtZahl(Math.round(p.veraenderung.anfragen.heute))}
                vorher={`sonst ${fmtZahl(Math.round(p.veraenderung.anfragen.vorher))}`}
                delta={p.veraenderung.anfragen.delta}
                bewertung="neutral"
              />
              <Vergleichszeile
                name="Fehler heute"
                jetzt={fmtZahl(p.veraenderung.fehler.heute)}
                vorher={`sonst ${p.veraenderung.fehler.vorher.toFixed(1).replace('.', ',')} am Tag`}
                delta={p.veraenderung.fehler.delta}
                bewertung="wenigerIstBesser"
              />
              <Vergleichszeile
                name="Langsamste Route"
                jetzt={fmtDauer(p.veraenderung.schlimmste.heute)}
                vorher={p.veraenderung.schlimmste.route ? p.veraenderung.schlimmste.route : `sonst ${fmtDauer(p.veraenderung.schlimmste.vorher)}`}
                delta={p.veraenderung.schlimmste.delta}
                bewertung="wenigerIstBesser"
              />
            </ul>
            <p className="web-karte__text web-karte__text--unten">
              Verglichen wird je Stunde gegen den Schnitt der {p.veraenderung.vergleichstage} Vortage — der heutige Tag ist noch nicht vorbei.
            </p>
          </>
        )}
      </WebKarte>

      {statusKlassen && (
        <WebKarte titel="Was der Server zurückgibt">
          <Anteile
            beschriftung="Antworten"
            teile={[
              { name: 'in Ordnung', wert: statusKlassen.erfolg, farbe: METRIK_AMPEL.gut },
              { name: 'schon bekannt', wert: statusKlassen.ausDemCache, farbe: 'var(--app-color-chat)' },
              { name: 'weitergeleitet', wert: statusKlassen.umleitung, farbe: METRIK_AMPEL.blass },
              { name: 'nicht gefunden', wert: statusKlassen.nichtGefunden, farbe: METRIK_AMPEL.maessig },
              { name: 'abgelehnt', wert: statusKlassen.abgelehnt, farbe: METRIK_AMPEL.erhoeht },
              { name: 'Serverfehler', wert: statusKlassen.serverfehler, farbe: METRIK_AMPEL.kritisch },
            ]}
          />
          <p className="web-karte__text web-karte__text--unten">
            „Schon bekannt“ ist gut: Die App hatte die Daten bereits, es ging nur die Rückfrage über die Leitung. „Nicht gefunden“ ist keine Störung, aber viele davon heißen, dass eine App auf etwas zeigt, das es nicht mehr gibt.
          </p>
        </WebKarte>
      )}

      {replicas && replicas.length > 1 && (
        <WebKarte titel={`Lastverteilung (${replicas.length} Instanzen)`}>
          <ul className="web-last">
            {replicas.map((r) => (
              <li key={r.replica} className="web-last__zeile">
                <div className="web-last__kopf">
                  <span className="web-mono">{r.replica.slice(0, 12)}</span>
                  <span className="web-zelle-leise">{fmtZahl(r.requests)} Anfragen · {(r.share * 100).toFixed(0)} % · {r.inFlight} aktiv</span>
                </div>
                <div className="web-last__spur" aria-hidden="true"><span className="web-last__fuellung" style={{ width: `${r.share * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          {replicas.some((r) => r.share > 0.7) && (
            <p className="web-karte__text web-karte__text--unten">Hinweis: Last ungleich verteilt — eine Instanz trägt den Großteil.</p>
          )}
        </WebKarte>
      )}
    </div>
  );

  const fehlerReiter = gruppen.length === 0 ? (
    <WebKarte titel="Fehler">
      <WebLeer icon={ICON_PULS} titel="Kein Fehler" text="Kein Fehler seit dem letzten Neustart." />
    </WebKarte>
  ) : (
    <>
      <WebKarte
        titel="Fehler nach Route und Art"
        untertitel="Nur Serverfehler (500er) sind eine Störung — der Rest sagt meist, dass eine App etwas anfragt, das es nicht gibt oder das ihr nicht zusteht."
        bund
      >
        <WebTabelle beschriftung="Fehler nach Route und Art" spalten={fehlerSpalten} zeilen={gruppen} zeileSchluessel={(g) => `${g.route}|${g.status}`} mittig />
      </WebKarte>
      {snap.recentErrors.length > 0 && (
        <WebKarte titel="Die letzten Einzelfälle" bund>
          <WebTabelle beschriftung="Die letzten Einzelfälle" spalten={einzelSpalten} zeilen={snap.recentErrors.slice(0, 15)} zeileSchluessel={(e) => `${e.at}|${e.url}|${e.status}`} mittig />
        </WebKarte>
      )}
    </>
  );

  const routenReiter = (
    <>
      <div className="web-werkzeuge">
        <WebChips<RoutenSortierung>
          beschriftung="Sortierung der Routen"
          chips={[{ wert: 'langsam', label: 'Langsamste' }, { wert: 'haeufig', label: 'Häufigste' }]}
          wert={p.routenSicht}
          onWert={p.onRoutenSicht}
        />
      </div>
      <WebKarte titel="Routen" untertitel="Wo geht die Zeit hin?" bund={p.routenZeilen.length > 0}>
        {p.routenZeilen.length === 0 ? (
          <WebLeer icon={ICON_PULS} titel="Keine Daten" text="Es sind noch keine Routen gemessen." />
        ) : (
          <WebTabelle beschriftung="Routen" spalten={routenSpalten} zeilen={p.routenZeilen} zeileSchluessel={(r) => r.route} mittig />
        )}
      </WebKarte>
      <p className="web-karte__text">
        Groß steht der Median — die typische Anfrage. Steht der Durchschnitt deutlich darüber, sind es einzelne Ausreißer, nicht die Route selbst. „Langsamste“ sortiert nach der Zeit pro Anfrage, nicht nach der einzelnen schlimmsten. Alle Zeiten sind Serverzeiten, also ohne Warten auf die Verbindung des Geräts — nur daran ändert eine Änderung am Server etwas. Steht statt „p95“ die Angabe „langsamster“, gab es zu wenige Aufrufe für einen belastbaren Rand: Dann ist die Zahl ein einzelner Ausreißer und kein Merkmal der Route.
      </p>
    </>
  );

  const verlaufReiter = (
    <>
      <WebKarte titel="Je Tag" untertitel="Letzte 14 Tage — übersteht Neustarts und Aktualisierungen" bund={tageNeuesteZuerst.length > 0}>
        {tageNeuesteZuerst.length === 0 ? (
          <WebLeer icon={ICON_PULS} titel="Noch keine Aufzeichnung" text="Der erste Eintrag kommt nach etwa 5 Min." />
        ) : (
          <WebTabelle beschriftung="Je Tag" spalten={tagSpalten} zeilen={tageNeuesteZuerst} zeileSchluessel={(t) => t.tag} mittig />
        )}
      </WebKarte>
      <WebKarte titel="In Fünf-Minuten-Schritten" untertitel="Die letzten 60 Einträge" bund={p.schritte.length > 0}>
        {p.schritte.length === 0 ? (
          <WebLeer icon={ICON_PULS} titel="Noch keine Aufzeichnung" text="Noch keine Einträge in Fünf-Minuten-Schritten." />
        ) : (
          <WebTabelle beschriftung="In Fünf-Minuten-Schritten" spalten={schrittSpalten} zeilen={[...p.schritte].reverse().slice(0, 60)} zeileSchluessel={(d) => d.at} mittig />
        )}
      </WebKarte>
    </>
  );

  return (
    <WebSeite bereich="Verwaltung" titel="Betrieb" untertitel="Gemeindeübergreifend: Läuft gerade alles?" aktionen={kopfAktion} zurueck={zurueck}>
      <section className={`web-zustand web-zustand--${zustand.stufe}`} aria-label="Zustand des Servers">
        <div className="web-zustand__kopf">
          <span className="web-zustand__punkt" aria-hidden="true" />
          <h2 className="web-zustand__titel">{zustand.titel}</h2>
        </div>
        <p className="web-zustand__satz">{zustand.satz}</p>
        <div className="web-zustand__fuss">
          <span className="web-zelle-leise">Ohne Neustart seit {fmtUptime(snap.uptimeSeconds)} · {snap.rps} Anfragen/Sek</span>
          <WebSchalter label="Alle 5 Sekunden aktualisieren" an={p.autoAktualisieren} onAn={p.onAutoAktualisieren} />
        </div>
      </section>

      <div className="web-raster web-raster--kacheln">
        {ueber1s && (
          <WebKachel
            label="Warten über 1 s"
            wert={`${String(ueber1s.quote).replace('.', ',')} %`}
            zusatz={[`${fmtZahl(ueber1s.anzahl)}× inkl. Leitung`]}
            achtung={ueber1s.quote >= 10}
          />
        )}
        {nutzer && (
          <WebKachel
            label={`Aktiv (${nutzer.fensterMinuten} Min)`}
            wert={String(nutzer.aktiv)}
            zusatz={[nutzer.betroffen > 0 ? `${nutzer.betroffen} davon mit Warten oder Fehler` : 'niemand mit Warten oder Fehler']}
          />
        )}
        <WebKachel label="Gleichzeitig" wert={String(snap.inFlight)} zusatz={[`bisher höchstens ${snap.maxInFlight}`]} />
        <WebKachel label="Anfragen" wert={fmtZahl(snap.totalRequests)} zusatz={['seit dem letzten Neustart']} />
      </div>

      <div className="web-werkzeuge">
        <WebChips<BetriebsReiter> beschriftung="Ansicht" chips={chips} wert={p.tab} onWert={p.onTab} />
      </div>

      {p.tab === 'ueberblick' && ueberblick}
      {p.tab === 'fehler' && fehlerReiter}
      {p.tab === 'routen' && routenReiter}
      {p.tab === 'verlauf' && verlaufReiter}
    </WebSeite>
  );
};

export default WebBetrieb;
