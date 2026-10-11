// Vorgänge in der Web-Fassung der Support-Ansicht, /admin/support/vorgaenge
// und /admin/support/vorgaenge/:id (docs/planung/support-vorgaenge.md,
// Entscheidung 7).
//
// Wie ein Mailprogramm (Simon, 11.10.2026): links die Vorgänge als Zeilen --
// Betreff, Nummer, Gemeinde, Status, Dringlichkeit, letzte Aktivität,
// ungelesene Mails --, rechts der gewählte Vorgang im Lesebereich
// (web/WebVorgangDetail). Die Adresse folgt der Wahl; Pfeiltasten wechseln
// den Vorgang. Darüber die Stände mit Zahlen (Offen, Neu, In Arbeit, Wartet,
// Archiv -- darin auch die erledigten), die Suche und hinter „Filter" Art und
// Gemeinde. Mehrere Vorgänge lassen sich ankreuzen: archivieren,
// wiederherstellen, löschen, Status setzen. „Neuer Vorgang" öffnet einen
// Dialog; ist eine Gemeinde gewählt, heißt er „Schreiben".
//
// Die Logik (laden, filtern, Sammelaktionen, Aktualisieren bei Änderungen)
// steht in components/support/useVorgangsliste.ts, dieselbe wie in der App.
// Rahmen, Werkzeugzeile und Zustände stellt WebListenSeite; Liste und
// Lesebereich nebeneinander WebPostfach.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_ARCHIV, ICON_HINZUFUEGEN, ICON_LISTE, ICON_LOESCHEN, ICON_RUECKGAENGIG } from '../../shared/icons';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { mailZeit } from '../../../utils/mailGespraeche';
import { suchbegriff } from '../../../utils/supportWeb';
import {
  ARTEN,
  STATUS_REIHE,
  VORGANG_STATUS,
  vorgaengeText,
  type Vorgang,
  type VorgangArt,
  type VorgangFilter,
  type VorgangStatus,
} from '../../../utils/supportVorgaenge';
import { useVorgangsliste } from '../useVorgangsliste';
import { useVorgangsAuswahl } from '../useVorgangsAuswahl';
import WebKnopf from '../../web/WebKnopf';
import WebAuswahl from '../../web/WebAuswahl';
import WebListenSeite from '../../web/WebListenSeite';
import WebTreffer from '../../web/WebTreffer';
import WebNeuerVorgang from './WebNeuerVorgang';
import WebVorgangDetail from './WebVorgangDetail';
import WebPostfach, { WebLeseHinweis, WebPostfachZeilen } from './WebPostfach';
import { useLeseAuswahl } from './useLeseAuswahl';
import { DringlichPill, StatusPill } from './WebVorgangTeile';
import '../../../theme/web/support.css';
import { leerVon } from '../../../seiten/beschreibung';
import {
  ALLE_ARTEN,
  ALLE_GEMEINDEN,
  VORGAENGE_TITEL,
  VORGANG_KEINE_TREFFER,
  VORGANG_LEER_TITEL,
  VORGANG_STAENDE,
  VORGANG_STAENDE_BESCHRIFTUNG,
} from '../../../seiten/supportVorgaenge';

/** Wohin der Link „Zurueck zur Liste" eines Vorgangs fuehrt, mit dem Filter, der gerade gilt. */
export const VORGAENGE_LISTE = '/admin/support/vorgaenge';

