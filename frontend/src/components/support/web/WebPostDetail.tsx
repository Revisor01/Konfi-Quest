// Eine Mail aus dem Posteingang im Lesebereich der Web-Fassung (rechts neben
// der Liste, web/WebPosteingang; docs/planung/support-vorgaenge.md,
// Entscheidung 7) -- wie in einem Mailprogramm (Simon, 11.10.2026).
//
// Kopf: Betreff, Absender, Postfach; rechts Antworten (solange die Mail in
// keinem Vorgang liegt, vom selben Postfach an den Absender), Einsortieren
// (kompakter Dialog: bestehender oder neuer Vorgang, der ganze Faden geht
// mit), Archivieren oder Wiederherstellen, Löschen mit Rückfrage. Darunter der
// Faden als Gespräch (MailGespraeche). „Antworten" öffnet das Formular unter
// dem Verlauf. Liegt die Mail schon in einem Vorgang, führt ein Knopf dorthin;
// geantwortet wird dort, damit Postfach und Nummer im Betreff stimmen.
//
// Die Logik (laden, als gelesen melden, archivieren, löschen) steht in
// components/support/usePostDetail.ts, dieselbe wie in der App.

import React, { useEffect, useRef, useState } from 'react';
import { IonIcon, useIonRouter } from '@ionic/react';
import { ICON_ANTWORTEN, ICON_ARCHIV, ICON_LISTE, ICON_LOESCHEN, ICON_MAIL, ICON_RUECKGAENGIG, ICON_WARNHINWEIS, ICON_WECHSEL } from '../../shared/icons';
import api from '../../../services/api';
import type { MailAntwortDaten } from '../../../types/support';
import { POSTFACH_INFO } from '../../../utils/supportMail';
import { datumUhrzeit } from '../../../utils/dateUtils';
import { usePostDetail } from '../usePostDetail';
import MailGespraeche from '../MailGespraeche';
import WebKnopf from '../../web/WebKnopf';
import WebHinweis from '../../web/WebHinweis';
import WebPill from '../../web/WebPill';
import WebAntwortEditor from './WebAntwortEditor';
import WebEinsortieren from './WebEinsortieren';
import { WebLesebereich, WebLeseHinweis } from './WebPostfach';
import '../../../theme/web/support.css';

export interface WebPostDetailProps {
  nachrichtId: number;
  /** Die Mail ist gelöscht: den Lesebereich leeren. */
  onGeloescht?: () => void;
  /**
   * Die Mail ist einsortiert und steht nicht mehr im Posteingang: Auswahl
   * leeren. Sonst laedt der Lesebereich sie neu und meldet den Verlauf ihres
   * Vorgangs als gelesen, ohne dass ihn jemand geoeffnet hat.
   */
  onEinsortiert?: () => void;
}

