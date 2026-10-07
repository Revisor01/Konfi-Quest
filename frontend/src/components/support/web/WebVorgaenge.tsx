// Vorgänge in der Web-Fassung der Support-Ansicht, /admin/support/vorgaenge
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Der Eingang des Supports: jedes Anliegen -- Anfrage von der Homepage,
// Support-Formular, Mail, vom Support angelegt -- als Zeile einer Tabelle mit
// Nummer, Betreff, Art, Gemeinde, Status, Dringlichkeit, letzter Aktivität und
// ungelesenen Mails. Filter-Chips mit Zahlen (Offen, Neu, In Arbeit, Wartet,
// Archiv -- darin auch die erledigten), Auswahl nach Art und Gemeinde, Live-
// Suche. Mehrere Zeilen lassen sich auswählen: archivieren, wiederherstellen,
// löschen, Status setzen. „Neuer Vorgang" öffnet einen Dialog; ist eine
// Gemeinde gewählt, heißt er „Schreiben".
//
// Die Logik (laden, filtern, Sammelaktionen, Aktualisieren bei Änderungen)
// steht in components/support/useVorgangsliste.ts, dieselbe wie in der App.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_ARCHIV, ICON_HINZUFUEGEN, ICON_LISTE, ICON_LOESCHEN, ICON_RUECKGAENGIG } from '../../shared/icons';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { suchbegriff } from '../../../utils/supportWeb';
import {
  ARTEN,
  STATUS_REIHE,
  VORGANG_FILTER,
  VORGANG_STATUS,
  artKurz,
  bereichLabel,
  vorgaengeText,
  type Vorgang,
  type VorgangArt,
  type VorgangFilter,
  type VorgangStatus,
} from '../../../utils/supportVorgaenge';
import { useVorgangsliste } from '../useVorgangsliste';
import { useVorgangsAuswahl } from '../useVorgangsAuswahl';
import WebSeite from '../../web/WebSeite';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebChips from '../../web/WebChips';
import WebSuche from '../../web/WebSuche';
import WebAuswahl from '../../web/WebAuswahl';
import WebTabelle, { type WebSpalte } from '../../web/WebTabelle';
import WebTreffer from '../../web/WebTreffer';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import WebNeuerVorgang from './WebNeuerVorgang';
import { DringlichPill, StatusPill } from './WebVorgangTeile';
import '../../../theme/web/support.css';

/** Wohin der Link „Zurueck zur Liste" eines Vorgangs fuehrt, mit dem Filter, der gerade gilt. */
export const VORGAENGE_LISTE = '/admin/support/vorgaenge';

const LEER_TEXT: Record<VorgangFilter, { titel: string; text: string }> = {
  offen: { titel: 'Nichts zu tun', text: 'Es gibt keinen offenen Vorgang. Neue Anfragen, Formulare und Mails erscheinen hier.' },
  neu: { titel: 'Nichts Neues', text: 'Alle Vorgänge sind schon in Arbeit.' },
  in_arbeit: { titel: 'Nichts in Arbeit', text: 'Gerade ist kein Vorgang in Arbeit.' },
  wartet: { titel: 'Nichts wartet', text: 'Kein Vorgang wartet auf eine Rückmeldung.' },
  archiv: { titel: 'Das Archiv ist leer', text: 'Erledigte und archivierte Vorgänge liegen hier. Gelöscht werden sie 730 Tage nach dem Archivieren.' },
};

