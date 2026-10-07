// Posteingang in der Web-Fassung der Support-Ansicht, /admin/support/post
// (docs/planung/support-vorgaenge.md, Entscheidung 7).
//
// Simon, 03.10.2026: „… und dann gibt es immer noch die Mail, und die kann
// zusortiert werden." Hier liegen nur die eingehenden Mails an moin@ und
// support@, die der Server keinem Vorgang zuordnen konnte und die nicht
// archiviert sind. Je Mail „Einsortieren" (bestehender Vorgang mit Suche oder
// neuer Vorgang mit Art, Bereich, Gemeinde), Archivieren und Löschen; mehrere
// Mails lassen sich auswählen. Filter: Alle, Ungelesen, moin@, support@ und
// Archiv. Alles andere -- Anfragen, Formulare, Schriftwechsel -- steht in den
// Vorgängen.
//
// Die rote Zahl am Filter „Ungelesen" ist dieselbe wie die der Leiste
// (navigation/supportMailZaehler.ts). Die Logik steht in
// components/support/usePosteingang.ts und useMailAktionen.ts, dieselbe wie in
// der App.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_ANHANG, ICON_ARCHIV, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG } from '../../shared/icons';
import type { MailPostfachStatus } from '../../../types/support';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, aufDiesemServer } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { mailsText } from '../../../utils/supportVorgaenge';
import { EINGANG_FILTER, type EingangFilter, type MailEingangWeb } from '../../../utils/supportWeb';
import { useSupportMailZaehler } from '../../../navigation/supportMailZaehler';
import { usePosteingang } from '../usePosteingang';
import { useMailAktionen } from '../useMailAktionen';
import WebSeite from '../../web/WebSeite';
import WebKnopf from '../../web/WebKnopf';
import WebLink from '../../web/WebLink';
import WebPill from '../../web/WebPill';
import WebChips from '../../web/WebChips';
import WebTabelle, { type WebSpalte } from '../../web/WebTabelle';
import { WebFehler, WebLaden, WebLeer } from '../../web/WebZustaende';
import { useFilterAusAdresse } from '../../web/useFilterAusAdresse';
import WebEinsortieren from './WebEinsortieren';
import '../../../theme/web/support.css';

const LEER_TEXT: Record<EingangFilter, string> = {
  alle: 'Alles ist einsortiert. Neue Mails, die zu keinem Vorgang passen, erscheinen hier.',
  ungelesen: 'Alle Mails sind gelesen.',
  moin: `Keine Mails an ${POSTFACH_INFO.moin.kurz}, die noch einsortiert werden müssen.`,
  support: `Keine Mails an ${POSTFACH_INFO.support.kurz}, die noch einsortiert werden müssen.`,
  archiv: 'Archivierte Mails liegen hier und werden nach 180 Tagen gelöscht.',
};

const LEER_TITEL: Record<EingangFilter, string> = {
  alle: 'Nichts einzusortieren',
  ungelesen: 'Nichts Ungelesenes',
  moin: 'Keine Mails',
  support: 'Keine Mails',
  archiv: 'Das Archiv ist leer',
};

/** Der Zustand eines Postfachs: eingerichtet, zuletzt abgeholt, Fehler, "auf diesem Server aus". */
const PostfachStatus: React.FC<{ p: MailPostfachStatus }> = ({ p }) => {
  const info = POSTFACH_INFO[p.postfach];
  const aus = !aufDiesemServer(p);
  const art = p.fehler ? ' web-status--fehler' : aus || !p.eingerichtet ? ' web-status--warnung' : '';
  return (
    <div className={`web-status${art}`}>
      <div className="web-status__kopf">
        <span className="web-status__name">{p.adresse || info?.kurz}</span>
        <WebPill ton={p.eingerichtet && !aus ? 'erfolg' : 'warnung'} punkt>
          {aus ? 'Auf diesem Server aus' : p.eingerichtet ? 'Eingerichtet' : 'Nicht eingerichtet'}
        </WebPill>
      </div>
      <div className="web-status__meta">
        <span>{info?.aufgabe}</span>
        <span>{p.abgeholt_am ? `zuletzt abgeholt ${zeitpunktText(p.abgeholt_am)}` : 'noch nicht abgeholt'}</span>
      </div>
      {aus && <div className="web-status__meta"><span>{SERVER_AUS_HINWEIS}</span></div>}
      {p.fehler && (
        <div className="web-status__meta">
          <span>Fehler beim Abholen: {p.fehler}{p.fehler_am ? ` (${datumUhrzeit(p.fehler_am)})` : ''}</span>
        </div>
      )}
    </div>
  );
};

