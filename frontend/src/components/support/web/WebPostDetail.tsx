// Eine Mail aus dem Posteingang im Lesebereich der Web-Fassung (rechts neben
// der Liste, web/WebPosteingang) -- wie in einem Mailprogramm (Simon,
// 11.10.2026) und mit demselben Kopf wie ein Vorgang
// (docs/planung/support-detailseiten.md, Skizzen D und E):
//
//   Kopf (klebt): der Kreis mit den Initialen des Absenders, der Kern des
//     Betreffs (ohne Re:, AW: und Kennung), darunter „Von Name <adresse> · an
//     {Postfach} · Zeit · N Mails · k Anhänge". Rechts Löschen und
//     Archivieren als Symbole, Antworten bzw. Wiederherstellen und rechts
//     außen „Einsortieren" -- der Posteingang ist zum Zuordnen da.
//   Ein Stand-Satz nur im Archiv („Im Archiv seit … · wird nach 180 Tagen
//     gelöscht · Einsortieren holt sie zurück."); sonst keiner, und keine
//     Karte mit Angaben -- sie wiederholte nur den Kopf.
//   Der Verlauf flach (MailGespraeche), ohne Aktionen je Mail; darunter die
//     Antwortzeile, ein Klick öffnet den Editor an dieser Stelle (G).
//   Liegt die Mail in einem Vorgang (oder gehört sie zu einer Anfrage oder
//     Gemeinde), leitet die Seite mit replace dorthin weiter (E):
//     /admin/support/vorgaenge/N?mail=ID, die Mail steht dort offen und
//     hervorgehoben. Archivieren und Löschen gibt es dann nicht -- der
//     Server lehnt beides für solche Mails ab (409).
//
// Die Logik (laden, als gelesen melden, Stand, Antwortformular, archivieren,
// löschen) steht in components/support/usePostDetail.ts, dieselbe wie in der
// App; die Regeln in utils/supportMail.ts (mailStand, mailKennzahlen). Der
// Lese-Rahmen der Liste öffnet nach Archivieren oder Löschen die nächste
// Mail (Frage 6); ohne Rahmen bleibt sie stehen.

import React, { useEffect, useState } from 'react';
import { useIonRouter } from '@ionic/react';
import { ICON_ANTWORTEN, ICON_ARCHIV, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG, ICON_WARNHINWEIS, ICON_WECHSEL } from '../../shared/icons';
import { POSTFACH_INFO, betreffKern } from '../../../utils/supportMail';
import { mailsText, standZeit } from '../../../utils/supportVorgaenge';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { MAIL_DETAIL_TEXT, VERLAUF_TEXT } from '../../../seiten/supportDetail';
import { usePostDetail } from '../usePostDetail';
import { useMailWeiterleitung } from '../useMailWeiterleitung';
import MailGespraeche from '../MailGespraeche';
import WebKnopf from '../../web/WebKnopf';
import WebPill from '../../web/WebPill';
import WebAntwortStelle from './WebAntwortStelle';
import WebEinsortieren from './WebEinsortieren';
import { WebLesen } from './WebLeseRahmen';
import { LESE_RAHMEN_NEUTRAL, useLeseRahmen } from './leseRahmen';
import { MailKreis, WebLeseHinweis } from './WebPostfach';
import { useAntwortStelle, useEntwurfSchutz } from './useAntwortStelle';
import { KopfAktionen, KopfKnopf, StandZeile } from './WebVorgangTeile';
import '../../../theme/web/support.css';

export interface WebPostDetailProps {
  nachrichtId: number;
  /** Die Mail ist gelöscht: den Lesebereich leeren (ohne Lese-Rahmen der Liste). */
  onGeloescht?: () => void;
  /**
   * Die Mail ist einsortiert und steht nicht mehr im Posteingang: Auswahl
   * leeren. Sonst laedt der Lesebereich sie neu und meldet den Verlauf ihres
   * Vorgangs als gelesen, ohne dass ihn jemand geoeffnet hat.
   */
  onEinsortiert?: () => void;
}