const WebVorgaenge: React.FC<{ start?: number | null }> = ({ start = null }) => {
  const [gewaehlt, waehlen] = useLeseAuswahl(VORGAENGE_LISTE, start);
  const { auswahl, setFilter, setArt, setGemeinde, setSuche, zuruecksetzen } = useVorgangsAuswahl();
  const liste = useVorgangsliste(auswahl);
  const { zaehlen, sichtbar, gemeinden, laedt, fehler, neuLaden, sammeln, loeschenFragen, isOnline } = liste;
  const [neuOffen, setNeuOffen] = useState(false);
  const [ausgewaehlt, setAusgewaehlt] = useState<ReadonlySet<number>>(new Set());

  const archiv = auswahl.filter === 'archiv';
  const sucht = suchbegriff(auswahl.suche) !== '';
  const eingegrenzt = sucht || auswahl.art !== 'alle' || auswahl.gemeinde !== 'alle';

  // Was nicht mehr in der Liste steht (anderer Filter, archiviert, geloescht), bleibt nicht ausgewaehlt.
  const sichtbareIds = useMemo(() => new Set(sichtbar.map((v) => v.id)), [sichtbar]);
  useEffect(() => {
    setAusgewaehlt((alt) => {
      const rest = [...alt].filter((id) => sichtbareIds.has(id));
      return rest.length === alt.size ? alt : new Set(rest);
    });
  }, [sichtbareIds]);

  const alleAn = ausgewaehlt.size > 0 && ausgewaehlt.size === sichtbar.length;
  const alleKasten = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (alleKasten.current) alleKasten.current.indeterminate = ausgewaehlt.size > 0 && !alleAn;
  }, [ausgewaehlt, alleAn]);

  const umschalten = (id: number) => setAusgewaehlt((alt) => {
    const neu = new Set(alt);
    if (neu.has(id)) neu.delete(id); else neu.add(id);
    return neu;
  });
  const alleUmschalten = () => setAusgewaehlt(alleAn ? new Set() : new Set(sichtbar.map((v) => v.id)));
  const ids = [...ausgewaehlt];
  const nachAktion = (ok: boolean) => { if (ok) setAusgewaehlt(new Set()); };

  const gemeindeName = auswahl.gemeinde !== 'alle'
    ? gemeinden.find((g) => String(g.id) === auswahl.gemeinde)?.name ?? `Gemeinde ${auswahl.gemeinde}`
    : null;
  const gemeindeWahlen = [
    { schluessel: 'alle', label: ALLE_GEMEINDEN },
    ...gemeinden.map((g) => ({ schluessel: String(g.id), label: g.name })),
    // Eine Gemeinde aus der Adresse, die in der Liste fehlt, bleibt auswaehlbar.
    ...(auswahl.gemeinde !== 'alle' && !gemeinden.some((g) => String(g.id) === auswahl.gemeinde)
      ? [{ schluessel: auswahl.gemeinde, label: `Gemeinde ${auswahl.gemeinde}` }] : []),
  ];

  // Eine Zeile der Liste: oben Betreff und Zeit, unten Nummer, Gemeinde und Marken.
  const zeile = (v: Vorgang) => {
    const zeit = archiv && v.archiviert_am ? v.archiviert_am : v.letzte_aktivitaet;
    return (
      <>
        <span className="web-postfachzeile__oben">
          <span className="web-postfachzeile__titel"><WebTreffer text={v.betreff || '(ohne Betreff)'} suche={auswahl.suche} /></span>
          <time className="web-postfachzeile__zeit" dateTime={zeit} title={datumUhrzeit(zeit)}>{mailZeit(zeit)}</time>
        </span>
        <span className="web-postfachzeile__unten">
          <span className="web-postfachzeile__text">
            Nr. {v.id} · {v.gemeinde_name ? <WebTreffer text={v.gemeinde_name} suche={auswahl.suche} /> : 'Nicht zugeordnet'}
          </span>
          <span className="web-postfachzeile__marken">
            {v.ungelesen > 0 && <span className="web-chip__zahl web-chip__zahl--rot" title="Ungelesene Mails">{v.ungelesen}</span>}
            <DringlichPill dringlichkeit={v.dringlichkeit} />
            <StatusPill status={v.status} />
          </span>
        </span>
      </>
    );
  };

  const gesamt = archiv ? liste.quelle?.length ?? 0 : zaehlen?.offen ?? 0;
  const inAuswahl = sichtbar.length !== gesamt ? ` · ${vorgaengeText(sichtbar.length)} in dieser Auswahl` : '';
  const untertitel = !liste.quelle
    ? 'Anfragen, Support-Anliegen und Mails an einer Stelle'
    : gemeindeName
      ? `Vorgänge von ${gemeindeName} · ${vorgaengeText(sichtbar.length)} in dieser Auswahl`
      : `${vorgaengeText(gesamt)} ${archiv ? 'im Archiv' : 'offen'}${inAuswahl}`;

  // Die Leiste fuer mehrere ausgewaehlte Zeilen steht zwischen Werkzeugzeile und Liste.
  const sammelleiste = !laedt && !fehler && sichtbar.length > 0 ? (
    <div className="web-sammelleiste web-sammelleiste--liste" role="group" aria-label="Auswahl">
      <label className="web-sammelleiste__alle">
        <input ref={alleKasten} type="checkbox" className="web-kontrollkasten" checked={alleAn} onChange={alleUmschalten} />
        {ausgewaehlt.size > 0 ? `${vorgaengeText(ausgewaehlt.size)} ausgewählt` : 'Alle auswählen'}
      </label>
      {ausgewaehlt.size > 0 && (
        <div className="web-sammelleiste__aktionen">
          {archiv ? (
            <WebKnopf klein disabled={!isOnline} onClick={() => { void liste.sammeln(ids, 'wiederherstellen').then(nachAktion); }}>
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              Wiederherstellen
            </WebKnopf>
          ) : (
            <WebKnopf klein disabled={!isOnline} onClick={() => { void sammeln(ids, 'archivieren').then(nachAktion); }}>
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
              Archivieren
            </WebKnopf>
          )}
          <div className="web-sammelleiste__status">
            <WebAuswahl
              label="Status setzen"
              wert=""
              deaktiviert={!isOnline}
              onWert={(w) => { if (w) void sammeln(ids, 'status', w as VorgangStatus).then(nachAktion); }}
              optionen={[
                { wert: '', label: 'Status setzen …' },
                ...STATUS_REIHE.map((s) => ({ wert: s, label: s === 'erledigt' ? 'Erledigt (ins Archiv)' : VORGANG_STATUS[s].label })),
              ]}
            />
          </div>
          <WebKnopf klein art="gefahr" disabled={!isOnline} onClick={() => loeschenFragen(ids, () => setAusgewaehlt(new Set()))}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            Löschen
          </WebKnopf>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <WebListenSeite<Vorgang, VorgangFilter>
      bereich="Support"
      titel={VORGAENGE_TITEL}
      untertitel={untertitel}
      aktionen={(
        <>
          <WebKnopf onClick={() => { void neuLaden(); }}>
            <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
            Aktualisieren
          </WebKnopf>
          <WebKnopf art="primaer" onClick={() => setNeuOffen(true)}>
            <IonIcon icon={ICON_HINZUFUEGEN} aria-hidden="true" />
            {gemeindeName ? 'Schreiben' : 'Neuer Vorgang'}
          </WebKnopf>
        </>
      )}
      laden={laedt ? { text: 'Die Vorgänge werden geladen.', karten: 2 } : undefined}
      fehler={!laedt && fehler ? { text: 'Die Vorgänge konnten nicht geladen werden.', onErneut: () => { void neuLaden(); } } : undefined}
      // Stände aus der gemeinsamen Beschreibung (seiten/supportVorgaenge.ts); rot ist „Neu".
      reiter={{
        beschriftung: VORGANG_STAENDE_BESCHRIFTUNG,
        wahlen: VORGANG_STAENDE,
        wert: auswahl.filter,
        onWert: setFilter,
        zahlen: {
          ...(zaehlen ?? {}),
          ...(liste.archivAnzahl !== null ? { archiv: liste.archivAnzahl } : {}),
        },
        rot: (f) => f === 'neu',
      }}
      suche={{
        beschriftung: 'Vorgänge durchsuchen',
        platzhalter: 'Nr., Betreff oder Gemeinde',
        wert: auswahl.suche,
        onWert: setSuche,
      }}
      filter={[
        {
          beschriftung: 'Art',
          darstellung: 'auswahl',
          wahlen: [{ schluessel: 'alle', label: ALLE_ARTEN }, ...ARTEN.map((a) => ({ schluessel: a.wert, label: a.label }))],
          wert: auswahl.art,
          onWert: (w) => setArt(w as VorgangArt | 'alle'),
        },
        { beschriftung: 'Gemeinde', darstellung: 'auswahl', wahlen: gemeindeWahlen, wert: auswahl.gemeinde, onWert: setGemeinde },
      ]}
      eintraege={sichtbar}
      voll
      inhaltStatt={(eintraege, leerZustand) => (
        <WebPostfach
          listeKopf={sammelleiste}
          listeBeschriftung="Vorgänge"
          liste={eintraege.length === 0 ? <div className="web-postfach__leer">{leerZustand}</div> : (
            <WebPostfachZeilen<Vorgang>
              eintraege={eintraege}
              kennung={(v) => v.id}
              gewaehlt={gewaehlt}
              onWaehlen={waehlen}
              zeile={zeile}
              name={(v) => `Vorgang ${v.id}: ${v.betreff || '(ohne Betreff)'}`}
              ungelesen={(v) => v.ungelesen > 0 || v.status === 'neu'}
              auswahl={{ ausgewaehlt, umschalten }}
            />
          )}
          lesen={gewaehlt !== null
            ? <WebVorgangDetail key={gewaehlt} vorgangId={gewaehlt} onGeloescht={() => waehlen(null)} />
            : <WebLeseHinweis icon={ICON_LISTE} titel="Kein Vorgang gewählt" text="Wähle links einen Vorgang — er öffnet sich hier." />}
        />
      )}
      leer={{
        icon: ICON_LISTE,
        titel: eingegrenzt ? VORGANG_KEINE_TREFFER.titel : VORGANG_LEER_TITEL[auswahl.filter],
        text: eingegrenzt ? VORGANG_KEINE_TREFFER.text(auswahl.suche) : leerVon(VORGANG_STAENDE, auswahl.filter),
        aktion: eingegrenzt ? <WebKnopf onClick={zuruecksetzen}>{VORGANG_KEINE_TREFFER.zuruecksetzen}</WebKnopf> : undefined,
      }}
    >
      {neuOffen && (
        <WebNeuerVorgang
          schreiben={gemeindeName !== null}
          vorbelegt={auswahl.gemeinde !== 'alle' ? { organizationId: auswahl.gemeinde, art: 'sonstiges' } : undefined}
          onSchliessen={() => setNeuOffen(false)}
        />
      )}
    </WebListenSeite>
  );
};

export default WebVorgaenge;