const WebPosteingang: React.FC = () => {
  const zaehler = useSupportMailZaehler(true);
  const [filter, setFilter] = useFilterAusAdresse<EingangFilter>('/admin/support/post', EINGANG_FILTER, 'alle');
  const eingang = usePosteingang(filter);
  const aktionen = useMailAktionen();
  const { zaehlen, sichtbar, laedt, fehler, status, neuLaden } = eingang;
  const [einsortieren, setEinsortieren] = useState<MailEingangWeb | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<ReadonlySet<number>>(new Set());

  const archiv = filter === 'archiv';
  // Die rote Zahl: ungelesen im Posteingang -- aus dem Zaehler der Leiste, solange er da ist.
  const ungelesenZahl = zaehler ? zaehler.posteingang : zaehlen.ungelesen;

  // Was nicht mehr in der Liste steht (einsortiert, archiviert, geloescht), bleibt nicht ausgewaehlt.
  const sichtbareIds = useMemo(() => new Set(sichtbar.map((m) => m.id)), [sichtbar]);
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

  const spalten: Array<WebSpalte<MailEingangWeb>> = [
    {
      schluessel: 'auswahl',
      kopf: 'Auswählen',
      kopfVersteckt: true,
      breite: '44px',
      zelle: (m) => (
        <input
          type="checkbox"
          className="web-kontrollkasten web-vorn"
          aria-label={`Mail auswählen: ${m.betreff?.trim() || '(ohne Betreff)'}`}
          checked={ausgewaehlt.has(m.id)}
          onChange={() => umschalten(m.id)}
        />
      ),
    },
    {
      schluessel: 'punkt',
      kopf: 'Ungelesen',
      kopfVersteckt: true,
      breite: '28px',
      zelle: (m) => (m.gelesen_am ? null : <span className="app-ungelesen-punkt web-punkt-zeile" role="img" aria-label="ungelesen" />),
    },
    {
      schluessel: 'postfach',
      kopf: 'Postfach',
      breite: '92px',
      sortWert: (m) => POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach,
      zelle: (m) => <WebPill postfach>{POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach}</WebPill>,
    },
    {
      schluessel: 'von',
      kopf: 'Von',
      breite: '22%',
      sortWert: (m) => m.von_name?.trim() || m.von_adresse,
      zelle: (m) => {
        const name = m.von_name?.trim();
        return (
          <span className={m.gelesen_am ? undefined : 'web-ungelesen'}>
            <span className="web-einzeilig">{name || m.von_adresse}</span>
            {name && <span className="web-zelle-leise web-einzeilig">{m.von_adresse}</span>}
          </span>
        );
      },
    },
    {
      schluessel: 'betreff',
      kopf: 'Betreff',
      sortWert: (m) => m.betreff?.trim() || '(ohne Betreff)',
      zelle: (m) => {
        const anhaenge = (m.anhaenge ?? []).length;
        return (
          <>
            <WebLink
              href={`/admin/support/post/${m.id}`}
              className={`web-link--zeile web-link--text web-einzeilig${m.gelesen_am ? ' web-gedaempft' : ' web-ungelesen'}`}
            >
              {m.betreff?.trim() || '(ohne Betreff)'}
            </WebLink>
            {(m.auszug || anhaenge > 0) && (
              <span className="web-zelle-leise web-einzeilig">
                {anhaenge > 0 && (
                  <>
                    <IonIcon icon={ICON_ANHANG} aria-hidden="true" /> {anhaenge === 1 ? '1 Anhang' : `${anhaenge} Anhänge`}{m.auszug ? ' · ' : ''}
                  </>
                )}
                {m.auszug}
              </span>
            )}
          </>
        );
      },
    },
    {
      schluessel: 'datum',
      kopf: 'Datum',
      breite: '104px',
      zahl: true,
      sortWert: (m) => Date.parse(m.gesendet_am),
      zelle: (m) => <span title={datumUhrzeit(m.gesendet_am)}>{zeitpunktText(m.gesendet_am)}</span>,
    },
    {
      schluessel: 'aktionen',
      kopf: 'Aktionen',
      kopfVersteckt: true,
      breite: '232px',
      klasse: 'web-spalte-aktionen',
      zelle: (m) => {
        const titel = m.betreff?.trim() || '(ohne Betreff)';
        return (
          <span className="web-zeilenaktionen">
            {archiv ? (
              <WebKnopf klein vorn disabled={!aktionen.isOnline} onClick={() => { void aktionen.wiederherstellen([m.id]); }} aria-label={`Wiederherstellen: ${titel}`}>
                <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
                Wiederherstellen
              </WebKnopf>
            ) : (
              <>
                <WebKnopf klein art="primaer" vorn onClick={() => setEinsortieren(m)} aria-label={`Einsortieren: ${titel}`}>Einsortieren</WebKnopf>
                <WebKnopf klein symbol vorn disabled={!aktionen.isOnline} onClick={() => { void aktionen.archivieren([m.id]); }} aria-label={`Archivieren: ${titel}`} title="Archivieren">
                  <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
                </WebKnopf>
              </>
            )}
            <WebKnopf klein symbol art="gefahr" vorn disabled={!aktionen.isOnline} onClick={() => aktionen.loeschenFragen([m.id])} aria-label={`Löschen: ${titel}`} title="Löschen">
              <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
            </WebKnopf>
          </span>
        );
      },
    },
  ];

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden karten={2} text="Der Posteingang wird geladen." />;
  } else if (fehler) {
    inhalt = <WebFehler text="Der Posteingang konnte nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else {
    inhalt = (
      <>
        <div className="web-statuszeile">
          {status
            ? (status.length > 0
              ? status.map((p) => <PostfachStatus key={p.postfach} p={p} />)
              : <div className="web-status">Der Server meldet keine Postfächer.</div>)
            : <div className="web-status web-status--fehler" role="status">Der Zustand der Postfächer konnte nicht geladen werden.</div>}
        </div>

        <WebChips<EingangFilter>
          beschriftung="Mails filtern"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
            { wert: 'ungelesen', label: 'Ungelesen', zahl: ungelesenZahl, rot: true, zahlText: 'ungelesen' },
            { wert: 'moin', label: POSTFACH_INFO.moin.kurz, zahl: zaehlen.moin },
            { wert: 'support', label: POSTFACH_INFO.support.kurz, zahl: zaehlen.support },
            { wert: 'archiv', label: 'Archiv', zahl: eingang.archivAnzahl ?? undefined },
          ]}
        />

        {sichtbar.length > 0 && (
          <div className="web-sammelleiste" role="group" aria-label="Auswahl">
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
                  <WebKnopf klein disabled={!aktionen.isOnline} onClick={() => { void aktionen.archivieren(ids).then(nachAktion); }}>
                    <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
                    Archivieren
                  </WebKnopf>
                )}
                <WebKnopf klein art="gefahr" disabled={!aktionen.isOnline} onClick={() => aktionen.loeschenFragen(ids, () => setAusgewaehlt(new Set()))}>
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
              beschriftung={archiv ? 'Archivierte Mails' : 'Mails im Posteingang'}
              spalten={spalten}
              zeilen={sichtbar}
              zeileSchluessel={(m) => m.id}
              zeileKlasse={(m) => (m.gelesen_am ? undefined : 'web-zeile--ungelesen')}
              mittig
              fest
            />
          ) : (
            <WebLeer icon={ICON_MAIL} titel={LEER_TITEL[filter]} text={LEER_TEXT[filter]} />
          )}
        </div>
      </>
    );
  }

  const untertitel = archiv
    ? 'Archivierte Mails, die zu keinem Vorgang gehören'
    : `${mailsText(zaehlen.alle)} ${zaehlen.alle === 1 ? 'wartet' : 'warten'} darauf, einem Vorgang zugeordnet zu werden`;

  return (
    <WebSeite
      bereich="Support"
      titel="Posteingang"
      untertitel={untertitel}
      aktionen={(
        <WebKnopf onClick={() => { void neuLaden(); }}>
          <IonIcon icon={ICON_AKTUALISIEREN} aria-hidden="true" />
          Aktualisieren
        </WebKnopf>
      )}
    >
      {inhalt}
      {einsortieren && (
        <WebEinsortieren mail={{ id: einsortieren.id, betreff: einsortieren.betreff }} onSchliessen={() => setEinsortieren(null)} />
      )}
    </WebSeite>
  );
};

export default WebPosteingang;