const WebPostDetail: React.FC<WebPostDetailProps> = ({ nachrichtId, onGeloescht, onEinsortiert }) => {
  const rahmen = useLeseRahmen();
  const mitRahmen = rahmen !== LESE_RAHMEN_NEUTRAL;
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, laden, letzteEingehende, archivieren, wiederherstellen, loeschenFragen,
    stand, kennzahlen, antwort, weiterleitung,
  } = usePostDetail(nachrichtId, mitRahmen ? () => rahmen.abgeschlossen(nachrichtId) : onGeloescht);
  // Nur, was schon beim Öffnen woanders lag; wird sie später einsortiert, bleibt der Posteingang stehen.
  const leitet = useMailWeiterleitung(weiterleitung, { mailId: mail?.id ?? null });
  // Unter der jüngsten Mail: die Antwortzeile bzw. der Editor (G) -- wie im Vorgang.
  const stelle = useAntwortStelle();
  const [einsortieren, setEinsortieren] = useState(false);
  const router = useIonRouter();

  // Ein getippter Entwurf ginge verloren, wenn der Rahmen nach Archivieren die nächste Mail öffnet:
  // vorher fragen (wie im Vorgang). Die Sammelleiste der Liste lässt eine Mail mit Entwurf offen.
  const entwurfSchutz = useEntwurfSchutz();
  const { entwurfMelden } = rahmen;
  const hatEntwurf = stelle.hatEntwurf;
  useEffect(() => {
    entwurfMelden(hatEntwurf);
    return () => entwurfMelden(null);
  }, [entwurfMelden, hatEntwurf]);

  if (!mail || !stand) {
    if (laedt) return <WebLeseHinweis icon={ICON_MAIL} titel="Die Mail wird geladen." />;
    if (fehler && !nichtGefunden) {
      return (
        <WebLeseHinweis icon={ICON_WARNHINWEIS} titel="Die Mail konnte nicht geladen werden.">
          <WebKnopf onClick={() => { void laden(); }}>Erneut versuchen</WebKnopf>
        </WebLeseHinweis>
      );
    }
    return <WebLeseHinweis icon={ICON_MAIL} titel="Mail nicht gefunden" text="Diese Mail gibt es nicht (mehr) — archivierte Mails bleiben 180 Tage." />;
  }

  // Sie liegt woanders: Die Seite ist gleich dort (useMailWeiterleitung) -- oder, wenn sie erst
  // nach dem Öffnen dorthin kam, öffnet ein Knopf sie dort, und der Posteingang bleibt stehen.
  if (weiterleitung) {
    const vorgangNr = mail.vorgang_id ?? null;
    if (leitet) return <WebLeseHinweis icon={ICON_LISTE} titel={MAIL_DETAIL_TEXT.weiterleitung(vorgangNr)} />;
    return (
      <WebLeseHinweis icon={ICON_LISTE} titel={MAIL_DETAIL_TEXT.verschoben(vorgangNr)}>
        <WebKnopf art="primaer" onClick={() => router.push(weiterleitung)}>{MAIL_DETAIL_TEXT.verschobenOeffnen(vorgangNr)}</WebKnopf>
      </WebLeseHinweis>
    );
  }

  const titel = betreffKern(mail.betreff) || '(ohne Betreff)';
  const name = mail.von_name?.trim();
  const zahl = (schluessel: string) => kennzahlen.find((k) => k.schluessel === schluessel)?.zahl ?? 0;
  const mails = zahl('mails');
  const anhaenge = zahl('anhaenge');
  const postfach = POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach;

  // Nach Archivieren fällt die Mail aus der Liste: die nächste öffnen (mit Rahmen).
  const archivierenUndWeiter = () => {
    const weiter = () => { void archivieren().then((ok) => { if (ok && mitRahmen) rahmen.abgeschlossen(mail.id); }); };
    if (mitRahmen) entwurfSchutz({ antwort: stelle.hatEntwurf(), notiz: false }, weiter);
    else weiter();
  };

  const kennzeichen = (
    <>
      <span className="web-lesen__absender">
        {MAIL_DETAIL_TEXT.von} {name ? <><strong>{name}</strong> &lt;{mail.von_adresse}&gt;</> : <strong>{mail.von_adresse}</strong>}
      </span>
      <span className="web-lesen__postfach">{MAIL_DETAIL_TEXT.an} <WebPill postfach>{postfach}</WebPill></span>
      <time dateTime={mail.gesendet_am} title={datumUhrzeit(mail.gesendet_am)}>{standZeit(mail.gesendet_am)}</time>
      {mails > 1 && <span>{mailsText(mails)}</span>}
      {anhaenge > 0 && <span>{VERLAUF_TEXT.anhaenge(anhaenge)}</span>}
      {/* Im Archiv sagt es der Stand-Satz darunter; die Marke nur, falls er fehlt (jede Angabe einmal). */}
      {stand.archiviert && !stand.satz && <WebPill ton="neutral">{MAIL_DETAIL_TEXT.archiv}</WebPill>}
    </>
  );

  const symbole = (
    <>
      {stand.loeschbar && (
        <KopfKnopf label={MAIL_DETAIL_TEXT.loeschen} icon={ICON_LOESCHEN} art="gefahr" symbol="immer" onClick={loeschenFragen} disabled={!isOnline} />
      )}
      {stand.archivierbar && (
        <KopfKnopf label={MAIL_DETAIL_TEXT.archivieren} icon={ICON_ARCHIV} symbol="immer" onClick={archivierenUndWeiter} disabled={!isOnline} />
      )}
    </>
  );
  const neben = stand.neben.map((a) => (a === 'antworten' ? (
    <KopfKnopf key={a} {...MAIL_DETAIL_TEXT.antworten} icon={ICON_ANTWORTEN} symbol="unter600" onClick={stelle.oeffnen} disabled={!antwort || !isOnline} />
  ) : (
    <KopfKnopf key={a} {...MAIL_DETAIL_TEXT.wiederherstellen} icon={ICON_RUECKGAENGIG} symbol="unter600" onClick={() => { void wiederherstellen(); }} disabled={!isOnline} />
  )));
  const haupt = stand.haupt === 'einsortieren' ? (
    <KopfKnopf {...MAIL_DETAIL_TEXT.einsortieren} icon={ICON_WECHSEL} art="primaer" onClick={() => setEinsortieren(true)} disabled={!isOnline} />
  ) : null;

  const wer = letzteEingehende && letzteEingehende.richtung === 'ein'
    ? letzteEingehende.von_name?.trim() || letzteEingehende.von_adresse
    : null;

  return (
    <WebLesen
      titel={titel}
      kreis={<MailKreis name={mail.von_name} adresse={mail.von_adresse} gross />}
      kennzeichen={kennzeichen}
      aktionen={<KopfAktionen symbole={symbole} neben={neben} haupt={haupt} />}
    >
      {stand.satz && <StandZeile satz={stand.satz} ton={stand.ton ?? 'hinweis'} />}

      <MailGespraeche
        key={mail.id}
        mails={faden}
        neu={neu}
        titelKern={mail.betreff}
        beschriftung="Verlauf"
        nachJuengster={antwort ? <WebAntwortStelle stelle={stelle} antwort={antwort} wer={wer} schluessel={mail.id} disabled={!isOnline} /> : undefined}
      />

      {einsortieren && (
        <WebEinsortieren
          mail={{ id: mail.id, betreff: mail.betreff }}
          onSchliessen={() => setEinsortieren(false)}
          // In den Vorgang, mit dieser Mail offen und hervorgehoben (E).
          onFertig={(id) => { onEinsortiert?.(); if (id) router.push(`/admin/support/vorgaenge/${id}?mail=${mail.id}`); }}
        />
      )}
    </WebLesen>
  );
};

export default WebPostDetail;