const WebPostDetail: React.FC<WebPostDetailProps> = ({ nachrichtId, onGeloescht, onEinsortiert }) => {
  const {
    isOnline, mail, faden, neu, laedt, fehler, nichtGefunden, laden, letzteEingehende, betreffVorschlag, vorgangId, archiviert,
    archivieren, wiederherstellen, loeschenFragen,
  } = usePostDetail(nachrichtId, onGeloescht);
  const [einsortieren, setEinsortieren] = useState(false);
  const [antwortOffen, setAntwortOffen] = useState(false);
  const antwortBereich = useRef<HTMLElement>(null);
  const router = useIonRouter();

  useEffect(() => {
    if (antwortOffen) antwortBereich.current?.scrollIntoView?.({ block: 'nearest' });
  }, [antwortOffen]);

  if (!mail) {
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

  const imVorgang = vorgangId !== null;
  const antworten = !imVorgang && !archiviert && letzteEingehende !== null;
  const absender = mail.von_name?.trim();

  return (
    <WebLesebereich
      titel={mail.betreff?.trim() || '(ohne Betreff)'}
      angaben={(
        <>
          <span>{absender ? <><strong>{absender}</strong> &lt;{mail.von_adresse}&gt;</> : <strong>{mail.von_adresse}</strong>}</span>
          <WebPill postfach>{POSTFACH_INFO[mail.postfach]?.kurz ?? mail.postfach}</WebPill>
          <span>{faden.length === 1 ? 'eine Mail' : `${faden.length} Mails im Faden`}</span>
          {archiviert && <WebPill ton="neutral">Archiv</WebPill>}
        </>
      )}
      werkzeuge={(
        <>
          {antworten && (
            <WebKnopf art="primaer" disabled={!isOnline} onClick={() => setAntwortOffen(true)}>
              <IonIcon icon={ICON_ANTWORTEN} aria-hidden="true" />
              Antworten
            </WebKnopf>
          )}
          <WebKnopf art={antworten ? 'sekundaer' : 'primaer'} disabled={!isOnline} onClick={() => setEinsortieren(true)}>
            <IonIcon icon={ICON_WECHSEL} aria-hidden="true" />
            {imVorgang ? 'Umsortieren' : 'Einsortieren'}
          </WebKnopf>
          {archiviert ? (
            <WebKnopf symbol disabled={!isOnline} onClick={() => { void wiederherstellen(); }} aria-label="Wiederherstellen" title="Wiederherstellen">
              <IonIcon icon={ICON_RUECKGAENGIG} aria-hidden="true" />
            </WebKnopf>
          ) : (
            <WebKnopf symbol disabled={!isOnline} onClick={() => { void archivieren(); }} aria-label="Archivieren" title="Archivieren">
              <IonIcon icon={ICON_ARCHIV} aria-hidden="true" />
            </WebKnopf>
          )}
          <WebKnopf symbol art="gefahr" disabled={!isOnline} onClick={loeschenFragen} aria-label="Löschen" title="Löschen">
            <IonIcon icon={ICON_LOESCHEN} aria-hidden="true" />
          </WebKnopf>
        </>
      )}
    >
      {archiviert && (
        <WebHinweis art="hinweis" titel="Diese Mail liegt im Archiv">
          <p className="web-hinweis__absatz">
            {mail.archiviert_am ? `Archiviert am ${datumUhrzeit(mail.archiviert_am)}. ` : ''}
            Nach 180 Tagen wird sie gelöscht. Stelle sie wieder her, wenn sie einsortiert werden soll.
          </p>
        </WebHinweis>
      )}
      {imVorgang && (
        <WebHinweis art="erfolg" titel={`Einsortiert in Vorgang ${vorgangId}`}>
          <p className="web-hinweis__absatz">Antworten gehen über den Vorgang, damit die Nummer im Betreff steht.</p>
          <WebKnopf klein href={`/admin/support/vorgaenge/${vorgangId}`}>
            <IonIcon icon={ICON_LISTE} aria-hidden="true" />
            Vorgang öffnen
          </WebKnopf>
        </WebHinweis>
      )}

      <MailGespraeche key={mail.id} mails={faden} neu={neu} beschriftung="Faden" />

      {antwortOffen && antworten && letzteEingehende && (
        <section ref={antwortBereich} className="web-lesen__antwort" aria-label="Antwort schreiben">
          <div className="web-lesen__antwortkopf">
            <h3 className="web-lesen__antworttitel">Antwort</h3>
            <WebKnopf klein onClick={() => setAntwortOffen(false)}>Verwerfen</WebKnopf>
          </div>
          <WebAntwortEditor
            key={mail.id}
            postfach={mail.postfach}
            betreffVorschlag={betreffVorschlag}
            an={letzteEingehende.von_adresse}
            senden={(koerper: MailAntwortDaten) => api.post(`/support/mail/nachrichten/${mail.id}/antworten`, koerper)}
            onGesendet={() => setAntwortOffen(false)}
          />
        </section>
      )}

      {einsortieren && (
        <WebEinsortieren
          mail={{ id: mail.id, betreff: mail.betreff }}
          onSchliessen={() => setEinsortieren(false)}
          onFertig={(id) => { onEinsortiert?.(); if (id) router.push(`/admin/support/vorgaenge/${id}`); }}
        />
      )}
    </WebLesebereich>
  );
};

export default WebPostDetail;
