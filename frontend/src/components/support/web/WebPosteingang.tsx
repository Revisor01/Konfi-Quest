// Posteingang in der Web-Fassung der Support-Ansicht, /admin/support/post
// (docs/planung/support-web.md, Entscheidung 10).
//
// Simon, 03.10.2026: "Und auch Support-Anfragen etc. kommen ins Postfach,
// oder?" -- Der Posteingang ist hier wie ein Mailprogramm: ALLE eingehenden
// Mails beider Postfaecher (GET /support/mail/eingang?zuordnung=alle), mit den
// Filtern Alle, Nicht zugeordnet, moin@ und support@ und einer Spalte, wohin
// die Mail gehoert (Link zur Anfrage bzw. zum Schriftwechsel der Gemeinde).
//
// Die rote Zahl am Filter "Nicht zugeordnet" ist dieselbe wie die der Leiste:
// ungelesene Mails ohne Zuordnung, aus GET /support/mail/zaehler
// (navigation/supportMailZaehler.ts). Mails mit Zuordnung zaehlen schon an
// der Anfrage bzw. Gemeinde.

import React, { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { ICON_AKTUALISIEREN, ICON_ANHANG, ICON_MAIL } from '../../shared/icons';
import api from '../../../services/api';
import type { MailPostfachStatus } from '../../../types/support';
import { POSTFACH_INFO, SERVER_AUS_HINWEIS, aufDiesemServer } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { zeitpunktText } from '../../../utils/postfach';
import { useSupportMailZaehler } from '../../../navigation/supportMailZaehler';
import {
  eingangFiltern,
  eingangLesen,
  eingangZaehlen,
  istNichtZugeordnet,
  zuordnungZiel,
  type EingangFilter,
  type MailEingangWeb,
} from '../../../utils/supportWeb';
import WebSeite from './WebSeite';
import WebKnopf from './WebKnopf';
import WebLink from './WebLink';
import WebPill from './WebPill';
import WebChips from './WebChips';
import WebTabelle, { type WebSpalte } from './WebTabelle';
import { WebFehler, WebLaden, WebLeer } from './WebZustaende';
import { useWebDaten } from './useWebDaten';

interface PosteingangDaten {
  mails: MailEingangWeb[];
  /** Zustand der Postfaecher; null, wenn er nicht kam (die Zeile sagt das). */
  status: MailPostfachStatus[] | null;
}

async function ladeEingang(): Promise<PosteingangDaten> {
  // Alle eingehenden Mails, nicht nur die nicht zugeordneten (Vorgabe des Servers).
  const [mails, status] = await Promise.allSettled([
    api.get('/support/mail/eingang', { params: { zuordnung: 'alle' } }),
    api.get('/support/mail/status'),
  ]);
  if (mails.status !== 'fulfilled') throw mails.reason;
  const liste = eingangLesen(mails.value.data);
  if (!liste) throw new Error('Der Posteingang kam in einer unbekannten Form');
  return {
    mails: liste,
    status: status.status === 'fulfilled' && Array.isArray(status.value.data?.postfaecher) ? status.value.data.postfaecher : null,
  };
}

const LEER_TEXT: Record<EingangFilter, string> = {
  alle: 'Mails an moin@ und support@ erscheinen hier, sobald die Postfächer abgeholt sind.',
  offen: 'Jede Mail ist einer Anfrage oder Gemeinde zugeordnet.',
  moin: `Keine Mails an ${POSTFACH_INFO.moin.kurz}.`,
  support: `Keine Mails an ${POSTFACH_INFO.support.kurz}.`,
};

const LEER_TITEL: Record<EingangFilter, string> = {
  alle: 'Noch keine Mails',
  offen: 'Nichts zuzuordnen',
  moin: 'Keine Mails',
  support: 'Keine Mails',
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
  const { daten, laedt, neuLaden } = useWebDaten(ladeEingang);
  const zaehler = useSupportMailZaehler(true);
  const [filter, setFilter] = useState<EingangFilter>('alle');

  const mails = useMemo(() => daten?.mails ?? [], [daten]);
  const zaehlen = useMemo(() => eingangZaehlen(mails), [mails]);
  const sichtbar = useMemo(() => eingangFiltern(mails, filter), [mails, filter]);
  // Die rote Zahl: ungelesen und nicht zugeordnet -- aus dem Zaehler der Leiste, solange er da ist.
  const ungelesenOffen = zaehler ? zaehler.eingang : mails.filter((m) => istNichtZugeordnet(m) && !m.gelesen_am).length;

  const spalten: Array<WebSpalte<MailEingangWeb>> = [
    {
      schluessel: 'punkt',
      kopf: 'Ungelesen',
      kopfVersteckt: true,
      breite: '36px',
      zelle: (m) => (m.gelesen_am ? null : <span className="app-ungelesen-punkt web-punkt-zeile" role="img" aria-label="ungelesen" />),
    },
    {
      schluessel: 'postfach',
      kopf: 'Postfach',
      breite: '96px',
      zelle: (m) => <WebPill postfach>{POSTFACH_INFO[m.postfach]?.kurz ?? m.postfach}</WebPill>,
    },
    {
      schluessel: 'von',
      kopf: 'Von',
      breite: '22%',
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
      schluessel: 'zuordnung',
      kopf: 'Zugeordnet',
      breite: '22%',
      zelle: (m) => {
        const ziel = zuordnungZiel(m);
        return ziel ? (
          <WebLink href={ziel.pfad} vorn className="web-einzeilig" title={ziel.art === 'anfrage' ? 'Zur Anfrage' : 'Zum Schriftwechsel der Gemeinde'}>
            {ziel.text}
          </WebLink>
        ) : (
          <span className="web-gedaempft">—</span>
        );
      },
    },
    {
      schluessel: 'datum',
      kopf: 'Datum',
      breite: '112px',
      zahl: true,
      zelle: (m) => <span title={datumUhrzeit(m.gesendet_am)}>{zeitpunktText(m.gesendet_am)}</span>,
    },
  ];

  let inhalt: React.ReactNode;
  if (laedt) {
    inhalt = <WebLaden karten={2} text="Der Posteingang wird geladen." />;
  } else if (!daten) {
    inhalt = <WebFehler text="Der Posteingang konnte nicht geladen werden." onErneut={() => { void neuLaden(); }} />;
  } else {
    inhalt = (
      <>
        <div className="web-statuszeile">
          {daten.status
            ? (daten.status.length > 0
              ? daten.status.map((p) => <PostfachStatus key={p.postfach} p={p} />)
              : <div className="web-status">Der Server meldet keine Postfächer.</div>)
            : <div className="web-status web-status--fehler" role="status">Der Zustand der Postfächer konnte nicht geladen werden.</div>}
        </div>

        <WebChips<EingangFilter>
          beschriftung="Mails filtern"
          wert={filter}
          onWert={setFilter}
          chips={[
            { wert: 'alle', label: 'Alle', zahl: zaehlen.alle },
            { wert: 'offen', label: 'Nicht zugeordnet', zahl: ungelesenOffen > 0 ? ungelesenOffen : undefined, rot: true, zahlText: 'ungelesen' },
            { wert: 'moin', label: POSTFACH_INFO.moin.kurz, zahl: zaehlen.moin },
            { wert: 'support', label: POSTFACH_INFO.support.kurz, zahl: zaehlen.support },
          ]}
        />

        <div className="web-karte">
          {sichtbar.length > 0 ? (
            <WebTabelle
              beschriftung="Eingehende Mails"
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

  const untertitel = daten ? `${zaehlen.alle} ${zaehlen.alle === 1 ? 'Mail' : 'Mails'} an moin@ und support@, neueste zuerst` : 'Alle eingehenden Mails an moin@ und support@';

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
    </WebSeite>
  );
};

export default WebPosteingang;
