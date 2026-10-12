// Posteingang in der Web-Fassung der Support-Ansicht, /admin/support/post und
// /admin/support/post/:id (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Simon, 03.10.2026: „… und dann gibt es immer noch die Mail, und die kann
// zusortiert werden." Hier liegen nur die eingehenden Mails an moin@ und
// support@, die der Server keinem Vorgang zuordnen konnte und die nicht
// archiviert sind. Wie ein Mailprogramm (Simon, 11.10.2026): links die Mails
// (Kreis mit den Initialen des Absenders wie im Kopf der Mail, Absender,
// Betreff als Kern ohne Re:/AW:, eine Zeile Text), rechts die gewählte im
// Lesebereich (web/WebPostDetail) mit Einsortieren, Antworten, Archivieren
// und Löschen. Der Lese-Rahmen (web/useListenRahmen.ts) gibt „Breit lesen"
// (Schalter im Kopf der Liste), ‹ › zum Blättern und nach Archivieren oder
// Löschen die nächste Mail (docs/planung/support-detailseiten.md, F).
// Mehrere Mails lassen sich ankreuzen. Filter: Alle, Ungelesen, moin@,
// support@ und Archiv. Der Zustand der Postfächer steht als eine Zeile oben
// und klappt nur bei einer Störung auf.
//
// Die rote Zahl am Filter „Ungelesen" ist dieselbe wie die der Leiste
// (navigation/supportMailZaehler.ts). Die Logik steht in
// components/support/usePosteingang.ts und useMailAktionen.ts, dieselbe wie in
// der App.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_ANHANG, ICON_ARCHIV, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG } from '../../shared/icons';
import type { MailPostfachStatus } from '../../../types/support';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, aufDiesemServer, betreffKern } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { mailZeit } from '../../../utils/mailGespraeche';
import { mailsText } from '../../../utils/supportVorgaenge';
import { EINGANG_FILTER, type EingangFilter, type MailEingangWeb } from '../../../utils/supportWeb';
import { useSupportMailZaehler } from '../../../navigation/supportMailZaehler';
import { usePosteingang } from '../usePosteingang';
import { useMailAktionen } from '../useMailAktionen';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebListenSeite from '../../web/WebListenSeite';
import { useFilterAusAdresse } from '../../web/useFilterAusAdresse';
import WebPostDetail from './WebPostDetail';
import WebPostfach, { MailKreis, WebLeseHinweis, WebPostfachZeilen } from './WebPostfach';
import { LeseRahmenProvider, WebLeseNavigation } from './WebLeseRahmen';
import { useLeseAuswahl } from './useLeseAuswahl';
import { useListenRahmen } from './useListenRahmen';
import { BREIT_LESEN } from '../../../seiten/supportDetail';
import '../../../theme/web/support.css';
import { leerVon } from '../../../seiten/beschreibung';
import {
  POSTEINGANG_FILTER,
  POSTEINGANG_FILTER_BESCHRIFTUNG,
  POSTEINGANG_LEER_TITEL,
  POSTEINGANG_TITEL,
  ZUGANGSDATEN_FEHLEN,
} from '../../../seiten/supportPosteingang';

/** Ein Postfach braucht Aufmerksamkeit: Fehler, nicht eingerichtet oder auf diesem Server aus. */
const gestoert = (p: MailPostfachStatus) => Boolean(p.fehler) || !p.eingerichtet || !aufDiesemServer(p);