const WebVorgaenge: React.FC = () => {
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
  const gemeindeOptionen = [
    { wert: 'alle', label: 'Alle Gemeinden' },
    ...gemeinden.map((g) => ({ wert: String(g.id), label: g.name })),
    // Eine Gemeinde aus der Adresse, die in der Liste fehlt, bleibt auswaehlbar.
    ...(auswahl.gemeinde !== 'alle' && !gemeinden.some((g) => String(g.id) === auswahl.gemeinde)
      ? [{ wert: auswahl.gemeinde, label: `Gemeinde ${auswahl.gemeinde}` }] : []),
  ];

  const spalten: Array<WebSpalte<Vorgang>> = [
    {
      schluessel: 'auswahl',
      kopf: 'Auswählen',
      kopfVersteckt: true,
      breite: '44px',
      zelle: (v) => (
        <input
          type="checkbox"
          className="web-kontrollkasten web-vorn"
          aria-label={`Vorgang ${v.id} auswählen: ${v.betreff}`}
          checked={ausgewaehlt.has(v.id)}
          onChange={() => umschalten(v.id)}
        />
      ),
    },
    {
      schluessel: 'nummer',
      kopf: 'Nr.',
      breite: '56px',
      zahl: true,
      sortWert: (v) => v.id,
      zelle: (v) => <span className="web-gedaempft">{v.id}</span>,
    },
    {
      schluessel: 'betreff',
      kopf: 'Betreff',
      sortWert: (v) => v.betreff || '(ohne Betreff)',
      zelle: (v) => (
        <>
          <WebLink
            href={`${VORGAENGE_LISTE}/${v.id}`}
            className={`web-link--zeile web-link--text web-einzeilig${v.ungelesen > 0 || v.status === 'neu' ? ' web-ungelesen' : ''}`}
          >
            <WebTreffer text={v.betreff || '(ohne Betreff)'} suche={auswahl.suche} />
            {v.ungelesen > 0 && <span className="web-nur-vorlesen">, {v.ungelesen} ungelesene {v.ungelesen === 1 ? 'Mail' : 'Mails'}</span>}
          </WebLink>
          {v.bereich && <span className="web-zelle-leise web-einzeilig">{bereichLabel(v.bereich)}</span>}
        </>
      ),
    },
    {
      schluessel: 'art',
      kopf: 'Art',
      breite: '136px',
      optional: true,
      sortWert: (v) => artKurz(v.art),
      zelle: (v) => <span className="web-einzeilig">{artKurz(v.art)}</span>,
    },
    {
      schluessel: 'gemeinde',
      kopf: 'Gemeinde',
      breite: '19%',
      sortWert: (v) => v.gemeinde_name,
      zelle: (v) => (v.gemeinde_name
        ? <span className="web-einzeilig"><WebTreffer text={v.gemeinde_name} suche={auswahl.suche} /></span>
        : <span className="web-gedaempft web-einzeilig">Nicht zugeordnet</span>),
    },
    {
      schluessel: 'status',
      kopf: 'Status',
      breite: '108px',
      // Reihenfolge wie in jeder Status-Auswahl: Neu, In Arbeit, Wartet, Erledigt.
      sortWert: (v) => STATUS_REIHE.indexOf(v.status),
      zelle: (v) => <StatusPill status={v.status} />,
    },
    {
      schluessel: 'dringlichkeit',
      kopf: 'Dringlichkeit',
      breite: '100px',
      optional: true,
      // Dringendes beim ersten Klick oben.
      sortWert: (v) => (v.dringlichkeit === 'dringend' ? 0 : 1),
      zelle: (v) => (v.dringlichkeit === 'dringend' ? <DringlichPill dringlichkeit={v.dringlichkeit} /> : <span className="web-gedaempft">Normal</span>),
    },
    {
      schluessel: 'aktivitaet',
      kopf: archiv ? 'Archiviert' : 'Letzte Aktivität',
      breite: '108px',
      zahl: true,
      sortWert: (v) => Date.parse(archiv && v.archiviert_am ? v.archiviert_am : v.letzte_aktivitaet),
      zelle: (v) => {
        const zeit = archiv && v.archiviert_am ? v.archiviert_am : v.letzte_aktivitaet;
        return <span title={datumUhrzeit(zeit)}>{zeitpunktText(zeit)}</span>;
      },
    },
    {
      schluessel: 'ungelesen',
      kopf: 'Ungelesen',
      breite: '76px',
      zahl: true,
      sortWert: (v) => v.ungelesen,
      zelle: (v) => (v.ungelesen > 0
        ? <span className="web-chip__zahl web-chip__zahl--rot">{v.ungelesen}</span>
        : <span className="web-gedaempft">–</span>),
    },
  ];

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden karten={2} text="Die Vorgänge werden geladen." />;
  } else if (fehler) {
    inhalt = <WebFehler text="Die Vorgänge konnten nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else {
    inhalt = (
      <>
        <WebChips<VorgangFilter>
          beschriftung="Vorgänge nach Stand"
          wert={auswahl.filter}
          onWert={setFilter}
          chips={VORGANG_FILTER.map((f) => ({
            wert: f,
            label: f === 'offen' ? 'Offen' : f === 'archiv' ? 'Archiv' : VORGANG_STATUS[f as VorgangStatus].kurz,
            zahl: f === 'archiv' ? liste.archivAnzahl ?? undefined : zaehlen?.[f],
            rot: f === 'neu',
            zahlText: f === 'offen' ? 'neu, in Arbeit oder wartet' : f === 'archiv' ? 'archiviert oder erledigt' : undefined,
          }))}
        />

        <div className="web-werkzeuge">
          <div className="web-werkzeuge__links">
            <WebAuswahl
              label="Art"
              wert={auswahl.art}
              onWert={(w) => setArt(w as VorgangArt | 'alle')}
              optionen={[{ wert: 'alle', label: 'Alle Arten' }, ...ARTEN.map((a) => ({ wert: a.wert, label: a.label }))]}
            />
            <WebAuswahl label="Gemeinde" wert={auswahl.gemeinde} onWert={setGemeinde} optionen={gemeindeOptionen} />
          </div>
          <div className="web-werkzeuge__rechts">
            <WebSuche
              beschriftung="Vorgänge durchsuchen"
              platzhalter="Nr., Betreff oder Gemeinde"
              wert={auswahl.suche}
              onWert={setSuche}
            />
          </div>
        </div>

        {sichtbar.length > 0 && (
          <div className="web-sammelleiste" role="group" aria-label="Auswahl">
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
        )}

        <div className="web-karte">
          {sichtbar.length > 0 ? (
            <WebTabelle
              beschriftung="Vorgänge"
              spalten={spalten}
              zeilen={sichtbar}
              zeileSchluessel={(v) => v.id}
              zeileKlasse={(v) => (v.ungelesen > 0 || v.status === 'neu' ? 'web-zeile--ungelesen' : undefined)}
              mittig
              fest
            />
          ) : (
            <WebLeer
              icon={ICON_LISTE}
              titel={eingegrenzt ? 'Keine Treffer' : LEER_TEXT[auswahl.filter].titel}
              text={eingegrenzt
                ? `In dieser Auswahl gibt es keinen Vorgang${sucht ? ` zu „${auswahl.suche.trim()}“` : ''}.`
                : LEER_TEXT[auswahl.filter].text}
              aktion={eingegrenzt ? <WebKnopf onClick={zuruecksetzen}>Auswahl zurücksetzen</WebKnopf> : undefined}
            />
          )}
        </div>
      </>
    );
  }

  const gesamt = archiv ? liste.quelle?.length ?? 0 : zaehlen?.offen ?? 0;
  const inAuswahl = sichtbar.length !== gesamt ? ` · ${vorgaengeText(sichtbar.length)} in dieser Auswahl` : '';
  const untertitel = !liste.quelle
    ? 'Anfragen, Support-Anliegen und Mails an einer Stelle'
    : gemeindeName
      ? `Vorgänge von ${gemeindeName} · ${vorgaengeText(sichtbar.length)} in dieser Auswahl`
      : `${vorgaengeText(gesamt)} ${archiv ? 'im Archiv' : 'offen'}${inAuswahl}`;

  return (
    <WebSeite
      bereich="Support"
      titel="Vorgänge"
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
    >
      {inhalt}
      {neuOffen && (
        <WebNeuerVorgang
          schreiben={gemeindeName !== null}
          vorbelegt={auswahl.gemeinde !== 'alle' ? { organizationId: auswahl.gemeinde, art: 'sonstiges' } : undefined}
          onSchliessen={() => setNeuOffen(false)}
        />
      )}
    </WebSeite>
  );
};

export default WebVorgaenge;