/** Der Zustand eines Postfachs mit Grund -- nur, wenn etwas nicht stimmt. */
const PostfachStoerung: React.FC<{ p: MailPostfachStatus }> = ({ p }) => {
  const info = POSTFACH_INFO[p.postfach];
  const aus = !aufDiesemServer(p);
  return (
    <div className={`web-status${p.fehler ? ' web-status--fehler' : ' web-status--warnung'}`}>
      <div className="web-status__kopf">
        <span className="web-status__name">{p.adresse || info?.kurz}</span>
        <WebPill ton="warnung" punkt>{aus ? 'Auf diesem Server aus' : p.eingerichtet ? 'Fehler beim Abholen' : 'Nicht eingerichtet'}</WebPill>
      </div>
      {aus && <div className="web-status__meta"><span>{SERVER_AUS_HINWEIS}</span></div>}
      {!p.eingerichtet && !aus && (
        <div className="web-status__meta"><span>{ZUGANGSDATEN_FEHLEN.titel}: {ZUGANGSDATEN_FEHLEN.text}</span></div>
      )}
      {p.fehler && (
        <div className="web-status__meta">
          <span>Fehler beim Abholen: {p.fehler}{p.fehler_am ? ` (${datumUhrzeit(p.fehler_am)})` : ''}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Der Zustand der Postfächer als eine Zeile; bei einer Störung je Postfach
 * ein Kasten mit dem Grund (bis 11.10.2026 standen immer beide Kästen da).
 */
const PostfachZeile: React.FC<{ status: MailPostfachStatus[] | null }> = ({ status }) => {
  if (!status) return <div className="web-status web-status--fehler" role="status">Der Zustand der Postfächer konnte nicht geladen werden.</div>;
  if (status.length === 0) return <div className="web-status">Der Server meldet keine Postfächer.</div>;
  const stoerungen = status.filter(gestoert);
  if (stoerungen.length > 0) {
    return <div className="web-statuszeile">{stoerungen.map((p) => <PostfachStoerung key={p.postfach} p={p} />)}</div>;
  }
  const zuletzt = status.map((p) => p.abgeholt_am).filter((t): t is string => Boolean(t)).sort().pop();
  return (
    <p className="web-postfachstand" role="status">
      <WebPill ton="erfolg" punkt>{status.map((p) => POSTFACH_INFO[p.postfach]?.kurz ?? p.postfach).join(' und ')}</WebPill>
      {zuletzt ? ` zuletzt abgeholt ${zeitpunktText(zuletzt)}` : ' noch nicht abgeholt'}
    </p>
  );
};

const WebPosteingang: React.FC<{ start?: number | null }> = ({ start = null }) => {
  const [gewaehlt, waehlen] = useLeseAuswahl('/admin/support/post', start);
  const zaehler = useSupportMailZaehler(true);
  const [filter, setFilter] = useFilterAusAdresse<EingangFilter>('/admin/support/post', EINGANG_FILTER, 'alle');
  const eingang = usePosteingang(filter);
  const aktionen = useMailAktionen();
  const { zaehlen, sichtbar, laedt, fehler, status, neuLaden } = eingang;
  const [ausgewaehlt, setAusgewaehlt] = useState<ReadonlySet<number>>(new Set());

  const archiv = filter === 'archiv';
  // Die rote Zahl: ungelesen im Posteingang -- aus dem Zaehler der Leiste, solange er da ist.
  const ungelesenZahl = zaehler ? zaehler.posteingang : zaehlen.ungelesen;

  // Was nicht mehr in der Liste steht (einsortiert, archiviert, geloescht), bleibt nicht ausgewaehlt.
  const reihenfolge = useMemo(() => sichtbar.map((m) => m.id), [sichtbar]);
  const sichtbareIds = useMemo(() => new Set(reihenfolge), [reihenfolge]);
  const { rahmen, breit, breitLesen } = useListenRahmen({
    ids: reihenfolge, gewaehlt, waehlen, listeLabel: BREIT_LESEN.liste.posteingang, direktlink: start !== null,
  });
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
  const ids = [...ausgewaehlt];
  const nachAktion = (ok: boolean) => { if (ok) setAusgewaehlt(new Set()); };
  // Archivieren und Löschen nehmen die Mails aus der Liste: Ist die offene dabei, öffnet sich wie
  // nach einem Abschluss im Kopf die nächste (Frage 6).
  const nachAbschluss = (ok: boolean, geloescht = false) => {
    nachAktion(ok);
    if (ok) rahmen.sammelAbgeschlossen(ids, geloescht);
  };

  // Was die Zeile außer „Absender: Betreff" zeigt, für Vorleseprogramme (der Name ersetzt den Inhalt des Knopfes).
  const beschreibung = (m: MailEingangWeb) => {
    const anhaenge = (m.anhaenge ?? []).length;
    return [
      `an ${POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach}`,
      ...(anhaenge > 0 ? [anhaenge === 1 ? '1 Anhang' : `${anhaenge} Anhänge`] : []),
      m.auszug || 'Ohne Text',
    ].join(' · ');
  };

  // Eine Zeile der Liste: Absender und Zeit, Betreff, eine Zeile Text.
  const zeile = (m: MailEingangWeb) => {
    const anhaenge = (m.anhaenge ?? []).length;
    return (
      <>
        <span className="web-postfachzeile__oben">
          <span className="web-postfachzeile__titel">{m.von_name?.trim() || m.von_adresse}</span>
          <time className="web-postfachzeile__zeit" dateTime={m.gesendet_am} title={datumUhrzeit(m.gesendet_am)}>{mailZeit(m.gesendet_am)}</time>
        </span>
        <span className="web-postfachzeile__betreff">{betreffKern(m.betreff) || '(ohne Betreff)'}</span>
        <span className="web-postfachzeile__unten">
          <span className="web-postfachzeile__text">
            {anhaenge > 0 && <IonIcon className="web-postfachzeile__anhang" icon={ICON_ANHANG} aria-label={anhaenge === 1 ? '1 Anhang' : `${anhaenge} Anhänge`} />}
            {/* Eigene Spanne: Im Flex-Behälter bekäme der bloße Text kein „…", er bräche mitten im Buchstaben ab. */}
            <span className="web-postfachzeile__auszug">{m.auszug || 'Ohne Text'}</span>
          </span>
          <span className="web-postfachzeile__marken"><WebPill postfach>{POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach}</WebPill></span>
        </span>
      </>
    );
  };

  const untertitel = archiv
    ? 'Archivierte Mails, die zu keinem Vorgang gehören'
    : `${mailsText(zaehlen.alle)} ${zaehlen.alle === 1 ? 'wartet' : 'warten'} darauf, einem Vorgang zugeordnet zu werden`;

  // Die Leiste fuer mehrere ausgewaehlte Mails steht zwischen Filter und Liste.
  const sammelleiste = !laedt && !fehler && sichtbar.length > 0 ? (
    <div className="web-sammelleiste web-sammelleiste--liste" role="group" aria-label="Auswahl">
      <label className="web-sammelleiste__alle">
        <input
          ref={alleKasten}
          type="checkbox"
          className="web-kontrollkasten"
          checked={alleAn}
          onChange={() => setAusgewaehlt(alleAn ? new Set() : new Set(sichtbar.map((m) => m.id)))}
        />
        {ausgewaehlt.size > 0 ? `${mailsText(ausgewaehlt.size)} ausgewählt` : 'Alle auswählen'}
      </label>
      {ausgewaehlt.size > 0 && (
        <div className="web-sammelleiste__aktionen">
          {archiv ? (
            <WebKnopf klein disabled={!aktionen.isOnline} onClick={() => { void aktionen.wiederherstellen(ids).then(nachAktion); }}>
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
              Wiederherstellen
            </WebKnopf>
          ) : (
            <WebKnopf klein disabled={!aktionen.isOnline} onClick={() => { void aktionen.archivieren(ids).then((ok) => nachAbschluss(ok)); }}>
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
              Archivieren
            </WebKnopf>
          )}
          <WebKnopf klein art="gefahr" disabled={!aktionen.isOnline} onClick={() => aktionen.loeschenFragen(ids, () => nachAbschluss(true, true))}>
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            Löschen
          </WebKnopf>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <WebListenSeite<MailEingangWeb, EingangFilter>
      bereich="Support"
      titel={POSTEINGANG_TITEL}
      untertitel={untertitel}
      aktionen={(
        <WebKnopf onClick={() => { void neuLaden(); }}>
          <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
          Aktualisieren
        </WebKnopf>
      )}
      laden={laedt ? { text: 'Der Posteingang wird geladen.', karten: 2 } : undefined}
      fehler={!laedt && fehler ? { text: 'Der Posteingang konnte nicht geladen werden.', onErneut: () => { void neuLaden(); } } : undefined}
      oben={<PostfachZeile status={status} />}
      // Filter aus der gemeinsamen Beschreibung (seiten/supportPosteingang.ts); rot sind die, die Arbeit machen.
      reiter={{
        beschriftung: POSTEINGANG_FILTER_BESCHRIFTUNG,
        wahlen: POSTEINGANG_FILTER,
        wert: filter,
        onWert: setFilter,
        zahlen: {
          ...zaehlen,
          ungelesen: ungelesenZahl,
          ...(eingang.archivAnzahl !== null ? { archiv: eingang.archivAnzahl } : { archiv: undefined }),
        },
        rot: (f) => POSTEINGANG_FILTER.find((w) => w.schluessel === f)?.zahlText !== undefined,
      }}
      eintraege={sichtbar}
      voll
      inhaltStatt={(eintraege, leerZustand) => (
        <WebPostfach
          listeKopf={sammelleiste}
          listeBeschriftung={archiv ? 'Archivierte Mails' : 'Mails im Posteingang'}
          breit={breit}
          breitLesen={breitLesen}
          liste={eintraege.length === 0 ? <div className="web-postfach__leer">{leerZustand}</div> : (
            <WebPostfachZeilen<MailEingangWeb>
              eintraege={eintraege}
              kennung={(m) => m.id}
              gewaehlt={gewaehlt}
              onWaehlen={rahmen.waehlen}
              zeile={zeile}
              kreis={(m) => <MailKreis name={m.von_name} adresse={m.von_adresse} />}
              name={(m) => `${m.von_name?.trim() || m.von_adresse}: ${betreffKern(m.betreff) || '(ohne Betreff)'}`}
              beschreibung={beschreibung}
              ungelesen={(m) => !m.gelesen_am}
              auswahl={{ ausgewaehlt, umschalten }}
            />
          )}
          // Breit: „‹ Posteingang" und ‹ › über dem Lesebereich -- auch, solange die Mail lädt oder fehlt.
          leiste={<LeseRahmenProvider wert={rahmen}><WebLeseNavigation /></LeseRahmenProvider>}
          lesen={gewaehlt !== null ? (
            <LeseRahmenProvider wert={rahmen}>
              <WebPostDetail key={gewaehlt} nachrichtId={gewaehlt} onGeloescht={() => rahmen.waehlen(null)} onEinsortiert={() => rahmen.waehlen(null)} />
            </LeseRahmenProvider>
          ) : <WebLeseHinweis icon={ICON_MAIL} titel="Keine Mail gewählt" text="Wähle links eine Mail — sie öffnet sich hier." />}
        />
      )}
      leer={{ icon: archiv ? ICON_ARCHIV : ICON_MAIL, titel: POSTEINGANG_LEER_TITEL[filter], text: leerVon(POSTEINGANG_FILTER, filter) }}
    />
  );
};

export default WebPosteingang;
